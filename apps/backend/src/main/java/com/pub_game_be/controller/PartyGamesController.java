package com.pub_game_be.controller;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.IdempotencyService;
import com.pub_game_be.reliability.StateBlobService;
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

    /** Scarto di orologio tollerato rispetto al tempo misurato dal telefono. */
    private static final long CLOCK_TOLERANCE_MS = 250;
    /** Ritardo di rete massimo accettato tra il via e la ricezione.
     * Il telefono misura dalla ricezione, quindi il suo tempo può essere più
     * corto di quello del server ma non più lungo. */
    private static final long MAX_NETWORK_DELAY_MS = 5000;

    private final PartyGameService partyGameService;
    private final QuestionBankService questionBank;
    private final SimpMessagingTemplate messagingTemplate;
    private final GameStateService gameStateService;
    private final IdempotencyService idempotencyService;

    private static final String BUZZER_BLOB = "time-buzzer-start";
    private final StateBlobService stateBlobs;

    public PartyGamesController(PartyGameService partyGameService, QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate, GameStateService gameStateService,
            IdempotencyService idempotencyService, StateBlobService stateBlobs) {
        this.partyGameService = partyGameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
        this.gameStateService = gameStateService;
        this.idempotencyService = idempotencyService;
        this.stateBlobs = stateBlobs;
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

    /** Soluzione del round: solo la TV la chiede, al momento del reveal. */
    @GetMapping("/{gameId}/timeline/reveal")
    public String timelineReveal(@PathVariable("gameId") Long gameId) {
        return partyGameService.timelineReveal(gameId).toString();
    }

    /**
     * Time Buzzer: il via lo dà il server, non la TV.
     *
     * <p>La TV chiama questo endpoint dopo il 3-2-1; il topic di stato porta
     * {@code TIME_BUZZER_START} a tutti i telefoni, che da quel momento misurano
     * il proprio tempo. L'istante salvato qui è il metro per validarli.</p>
     */
    @PostMapping("/{gameId}/time-buzzer/start")
    public Map<String, Object> timeBuzzerStart(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        int manche = 1;
        if (body != null && body.get("manche") instanceof Number number) {
            manche = Math.max(1, number.intValue());
        }

        long startedAt = System.currentTimeMillis();
        String roundKey = gameStateService.snapshot(gameId).optString("roundKey", "");
        stateBlobs.save(gameId, BUZZER_BLOB, new JSONObject()
                .put("startedAt", startedAt).put("manche", manche).put("roundKey", roundKey).toString());

        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                .put("action", "TIME_BUZZER_START")
                .put("startedAt", startedAt)
                .put("manche", manche)
                .toString());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startedAt", startedAt);
        result.put("manche", manche);
        return result;
    }

    /**
     * Time Buzzer: il telefono manda i millisecondi misurati con
     * {@code performance.now()} dalla ricezione del via.
     *
     * <p>Il server li confronta con il tempo davvero trascorso: un telefono con
     * il timer manomesso (o una risposta di una manche precedente) non passa e
     * alla TV arrivano solo i tempi plausibili.</p>
     */
    @PostMapping("/{gameId}/time-buzzer/stop")
    public ResponseEntity<Object> timeBuzzerStop(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerName = String.valueOf(body.getOrDefault("playerName", "")).trim();
        if (playerName.isEmpty() || "null".equals(playerName)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Giocatore mancante"));
        }

        JSONObject start = stateBlobs.load(gameId, BUZZER_BLOB).map(JSONObject::new).orElse(null);
        String roundKey = gameStateService.snapshot(gameId).optString("roundKey", "");
        if (start == null || !roundKey.equals(start.optString("roundKey", ""))
                || !gameStateService.isRoundOpen(gameId)) {
            return ResponseEntity.status(409).body(Map.of("error", "time-buzzer-not-started"));
        }

        long elapsed = System.currentTimeMillis() - start.getLong("startedAt");
        double clientMs = readDouble(body.get("ms"));

        boolean plausible = clientMs > 0
                && clientMs <= elapsed + CLOCK_TOLERANCE_MS
                && elapsed - clientMs <= MAX_NETWORK_DELAY_MS;
        if (!plausible) {
            Map<String, Object> rejected = new LinkedHashMap<>();
            rejected.put("error", "tempo-non-plausibile");
            rejected.put("clientMs", Math.round(clientMs));
            rejected.put("serverElapsedMs", elapsed);
            return ResponseEntity.unprocessableEntity().body(rejected);
        }

        long ms = Math.round(clientMs);
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                .put("action", "TIME_BUZZER_ANSWER")
                .put("playerName", playerName)
                .put("ms", ms)
                .put("serverElapsedMs", elapsed)
                .put("manche", start.getInt("manche"))
                .toString());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accepted", true);
        result.put("ms", ms);
        result.put("serverElapsedMs", elapsed);
        result.put("manche", start.getInt("manche"));
        return ResponseEntity.ok(result);
    }

    /** Azzera i due giochi (nuova partita o reset dalla TV). */
    @PostMapping("/{gameId}/party/reset")
    public Map<String, Object> reset(@PathVariable("gameId") Long gameId) {
        partyGameService.forget(gameId);
        stateBlobs.forget(gameId, BUZZER_BLOB);
        return Map.of("reset", true, "gameId", gameId);
    }

    private double readDouble(Object raw) {
        if (raw instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (NumberFormatException ignored) {
            return -1;
        }
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
