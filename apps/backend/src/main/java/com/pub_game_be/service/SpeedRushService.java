package com.pub_game_be.service;

import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Speed Rush con prove e punteggio sul server.
 *
 * <p>Il telefono riceve una prova senza la soluzione e manda solo la risposta
 * scelta. Il server decide se è corretta, aggiorna la corsia e, alla fine,
 * calcola la graduatoria e i punti. La TV riceve soltanto gli eventi di
 * avanzamento e il risultato finale, quindi non può assegnare punti da sé.</p>
 */
@Service
public class SpeedRushService {

    private static final String BLOB = "speed-rush";
    private static final long DURATION_MS = 60_000L;
    /**
     * Corsa lunga: con 2 punti per risposta e un solo raddoppio servono almeno
     * 25 risposte giuste per tagliare il traguardo (prima bastavano 4-5).
     */
    private static final int STEP_FORWARD = 2;
    private static final int STEP_BACK = 4;
    /** Moltiplicatore massimo: limitato, così il traguardo non si salta in pochi colpi. */
    private static final int MAX_MULTIPLIER = 2;

    public record Task(String id, String kind, String publicJson, String answer) {
    }

    private static final class PlayerState {
        String name;
        int progress;
        int streak;
        int multiplier = 1;
        boolean finished;
        int position;
        long finishedAt = -1;
        Task task;
    }

    private static final class Session {
        String roundKey;
        long startedAt;
        long deadlineAt;
        boolean finished;
        int finishedCount;
        /** Firme delle prove già uscite: nello stesso round niente doppioni. */
        final Set<String> asked = new LinkedHashSet<>();
        final Map<String, PlayerState> players = new LinkedHashMap<>();
    }

    private static final String[][] PRIMARIES = {
            {"ROSSO", "#c0392b"}, {"GIALLO", "#dfa100"}, {"BLU", "#1f4e9c"},
    };
    private static final String[][] MIXES = {
            {"VERDE", "#2f7d4f", "GIALLO", "BLU"},
            {"ARANCIONE", "#d4691e", "ROSSO", "GIALLO"},
            {"VIOLA", "#6b3fa0", "ROSSO", "BLU"},
    };
    private static final String[][] FLAGS = {
            {"🇨🇲", "CAMERUN"}, {"🇸🇳", "SENEGAL"}, {"🇮🇹", "ITALIA"},
            {"🇫🇷", "FRANCIA"}, {"🇩🇪", "GERMANIA"}, {"🇪🇸", "SPAGNA"},
            {"🇵🇹", "PORTOGALLO"}, {"🇧🇷", "BRASILE"}, {"🇦🇷", "ARGENTINA"},
            {"🇯🇵", "GIAPPONE"}, {"🇨🇦", "CANADA"}, {"🇲🇽", "MESSICO"},
            {"🇳🇬", "NIGERIA"}, {"🇬🇭", "GHANA"}, {"🇧🇪", "BELGIO"},
            {"🇳🇱", "OLANDA"}, {"🇸🇪", "SVEZIA"}, {"🇳🇴", "NORVEGIA"},
            {"🇩🇰", "DANIMARCA"}, {"🇬🇷", "GRECIA"}, {"🇹🇷", "TURCHIA"},
            {"🇪🇬", "EGITTO"}, {"🇲🇦", "MAROCCO"}, {"🇿🇦", "SUDAFRICA"},
            {"🇦🇺", "AUSTRALIA"}, {"🇮🇳", "INDIA"}, {"🇨🇳", "CINA"},
            {"🇰🇷", "COREA DEL SUD"}, {"🇨🇭", "SVIZZERA"}, {"🇦🇹", "AUSTRIA"},
            {"🇵🇱", "POLONIA"}, {"🇺🇦", "UCRAINA"}, {"🇮🇪", "IRLANDA"},
            {"🇺🇾", "URUGUAY"}, {"🇨🇱", "CILE"}, {"🇨🇴", "COLOMBIA"},
            {"🇵🇪", "PERÙ"}, {"🇰🇪", "KENIA"}, {"🇪🇹", "ETIOPIA"},
            {"🇹🇳", "TUNISIA"}, {"🇩🇿", "ALGERIA"}, {"🇮🇸", "ISLANDA"},
            {"🇫🇮", "FINLANDIA"},
    };
    private static final String[][] WORDS = {
            {"BELLO", "CARINO", "BRUTTO"}, {"VELOCE", "RAPIDO", "LENTO"},
            {"GRANDE", "ENORME", "PICCOLO"}, {"FACILE", "SEMPLICE", "DIFFICILE"},
            {"CALDO", "BOLLENTE", "FREDDO"}, {"INIZIARE", "COMINCIARE", "FINIRE"},
            {"PULITO", "LINDO", "SPORCO"}, {"CORAGGIOSO", "AUDACE", "CODARDO"},
            {"RICCO", "BENESTANTE", "POVERO"}, {"ANTICO", "VECCHIO", "MODERNO"},
            {"FELICE", "CONTENTO", "TRISTE"}, {"BUIO", "SCURO", "LUMINOSO"},
            {"FORTE", "ROBUSTO", "DEBOLE"},
    };
    /** Gruppi di bandiere vicine: il distrattore dei livelli alti esce da qui. */
    private static final String[][] FLAG_GROUPS = {
            {"CAMERUN", "SENEGAL", "NIGERIA", "GHANA", "EGITTO", "MAROCCO",
             "SUDAFRICA", "KENIA", "ETIOPIA", "TUNISIA", "ALGERIA"},
            {"ITALIA", "FRANCIA", "GERMANIA", "SPAGNA", "PORTOGALLO", "BELGIO",
             "OLANDA", "SVEZIA", "NORVEGIA", "DANIMARCA", "GRECIA", "TURCHIA",
             "SVIZZERA", "AUSTRIA", "POLONIA", "UCRAINA", "IRLANDA", "ISLANDA", "FINLANDIA"},
            {"BRASILE", "ARGENTINA", "CANADA", "MESSICO", "URUGUAY", "CILE", "COLOMBIA", "PERÙ"},
            {"GIAPPONE", "INDIA", "CINA", "COREA DEL SUD"},
            {"AUSTRALIA"},
    };
    /** Parole inglesi con la famiglia: il distrattore plausibile resta in tema. */
    private static final String[][] ENGLISH = {
            {"DOG", "CANE", "ANIMALI"}, {"CAT", "GATTO", "ANIMALI"},
            {"HORSE", "CAVALLO", "ANIMALI"}, {"FISH", "PESCE", "ANIMALI"},
            {"HOUSE", "CASA", "LUOGHI"}, {"SCHOOL", "SCUOLA", "LUOGHI"},
            {"CITY", "CITTÀ", "LUOGHI"}, {"STREET", "STRADA", "LUOGHI"},
            {"BOOK", "LIBRO", "OGGETTI"}, {"BREAD", "PANE", "OGGETTI"},
            {"WATER", "ACQUA", "NATURA"}, {"SUN", "SOLE", "NATURA"},
            {"MOON", "LUNA", "NATURA"}, {"SEA", "MARE", "NATURA"},
            {"MOUNTAIN", "MONTAGNA", "NATURA"}, {"FLOWER", "FIORE", "NATURA"},
            {"FIRE", "FUOCO", "NATURA"}, {"SNOW", "NEVE", "NATURA"},
            {"FRIEND", "AMICO", "PERSONE"}, {"NIGHT", "NOTTE", "TEMPO"},
    };

    private final StateBlobService stateBlobs;
    private final Map<Long, Session> sessions = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public SpeedRushService(StateBlobService stateBlobs) {
        this.stateBlobs = stateBlobs;
    }

    public synchronized JSONObject start(long gameId, List<String> playerNames, String roundKey) {
        Session existing = session(gameId);
        String key = roundKey == null ? "" : roundKey;
        if (existing != null && !existing.finished && key.equals(existing.roundKey)
                && !existing.players.isEmpty()) {
            return summary(existing);
        }

        Session session = new Session();
        session.roundKey = key;
        session.startedAt = System.currentTimeMillis();
        session.deadlineAt = session.startedAt + DURATION_MS;
        Set<String> seen = new LinkedHashSet<>();
        if (playerNames != null) {
            for (String raw : playerNames) {
                String name = raw == null ? "" : raw.trim();
                if (name.isEmpty() || !seen.add(name.toLowerCase(Locale.ROOT))) {
                    continue;
                }
                PlayerState player = new PlayerState();
                player.name = name;
                player.task = newTask(null, difficultyFor(0), session.asked);
                session.players.put(name.toLowerCase(Locale.ROOT), player);
            }
        }
        sessions.put(gameId, session);
        persist(gameId, session);
        return summary(session);
    }

    public synchronized Optional<JSONObject> task(long gameId, String playerName) {
        Session session = session(gameId);
        if (!accepting(session)) {
            return Optional.empty();
        }
        PlayerState player = player(session, playerName);
        if (player == null || player.finished || player.task == null) {
            return Optional.empty();
        }
        return Optional.of(new JSONObject(player.task.publicJson()));
    }

    public synchronized Optional<JSONObject> answer(long gameId, String playerName, String taskId, Object rawAnswer) {
        Session session = session(gameId);
        if (!accepting(session)) {
            return Optional.empty();
        }
        PlayerState player = player(session, playerName);
        if (player == null || player.finished || player.task == null
                || taskId == null || !taskId.equals(player.task.id())) {
            return Optional.empty();
        }

        boolean correct = player.task.answer().equals(normalizeAnswer(rawAnswer));
        if (correct) {
            player.streak++;
            player.multiplier = multiplierFor(player.streak);
            player.progress = Math.min(100, player.progress + STEP_FORWARD * player.multiplier);
        } else {
            player.streak = 0;
            player.multiplier = 1;
            player.progress = Math.max(0, player.progress - STEP_BACK);
        }

        if (player.progress >= 100) {
            player.finished = true;
            player.position = ++session.finishedCount;
            player.finishedAt = System.currentTimeMillis() - session.startedAt;
            player.task = null;
        } else {
            player.task = newTask(player.task.kind(), difficultyFor(player.progress), session.asked);
        }
        persist(gameId, session);
        return Optional.of(progressJson(player));
    }

    public synchronized JSONArray finish(long gameId) {
        Session session = session(gameId);
        if (session == null) {
            return new JSONArray();
        }
        session.finished = true;
        List<PlayerState> ranked = new ArrayList<>(session.players.values());
        ranked.sort(Comparator
                .comparing((PlayerState player) -> !player.finished)
                .thenComparingInt(player -> player.finished ? player.position : 0)
                .thenComparing(Comparator.comparingInt((PlayerState player) -> player.progress).reversed()));

        int qualifiers = Math.max(1, (int) Math.ceil(ranked.size() / 2.0));
        long firstTime = ranked.stream()
                .filter(player -> player.finished && player.finishedAt >= 0)
                .mapToLong(player -> player.finishedAt)
                .min().orElse(0L);

        JSONArray results = new JSONArray();
        for (int index = 0; index < ranked.size(); index++) {
            PlayerState player = ranked.get(index);
            int points = 0;
            if (player.finished && index < qualifiers) {
                if (index == 0) {
                    points = 500;
                } else {
                    points = Math.max(100, (int) Math.round(500.0 * firstTime
                            / Math.max(1L, player.finishedAt)));
                }
            }
            results.put(new JSONObject()
                    .put("playerName", player.name)
                    .put("points", points)
                    .put("position", player.position > 0 ? player.position : JSONObject.NULL)
                    .put("progress", player.progress)
                    .put("finished", player.finished)
                    .put("finishedAt", player.finishedAt >= 0 ? player.finishedAt : JSONObject.NULL));
        }
        persist(gameId, session);
        return results;
    }

    public synchronized void forget(long gameId) {
        sessions.remove(gameId);
        stateBlobs.forget(gameId, BLOB);
    }

    private boolean accepting(Session session) {
        return session != null && !session.finished && System.currentTimeMillis() <= session.deadlineAt;
    }

    private PlayerState player(Session session, String name) {
        if (session == null || name == null) {
            return null;
        }
        return session.players.get(name.trim().toLowerCase(Locale.ROOT));
    }

    private JSONObject summary(Session session) {
        return new JSONObject()
                .put("active", !session.finished)
                .put("startedAt", session.startedAt)
                .put("deadlineAt", session.deadlineAt)
                .put("players", session.players.values().stream()
                        .map(player -> new JSONObject().put("playerName", player.name)
                                .put("progress", player.progress))
                        .toList());
    }

    private JSONObject progressJson(PlayerState player) {
        JSONObject out = new JSONObject()
                .put("playerName", player.name)
                .put("correct", player.streak > 0 || player.finished)
                .put("progress", player.progress)
                .put("streak", player.streak)
                .put("multiplier", player.multiplier)
                .put("finished", player.finished)
                .put("position", player.position > 0 ? player.position : JSONObject.NULL)
                .put("finishedAt", player.finishedAt >= 0 ? player.finishedAt : JSONObject.NULL);
        out.put("nextTask", player.task == null ? JSONObject.NULL : new JSONObject(player.task.publicJson()));
        return out;
    }

    private int multiplierFor(int streak) {
        return streak >= 6 ? MAX_MULTIPLIER : 1;
    }

    /** Minimo di risposte giuste per finire: usato dai test come contratto. */
    static int minimumCorrectAnswers() {
        return (100 + STEP_FORWARD * MAX_MULTIPLIER - 1) / (STEP_FORWARD * MAX_MULTIPLIER);
    }

    /**
     * Fasce di difficoltà: la corsa si fa più dura man mano che si avanza,
     * così il traguardo non arriva con venti domandine da prima elementare.
     */
    String difficultyFor(int progress) {
        if (progress < 35) return "EASY";
        if (progress < 70) return "MEDIUM";
        return "HARD";
    }

    /**
     * Prova nuova, mai già uscita in questo round: se il sorteggio ripete una
     * domanda si ritenta (fino a 60 volte, poi si accetta per non bloccare).
     */
    Task newTask(String previousKind, String difficulty, Set<String> asked) {
        String[] kinds = {"math", "colors", "flag", "words", "translate"};
        Task task = null;
        for (int attempt = 0; attempt < 60; attempt++) {
            String kind;
            do {
                kind = kinds[random.nextInt(kinds.length)];
            } while (kind.equals(previousKind));
            String id = "sr-" + UUID.randomUUID();
            task = switch (kind) {
                case "math" -> mathTask(id, difficulty);
                case "colors" -> colorsTask(id);
                case "flag" -> flagTask(id, difficulty);
                case "words" -> wordsTask(id, difficulty);
                default -> translateTask(id, difficulty);
            };
            if (asked == null || asked.add(signature(task))) {
                return task;
            }
        }
        return task;
    }

    /** Firma della prova: serve a scartare le ripetizioni. */
    String signature(Task task) {
        JSONObject pub = new JSONObject(task.publicJson());
        return switch (task.kind()) {
            case "math" -> "math:" + pub.optString("text");
            case "colors" -> "colors:" + pub.optString("target");
            case "flag" -> "flag:" + pub.optString("emoji");
            case "words" -> "words:" + pub.optString("prompt") + ":" + pub.optString("relation");
            default -> "translate:" + pub.optString("prompt");
        };
    }

    private Task mathTask(String id, String difficulty) {
        boolean multiply = "HARD".equals(difficulty) || random.nextBoolean();
        int a;
        int b;
        switch (difficulty) {
            case "HARD" -> {
                a = 12 + random.nextInt(14);
                b = 4 + random.nextInt(9);
            }
            case "MEDIUM" -> {
                a = 4 + random.nextInt(9);
                b = 3 + random.nextInt(7);
            }
            default -> {
                a = 2 + random.nextInt(5);
                b = 2 + random.nextInt(5);
            }
        }
        int answer = multiply ? a * b : a + b;
        Set<Integer> options = new LinkedHashSet<>();
        options.add(answer);
        while (options.size() < 3) {
            int candidate = answer + new int[]{-3, -2, -1, 1, 2, 3}[random.nextInt(6)];
            if (candidate > 0) options.add(candidate);
        }
        List<Integer> shuffled = new ArrayList<>(options);
        java.util.Collections.shuffle(shuffled, random);
        String operator = multiply ? "×" : "+";
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "math")
                .put("difficulty", difficulty)
                .put("text", a + " " + operator + " " + b)
                .put("options", new JSONArray(shuffled));
        return new Task(id, "math", pub.toString(), String.valueOf(answer));
    }

    private Task colorsTask(String id) {
        String[] mix = MIXES[random.nextInt(MIXES.length)];
        JSONArray options = new JSONArray();
        List<String[]> primaries = new ArrayList<>(List.of(PRIMARIES));
        java.util.Collections.shuffle(primaries, random);
        for (String[] primary : primaries) {
            options.put(new JSONObject().put("name", primary[0]).put("swatch", primary[1]));
        }
        List<String> answers = new ArrayList<>(List.of(mix[2], mix[3]));
        java.util.Collections.sort(answers);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "colors")
                .put("target", mix[0])
                .put("swatch", mix[1])
                .put("options", options);
        return new Task(id, "colors", pub.toString(), String.join("|", answers));
    }

    private Task flagTask(String id, String difficulty) {
        String[] correct = FLAGS[random.nextInt(FLAGS.length)];
        // Facile: un paese qualsiasi. Da media in su: un vicino di continente,
        // che è il distrattore che frega davvero.
        String distractor = "EASY".equals(difficulty) ? null : flagNeighbour(correct[1]);
        if (distractor == null) {
            do {
                distractor = FLAGS[random.nextInt(FLAGS.length)][1];
            } while (distractor.equals(correct[1]));
        }
        List<String> options = new ArrayList<>(List.of(correct[1], distractor));
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "flag")
                .put("difficulty", difficulty)
                .put("emoji", correct[0])
                .put("options", new JSONArray(options));
        return new Task(id, "flag", pub.toString(), correct[1]);
    }

    private Task wordsTask(String id, String difficulty) {
        int pool = "EASY".equals(difficulty) ? 6 : WORDS.length;
        String[] word = WORDS[random.nextInt(pool)];
        boolean synonym = random.nextBoolean();
        String answer = synonym ? word[1] : word[2];
        // Il distrattore plausibile è l'altra relazione della stessa parola:
        // chiesto il sinonimo, in mezzo c'è il contrario (e viceversa).
        String distractor = synonym ? word[2] : word[1];
        List<String> options = new ArrayList<>(List.of(answer, distractor));
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "words")
                .put("difficulty", difficulty)
                .put("prompt", word[0])
                .put("relation", synonym ? "SINONIMO" : "CONTRARIO")
                .put("options", new JSONArray(options));
        return new Task(id, "words", pub.toString(), answer);
    }

    private Task translateTask(String id, String difficulty) {
        String[] word = ENGLISH[random.nextInt(ENGLISH.length)];
        String distractor = "EASY".equals(difficulty) ? null : sameCategoryWord(word);
        if (distractor == null) {
            do {
                distractor = ENGLISH[random.nextInt(ENGLISH.length)][1];
            } while (distractor.equals(word[1]));
        }
        List<String> options = new ArrayList<>(List.of(word[1], distractor));
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "translate")
                .put("difficulty", difficulty)
                .put("prompt", word[0])
                .put("options", new JSONArray(options));
        return new Task(id, "translate", pub.toString(), word[1]);
    }

    private String flagNeighbour(String country) {
        for (String[] group : FLAG_GROUPS) {
            for (String name : group) {
                if (!name.equals(country)) continue;
                List<String> others = new ArrayList<>();
                for (String sibling : group) {
                    if (!sibling.equals(country)) others.add(sibling);
                }
                if (!others.isEmpty()) return others.get(random.nextInt(others.size()));
            }
        }
        return null;
    }

    private String sameCategoryWord(String[] word) {
        List<String> same = new ArrayList<>();
        for (String[] row : ENGLISH) {
            if (row[2].equals(word[2]) && !row[1].equals(word[1])) same.add(row[1]);
        }
        return same.isEmpty() ? null : same.get(random.nextInt(same.size()));
    }

    private String normalizeAnswer(Object raw) {
        if (raw instanceof List<?> list) {
            List<String> values = new ArrayList<>();
            for (Object value : list) {
                String text = String.valueOf(value).trim().toUpperCase(Locale.ROOT);
                if (!text.isEmpty()) values.add(text);
            }
            java.util.Collections.sort(values);
            return String.join("|", values);
        }
        String text = raw == null ? "" : String.valueOf(raw).trim().toUpperCase(Locale.ROOT);
        if (text.contains(",") || text.contains("|")) {
            List<String> values = new ArrayList<>();
            for (String part : text.split("[,|]")) {
                if (!part.isBlank()) values.add(part.trim());
            }
            java.util.Collections.sort(values);
            return String.join("|", values);
        }
        return text;
    }

    private Session session(long gameId) {
        Session session = sessions.get(gameId);
        if (session != null) {
            return session;
        }
        Optional<String> blob = stateBlobs.load(gameId, BLOB);
        if (blob.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            Session restored = new Session();
            restored.roundKey = json.optString("roundKey", "");
            restored.startedAt = json.optLong("startedAt", 0);
            restored.deadlineAt = json.optLong("deadlineAt", 0);
            restored.finished = json.optBoolean("finished", false);
            restored.finishedCount = json.optInt("finishedCount", 0);
            JSONArray asked = json.optJSONArray("asked");
            for (int index = 0; asked != null && index < asked.length(); index++) {
                restored.asked.add(asked.optString(index));
            }
            JSONArray players = json.optJSONArray("players");
            for (int index = 0; players != null && index < players.length(); index++) {
                JSONObject row = players.optJSONObject(index);
                if (row == null) continue;
                PlayerState player = new PlayerState();
                player.name = row.optString("name", "");
                player.progress = row.optInt("progress", 0);
                player.streak = row.optInt("streak", 0);
                player.multiplier = Math.max(1, row.optInt("multiplier", 1));
                player.finished = row.optBoolean("finished", false);
                player.position = row.optInt("position", 0);
                player.finishedAt = row.optLong("finishedAt", -1);
                JSONObject task = row.optJSONObject("task");
                if (task != null) {
                    player.task = new Task(task.optString("id", ""), task.optString("kind", ""),
                            task.optString("public", "{}"), task.optString("answer", ""));
                }
                if (!player.name.isBlank()) {
                    restored.players.put(player.name.toLowerCase(Locale.ROOT), player);
                }
            }
            sessions.put(gameId, restored);
            return restored;
        } catch (Exception malformed) {
            System.out.println("⚠️ Speed Rush illeggibile per la partita " + gameId + ": " + malformed.getMessage());
            return null;
        }
    }

    private void persist(long gameId, Session session) {
        JSONArray players = new JSONArray();
        for (PlayerState player : session.players.values()) {
            JSONObject row = new JSONObject()
                    .put("name", player.name)
                    .put("progress", player.progress)
                    .put("streak", player.streak)
                    .put("multiplier", player.multiplier)
                    .put("finished", player.finished)
                    .put("position", player.position)
                    .put("finishedAt", player.finishedAt);
            if (player.task != null) {
                row.put("task", new JSONObject()
                        .put("id", player.task.id())
                        .put("kind", player.task.kind())
                        .put("public", player.task.publicJson())
                        .put("answer", player.task.answer()));
            }
            players.put(row);
        }
        stateBlobs.save(gameId, BLOB, new JSONObject()
                .put("roundKey", session.roundKey)
                .put("startedAt", session.startedAt)
                .put("deadlineAt", session.deadlineAt)
                .put("finished", session.finished)
                .put("finishedCount", session.finishedCount)
                .put("asked", new JSONArray(new ArrayList<>(session.asked)))
                .put("players", players)
                .toString());
    }
}
