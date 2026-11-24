package com.pub_game_be.reliability;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il seme delle entrate a sorpresa è un dato della partita: stabile fra due TV
 * e due refresh, diverso da una serata all'altra. Non è casuale a ogni chiamata,
 * altrimenti la scena cambierebbe sotto i piedi a chi ricarica.
 */
class BonusEntranceSeedTest {

    @Test
    void loStessoGiocoDaSempreLoStessoSeme() {
        assertThat(ReliabilityController.bonusSeed(42)).isEqualTo(ReliabilityController.bonusSeed(42));
        assertThat(ReliabilityController.bonusSeed(1)).isEqualTo(ReliabilityController.bonusSeed(1));
    }

    @Test
    void ilSemeRestaNelDominioPositivo() {
        for (long gameId : new long[] {0, 1, 7, 1_000, Long.MAX_VALUE - 1, Long.MIN_VALUE + 1}) {
            long seed = ReliabilityController.bonusSeed(gameId);
            assertThat(seed).isGreaterThanOrEqualTo(0);
            assertThat(seed).isLessThan(2_147_483_647L);
        }
    }

    @Test
    void partiteDiverseNonCondividonoIlSeme() {
        Set<Long> seeds = new HashSet<>();
        for (long gameId = 1; gameId <= 200; gameId++) {
            seeds.add(ReliabilityController.bonusSeed(gameId));
        }
        // Duecento serate devono dare semi distinti: una collisione qui
        // ripeterebbe la stessa scena in due partite consecutive.
        assertThat(seeds).hasSize(200);
    }
}
