package com.pub_game_be.controller;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GameWebSocketControllerTest {

    private final GameWebSocketController controller = new GameWebSocketController();

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
