package com.pub_game_be.reliability;

import com.pub_game_be.controller.GameController;
import com.pub_game_be.repository.GameRoundRepository;
import com.pub_game_be.service.QuestionHistoryService;
import com.pub_game_be.reliability.repository.GameEventRepository;
import com.pub_game_be.reliability.repository.GameStateRepository;
import com.pub_game_be.service.SpeedRushService;
import jakarta.persistence.EntityManager;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Map;

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

    @Autowired
    private GameController gameController;

    @Autowired
    private QuestionHistoryService questionHistory;

    @Autowired
    private GameStateRepository stateRepository;

    @Autowired
    private GameEventRepository eventRepository;

    @Autowired
    private GameRoundRepository roundRepository;

    @Autowired
    private ReliabilityProperties properties;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private StateBlobService stateBlobs;

    private GameStateService restartedService() {
        return new GameStateService(stateRepository, eventRepository, roundRepository, properties,
                transactionManager, entityManager, stateBlobs);
    }

    @Test
    void laPausaAllungaLaDeadlineDelRound() throws Exception {
        long gameId = 720L;
        gameState.startRound(gameId, "QUIZ", 1, "g720-r1", "{}");
        long before = gameState.roundDeadline(gameId).orElseThrow();

        assertThat(gameState.pauseRound(gameId)).isTrue();
        assertThat(gameState.isRoundPaused(gameId)).isTrue();
        // Un telefono che si riaggiorna durante la pausa deve ritrovarla.
        JSONObject pausedSnapshot = gameState.snapshot(gameId);
        assertThat(pausedSnapshot.getBoolean("paused")).isTrue();
        assertThat(pausedSnapshot.getLong("pausedAt")).isPositive();
        Thread.sleep(60);

        long shifted = gameState.resumeRound(gameId);

        assertThat(shifted).isGreaterThanOrEqualTo(40L);
        assertThat(gameState.isRoundPaused(gameId)).isFalse();
        JSONObject resumedSnapshot = gameState.snapshot(gameId);
        assertThat(resumedSnapshot.getBoolean("paused")).isFalse();
        assertThat(resumedSnapshot.isNull("pausedAt")).isTrue();
        assertThat(gameState.roundDeadline(gameId).orElseThrow()).isEqualTo(before + shifted);
    }

    @Test
    void laPausaSopravviveAlRiavvioDelServer() throws Exception {
        long gameId = 730L;
        gameState.startRound(gameId, "QUIZ", 1, "g730-r1", "{}");
        long before = gameState.roundDeadline(gameId).orElseThrow();
        assertThat(gameState.pauseRound(gameId)).isTrue();
        Thread.sleep(60);

        // Nuova istanza sullo stesso database: è ciò che vede la TV dopo un
        // riavvio del processo. La pausa e il suo istante devono tornare.
        GameStateService restarted = restartedService();
        assertThat(restarted.isRoundPaused(gameId)).isTrue();
        JSONObject pausedSnapshot = restarted.snapshot(gameId);
        assertThat(pausedSnapshot.getBoolean("paused")).isTrue();
        assertThat(pausedSnapshot.getLong("pausedAt")).isPositive();

        long shifted = restarted.resumeRound(gameId);

        assertThat(shifted).isGreaterThanOrEqualTo(40L);
        assertThat(restarted.isRoundPaused(gameId)).isFalse();
        assertThat(restarted.roundDeadline(gameId).orElseThrow()).isEqualTo(before + shifted);
        assertThat(stateBlobs.load(gameId, GameStateService.ROUND_PAUSE_BLOB)).isEmpty();
    }

    @Test
    void arenaNonAssegnaDomandeONuoviPuntiDuranteLaPausa() {
        long gameId = 731L;
        gameState.startRound(gameId, "ARENA", 1, "g731-r1", "{}");
        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q-pause", "Anna", "Domanda", "VERO", "Storia"));
        Map<String, Object> answer = Map.of("playerId", "Anna", "questionId", "q-pause",
                "answer", "VERO", "idempotencyKey", "q-pause-key");
        assertThat(gameState.pauseRound(gameId)).isTrue();
        long seq = gameState.currentSeq(gameId);

        var question = gameController.getArenaQuestion(gameId, "Storia", "Anna");
        assertThat(question.getStatusCode().value()).isEqualTo(409);
        assertThat(new JSONObject(question.getBody()).getString("error")).isEqualTo("round-paused");
        var paused = gameController.answerArenaQuestion(gameId, answer);
        assertThat(paused.getStatusCode().value()).isEqualTo(409);
        assertThat(((Map<?, ?>) paused.getBody()).get("error")).isEqualTo("round-paused");
        assertThat(questionHistory.scores(gameId)).doesNotContainKey("Anna");
        assertThat(gameState.currentSeq(gameId)).isEqualTo(seq);

        gameState.resumeRound(gameId);
        assertThat(gameController.answerArenaQuestion(gameId, answer).getStatusCode().value()).isEqualTo(200);
        assertThat(questionHistory.scores(gameId)).containsEntry("Anna", 10);
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
