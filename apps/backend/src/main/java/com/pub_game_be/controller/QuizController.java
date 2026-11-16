package com.pub_game_be.controller;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.service.QuizService;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Voti del Quiz.
 *
 * <p>La TV annuncia la manche, il telefono manda solo l'indice scelto e il
 * server decide tempo, correttezza e punti. L'esito viene trasmesso sul topic
 * di stato, così una TV che si è appena riallineata vede subito le risposte
 * arrivate mentre era via.</p>
 */
@RestController
@RequestMapping("/games")
public class QuizController {

    private final QuizService quizService;
    private final SimpMessagingTemplate messaging;

    public QuizController(QuizService quizService, SimpMessagingTemplate messaging) {
        this.quizService = quizService;
        this.messaging = messaging;
    }

    /** La TV apre la manche: senza questo annuncio i voti non vengono accettati. */
    @PostMapping("/{gameId}/quiz/manche")
    public ResponseEntity<Object> startManche(@PathVariable("gameId") Long gameId,
            @RequestBody(required = false) Map<String, Object> body) {
        Object raw = body == null ? null : body.get("manche");
        if (!(raw instanceof Number number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "manche-mancante"));
        }
        return ResponseEntity.ok(quizService.startManche(gameId, number.intValue()).toMap());
    }

    /** Voto del telefono autenticato: doppio voto e voto in ritardo vengono rifiutati. */
    @PostMapping("/{gameId}/quiz/answer")
    public ResponseEntity<Object> answer(@PathVariable("gameId") Long gameId,
            @RequestAttribute("pubgame.session") DeviceSessionEntity session,
            @RequestBody(required = false) Map<String, Object> body) {
        Object raw = body == null ? null : body.get("optionIndex");
        if (!(raw instanceof Number number)) {
            return ResponseEntity.badRequest().body(Map.of("error", "option-required"));
        }

        QuizService.Outcome outcome = quizService.answer(gameId, session.getPlayerName(), number.intValue());
        if (!outcome.accepted()) {
            return ResponseEntity.status(409).body(Map.of("error", outcome.reason()));
        }

        JSONObject result = outcome.result();
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("action", "QUIZ_ANSWER");
        event.put("playerName", result.optString("playerName"));
        event.put("manche", result.optInt("manche"));
        event.put("optionIndex", result.optInt("optionIndex"));
        event.put("isCorrect", result.optBoolean("isCorrect"));
        event.put("points", result.optInt("points"));
        event.put("answeredAt", result.optLong("answeredAt"));
        messaging.convertAndSend("/topic/game/" + gameId + "/status", (Object) event);

        return ResponseEntity.ok(result.toMap());
    }

    /** Risposte già registrate: la TV le rilegge dopo un refresh. */
    @GetMapping("/{gameId}/quiz/answers")
    public ResponseEntity<Object> answers(@PathVariable("gameId") Long gameId) {
        return ResponseEntity.ok(quizService.summary(gameId).toMap());
    }
}
