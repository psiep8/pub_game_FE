package com.pub_game_be.service;

import com.pub_game_be.dto.AppleMusicResponse;
import com.pub_game_be.dto.AppleMusicTrack;
import com.pub_game_be.dto.MusicTrackDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
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

            AppleMusicTrack track = validTracks.get(0);

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
                } catch (Exception e) {
                    dto.year = null;
                }
            }

            dto.duration = 30;
            dto.type = type;
            dto.source = "apple-music";

            return dto;

        } catch (Exception e) {
            return getFallbackSong(type);
        }
    }

    private MusicTrackDto getFallbackSong(String type) {
        MusicTrackDto dto = new MusicTrackDto();
        dto.source = "fallback";
        dto.type = type;
        dto.duration = 30;

        if ("italian".equals(type)) {
            String[][] italianHits = {
                    { "fallback_ita_1", "Albachiara", "Vasco Rossi", "1979" },
                    { "fallback_ita_2", "Sally", "Vasco Rossi", "1996" },
                    { "fallback_ita_3", "Volare", "Domenico Modugno", "1958" },
                    { "fallback_ita_4", "La solitudine", "Laura Pausini", "1993" },
                    { "fallback_ita_5", "Azzurro", "Adriano Celentano", "1968" },
                    { "fallback_ita_6", "Un'emozione per sempre", "Eros Ramazzotti", "2003" },
                    { "fallback_ita_7", "Caruso", "Lucio Dalla", "1986" }
            };

            String[] hit = italianHits[random.nextInt(italianHits.length)];
            dto.id = hit[0];
            dto.title = hit[1];
            dto.artist = hit[2];
            dto.year = Integer.parseInt(hit[3]);
            dto.previewUrl = "";
            dto.albumCover = "";

        } else {
            String[][] internationalHits = {
                    { "fallback_int_1", "Bohemian Rhapsody", "Queen", "1975" },
                    { "fallback_int_2", "Billie Jean", "Michael Jackson", "1982" },
                    { "fallback_int_3", "Thriller", "Michael Jackson", "1982" },
                    { "fallback_int_4", "Like a Prayer", "Madonna", "1989" },
                    { "fallback_int_5", "Hotel California", "Eagles", "1976" },
                    { "fallback_int_6", "Sweet Child O' Mine", "Guns N' Roses", "1987" },
                    { "fallback_int_7", "Smells Like Teen Spirit", "Nirvana", "1991" },
                    { "fallback_int_8", "Wonderwall", "Oasis", "1995" },
                    { "fallback_int_9", "Dancing Queen", "ABBA", "1976" },
                    { "fallback_int_10", "Imagine", "John Lennon", "1971" }
            };

            String[] hit = internationalHits[random.nextInt(internationalHits.length)];
            dto.id = hit[0];
            dto.title = hit[1];
            dto.artist = hit[2];
            dto.year = Integer.parseInt(hit[3]);
            dto.previewUrl = "";
            dto.albumCover = "";
        }

        return dto;
    }
}