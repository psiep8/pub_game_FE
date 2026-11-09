package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AppleMusicCuratorServiceTest {

    @Test
    void seIReteECadutaLaRiservaHaComunqueUnaPreviewReale() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new IllegalStateException("offline"));

        MusicTrackDto track = new AppleMusicCuratorService(restTemplate).getFamousSong();

        assertThat(track.previewUrl).isNotBlank().startsWith("https://");
        assertThat(track.albumCover).isNotBlank().startsWith("https://");
        assertThat(track.source).isEqualTo("fallback-preview");
    }

    @Test
    void findTrackPreferisceIlTitoloEsattoAllaPrimaVersione() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String raw = """
                {"results":[
                  {"trackId":1,"trackName":"Imagine (Take 1)","artistName":"John Lennon","previewUrl":"https://audio.example/take1.m4a","artworkUrl100":"https://cover.example/1/100x100bb.jpg","releaseDate":"1971-01-01"},
                  {"trackId":2,"trackName":"Imagine","artistName":"John Lennon","previewUrl":"https://audio.example/exact.m4a","artworkUrl100":"https://cover.example/2/100x100bb.jpg","releaseDate":"1971-09-09"}
                ]}
                """;
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(raw);

        Optional<MusicTrackDto> found = new AppleMusicCuratorService(restTemplate)
                .findTrack("Imagine", "John Lennon");

        assertThat(found).isPresent();
        assertThat(found.get().previewUrl).isEqualTo("https://audio.example/exact.m4a");
        assertThat(found.get().albumCover).contains("600x600");
    }
}
