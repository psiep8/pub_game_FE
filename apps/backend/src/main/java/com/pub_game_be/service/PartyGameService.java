package com.pub_game_be.service;

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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giochi simultanei che non vivono nella banca domande: Timeline e Quanto costa.
 *
 * Le risposte corrette (ordine degli anni, prezzo) restano sul server: il
 * telefono riceve solo le carte mescolate o il nome del prodotto, e il
 * punteggio lo calcola qui. Così nessun dispositivo può leggersi la soluzione
 * dal payload.
 */
@Service
public class PartyGameService {

    public record TimelineEvent(String label, int year, String category) {
    }

    public record PriceItem(String name, String emoji, double price, String category, String source) {
    }

    public record TimelineSubmission(String playerName, int correctPairs, int totalPairs, int score) {
    }

    public record PriceSubmission(String playerName, double estimate, int score, boolean closest) {
    }

    private record TimelineRound(String token, List<TimelineEvent> ordered, Map<Integer, Integer> ranks) {
    }

    private record PriceRound(String token, PriceItem item) {
    }

    /** Quante carte si ordinano: 6 nei primi atti, 8 nel finale. */
    private static final int TIMELINE_CARDS = 6;
    private static final int TIMELINE_CARDS_FINAL = 8;

    /** Oltre questo scarto la stima vale zero (prezzo triplo o un terzo). */
    private static final double PRICE_TOLERANCE = Math.log(3);

    private final List<TimelineEvent> events;
    private final List<PriceItem> items;

    private final Map<Long, TimelineRound> timelineRounds = new ConcurrentHashMap<>();
    private final Map<Long, PriceRound> priceRounds = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, TimelineSubmission>> timelineAnswers = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, PriceSubmission>> priceAnswers = new ConcurrentHashMap<>();
    private final Map<Long, Boolean> lastTimelineRounds = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public PartyGameService() {
        this.events = loadTimeline();
        this.items = loadPrices();
        System.out.println("Banca party: " + events.size() + " eventi timeline, " + items.size() + " prezzi.");
    }

    /** I tipi gestiti da questo servizio invece che dalla banca domande. */
    public boolean handles(String type) {
        if (type == null) {
            return false;
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "TIMELINE", "PRICE", "SPEED_RUSH", "PING_PONG" -> true;
            default -> false;
        };
    }

    /** Payload di apertura del round; null se il tipo non è di questo servizio. */
    public String startRound(long gameId, String type) {
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "TIMELINE" -> startTimeline(gameId);
            case "PRICE" -> startPrice(gameId);
            case "SPEED_RUSH" -> configPayload("SPEED_RUSH", 60);
            case "PING_PONG" -> configPayload("PING_PONG", 60);
            default -> null;
        };
    }

    // ---------------------------------------------------------------- Timeline

    private String startTimeline(long gameId) {
        int size = Boolean.TRUE.equals(lastTimelineRounds.get(gameId)) ? TIMELINE_CARDS_FINAL : TIMELINE_CARDS;
        List<TimelineEvent> ordered = sampleTimeline(size);

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
        payload.put("question", "Metti le carte in ordine, dalla più antica alla più recente");
        payload.put("items", cards);
        payload.put("count", ordered.size());

        timelineRounds.put(gameId, new TimelineRound(payload.getString("roundId"), ordered, ranks));
        timelineAnswers.put(gameId, new ConcurrentHashMap<>());
        lastTimelineRounds.put(gameId, !Boolean.TRUE.equals(lastTimelineRounds.get(gameId)) && size == TIMELINE_CARDS);
        return payload.toString();
    }

    /** Sei-otto eventi con almeno tre anni di distanza: niente ordini ambigui. */
    private List<TimelineEvent> sampleTimeline(int count) {
        List<TimelineEvent> pool = new ArrayList<>(events);
        Collections.shuffle(pool, random);

        List<TimelineEvent> picked = new ArrayList<>();
        for (TimelineEvent candidate : pool) {
            boolean tooClose = picked.stream()
                    .anyMatch(event -> Math.abs(event.year() - candidate.year()) < 3);
            if (!tooClose) {
                picked.add(candidate);
            }
            if (picked.size() >= count) {
                break;
            }
        }

        picked.sort(Comparator.comparingInt(TimelineEvent::year));
        return picked;
    }

    public Optional<TimelineSubmission> submitTimeline(long gameId, String playerName, List<Integer> order) {
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
        return Optional.of(submission);
    }

    /** Soluzione e classifica del round: la TV la chiede solo al reveal. */
    public JSONObject timelineReveal(long gameId) {
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

    private String startPrice(long gameId) {
        if (items.isEmpty()) {
            return configPayload("PRICE", 30);
        }
        PriceItem item = items.get(random.nextInt(items.size()));

        JSONObject payload = new JSONObject();
        payload.put("type", "PRICE");
        payload.put("roundId", "pr-" + System.currentTimeMillis());
        payload.put("question", "Quanto costa?");
        payload.put("name", item.name());
        payload.put("emoji", item.emoji());
        payload.put("category", item.category());
        payload.put("unit", "€");

        priceRounds.put(gameId, new PriceRound(payload.getString("roundId"), item));
        priceAnswers.put(gameId, new ConcurrentHashMap<>());
        return payload.toString();
    }

    public Optional<PriceSubmission> submitPrice(long gameId, String playerName, double estimate) {
        PriceRound round = priceRounds.get(gameId);
        if (round == null || playerName == null || playerName.isBlank() || estimate <= 0) {
            return Optional.empty();
        }

        PriceSubmission submission = new PriceSubmission(playerName.trim(), estimate,
                scoreForPrice(round.item().price(), estimate), false);
        priceAnswers.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(submission.playerName(), submission);
        return Optional.of(submission);
    }

    /**
     * Punteggio logaritmico: stima esatta 1000, doppia o dimezzata circa 370,
     * fuori di un fattore tre zero. La TV usa la stessa formula per l'anteprima.
     */
    public static int scoreForPrice(double price, double estimate) {
        if (price <= 0 || estimate <= 0) {
            return 0;
        }
        double distance = Math.abs(Math.log(estimate / price)) / PRICE_TOLERANCE;
        return (int) Math.max(0, Math.round(1000.0 * (1.0 - distance)));
    }

    public JSONObject priceReveal(long gameId) {
        PriceRound round = priceRounds.get(gameId);
        JSONObject result = new JSONObject();
        if (round == null) {
            result.put("results", new JSONArray());
            return result;
        }

        Map<String, PriceSubmission> answers = priceAnswers.getOrDefault(gameId, Map.of());
        String closest = null;
        double closestDistance = Double.MAX_VALUE;
        for (PriceSubmission submission : answers.values()) {
            double distance = Math.abs(Math.log(submission.estimate() / round.item().price()));
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = submission.playerName();
            }
        }

        List<PriceSubmission> submissions = new ArrayList<>();
        for (PriceSubmission submission : answers.values()) {
            boolean isClosest = submission.playerName().equals(closest);
            submissions.add(new PriceSubmission(submission.playerName(), submission.estimate(),
                    submission.score() + (isClosest ? 300 : 0), isClosest));
        }
        submissions.sort(Comparator.comparingInt(PriceSubmission::score).reversed());

        JSONArray results = new JSONArray();
        for (PriceSubmission submission : submissions) {
            results.put(new JSONObject()
                    .put("playerName", submission.playerName())
                    .put("estimate", submission.estimate())
                    .put("score", submission.score())
                    .put("closest", submission.closest()));
        }

        result.put("name", round.item().name());
        result.put("emoji", round.item().emoji());
        result.put("price", round.item().price());
        result.put("source", round.item().source());
        result.put("closest", closest == null ? JSONObject.NULL : closest);
        result.put("results", results);
        return result;
    }

    /** Dimentica il round: nuova partita o reset dalla TV. */
    public void forget(long gameId) {
        timelineRounds.remove(gameId);
        priceRounds.remove(gameId);
        timelineAnswers.remove(gameId);
        priceAnswers.remove(gameId);
        lastTimelineRounds.remove(gameId);
    }

    // ------------------------------------------------------------------ Banche

    private String configPayload(String type, int durationSeconds) {
        JSONObject payload = new JSONObject();
        payload.put("type", type);
        payload.put("question", type.equals("SPEED_RUSH") ? "Speed Rush!" : "Ping Pong!");
        payload.put("duration", durationSeconds);
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
            return new JSONObject(json).optJSONArray(field) == null
                    ? new JSONArray()
                    : new JSONObject(json).optJSONArray(field);
        } catch (Exception error) {
            System.out.println("⚠️ " + resourcePath + " illeggibile: " + error.getMessage());
            return new JSONArray();
        }
    }
}
