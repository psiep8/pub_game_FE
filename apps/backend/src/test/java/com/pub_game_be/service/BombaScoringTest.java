package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il malus della bomba scende con l'ordine di scoperta: la prima costa il picco
 * di 500, poi 300, 150 e 50. Nessun bonus: il round è solo a malus.
 */
class BombaScoringTest {

    @Test
    void ilMalusScendeConLOrdineDiScoperta() {
        assertThat(BombaService.bombPenalty(5, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(5, 1)).isEqualTo(300);
        assertThat(BombaService.bombPenalty(5, 2)).isEqualTo(150);
        assertThat(BombaService.bombPenalty(5, 3)).isEqualTo(50);
        assertThat(BombaService.bombPenalty(5, 4)).isEqualTo(50);
    }

    @Test
    void ilNumeroDiBombeNonCambiaLaScala() {
        assertThat(BombaService.bombPenalty(3, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(3, 1)).isEqualTo(300);
        assertThat(BombaService.bombPenalty(3, 2)).isEqualTo(150);
    }

    @Test
    void laPrimaBombaValeSempreIlPicco() {
        for (int bombs = 1; bombs <= 8; bombs++) {
            assertThat(BombaService.bombPenalty(bombs, 0)).isEqualTo(500);
        }
    }
}
