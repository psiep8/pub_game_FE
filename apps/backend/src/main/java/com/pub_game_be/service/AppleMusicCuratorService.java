package com.pub_game_be.service;

import com.pub_game_be.dto.AppleMusicResponse;
import com.pub_game_be.dto.AppleMusicTrack;
import com.pub_game_be.dto.MusicTrackDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Random;

@Service
public class AppleMusicCuratorService {

    private static final String API_URL = "https://itunes.apple.com/search";
    private final RestTemplate restTemplate;
    private final Random random = new Random();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final List<String> ITALIAN_ARTISTS = List.of(
            "Vasco Rossi", "Ligabue", "Zucchero", "Lucio Battisti",
            "Eros Ramazzotti", "Laura Pausini", "Tiziano Ferro",
            "Gianna Nannini", "Renato Zero", "Claudio Baglioni",
            "Lucio Dalla", "Adriano Celentano", "Domenico Modugno",

            "Marco Mengoni", "Giorgia", "Elisa", "Alessandra Amoroso",
            "Emma Marrone", "Annalisa", "Elodie", "Mahmood",

            "Max Pezzali", "883", "Nek", "Subsonica",

            "Gigi D'Agostino", "Gabry Ponte", "Eiffel 65");

    private static final List<String> INTERNATIONAL_ARTISTS = List.of(
            "Queen", "The Beatles", "Michael Jackson", "Madonna",
            "ABBA", "Whitney Houston", "Celine Dion",

            "Coldplay", "U2", "Bon Jovi", "The Rolling Stones",
            "Eagles", "Guns N' Roses", "Nirvana", "Oasis",
            "Led Zeppelin", "Pink Floyd", "AC/DC",

            "Ed Sheeran", "Adele", "Bruno Mars", "Taylor Swift",
            "The Weeknd", "Ariana Grande", "Justin Timberlake",
            "Lady Gaga", "Beyoncé", "Rihanna",

            "Daft Punk", "David Guetta", "Calvin Harris", "Avicii",
            "The Chainsmokers",

            "Eminem", "50 Cent", "Jay-Z", "Snoop Dogg");

    /**
     * Brano di riserva con una preview reale: se la ricerca iTunes è giù o
     * risponde senza audio, la TV non resta muta. Le URL sono gli stessi
     * preview pubblici di 30 secondi usati da iTunes.
     */
    private static final String[][] FALLBACK_TRACKS = {
            {
                    "fallback_int_1", "Imagine", "John Lennon", "1971",
                    "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/5a/54/35/5a54358c-9c9f-66db-fe4e-e677ba889f56/mzaf_264057399856026028.plus.aac.p.m4a",
                    "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/58/c8/24/58c82410-0d31-e5fc-6a45-e5bd6a6658df/18UMGIM52733.rgb.jpg/600x600bb.jpg",
                    "international"
            },
            {
                    "fallback_int_2", "Bohemian Rhapsody", "Queen", "1975",
                    "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/22/62/99/22629918-bc73-ac75-4751-7bc3bb2bf322/mzaf_3646528785331925443.plus.aac.p.m4a",
                    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b0/ca/05/b0ca05aa-29c9-4e01-5a16-f6fa06bce05c/602527594347.jpg/600x600bb.jpg",
                    "international"
            },
            {
                    "fallback_int_3", "Billie Jean", "Michael Jackson", "1982",
                    "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a0/20/1b/a0201bf3-e6a7-f2fc-a836-a536593c3e51/mzaf_3717140176449046337.plus.aac.p.m4a",
                    "https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/2a/82/a5/2a82a59b-6e79-7c39-761a-c1d3b82e93cb/dj.dzbxcmnk.jpg/600x600bb.jpg",
                    "international"
            },
            {
                    "fallback_ita_1", "Volare (Nel blu dipinto di blu)", "Domenico Modugno", "1958",
                    "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/62/94/8e/62948e46-26a9-0f95-fe9a-72dc6d331366/mzaf_8897779674712889889.plus.aac.p.m4a",
                    "https://is1-ssl.mzstatic.com/image/thumb/Music42/v4/ce/f6/8f/cef68fe1-a6b3-9a0c-7646-a8cd4e60290b/mzm.bdwficxe.jpg/600x600bb.jpg",
                    "italian"
            }
    };

    public AppleMusicCuratorService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public MusicTrackDto getFamousSong() {
        boolean italian = random.nextDouble() < 0.7;
        return italian ? getItalianSong() : getInternationalSong();
    }

    private MusicTrackDto getItalianSong() {
        return searchTopSongByArtist(
                ITALIAN_ARTISTS.get(random.nextInt(ITALIAN_ARTISTS.size())),
                "italian");
    }

    private MusicTrackDto getInternationalSong() {
        return searchTopSongByArtist(
                INTERNATIONAL_ARTISTS.get(random.nextInt(INTERNATIONAL_ARTISTS.size())),
                "international");
    }

    /**
     * Cerca un brano preciso: serve all'Azzardo, che deve suonare la canzone
     * citata nella domanda, e come secondo tentativo per la manche Musica.
     */
    public Optional<MusicTrackDto> findTrack(String title, String artist) {
        if (title == null || title.isBlank()) {
            return Optional.empty();
        }

        try {
            String term = artist == null || artist.isBlank()
                    ? title
                    : artist + " " + title;
            String url = API_URL + "?term=" + URLEncoder.encode(term, StandardCharsets.UTF_8)
                    + "&entity=song&limit=25&country=IT";

            String rawJson = restTemplate.getForObject(url, String.class);
            AppleMusicResponse response = objectMapper.readValue(rawJson, AppleMusicResponse.class);
            if (response == null || response.results == null || response.results.isEmpty()) {
                return Optional.empty();
            }

            String wantedTitle = normalize(title);
            String wantedArtist = normalize(artist);
            List<AppleMusicTrack> candidates = response.results.stream()
                    .filter(track -> track.previewUrl != null && !track.previewUrl.isBlank())
                    .filter(track -> track.trackName != null)
                    .filter(track -> wantedArtist.isBlank()
                            || normalize(track.artistName).contains(wantedArtist))
                    .sorted(Comparator.comparingInt(track -> titleScore(track.trackName, wantedTitle)))
                    .toList();

            // Se l'artista non combacia (duetti, remaster), resta il titolo:
            // meglio la versione giusta di un altro artista che nessun audio.
            if (candidates.isEmpty()) {
                candidates = response.results.stream()
                        .filter(track -> track.previewUrl != null && !track.previewUrl.isBlank())
                        .filter(track -> track.trackName != null)
                        .filter(track -> normalize(track.trackName).contains(wantedTitle))
                        .sorted(Comparator.comparingInt(track -> titleScore(track.trackName, wantedTitle)))
                        .toList();
            }

            return candidates.isEmpty()
                    ? Optional.empty()
                    : Optional.of(toDto(candidates.get(0), "apple-music"));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private MusicTrackDto searchTopSongByArtist(String artist, String type) {
        try {
            String query = URLEncoder.encode(artist, StandardCharsets.UTF_8);

            String url = API_URL + "?term=" + query +
                    "&entity=song&limit=50&country=IT";

            String rawJson = restTemplate.getForObject(url, String.class);
            AppleMusicResponse response = objectMapper.readValue(rawJson, AppleMusicResponse.class);

            if (response == null || response.results == null || response.results.isEmpty()) {
                return getFallbackSong(type);
            }

            List<AppleMusicTrack> validTracks = response.results.stream()
                    .filter(t -> t.previewUrl != null && !t.previewUrl.isEmpty())
                    .filter(t -> t.artistName != null &&
                            t.artistName.toLowerCase().contains(artist.toLowerCase().split(" ")[0]))
                    .filter(t -> {
                        if (t.releaseDate == null || t.releaseDate.length() < 4)
                            return true;
                        try {
                            int year = Integer.parseInt(t.releaseDate.substring(0, 4));
                            return year >= 1970;
                        } catch (Exception e) {
                            return true;
                        }
                    })
                    .toList();

            if (validTracks.isEmpty()) {
                return getFallbackSong(type);
            }

            return toDto(validTracks.get(0), type);

        } catch (Exception e) {
            return getFallbackSong(type);
        }
    }

    private MusicTrackDto toDto(AppleMusicTrack track, String type) {
        MusicTrackDto dto = new MusicTrackDto();
        dto.id = String.valueOf(track.trackId);
        dto.title = track.trackName;
        dto.artist = track.artistName;
        dto.previewUrl = track.previewUrl;
        dto.albumCover = track.artworkUrl100 != null
                ? track.artworkUrl100.replace("100x100", "600x600")
                : "";

        if (track.releaseDate != null && track.releaseDate.length() >= 4) {
            try {
                dto.year = Integer.parseInt(track.releaseDate.substring(0, 4));
            } catch (Exception ignored) {
                dto.year = null;
            }
        }

        dto.duration = 30;
        dto.type = type;
        dto.source = "apple-music";
        return dto;
    }

    /** Riserva con preview non vuota: l'ultimo livello non è più silenzioso. */
    private MusicTrackDto getFallbackSong(String type) {
        String[] hit = FALLBACK_TRACKS[random.nextInt(FALLBACK_TRACKS.length)];

        MusicTrackDto dto = new MusicTrackDto();
        dto.id = hit[0];
        dto.title = hit[1];
        dto.artist = hit[2];
        dto.year = Integer.parseInt(hit[3]);
        dto.previewUrl = hit[4];
        dto.albumCover = hit[5];
        dto.duration = 30;
        dto.type = type == null || type.isBlank() ? hit[6] : type;
        dto.source = "fallback-preview";
        return dto;
    }

    private int titleScore(String candidate, String wanted) {
        String value = normalize(candidate);
        if (value.equals(wanted)) {
            return 0;
        }
        if (value.startsWith(wanted)) {
            return 1;
        }
        if (value.contains(wanted)) {
            return 2;
        }
        return 3;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
