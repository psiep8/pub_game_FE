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

    /** Piazzamento puro: +800 al primo, −400 all'ultimo. */
    private static final int SPEED_RUSH_FIRST = 800;
    private static final int SPEED_RUSH_LAST = -400;

    private static final String BLOB = "speed-rush";
    private static final long DURATION_MS = 90_000L;
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
        boolean paused;
        long pausedAt;
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
    /** Proverbi: il testo ha il finale mancante, le opzioni sono parole intere. */
    private static final String[][] PROVERBS = {
            {"L'unione fa la...", "FORZA", "FESTA", "FORTUNA"},
            {"Chi va piano va sano e va...", "LONTANO", "VELOCE", "FORTE"},
            {"Meglio un uovo oggi che una gallina...", "DOMANI", "IERI", "STASERA"},
            {"Chi dorme non piglia...", "PESCI", "PUNTI", "SONNO"},
            {"A caval donato non si guarda in...", "BOCCA", "TASCA", "FACCIA"},
            {"Tra il dire e il fare c'è di mezzo il...", "MARE", "PONTE", "TEMPO"},
            {"L'appetito vien...", "MANGIANDO", "DORMENDO", "CORRENDO"},
            {"La notte porta...", "CONSIGLIO", "FORTUNA", "SILENZIO"},
            {"Roma non è stata costruita in un...", "GIORNO", "ANNO", "SECOLO"},
            {"Chi trova un amico trova un...", "TESORO", "SOGNO", "FRATELLO"},
            {"Non è tutto oro quello che...", "LUCCICA", "SPLENDE", "SUONA"},
            {"Tanto va la gatta al lardo che ci lascia lo...", "ZAMPINO", "CODA", "PELO"},
            {"Il buongiorno si vede dal...", "MATTINO", "POMERIGGIO", "TRAMONTO"},
            {"Una rondine non fa...", "PRIMAVERA", "ESTATE", "NIDO"},
            {"Chi semina vento raccoglie...", "TEMPESTA", "PIOGGIA", "FORTUNA"},
            {"Acqua cheta...", "ROVINA I PONTI", "SPEGNE IL FUOCO", "BAGNA LE STRADE"},
            {"Chi non risica non...", "ROSICA", "VINCE", "PERDE"},
            {"Le bugie hanno le gambe...", "CORTE", "LUNGHE", "SVELTE"},
            {"Quando il gatto non c'è i topi...", "BALLANO", "SCAPPANO", "DORMONO"},
            {"Ogni cosa a suo...", "TEMPO", "MODO", "POSTO"},
    };
    /** Città e regione: pool separati per difficoltà. */
    private static final String[][] GEO_EASY = {
            {"Roma", "LAZIO"}, {"Milano", "LOMBARDIA"}, {"Napoli", "CAMPANIA"},
            {"Torino", "PIEMONTE"}, {"Firenze", "TOSCANA"}, {"Venezia", "VENETO"},
            {"Bologna", "EMILIA-ROMAGNA"}, {"Palermo", "SICILIA"}, {"Genova", "LIGURIA"},
            {"Bari", "PUGLIA"},
    };
    private static final String[][] GEO_MEDIUM = {
            {"Verona", "VENETO"}, {"Pisa", "TOSCANA"}, {"Perugia", "UMBRIA"},
            {"Cagliari", "SARDEGNA"}, {"Trieste", "FRIULI-VENEZIA GIULIA"},
            {"Trento", "TRENTINO-ALTO ADIGE"}, {"Ancona", "MARCHE"}, {"Pescara", "ABRUZZO"},
            {"Reggio Calabria", "CALABRIA"}, {"Potenza", "BASILICATA"},
            {"Campobasso", "MOLISE"}, {"Aosta", "VALLE D'AOSTA"},
    };
    private static final String[][] GEO_HARD = {
            {"Udine", "FRIULI-VENEZIA GIULIA"}, {"Matera", "BASILICATA"}, {"Treviso", "VENETO"},
            {"Bergamo", "LOMBARDIA"}, {"Salerno", "CAMPANIA"}, {"Lecce", "PUGLIA"},
            {"Sassari", "SARDEGNA"}, {"Parma", "EMILIA-ROMAGNA"}, {"Livorno", "TOSCANA"},
            {"La Spezia", "LIGURIA"}, {"Novara", "PIEMONTE"}, {"Catanzaro", "CALABRIA"},
            {"Ascoli Piceno", "MARCHE"}, {"L'Aquila", "ABRUZZO"}, {"Foligno", "UMBRIA"},
            {"Ragusa", "SICILIA"}, {"Oristano", "SARDEGNA"}, {"Rovigo", "VENETO"},
            {"Biella", "PIEMONTE"}, {"Sondrio", "LOMBARDIA"},
    };
    private static final String[] REGIONS = {
            "ABRUZZO", "BASILICATA", "CALABRIA", "CAMPANIA", "EMILIA-ROMAGNA",
            "FRIULI-VENEZIA GIULIA", "LAZIO", "LIGURIA", "LOMBARDIA", "MARCHE",
            "MOLISE", "PIEMONTE", "PUGLIA", "SARDEGNA", "SICILIA", "TOSCANA",
            "TRENTINO-ALTO ADIGE", "UMBRIA", "VALLE D'AOSTA", "VENETO",
    };
    private static final String[][] ODD_EASY = {
            {"🍎", "🍋"}, {"🐶", "🐱"}, {"⭐", "🌙"}, {"🚗", "🚌"},
    };
    private static final String[][] ODD_HARD = {
            {"😀", "😄"}, {"🌕", "🌖"}, {"🐟", "🐠"}, {"🍎", "🍏"},
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

    /** La TV sospende la corsa: le risposte restano chiuse finché non riprende. */
    public synchronized boolean pause(long gameId) {
        Session session = session(gameId);
        if (session == null || session.finished) {
            return false;
        }
        if (!session.paused) {
            session.paused = true;
            session.pausedAt = System.currentTimeMillis();
            persist(gameId, session);
        }
        return true;
    }

    /** Allunga la deadline della corsa della durata della pausa. */
    public synchronized long resume(long gameId) {
        Session session = session(gameId);
        if (session == null || !session.paused) {
            return 0L;
        }
        long delta = Math.max(0L, System.currentTimeMillis() - session.pausedAt);
        session.deadlineAt += delta;
        session.paused = false;
        session.pausedAt = 0L;
        persist(gameId, session);
        return delta;
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

        int finishers = (int) ranked.stream().filter(player -> player.finished).count();
        int total = ranked.size();

        JSONArray results = new JSONArray();
        for (int index = 0; index < ranked.size(); index++) {
            PlayerState player = ranked.get(index);
            // I non arrivati sono tutti ultimi a pari merito: prendono il malus
            // dell'ultimo posto, non zero.
            int rank = player.finished ? index + 1 : Math.max(1, finishers + 1);
            int points = RankPoints.points(rank, total, SPEED_RUSH_FIRST, SPEED_RUSH_LAST);
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
        return session != null && !session.finished && !session.paused
                && System.currentTimeMillis() <= session.deadlineAt;
    }

    private PlayerState player(Session session, String name) {
        if (session == null || name == null) {
            return null;
        }
        return session.players.get(name.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Stato delle corsie: è anche ciò che la TV rilegge dopo un refresh, quindi
     * porta tutto quello che serve a ridisegnarle senza un checkpoint suo.
     */
    private JSONObject summary(Session session) {
        return new JSONObject()
                .put("active", !session.finished)
                .put("startedAt", session.startedAt)
                .put("deadlineAt", session.deadlineAt)
                .put("players", session.players.values().stream()
                        .map(player -> new JSONObject().put("playerName", player.name)
                                .put("progress", player.progress)
                                .put("streak", player.streak)
                                .put("multiplier", player.multiplier)
                                .put("finished", player.finished)
                                .put("position", player.position > 0 ? player.position : JSONObject.NULL)
                                .put("finishedAt", player.finishedAt >= 0 ? player.finishedAt : JSONObject.NULL))
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

    /**
     * Minimo di risposte giuste per finire: usato dai test come contratto.
     * Le prime sei valgono 2, dalla settima il raddoppio porta 4: non basta
     * dividere il traguardo per il passo massimo (verrebbero 25 invece di 28).
     */
    static int minimumCorrectAnswers() {
        int answers = 0;
        int progress = 0;
        int streak = 0;
        while (progress < 100) {
            answers++;
            streak++;
            progress += STEP_FORWARD * (streak >= 6 ? MAX_MULTIPLIER : 1);
        }
        return answers;
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
        String[] kinds = kindsFor(difficulty);
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
                case "proverb" -> proverbTask(id);
                case "tap" -> tapTask(id, difficulty);
                case "odd" -> oddTask(id, difficulty);
                case "order" -> orderTask(id, difficulty);
                case "reaction" -> reactionTask(id);
                case "geo" -> geoTask(id, difficulty);
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
            case "proverb" -> "proverb:" + pub.optString("prompt");
            case "tap" -> "tap:" + pub.optInt("target");
            case "odd" -> "odd:" + pub.optJSONArray("options") + ":" + task.answer();
            case "order" -> "order:" + task.answer();
            case "reaction" -> "reaction:" + pub.optInt("delayMs");
            case "geo" -> "geo:" + pub.optString("prompt");
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

    /** Tipi disponibili per fascia: i vecchi microgiochi tornano tra facile e difficile. */
    private String[] kindsFor(String difficulty) {
        return switch (difficulty == null ? "" : difficulty) {
            case "EASY" -> new String[]{"math", "colors", "tap", "odd", "geo"};
            case "HARD" -> new String[]{"translate", "proverb", "order", "odd", "geo", "reaction"};
            default -> new String[]{"flag", "words", "proverb", "tap", "order", "geo"};
        };
    }

    /** Tocca il pulsante fino al traguardo: il server conosce solo il totale. */
    private Task tapTask(String id, String difficulty) {
        int target = switch (difficulty == null ? "" : difficulty) {
            case "EASY" -> 5 + random.nextInt(3);
            case "HARD" -> 11 + random.nextInt(4);
            default -> 8 + random.nextInt(3);
        };
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "tap")
                .put("target", target);
        return new Task(id, "tap", pub.toString(), String.valueOf(target));
    }

    /** Intruso: una griglia di emoji uguali con uno diverso. */
    private Task oddTask(String id, String difficulty) {
        String[][] pairs = "HARD".equals(difficulty) ? ODD_HARD : ODD_EASY;
        String[] pair = pairs[random.nextInt(pairs.length)];
        int size = "EASY".equals(difficulty) ? 4 : "HARD".equals(difficulty) ? 9 : 6;
        List<String> options = new ArrayList<>();
        for (int index = 0; index < size - 1; index++) {
            options.add(pair[0]);
        }
        options.add(pair[1]);
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "odd")
                .put("options", new JSONArray(options));
        return new Task(id, "odd", pub.toString(), pair[1]);
    }

    /** Numeri da toccare in ordine crescente: l'ordine è la risposta. */
    private Task orderTask(String id, String difficulty) {
        int count = switch (difficulty == null ? "" : difficulty) {
            case "EASY" -> 3;
            case "HARD" -> 5;
            default -> 4;
        };
        int max = switch (difficulty == null ? "" : difficulty) {
            case "EASY" -> 9;
            case "HARD" -> 99;
            default -> 40;
        };
        int min = "EASY".equals(difficulty) ? 1 : 10;
        Set<Integer> values = new LinkedHashSet<>();
        while (values.size() < count) {
            values.add(min + random.nextInt(max - min + 1));
        }
        List<Integer> options = new ArrayList<>(values);
        java.util.Collections.shuffle(options, random);
        List<Integer> sorted = new ArrayList<>(values);
        java.util.Collections.sort(sorted);
        List<String> answer = sorted.stream().map(String::valueOf).toList();
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "order")
                .put("options", new JSONArray(options));
        return new Task(id, "order", pub.toString(), String.join("|", answer));
    }

    /** Reazione: il telefono aspetta il verde, il server fissa solo il ritardo. */
    private Task reactionTask(String id) {
        int delayMs = 900 + random.nextInt(2200);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "reaction")
                .put("delayMs", delayMs);
        return new Task(id, "reaction", pub.toString(), "READY");
    }

    /** Geografia: la città è nel testo, la risposta è la regione. */
    private Task geoTask(String id, String difficulty) {
        String[][] pool = switch (difficulty == null ? "" : difficulty) {
            case "EASY" -> GEO_EASY;
            case "HARD" -> GEO_HARD;
            default -> GEO_MEDIUM;
        };
        String[] row = pool[random.nextInt(pool.length)];
        List<String> options = new ArrayList<>();
        options.add(row[1]);
        while (options.size() < 3) {
            String region = REGIONS[random.nextInt(REGIONS.length)];
            if (!options.contains(region)) {
                options.add(region);
            }
        }
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "geo")
                .put("prompt", "In che regione si trova «" + row[0] + "»?")
                .put("options", new JSONArray(options));
        return new Task(id, "geo", pub.toString(), row[1]);
    }

    /** Prova dei proverbi: tre finali plausibili, uno solo corretto. */
    Task proverbTask(String id) {
        String[] row = PROVERBS[random.nextInt(PROVERBS.length)];
        List<String> options = new ArrayList<>(List.of(row[1], row[2], row[3]));
        java.util.Collections.shuffle(options, random);
        JSONObject pub = new JSONObject()
                .put("taskId", id)
                .put("kind", "proverb")
                .put("prompt", row[0])
                .put("options", new JSONArray(options));
        return new Task(id, "proverb", pub.toString(), row[1]);
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
            restored.paused = json.optBoolean("paused", false);
            restored.pausedAt = json.optLong("pausedAt", 0);
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
                .put("paused", session.paused)
                .put("pausedAt", session.pausedAt)
                .put("finishedCount", session.finishedCount)
                .put("asked", new JSONArray(new ArrayList<>(session.asked)))
                .put("players", players)
                .toString());
    }
}
