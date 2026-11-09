package com.pub_game_be.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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
        if ("CHRISTMAS_TOGGLE".equals(status.get("action"))) {
            // Il tema è globale: si rilancia solo il flag, non il payload del client.
            Map<String, Object> clean = new LinkedHashMap<>();
            clean.put("action", "CHRISTMAS_TOGGLE");
            clean.put("enabled", Boolean.TRUE.equals(status.get("enabled")));
            return clean;
        }
        if ("AZZARDO_ACTION".equals(status.get("action"))) {
            return sanitizeAzzardo(status);
        }
        return status;
    }

    /**
     * Le fiches sono un massimo di dieci gettoni distribuiti sulle opzioni.
     * Il server controlla il totale: un telefono non può mandare una puntata
     * fuori scala e sperare che la TV la accetti.
     */
    private Map<String, Object> sanitizeAzzardo(Map<String, Object> status) {
        Map<String, Object> rejected = new LinkedHashMap<>();
        rejected.put("action", "AZZARDO_REJECTED");
        rejected.put("playerName", String.valueOf(status.getOrDefault("playerName", "")).trim());
        rejected.put("reason", "invalid-chips");

        String playerName = String.valueOf(status.getOrDefault("playerName", "")).trim();
        if (playerName.isEmpty()) {
            return rejected;
        }
        if (!"BET".equals(String.valueOf(status.getOrDefault("kind", "BET")))) {
            return rejected;
        }

        Object raw = status.get("value");
        if (!(raw instanceof Map<?, ?> value)) {
            return rejected;
        }

        Object rawChips = value.get("chips");
        if (rawChips instanceof List<?> chips) {
            if (chips.size() > 6) {
                return rejected;
            }
            List<Integer> clean = new ArrayList<>();
            int total = 0;
            for (Object chip : chips) {
                if (!(chip instanceof Number number)) {
                    return rejected;
                }
                double valueAsDouble = number.doubleValue();
                int amount = number.intValue();
                if (amount < 0 || amount > 10 || valueAsDouble != amount) {
                    return rejected;
                }
                clean.add(amount);
                total += amount;
            }
            if (total > 10) {
                return rejected;
            }

            Map<String, Object> sanitized = new LinkedHashMap<>();
            sanitized.put("action", "AZZARDO_ACTION");
            sanitized.put("playerName", playerName);
            sanitized.put("kind", "BET");
            sanitized.put("value", Map.of("chips", clean));
            return sanitized;
        }

        // Compatibilità con le puntate singole vecchie (100/200/300 punti).
        Object rawStake = value.get("stake");
        Object rawChoice = value.get("choice");
        if (rawStake instanceof Number stake && rawChoice instanceof Number choice) {
            int amount = stake.intValue();
            int index = choice.intValue();
            if (amount < 0 || amount > 200 || index < 0 || index > 5) {
                return rejected;
            }
            Map<String, Object> sanitized = new LinkedHashMap<>();
            sanitized.put("action", "AZZARDO_ACTION");
            sanitized.put("playerName", playerName);
            sanitized.put("kind", "BET");
            sanitized.put("value", Map.of("stake", amount, "choice", index));
            return sanitized;
        }

        return rejected;
    }
}
