package com.pub_game_be.controller;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.IdempotencyService;
import com.pub_game_be.reliability.JsonSupport;
import com.pub_game_be.reliability.StateBlobService;
import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.service.BasketService;
import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
import com.pub_game_be.service.SpeedRushService;
import org.json.JSONArray;
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
    private final SpeedRushService speedRushService;
    private final BasketService basketService;

    private static final String BUZZER_BLOB = "time-buzzer-start";
    /** Ripiego se il payload del round non dichiara la durata della manche. */
    private static final long TIME_BUZZER_FALLBACK_WINDOW_MS = 45_000;
    private final StateBlobService stateBlobs;

    public PartyGamesController(PartyGameService partyGameService, QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate, GameStateService gameStateService,
            IdempotencyService idempotencyService, StateBlobService stateBlobs,
            SpeedRushService speedRushService, BasketService basketService) {
        this.partyGameService = partyGameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
        this.gameStateService = gameStateService;
        this.idempotencyService = idempotencyService;
        this.stateBlobs = stateBlobs;
        this.speedRushService = speedRushService;
        this.basketService = basketService;
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
        String roundId = body.get("roundId") instanceof String id ? id : "";
        if (roundId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Round Timeline mancante"));
        }
        List<Integer> order = readOrder(body.get("order"));
        if (order.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ordine mancante"));
        }
        if (!gameStateService.isRoundOpen(gameId)) {
            return ResponseEntity.status(409).body(closedRound(gameId));
        }

        if (!gameStateService.isActiveRoundType(gameId, "TIMELINE") || !partyGameService.isTimelineRound(gameId, roundId)) {
            return ResponseEntity.status(409).body(Map.of("error", "Round Timeline non più attivo"));
        }

        // La ricevuta è vincolata al round: non riusare una conferma precedente.
        String idempotencyKey = keyOf(body);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) idempotencyKey = roundId + ":" + idempotencyKey;
        Map<String, Object> result = idempotencyService.executeOnce(gameId, idempotencyKey,
                "TIMELINE_ANSWER", playerName, () -> {
                    // Una risposta per round e giocatore: il primo invio
                    // prenota la riga in modo atomico; le correzioni aggiornano
                    // l'ordine ma non aggiungono un secondo evento.
                    return partyGameService
                        .submitTimelineDecision(gameId, roundId, playerName, order)
                        .map(decision -> {
                            var submission = decision.submission();
                            if (decision.firstAnswer()) {
                                gameStateService.appendEvent(gameId, "TIMELINE_ANSWER", new JSONObject()
                                        .put("playerName", submission.playerName())
                                        .put("score", submission.score())
                                        .put("correctPairs", submission.correctPairs())
                                        .put("totalPairs", submission.totalPairs())
                                        .toString());
                            }
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
                        .orElse(null);
                });

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
    public ResponseEntity<Object> timeBuzzerStart(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        // Il round ha tre manche da 30 s ma la sua finestra dura una manche:
        // qui conta che il round sia quello giusto e ancora in corso, poi la
        // scadenza viene rinnovata dal via stesso. Controllare la scadenza
        // bloccherebbe la manche 2 e 3.
        if (!gameStateService.isCurrentRoundType(gameId, "TIME_BUZZER")) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "time-buzzer-round-not-active",
                    "message", "Il via si dà solo durante un round Time Buzzer aperto."));
        }

        int manche = 1;
        if (body != null && body.get("manche") instanceof Number number) {
            manche = Math.max(1, number.intValue());
        }

        JSONObject snapshot = gameStateService.snapshot(gameId);
        String roundKey = snapshot.optString("roundKey", "");
        long startedAt = System.currentTimeMillis();

        // Test-and-set atomico: due richieste simultanee per la stessa manche
        // provano lo stesso payload di partenza; una sola vince il CAS, l'altra
        // rilegge lo startedAt vincente e risponde replayed=true. Il broadcast
        // è dentro il ramo del vincitore, quindi parte una volta sola.
        for (int attempt = 0; attempt < 5; attempt++) {
            var currentRaw = stateBlobs.load(gameId, BUZZER_BLOB);
            JSONObject existing = currentRaw.map(JSONObject::new).orElse(null);
            if (existing != null && roundKey.equals(existing.optString("roundKey", ""))
                    && existing.optInt("manche", -1) == manche) {
                // Il via si ripete anche quando la manche è già partita: un
                // telefono che si è sbloccato o riconnesso deve poter armare
                // il tasto, altrimenti resta su ATTENDI e non gioca.
                long existingStart = existing.getLong("startedAt");
                messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                        .put("action", "TIME_BUZZER_START")
                        .put("startedAt", existingStart)
                        .put("manche", manche)
                        .toString());
                return ResponseEntity.ok(buzzerStart(existingStart, manche, true));
            }

            String nextPayload = new JSONObject()
                    .put("startedAt", startedAt)
                    .put("manche", manche)
                    .put("roundKey", roundKey)
                    .toString();
            if (!stateBlobs.compareAndSet(gameId, BUZZER_BLOB, currentRaw.orElse(null), nextPayload)) {
                continue;
            }

            // Nuova manche: finestra piena da adesso. Solo il vincitore del CAS
            // allunga la deadline e manda il via ai telefoni.
            gameStateService.extendRoundDeadline(gameId, timeBuzzerWindowMs(snapshot));
            messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                    .put("action", "TIME_BUZZER_START")
                    .put("startedAt", startedAt)
                    .put("manche", manche)
                    .toString());
            return ResponseEntity.ok(buzzerStart(startedAt, manche, false));
        }

        return ResponseEntity.status(409).body(Map.of(
                "error", "time-buzzer-start-race",
                "message", "Il via è stato aggiornato da un'altra richiesta; riprova."));
    }

    /** Durata della manche dichiarata dal round, in millisecondi. */
    private long timeBuzzerWindowMs(JSONObject snapshot) {
        JSONObject payload = snapshot == null ? null : snapshot.optJSONObject("payload");
        double seconds = payload == null ? 0 : payload.optDouble("duration", 0);
        return seconds > 0 ? Math.round(seconds * 1000) : TIME_BUZZER_FALLBACK_WINDOW_MS;
    }

    /** Risposta del via: {@code replayed} dice se era già partita la manche. */
    private Map<String, Object> buzzerStart(long startedAt, int manche, boolean replayed) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startedAt", startedAt);
        result.put("manche", manche);
        result.put("replayed", replayed);
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

    // ------------------------------------------------------------- Speed Rush

    /** La TV apre la sessione dopo il pre-round: da qui il server è l'arbitro. */
    @PostMapping("/{gameId}/speed-rush/start")
    public ResponseEntity<Object> speedRushStart(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        if (!gameStateService.isActiveRoundType(gameId, "SPEED_RUSH")) {
            return ResponseEntity.status(409).body(Map.of("error", "Round Speed Rush non attivo"));
        }
        List<String> players = readPlayers(body == null ? null : body.get("players"));
        String roundKey = gameStateService.snapshot(gameId).optString("roundKey", "");
        return ResponseEntity.ok(JsonSupport.toMap(speedRushService.start(gameId, players, roundKey)));
    }

    /** Prova corrente del telefono autenticato, senza la soluzione. */
    @GetMapping("/{gameId}/speed-rush/task")
    public ResponseEntity<Object> speedRushTask(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session) {
        if (!gameStateService.isActiveRoundType(gameId, "SPEED_RUSH")) {
            return ResponseEntity.status(409).body(Map.of("error", "Round Speed Rush non attivo"));
        }
        return speedRushService.task(gameId, session.getPlayerName())
                .<ResponseEntity<Object>>map(task -> ResponseEntity.ok(JsonSupport.toMap(task)))
                .orElseGet(() -> ResponseEntity.status(409)
                        .body(Map.of("error", "Nessuna prova disponibile")));
    }

    /** Risposta della prova: correttezza, corsia e prossima prova li decide il server. */
    @PostMapping("/{gameId}/speed-rush/answer")
    public ResponseEntity<Object> speedRushAnswer(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session,
            @RequestBody(required = false) Map<String, Object> body) {
        if (!gameStateService.isActiveRoundType(gameId, "SPEED_RUSH")) {
            return ResponseEntity.status(409).body(Map.of("error", "Round Speed Rush non attivo"));
        }
        Map<String, Object> payload = body == null ? Map.of() : body;
        String taskId = string(payload.get("taskId"));
        if (taskId == null || taskId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Prova mancante"));
        }
        Object answer = payload.get("answer");
        String commandKey = "speed:" + taskId;
        Map<String, Object> result = idempotencyService.executeOnce(gameId, commandKey,
                "SPEED_RUSH_ANSWER", session.getPlayerName(), () -> speedRushService
                        .answer(gameId, session.getPlayerName(), taskId, answer)
                        .map(progress -> {
                            JSONObject event = new JSONObject()
                                    .put("action", "SPEED_RUSH_PROGRESS")
                                    .put("playerName", progress.optString("playerName"))
                                    .put("correct", progress.optBoolean("correct"))
                                    .put("progress", progress.optInt("progress"))
                                    .put("streak", progress.optInt("streak"))
                                    .put("multiplier", progress.optInt("multiplier", 1))
                                    .put("finished", progress.optBoolean("finished"))
                                    .put("position", progress.opt("position"))
                                    .put("finishedAt", progress.opt("finishedAt"));
                            messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", event.toString());
                            return JsonSupport.toMap(progress);
                        })
                        .orElse(null));
        if (result == null) {
            return ResponseEntity.status(409).body(Map.of("error", "Prova scaduta o non più valida"));
        }
        return ResponseEntity.ok(result);
    }

    /** La TV chiude la corsa: il server calcola i punti una sola volta. */
    @PostMapping("/{gameId}/speed-rush/finish")
    public Map<String, Object> speedRushFinish(@PathVariable("gameId") Long gameId) {
        JSONArray results = speedRushService.finish(gameId);
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                .put("action", "SPEED_RUSH_RESULT")
                .put("results", results)
                .toString());
        return Map.of("results", JsonSupport.toList(results));
    }

    // ----------------------------------------------------------------- Basket

    /** La TV apre il bonus: il server crea i tabelloni e le finestre di tiro. */
    @PostMapping("/{gameId}/basket/start")
    public Map<String, Object> basketStart(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        List<String> players = readPlayers(body == null ? null : body.get("players"));
        return JsonSupport.toMap(basketService.start(gameId, players));
    }

    /** Stato del tabellone e finestra di potenza corrente per il telefono. */
    @GetMapping("/{gameId}/basket/state")
    public Map<String, Object> basketState(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session) {
        return JsonSupport.toMap(basketService.state(gameId, session.getPlayerName()));
    }

    /** Il telefono manda potenza e direzione: il server decide canestro e punti. */
    @PostMapping("/{gameId}/basket/shot")
    public ResponseEntity<Object> basketShot(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String shotId = string(payload.get("shotId"));
        double pull = number(payload.get("pull"), -1);
        double side = number(payload.get("side"), 2);
        String commandKey = "basket:" + shotId;
        Map<String, Object> result = idempotencyService.executeOnce(gameId, commandKey,
                "BASKET_SHOT", session.getPlayerName(), () -> basketService
                        .shot(gameId, session.getPlayerName(), shotId, pull, side)
                        .map(shot -> {
                            if (shot.optBoolean("made")) {
                                messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", new JSONObject()
                                        .put("action", "BASKET_SCORE")
                                        .put("playerName", shot.optString("playerName"))
                                        .put("points", shot.optInt("points"))
                                        .put("baskets", 1)
                                        .put("score", shot.optInt("score"))
                                        .put("manche", shot.optInt("manche"))
                                        .toString());
                            }
                            return JsonSupport.toMap(shot);
                        })
                        .orElse(null));
        if (result == null) {
            return ResponseEntity.status(409).body(Map.of("error", "Tiro non valido o bonus chiuso"));
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{gameId}/basket/finish")
    public Map<String, Object> basketFinish(@PathVariable("gameId") Long gameId) {
        JSONArray results = basketService.finish(gameId);
        return Map.of("results", JsonSupport.toList(results));
    }

    /** Azzera i due giochi (nuova partita o reset dalla TV). */
    @PostMapping("/{gameId}/party/reset")
    public Map<String, Object> reset(@PathVariable("gameId") Long gameId) {
        partyGameService.forget(gameId);
        speedRushService.forget(gameId);
        basketService.forget(gameId);
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

    private double number(Object raw, double fallback) {
        return raw instanceof Number number ? number.doubleValue() : readDouble(raw);
    }

    private String string(Object raw) {
        return raw == null ? null : String.valueOf(raw);
    }

    private List<String> readPlayers(Object raw) {
        List<String> players = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object value : list) {
                String name = value == null ? "" : String.valueOf(value).trim();
                if (!name.isEmpty()) players.add(name);
            }
        }
        return players;
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
