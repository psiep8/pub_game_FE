package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
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

    /** Volto con foto e testo biografico per gli indizi, tutto in locale. */
    public record Person(String name, String file, String description, String extract) {
    }

    private final List<Track> tracks = new ArrayList<>();
    private final Map<String, Person> people = new LinkedHashMap<>();
    private final Map<String, Track> tracksByKey = new LinkedHashMap<>();
    private final String configuredBaseUrl;

    public LocalMediaBankService(@Value("${game.media-base-url:}") String mediaBaseUrl) {
        this.configuredBaseUrl = mediaBaseUrl == null ? "" : mediaBaseUrl.trim();
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
        ClassPathResource resource = new ClassPathResource("questions/media-it.json");
        if (!resource.exists()) {
            return;
        }
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
                            item.optString("extract", ""));
                    people.put(QuestionHistoryService.normalize(person.name()), person);
                }
            }

            System.out.println("Banca media locale: " + tracks.size() + " brani, "
                    + people.size() + " volti.");
        } catch (Exception error) {
            System.out.println("⚠️ Banca media locale illeggibile (" + error.getMessage()
                    + "): si torna a iTunes/TMDB quando c'è rete.");
        }
    }

}
