package com.pub_game_be.service;

import com.pub_game_be.reliability.QuestionUsageService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Memoria di partita: quali domande sono già uscite, quale domanda è stata
 * assegnata a ciascun dispositivo (arena) e i punteggi.
 *
 * <p>Dal consolidamento dell'affidabilità la memoria non è più volatile:
 * le domande usate vivono in {@code question_usage} e assegnazioni/punteggi in
 * uno snapshot JSON persistito, quindi un riavvio del backend non cancella la
 * partita in corso né riapre il pool delle domande.</p>
 */
@Service
public class QuestionHistoryService {

    /** Domanda servita a un dispositivo: la risposta corretta resta sul server. */
    public record ArenaAssignment(String questionId, String playerId, String question,
            String correctAnswer, String category) {
    }

    /** Esito di una risposta dell'arena, calcolato dal server. */
    public record ArenaResult(boolean correct, String correctAnswer, int points, int totalScore) {
    }

    private static final String ARENA_BLOB = "arena-state";

    private final QuestionUsageService questionUsage;
    private final StateBlobService stateBlobs;

    private final Map<Long, Map<String, ArenaAssignment>> assignments = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Integer>> scores = new ConcurrentHashMap<>();
    private final Map<Long, AtomicLong> questionCounters = new ConcurrentHashMap<>();
    /** Quante VERO e quante FALSO sono già uscite: [vero, falso]. */
    private final Map<Long, int[]> arenaSides = new ConcurrentHashMap<>();
    private final Set<Long> hydrated = ConcurrentHashMap.newKeySet();

    public QuestionHistoryService(QuestionUsageService questionUsage, StateBlobService stateBlobs) {
        this.questionUsage = questionUsage;
        this.stateBlobs = stateBlobs;
    }

    /**
     * Varianti accettate per le risposte brevi. «Roma» vale anche come «Città
     * di Roma», «Roma capitale» e simili: il presentatore non deve correggere
     * una risposta giusta solo per come è scritta.
     */
    static boolean answersMatch(String expected, String given) {
        String canonical = normalize(expected);
        String actual = normalize(given);
        if (canonical.equals(actual)) {
            return true;
        }
        if ("roma".equals(canonical)) {
            return actual.equals("citta di roma")
                    || actual.equals("roma citta")
                    || actual.equals("roma capitale")
                    || actual.equals("comune di roma");
        }
        if ("roma".equals(actual)) {
            return canonical.equals("citta di roma")
                    || canonical.equals("roma citta")
                    || canonical.equals("roma capitale")
                    || canonical.equals("comune di roma");
        }
        return false;
    }

    /** Minuscole, senza accenti e senza punteggiatura: confronto tollerante. */
    public static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String flat = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return flat.replaceAll("[^a-z0-9]+", " ").trim();
    }

    /**
     * Chiave del fatto raccontato dalla domanda: testo e risposta. La categoria
     * resta fuori di proposito: la stessa domanda non deve passare nemmeno se
     * viene richiesta sotto etichette diverse.
     */
    public static String key(String question, String correctAnswer, String category) {
        return normalize(question) + "|" + normalize(correctAnswer);
    }

    /**
     * Chiave secondaria: due domande riformulate sullo stesso fatto hanno la
     * stessa risposta, quindi questa chiave le tratta come doppioni.
     */
    public static String answerKey(String correctAnswer, String category) {
        return "answer|" + normalize(correctAnswer);
    }

    public boolean isUsed(long gameId, String key) {
        // Le Vero/Falso non hanno chiave di risposta: "vero" e "falso" sono le
        // uniche due risposte, quindi deduplicarle per risposta bloccherebbe
        // tutta la banca dopo due domande.
        if (key == null || key.isBlank()) {
            return false;
        }
        return questionUsage.isUsed(gameId, key);
    }

    /** Registra una domanda come uscita; false se era già stata servita. */
    public boolean claim(long gameId, String key) {
        return claim(gameId, key, null, null);
    }

    /** Variante con identificativo stabile e modalità, per lo storico. */
    public boolean claim(long gameId, String key, String questionId, String mode) {
        if (key == null || key.isBlank()) {
            return true;
        }
        return questionUsage.claim(gameId, key, questionId, mode, null);
    }

    /**
     * Lato da servire adesso: si alterna per pareggiare VERO e FALSO anche se
     * la banca non è bilanciata (indovinare sempre VERO non deve convenire).
     */
    public boolean preferTrueSide(long gameId) {
        hydrate(gameId);
        int[] counts = arenaSides.computeIfAbsent(gameId, id -> new int[2]);
        synchronized (counts) {
            return counts[0] <= counts[1];
        }
    }

    public void countArenaSide(long gameId, boolean isTrue) {
        hydrate(gameId);
        int[] counts = arenaSides.computeIfAbsent(gameId, id -> new int[2]);
        synchronized (counts) {
            counts[isTrue ? 0 : 1]++;
        }
        persist(gameId);
    }

    public String nextQuestionId(long gameId) {
        hydrate(gameId);
        long counter = questionCounters.computeIfAbsent(gameId, id -> new AtomicLong()).incrementAndGet();
        return "g" + gameId + "-q" + counter;
    }

    public void assign(long gameId, ArenaAssignment assignment) {
        hydrate(gameId);
        assignments.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(assignment.questionId(), assignment);
        persist(gameId);
    }

    /**
     * Valida la risposta di un dispositivo. Vuoto se la domanda non esiste o
     * non è stata assegnata a quel giocatore.
     */
    public Optional<ArenaResult> answer(long gameId, String playerId, String questionId, String answer) {
        hydrate(gameId);
        ArenaAssignment assignment = assignments.getOrDefault(gameId, Map.of()).get(questionId);
        if (assignment == null || !assignment.playerId().equals(playerId)) {
            return Optional.empty();
        }
        boolean correct = answersMatch(assignment.correctAnswer(), answer);
        // Allineato alla TV: +10 per risposta esatta, -10 per errore.
        int points = correct ? 10 : -10;
        int totalScore = scores.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .merge(playerId, points, Integer::sum);
        persist(gameId);
        return Optional.of(new ArenaResult(correct, assignment.correctAnswer(), points, totalScore));
    }

    /**
     * L'esito è già stato registrato? Serve a non assegnare due volte i punti
     * quando un telefono ritrasmette la stessa risposta (idempotenza).
     */
    public Optional<ArenaAssignment> assignment(long gameId, String playerId, String questionId) {
        hydrate(gameId);
        ArenaAssignment assignment = assignments.getOrDefault(gameId, Map.of()).get(questionId);
        if (assignment == null || !assignment.playerId().equals(playerId)) {
            return Optional.empty();
        }
        return Optional.of(assignment);
    }

    /** Punteggi correnti della partita: è la verità che legge la TV. */
    public Map<String, Integer> scores(long gameId) {
        hydrate(gameId);
        return Map.copyOf(scores.getOrDefault(gameId, Map.of()));
    }

    /** Dimentica tutto di una partita (nuova arena o reset dalla TV). */
    public void forget(long gameId) {
        assignments.remove(gameId);
        scores.remove(gameId);
        questionCounters.remove(gameId);
        arenaSides.remove(gameId);
        hydrated.remove(gameId);
        stateBlobs.forget(gameId, ARENA_BLOB);
        questionUsage.forget(gameId);
    }

    // ------------------------------------------------------------- Persistenza

    /** Ricarica lo stato dell'arena dopo un riavvio, una sola volta per partita. */
    private void hydrate(long gameId) {
        if (!hydrated.add(gameId)) {
            return;
        }
        Optional<String> blob = stateBlobs.load(gameId, ARENA_BLOB);
        if (blob.isEmpty()) {
            return;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            JSONObject assignmentsJson = json.optJSONObject("assignments");
            if (assignmentsJson != null) {
                Map<String, ArenaAssignment> restored = new ConcurrentHashMap<>();
                for (String questionId : assignmentsJson.keySet()) {
                    JSONObject row = assignmentsJson.optJSONObject(questionId);
                    if (row == null) {
                        continue;
                    }
                    restored.put(questionId, new ArenaAssignment(questionId,
                            row.optString("playerId", ""),
                            row.optString("question", ""),
                            row.optString("correctAnswer", ""),
                            row.optString("category", "")));
                }
                assignments.put(gameId, restored);
            }

            JSONObject scoresJson = json.optJSONObject("scores");
            if (scoresJson != null) {
                Map<String, Integer> restored = new ConcurrentHashMap<>();
                for (String player : scoresJson.keySet()) {
                    restored.put(player, scoresJson.optInt(player, 0));
                }
                scores.put(gameId, restored);
            }

            long counter = json.optLong("counter", 0);
            questionCounters.put(gameId, new AtomicLong(counter));

            int[] sides = new int[2];
            org.json.JSONArray sidesJson = json.optJSONArray("sides");
            if (sidesJson != null) {
                sides[0] = sidesJson.optInt(0, 0);
                sides[1] = sidesJson.optInt(1, 0);
            }
            arenaSides.put(gameId, sides);
        } catch (Exception malformed) {
            System.out.println("⚠️ Snapshot arena illeggibile per la partita " + gameId + ": "
                    + malformed.getMessage());
        }
    }

    private void persist(long gameId) {
        JSONObject json = new JSONObject();

        JSONObject assignmentsJson = new JSONObject();
        assignments.getOrDefault(gameId, Map.of()).forEach((questionId, assignment) ->
                assignmentsJson.put(questionId, new JSONObject()
                        .put("playerId", assignment.playerId())
                        .put("question", assignment.question())
                        .put("correctAnswer", assignment.correctAnswer())
                        .put("category", assignment.category())));
        json.put("assignments", assignmentsJson);

        JSONObject scoresJson = new JSONObject();
        scores.getOrDefault(gameId, Map.of()).forEach(scoresJson::put);
        json.put("scores", scoresJson);

        AtomicLong counter = questionCounters.get(gameId);
        json.put("counter", counter == null ? 0 : counter.get());

        int[] sides = arenaSides.getOrDefault(gameId, new int[2]);
        json.put("sides", new org.json.JSONArray().put(sides[0]).put(sides[1]));

        stateBlobs.save(gameId, ARENA_BLOB, json.toString());
    }
}
