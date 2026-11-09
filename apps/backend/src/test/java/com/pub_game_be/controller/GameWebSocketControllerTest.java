package com.pub_game_be.controller;

import com.pub_game_be.config.WebSocketConfig;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GameWebSocketControllerTest {

    private final GameWebSocketController controller = new GameWebSocketController();

    @Test
    void clientsCannotPublishDirectlyToBrokerButCanSubscribe() {
        var interceptor = new WebSocketConfig().clientInboundAuthorization();
        SimpMessageHeaderAccessor sendHeaders = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        sendHeaders.setDestination("/topic/game/1/status");
        Message<byte[]> send = MessageBuilder.createMessage(new byte[0], sendHeaders.getMessageHeaders());
        assertThatThrownBy(() -> interceptor.preSend(send, null)).isInstanceOf(AccessDeniedException.class);

        SimpMessageHeaderAccessor subscribeHeaders = SimpMessageHeaderAccessor.create(SimpMessageType.SUBSCRIBE);
        subscribeHeaders.setDestination("/topic/game/1/status");
        Message<byte[]> subscribe = MessageBuilder.createMessage(new byte[0], subscribeHeaders.getMessageHeaders());
        assertThat(interceptor.preSend(subscribe, null)).isSameAs(subscribe);

        SimpMessageHeaderAccessor appHeaders = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        appHeaders.setDestination("/app/game/1/status");
        Message<byte[]> appMessage = MessageBuilder.createMessage(new byte[0], appHeaders.getMessageHeaders());
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
