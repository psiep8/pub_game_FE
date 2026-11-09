package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AzzardoMediaServiceTest {

    private final CelebrityImageService images = mock(CelebrityImageService.class);
    private final AppleMusicCuratorService music = mock(AppleMusicCuratorService.class);
    private final LocalMediaBankService local = mock(LocalMediaBankService.class);
    private final AzzardoMediaService media = new AzzardoMediaService(images, music, local, true);

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        when(local.person(anyString())).thenReturn(Optional.empty());
        when(local.findTrack(anyString(), anyString())).thenReturn(Optional.empty());
        when(local.hasPeople()).thenReturn(false);
        when(local.hasTracks()).thenReturn(false);
    }

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
        AzzardoMediaService disabled = new AzzardoMediaService(images, music, local, false);

        assertThat(disabled.forQuestion("PAESI", "Quanti paesi confinano con l'Italia?")).isNull();
    }

    @Test
    void laFotoLocaleNonChiamaWikipedia() {
        LocalMediaBankService.Person person = new LocalMediaBankService.Person(
                "Albert Einstein", "/media/people/albert-einstein.jpg",
                "fisico tedesco", "Teoria della relatività.");
        when(local.person("Albert Einstein")).thenReturn(Optional.of(person));
        when(local.hasPeople()).thenReturn(true);
        when(local.url("/media/people/albert-einstein.jpg"))
                .thenReturn("http://lan:8080/media/people/albert-einstein.jpg");
        when(images.cluesFromLocal("Albert Einstein", "fisico tedesco", "Teoria della relatività."))
                .thenReturn(List.of("fisico tedesco", "teoria della relatività"));

        JSONObject result = media.forQuestion("CELEBRITÀ",
                "Qual è l'anno di nascita di Albert Einstein?");

        assertThat(result).isNotNull();
        assertThat(result.getString("imageUrl"))
                .isEqualTo("http://lan:8080/media/people/albert-einstein.jpg");
        assertThat(result.getJSONArray("clues").length()).isEqualTo(2);
        verify(images, never()).getReliableImageUrl(anyString());
        verify(images, never()).getClues(anyString());
    }

    @Test
    void laCanzoneLocaleNonChiamaITunes() {
        LocalMediaBankService.Track track = new LocalMediaBankService.Track(
                "Imagine", "John Lennon", "1971",
                "/media/covers/john-lennon-imagine.jpg",
                "/media/music/john-lennon-imagine.m4a");
        when(local.findTrack("Imagine", "John Lennon")).thenReturn(Optional.of(track));
        when(local.hasTracks()).thenReturn(true);
        when(local.url("/media/music/john-lennon-imagine.m4a"))
                .thenReturn("http://lan:8080/media/music/john-lennon-imagine.m4a");
        when(local.url("/media/covers/john-lennon-imagine.jpg"))
                .thenReturn("http://lan:8080/media/covers/john-lennon-imagine.jpg");

        JSONObject result = media.forQuestion("CANZONI",
                "In che anno è uscita Imagine di John Lennon?");

        assertThat(result).isNotNull();
        assertThat(result.getString("previewUrl"))
                .isEqualTo("http://lan:8080/media/music/john-lennon-imagine.m4a");
        assertThat(result.getString("albumCover"))
                .isEqualTo("http://lan:8080/media/covers/john-lennon-imagine.jpg");
        verify(music, never()).findTrack(anyString(), anyString());
    }

    @Test
    void conLaBancaInstallataUnBranoMancanteNonEsceInRete() {
        when(local.hasTracks()).thenReturn(true);

        assertThat(media.forQuestion("CANZONI",
                "In che anno è uscita Imagine di John Lennon?")).isNull();
        verify(music, never()).findTrack(anyString(), anyString());
    }
}
