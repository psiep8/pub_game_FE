package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Banca del bonus Karaoke.
 *
 * <p>La banca sta in {@code questions/karaoke-bank.json} e ha almeno dieci
 * canzoni; la partita ne pesca cinque senza ripetizioni con un seed stabile
 * (l'id della partita), così lo stesso tavolo rivede le stesse manche anche
 * dopo un refresh o una pausa. I punti dipendono dalla posizione della manche
 * (100/150/200/250/300), non dalla canzone.</p>
 *
 * <p>I testi sincronizzati sono protetti dal diritto d'autore e restano fuori
 * dal repository: {@code scripts/bonus/scarica-testi.mjs} li scrive in
 * {@code questions/lyrics-bonus-it.json} (ignorato da git), che questo servizio
 * unisce alla banca. Se il file locale manca la manche arriva comunque con
 * titolo e audio, ma senza righe: la TV scrive «TESTO NON DISPONIBILE» e il
 * presentatore può lanciare lo script prima della serata.</p>
 */
@Service
public class KaraokeService {

    /** Una riga sincronizzata: tempo relativo all'inizio della clip da 30s. */
    public record Line(int indice, int inizioMs, String testo) {
    }

    /** Una canzone della banca, senza punti: la posizione decide i punti. */
    public record Brano(int indice, String titolo, String artista, int anno, String file,
            int offsetMs, boolean testiPronti, List<Line> righe, List<Line> risposte) {
    }

    /** Una manche pronta per la TV. */
    public record Manche(int manche, int punti, String titolo, String artista, int anno,
            String file, int offsetMs, boolean testiPronti,
            List<Line> righe, List<Line> risposte) {
    }

    /** Punti della manche, dal primo all'ultimo posto della scaletta. */
    public static final List<Integer> PUNTI = List.of(100, 150, 200, 250, 300);

    /** Quante manche gioca una partita. */
    public static final int MANCHE_PER_PARTITA = 5;

    /** Dal 2018 in poi: la banca deve avere canzoni recenti per il pubblico giovane. */
    private static final int ANNO_RECENTE = 2018;

    private final List<Brano> banca;

    public KaraokeService() {
        this.banca = load();
    }

    /** Tutta la banca, nell'ordine del file. */
    public List<Brano> banca() {
        return banca;
    }

    /**
     * Cinque manche senza ripetizioni, stabili per la stessa partita.
     *
     * @param seed id della partita (0 nelle demo)
     */
    public List<Manche> selezione(long seed) {
        if (banca.isEmpty()) return List.of();
        List<Brano> mescolata = new ArrayList<>(banca);
        Collections.shuffle(mescolata, new Random(seed));

        int quante = Math.min(MANCHE_PER_PARTITA, mescolata.size());
        List<Brano> scelte = new ArrayList<>(mescolata.subList(0, quante));

        // Almeno una canzone recente: una serata senza brani del Duemila
        // lascerebbe fuori proprio il pubblico più giovane.
        boolean recente = scelte.stream().anyMatch((brano) -> brano.anno() >= ANNO_RECENTE);
        if (!recente) {
            Brano cambio = mescolata.stream()
                    .filter((brano) -> brano.anno() >= ANNO_RECENTE && !scelte.contains(brano))
                    .findFirst()
                    .orElse(null);
            if (cambio != null && !scelte.isEmpty()) scelte.set(scelte.size() - 1, cambio);
        }

        List<Manche> manches = new ArrayList<>();
        for (int index = 0; index < scelte.size(); index++) {
            Brano brano = scelte.get(index);
            manches.add(new Manche(
                    index + 1,
                    PUNTI.get(Math.min(index, PUNTI.size() - 1)),
                    brano.titolo(),
                    brano.artista(),
                    brano.anno(),
                    brano.file(),
                    brano.offsetMs(),
                    brano.testiPronti(),
                    brano.righe(),
                    brano.risposte()));
        }
        return List.copyOf(manches);
    }

    private List<Brano> load() {
        JSONArray bank = readArray("questions/karaoke-bank.json", "canzoni");
        if (bank == null) bank = readArray("questions/karaoke-bank.json", "manche");
        if (bank == null || bank.isEmpty()) {
            return List.of();
        }

        Map<String, JSONObject> lyricsByTitle = new LinkedHashMap<>();
        JSONArray local = readArray("questions/lyrics-bonus-it.json", "manche");
        if (local != null) {
            for (int index = 0; index < local.length(); index++) {
                JSONObject row = local.optJSONObject(index);
                if (row == null) continue;
                lyricsByTitle.put(normalize(row.optString("titolo", "")), row);
            }
        }

        List<Brano> result = new ArrayList<>();
        for (int index = 0; index < bank.length(); index++) {
            JSONObject row = bank.optJSONObject(index);
            if (row == null) continue;
            String title = row.optString("titolo", "");
            // Il testo si cerca per titolo: la selezione rimescola le manche,
            // quindi il numero del file locale non vale più.
            JSONObject lyrics = lyricsByTitle.get(normalize(title));

            List<Line> lines = lyrics == null ? List.of() : lines(lyrics.optJSONArray("righe"));
            List<Line> answers = lyrics == null ? List.of() : lines(lyrics.optJSONArray("righeCorrette"));
            int offset = lyrics == null ? Math.max(0, row.optInt("offsetMs", 0))
                    : Math.max(0, lyrics.optInt("offsetMs", row.optInt("offsetMs", 0)));

            result.add(new Brano(
                    row.optInt("manche", index + 1),
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
