package com.pub_game_be.controller;

import com.pub_game_be.service.PartyGameService;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Risposte dei telefoni per i giochi simultanei.
 *
 * Il punteggio lo calcola il server; l'esito viene anche trasmesso sul topic
 * di stato così la TV aggiorna la classifica del round senza polling.
 */
@RestController
@RequestMapping("/games")
public class PartyGamesController {

    private final PartyGameService partyGameService;
    private final SimpMessagingTemplate messagingTemplate;

    public PartyGamesController(PartyGameService partyGameService, SimpMessagingTemplate messagingTemplate) {
        this.partyGameService = partyGameService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/{gameId}/timeline-answer")
    public ResponseEntity<Object> timelineAnswer(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerName = String.valueOf(body.getOrDefault("playerName", "")).trim();
        List<Integer> order = readOrder(body.get("order"));
        if (order.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ordine mancante"));
        }

        return partyGameService.submitTimeline(gameId, playerName, order)
                .<ResponseEntity<Object>>map(submission -> {
                    messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                            .put("action", "TIMELINE_RESULT")
                            .put("playerName", submission.playerName())
                            .put("score", submission.score())
                            .put("correctPairs", submission.correctPairs())
                            .put("totalPairs", submission.totalPairs())
                            .toString());
                    return ResponseEntity.ok(Map.of(
                            "correctPairs", submission.correctPairs(),
                            "totalPairs", submission.totalPairs(),
                            "score", submission.score()));
                })
                .orElseGet(() -> ResponseEntity.badRequest()
                        .body(Map.of("error", "Round scaduto o ordine non valido")));
    }

    @PostMapping("/{gameId}/price-answer")
    public ResponseEntity<Object> priceAnswer(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerName = String.valueOf(body.getOrDefault("playerName", "")).trim();
        double estimate;
        try {
            estimate = Double.parseDouble(String.valueOf(body.getOrDefault("estimate", "0")));
        } catch (NumberFormatException error) {
            return ResponseEntity.badRequest().body(Map.of("error", "Stima non numerica"));
        }

        return partyGameService.submitPrice(gameId, playerName, estimate)
                .<ResponseEntity<Object>>map(submission -> {
                    messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                            .put("action", "PRICE_ANSWER")
                            .put("playerName", submission.playerName())
                            .put("estimate", submission.estimate())
                            .toString());
                    return ResponseEntity.ok(Map.of("playerName", submission.playerName()));
                })
                .orElseGet(() -> ResponseEntity.badRequest()
                        .body(Map.of("error", "Round scaduto o stima non valida")));
    }

    /** Soluzione del round: solo la TV la chiede, al momento del reveal. */
    @GetMapping("/{gameId}/timeline/reveal")
    public String timelineReveal(@PathVariable("gameId") Long gameId) {
        return partyGameService.timelineReveal(gameId).toString();
    }

    @GetMapping("/{gameId}/price/reveal")
    public String priceReveal(@PathVariable("gameId") Long gameId) {
        return partyGameService.priceReveal(gameId).toString();
    }

    /** Azzera i due giochi (nuova partita o reset dalla TV). */
    @PostMapping("/{gameId}/party/reset")
    public Map<String, Object> reset(@PathVariable("gameId") Long gameId) {
        partyGameService.forget(gameId);
        return Map.of("reset", true, "gameId", gameId);
    }

    private List<Integer> readOrder(Object raw) {
        List<Integer> order = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object value : list) {
                if (value instanceof Number number) {
                    order.add(number.intValue());
                } else {
                    try {
                        order.add(Integer.parseInt(String.valueOf(value)));
                    } catch (NumberFormatException ignored) {
                        return List.of();
                    }
                }
            }
        }
        return order;
    }
}
