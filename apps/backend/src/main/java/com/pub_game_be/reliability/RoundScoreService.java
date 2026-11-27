package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Storico dei punti per round e per squadra.
 *
 * <p>La classifica generale basta per il tabellone, ma le statistiche della
 * classifica «da film» e della regia (miglior peggior round, rimonta, gioco
 * più forte) hanno bisogno del dettaglio round per round. La TV scrive una
 * riga quando chiude il conteggio del round; la stessa chiave sostituisce la
 * riga precedente, quindi un retry non duplica i punti.</p>
 *
 * <p>Il blob è separato da {@code leaderboard}: la classifica può essere
 * riscritta a ogni punto, lo storico cambia una volta per round.</p>
 */
@Service
public class RoundScoreService {

    /**
     * Un blob per quattro round: il payload resta sotto il limite TEXT di
     * MySQL anche con 64 squadre, senza cambiare lo schema di state_blob.
     */
    private static final String BLOB_PREFIX = "round-scores-";
    private static final String LEGACY_BLOB = "round-scores";
    private static final int ROUNDS_PER_CHUNK = 4;
    private static final int MAX_ROUNDS = 128;
    private static final int CHUNKS = (MAX_ROUNDS + ROUNDS_PER_CHUNK - 1) / ROUNDS_PER_CHUNK;
    private static final int MAX_PLAYERS = 64;
    private static final int MAX_NAME = 40;
    private static final int MAX_POINTS = 1_000_000;

    private final StateBlobService stateBlobs;
    /** Due round chiusi insieme non devono perdere la riga l'uno dell'altro. */
    private final ConcurrentMap<Long, Object> locks = new ConcurrentHashMap<>();

    public RoundScoreService(StateBlobService stateBlobs) {
        this.stateBlobs = stateBlobs;
    }

    /**
     * Salva (o sostituisce) il dettaglio di un round.
     *
     * @return numero di squadre salvate
     */
    public int save(long gameId, int roundIndex, Object rawType, Object rawEntries) {
        if (roundIndex < 0 || roundIndex >= MAX_ROUNDS) {
            throw new IllegalArgumentException("roundIndex fuori intervallo");
        }
        List<JSONObject> rows = normalize(rawEntries);
        String type = normalizeType(rawType);
        int chunk = roundIndex / ROUNDS_PER_CHUNK;
        synchronized (lock(gameId)) {
            JSONObject rounds = roundMap(load(gameId, chunk));
            JSONArray entries = new JSONArray();
            for (JSONObject row : rows) {
                entries.put(row);
            }
            rounds.put(String.valueOf(roundIndex), new JSONObject()
                    .put("roundIndex", roundIndex)
                    .put("type", type)
                    .put("savedAt", System.currentTimeMillis())
                    .put("entries", entries));

            JSONArray ordered = new JSONArray();
            for (Integer index : orderedIndexes(rounds)) {
                JSONObject round = rounds.optJSONObject(String.valueOf(index));
                if (round != null) {
                    ordered.put(round);
                }
            }
            stateBlobs.save(gameId, blobKey(chunk), new JSONObject().put("rounds", ordered).toString());
        }
        return rows.size();
    }

    /** Storico ordinato dal primo all'ultimo round. */
    public JSONObject history(long gameId) {
        // Il vecchio formato a blob unico resta leggibile; i blocchi nuovi
        // hanno la precedenza se lo stesso round è stato riscritto.
        JSONObject rounds = roundMap(loadKey(gameId, LEGACY_BLOB));
        for (int chunk = 0; chunk < CHUNKS; chunk++) {
            JSONObject chunkRounds = roundMap(load(gameId, chunk));
            for (String key : chunkRounds.keySet()) {
                rounds.put(key, chunkRounds.get(key));
            }
        }
        JSONArray ordered = new JSONArray();
        for (Integer index : orderedIndexes(rounds)) {
            JSONObject round = rounds.optJSONObject(String.valueOf(index));
            if (round != null) {
                ordered.put(round);
            }
        }
        return new JSONObject().put("rounds", ordered);
    }

    public void forget(long gameId) {
        for (int chunk = 0; chunk < CHUNKS; chunk++) {
            stateBlobs.forget(gameId, blobKey(chunk));
        }
        // Pulizia del vecchio formato unico, se questa partita lo aveva usato.
        stateBlobs.forget(gameId, LEGACY_BLOB);
    }

    private Object lock(long gameId) {
        return locks.computeIfAbsent(gameId, key -> new Object());
    }

    private String blobKey(int chunk) {
        return BLOB_PREFIX + chunk;
    }

    private JSONObject load(long gameId, int chunk) {
        return loadKey(gameId, blobKey(chunk));
    }

    private JSONObject loadKey(long gameId, String key) {
        return stateBlobs.load(gameId, key)
                .map(JSONObject::new)
                .orElseGet(JSONObject::new);
    }

    /**
     * Lo storico è salvato come array ordinato; per aggiornare un round serve
     * una mappa per indice. Accetta anche il vecchio formato a oggetto, così
     * una riga già scritta non viene persa al primo salvataggio successivo.
     */
    private JSONObject roundMap(JSONObject stored) {
        JSONObject map = new JSONObject();
        JSONArray array = stored.optJSONArray("rounds");
        if (array != null) {
            for (int index = 0; index < array.length(); index++) {
                JSONObject round = array.optJSONObject(index);
                if (round == null) continue;
                int roundIndex = round.optInt("roundIndex",-1);
                if (roundIndex >= 0) map.put(String.valueOf(roundIndex), round);
            }
            return map;
        }
        JSONObject object = stored.optJSONObject("rounds");
        if (object == null) return map;
        for (String key : object.keySet()) {
            JSONObject round = object.optJSONObject(key);
            if (round != null) map.put(key, round);
        }
        return map;
    }

    private List<Integer> orderedIndexes(JSONObject rounds) {
        List<Integer> indexes = new ArrayList<>();
        for (String key : rounds.keySet()) {
            try {
                indexes.add(Integer.parseInt(key));
            } catch (NumberFormatException ignored) {
                // Una chiave corrotta non deve nascondere le altre righe.
            }
        }
        indexes.sort(Comparator.naturalOrder());
        return indexes;
    }

    private String normalizeType(Object rawType) {
        String type = rawType == null ? "" : String.valueOf(rawType).trim();
        if (type.length() > 32) {
            type = type.substring(0, 32);
        }
        return type.toUpperCase(Locale.ROOT);
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
            Map<?, ?> row = value instanceof JSONObject json
                    ? JsonSupport.toMap(json)
                    : (Map<?, ?>) value;
            Object rawName = row.get("playerName");
            String playerName = rawName == null ? "" : String.valueOf(rawName).trim();
            if (playerName.isEmpty() || playerName.length() > MAX_NAME || byName.containsKey(playerName)) {
                continue;
            }
            byName.put(playerName, new JSONObject()
                    .put("playerName", playerName)
                    .put("points", clamp(row.get("points"), -MAX_POINTS, MAX_POINTS))
                    .put("totalPoints", clamp(row.get("totalPoints"), -MAX_POINTS, MAX_POINTS)));
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