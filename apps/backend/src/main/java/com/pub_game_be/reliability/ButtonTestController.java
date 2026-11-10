package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Prova dei pulsanti.
 *
 * <p>TV e admin leggono lo snapshot; il telefono può solo registrare i propri
 * passi, usando il nome della sessione autenticata. Avvio, reset, salto e fine
 * sono comandi di regia.</p>
 */
@RestController
@RequestMapping("/games/{gameId}/button-test")
public class ButtonTestController {

    private final ButtonTestService tests;
    private final DeviceSessionService sessions;

    public ButtonTestController(ButtonTestService tests, DeviceSessionService sessions) {
        this.tests = tests;
        this.sessions = sessions;
    }

    /** Stato per la TV: nessun dato sensibile, solo nomi e avanzamento. */
    @GetMapping
    public Map<String, Object> snapshot(@PathVariable("gameId") Long gameId) {
        return JsonSupport.toMap(tests.snapshot(gameId, presentPlayers(gameId)));
    }

    /** Vista privata del telefono, ripresa dopo un reload. */
    @GetMapping("/me")
    public Map<String, Object> me(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        DeviceSessionEntity session = require(gameId, token, "REMOTE");
        return JsonSupport.toMap(tests.team(gameId, session.getPlayerName()));
    }

    /** Solo il telefono autenticato registra i propri passi. */
    @PostMapping("/step")
    public Map<String, Object> step(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token,
            @RequestBody(required = false) Map<String, Object> body) {
        DeviceSessionEntity session = require(gameId, token, "REMOTE");
        Map<String, Object> payload = body == null ? Map.of() : body;
        JSONObject result = tests.recordStep(gameId, session.getPlayerName(),
                (int) number(payload.get("step"), 0), Boolean.TRUE.equals(payload.get("vibrated")),
                number(payload.get("latencyMs"), -1), Boolean.TRUE.equals(payload.get("flagged")));
        return JsonSupport.toMap(result);
    }

    /** Andata e ritorno del segnale: il telefono misura il ritardo. */
    @PostMapping("/ping")
    public Map<String, Object> ping(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token,
            @RequestBody(required = false) Map<String, Object> body) {
        require(gameId, token, "REMOTE");
        return Map.of(
                "serverTime", System.currentTimeMillis(),
                "clientAt", number(body == null ? null : body.get("clientAt"), -1));
    }

    @PostMapping("/start")
    public Map<String, Object> start(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        require(gameId, token, "ADMIN");
        return JsonSupport.toMap(tests.start(gameId, presentPlayers(gameId)));
    }

    @PostMapping("/reset")
    public Map<String, Object> reset(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token,
            @RequestBody(required = false) Map<String, Object> body) {
        require(gameId, token, "ADMIN");
        String playerName = String.valueOf(body == null ? "" : body.getOrDefault("playerName", "")).trim();
        if (playerName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Squadra richiesta");
        }
        return JsonSupport.toMap(tests.resetTeam(gameId, playerName));
    }

    @PostMapping("/skip")
    public Map<String, Object> skip(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        require(gameId, token, "ADMIN");
        return JsonSupport.toMap(tests.skipAll(gameId, presentPlayers(gameId)));
    }

    @PostMapping("/finish")
    public Map<String, Object> finish(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        require(gameId, token, "ADMIN");
        return JsonSupport.toMap(tests.finish(gameId));
    }

    private DeviceSessionEntity require(Long gameId, String token, String role) {
        Optional<DeviceSessionEntity> found = sessions.authenticate(token)
                .filter(session -> gameId.equals(session.getGameId()))
                .filter(session -> role.equals(session.getRole()));
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sessione non autorizzata");
        }
        return found.get();
    }

    private List<String> presentPlayers(Long gameId) {
        JSONArray presence = sessions.presence(gameId);
        List<String> names = new ArrayList<>();
        for (int i = 0; i < presence.length(); i++) {
            JSONObject device = presence.optJSONObject(i);
            if (device == null || !"REMOTE".equals(device.optString("role"))) continue;
            String name = device.optString("playerName", "").trim();
            if (!name.isEmpty() && !names.contains(name)) names.add(name);
        }
        return names;
    }

    private long number(Object value, long fallback) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? fallback : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException error) {
            return fallback;
        }
    }

    @ExceptionHandler(ButtonTestService.BadButtonTestRequest.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> badRequest(ButtonTestService.BadButtonTestRequest error) {
        return Map.of("ok", false, "message", error.getMessage());
    }
}
