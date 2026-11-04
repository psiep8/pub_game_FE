package com.pub_game_be.controller;

import com.pub_game_be.domain.enums.GameStatus;
import com.pub_game_be.domain.enums.GameType;
import com.pub_game_be.domain.enums.RoundStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.domain.game_round.GameRound;
import com.pub_game_be.repository.GameRepository;
import com.pub_game_be.repository.GameRoundRepository;
import com.pub_game_be.service.GameService;
import com.pub_game_be.service.QuestionHistoryService;
import com.pub_game_be.service.QuestionPoolService;
import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
import com.pub_game_be.service.SimpleRoundService;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.List;
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

    public GameController(GameRepository gameRepo,
            GameRoundRepository gameRoundRepository,
            SimpleRoundService simpleRoundService,
            GameService gameService,
            QuestionBankService questionBank,
            SimpMessagingTemplate messagingTemplate,
            QuestionHistoryService questionHistory,
            QuestionPoolService questionPoolService,
            PartyGameService partyGameService) {
        this.gameRepo = gameRepo;
        this.gameRoundRepository = gameRoundRepository;
        this.simpleRoundService = simpleRoundService;
        this.gameService = gameService;
        this.questionBank = questionBank;
        this.messagingTemplate = messagingTemplate;
        this.questionHistory = questionHistory;
        this.questionPoolService = questionPoolService;
        this.partyGameService = partyGameService;
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

        String aiPayload;
        if (partyGameService.handles(type)) {
            // Timeline, Quanto costa, Speed Rush e Ping Pong non usano la banca
            // domande: il payload (e lo stato del round) vive nel servizio party.
            aiPayload = partyGameService.startRound(gameId, type);
            if (aiPayload == null) {
                throw new RuntimeException("Tipo di gioco non gestito: " + type);
            }
        } else {
            // La deduplica la fa la banca: se la domanda è già uscita ne pesca un'altra.
            aiPayload = questionBank.generateQuestionJson(category, type, difficulty,
                    key -> !questionHistory.isUsed(gameId, key));
            questionHistory.claim(gameId, QuestionBankService.payloadDedupeKey(aiPayload));
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

        int nextIndex = (int) gameRoundRepository.countByGameId(gameId);
        round.setRoundIndex(nextIndex);

        GameRound savedRound = gameRoundRepository.save(round);

        messagingTemplate.convertAndSend(
                "/topic/game/" + gameId,
                savedRound);

        return savedRound;
    }

    @GetMapping("/{gameId}/arena-question")
    public String getArenaQuestion(@PathVariable("gameId") Long gameId,
            @RequestParam("category") String category,
            @RequestParam(value = "playerId", defaultValue = "anonimo") String playerId) {
        Predicate<QuestionBankService.ArenaQuestion> isAvailable = candidate -> !questionHistory.isUsed(gameId, candidate.key())
                && !questionHistory.isUsed(gameId, candidate.answerKey());

        QuestionBankService.ArenaQuestion question = questionPoolService
                .poll(gameId, category)
                .orElse(null);

        if (question == null) {
            // Alternanza VERO/FALSO per partita: la banca pende verso VERO, così
            // indovinare sempre VERO non conviene più. Se il lato richiesto è
            // esaurito nella categoria si allarga alle altre, invece di servire
            // sempre lo stesso lato fino a fine partita.
            boolean preferTrue = questionHistory.preferTrueSide(gameId);
            question = pickPreferredSide(questionBank.generateArenaBatch(category, 8, isAvailable), preferTrue);

            if (question == null) {
                List<QuestionBankService.ArenaQuestion> anyCategory = questionBank
                        .generateArenaBatch(null, 8, isAvailable);
                question = pickPreferredSide(anyCategory, preferTrue);
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
        response.put("questionId", questionId);
        response.put("playerId", playerId);
        return response.toString();
    }

    /** Prima domanda del lato richiesto, se disponibile. */
    private QuestionBankService.ArenaQuestion pickPreferredSide(
            List<QuestionBankService.ArenaQuestion> candidates, boolean preferTrue) {
        return candidates.stream()
                .filter(candidate -> "VERO".equalsIgnoreCase(candidate.correctAnswer()) == preferTrue)
                .findFirst()
                .orElse(null);
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

        List<QuestionBankService.ArenaQuestion> generated = questionBank
                .generateArenaBatch(category, wanted, isAvailable);

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

        return questionHistory.answer(gameId, playerId, questionId, answer)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.badRequest()
                        .body(Map.of("error", "Domanda non trovata per questo giocatore")));
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

    /** Azzera memoria e punteggi dell'arena (nuova partita o reset dalla TV). */
    @PostMapping("/{gameId}/arena/reset")
    public Map<String, Object> resetArena(@PathVariable("gameId") Long gameId) {
        questionHistory.forget(gameId);
        questionPoolService.clear(gameId);
        return Map.of("reset", true, "gameId", gameId);
    }

    @GetMapping("/{gameId}/current-round")
    public ResponseEntity<GameRound> getCurrentRound(@PathVariable("gameId") Long gameId) {
        return gameService.getCurrentRound(gameId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}