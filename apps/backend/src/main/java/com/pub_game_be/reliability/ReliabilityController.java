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
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
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
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${game.security.control-secret:}")
    private String controlSecret;

    public ReliabilityController(DeviceSessionService sessions, GameStateService gameState,
            QuestionHistoryService questionHistory, QuestionUsageService questionUsage,
            ReliabilityProperties props, ScoreboardService scoreboard, PairingCodeService pairing,
            SimpMessagingTemplate messagingTemplate) {
        this.pairing = pairing;
        this.sessions = sessions;
        this.gameState = gameState;
        this.questionHistory = questionHistory;
        this.questionUsage = questionUsage;
        this.props = props;
        this.scoreboard = scoreboard;
        this.messagingTemplate = messagingTemplate;
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
        boolean secretOk = secretMatches(suppliedSecret);
        // Un token già valido vale più di un segreto vecchio rimasto in locale:
        // se la TV si riconnette col proprio token, un segreto errato non deve
        // farla degradare a lobby (né cancellare la sessione).
        boolean validResume = sessions.authenticate(token)
                .filter(s -> s.getGameId().equals(gameId) && normalizedRole.equals(s.getRole())).isPresent();
        // La TV si registra anche senza segreto, così la lobby e il QR dei
        // telefoni funzionano pure con il database azzerato. Resta però uno
        // schermo: senza la credenziale di regia non genera codici e non legge
        // le soluzioni (filtro + pairing-code). Un segreto sbagliato non deve
        // sembrare una TV abilitata: si rifiuta subito, salvo token valido.
        if ("TV".equals(normalizedRole) && suppliedSecret != null && !suppliedSecret.isBlank()
                && !secretOk && !validResume) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Segreto di regia non valido");
        }
        if (!"REMOTE".equals(normalizedRole) && !"TV".equals(normalizedRole)) {
            boolean authorized = validResume || secretOk;
            if (!authorized) {
                PairingCodeService.RedeemResult result = pairing.attempt(gameId, string(payload.get("pairingCode")));
                if (result != PairingCodeService.RedeemResult.OK) {
                    String reason = switch (result) {
                        case EXPIRED -> "Codice scaduto: guarda la TV, ce n'è uno nuovo";
                        case LOCKED -> "Troppi tentativi: attendi un minuto e riprova";
                        default -> "Codice non valido: guarda la TV";
                    };
                    HttpStatus status = switch (result) {
                        case EXPIRED -> HttpStatus.GONE;
                        case LOCKED -> HttpStatus.TOO_MANY_REQUESTS;
                        default -> HttpStatus.UNAUTHORIZED;
                    };
                    throw new ResponseStatusException(status, reason);
                }
            }
        }

        DeviceSessionService.Registration registration = sessions.register(
                gameId, deviceId, role, playerName, token);
        if ("TV".equals(normalizedRole) && secretOk) {
            sessions.grantRegia(registration.sessionToken());
        }

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
        // Solo la TV aperta col segreto (e la regia) legge le soluzioni.
        out.put("regia", "ADMIN".equals(normalizedRole)
                || ("TV".equals(normalizedRole) && sessions.isRegia(registration.sessionToken())));
        out.put("serverTime", System.currentTimeMillis());
        out.put("stateVersion", state.optLong("version", 0));
        out.put("seq", state.optLong("seq", 0));
        out.put("roundDeadlineAt", state.opt("roundDeadlineAt"));
        return out;
    }

    /**
     * Codice breve per abbinare la regia: la TV lo mostra, l'admin lo digita.
     * Solo una TV aperta col segreto di regia può generarlo: una TV registrata
     * senza credenziale è uno schermo di lobby e non apre la regia.
     */
    @PostMapping("/pairing-code")
    public Map<String, Object> pairingCode(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Control-Secret", required = false) String suppliedSecret,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        if (!regiaTvSession(gameId, sessionToken) && !secretMatches(suppliedSecret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziale di regia non valida");
        }
        String code = pairing.issue(gameId);
        PairingCodeService.ActiveCode active = pairing.active(gameId);
        return Map.of("code", code, "ttlSeconds", PairingCodeService.TTL.toSeconds(),
                "expiresAt", active == null ? 0L : active.expiresAt());
    }

    /**
     * Codice attivo senza rigenerarlo: la TV lo interroga per capire quando è
     * scaduto o è stato usato e mostrarne subito uno nuovo.
     */
    @GetMapping("/pairing-code")
    public Map<String, Object> pairingCodeStatus(@PathVariable("gameId") Long gameId,
            @RequestHeader(value = "X-Control-Secret", required = false) String suppliedSecret,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        if (!regiaTvSession(gameId, sessionToken) && !secretMatches(suppliedSecret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenziale di regia non valida");
        }
        PairingCodeService.ActiveCode active = pairing.active(gameId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", active == null ? null : active.value());
        out.put("expiresAt", active == null ? 0L : active.expiresAt());
        out.put("ttlSeconds", PairingCodeService.TTL.toSeconds());
        return out;
    }

    /** Solo la TV della stessa partita, aperta col segreto, legge o rigenera il codice. */
    private boolean regiaTvSession(Long gameId, String token) {
        return sessions.authenticate(token)
                .filter(s -> s.getGameId().equals(gameId) && "TV".equals(s.getRole()) && s.regiaAttiva()).isPresent();
    }

    /**
     * Snapshot della mano Blackjack, salvato dalla TV a ogni cambio di fase.
     * Serve a riprendere la mano dopo un refresh: solo una sessione TV di
     * questa partita può scriverlo.
     */
    @PostMapping("/blackjack-state")
    public ResponseEntity<Object> saveBlackjackState(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        boolean tvSession = sessions.authenticate(string(payload.get("sessionToken")))
                .filter(s -> s.getGameId().equals(gameId) && "TV".equals(s.getRole())).isPresent();
        if (!tvSession) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Sessione TV non valida"));
        }
        Object state = payload.get("state");
        if (state == null) {
            gameState.forgetBlackjackState(gameId);
        } else if (state instanceof Map<?, ?> map) {
            // Jackson consegna la mappa del checkpoint. Il costruttore
            // JSONObject(Object) la tratterebbe come un bean e salverebbe
            // "{}": qui serve quello per Map, altrimenti la TV non può
            // riprendere la mano dopo un refresh.
            gameState.saveBlackjackState(gameId, new JSONObject(map).toString());
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid-blackjack-state"));
        }
        return ResponseEntity.ok(Map.of("saved", true));
    }

    /**
     * Checkpoint TV del round aperto: uno solo, con la modalità che lo scrive.
     * Solo la TV autenticata può salvarlo.
     */
    @PostMapping("/tv-state")
    public ResponseEntity<Object> saveTvCheckpoint(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session,
            @RequestBody Map<String, Object> body) {
        if (!"TV".equals(session.getRole()) || !session.getGameId().equals(gameId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "tv-required"));
        }
        Object rawState = body.get("state");
        Object rawRoundIndex = body.get("roundIndex");
        Object rawRevision = body.get("revision");
        Object rawMode = body.get("mode");
        // Un bonus chiude il suo checkpoint mandando `state: null`.
        if (rawState == null) {
            gameState.forgetTvCheckpoint(gameId);
            return ResponseEntity.ok(Map.of("saved", true));
        }
        if (!(rawState instanceof Map<?, ?>) || !(rawRevision instanceof Number)
                || !(rawMode instanceof String mode) || mode.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid-checkpoint"));
        }
        // Il roundIndex serve solo ai round: un bonus vive fuori e manda -1.
        int roundIndex = rawRoundIndex instanceof Number number ? number.intValue() : -1;
        boolean saved = gameState.saveTvCheckpoint(gameId, mode, roundIndex,
                ((Number) rawRevision).longValue(), new JSONObject((Map<?, ?>) rawState));
        return saved ? ResponseEntity.ok(Map.of("saved", true))
                : ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "stale-checkpoint"));
    }

    /**
     * Bonus dell'atto: la TV dice se è partito o è stato chiuso. Così un
     * refresh non lo salta e non lo riapre una volta pagato.
     */
    @PostMapping("/bonus-state")
    public ResponseEntity<Object> saveBonusAct(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session,
            @RequestBody(required = false) Map<String, Object> body) {
        if (!"TV".equals(session.getRole()) || !session.getGameId().equals(gameId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "tv-required"));
        }
        Map<String, Object> payload = body == null ? Map.of() : body;
        Object rawAct = payload.get("act");
        Object rawType = payload.get("type");
        Object rawStatus = payload.get("status");
        if (!(rawAct instanceof Number act) || act.intValue() < 0
                || !(rawType instanceof String type) || type.isBlank()
                || !("STARTED".equals(rawStatus) || "CLOSED".equals(rawStatus))) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid-bonus-state"));
        }
        gameState.saveBonusAct(gameId, new JSONObject()
                .put("act", act.intValue())
                .put("type", type)
                .put("status", String.valueOf(rawStatus))
                .put("updatedAt", System.currentTimeMillis()));
        return ResponseEntity.ok(Map.of("saved", true));
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
        // Telefono e TV senza regia ricevono lo snapshot ripulito: le soluzioni
        // restano fuori dal payload, dagli eventi e dal round corrente.
        boolean limited = identity instanceof DeviceSessionEntity session
                && ("REMOTE".equals(session.getRole())
                        || ("TV".equals(session.getRole()) && !session.regiaAttiva()));
        if (limited) {
            boolean music = "MUSIC".equals(snapshot.optString("roundType"));
            snapshot.put("payload", sanitizePayload(snapshot.opt("payload"), music));
            JSONObject round = snapshot.optJSONObject("currentRound");
            if (round != null) round.put("payload", sanitizePayload(round.opt("payload"), "MUSIC".equals(round.optString("type"))));
            sync.put("events", sanitizePayload(sync.getJSONArray("events"), false));
            // La mano Blackjack contiene la carta coperta e il mazzo ordinato:
            // la TV regia la usa per riprendere il bonus, telefono e lobby no.
            snapshot.put("blackjackState", JSONObject.NULL);
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

    /**
     * Diagnostica leggibile dall'admin durante la serata.
     *
     * <p>È leggibile anche senza sessione, così la regia non ancora abbinata non
     * vede un pannello morto. In quel caso però gli eventi recenti restano fuori:
     * i loro payload contengono le soluzioni, che i telefoni non devono leggere.</p>
     */
    /**
     * Espulsione decisa dalla regia: revoca la sessione della squadra e avvisa
     * TV e telefoni, che tolgono subito il giocatore dall'interfaccia.
     */
    @PostMapping("/players/expel")
    public Map<String, Object> expelPlayer(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session) {
        if (!"ADMIN".equals(session.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo la regia può espellere");
        }
        String playerName = body == null ? "" : String.valueOf(body.getOrDefault("playerName", "")).trim();
        int removed = sessions.expelPlayer(gameId, playerName);
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status",
                new JSONObject().put("action", "PLAYER_REMOVED").put("playerName", playerName));
        return Map.of("removed", removed, "playerName", playerName);
    }

    /**
     * Seme delle entrate a sorpresa dei bonus.
     *
     * <p>Stabile per partita: la TV ci costruisce il piano dei cinque ingressi,
     * uno per bonus e tutti diversi. Non è un dato sensibile e non dipende dal
     * dispositivo, quindi un refresh non cambia la scena.</p>
     */
    @GetMapping("/bonus-entrance")
    public Map<String, Object> bonusEntrance(@PathVariable("gameId") Long gameId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("seed", bonusSeed(gameId));
        return out;
    }

    /** Seme stabile e non negativo: due TV sulla stessa partita vedono la stessa scena. */
    static long bonusSeed(long gameId) {
        long mixed = gameId * 0x9e3779b97f4a7c15L;
        mixed ^= mixed >>> 29;
        return (mixed & 0x7fffffffffffffffL) % 2_147_483_647L;
    }

    @GetMapping("/diagnostics")
    public Map<String, Object> diagnostics(@PathVariable("gameId") Long gameId, HttpServletRequest request) {
        Object identity = request.getAttribute("pubgame.session");
        boolean paired = identity instanceof DeviceSessionEntity session
                && ("ADMIN".equals(session.getRole())
                        || ("TV".equals(session.getRole()) && session.regiaAttiva()));
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
        out.put("roundOpen", gameState.hasOpenRound(gameId));
        out.put("lastSnapshotAt", snapshot.opt("updatedAt"));

        Optional<com.pub_game_be.reliability.domain.GameEventEntity> last = gameState.lastEvent(gameId);
        out.put("lastEventAt", last.map(e -> e.getCreatedAt()).orElse(null));
        out.put("lastEventType", last.map(e -> e.getType()).orElse(null));
        out.put("events", gameState.eventCount(gameId));
        out.put("recentEvents", paired
                ? JsonSupport.toList(gameState.recentEvents(gameId, 8))
                : java.util.List.of());
        out.put("recentEventsHidden", !paired);
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
                    || "MUSIC_PHASE".equals(object.optString("action"))
                    || object.has("songs") || object.has("previewUrl") || object.has("songTitle");
            JSONObject clean = new JSONObject();
            for (String key : object.keySet()) {
                if (!java.util.Set.of("correctAnswer", "correctIndex", "explanation", "explain", "solution", "rawPayload", "proverb").contains(key)
                        && !(musicPayload && java.util.Set.of("songTitle", "title", "artist", "previewUrl", "albumCover", "year").contains(key)))
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
