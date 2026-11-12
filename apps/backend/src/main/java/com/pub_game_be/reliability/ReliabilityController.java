package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.service.QuestionHistoryService;
import org.json.JSONObject;
import org.json.JSONArray;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
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
    private final ScoreboardService scoreboard;
    private final PairingCodeService pairing;

    @Value("${game.security.control-secret:}")
    private String controlSecret;

    public ReliabilityController(DeviceSessionService sessions, GameStateService gameState,
            QuestionHistoryService questionHistory, QuestionUsageService questionUsage,
            ReliabilityProperties props, ScoreboardService scoreboard, PairingCodeService pairing) {
        this.pairing = pairing;
        this.sessions = sessions;
        this.gameState = gameState;
        this.questionHistory = questionHistory;
        this.questionUsage = questionUsage;
        this.props = props;
        this.scoreboard = scoreboard;
    }

    /** Registra (o riprende) la sessione del dispositivo. */
    @PostMapping("/session")
    public Map<String, Object> openSession(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-Control-Secret", required = false) String suppliedSecret) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String deviceId = string(payload.get("deviceId"));
        String role = string(payload.get("role"));
        String playerName = string(payload.get("playerName"));
        String token = string(payload.get("sessionToken"));
        String normalizedRole = role == null ? "REMOTE" : role.trim().toUpperCase(java.util.Locale.ROOT);
        if (!java.util.Set.of("REMOTE", "TV", "ADMIN").contains(normalizedRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ruolo non valido");
        }
        if (!"REMOTE".equals(normalizedRole)) {
            boolean validResume = sessions.authenticate(token)
                    .filter(s -> s.getGameId().equals(gameId) && normalizedRole.equals(s.getRole())).isPresent();
            boolean authorized = validResume || secretMatches(suppliedSecret)
                    || pairing.redeem(gameId, string(payload.get("pairingCode")));
            if (!authorized) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziale di regia non valida");
            }
        }

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

    /**
     * Codice breve per abbinare la regia: la TV lo mostra, l'admin lo digita.
     * Richiede il segreto di regia, quindi solo un dispositivo già autorizzato
     * (la TV) può generarlo.
     */
    @PostMapping("/pairing-code")
    public Map<String, Object> pairingCode(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Control-Secret", required = false) String suppliedSecret) {
        if (!secretMatches(suppliedSecret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziale di regia non valida");
        }
        return Map.of("code", pairing.issue(gameId), "ttlSeconds", PairingCodeService.TTL.toSeconds());
    }

    private boolean secretMatches(String supplied) {
        return controlSecret != null && controlSecret.length() >= 32 && supplied != null
                && MessageDigest.isEqual(controlSecret.getBytes(StandardCharsets.UTF_8),
                        supplied.getBytes(StandardCharsets.UTF_8));
    }

    /** Heartbeat periodico: tiene viva la presenza e riallinea versione e seq. */
    @PostMapping("/session/heartbeat")
    public ResponseEntity<Object> heartbeat(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        String token = string(payload.get("sessionToken"));
        Optional<DeviceSessionEntity> session = sessions.heartbeat(gameId, token);
        if (session.isEmpty()) {
            return ResponseEntity.status(HttpStatus.GONE)
                    .body(Map.of("error", "session-unknown", "action", "re-register"));
        }
        long clientSeq = number(payload.get("seq"), -1);
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
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-Session-Token", required = false) String callerToken) {
        String token = string(body == null ? null : body.get("sessionToken"));
        // Un dispositivo può chiudere solo la propria sessione: senza questo
        // controllo un telefono autenticato poteva disconnettere la regia
        // passando il token altrui nel body.
        if (callerToken == null || !callerToken.equals(token)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sessione diversa dalla richiesta");
        }
        if (sessions.authenticate(token).filter(s -> s.getGameId().equals(gameId)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sessione diversa dalla partita");
        }
        sessions.disconnect(token);
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
            @RequestHeader(value = "X-Session-Token", required = false) String token,
            HttpServletRequest request) {
        JSONObject sync = gameState.sync(gameId, sinceSeq);
        JSONObject snapshot = sync.getJSONObject("snapshot");
        snapshot.put("scores", new JSONObject(questionHistory.scores(gameId)));
        snapshot.put("arenaScores", new JSONObject(questionHistory.scores(gameId)));
        // Classifica completa della TV: senza questa, un refresh o un altro
        // dispositivo ripartiva da una tabella vuota.
        snapshot.put("leaderboard", JsonSupport.toList(scoreboard.entries(gameId)));
        snapshot.put("presence", sessions.presence(gameId));
        Object identity = request.getAttribute("pubgame.session");
        if (identity instanceof DeviceSessionEntity session && "REMOTE".equals(session.getRole())) {
            boolean music = "MUSIC".equals(snapshot.optString("roundType"));
            snapshot.put("payload", sanitizePayload(snapshot.opt("payload"), music));
            JSONObject round = snapshot.optJSONObject("currentRound");
            if (round != null) round.put("payload", sanitizePayload(round.opt("payload"), "MUSIC".equals(round.optString("type"))));
            sync.put("events", sanitizePayload(sync.getJSONArray("events"), false));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("snapshot", JsonSupport.toMap(snapshot));
        // JSONArray è un bean per Jackson: senza conversione finiva come
        // {"empty":false} e il client non poteva iterarlo.
        out.put("events", JsonSupport.toList(sync.getJSONArray("events")));
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
        snapshot.put("leaderboard", JsonSupport.toList(scoreboard.entries(gameId)));
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

    private Object sanitizePayload(Object value, boolean music) {
        if (value instanceof String text) {
            String trimmed = text.stripLeading();
            try {
                if (trimmed.startsWith("{")) return sanitizePayload(new JSONObject(text), music).toString();
                if (trimmed.startsWith("[")) return sanitizePayload(new JSONArray(text), music).toString();
            } catch (org.json.JSONException ignored) {
                // Il testo ordinario non è un payload JSON serializzato.
            }
            return text;
        }
        if (value instanceof JSONObject object) {
            boolean musicPayload = music || "MUSIC".equals(object.optString("type"))
                    || "MUSIC_PHASE".equals(object.optString("action"));
            JSONObject clean = new JSONObject();
            for (String key : object.keySet()) {
                if (!java.util.Set.of("correctAnswer", "correctIndex", "explanation", "explain", "solution", "rawPayload", "proverb").contains(key)
                        && !(musicPayload && java.util.Set.of("songTitle", "artist", "previewUrl", "albumCover", "year").contains(key)))
                    clean.put(key, sanitizePayload(object.opt(key), musicPayload));
            }
            return clean;
        }
        if (value instanceof JSONArray array) {
            JSONArray clean = new JSONArray();
            for (Object element : array) clean.put(sanitizePayload(element, music));
            return clean;
        }
        return value == null ? JSONObject.NULL : value;
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
