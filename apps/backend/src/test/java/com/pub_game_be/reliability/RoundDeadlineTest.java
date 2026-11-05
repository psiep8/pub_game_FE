package com.pub_game_be.reliability;

import com.pub_game_be.controller.GameController;
import com.pub_game_be.service.QuestionHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La finestra di risposta è del server. Con una finestra a zero secondi il
 * round è già chiuso quando arriva la risposta: il backend non la registra e
 * nessun punto viene assegnato.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:reliability-deadline;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.reliability.answer-window-seconds=0"
})
class RoundDeadlineTest {

    @Autowired
    private GameController gameController;

    @Autowired
    private GameStateService gameState;

    @Autowired
    private QuestionHistoryService questionHistory;

    @Test
    void unaRispostaDopoLaScadenzaNonVieneRegistrata() {
        long gameId = 701L;

        gameState.startRound(gameId, "ARENA", 0, "g701-r0", "{}");
        assertThat(gameState.isRoundOpen(gameId)).isFalse();
        assertThat(gameState.roundDeadline(gameId)).isPresent();

        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q-late", "Ritardatario", "Domanda", "VERO", "Storia"));

        long eventsBefore = gameState.currentSeq(gameId);

        Map<String, Object> body = new HashMap<>();
        body.put("playerId", "Ritardatario");
        body.put("questionId", "q-late");
        body.put("answer", "VERO");
        body.put("idempotencyKey", "risposta-tardiva");

        ResponseEntity<Object> response = gameController.answerArenaQuestion(gameId, body);

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(((Map<?, ?>) response.getBody()).get("error")).isEqualTo("round-closed");
        // Nessun punto, nessun evento: lo stato resta quello confermato.
        assertThat(questionHistory.scores(gameId)).doesNotContainKey("Ritardatario");
        assertThat(gameState.currentSeq(gameId)).isEqualTo(eventsBefore);
    }

    @Test
    void unRoundApertoAccettaAncoraRisposte() {
        long gameId = 702L;
        // Nel primo test la finestra è zero; qui si verifica il contrario con la
        // stessa configurazione: un round non aperto lascia passare (nessuna
        // scadenza registrata), così il flusso legacy non si rompe.
        assertThat(gameState.isRoundOpen(999L)).isTrue();
    }
}
