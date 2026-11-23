package com.pub_game_be.controller;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.service.QuizService;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * L'esito del voto deve arrivare alla TV con l'opzione scelta: senza
 * `optionIndex` la TV non può accendere la risposta sbagliata in pomodoro.
 */
class QuizControllerTest {

    @Test
    void lEsitoDelVotoArrivaSulTopicConLOpzioneScelta() {
        QuizService quiz = mock(QuizService.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        JSONObject result = new JSONObject()
                .put("roundStartId", "round-1")
                .put("playerName", "Anna")
                .put("manche", 1)
                .put("optionIndex", 2)
                .put("isCorrect", false)
                .put("points", -250)
                .put("answeredAt", 1234L);
        when(quiz.answer(7L, "Anna", 2, 1, "round-1"))
                .thenReturn(new QuizService.Outcome(true, null, result));

        DeviceSessionEntity session = new DeviceSessionEntity();
        session.setPlayerName("Anna");
        session.setRole("REMOTE");

        var response = new QuizController(quiz, messaging).answer(7L, session,
                Map.of("optionIndex", 2, "manche", 1, "roundStartId", "round-1"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
        verify(messaging).convertAndSend(eq("/topic/game/7/status"), sent.capture());
        Map<?, ?> event = (Map<?, ?>) sent.getValue();
        assertThat(event.get("action")).isEqualTo("QUIZ_ANSWER");
        assertThat(event.get("optionIndex")).isEqualTo(2);
        assertThat(event.get("isCorrect")).isEqualTo(false);
        assertThat(event.get("manche")).isEqualTo(1);
        assertThat(event.get("playerName")).isEqualTo("Anna");
    }
}
