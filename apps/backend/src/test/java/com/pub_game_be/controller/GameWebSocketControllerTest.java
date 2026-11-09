package com.pub_game_be.controller;

import com.pub_game_be.config.WebSocketConfig;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import com.pub_game_be.reliability.DeviceSessionService;
import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import java.util.HashMap;
import java.util.Optional;
import static org.mockito.Mockito.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GameWebSocketControllerTest {

    private final GameWebSocketController controller = new GameWebSocketController(
            mock(org.springframework.messaging.simp.SimpMessagingTemplate.class));

    @Test
    void clientsCannotPublishDirectlyToBrokerButCanSubscribe() {
        var sessions = mock(DeviceSessionService.class);
        var identity = new DeviceSessionEntity();
        identity.setGameId(1L);
        identity.setRole("REMOTE");
        identity.setPlayerName("Anna");
        when(sessions.authenticate("token")).thenReturn(Optional.of(identity));
        var interceptor = new WebSocketConfig(sessions, "http://localhost:4200").clientInboundAuthorization();
        var attributes = new HashMap<String, Object>();
        attributes.put("token", "token");
        StompHeaderAccessor sendHeaders = StompHeaderAccessor.create(StompCommand.SEND);
        sendHeaders.setDestination("/topic/game/1/status");
        sendHeaders.setSessionAttributes(attributes);
        Message<byte[]> send = MessageBuilder.createMessage(new byte[0], sendHeaders.getMessageHeaders());
        assertThatThrownBy(() -> interceptor.preSend(send, null)).isInstanceOf(AccessDeniedException.class);

        StompHeaderAccessor subscribeHeaders = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscribeHeaders.setDestination("/topic/game/1/status");
        subscribeHeaders.setSessionAttributes(attributes);
        Message<byte[]> subscribe = MessageBuilder.createMessage(new byte[0], subscribeHeaders.getMessageHeaders());
        assertThat(interceptor.preSend(subscribe, null)).isSameAs(subscribe);

        StompHeaderAccessor appHeaders = StompHeaderAccessor.create(StompCommand.SEND);
        appHeaders.setDestination("/app/game/1/status");
        appHeaders.setSessionAttributes(attributes);
        Message<byte[]> appMessage = MessageBuilder.createMessage(
                "{\"action\":\"JOIN_GAME\",\"playerName\":\"Anna\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8),
                appHeaders.getMessageHeaders());
        assertThat(interceptor.preSend(appMessage, null)).isSameAs(appMessage);
    }

    @Test
    void relaysOnlyAValidChipsDistribution() {
        Map<String, Object> status = Map.of(
                "action", "AZZARDO_ACTION",
                "playerName", " Anna ",
                "kind", "BET",
                "value", Map.of("chips", List.of(2, 0, 1, 0)));

        Map<String, Object> result = controller.updateStatus(1L, status);

        assertThat(result).containsEntry("action", "AZZARDO_ACTION");
        assertThat(result).containsEntry("playerName", "Anna");
        assertThat(result.get("value")).isEqualTo(Map.of("chips", List.of(2, 0, 1, 0)));
    }

    @Test
    void rejectsMoreThanTenChips() {
        Map<String, Object> status = Map.of(
                "action", "AZZARDO_ACTION",
                "playerName", "Anna",
                "kind", "BET",
                "value", Map.of("chips", List.of(6, 5, 0, 0)));

        Map<String, Object> result = controller.updateStatus(1L, status);

        assertThat(result).containsEntry("action", "AZZARDO_REJECTED");
        assertThat(result).containsEntry("reason", "invalid-chips");
    }

    @Test
    void rejectsNegativeOrFractionalChips() {
        assertThat(controller.updateStatus(1L, Map.of(
                "action", "AZZARDO_ACTION",
                "playerName", "Anna",
                "kind", "BET",
                "value", Map.of("chips", List.of(-1, 2)))))
                .containsEntry("action", "AZZARDO_REJECTED");

        assertThat(controller.updateStatus(1L, Map.of(
                "action", "AZZARDO_ACTION",
                "playerName", "Anna",
                "kind", "BET",
                "value", Map.of("chips", List.of(1.5, 2)))))
                .containsEntry("action", "AZZARDO_REJECTED");
    }

    @Test
    void rifiutaEsitiArenaInviatiDaiClient() {
        assertThatThrownBy(() -> controller.updateStatus(1L, Map.of(
                "action", "ARENA_ANSWER", "playerName", "Anna", "isCorrect", true, "points", 9999)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rimuoveSoluzioniAnnidateDalTopicPubblico() {
        Map<String, Object> result = controller.updateStatus(1L, Map.of(
                "action", "QUIZ_STATE", "state", Map.of(
                        "currentManche", Map.of("question", "Q", "correctAnswer", "A"),
                        "summary", List.of(Map.of("correctAnswer", "B")))));
        assertThat(result.toString()).doesNotContain("correctAnswer");
        assertThat(result.toString()).contains("question");
        Map<String, Object> booking = controller.updateStatus(1L, Map.of(
                "action", "PLAYER_PRENOTATO", "name", "Anna", "solution", "Segreto"));
        assertThat(booking).doesNotContainKey("solution");
        Map<String, Object> start = controller.updateStatus(1L, Map.of(
                "action", "START_VOTING", "rawPayload", "{\"correctAnswer\":\"A\"}",
                "payload", "{\"question\":\"Q\",\"correctAnswer\":\"A\"}"));
        assertThat(start).doesNotContainKey("rawPayload");
        assertThat(start.get("payload").toString()).doesNotContain("correctAnswer");
    }

    @Test
    void relaysChristmasToggle() {
        Map<String, Object> result = controller.updateStatus(1L, Map.of(
                "action", "CHRISTMAS_TOGGLE",
                "enabled", true,
                "extra", "ignored"));

        assertThat(result).containsEntry("action", "CHRISTMAS_TOGGLE");
        assertThat(result).containsEntry("enabled", true);
        assertThat(result).doesNotContainKey("extra");
    }
}
