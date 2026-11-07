package com.pub_game_be.service;

import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

/**
 * Livelli già scelti da ogni squadra nelle occorrenze precedenti di Ultima
 * spiaggia. La scelta è definitiva per la partita: nel prossimo atto la stessa
 * squadra non può ripetere quel livello, anche se la categoria cambia.
 */
@Service
public class UltimaSpiaggiaLevelService {

    private static final String BLOB_KEY = "ultima-spiaggia-levels";
    private static final Set<Integer> LEVELS = Set.of(100, 200, 300, 400, 500);

    private final StateBlobService blobs;

    public UltimaSpiaggiaLevelService(StateBlobService blobs) {
        this.blobs = blobs;
    }

    /** Mappa giocatore → livelli già consumati, con valori ordinati. */
    public synchronized JSONObject usedLevels(long gameId) {
        JSONObject out = new JSONObject();
        blobs.load(gameId, BLOB_KEY).ifPresent(raw -> {
            try {
                JSONObject saved = new JSONObject(raw);
                for (String playerName : saved.keySet()) {
                    JSONArray savedLevels = saved.optJSONArray(playerName);
                    if (savedLevels == null) {
                        continue;
                    }

                    List<Integer> normalized = normalizedLevels(savedLevels);
                    if (!normalized.isEmpty()) {
                        out.put(playerName, new JSONArray(normalized));
                    }
                }
            } catch (Exception ignored) {
                // Stato corrotto: si riparte da una mappa vuota, senza bloccare il round.
            }
        });
        return out;
    }

    /** Registra un livello appena scelto; le chiamate ripetute sono innocue. */
    public synchronized void record(long gameId, String playerName, int level) {
        String name = playerName == null ? "" : playerName.trim();
        if (name.isEmpty() || !LEVELS.contains(level)) {
            return;
        }

        JSONObject used = usedLevels(gameId);
        JSONArray existing = used.optJSONArray(name);
        List<Integer> levels = existing == null ? new ArrayList<>() : normalizedLevels(existing);
        if (levels.contains(level)) {
            return;
        }

        levels.add(level);
        Collections.sort(levels);
        used.put(name, new JSONArray(levels));
        blobs.save(gameId, BLOB_KEY, used.toString());
    }

    /** Azzera la memoria dei livelli: nuova partita o reset completo. */
    public synchronized void clear(long gameId) {
        blobs.forget(gameId, BLOB_KEY);
    }

    private List<Integer> normalizedLevels(JSONArray raw) {
        List<Integer> levels = new ArrayList<>();
        for (int index = 0; index < raw.length(); index++) {
            int level = raw.optInt(index, 0);
            if (LEVELS.contains(level) && !levels.contains(level)) {
                levels.add(level);
            }
        }
        Collections.sort(levels);
        return levels;
    }
}
