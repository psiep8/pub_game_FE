package com.pub_game_be.controller;

import com.pub_game_be.domain.enums.GameStatus;
import com.pub_game_be.domain.enums.GameType;
import com.pub_game_be.domain.enums.RoundStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.domain.game_round.GameRound;
import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.IdempotencyService;
import com.pub_game_be.reliability.ScoreboardService;
import com.pub_game_be.reliability.StateBlobService;
import com.pub_game_be.repository.GameRepository;
import com.pub_game_be.repository.GameRoundRepository;
import com.pub_game_be.service.BombaService;
import com.pub_game_be.service.GameService;
import com.pub_game_be.service.QuestionHistoryService;
import com.pub_game_be.service.QuestionPoolService;
import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
import com.pub_game_be.service.SimpleRoundService;
import com.pub_game_be.service.UltimaSpiaggiaLevelService;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;

@RestController
@RequestMapping("/games")
public class GameController {

    private final GameRepository gameRepo;
    private final GameRoundRepository gameRoundRepository;
    private final SimpleRoundService simpleRoundService;
    private final GameService gameService;
    private final QuestionBankService questionBank;
    private final SimpMessagingTemplate messagingTemplate;
    private final QuestionHistoryService questionHistory;
    private final QuestionPoolService questionPoolService;
    private final PartyGameService partyGameService;
    private final GameStateService gameStateService;
    private final IdempotencyService idempotencyService;
    private final UltimaSpiaggiaLevelService ultimaSpiaggiaLevelService;
    private final BombaService bombaService;
    private final StateBlobService stateBlobs;
    private final ScoreboardService scoreboard;

    public GameController(GameRepository gameRepo,
            GameRoundRepository gameRoundRepository,
            SimpleRoundService simpleRoundService,
            GameService gameService,
            QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate,
            QuestionHistoryService questionHistory,
            QuestionPoolService questionPoolService,
            PartyGameService partyGameService,
            GameStateService gameStateService,
            IdempotencyService idempotencyService,
            UltimaSpiaggiaLevelService ultimaSpiaggiaLevelService,
            BombaService bombaService, StateBlobService stateBlobs, ScoreboardService scoreboard) {
        this.gameRepo = gameRepo;
        this.gameRoundRepository = gameRoundRepository;
        this.simpleRoundService = simpleRoundService;
        this.gameService = gameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
        this.questionHistory = questionHistory;
        this.questionPoolService = questionPoolService;
        this.partyGameService = partyGameService;
        this.gameStateService = gameStateService;
        this.idempotencyService = idempotencyService;
        this.ultimaSpiaggiaLevelService = ultimaSpiaggiaLevelService;
        this.bombaService = bombaService;
        this.stateBlobs = stateBlobs;
        this.scoreboard = scoreboard;
    }

    /**
     * Partita in corso per una TV appena aperta (altro dispositivo o browser
     * pulito): l'ID non deve essere digitato a mano né dipendere dallo storage
     * locale del dispositivo precedente.
     */
    @GetMapping("/active")
    public Map<String, Object> activeGame() {
        Map<String, Object> out = new LinkedHashMap<>();
        // Prima che parta un round non esiste ancora uno stato: la partita
        // iniziale creata all'avvio deve comunque essere raggiungibile dalla TV.
        Long gameId = gameStateService.latestGameId()
                .orElseGet(() -> gameRepo.findTopByOrderByIdDesc().map(Game::getId).orElse(null));
        out.put("gameId", gameId);
        return out;
    }

    /**
     * La TV salva la classifica completa dopo ogni variazione di punti.
     *
     * <p>È un'istantanea, non un delta: un retry non somma due volte. Lo
     * snapshot di sincronizzazione la restituisce a chi si ricollega.</p>
     */
    @PutMapping("/{gameId}/leaderboard")
    public Map<String, Object> saveLeaderboard(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        int saved = scoreboard.save(gameId, body == null ? null : body.get("entries"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", saved);
        out.put("gameId", gameId);
        return out;
    }

    @PostMapping
    public Game create() {
        Game g = new Game();
        g.setStatus(GameStatus.CREATED);
        return gameRepo.save(g);
    }

    @GetMapping
    public List<Game> getAllGames() {
        return gameRepo.findAll();
    }

    @GetMapping("/{gameId}/generate-ai-round")
    public GameRound generateAiRound(@PathVariable("gameId") Long gameId,
            @RequestParam("category") String category,
            @RequestParam("type") String type,
            @RequestParam("difficulty") String difficulty) {

        // Il prossimo indice è il massimo esistente + 1, non il conteggio: un
        // round saltato con AVANTI non crea una riga e il conteggio farebbe
        // ricollidere l'indice con quello del round precedente.
        int roundIndex = gameRoundRepository.findFirstByGameIdOrderByRoundIndexDesc(gameId)
                .map(round -> round.getRoundIndex() + 1)
                .orElse(0);
        int act = Math.min(5, (roundIndex / 8) + 1);

        String aiPayload;
        if (partyGameService.handles(type)) {
            // Timeline, Bomba, Speed Rush e Tennis Battle non usano la banca
            // domande: il payload (e lo stato del round) vive nel servizio party.
            aiPayload = partyGameService.startRound(gameId, type, category, act);
            if (aiPayload == null) {
                throw new RuntimeException("Tipo di gioco non gestito: " + type);
            }
        } else {
            // La deduplica la fa la banca: se la domanda è già uscita ne pesca un'altra.
            aiPayload = questionBank.generateQuestionJson(category, type, difficulty,
                    key -> !questionHistory.isUsed(gameId, key));
            // Arena non ha una domanda nel payload: le sue domande vengono
            // prenotate una per dispositivo da /arena-question. Il wrapper è
            // identico a ogni round, quindi non va passato dalla deduplica.
            if (!"ARENA".equalsIgnoreCase(type)) {
                // Prenotazione atomica: la domanda risulta uscita solo quando il
                // database conferma. Se un'altra richiesta l'ha presa nello stesso
                // istante si ripesca, invece di mostrarla due volte.
                String questionKey = QuestionBankService.payloadDedupeKey(aiPayload);
                if (!questionHistory.claim(gameId, questionKey, questionKey, type)) {
                    aiPayload = questionBank.generateQuestionJson(category, type, difficulty,
                            key -> !questionHistory.isUsed(gameId, key));
                    questionKey = QuestionBankService.payloadDedupeKey(aiPayload);
                    if (!questionHistory.claim(gameId, questionKey, questionKey, type)) {
                        throw new IllegalStateException("Nessuna domanda nuova disponibile per la categoria "
                                + category + ": il pool è esaurito.");
                    }
                }
            }
        }

        if ("ULTIMA_SPIAGGIA".equalsIgnoreCase(type)) {
            aiPayload = attachUltimaSpiaggiaLevels(aiPayload, gameId);
        }

        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Gioco non trovato"));

        GameRound round = new GameRound();
        round.setGame(game);

        round.setType(GameType.valueOf(type.toUpperCase()));

        round.setStatus(RoundStatus.VOTING);

        String normalizedPayload = aiPayload;
        if (type != null && ("WHEEL_OF_FORTUNE".equalsIgnoreCase(type)
                || "WHEEL_FORTUNE".equalsIgnoreCase(type)
                || "PROVERB".equalsIgnoreCase(type))) {
            normalizedPayload = normalizeWheelPayload(aiPayload);
        }

        round.setPayload(normalizedPayload);

        round.setRoundIndex(roundIndex);

        GameRound savedRound = gameRoundRepository.save(round);

        // Il round è aperto solo ora: domanda riservata e round salvato. La
        // scadenza è calcolata dal server e resta valida dopo un riavvio.
        gameStateService.startRound(gameId,
                type == null ? "QUIZ" : type.toUpperCase(Locale.ROOT),
                roundIndex, "g" + gameId + "-r" + roundIndex, normalizedPayload);

        messagingTemplate.convertAndSend(
                "/topic/game/" + gameId,
                savedRound);

        return savedRound;
    }

    /** Attesa suggerita al telefono quando l'arena non è ancora aperta. */
    private static final long ARENA_RETRY_AFTER_MS = 1000;

    @GetMapping("/{gameId}/arena-question")
    public ResponseEntity<String> getArenaQuestion(@PathVariable("gameId") Long gameId,
            @RequestParam("category") String category,
            @RequestParam(value = "playerId", defaultValue = "anonimo") String playerId) {
        if (!gameStateService.isRoundOpen(gameId)) {
            // Il telefono arriva spesso un istante prima dell'apertura del
            // round: 409 con l'attesa consigliata, così ritenta invece di
            // restare senza domanda per tutta la battaglia.
            return ResponseEntity.status(409).body(new JSONObject()
                    .put("error", "round-closed")
                    .put("retryAfterMs", ARENA_RETRY_AFTER_MS)
                    .put("deadlineAt", gameStateService.roundDeadline(gameId).orElse(0L))
                    .toString());
        }

        Predicate<QuestionBankService.ArenaQuestion> isAvailable = candidate -> !questionHistory.isUsed(gameId, candidate.key())
                && !questionHistory.isUsed(gameId, candidate.answerKey());

        // Rampa di difficolta decisa dal server: primo quarto facile, meta
        // centrale media, ultimo quarto difficile. Il lato VERO/FALSO si alterna
        // per partita, cosi indovinare sempre VERO non conviene.
        String band = gameStateService.arenaDifficultyBand(gameId);
        boolean preferTrue = questionHistory.preferTrueSide(gameId);

        QuestionBankService.ArenaQuestion question = pollForBand(gameId, category, band);

        if (question == null) {
            question = pickForBand(questionBank.generateArenaBatch(category, 10, isAvailable), band, preferTrue);

            if (question == null) {
                List<QuestionBankService.ArenaQuestion> anyCategory = questionBank
                        .generateArenaBatch(null, 10, isAvailable);
                question = pickForBand(anyCategory, band, preferTrue);
                if (question == null) {
                    question = pickPreferredSide(anyCategory, preferTrue);
                }
                if (question == null && !anyCategory.isEmpty()) {
                    question = anyCategory.get(0);
                }
            }
        }

        if (question == null) {
            question = questionBank.fallbackArenaQuestion(category, isAvailable)
                    .or(() -> questionBank.fallbackArenaQuestion(isAvailable))
                    .or(() -> questionBank.fallbackArenaQuestion(candidate -> true))
                    .orElseThrow(() -> new RuntimeException(
                            "Nessuna domanda disponibile per la categoria " + category));
        }

        // Segna il fatto come uscito: nessun altro dispositivo riceverà la stessa domanda.
        questionHistory.claim(gameId, question.key());
        questionHistory.claim(gameId, question.answerKey());
        questionHistory.countArenaSide(gameId, "VERO".equalsIgnoreCase(question.correctAnswer()));

        String questionId = questionHistory.nextQuestionId(gameId);
        questionHistory.assign(gameId, new QuestionHistoryService.ArenaAssignment(questionId, playerId,
                question.question(), question.correctAnswer(), question.category()));

        JSONObject response = new JSONObject(question.json());
        // La risposta esatta resta sul server finché il giocatore non risponde.
        response.remove("correctAnswer");
        response.remove("correctIndex");
        response.remove("explanation");
        response.put("questionId", questionId);
        response.put("playerId", playerId);
        response.put("deadlineAt", gameStateService.roundDeadline(gameId).orElse(0L));
        return ResponseEntity.ok(response.toString());
    }

    /** Prima domanda del lato richiesto, se disponibile. */
    private QuestionBankService.ArenaQuestion pickPreferredSide(
            List<QuestionBankService.ArenaQuestion> candidates, boolean preferTrue) {
        return candidates.stream()
                .filter(candidate -> "VERO".equalsIgnoreCase(candidate.correctAnswer()) == preferTrue)
                .findFirst()
                .orElse(null);
    }

    /** Prima domanda della fascia attesa, preferendo il lato VERO/FALSO corrente. */
    private QuestionBankService.ArenaQuestion pickForBand(
            List<QuestionBankService.ArenaQuestion> candidates, String band, boolean preferTrue) {
        if (candidates == null || candidates.isEmpty() || band == null) {
            return null;
        }
        QuestionBankService.ArenaQuestion sameSide = candidates.stream()
                .filter(candidate -> band.equalsIgnoreCase(candidate.difficulty()))
                .filter(candidate -> "VERO".equalsIgnoreCase(candidate.correctAnswer()) == preferTrue)
                .findFirst()
                .orElse(null);
        if (sameSide != null) {
            return sameSide;
        }
        return candidates.stream()
                .filter(candidate -> band.equalsIgnoreCase(candidate.difficulty()))
                .findFirst()
                .orElse(null);
    }

    /**
     * Pesca dal pool la prima domanda della fascia attesa, rimettendo davanti le
     * altre: il pacchetto preparato per il round resta disponibile per dopo.
     */
    private QuestionBankService.ArenaQuestion pollForBand(long gameId, String category, String band) {
        List<QuestionBankService.ArenaQuestion> skipped = new ArrayList<>();
        QuestionBankService.ArenaQuestion match = null;
        for (int attempt = 0; attempt < 8; attempt++) {
            QuestionBankService.ArenaQuestion candidate = questionPoolService
                    .poll(gameId, category)
                    .orElse(null);
            if (candidate == null) {
                break;
            }
            if (band != null && band.equalsIgnoreCase(candidate.difficulty())) {
                match = candidate;
                break;
            }
            skipped.add(candidate);
        }
        for (int index = skipped.size() - 1; index >= 0; index--) {
            questionPoolService.offerFirst(gameId, category, skipped.get(index));
        }
        return match;
    }

    /** Ordine della rampa: le facili escono prima, le difficili chiudono il round. */
    private int bandOrder(String difficulty) {
        if (difficulty == null) {
            return 1;
        }
        return switch (difficulty.toLowerCase(Locale.ROOT)) {
            case "facile", "easy" -> 0;
            case "difficile", "hard" -> 2;
            default -> 1;
        };
    }

    private String normalizeWheelPayload(String aiPayload) {
        if (aiPayload == null)
            return new JSONObject().put("proverb", "").toString();
        String p = aiPayload.trim();

        String raw = tryExtractRawProverb(p);

        if (raw == null) {
            if (p.startsWith("{")) {
                try {
                    JSONObject obj = new JSONObject(p);
                    if (obj.has("question")) {
                        String q = obj.getString("question");
                        raw = extractProverbFromQuestionText(q);
                    }
                    if (raw == null && obj.has("payload")) {
                        Object nested = obj.get("payload");
                        String nestedStr = String.valueOf(nested);
                        raw = tryExtractRawProverb(nestedStr);
                    }
                } catch (Exception ignored) {
                }
            }
        }

        if (raw == null)
            raw = p;

        JSONObject out = new JSONObject();
        out.put("proverb", raw);
        return out.toString();
    }

    private String tryExtractRawProverb(String p) {
        if (p == null)
            return null;
        String trimmed = p.trim();

        if (trimmed.startsWith("{")) {
            try {
                JSONObject obj = new JSONObject(trimmed);
                if (obj.has("proverb"))
                    return obj.getString("proverb");
                if (obj.has("payload")) {
                    Object nested = obj.get("payload");
                    String nestedStr = String.valueOf(nested).trim();
                    if (nestedStr.startsWith("{"))
                        return tryExtractRawProverb(nestedStr);
                    return nestedStr;
                }
                if (obj.has("question")) {
                    String q = obj.getString("question");
                    String ext = extractProverbFromQuestionText(q);
                    if (ext != null)
                        return ext;
                }
            } catch (Exception ignored) {
            }
        }

        if ((trimmed.startsWith("\"{") && trimmed.endsWith("}\"")) || trimmed.contains("\\{")) {
            String unquoted = trimmed;
            if (unquoted.startsWith("\"") && unquoted.endsWith("\"")) {
                unquoted = unquoted.substring(1, unquoted.length() - 1);
            }
            unquoted = unquoted.replace("\\\"", "\"");
            unquoted = unquoted.replace("\\\\", "\\");
            return tryExtractRawProverb(unquoted);
        }

        String ext = extractProverbFromQuestionText(trimmed);
        if (ext != null)
            return ext;

        return null;
    }

    private String extractProverbFromQuestionText(String text) {
        if (text == null)
            return null;
        String t = text.trim();

        int first = t.indexOf('\'');
        if (first >= 0) {
            int second = t.indexOf('\'', first + 1);
            if (second > first) {
                String inside = t.substring(first + 1, second).trim();
                if (inside.length() > 3)
                    return inside;
            }
        }

        first = t.indexOf('"');
        if (first >= 0) {
            int second = t.indexOf('"', first + 1);
            if (second > first) {
                String inside = t.substring(first + 1, second).trim();
                if (inside.length() > 3)
                    return inside;
            }
        }

        String marker = "Il proverbio ";
        int idx = t.indexOf(marker);
        if (idx >= 0) {
            int start = idx + marker.length();
            int end = t.indexOf(" significa", start);
            if (end > start) {
                String inside = t.substring(start, end).trim();
                if ((inside.startsWith("\"") && inside.endsWith("\""))
                        || (inside.startsWith("'") && inside.endsWith("'"))) {
                    inside = inside.substring(1, inside.length() - 1);
                }
                if (inside.length() > 3)
                    return inside;
            }
        }

        return null;
    }

    @PostMapping("/{id}/round")
    public GameRound nextRound(
            @PathVariable("id") Long id,
            @RequestParam(value = "difficulty", defaultValue = "EASY") String difficulty) {
        Game game = gameRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Gioco non trovato"));

        GameRound round = simpleRoundService.createRound(game, difficulty);

        gameStateService.startRound(id,
                round.getType() == null ? "QUIZ" : round.getType().name(),
                round.getRoundIndex(), "g" + id + "-r" + round.getRoundIndex(), round.getPayload());

        messagingTemplate.convertAndSend("/topic/game/" + id, round);

        return round;
    }

    /**
     * Prepara il pacchetto di domande del round: una sola chiamata AI per tutti
     * i telefoni, che poi pescano dal pool senza toccare il provider.
     */
    @GetMapping("/{gameId}/arena/prepare")
    public Map<String, Object> prepareArena(@PathVariable("gameId") Long gameId,
            @RequestParam("category") String category,
            @RequestParam(value = "count", defaultValue = "20") int count) {
        int wanted = Math.max(1, Math.min(30, count));
        Predicate<QuestionBankService.ArenaQuestion> isAvailable = candidate -> !questionHistory.isUsed(gameId, candidate.key())
                && !questionHistory.isUsed(gameId, candidate.answerKey());

        // Il pacchetto del round esce in ordine di difficolta: la rampa facile ->
        // media -> difficile e gia rispettata quando i telefoni pescano dal pool.
        List<QuestionBankService.ArenaQuestion> generated = new ArrayList<>(questionBank
                .generateArenaBatch(category, wanted, isAvailable));
        generated.sort(Comparator.comparingInt(candidate -> bandOrder(candidate.difficulty())));

        for (QuestionBankService.ArenaQuestion candidate : generated) {
            questionHistory.claim(gameId, candidate.key());
            questionHistory.claim(gameId, candidate.answerKey());
            questionPoolService.offer(gameId, category, candidate);
        }

        return Map.of(
                "category", category,
                "generated", generated.size(),
                "pool", questionPoolService.size(gameId, category));
    }

    /** Il giusto/sbagliato lo decide il server, non il telefono. */
    @PostMapping("/{gameId}/arena-answer")
    public ResponseEntity<Object> answerArenaQuestion(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerId = String.valueOf(body.getOrDefault("playerId", "anonimo"));
        String questionId = String.valueOf(body.getOrDefault("questionId", ""));
        String answer = String.valueOf(body.getOrDefault("answer", ""));
        Object rawKey = body.get("idempotencyKey");
        String idempotencyKey = rawKey == null ? null : String.valueOf(rawKey);
        String deviceId = body.get("deviceId") == null ? playerId : String.valueOf(body.get("deviceId"));

        if (!gameStateService.isRoundOpen(gameId)) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "round-closed",
                    "message", "Il round è scaduto: la risposta non è stata registrata.",
                    "deadlineAt", gameStateService.roundDeadline(gameId).orElse(0L)));
        }

        // Idempotenza + ACK dopo il commit: se la transazione non conferma il
        // telefono non riceve una conferma, e il retry non duplica i punti.
        Map<String, Object> result = idempotencyService.executeOnce(gameId, idempotencyKey,
                "ARENA_ANSWER", deviceId, () -> questionHistory
                        .answer(gameId, playerId, questionId, answer)
                        .map(arena -> {
                            gameStateService.appendEvent(gameId, "ARENA_ANSWER", new JSONObject()
                                    .put("playerName", playerId)
                                    .put("questionId", questionId)
                                    .put("correct", arena.correct())
                                    .put("points", arena.points())
                                    .put("totalScore", arena.totalScore())
                                    .toString());
                            Map<String, Object> ok = new LinkedHashMap<>();
                            ok.put("playerName", playerId);
                            ok.put("correct", arena.correct());
                            ok.put("correctAnswer", arena.correctAnswer());
                            ok.put("points", arena.points());
                            ok.put("totalScore", arena.totalScore());
                            return ok;
                        })
                        .orElse(null));

        if (result == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Domanda non trovata per questo giocatore"));
        }
        // Pubblica solo dopo executeOnce: un retry con la stessa chiave non
        // deve assegnare una seconda volta i punti alla classifica della TV.
        if (!Boolean.TRUE.equals(result.get("replayed"))) {
            messagingTemplate.convertAndSend("/topic/game/" + gameId + "/status", (Object) Map.of(
                    "action", "ARENA_ANSWER",
                    "playerName", result.get("playerName"),
                    "isCorrect", result.get("correct"),
                    "points", result.get("points")));
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Punteggi dell'arena calcolati dal server.
     *
     * La TV li legge da qui invece di fidarsi del messaggio del telefono: un
     * dispositivo non può più dichiararsi vincente.
     */
    @GetMapping("/{gameId}/arena/scores")
    public Map<String, Object> arenaScores(@PathVariable("gameId") Long gameId) {
        Map<String, Integer> scores = questionHistory.scores(gameId);
        int bestScore = scores.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        return Map.of("gameId", gameId, "scores", scores, "bestScore", bestScore);
    }

    /**
     * Reset completo della partita: stato autorevole, eventi, round, punteggi e
     * giochi party. La TV lo chiama prima di ricaricare, così il contatore dei
     * round riparte da 1 anche sul server.
     */
    @PostMapping("/{gameId}/reset")
    public Map<String, Object> resetGame(@PathVariable("gameId") Long gameId) {
        gameStateService.reset(gameId);
        questionHistory.forget(gameId);
        questionPoolService.clear(gameId);
        ultimaSpiaggiaLevelService.clear(gameId);
        partyGameService.forget(gameId);
        bombaService.reset(gameId);
        scoreboard.forget(gameId);
        stateBlobs.forget(gameId, "time-buzzer-start");
        return Map.of("reset", true, "gameId", gameId);
    }

    /** Azzera memoria e punteggi dell'arena (nuova partita o reset dalla TV). */
    @PostMapping("/{gameId}/arena/reset")
    public Map<String, Object> resetArena(@PathVariable("gameId") Long gameId) {
        questionHistory.forget(gameId);
        questionPoolService.clear(gameId);
        ultimaSpiaggiaLevelService.clear(gameId);
        return Map.of("reset", true, "gameId", gameId);
    }

    /** La TV registra il livello appena scelto dalla squadra. */
    @PostMapping("/{gameId}/ultima-spiaggia/level")
    public Map<String, Object> recordUltimaSpiaggiaLevel(@PathVariable("gameId") Long gameId,
            @RequestBody Map<String, Object> body) {
        String playerName = String.valueOf(body.getOrDefault("playerName", "")).trim();
        int level = 0;
        try {
            level = Integer.parseInt(String.valueOf(body.getOrDefault("level", "0")));
        } catch (NumberFormatException ignored) {
            // Livello non valido: il service lo scarta.
        }
        ultimaSpiaggiaLevelService.record(gameId, playerName, level);
        return Map.of("gameId", gameId, "playerName", playerName, "level", level);
    }

    private String attachUltimaSpiaggiaLevels(String payload, long gameId) {
        try {
            JSONObject obj = new JSONObject(payload);
            obj.put("usedLevels", ultimaSpiaggiaLevelService.usedLevels(gameId));
            return obj.toString();
        } catch (Exception ignored) {
            return payload;
        }
    }

    /**
     * Chiude il round corrente sul server. La TV lo chiama quando il
     * presentatore preme AVANTI durante un gioco ancora aperto: senza questa
     * chiusura il backend restava su un round mai terminato (e il successivo
     * partiva con un indice sfasato).
     */
    @PostMapping("/{gameId}/round/close")
    public Map<String, Object> closeRound(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        String reason = body == null ? "skipped"
                : String.valueOf(body.getOrDefault("reason", "skipped"));
        gameStateService.closeRound(gameId, reason);
        return Map.of("closed", true, "gameId", gameId, "reason", reason);
    }

    /**
     * Round corrente letto dallo stato autorevole.
     *
     * <p>Prima rispondeva l'ultimo {@code game_round} salvato: tra la chiusura
     * del round precedente e il salvataggio del nuovo, per qualche istante il
     * client riceveva il gioco sbagliato (osservato su Timeline).</p>
     */
    @GetMapping("/{gameId}/current-round")
    public ResponseEntity<Object> getCurrentRound(@PathVariable("gameId") Long gameId) {
        return gameStateService.currentRound(gameId)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}