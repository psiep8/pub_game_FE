package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Banca del bonus Karaoke.
 *
 * <p>I metadati delle cinque manche sono tracciati in
 * {@code questions/karaoke-bank.json}. I testi sincronizzati sono protetti dal
 * diritto d'autore e restano fuori dal repository: lo script
 * {@code scripts/bonus/scarica-testi.mjs} li scrive in
 * {@code questions/lyrics-bonus-it.json} (ignorato da git), che questo servizio
 * unisce alla banca. Se il file locale manca, la manche arriva comunque con
 * titolo e audio, ma senza righe: la TV lo dice e il presentatore può
 * sincronizzare il testo prima della serata.</p>
 */
@Service
public class KaraokeService {

    /** Una riga sincronizzata: tempo relativo all'inizio della clip da 30s. */
    public record Line(int indice, int inizioMs, String testo) {
    }

    /** Una manche pronta per la TV. */
    public record Manche(int manche, int punti, String titolo, String artista, int anno,
            String file, int offsetMs, boolean testiPronti,
            List<Line> righe, List<Line> risposte) {
    }

    private final List<Manche> manches;

    public KaraokeService() {
        this.manches = load();
    }

    public List<Manche> manches() {
        return manches;
    }

    private List<Manche> load() {
        JSONArray bank = readArray("questions/karaoke-bank.json", "manche");
        if (bank == null || bank.isEmpty()) {
            return List.of();
        }

        Map<Integer, JSONObject> lyricsByManche = new LinkedHashMap<>();
        Map<String, JSONObject> lyricsByTitle = new LinkedHashMap<>();
        JSONArray local = readArray("questions/lyrics-bonus-it.json", "manche");
        if (local != null) {
            for (int index = 0; index < local.length(); index++) {
                JSONObject row = local.optJSONObject(index);
                if (row == null) continue;
                lyricsByManche.put(row.optInt("manche", -1), row);
                lyricsByTitle.put(normalize(row.optString("titolo", "")), row);
            }
        }

        List<Manche> result = new ArrayList<>();
        for (int index = 0; index < bank.length(); index++) {
            JSONObject row = bank.optJSONObject(index);
            if (row == null) continue;
            int number = row.optInt("manche", index + 1);
            String title = row.optString("titolo", "");
            JSONObject lyrics = lyricsByManche.get(number);
            if (lyrics == null) lyrics = lyricsByTitle.get(normalize(title));

            List<Line> lines = lyrics == null ? List.of() : lines(lyrics.optJSONArray("righe"));
            List<Line> answers = lyrics == null ? List.of() : lines(lyrics.optJSONArray("righeCorrette"));
            int offset = lyrics == null ? Math.max(0, row.optInt("offsetMs", 0))
                    : Math.max(0, lyrics.optInt("offsetMs", row.optInt("offsetMs", 0)));

            result.add(new Manche(
                    number,
                    Math.max(0, row.optInt("punti", 0)),
                    title,
                    row.optString("artista", ""),
                    row.optInt("anno", 0),
                    row.optString("file", ""),
                    offset,
                    !lines.isEmpty(),
                    lines,
                    answers));
        }
        return List.copyOf(result);
    }

    private List<Line> lines(JSONArray rows) {
        if (rows == null) return List.of();
        List<Line> result = new ArrayList<>();
        for (int index = 0; index < rows.length(); index++) {
            JSONObject row = rows.optJSONObject(index);
            if (row == null || row.optString("testo", "").isBlank()) continue;
            result.add(new Line(
                    row.optInt("indice", index + 1),
                    Math.max(0, row.optInt("inizioMs", 0)),
                    row.optString("testo", "")));
        }
        return List.copyOf(result);
    }

    private JSONArray readArray(String path, String key) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) return null;
        try (InputStream stream = resource.getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            return root.optJSONArray(key);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalize(String value) {
        return QuestionHistoryService.normalize(value);
    }
}
