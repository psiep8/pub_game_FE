package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Gli stessi esempi della specifica, sulla funzione del server. */
class RankPointsTest {

    private List<Integer> table(int n, int w, int l) {
        List<Integer> points = new ArrayList<>();
        for (int rank = 1; rank <= n; rank++) {
            points.add(RankPoints.points(rank, n, w, l));
        }
        return points;
    }

    @Test
    void riproduceGliEsempiSpeedRush() {
        assertThat(table(4, 800, -400)).containsExactly(800, 400, -200, -400);
        assertThat(table(5, 800, -400)).containsExactly(800, 400, 0, -200, -400);
        assertThat(table(6, 800, -400)).containsExactly(800, 530, 270, -130, -270, -400);
        assertThat(table(8, 800, -400)).containsExactly(800, 600, 400, 200, -100, -200, -300, -400);
        assertThat(table(9, 800, -400)).containsExactly(800, 600, 400, 200, 0, -100, -200, -300, -400);
        assertThat(table(10, 800, -400))
                .containsExactly(800, 640, 480, 320, 160, -80, -160, -240, -320, -400);
    }

    @Test
    void riproduceGliEsempiBiglie() {
        assertThat(table(4, 500, -400)).containsExactly(500, 250, -200, -400);
    }

    @Test
    void fuoriClassificaNonPaga() {
        assertThat(RankPoints.points(0, 6, 800, -400)).isZero();
        assertThat(RankPoints.points(7, 6, 800, -400)).isZero();
        assertThat(RankPoints.points(1, 1, 800, -400)).isZero();
    }
}
