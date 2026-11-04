package com.pub_game_be.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Controller
public class GameWebSocketController {

    /**
     * Campi che la TV riceve da un telefono. Tutto il resto viene scartato:
     * prima il payload veniva rimbalzato com'era, quindi un dispositivo poteva
     * dichiararsi corretto o assegnarsi punti. L'esito vero lo calcola il
     * backend su POST /games/{id}/arena-answer.
     */
    private static final Set<String> RELAYED_FIELDS = Set.of(
            "playerName", "questionId", "answerIndex", "responseTimeMs");

    @MessageMapping("/game/{gameId}/answer")
    @SendTo("/topic/game/{gameId}/responses")
    public Map<String, Object> handleAnswer(@DestinationVariable("gameId") Long gameId, Map<String, Object> payload) {
        Map<String, Object> sanitized = new LinkedHashMap<>();
        for (String field : RELAYED_FIELDS) {
            if (payload.containsKey(field)) {
                sanitized.put(field, payload.get(field));
            }
        }
        sanitized.put("receivedAt", System.currentTimeMillis());
        return sanitized;
    }

    @MessageMapping("/game/{gameId}/status")
    @SendTo("/topic/game/{gameId}/status")
    public Map<String, Object> updateStatus(@DestinationVariable("gameId") Long gameId, Map<String, Object> status) {
        return status;
    }
}
