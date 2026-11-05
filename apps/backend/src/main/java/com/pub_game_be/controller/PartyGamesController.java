package com.pub_game_be.controller;

import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
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
    private final QuestionBankService questionBank;
    private final SimpMessagingTemplate messagingTemplate;

    public PartyGamesController(PartyGameService partyGameService, QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate) {
        this.partyGameService = partyGameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
    }

    /** Domande dell'Air Hockey dalla banca, mai scritte nel codice del client. */
    @GetMapping("/{gameId}/air-hockey/questions")
    public List<Map<String, Object>> airHockeyQuestions(@PathVariable("gameId") Long gameId,
            @RequestParam(name = "difficulty", defaultValue = "MIXED") String difficulty,
            @RequestParam(name = "count", defaultValue = "12") int count) {
        return questionBank.quizBatch(difficulty, Math.max(1, Math.min(30, count)));
    }

    /** Domande del Cavallo di Battaglia: difficili, della categoria scelta. */
    @GetMapping("/{gameId}/cavallo/questions")
    public List<Map<String, Object>> cavalloQuestions(@PathVariable("gameId") Long gameId,
            @RequestParam(name = "category", defaultValue = "") String category,
            @RequestParam(name = "count", defaultValue = "8") int count) {
        return questionBank.cavalloQuestions(category, Math.max(1, Math.min(20, count)));
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
        List<Double> estimates = readEstimates(body);
        if (estimates.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Stime mancanti"));
        }

        return partyGameService.submitPrice(gameId, playerName, estimates)
                .<ResponseEntity<Object>>map(submission -> {
                    messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                            .put("action", "PRICE_ANSWER")
                            .put("playerName", submission.playerName())
                            .put("count", submission.estimates().size())
                            .toString());
                    return ResponseEntity.ok(Map.of(
                            "playerName", submission.playerName(),
                            "count", submission.estimates().size()));
                })
                .orElseGet(() -> ResponseEntity.badRequest()
                        .body(Map.of("error", "Round scaduto o stime non valide")));
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

    private List<Double> readEstimates(Map<String, Object> body) {
        List<Double> estimates = new ArrayList<>();
        Object raw = body.get("estimates");
        if (raw instanceof List<?> list) {
            for (Object value : list) {
                try {
                    estimates.add(Double.parseDouble(String.valueOf(value)));
                } catch (NumberFormatException ignored) {
                    return List.of();
                }
            }
            return estimates;
        }

        // Compatibilità con il vecchio invio singolo.
        Object single = body.get("estimate");
        if (single != null) {
            try {
                estimates.add(Double.parseDouble(String.valueOf(single)));
            } catch (NumberFormatException ignored) {
                return List.of();
            }
        }
        return estimates;
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
