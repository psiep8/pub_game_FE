package com.pub_game_be.reliability;

import com.pub_game_be.service.SpeedRushService;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La pausa della TV deve fermare il tempo del server, non solo quello a schermo:
 * alla ripresa la deadline viene spostata in avanti di tutta la pausa.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:round-pause;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RoundPauseTest {

    @Autowired
    private GameStateService gameState;

    @Autowired
    private SpeedRushService speedRush;

    @Test
    void laPausaAllungaLaDeadlineDelRound() throws Exception {
        long gameId = 720L;
        gameState.startRound(gameId, "QUIZ", 1, "g720-r1", "{}");
        long before = gameState.roundDeadline(gameId).orElseThrow();

        assertThat(gameState.pauseRound(gameId)).isTrue();
        assertThat(gameState.isRoundPaused(gameId)).isTrue();
        Thread.sleep(60);

        long shifted = gameState.resumeRound(gameId);

        assertThat(shifted).isGreaterThanOrEqualTo(40L);
        assertThat(gameState.isRoundPaused(gameId)).isFalse();
        assertThat(gameState.roundDeadline(gameId).orElseThrow()).isEqualTo(before + shifted);
    }

    @Test
    void speedRushRifiutaLeRisposteInPausaEAllungaLaCorsa() throws Exception {
        long gameId = 721L;
        JSONObject start = speedRush.start(gameId, List.of("Anna"), "pause-1");
        assertThat(start.getBoolean("active")).isTrue();

        assertThat(speedRush.pause(gameId)).isTrue();
        assertThat(speedRush.task(gameId, "Anna")).isEmpty();
        Thread.sleep(60);

        assertThat(speedRush.resume(gameId)).isGreaterThanOrEqualTo(40L);
        assertThat(speedRush.task(gameId, "Anna")).isPresent();
    }
}
