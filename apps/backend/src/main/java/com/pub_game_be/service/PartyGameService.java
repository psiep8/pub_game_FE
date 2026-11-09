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
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giochi simultanei che non vivono nella banca domande: Timeline, Speed Rush e
 * Air Hockey Battle.
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

    public record TimelineEvent(String label, int year, String category) {
    }

    public record TimelineSubmission(String playerName, int correctPairs, int totalPairs, int score) {
    }

    private record TimelineRound(String token, List<TimelineEvent> ordered, Map<Integer, Integer> ranks) {
    }

    private static final int TIMELINE_CARDS = 6;
    private static final int TIMELINE_CARDS_FINAL = 8;

    private static final String TIMELINE_BLOB = "timeline-round";
    private static final String TIMELINE_ANSWERS_BLOB = "timeline-answers";

    private final StateBlobService stateBlobs;
    private final QuestionUsageService questionUsage;

    private final List<TimelineEvent> events;

    private final Map<Long, TimelineRound> timelineRounds = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, TimelineSubmission>> timelineAnswers = new ConcurrentHashMap<>();
    private final Map<Long, Boolean> lastTimelineRounds = new ConcurrentHashMap<>();
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
            case "TIMELINE", "TIME_BUZZER", "BOMBA", "SPEED_RUSH", "AIR_HOCKEY_BATTLE",
                    "BLACKJACK" -> true;
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
            case "SPEED_RUSH" -> configPayload("SPEED_RUSH", 60, act);
            case "AIR_HOCKEY_BATTLE" -> configPayload("AIR_HOCKEY_BATTLE", 60, act);
            // Black Jack non ha domande né stato server: basta registrare il
            // round, mazzo e banco vivono nel mode della TV.
            case "BLACKJACK" -> configPayload("BLACKJACK", 600, act);
            default -> null;
        };
    }

    // ---------------------------------------------------------------- Timeline

    private String startTimeline(long gameId, String category) {
        int size = Boolean.TRUE.equals(lastTimelineRounds.get(gameId)) ? TIMELINE_CARDS_FINAL : TIMELINE_CARDS;
        List<TimelineEvent> pool = timelinePool(category);

        // Anti-ripetizione: prima le carte mai uscite in questa partita.
        List<TimelineEvent> available = new ArrayList<>();
        for (TimelineEvent event : pool) {
            if (!questionUsage.isUsed(gameId, timelineKey(event))) {
                available.add(event);
            }
        }

        List<TimelineEvent> ordered = sampleTimeline(available, size);
        boolean repeatedContent = false;
        if (ordered.size() < size) {
            // Pool esaurito: non si finge che sia tutto nuovo, lo dichiara la TV.
            ordered = sampleTimeline(pool, size);
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
        payload.put("roundId", "tl-" + System.currentTimeMillis());
        payload.put("category", category == null ? "" : category);
        payload.put("question", "Metti le carte in ordine, dalla più antica alla più recente");
        payload.put("items", cards);
        payload.put("count", ordered.size());
        payload.put("explain", "Conta la posizione: ogni carta nel posto giusto vale un punto. "
                + "Da meta classifica in su il punteggio e positivo (fino a 1200), sotto si perde "
                + "al massimo 400 punti.");
        if (repeatedContent) {
            payload.put("poolWarning", "Pool Timeline esaurito: alcune carte sono già uscite in questa partita.");
        }

        timelineRounds.put(gameId, new TimelineRound(payload.getString("roundId"), ordered, ranks));
        timelineAnswers.put(gameId, new ConcurrentHashMap<>());
        persistTimeline(gameId);
        lastTimelineRounds.put(gameId, !Boolean.TRUE.equals(lastTimelineRounds.get(gameId)) && size == TIMELINE_CARDS);
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
     * Mescola e sceglie le carte evitando anni troppo vicini. Se il mazzo non
     * basta restituisce quello che c'è: meglio un round più corto che uno vuoto.
     */
    private List<TimelineEvent> sampleTimeline(List<TimelineEvent> pool, int count) {
        List<TimelineEvent> source = new ArrayList<>(pool);
        Collections.shuffle(source, random);

        List<TimelineEvent> picked = new ArrayList<>();
        for (TimelineEvent candidate : source) {
            boolean tooClose = picked.stream()
                    .anyMatch(event -> Math.abs(event.year() - candidate.year()) < 3);
            if (!tooClose) {
                picked.add(candidate);
            }
            if (picked.size() >= count) {
                break;
            }
        }

        // Le date ravvicinate possono ridurre il mazzo: completa con gli
        // eventi rimasti invece di consegnare un round più corto del previsto.
        if (picked.size() < count) {
            for (TimelineEvent candidate : source) {
                if (!picked.contains(candidate)) {
                    picked.add(candidate);
                }
                if (picked.size() >= count) {
                    break;
                }
            }
        }

        picked.sort(Comparator.comparingInt(TimelineEvent::year));
        return picked;
    }

    public Optional<TimelineSubmission> submitTimeline(long gameId, String playerName, List<Integer> order) {
        hydrateTimeline(gameId);
        TimelineRound round = timelineRounds.get(gameId);
        if (round == null || playerName == null || playerName.isBlank() || order == null) {
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

        // Soglia: da n/2 - 1 posizioni giuste in su il round e positivo.
        // Sotto soglia si perde, ma mai piu di 400 punti; sopra, il massimo e
        // 1200 per un ordine perfetto.
        int threshold = Math.max(0, size / 2 - 1);
        int score;
        if (correctPairs >= threshold) {
            score = (int) Math.round(1200.0 * correctPairs / Math.max(1, size));
        } else {
            score = threshold == 0 ? 0
                    : -(int) Math.round(400.0 * (threshold - correctPairs) / threshold);
        }
        score = Math.max(-400, Math.min(1200, score));

        TimelineSubmission submission = new TimelineSubmission(playerName.trim(), correctPairs, totalPairs, score);
        timelineAnswers.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(submission.playerName(), submission);
        persistTimeline(gameId);
        return Optional.of(submission);
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

    public void forget(long gameId) {
        timelineRounds.remove(gameId);
        timelineAnswers.remove(gameId);
        lastTimelineRounds.remove(gameId);
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
                        row.optString("category", "Storia")));
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
                answers.put(player, new TimelineSubmission(player, row.optInt("correctPairs", 0),
                        row.optInt("totalPairs", 0), row.optInt("score", 0)));
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
                        .put("category", event.category()));
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
                        .put("score", submission.score())));
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
            default -> "Air Hockey Battle!";
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
            loaded.add(new TimelineEvent(label, year, row.optString("category", "Storia")));
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
