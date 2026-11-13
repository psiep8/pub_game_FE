package com.pub_game_be.reliability;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La finestra di risposta è quella del gioco, non un valore unico per tutti.
 *
 * <p>La tolleranza copre rete, reveal e pausa fra una manche e l'altra; oltre
 * quella il round è chiuso e nessuna risposta viene registrata.</p>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:reliability-window;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RoundWindowTest {

    private static final long TOLERANCE_SECONDS = 30;

    @Autowired
    private GameStateService gameState;

    /** Durata dichiarata del round, come nel gioco. */
    private static Map<String, Long> roundSeconds() {
        Map<String, Long> rounds = new LinkedHashMap<>();
        rounds.put("QUIZ", 3 * (10 + 3L));
        rounds.put("MUSIC", 200L);
        rounds.put("IMAGE_BLUR", 60L);
        rounds.put("WHEEL_OF_FORTUNE", 75L);
        rounds.put("TIMELINE", 45L);
        rounds.put("TIME_BUZZER", 3 * (30 + 5L));
        rounds.put("BOMBA", 105L);
        rounds.put("SPEED_RUSH", 60L);
        rounds.put("AIR_HOCKEY_BATTLE", 300L);
        rounds.put("ARENA", 130L);
        rounds.put("AZZARDO", 4 * (15 + 7L) + 5);
        rounds.put("ULTIMA_SPIAGGIA", 5 * (12 + 15 + 5L));
        return rounds;
    }

    @Test
    void ogniGiocoHaLaFinestraDellaSuaDurata() {
        long gameId = 900L;
        for (Map.Entry<String, Long> round : roundSeconds().entrySet()) {
            gameId++;
            gameState.startRound(gameId, round.getKey(), 0, "g" + gameId + "-r0", "{}");

            long deadline = gameState.roundDeadline(gameId).orElseThrow();
            long windowSeconds = Math.round((deadline - System.currentTimeMillis()) / 1000.0);

            assertThat(windowSeconds)
                    .as("finestra di %s", round.getKey())
                    .isBetween(round.getValue(), round.getValue() + TOLERANCE_SECONDS + 1);
        }
    }

    @Test
    void ilTimeBuzzerRestaApertoPerTutteETreLeManche() {
        gameState.startRound(950L, "TIME_BUZZER", 0, "g950-r0", "{}");

        long deadline = gameState.roundDeadline(950L).orElseThrow();
        long windowSeconds = Math.round((deadline - System.currentTimeMillis()) / 1000.0);

        // Con la vecchia finestra globale di 60 secondi la seconda manche
        // arrivava già a round scaduto.
        assertThat(windowSeconds).isGreaterThanOrEqualTo(3 * 30);
    }
}
