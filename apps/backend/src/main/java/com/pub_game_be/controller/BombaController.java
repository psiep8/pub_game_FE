package com.pub_game_be.controller;

import com.pub_game_be.service.BombaService;
import org.json.JSONObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bomba: la TV avvia e legge lo stato, i telefoni rispondono e scelgono il
 * prossimo tavolo. La soluzione delle domande non lascia mai il server.
 */
@RestController
@RequestMapping("/games")
public class BombaController {

    private final BombaService bombaService;

    public BombaController(BombaService bombaService) {
        this.bombaService = bombaService;
    }

    @PostMapping("/{gameId}/bomba/start")
    public ResponseEntity<String> start(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        try {
            List<String> players = readPlayers(body.get("players"));
            int act = readInt(body.get("act"), 1);
            return json(bombaService.start(gameId, players, act));
        } catch (IllegalArgumentException error) {
            return error(error.getMessage());
        }
    }

    @GetMapping("/{gameId}/bomba/state")
    public ResponseEntity<String> state(@PathVariable("gameId") Long gameId,
            @RequestParam(value = "player", required = false) String player) {
        return json(bombaService.state(gameId, player));
    }

    @PostMapping("/{gameId}/bomba/answer")
    public ResponseEntity<String> answer(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        try {
            String player = readString(body.get("playerName"));
            int bombId = readInt(body.get("bombId"), -1);
            int answerIndex = readInt(body.get("answerIndex"), -1);
            return json(bombaService.answer(gameId, player, bombId, answerIndex));
        } catch (IllegalArgumentException error) {
            return error(error.getMessage());
        }
    }

    @PostMapping("/{gameId}/bomba/pass")
    public ResponseEntity<String> pass(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        try {
            String player = readString(body.get("playerName"));
            int bombId = readInt(body.get("bombId"), -1);
            String target = readString(body.get("target"));
            return json(bombaService.pass(gameId, player, bombId, target));
        } catch (IllegalArgumentException error) {
            return error(error.getMessage());
        }
    }

    @PostMapping("/{gameId}/bomba/pause")
    public ResponseEntity<String> pause(@PathVariable("gameId") Long gameId) {
        try {
            return json(bombaService.pause(gameId));
        } catch (IllegalArgumentException error) {
            return error(error.getMessage());
        }
    }

    @PostMapping("/{gameId}/bomba/resume")
    public ResponseEntity<String> resume(@PathVariable("gameId") Long gameId) {
        try {
            return json(bombaService.resume(gameId));
        } catch (IllegalArgumentException error) {
            return error(error.getMessage());
        }
    }

    @PostMapping("/{gameId}/bomba/reset")
    public Map<String, Object> reset(@PathVariable("gameId") Long gameId) {
        bombaService.reset(gameId);
        return Map.of("reset", true, "gameId", gameId);
    }

    private List<String> readPlayers(Object raw) {
        List<String> players = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object value : list) {
                players.add(String.valueOf(value));
            }
        }
        return players;
    }

    private int readInt(Object raw, int fallback) {
        if (raw instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String readString(Object raw) {
        return raw == null ? "" : String.valueOf(raw);
    }

    private ResponseEntity<String> json(JSONObject payload) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload.toString());
    }

    private ResponseEntity<String> error(String message) {
        return ResponseEntity.badRequest()
                .contentType(MediaType.APPLICATION_JSON)
                .body(new JSONObject().put("error", message).toString());
    }
}
