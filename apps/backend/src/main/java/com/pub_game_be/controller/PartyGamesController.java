package com.pub_game_be.controller;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.IdempotencyService;
import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Risposte dei telefoni per i giochi simultanei.
 *
 * <p>Il punteggio lo calcola il server; l'esito viene anche trasmesso sul topic
 * di stato così la TV aggiorna la classifica del round senza polling.</p>
 *
 * <p>Le risposte passano da {@link IdempotencyService}: un retry per Wi-Fi
 * instabile non può assegnare due volte lo stesso punteggio, e la trasmissione
 * alla TV avviene solo dopo il commit.</p>
 */
@RestController
@RequestMapping("/games")
public class PartyGamesController {

    private final PartyGameService partyGameService;
    private final QuestionBankService questionBank;
    private final SimpMessagingTemplate messagingTemplate;
    private final GameStateService gameStateService;
    private final IdempotencyService idempotencyService;

    public PartyGamesController(PartyGameService partyGameService, QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate, GameStateService gameStateService,
            IdempotencyService idempotencyService) {
        this.partyGameService = partyGameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
        this.gameStateService = gameStateService;
        this.idempotencyService = idempotencyService;
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
        if (!gameStateService.isRoundOpen(gameId)) {
            return ResponseEntity.status(409).body(closedRound(gameId));
        }

        String idempotencyKey = keyOf(body);
        Map<String, Object> result = idempotencyService.executeOnce(gameId, idempotencyKey,
                "TIMELINE_ANSWER", playerName, () -> partyGameService
                        .submitTimeline(gameId, playerName, order)
                        .map(submission -> {
                            gameStateService.appendEvent(gameId, "TIMELINE_ANSWER", new JSONObject()
                                    .put("playerName", submission.playerName())
                                    .put("score", submission.score())
                                    .put("correctPairs", submission.correctPairs())
                                    .put("totalPairs", submission.totalPairs())
                                    .toString());
                            messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                                    .put("action", "TIMELINE_RESULT")
                                    .put("playerName", submission.playerName())
                                    .put("score", submission.score())
                                    .put("correctPairs", submission.correctPairs())
                                    .put("totalPairs", submission.totalPairs())
                                    .toString());
                            Map<String, Object> ok = new LinkedHashMap<>();
                            ok.put("playerName", submission.playerName());
                            ok.put("correctPairs", submission.correctPairs());
                            ok.put("totalPairs", submission.totalPairs());
                            ok.put("score", submission.score());
                            return ok;
                        })
                        .orElse(null));

        if (result == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Round scaduto o ordine non valido"));
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{gameId}/price-answer")
    public ResponseEntity<Object> priceAnswer(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerName = String.valueOf(body.getOrDefault("playerName", "")).trim();
        List<Double> estimates = readEstimates(body);
        if (estimates.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Stime mancanti"));
        }
        if (!gameStateService.isRoundOpen(gameId)) {
            return ResponseEntity.status(409).body(closedRound(gameId));
        }

        Map<String, Object> result = idempotencyService.executeOnce(gameId, keyOf(body),
                "PRICE_ANSWER", playerName, () -> partyGameService
                        .submitPrice(gameId, playerName, estimates)
                        .map(entry -> {
                            gameStateService.appendEvent(gameId, "PRICE_ANSWER", new JSONObject()
                                    .put("playerName", entry.playerName())
                                    .put("count", entry.estimates().size())
                                    .toString());
                            messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                                    .put("action", "PRICE_ANSWER")
                                    .put("playerName", entry.playerName())
                                    .put("count", entry.estimates().size())
                                    .toString());
                            Map<String, Object> ok = new LinkedHashMap<>();
                            ok.put("playerName", entry.playerName());
                            ok.put("count", entry.estimates().size());
                            return ok;
                        })
                        .orElse(null));

        if (result == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Round scaduto o stime non valide"));
        }
        return ResponseEntity.ok(result);
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

    private Map<String, Object> closedRound(long gameId) {
        return Map.of(
                "error", "round-closed",
                "message", "Il round è scaduto: la risposta non è stata registrata.",
                "deadlineAt", gameStateService.roundDeadline(gameId).orElse(0L));
    }

    private String keyOf(Map<String, Object> body) {
        Object raw = body.get("idempotencyKey");
        return raw == null ? null : String.valueOf(raw);
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
