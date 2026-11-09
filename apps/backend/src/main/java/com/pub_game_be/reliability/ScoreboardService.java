package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Classifica generale della partita, salvata dal server.
 *
 * <p>Prima viveva solo nel {@code localStorage} della TV: un refresh o un
 * cambio dispositivo la azzeravano mentre i telefoni restavano sulla stessa
 * partita. La TV continua a calcolare i punti (è lei il motore di gioco), ma
 * dopo ogni variazione invia la classifica completa; qui viene validata e
 * salvata su database, così lo snapshot di sincronizzazione la restituisce a
 * qualunque dispositivo TV/ADMIN che si collega alla stessa partita.</p>
 *
 * <p>Il salvataggio è un'istantanea completa, non un delta: un retry della
 * stessa classifica non somma due volte i punti.</p>
 */
@Service
public class ScoreboardService {

    private static final String BLOB = "leaderboard";
    private static final int MAX_PLAYERS = 64;
    private static final int MAX_NAME = 40;
    private static final int MAX_POINTS = 1_000_000;
    private static final int MAX_ANSWERS = 10_000;

    private final StateBlobService stateBlobs;

    public ScoreboardService(StateBlobService stateBlobs) {
        this.stateBlobs = stateBlobs;
    }

    /**
     * Sostituisce la classifica salvata con quella inviata dalla TV.
     *
     * @return numero di squadre salvate
     */
    public int save(long gameId, Object rawEntries) {
        List<JSONObject> rows = normalize(rawEntries);
        JSONArray entries = new JSONArray();
        for (JSONObject row : rows) {
            entries.put(row);
        }
        stateBlobs.save(gameId, BLOB, new JSONObject().put("entries", entries).toString());
        return rows.size();
    }

    /** Classifica salvata, già ordinata per punti decrescenti. */
    public JSONArray entries(long gameId) {
        JSONObject saved = stateBlobs.load(gameId, BLOB).map(JSONObject::new).orElse(null);
        JSONArray out = new JSONArray();
        if (saved == null) {
            return out;
        }
        for (JSONObject row : normalize(saved.optJSONArray("entries"))) {
            out.put(row);
        }
        return out;
    }

    public void forget(long gameId) {
        stateBlobs.forget(gameId, BLOB);
    }

    private List<JSONObject> normalize(Object rawEntries) {
        List<Object> source = new ArrayList<>();
        if (rawEntries instanceof JSONArray array) {
            for (int index = 0; index < array.length(); index++) {
                source.add(array.opt(index));
            }
        } else if (rawEntries instanceof List<?> list) {
            source.addAll(list);
        }

        Map<String, JSONObject> byName = new LinkedHashMap<>();
        for (Object value : source) {
            if (!(value instanceof JSONObject) && !(value instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> row = value instanceof JSONObject json ? JsonSupport.toMap(json) : (Map<?, ?>) value;
            Object rawName = row.get("playerName");
            String playerName = rawName == null ? "" : String.valueOf(rawName).trim();
            if (playerName.isEmpty() || playerName.length() > MAX_NAME || byName.containsKey(playerName)) {
                continue;
            }
            byName.put(playerName, new JSONObject()
                    .put("playerName", playerName)
                    .put("totalPoints", clamp(row.get("totalPoints"), -MAX_POINTS, MAX_POINTS))
                    .put("correctAnswers", clamp(row.get("correctAnswers"), 0, MAX_ANSWERS))
                    .put("wrongAnswers", clamp(row.get("wrongAnswers"), 0, MAX_ANSWERS)));
            if (byName.size() >= MAX_PLAYERS) {
                break;
            }
        }

        List<JSONObject> ordered = new ArrayList<>(byName.values());
        ordered.sort(Comparator.comparingInt((JSONObject row) -> -row.optInt("totalPoints", 0)));
        return ordered;
    }

    private int clamp(Object raw, int min, int max) {
        double parsed;
        try {
            parsed = Double.parseDouble(String.valueOf(raw));
        } catch (NumberFormatException | NullPointerException ignored) {
            return 0;
        }
        if (!Double.isFinite(parsed)) {
            return 0;
        }
        long rounded = Math.round(parsed);
        return (int) Math.max(min, Math.min(max, rounded));
    }
}
