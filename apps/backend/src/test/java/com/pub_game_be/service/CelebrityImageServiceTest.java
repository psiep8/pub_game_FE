package com.pub_game_be.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * La foto di Indovina chi arriva da Wikipedia con le sue misure: la TV le usa
 * per riservare la cornice prima che l'immagine sia scaricata.
 */
class CelebrityImageServiceTest {

    @Test
    void portaLeMisureDellaFotoInsiemeAllImmagine() {
        String json = """
                {"type":"standard","title":"Marlon Brando",
                 "thumbnail":{"source":"https://upload.wikimedia.org/brando.jpg",
                              "width":330,"height":455},
                 "description":"attore statunitense",
                 "extract":"Marlon Brando è stato un attore statunitense."}
                """;
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(json, HttpStatus.OK));

        Optional<CelebrityImageService.WikiSummary> summary =
                new CelebrityImageService(restTemplate).summary("Marlon Brando");

        assertThat(summary).isPresent();
        assertThat(summary.get().imageUrl()).contains("brando.jpg");
        assertThat(summary.get().imageWidth()).isEqualTo(330);
        assertThat(summary.get().imageHeight()).isEqualTo(455);
    }

    @Test
    void senzaFotoLeMisureRestanoAZero() {
        String json = """
                {"type":"standard","title":"Persona",
                 "description":"una persona","extract":"Biografia senza foto."}
                """;
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenReturn(new ResponseEntity<>(json, HttpStatus.OK));

        Optional<CelebrityImageService.WikiSummary> summary =
                new CelebrityImageService(restTemplate).summary("Persona");

        assertThat(summary).isPresent();
        assertThat(summary.get().imageWidth()).isZero();
        assertThat(summary.get().imageHeight()).isZero();
    }
}
