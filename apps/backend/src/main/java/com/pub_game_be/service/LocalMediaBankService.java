package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Banca media locale: canzoni, copertine e volti già dentro il backend.
 *
 * <p>L'indice è scritto da {@code scripts/generate-questions/generate_media.py}.
 * Quando il file esiste i round non chiamano più iTunes, TMDB o Wikipedia:
 * quello che non c'è nella banca resta vuoto e la TV mostra il segnaposto.
 * Così la serata funziona anche senza internet, non solo con una rete lenta.</p>
 */
@Service
public class LocalMediaBankService {

    /** Brano con anteprima e copertina già scaricate. */
    public record Track(String title, String artist, String year, String albumCover, String file) {
    }

    /**
     * Brano della banca Musica con i tag della serata: famiglia (`theme`) e
     * era reale di uscita, più la difficoltà usata per il mix del round.
     */
    public record TaggedTrack(String title, String artist, String year, String albumCover, String file,
            String theme, String era, String decade, String difficulty) {
    }

    /** Volto con foto e testo biografico per gli indizi, tutto in locale. */
    public record Person(String name, String file, String description, String extract,
            String category) {
    }

    /**
     * Indizio della banca Celebrità: testo, livello (ampio o specifico) e fonte.
     * I quattro indizi di una persona arrivano già nell'ordine giusto, dal più
     * ampio al più specifico, e non contengono il nome.
     */
    public record Clue(String livello, String testo, String fonte) {
    }

    private final List<Track> tracks = new ArrayList<>();
    private final Map<String, Person> people = new LinkedHashMap<>();
    private final Map<String, Track> tracksByKey = new LinkedHashMap<>();
    private final Map<String, Track> tracksByFile = new LinkedHashMap<>();
    private final List<TaggedTrack> taggedTracks = new ArrayList<>();
    private final Map<String, List<TaggedTrack>> tracksByTheme = new LinkedHashMap<>();
    private final Map<String, List<TaggedTrack>> tracksByEra = new LinkedHashMap<>();
    private final List<String> musicThemes = new ArrayList<>();
    private final Map<String, List<Clue>> cluesByName = new LinkedHashMap<>();
    private final List<String> namesWithClues = new ArrayList<>();
    private final String configuredBaseUrl;
    private final Resource mediaResource;

    public LocalMediaBankService(
            @Value("${game.media-base-url:}") String mediaBaseUrl,
            @Value("${game.media-index:classpath:questions/media-it.json}") Resource mediaResource) {
        this.configuredBaseUrl = mediaBaseUrl == null ? "" : mediaBaseUrl.trim();
        this.mediaResource = mediaResource;
        load();
    }

    public boolean hasTracks() {
        return !tracks.isEmpty();
    }

    public boolean hasPeople() {
        return !people.isEmpty();
    }

    public List<Track> tracks() {
        return List.copyOf(tracks);
    }

    /** Banca Musica taggata (music-themes.json): vuota se il file non c'è. */
    public boolean hasMusicThemes() {
        return !taggedTracks.isEmpty();
    }

    public List<TaggedTrack> taggedTracks() {
        return List.copyOf(taggedTracks);
    }

    /** I dieci temi della serata, nell'ordine dichiarato dal file. */
    public List<String> musicThemes() {
        return List.copyOf(musicThemes);
    }

    /** Brani di una famiglia (Italiano, Rock, Dance & disco, …). */
    public List<TaggedTrack> byTheme(String theme) {
        return List.copyOf(tracksByTheme.getOrDefault(theme, List.of()));
    }

    /** Brani di un'era (Anni '70-'80, Anni '90-2000, Anni 2010-oggi). */
    public List<TaggedTrack> byEra(String era) {
        return List.copyOf(tracksByEra.getOrDefault(era, List.of()));
    }

    /**
     * I quattro indizi della banca (già senza nome e con la fonte). Lista vuota
     * quando la persona non è nella banca: in quel caso restano gli indizi
     * ricavati dalla biografia locale.
     */
    public List<Clue> clues(String name) {
        String key = QuestionHistoryService.normalize(name);
        if (key.isBlank()) {
            return List.of();
        }
        return cluesByName.getOrDefault(key, List.of());
    }

    /**
     * Tutti i nomi con quattro indizi, nell'ordine del file: è il pool dei volti
     * per la manche IMAGE_BLUR, non solo chi ha una foto scaricata.
     */
    public List<String> namesWithClues() {
        return List.copyOf(namesWithClues);
    }

    public Optional<Person> person(String name) {
        String key = QuestionHistoryService.normalize(name);
        if (key.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(people.get(key));
    }

    /**
     * Cerca il brano della domanda. iTunes aggiunge spesso sottotitoli tra
     * parentesi ("Imagine (Remastered)"), quindi dopo l'uguaglianza esatta si
     * accetta anche un titolo che inizia con quello cercato.
     */
    public Optional<Track> findTrack(String title, String artist) {
        String cleanTitle = QuestionHistoryService.normalize(title);
        String cleanArtist = QuestionHistoryService.normalize(artist);
        if (cleanTitle.isBlank()) {
            return Optional.empty();
        }

        Track exact = tracksByKey.get(cleanTitle + "|" + cleanArtist);
        if (exact != null) {
            return Optional.of(exact);
        }

        for (Track track : tracks) {
            String trackTitle = QuestionHistoryService.normalize(track.title());
            boolean sameTitle = trackTitle.equals(cleanTitle)
                    || trackTitle.startsWith(cleanTitle + " ")
                    || cleanTitle.startsWith(trackTitle + " ");
            if (!sameTitle) {
                continue;
            }
            String trackArtist = QuestionHistoryService.normalize(track.artist());
            if (cleanArtist.isBlank()
                    || trackArtist.contains(cleanArtist)
                    || cleanArtist.contains(trackArtist)) {
                return Optional.of(track);
            }
        }

        // Nessun ripiego sul solo titolo: una cover di un altro artista non
        // è la canzone della domanda. Meglio la manche senza audio.
        return Optional.empty();
    }

    /**
     * URL servibile del file locale. Senza MEDIA_BASE_URL si torna il percorso
     * relativo (`/media/...`): lo risolve il client sulla propria origine, così
     * telefono e TV usano lo stesso indirizzo con cui hanno aperto l'app.
     * Un URL assoluto ricavato dalla richiesta sarebbe 127.0.0.1 quando la
     * chiamata passa dal proxy del dev-server, e dai telefoni non si sente nulla.
     */
    public String url(String file) {
        if (file == null || file.isBlank()) {
            return null;
        }
        if (file.startsWith("http://") || file.startsWith("https://")) {
            return file;
        }
        String path = file.startsWith("/") ? file : "/" + file;
        return configuredBaseUrl.isBlank() ? path : configuredBaseUrl + path;
    }

    private void load() {
        Resource resource = this.mediaResource;
        if (!resource.exists()) {
            // L'indice media è locale e non versionato: indizi e temi sono
            // versionati e devono restare disponibili anche in un clone pulito.
            loadMusicThemes();
            loadClues();
            return;
        }
        boolean mediaLoaded = false;
        try (InputStream stream = resource.getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));

            JSONArray music = root.optJSONArray("music");
            if (music != null) {
                for (int index = 0; index < music.length(); index++) {
                    JSONObject item = music.optJSONObject(index);
                    if (item == null || item.optString("file", "").isBlank()) {
                        continue;
                    }
                    Track track = new Track(
                            item.optString("title", ""),
                            item.optString("artist", ""),
                            item.optString("year", ""),
                            item.optString("albumCover", null),
                            item.optString("file", ""));
                    tracks.add(track);
                    tracksByKey.putIfAbsent(
                            QuestionHistoryService.normalize(track.title()) + "|"
                                    + QuestionHistoryService.normalize(track.artist()),
                            track);
                    tracksByFile.put(track.file(), track);
                }
            }

            JSONArray persons = root.optJSONArray("people");
            if (persons != null) {
                for (int index = 0; index < persons.length(); index++) {
                    JSONObject item = persons.optJSONObject(index);
                    if (item == null || item.optString("file", "").isBlank()) {
                        continue;
                    }
                    Person person = new Person(
                            item.optString("name", ""),
                            item.optString("file", ""),
                            item.optString("description", ""),
                            item.optString("extract", ""),
                            item.optString("category", ""));
                    people.put(QuestionHistoryService.normalize(person.name()), person);
                }
            }

            mediaLoaded = true;
        } catch (Exception error) {
            System.out.println("⚠️ Banca media locale illeggibile (" + error.getMessage()
                    + "): restano indizi e temi versionati.");
        }
        loadMusicThemes();
        loadClues();
        if (mediaLoaded) {
            System.out.println("Banca media locale: " + tracks.size() + " brani, "
                    + taggedTracks.size() + " taggati per la Musica, "
                    + people.size() + " volti, " + cluesByName.size() + " persone con quattro indizi.");
        }
    }

    /**
     * Banca Musica: i dieci temi e i brani taggati dal generatore
     * `scripts/banche/tagga-musica.mjs`. La copertina arriva dall'indice media,
     * così il tema non duplica i dati del download.
     */
    private void loadMusicThemes() {
        ClassPathResource resource = new ClassPathResource("questions/music-themes.json");
        if (!resource.exists()) {
            System.out.println("Banca Musica assente (music-themes.json): si usa il ripiego a brano singolo.");
            return;
        }
        try (InputStream stream = resource.getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            JSONArray declared = root.optJSONArray("themes");
            for (int index = 0; declared != null && index < declared.length(); index++) {
                String theme = declared.optString(index, "").trim();
                if (!theme.isBlank()) {
                    musicThemes.add(theme);
                }
            }
            JSONArray rows = root.optJSONArray("tracks");
            for (int index = 0; rows != null && index < rows.length(); index++) {
                JSONObject item = rows.optJSONObject(index);
                if (item == null) {
                    continue;
                }
                String file = item.optString("file", "").trim();
                if (file.isBlank()) {
                    continue;
                }
                Track media = tracksByFile.get(file);
                TaggedTrack track = new TaggedTrack(
                        item.optString("title", media == null ? "" : media.title()),
                        item.optString("artist", media == null ? "" : media.artist()),
                        item.optString("year", media == null ? "" : media.year()),
                        media == null ? null : media.albumCover(),
                        file,
                        item.optString("theme", ""),
                        item.optString("era", ""),
                        item.optString("decade", ""),
                        item.optString("difficulty", ""));
                taggedTracks.add(track);
                tracksByTheme.computeIfAbsent(track.theme(), key -> new ArrayList<>()).add(track);
                if (!track.era().isBlank()) {
                    tracksByEra.computeIfAbsent(track.era(), key -> new ArrayList<>()).add(track);
                }
            }
        } catch (Exception error) {
            System.out.println("⚠️ Banca Musica illeggibile (" + error.getMessage()
                    + "): si usa il ripiego a brano singolo.");
        }
    }

    /**
     * Banca degli indizi, versionata: quattro indizi per persona, ognuno con il
     * livello e la fonte. Se il file manca si continua con gli indizi ricavati
     * dalla biografia, come prima.
     */
    private void loadClues() {
        ClassPathResource resource = new ClassPathResource("questions/celebrita-indizi.json");
        if (!resource.exists()) {
            return;
        }
        try (InputStream stream = resource.getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            JSONArray persone = root.optJSONArray("persone");
            if (persone == null) {
                return;
            }
            for (int index = 0; index < persone.length(); index++) {
                JSONObject persona = persone.optJSONObject(index);
                if (persona == null) continue;
                String name = persona.optString("nome", "").trim();
                JSONArray indizi = persona.optJSONArray("indizi");
                if (name.isBlank() || indizi == null || indizi.length() != 4) {
                    continue;
                }
                List<Clue> list = new ArrayList<>(4);
                for (int clueIndex = 0; clueIndex < indizi.length(); clueIndex++) {
                    JSONObject item = indizi.optJSONObject(clueIndex);
                    if (item == null) continue;
                    String testo = item.optString("testo", "").trim();
                    if (testo.isBlank()) continue;
                    list.add(new Clue(item.optString("livello", ""), testo, item.optString("fonte", "")));
                }
                if (list.size() == 4) {
                    cluesByName.put(QuestionHistoryService.normalize(name), List.copyOf(list));
                    namesWithClues.add(name);
                }
            }
        } catch (Exception error) {
            System.out.println("⚠️ Banca indizi illeggibile (" + error.getMessage() + "): si usano gli indizi dalla biografia.");
        }
    }

}
