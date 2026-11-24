package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il malus è −round10(500 × bombe rimaste / bombe iniziali): parte dal picco di
 * 500 con la prima bomba e scende man mano che il tabellone si svuota. Nessun
 * bonus: il round è solo a malus.
 */
class BombaScoringTest {

    @Test
    void ilMalusScendeConLeBombeRimaste() {
        assertThat(BombaService.bombPenalty(4, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(4, 1)).isEqualTo(380);
        assertThat(BombaService.bombPenalty(4, 2)).isEqualTo(250);
        assertThat(BombaService.bombPenalty(4, 3)).isEqualTo(130);
    }

    @Test
    void ilNumeroDiBombeCambiaLaScala() {
        assertThat(BombaService.bombPenalty(5, 0)).isEqualTo(500);
        assertThat(BombaService.bombPenalty(5, 1)).isEqualTo(400);
        assertThat(BombaService.bombPenalty(5, 2)).isEqualTo(300);
        assertThat(BombaService.bombPenalty(5, 3)).isEqualTo(200);
        assertThat(BombaService.bombPenalty(5, 4)).isEqualTo(100);
    }

    @Test
    void laPrimaBombaValeSempreIlPicco() {
        for (int bombs = 1; bombs <= 8; bombs++) {
            assertThat(BombaService.bombPenalty(bombs, 0)).isEqualTo(500);
        }
    }

    @Test
    void ilMalusNonScendeMaiSottoIlDecimoDelPicco() {
        assertThat(BombaService.bombPenalty(10, 9)).isEqualTo(50);
        assertThat(BombaService.bombPenalty(10, 12)).isEqualTo(50);
    }
}
