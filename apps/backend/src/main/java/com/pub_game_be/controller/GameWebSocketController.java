package com.pub_game_be.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import com.pub_game_be.reliability.GameStateService;
import org.json.JSONObject;
import org.json.JSONArray;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Controller
public class GameWebSocketController {

    private final SimpMessagingTemplate messaging;
    private final GameStateService gameStateService;

    public GameWebSocketController(SimpMessagingTemplate messaging, GameStateService gameStateService) {
        this.messaging = messaging;
        this.gameStateService = gameStateService;
    }

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
        // Gli esiti Arena sono prodotti solo dal controller REST, non dai client.
        if ("ARENA_ANSWER".equals(status.get("action"))) {
            throw new AccessDeniedException("Risultato Arena riservato al server");
        }
        // Prenotazione dopo la scadenza: non si rilancia alla TV. Ai telefoni
        // arriva il round chiuso, così il pulsante sparisce anche se il client
        // era rimasto su una schermata vecchia.
        if ("PLAYER_PRENOTATO".equals(status.get("action")) && !gameStateService.isRoundOpen(gameId)) {
            Map<String, Object> closed = new LinkedHashMap<>();
            closed.put("action", "ROUND_ENDED");
            closed.put("reason", "round-closed");
            messaging.convertAndSend("/topic/game/" + gameId + "/status", (Object) closed);
            return null;
        }
        if ("ADMIN_STATE".equals(status.get("action"))) {
            messaging.convertAndSend("/topic/game/" + gameId + "/admin", (Object) status);
            return null;
        }
        if (Set.of("PLAYER_PRENOTATO", "SHOW_QUESTION", "START_VOTING").contains(status.get("action"))) {
            messaging.convertAndSend("/topic/game/" + gameId + "/admin", (Object) status);
        }
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
        return cleanStatus(status);
    }

    /** Rimuove le soluzioni anche dagli oggetti annidati o serializzati in JSON. */
    private Map<String, Object> cleanStatus(Map<String, Object> status) {
        JSONObject clean = (JSONObject) cleanValue(new JSONObject(status), false);
        return clean.toMap();
    }

    private Object cleanValue(Object value, boolean music) {
        if (value instanceof String text && (text.stripLeading().startsWith("{") || text.stripLeading().startsWith("["))) {
            try {
                Object parsed = text.stripLeading().startsWith("{") ? new JSONObject(text) : new JSONArray(text);
                return cleanValue(parsed, music).toString();
            } catch (org.json.JSONException ignored) { return text; }
        }
        if (value instanceof JSONObject object) {
            boolean musicPayload = music || "MUSIC".equals(object.optString("type"))
                    || "MUSIC_PHASE".equals(object.optString("action"));
            JSONObject clean = new JSONObject();
            for (String key : object.keySet()) {
                if (!Set.of("correctAnswer", "correctIndex", "explanation", "explain", "solution", "rawPayload", "proverb").contains(key)
                        && !(musicPayload && Set.of("songTitle", "artist", "previewUrl", "albumCover", "year").contains(key)))
                    clean.put(key, cleanValue(object.opt(key), musicPayload));
            }
            return clean;
        }
        if (value instanceof JSONArray array) {
            JSONArray clean = new JSONArray();
            for (Object element : array) clean.put(cleanValue(element, music));
            return clean;
        }
        return value == null ? JSONObject.NULL : value;
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
            // Puntata obbligatoria: un tavolo vuoto non è una puntata e la
            // manche non deve partire con zero fiches.
            if (total > 10 || total == 0) {
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
