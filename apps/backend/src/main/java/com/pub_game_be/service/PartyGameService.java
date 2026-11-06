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
 * Giochi simultanei che non vivono nella banca domande: Timeline, Quanto costa,
 * Speed Rush e Air Hockey Battle.
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

    public record PriceItem(String name, String emoji, double price, String category, String source) {
    }

    public record TimelineSubmission(String playerName, int correctPairs, int totalPairs, int score) {
    }

    public record PriceEntry(String playerName, List<Double> estimates) {
    }

    private record TimelineRound(String token, List<TimelineEvent> ordered, Map<Integer, Integer> ranks) {
    }

    private record PriceRound(String token, List<PriceItem> items) {
    }

    private static final int TIMELINE_CARDS = 6;
    private static final int TIMELINE_CARDS_FINAL = 8;
    private static final int PRICE_ITEMS = 3;

    private static final String TIMELINE_BLOB = "timeline-round";
    private static final String TIMELINE_ANSWERS_BLOB = "timeline-answers";
    private static final String PRICE_BLOB = "price-round";
    private static final String PRICE_ANSWERS_BLOB = "price-answers";

    /** Oltre questo scarto la stima vale zero (prezzo triplo o un terzo). */
    private static final double PRICE_TOLERANCE = Math.log(3);

    private final StateBlobService stateBlobs;
    private final QuestionUsageService questionUsage;

    private final List<TimelineEvent> events;
    private final List<PriceItem> items;

    private final Map<Long, TimelineRound> timelineRounds = new ConcurrentHashMap<>();
    private final Map<Long, PriceRound> priceRounds = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, TimelineSubmission>> timelineAnswers = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, PriceEntry>> priceAnswers = new ConcurrentHashMap<>();
    private final Map<Long, Boolean> lastTimelineRounds = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public PartyGameService(StateBlobService stateBlobs, QuestionUsageService questionUsage) {
        this.stateBlobs = stateBlobs;
        this.questionUsage = questionUsage;
        this.events = loadTimeline();
        this.items = loadPrices();
        System.out.println("Banca party: " + events.size() + " eventi timeline, " + items.size() + " prezzi.");
    }

    public boolean handles(String type) {
        if (type == null) {
            return false;
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "TIMELINE", "TIME_BUZZER", "CAVALLO", "BOMBA", "SPEED_RUSH", "AIR_HOCKEY_BATTLE" -> true;
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
            // Il Cavallo pesca le domande a runtime dalla categoria votata dai
            // telefoni: qui serve solo il contratto del round.
            case "CAVALLO" -> configPayload("CAVALLO", 240, act);
            case "BOMBA" -> configPayload("BOMBA", 90, act);
            case "SPEED_RUSH" -> configPayload("SPEED_RUSH", 60, act);
            case "AIR_HOCKEY_BATTLE" -> configPayload("AIR_HOCKEY_BATTLE", 60, act);
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
        payload.put("explain", "Ogni coppia di carte nell'ordine giusto vale punti. "
                + "Con 6 carte le coppie sono 15, con 8 sono 28. Ordine perfetto: +200 bonus.");
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
        for (int id : order) {
            if (!round.ranks().containsKey(id)) {
                return Optional.empty();
            }
        }

        int totalPairs = size * (size - 1) / 2;
        int correctPairs = 0;
        for (int i = 0; i < order.size(); i++) {
            for (int j = i + 1; j < order.size(); j++) {
                if (round.ranks().get(order.get(i)) < round.ranks().get(order.get(j))) {
                    correctPairs++;
                }
            }
        }

        int score = totalPairs == 0 ? 0 : (int) Math.round(1000.0 * correctPairs / totalPairs);
        if (correctPairs == totalPairs) {
            score += 200;
        }

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

    // ------------------------------------------------------------------- Price

    /**
     * Tre oggetti per round. I telefoni mandano tre stime; al reveal il peggior
     * giocatore di ogni oggetto viene eliminato e i superstiti si spartiscono i
     * punti in base alla distanza totale dal prezzo reale.
     */
    private String startPrice(long gameId) {
        if (items.isEmpty()) {
            return configPayload("PRICE", 45);
        }

        List<PriceItem> pool = new ArrayList<>(items);
        Collections.shuffle(pool, random);
        List<PriceItem> picked = new ArrayList<>(pool.subList(0, Math.min(PRICE_ITEMS, pool.size())));

        JSONArray cards = new JSONArray();
        for (PriceItem item : picked) {
            cards.put(new JSONObject()
                    .put("name", item.name())
                    .put("emoji", item.emoji())
                    .put("category", item.category()));
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "PRICE");
        payload.put("roundId", "pr-" + System.currentTimeMillis());
        payload.put("question", "Quanto costano questi tre oggetti?");
        payload.put("items", cards);
        payload.put("count", picked.size());
        payload.put("unit", "€");
        payload.put("explain", "Dopo ogni oggetto il peggior giocatore viene eliminato. "
                + "Gli ultimi rimasti prendono punti in base a quanto sono stati vicini.");
        if (!picked.isEmpty()) {
            payload.put("name", picked.get(0).name());
            payload.put("emoji", picked.get(0).emoji());
            payload.put("category", picked.get(0).category());
        }

        priceRounds.put(gameId, new PriceRound(payload.getString("roundId"), List.copyOf(picked)));
        priceAnswers.put(gameId, new ConcurrentHashMap<>());
        persistPrice(gameId);
        return payload.toString();
    }

    public Optional<PriceEntry> submitPrice(long gameId, String playerName, List<Double> estimates) {
        hydratePrice(gameId);
        PriceRound round = priceRounds.get(gameId);
        if (round == null || playerName == null || playerName.isBlank() || estimates == null
                || estimates.size() != round.items().size()) {
            return Optional.empty();
        }
        for (Double estimate : estimates) {
            if (estimate == null || estimate <= 0 || !Double.isFinite(estimate)) {
                return Optional.empty();
            }
        }

        PriceEntry entry = new PriceEntry(playerName.trim(), List.copyOf(estimates));
        priceAnswers.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(entry.playerName(), entry);
        persistPrice(gameId);
        return Optional.of(entry);
    }

    public static int scoreForPrice(double price, double estimate) {
        if (price <= 0 || estimate <= 0) {
            return 0;
        }
        double distance = Math.abs(Math.log(estimate / price)) / PRICE_TOLERANCE;
        return (int) Math.max(0, Math.round(1000.0 * (1.0 - distance)));
    }

    public JSONObject priceReveal(long gameId) {
        hydratePrice(gameId);
        PriceRound round = priceRounds.get(gameId);
        JSONObject result = new JSONObject();
        JSONArray itemsJson = new JSONArray();
        JSONArray resultsJson = new JSONArray();
        JSONArray eliminationsJson = new JSONArray();

        if (round == null) {
            result.put("items", itemsJson);
            result.put("results", resultsJson);
            result.put("eliminations", eliminationsJson);
            return result;
        }

        Map<String, PriceEntry> answers = priceAnswers.getOrDefault(gameId, Map.of());
        List<String> players = new ArrayList<>(answers.keySet());
        Collections.sort(players);

        Map<String, double[]> errors = new HashMap<>();
        for (PriceEntry entry : answers.values()) {
            double[] row = new double[round.items().size()];
            for (int index = 0; index < row.length; index++) {
                double price = round.items().get(index).price();
                row[index] = Math.abs(Math.log(entry.estimates().get(index) / price)) / PRICE_TOLERANCE;
            }
            errors.put(entry.playerName(), row);
        }

        Set<String> eliminated = new HashSet<>();
        for (int index = 0; index < round.items().size(); index++) {
            PriceItem item = round.items().get(index);
            JSONArray itemResults = new JSONArray();
            String worst = null;
            double worstError = -1;

            for (String player : players) {
                PriceEntry entry = answers.get(player);
                if (entry == null) {
                    continue;
                }
                double estimate = entry.estimates().get(index);
                double error = errors.get(player)[index];
                itemResults.put(new JSONObject()
                        .put("playerName", player)
                        .put("estimate", estimate)
                        .put("error", Math.round(error * 100.0) / 100.0));

                if (!eliminated.contains(player) && error > worstError) {
                    worstError = error;
                    worst = player;
                }
            }

            String eliminatedThisItem = null;
            if (worst != null && players.size() - eliminated.size() > 1) {
                eliminated.add(worst);
                eliminatedThisItem = worst;
                eliminationsJson.put(new JSONObject()
                        .put("itemIndex", index)
                        .put("playerName", worst));
            }

            JSONObject itemJson = new JSONObject()
                    .put("name", item.name())
                    .put("emoji", item.emoji())
                    .put("category", item.category())
                    .put("price", item.price())
                    .put("source", item.source())
                    .put("results", itemResults);
            itemJson.put("eliminated", eliminatedThisItem == null ? JSONObject.NULL : eliminatedThisItem);
            itemsJson.put(itemJson);
        }

        List<String> survivors = new ArrayList<>();
        for (String player : players) {
            if (!eliminated.contains(player)) {
                survivors.add(player);
            }
        }
        survivors.sort(Comparator.comparingDouble(player -> mean(errors.get(player))));

        int[] bonus = { 500, 350, 250, 150, 100 };
        Map<String, Integer> scores = new HashMap<>();
        for (int index = 0; index < survivors.size(); index++) {
            scores.put(survivors.get(index), bonus[Math.min(index, bonus.length - 1)]);
        }
        for (String player : players) {
            scores.putIfAbsent(player, 0);
        }

        List<JSONObject> rows = new ArrayList<>();
        for (String player : players) {
            rows.add(new JSONObject()
                    .put("playerName", player)
                    .put("totalError", Math.round(mean(errors.get(player)) * 100.0) / 100.0)
                    .put("score", scores.get(player))
                    .put("survivor", survivors.contains(player)));
        }
        rows.sort((left, right) -> {
            int byScore = Integer.compare(right.optInt("score"), left.optInt("score"));
            return byScore != 0 ? byScore : Double.compare(left.optDouble("totalError"), right.optDouble("totalError"));
        });
        for (JSONObject row : rows) {
            resultsJson.put(row);
        }

        result.put("items", itemsJson);
        result.put("eliminations", eliminationsJson);
        result.put("results", resultsJson);
        result.put("survivors", new JSONArray(survivors));
        return result;
    }

    private double mean(double[] values) {
        if (values == null || values.length == 0) {
            return 0;
        }
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.length;
    }

    public void forget(long gameId) {
        timelineRounds.remove(gameId);
        priceRounds.remove(gameId);
        timelineAnswers.remove(gameId);
        priceAnswers.remove(gameId);
        lastTimelineRounds.remove(gameId);
        stateBlobs.forget(gameId, TIMELINE_BLOB);
        stateBlobs.forget(gameId, TIMELINE_ANSWERS_BLOB);
        stateBlobs.forget(gameId, PRICE_BLOB);
        stateBlobs.forget(gameId, PRICE_ANSWERS_BLOB);
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

    private void hydratePrice(long gameId) {
        if (priceRounds.containsKey(gameId)) {
            return;
        }
        Optional<String> blob = stateBlobs.load(gameId, PRICE_BLOB);
        if (blob.isEmpty()) {
            return;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            List<PriceItem> restored = new ArrayList<>();
            JSONArray itemsJson = json.optJSONArray("items");
            for (int index = 0; itemsJson != null && index < itemsJson.length(); index++) {
                JSONObject row = itemsJson.optJSONObject(index);
                if (row == null) {
                    continue;
                }
                restored.add(new PriceItem(row.optString("name", ""), row.optString("emoji", "🛒"),
                        row.optDouble("price", 0), row.optString("category", "Varie"),
                        row.optString("source", "")));
            }
            priceRounds.put(gameId, new PriceRound(json.optString("token", "pr-restored"), restored));

            Map<String, PriceEntry> answers = new ConcurrentHashMap<>();
            JSONObject answersJson = stateBlobs.load(gameId, PRICE_ANSWERS_BLOB)
                    .map(JSONObject::new)
                    .orElseGet(JSONObject::new);
            for (String player : answersJson.keySet()) {
                JSONArray values = answersJson.optJSONArray(player);
                List<Double> estimates = new ArrayList<>();
                for (int index = 0; values != null && index < values.length(); index++) {
                    estimates.add(values.optDouble(index, 0));
                }
                answers.put(player, new PriceEntry(player, List.copyOf(estimates)));
            }
            priceAnswers.put(gameId, answers);
        } catch (Exception malformed) {
            System.out.println("⚠️ Round prezzi illeggibile per la partita " + gameId + ": "
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

    private void persistPrice(long gameId) {
        PriceRound round = priceRounds.get(gameId);
        if (round != null) {
            JSONArray itemsJson = new JSONArray();
            for (PriceItem item : round.items()) {
                itemsJson.put(new JSONObject()
                        .put("name", item.name())
                        .put("emoji", item.emoji())
                        .put("price", item.price())
                        .put("category", item.category())
                        .put("source", item.source()));
            }
            stateBlobs.save(gameId, PRICE_BLOB, new JSONObject()
                    .put("token", round.token())
                    .put("items", itemsJson)
                    .toString());
        }

        JSONObject answers = new JSONObject();
        priceAnswers.getOrDefault(gameId, Map.of()).forEach((player, entry) ->
                answers.put(player, new JSONArray(entry.estimates())));
        stateBlobs.save(gameId, PRICE_ANSWERS_BLOB, answers.toString());
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
            case "CAVALLO" -> "Cavallo di Battaglia!";
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

    private List<PriceItem> loadPrices() {
        JSONArray rows = loadArray("questions/price-it.json", "items");
        List<PriceItem> loaded = new ArrayList<>();
        for (int index = 0; index < rows.length(); index++) {
            JSONObject row = rows.optJSONObject(index);
            if (row == null) {
                continue;
            }
            String name = row.optString("name", "");
            double price = row.optDouble("price", 0);
            if (name.isBlank() || price <= 0) {
                continue;
            }
            loaded.add(new PriceItem(name, row.optString("emoji", "🛒"), price,
                    row.optString("category", "Varie"), row.optString("source", "")));
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
