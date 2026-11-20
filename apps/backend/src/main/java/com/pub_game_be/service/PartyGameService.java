package com.pub_game_be.service;

import com.pub_game_be.reliability.QuestionUsageService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giochi simultanei che non vivono nella banca domande: Timeline, Speed Rush e
 * Tennis Battle.
 *
 * <p>Le soluzioni restano sul server: il telefono riceve solo le carte mescolate o
 * i prodotti senza prezzo, e il punteggio lo calcola qui.</p>
 *
 * <p>Round e risposte vengono salvati su database ({@link StateBlobService}) a ogni
 * mutazione, quindi un riavvio del backend non cancella la Timeline in corso né i
 * punti già assegnati. Gli eventi Timeline usati sono tracciati in
 * {@link QuestionUsageService}: la stessa carta non torna sul palco.</p>
 */
@Service
public class PartyGameService {

    public record TimelineEvent(String label, int year, String category, int difficulty) {
    }

    /** L'ordine inviato resta con la risposta: serve al telefono dopo un refresh. */
    public record TimelineSubmission(String playerName, int correctPairs, int totalPairs, int score,
            List<Integer> order) {
    }

    /** Esito di una risposta Timeline: solo il primo invio crea l'evento. */
    public record TimelineDecision(TimelineSubmission submission, boolean firstAnswer) {
    }

    private record TimelineRound(String token, List<TimelineEvent> ordered, Map<Integer, Integer> ranks) {
    }

    /** Ogni round Timeline ha sempre otto eventi, finale compresa. */
    private static final int TIMELINE_CARDS = 8;
    /** Mix del round: due facili, quattro medi, due difficili. */
    private static final int[] TIMELINE_EASY = { 1, 2 };
    private static final int[] TIMELINE_MEDIUM = { 3 };
    private static final int[] TIMELINE_HARD = { 4, 5 };

    private static final String TIMELINE_BLOB = "timeline-round";
    private static final String TIMELINE_ANSWERS_BLOB = "timeline-answers";

    private final StateBlobService stateBlobs;
    private final QuestionUsageService questionUsage;

    private final List<TimelineEvent> events;

    private final Map<Long, TimelineRound> timelineRounds = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, TimelineSubmission>> timelineAnswers = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public PartyGameService(StateBlobService stateBlobs, QuestionUsageService questionUsage) {
        this.stateBlobs = stateBlobs;
        this.questionUsage = questionUsage;
        this.events = loadTimeline();
        System.out.println("Banca party: " + events.size() + " eventi timeline.");
    }

    public boolean handles(String type) {
        if (type == null) {
            return false;
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "TIMELINE", "TIME_BUZZER", "BOMBA", "SPEED_RUSH", "TENNIS_BATTLE",
                    "BLACKJACK", "BIGLIE" -> true;
            default -> false;
        };
    }

    public String startRound(long gameId, String type) {
        return startRound(gameId, type, null, 1);
    }

    public String startRound(long gameId, String type, String category) {
        return startRound(gameId, type, category, 1);
    }

    public String startRound(long gameId, String type, String category, int act) {
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "TIMELINE" -> startTimeline(gameId, category);
            case "TIME_BUZZER" -> configPayload("TIME_BUZZER", 45, act);
            case "BOMBA" -> configPayload("BOMBA", 90, act);
            case "SPEED_RUSH" -> configPayload("SPEED_RUSH", 90, act);
            case "TENNIS_BATTLE" -> configPayload("TENNIS_BATTLE", 60, act);
            // Black Jack non ha domande né stato server: basta registrare il
            // round, mazzo e banco vivono nel mode della TV.
            case "BLACKJACK" -> configPayload("BLACKJACK", 600, act);
            // Le due gare delle Biglie durano meno di due minuti, ma il round
            // non ha un timer proprio: la scadenza server resta larga e non
            // chiude la finale prima che la TV la mostri.
            case "BIGLIE" -> configPayload("BIGLIE", 300, act);
            default -> null;
        };
    }

    // ---------------------------------------------------------------- Timeline

    private String startTimeline(long gameId, String category) {
        int size = TIMELINE_CARDS;
        List<TimelineEvent> pool = timelinePool(category);

        // Anti-ripetizione: prima le carte mai uscite in questa partita.
        List<TimelineEvent> available = new ArrayList<>();
        for (TimelineEvent event : pool) {
            if (!questionUsage.isUsed(gameId, timelineKey(event))) {
                available.add(event);
            }
        }

        List<TimelineEvent> ordered = sampleTimeline(available, size, category);
        boolean repeatedContent = false;
        if (ordered.size() < size) {
            // Pool esaurito: non si finge che sia tutto nuovo, lo dichiara la TV.
            ordered = sampleTimeline(pool, size, category);
            repeatedContent = true;
        }
        for (TimelineEvent event : ordered) {
            questionUsage.claim(gameId, timelineKey(event), null, "TIMELINE", null);
        }

        List<Integer> ids = new ArrayList<>();
        for (int index = 0; index < ordered.size(); index++) {
            ids.add(index);
        }
        Collections.shuffle(ids, random);

        Map<Integer, Integer> ranks = new HashMap<>();
        for (int position = 0; position < ids.size(); position++) {
            ranks.put(ids.get(position), position);
        }

        List<Integer> display = new ArrayList<>(ids);
        Collections.shuffle(display, random);

        JSONArray cards = new JSONArray();
        for (int id : display) {
            cards.put(new JSONObject().put("id", id).put("label", ordered.get(ranks.get(id)).label()));
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "TIMELINE");
        payload.put("roundId", "tl-" + UUID.randomUUID());
        payload.put("category", category == null ? "" : category);
        payload.put("question", "Metti le carte in ordine, dalla più antica alla più recente");
        payload.put("items", cards);
        payload.put("count", ordered.size());
        payload.put("explain", "Conta la posizione: ogni carta nel posto giusto vale un punto. "
                + "Otto posti giusti valgono 400 punti, sette 300, sei 200, cinque 100, quattro zero, "
                + "tre −50, due −100, uno o nessuno −200.");
        if (repeatedContent) {
            payload.put("poolWarning", "Pool Timeline esaurito: alcune carte sono già uscite in questa partita.");
        }

        timelineRounds.put(gameId, new TimelineRound(payload.getString("roundId"), ordered, ranks));
        timelineAnswers.put(gameId, new ConcurrentHashMap<>());
        persistTimeline(gameId);
        return payload.toString();
    }

    /** Carte della categoria richiesta, o banca intera se non bastano. */
    private List<TimelineEvent> timelinePool(String category) {
        List<TimelineEvent> byCategory = events.stream()
                .filter(event -> category != null && !category.isBlank()
                        && event.category().equalsIgnoreCase(category))
                .toList();
        return byCategory.size() >= TIMELINE_CARDS ? new ArrayList<>(byCategory) : new ArrayList<>(events);
    }

    private String timelineKey(TimelineEvent event) {
        return "timeline|" + QuestionHistoryService.normalize(event.label());
    }

    /**
     * Sceglie il round: due facili, quattro medi, due difficili, con eventi a
     * almeno tre anni di distanza e categorie diverse. Se la categoria scelta
     * non basta, il resto arriva dalle altre: meglio un round misto che uno
     * senza il mix dichiarato. Solo alla fine si rilassano i vincoli, così il
     * round resta comunque di otto carte.
     */
    private List<TimelineEvent> sampleTimeline(List<TimelineEvent> pool, int count, String category) {
        List<TimelineEvent> source = new ArrayList<>(pool);
        Collections.shuffle(source, random);

        List<TimelineEvent> picked = new ArrayList<>();
        int[][] bands = {
                TIMELINE_EASY, TIMELINE_EASY,
                TIMELINE_MEDIUM, TIMELINE_MEDIUM, TIMELINE_MEDIUM, TIMELINE_MEDIUM,
                TIMELINE_HARD, TIMELINE_HARD,
        };

        for (int[] band : bands) {
            if (picked.size() >= count) break;
            TimelineEvent candidate = bestCandidate(source, picked, band, true, true, category);
            if (candidate == null) candidate = bestCandidate(source, picked, band, false, true, category);
            if (candidate == null) candidate = bestCandidate(source, picked, band, false, false, category);
            if (candidate != null) picked.add(candidate);
        }

        // Eventi in meno rispetto alle bande (banca corta o date ravvicinate):
        // si completa con il primo evento non ancora scelto.
        if (picked.size() < count) {
            for (TimelineEvent candidate : source) {
                if (picked.contains(candidate)) continue;
                picked.add(candidate);
                if (picked.size() >= count) break;
            }
        }

        picked.sort(Comparator.comparingInt(TimelineEvent::year));
        return picked;
    }

    /**
     * Primo evento della banda che rispetta i vincoli richiesti. `keepCategory`
     * preferisce la categoria del round, `gap` impone i tre anni di distanza e
     * `distinctCategory` evita due eventi della stessa categoria nello stesso mazzo.
     */
    private TimelineEvent bestCandidate(List<TimelineEvent> source, List<TimelineEvent> picked, int[] band,
            boolean gap, boolean distinctCategory, String category) {
        for (TimelineEvent candidate : source) {
            if (picked.contains(candidate)) continue;
            boolean inBand = false;
            for (int value : band) {
                inBand = inBand || candidate.difficulty() == value;
            }
            if (!inBand) continue;
            if (gap && picked.stream().anyMatch(event -> Math.abs(event.year() - candidate.year()) < 3)) {
                continue;
            }
            if (distinctCategory && picked.stream()
                    .anyMatch(event -> event.category().equalsIgnoreCase(candidate.category()))) {
                continue;
            }
            // La categoria richiesta non è obbligatoria (il round deve essere
            // misto), ma a parità di banda la si preferisce.
            if (category != null && !category.isBlank()
                    && candidate.category().equalsIgnoreCase(category)) {
                return candidate;
            }
        }
        // Secondo passaggio: nessun evento della categoria richiesta, si prende
        // il primo che rispetta gli altri vincoli.
        for (TimelineEvent candidate : source) {
            if (picked.contains(candidate)) continue;
            boolean inBand = false;
            for (int value : band) {
                inBand = inBand || candidate.difficulty() == value;
            }
            if (!inBand) continue;
            if (gap && picked.stream().anyMatch(event -> Math.abs(event.year() - candidate.year()) < 3)) {
                continue;
            }
            if (distinctCategory && picked.stream()
                    .anyMatch(event -> event.category().equalsIgnoreCase(candidate.category()))) {
                continue;
            }
            return candidate;
        }
        return null;
    }

    public boolean isTimelineRound(long gameId, String roundId) {
        hydrateTimeline(gameId);
        TimelineRound round = timelineRounds.get(gameId);
        return round != null && round.token().equals(roundId);
    }

    /** Il giocatore ha già risposto al round Timeline corrente? */
    public boolean hasTimelineAnswer(long gameId, String playerName) {
        if (playerName == null || playerName.isBlank()) {
            return false;
        }
        hydrateTimeline(gameId);
        return timelineAnswers.getOrDefault(gameId, Map.of()).containsKey(playerName.trim());
    }

    public Optional<TimelineSubmission> submitTimeline(long gameId, String roundId, String playerName, List<Integer> order) {
        return submitTimelineDecision(gameId, roundId, playerName, order).map(TimelineDecision::submission);
    }

    /**
     * Registra la risposta e dice se è il primo invio per questo giocatore.
     *
     * <p>La prenotazione usa {@code put} atomico sulla mappa concorrente: due
     * retry simultanei dello stesso telefono ottengono un solo
     * {@code firstAnswer=true}, quindi il controller crea un solo evento.</p>
     */
    public Optional<TimelineDecision> submitTimelineDecision(long gameId, String roundId, String playerName,
            List<Integer> order) {
        hydrateTimeline(gameId);
        TimelineRound round = timelineRounds.get(gameId);
        if (round == null || roundId == null || !round.token().equals(roundId)
                || playerName == null || playerName.isBlank() || order == null) {
            return Optional.empty();
        }
        int size = round.ordered().size();
        if (order.size() != size) {
            return Optional.empty();
        }
        Set<Integer> distinct = new HashSet<>();
        for (int id : order) {
            if (!round.ranks().containsKey(id) || !distinct.add(id)) {
                return Optional.empty();
            }
        }

        // Non si contano le coppie in ordine: conta la posizione della carta.
        // Ogni carta nel posto giusto vale un punto, come una fila di caselle.
        int correctPairs = 0;
        for (int i = 0; i < order.size(); i++) {
            if (round.ranks().getOrDefault(order.get(i), -1) == i) {
                correctPairs++;
            }
        }
        int totalPairs = size;

        int score = timelineScore(correctPairs, size);

        TimelineSubmission submission = new TimelineSubmission(playerName.trim(), correctPairs, totalPairs, score,
                List.copyOf(order));
        TimelineSubmission previous = timelineAnswers.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(submission.playerName(), submission);
        persistTimeline(gameId);
        return Optional.of(new TimelineDecision(submission, previous == null));
    }

    /**
     * Ordine già inviato da un giocatore per il round aperto: il telefono lo
     * rilegge dopo un refresh, così non rimanda l'ordine iniziale sopra quello
     * scelto e chi non ha mai risposto lo sa (Optional vuoto).
     */
    public Optional<List<Integer>> timelineAnswerOrder(long gameId, String roundId, String playerName) {
        hydrateTimeline(gameId);
        TimelineRound round = timelineRounds.get(gameId);
        if (round == null || roundId == null || !round.token().equals(roundId)
                || playerName == null || playerName.isBlank()) {
            return Optional.empty();
        }
        TimelineSubmission submission = timelineAnswers
                .getOrDefault(gameId, Map.of())
                .get(playerName.trim());
        if (submission == null || submission.order().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(submission.order());
    }

    public JSONObject timelineReveal(long gameId) {
        hydrateTimeline(gameId);
        TimelineRound round = timelineRounds.get(gameId);
        JSONObject result = new JSONObject();
        if (round == null) {
            result.put("items", new JSONArray());
            result.put("results", new JSONArray());
            return result;
        }

        JSONArray ordered = new JSONArray();
        for (TimelineEvent event : round.ordered()) {
            ordered.put(new JSONObject().put("label", event.label()).put("year", event.year()));
        }

        List<TimelineSubmission> submissions = new ArrayList<>(
                timelineAnswers.getOrDefault(gameId, Map.of()).values());
        submissions.sort(Comparator.comparingInt(TimelineSubmission::score).reversed());

        JSONArray results = new JSONArray();
        for (TimelineSubmission submission : submissions) {
            results.put(new JSONObject()
                    .put("playerName", submission.playerName())
                    .put("correctPairs", submission.correctPairs())
                    .put("totalPairs", submission.totalPairs())
                    .put("score", submission.score()));
        }

        result.put("items", ordered);
        result.put("results", results);
        return result;
    }

    /**
     * Punti della Timeline, per posti giusti su otto carte: 8→400, 7→300,
     * 6→200, 5→100, 4→0, 3→−50, 2→−100, 1 o 0→−200. Con un mazzo ridotto la
     * tabella resta quella, rapportata agli otto posti dichiarati.
     */
    static int timelineScore(int correctPairs, int size) {
        int[] table = { -200, -200, -100, -50, 0, 100, 200, 300, 400 };
        int index = Math.max(0, Math.min(8, correctPairs));
        if (size == 8) {
            return table[index];
        }
        // Mazzo più corto (banca in emergenza): si usano i valori proporzionali
        // agli otto posti, senza mai uscire da +400 / −200.
        int scaled = (int) Math.round(index * 8.0 / Math.max(1, size));
        return table[Math.max(0, Math.min(8, scaled))];
    }

    public void forget(long gameId) {
        timelineRounds.remove(gameId);
        timelineAnswers.remove(gameId);
        stateBlobs.forget(gameId, TIMELINE_BLOB);
        stateBlobs.forget(gameId, TIMELINE_ANSWERS_BLOB);
    }

    // ------------------------------------------------------------- Persistenza

    /**
     * Ricarica il round Timeline dal database, una sola volta per partita e per
     * processo: dopo un riavvio le risposte già date restano valide.
     */
    private void hydrateTimeline(long gameId) {
        if (timelineRounds.containsKey(gameId)) {
            return;
        }
        Optional<String> blob = stateBlobs.load(gameId, TIMELINE_BLOB);
        if (blob.isEmpty()) {
            return;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            List<TimelineEvent> ordered = new ArrayList<>();
            JSONArray orderedJson = json.optJSONArray("ordered");
            for (int index = 0; orderedJson != null && index < orderedJson.length(); index++) {
                JSONObject row = orderedJson.optJSONObject(index);
                if (row == null) {
                    continue;
                }
                ordered.add(new TimelineEvent(row.optString("label", ""), row.optInt("year", 0),
                        row.optString("category", "Storia"), row.optInt("difficulty", 3)));
            }
            Map<Integer, Integer> ranks = new HashMap<>();
            JSONObject ranksJson = json.optJSONObject("ranks");
            Set<String> rankKeys = ranksJson == null ? Set.of() : ranksJson.keySet();
            for (String key : rankKeys) {
                ranks.put(Integer.parseInt(key), ranksJson.optInt(key, 0));
            }
            timelineRounds.put(gameId, new TimelineRound(json.optString("token", "tl-restored"), ordered, ranks));

            Map<String, TimelineSubmission> answers = new ConcurrentHashMap<>();
            JSONObject answersJson = stateBlobs.load(gameId, TIMELINE_ANSWERS_BLOB)
                    .map(JSONObject::new)
                    .orElseGet(JSONObject::new);
            for (String player : answersJson.keySet()) {
                JSONObject row = answersJson.optJSONObject(player);
                if (row == null) {
                    continue;
                }
                // Risposte salvate prima dell'ordine: restano valide, senza
                // ordine da rileggere.
                JSONArray orderJson = row.optJSONArray("order");
                List<Integer> savedOrder = new ArrayList<>();
                if (orderJson != null) {
                    for (int index = 0; index < orderJson.length(); index++) {
                        savedOrder.add(orderJson.optInt(index, -1));
                    }
                }
                answers.put(player, new TimelineSubmission(player, row.optInt("correctPairs", 0),
                        row.optInt("totalPairs", 0), row.optInt("score", 0), savedOrder));
            }
            timelineAnswers.put(gameId, answers);
            System.out.println("♻️ Timeline ripristinata per la partita " + gameId
                    + " (" + answers.size() + " risposte già salvate).");
        } catch (Exception malformed) {
            System.out.println("⚠️ Round Timeline illeggibile per la partita " + gameId + ": "
                    + malformed.getMessage());
        }
    }

    private void persistTimeline(long gameId) {
        TimelineRound round = timelineRounds.get(gameId);
        if (round != null) {
            JSONArray ordered = new JSONArray();
            for (TimelineEvent event : round.ordered()) {
                ordered.put(new JSONObject().put("label", event.label()).put("year", event.year())
                        .put("category", event.category()).put("difficulty", event.difficulty()));
            }
            JSONObject ranks = new JSONObject();
            round.ranks().forEach((id, rank) -> ranks.put(String.valueOf(id), rank));
            stateBlobs.save(gameId, TIMELINE_BLOB, new JSONObject()
                    .put("token", round.token())
                    .put("ordered", ordered)
                    .put("ranks", ranks)
                    .toString());
        }

        JSONObject answers = new JSONObject();
        timelineAnswers.getOrDefault(gameId, Map.of()).forEach((player, submission) ->
                answers.put(player, new JSONObject()
                        .put("correctPairs", submission.correctPairs())
                        .put("totalPairs", submission.totalPairs())
                        .put("score", submission.score())
                        .put("order", new JSONArray(submission.order()))));
        stateBlobs.save(gameId, TIMELINE_ANSWERS_BLOB, answers.toString());
    }

    // ------------------------------------------------------------------ Banche

    private String configPayload(String type, int durationSeconds) {
        return configPayload(type, durationSeconds, 1);
    }

    private String configPayload(String type, int durationSeconds, int act) {
        JSONObject payload = new JSONObject();
        payload.put("type", type);
        payload.put("question", switch (type) {
            case "SPEED_RUSH" -> "Speed Rush!";
            case "BOMBA" -> "Passa la bomba!";
            case "BLACKJACK" -> "Black Jack contro il banco";
            case "BIGLIE" -> "Due gare, una biglia";
            default -> "Tennis Battle!";
        });
        payload.put("duration", durationSeconds);
        payload.put("act", Math.max(1, Math.min(5, act)));
        return payload.toString();
    }

    private List<TimelineEvent> loadTimeline() {
        JSONArray rows = loadArray("questions/timeline-it.json", "events");
        List<TimelineEvent> loaded = new ArrayList<>();
        for (int index = 0; index < rows.length(); index++) {
            JSONObject row = rows.optJSONObject(index);
            if (row == null) {
                continue;
            }
            String label = row.optString("label", "");
            int year = row.optInt("year", 0);
            if (label.isBlank() || year <= 0) {
                continue;
            }
            int difficulty = Math.max(1, Math.min(5, row.optInt("difficulty", 3)));
            loaded.add(new TimelineEvent(label, year, row.optString("category", "Storia"), difficulty));
        }
        return List.copyOf(loaded);
    }

    private JSONArray loadArray(String resourcePath, String field) {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            System.out.println("⚠️ " + resourcePath + " assente: il gioco resta senza dati.");
            return new JSONArray();
        }
        try (InputStream stream = resource.getInputStream()) {
            String json = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            JSONObject root = new JSONObject(json);
            return root.optJSONArray(field) == null ? new JSONArray() : root.optJSONArray(field);
        } catch (Exception error) {
            System.out.println("⚠️ " + resourcePath + " illeggibile: " + error.getMessage());
            return new JSONArray();
        }
    }
}
