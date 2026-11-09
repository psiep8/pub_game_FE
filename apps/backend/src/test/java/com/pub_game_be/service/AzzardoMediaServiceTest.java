package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AzzardoMediaServiceTest {

    private final CelebrityImageService images = mock(CelebrityImageService.class);
    private final AppleMusicCuratorService music = mock(AppleMusicCuratorService.class);
    private final AzzardoMediaService media = new AzzardoMediaService(images, music, true);

    @Test
    void laCelebrityHaFotoEIndiziSenzaLAnnoDellaRisposta() {
        when(images.getReliableImageUrl("Albert Einstein"))
                .thenReturn("https://upload.wikimedia.org/einstein.jpg");
        when(images.getClues("Albert Einstein")).thenReturn(List.of(
                "fisico tedesco (1879-1955)",
                "Premio Nobel per la fisica nel 1921",
                "teoria della relatività"));

        JSONObject result = media.forQuestion("CELEBRITÀ",
                "Qual è l'anno di nascita di Albert Einstein?");

        assertThat(result).isNotNull();
        assertThat(result.getString("kind")).isEqualTo("celebrity");
        assertThat(result.getString("imageUrl")).contains("einstein.jpg");

        JSONArray clues = result.getJSONArray("clues");
        assertThat(clues.length()).isEqualTo(3);
        for (int index = 0; index < clues.length(); index++) {
            assertThat(clues.getString(index)).doesNotContain("1879", "1921", "1955");
        }
    }

    @Test
    void laCanzoneHaUnaPreviewElaCopertina() {
        MusicTrackDto track = new MusicTrackDto();
        track.title = "Imagine";
        track.artist = "John Lennon";
        track.previewUrl = "https://audio.example/imagine.m4a";
        track.albumCover = "https://cover.example/imagine.jpg";
        when(music.findTrack("Imagine", "John Lennon")).thenReturn(Optional.of(track));

        JSONObject result = media.forQuestion("CANZONI",
                "In che anno è uscita Imagine di John Lennon?");

        assertThat(result).isNotNull();
        assertThat(result.getString("kind")).isEqualTo("song");
        assertThat(result.getString("previewUrl")).isEqualTo("https://audio.example/imagine.m4a");
        assertThat(result.getString("albumCover")).contains("imagine.jpg");
        // L'anno è la risposta: non deve viaggiare nel media.
        assertThat(result.has("year")).isFalse();
    }

    @Test
    void ilPaeseHaCartinaLocaleEBandiera() {
        JSONObject result = media.forQuestion("PAESI",
                "Quanti paesi confinano con l'Italia?");

        assertThat(result).isNotNull();
        assertThat(result.getString("kind")).isEqualTo("country");
        assertThat(result.getString("countryCode")).isEqualTo("it");
        assertThat(result.getString("mapUrl")).isEqualTo("/maps/it.svg");
        assertThat(result.getString("flagUrl")).contains("flagcdn.com/w640/it.png");
    }

    @Test
    void senzaMediaUtileIlPayloadRestaGiocabile() {
        assertThat(media.forQuestion("STORIA", "In che anno è caduto il Muro di Berlino?")).isNull();
        assertThat(media.forQuestion("CELEBRITÀ", "Domanda senza nome")).isNull();
    }

    @Test
    void ilFlagDisabilitatoSpegneLeChiamateEsterne() {
        AzzardoMediaService disabled = new AzzardoMediaService(images, music, false);

        assertThat(disabled.forQuestion("PAESI", "Quanti paesi confinano con l'Italia?")).isNull();
    }
}
