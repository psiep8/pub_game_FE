package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.service.QuestionHistoryService;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Protocollo di sessione e sincronizzazione per TV, remote e admin.
 *
 * <p>Il WebSocket resta il canale veloce, ma non è l'unica verità: ogni
 * dispositivo può chiedere in qualsiasi momento lo stato autorevole
 * ({@code GET /sync}) e recuperare gli eventi mancanti grazie alla sequenza.</p>
 */
@RestController
@RequestMapping("/games/{gameId}")
public class ReliabilityController {

    private final DeviceSessionService sessions;
    private final GameStateService gameState;
    private final QuestionHistoryService questionHistory;
    private final QuestionUsageService questionUsage;
    private final ReliabilityProperties props;

    public ReliabilityController(DeviceSessionService sessions, GameStateService gameState,
            QuestionHistoryService questionHistory, QuestionUsageService questionUsage,
            ReliabilityProperties props) {
        this.sessions = sessions;
        this.gameState = gameState;
        this.questionHistory = questionHistory;
        this.questionUsage = questionUsage;
        this.props = props;
    }

    /** Registra (o riprende) la sessione del dispositivo. */
    @PostMapping("/session")
    public Map<String, Object> openSession(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String deviceId = string(payload.get("deviceId"));
        String role = string(payload.get("role"));
        String playerName = string(payload.get("playerName"));
        String token = string(payload.get("sessionToken"));

        DeviceSessionService.Registration registration = sessions.register(
                gameId, deviceId, role, playerName, token);

        JSONObject state = gameState.snapshot(gameId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("gameId", gameId);
        out.put("sessionToken", registration.sessionToken());
        out.put("connectionId", registration.connectionId());
        out.put("deviceId", registration.deviceId());
        out.put("role", registration.role());
        out.put("playerName", registration.playerName());
        out.put("resumed", registration.resumed());
        out.put("duplicateDisplay", registration.duplicateDisplay());
        out.put("serverTime", System.currentTimeMillis());
        out.put("stateVersion", state.optLong("version", 0));
        out.put("seq", state.optLong("seq", 0));
        out.put("roundDeadlineAt", state.opt("roundDeadlineAt"));
        return out;
    }

    /** Heartbeat periodico: tiene viva la presenza e riallinea versione e seq. */
    @PostMapping("/session/heartbeat")
    public ResponseEntity<Object> heartbeat(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        String token = string(body == null ? null : body.get("sessionToken"));
        Optional<DeviceSessionEntity> session = sessions.heartbeat(gameId, token);
        if (session.isEmpty()) {
            return ResponseEntity.status(HttpStatus.GONE)
                    .body(Map.of("error", "session-unknown", "action", "re-register"));
        }
        long clientSeq = number(body.get("seq"), -1);
        long serverSeq = gameState.currentSeq(gameId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("serverTime", System.currentTimeMillis());
        out.put("stateVersion", gameState.currentVersion(gameId));
        out.put("seq", serverSeq);
        out.put("needsSync", clientSeq >= 0 && clientSeq < serverSeq);
        out.put("roundDeadlineAt", gameState.roundDeadline(gameId).orElse(null));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/session/disconnect")
    public Map<String, Object> disconnect(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        sessions.disconnect(string(body == null ? null : body.get("sessionToken")));
        return Map.of("ok", true);
    }

    /**
     * Sincronizzazione: snapshot autorevole + eventi mancanti.
     *
     * <p>È la chiamata che un dispositivo fa appena torna online: con questa
     * ripristina schermata, squadra e round senza intervento manuale.</p>
     */
    @GetMapping("/sync")
    public Map<String, Object> sync(@PathVariable("gameId") Long gameId,
            @RequestParam(value = "sinceSeq", defaultValue = "-1") long sinceSeq,
            @RequestParam(value = "sessionToken", required = false) String token) {
        JSONObject sync = gameState.sync(gameId, sinceSeq);
        JSONObject snapshot = sync.getJSONObject("snapshot");
        snapshot.put("scores", new JSONObject(questionHistory.scores(gameId)));
        snapshot.put("arenaScores", new JSONObject(questionHistory.scores(gameId)));
        snapshot.put("presence", sessions.presence(gameId));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("snapshot", JsonSupport.toMap(snapshot));
        out.put("events", sync.get("events"));
        out.put("fromSeq", sync.getLong("fromSeq"));
        out.put("toSeq", sync.getLong("toSeq"));
        out.put("complete", sync.getBoolean("complete"));
        out.put("stale", sync.getBoolean("stale"));
        out.put("serverTime", sync.getLong("serverTime"));
        if (token != null && !token.isBlank()) {
            sessions.heartbeat(gameId, token);
        }
        return out;
    }

    /** Solo snapshot, senza eventi (usato dalla TV e dall'admin). */
    @GetMapping("/state")
    public Map<String, Object> state(@PathVariable("gameId") Long gameId) {
        JSONObject snapshot = gameState.snapshot(gameId);
        snapshot.put("scores", new JSONObject(questionHistory.scores(gameId)));
        snapshot.put("presence", sessions.presence(gameId));
        return JsonSupport.toMap(snapshot);
    }

    /** Diagnostica leggibile dall'admin durante la serata. */
    @GetMapping("/diagnostics")
    public Map<String, Object> diagnostics(@PathVariable("gameId") Long gameId) {
        JSONObject snapshot = gameState.snapshot(gameId);
        JSONObject devices = sessions.summary(gameId);
        long now = System.currentTimeMillis();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("gameId", gameId);
        out.put("serverTime", now);
        out.put("stateVersion", snapshot.optLong("version", 0));
        out.put("seq", snapshot.optLong("seq", 0));
        out.put("status", snapshot.opt("status"));
        out.put("roundIndex", snapshot.optInt("roundIndex", 0));
        out.put("roundType", snapshot.opt("roundType"));
        out.put("roundDeadlineAt", snapshot.opt("roundDeadlineAt"));
        out.put("roundOpen", gameState.isRoundOpen(gameId));
        out.put("lastSnapshotAt", snapshot.opt("updatedAt"));

        Optional<com.pub_game_be.reliability.domain.GameEventEntity> last = gameState.lastEvent(gameId);
        out.put("lastEventAt", last.map(e -> e.getCreatedAt()).orElse(null));
        out.put("lastEventType", last.map(e -> e.getType()).orElse(null));
        out.put("events", gameState.eventCount(gameId));
        out.put("recentEvents", JsonSupport.toList(gameState.recentEvents(gameId, 8)));
        out.put("devices", JsonSupport.toMap(devices));
        out.put("presence", JsonSupport.toList(sessions.presence(gameId)));
        out.put("questionsUsed", questionUsage.count(gameId));
        out.put("heartbeatTimeoutSeconds", props.getHeartbeatTimeoutSeconds());
        out.put("answerWindowSeconds", props.getAnswerWindowSeconds());
        return out;
    }

    private String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private long number(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return value == null ? fallback : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException error) {
            return fallback;
        }
    }
}
