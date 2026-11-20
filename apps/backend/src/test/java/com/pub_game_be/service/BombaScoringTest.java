package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il malus della bomba decresce con le bombe ancora sul tabellone: la prima
 * costa il picco di 500, l'ultima un decimo del picco. La somma dei malus di
 * un round non supera mai 500 × bombe.
 */
class BombaScoringTest {

    @Test
    void ilMalusScendeConLeBombeRimanenti() {
        assertThat(BombaService.bombPenalty(5, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(5, 1)).isEqualTo(400);
        assertThat(BombaService.bombPenalty(5, 2)).isEqualTo(300);
        assertThat(BombaService.bombPenalty(5, 3)).isEqualTo(200);
        assertThat(BombaService.bombPenalty(5, 4)).isEqualTo(100);
    }

    @Test
    void arrotondaAllaDecina() {
        assertThat(BombaService.bombPenalty(3, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(3, 1)).isEqualTo(330);
        assertThat(BombaService.bombPenalty(3, 2)).isEqualTo(170);
    }

    @Test
    void laPrimaBombaValeSempreIlPicco() {
        for (int bombs = 1; bombs <= 8; bombs++) {
            assertThat(BombaService.bombPenalty(bombs, 0)).isEqualTo(500);
        }
    }
}
