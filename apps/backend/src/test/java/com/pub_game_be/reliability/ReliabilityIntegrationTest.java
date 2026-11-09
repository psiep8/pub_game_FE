package com.pub_game_be.reliability;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pub_game_be.controller.GameController;
import com.pub_game_be.reliability.repository.QuestionUsageRepository;
import com.pub_game_be.service.QuestionHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica i requisiti di affidabilità che non si vedono a occhio nudo:
 * idempotenza delle risposte, eventi mancanti, presenza dei dispositivi e
 * domande che restano usate anche dopo un riavvio del processo.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:reliability-it;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.reliability.answer-window-seconds=300"
})
class ReliabilityIntegrationTest {

    private final ObjectMapper json = new ObjectMapper();

    @Autowired
    private GameController gameController;

    @Autowired
    private IdempotencyService idempotency;

    @Autowired
    private GameStateService gameState;

    @Autowired
    private QuestionHistoryService questionHistory;

    @Autowired
    private QuestionUsageService questionUsage;

    @Autowired
    private QuestionUsageRepository questionUsageRepository;

    @Autowired
    private DeviceSessionService sessions;

    @Autowired
    private ReliabilityProperties properties;

    @Test
    void rispostaRipetutaNonAssegnaDueVolteIPunti() {
        long gameId = 501L;
        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q-1", "SquadraTest", "Domanda", "VERO", "Storia"));

        AtomicInteger effects = new AtomicInteger();
        Supplier<Map<String, Object>> action = () -> questionHistory
                .answer(gameId, "SquadraTest", "q-1", "VERO")
                .map(arena -> {
                    effects.incrementAndGet();
                    Map<String, Object> result = new HashMap<>();
                    result.put("correct", arena.correct());
                    result.put("points", arena.points());
                    result.put("totalScore", arena.totalScore());
                    return result;
                })
                .orElse(null);

        Map<String, Object> first = idempotency.executeOnce(gameId, "chiave-1", "ARENA_ANSWER", "dev-1", action);
        Map<String, Object> second = idempotency.executeOnce(gameId, "chiave-1", "ARENA_ANSWER", "dev-1", action);

        assertThat(first).isNotNull();
        assertThat(first.get("replayed")).isEqualTo(false);
        // Il retry riceve la stessa conferma, senza rifare la mutazione.
        assertThat(second.get("replayed")).isEqualTo(true);
        assertThat(second.get("totalScore")).isEqualTo(first.get("totalScore"));
        assertThat(effects.get()).isEqualTo(1);
        assertThat(questionHistory.scores(gameId)).containsEntry("SquadraTest", 10);
    }

    @Test
    void laSincronizzazioneRestituisceSoloGliEventiMancanti() throws Exception {
        long gameId = 502L;

        GameStateService.Change firstEvent = gameState.appendEvent(gameId, "TEST_EVENT", "{\"n\":1}");
        GameStateService.Change secondEvent = gameState.appendEvent(gameId, "TEST_EVENT", "{\"n\":2}");

        // Ogni evento ha una posizione e un identificativo propri: due eventi
        // non possono occupare la stessa sequenza.
        assertThat(firstEvent.seq()).isNotEqualTo(secondEvent.seq());
        assertThat(firstEvent.eventId()).isNotEqualTo(secondEvent.eventId());

        JsonNode full = json.readTree(gameState.sync(gameId, 0).toString());
        assertThat(full.get("toSeq").asLong()).isEqualTo(secondEvent.seq());
        assertThat(full.get("events")).hasSize(2);

        JsonNode missed = json.readTree(gameState.eventsSince(gameId, firstEvent.seq()).toString());
        assertThat(missed).hasSize(1);
        assertThat(missed.get(0).get("seq").asLong()).isEqualTo(secondEvent.seq());
        assertThat(missed.get(0).get("eventId").asText()).isEqualTo(secondEvent.eventId());

        // Chi è già aggiornato non riceve eventi ripetuti.
        assertThat(gameState.eventsSince(gameId, secondEvent.seq()).length()).isZero();
    }

    @Test
    void laSincronizzazionePaginataNonSaltaEventi() throws Exception {
        long gameId = 507L;
        int previousLimit = properties.getEventHistoryLimit();
        properties.setEventHistoryLimit(2);
        try {
            gameState.appendEvent(gameId, "TEST_EVENT", "{}");
            gameState.appendEvent(gameId, "TEST_EVENT", "{}");
            gameState.appendEvent(gameId, "TEST_EVENT", "{}");

            JsonNode first = json.readTree(gameState.sync(gameId, 0).toString());
            assertThat(first.get("events")).hasSize(2);
            assertThat(first.get("toSeq").asLong()).isEqualTo(2);
            assertThat(first.get("complete").asBoolean()).isFalse();
            JsonNode second = json.readTree(gameState.sync(gameId, first.get("toSeq").asLong()).toString());
            assertThat(second.get("events")).hasSize(1);
            assertThat(second.get("events").get(0).get("seq").asLong()).isEqualTo(3);
            assertThat(second.get("toSeq").asLong()).isEqualTo(3);
            assertThat(second.get("complete").asBoolean()).isTrue();
        } finally {
            properties.setEventHistoryLimit(previousLimit);
        }
    }

    @Test
    void laSessioneRipresaMantieneLoStessoDispositivo() throws Exception {
        long gameId = 503L;

        DeviceSessionService.Registration first = sessions.register(gameId, "device-tv", "TV", null, null);
        assertThat(first.sessionToken()).isNotBlank();
        assertThat(first.resumed()).isFalse();

        DeviceSessionService.Registration resumed = sessions.register(gameId, "device-tv", "TV", null,
                first.sessionToken());
        assertThat(resumed.resumed()).isTrue();
        assertThat(resumed.sessionToken()).isEqualTo(first.sessionToken());

        JsonNode summary = json.readTree(sessions.summary(gameId).toString());
        assertThat(summary.get("devices").asInt()).isEqualTo(1);
        assertThat(summary.get("connected").asInt()).isEqualTo(1);
        assertThat(summary.get("reconnections").asInt()).isGreaterThanOrEqualTo(1);

        JsonNode presence = json.readTree(sessions.presence(gameId).toString());
        assertThat(presence).hasSize(1);
        assertThat(presence.get(0).get("role").asText()).isEqualTo("TV");
        assertThat(presence.get(0).get("connected").asBoolean()).isTrue();
    }

    @Test
    void conoscereIlDeviceIdNonPermetteDiRecuperareUnToken() {
        long gameId = 508L;
        DeviceSessionService.Registration original = sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", null);
        DeviceSessionService.Registration attacker = sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", null);
        DeviceSessionService.Registration wrongToken = sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", "wrong");

        assertThat(attacker.resumed()).isFalse();
        assertThat(wrongToken.resumed()).isFalse();
        assertThat(attacker.sessionToken()).isNotEqualTo(original.sessionToken());
        assertThat(wrongToken.sessionToken()).isNotEqualTo(original.sessionToken());
        assertThat(sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", original.sessionToken()).resumed()).isTrue();
    }

    @Test
    void laPresenzaEscludeGliOfflineEDeduplicaIPlayer() throws Exception {
        long gameId = 506L;

        DeviceSessionService.Registration first = sessions.register(gameId, "remote-a", "REMOTE", "Anna", null);
        DeviceSessionService.Registration second = sessions.register(gameId, "remote-b", "REMOTE", "Anna", null);
        DeviceSessionService.Registration offline = sessions.register(gameId, "remote-c", "REMOTE", "Carla", null);
        sessions.disconnect(offline.sessionToken());

        JsonNode presence = json.readTree(sessions.presence(gameId).toString());
        assertThat(presence).hasSize(1);
        assertThat(presence.get(0).get("playerName").asText()).isEqualTo("Anna");
        assertThat(presence.get(0).get("connected").asBoolean()).isTrue();

        sessions.disconnect(first.sessionToken());
        sessions.disconnect(second.sessionToken());
        assertThat(json.readTree(sessions.presence(gameId).toString())).isEmpty();
        assertThat(json.readTree(sessions.summary(gameId).toString()).get("connected").asInt()).isZero();
    }

    @Test
    void laDomandaUsataSopravviveAlRiavvioDelProcesso() {
        long gameId = 504L;
        String key = "domanda-di-prova|risposta";

        assertThat(questionUsage.claim(gameId, key, "q-test", "QUIZ", 1)).isTrue();
        assertThat(questionUsage.claim(gameId, key, "q-test", "QUIZ", 1)).isFalse();

        // La verità è nel database, non nella cache del processo: dopo un
        // riavvio la domanda resta esclusa dal pool.
        assertThat(questionUsageRepository.findByGameIdAndQuestionKey(gameId, key)).isPresent();
        assertThat(questionUsageRepository.countByGameId(gameId)).isEqualTo(1);
    }

    @Test
    void laRispostaArenaPassaDalControllerSoloUnaVolta() {
        long gameId = 505L;
        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q-2", "SquadraDue", "Domanda", "FALSO", "Storia"));

        Map<String, Object> body = new HashMap<>();
        body.put("playerId", "SquadraDue");
        body.put("questionId", "q-2");
        body.put("answer", "FALSO");
        body.put("idempotencyKey", "squadra-due-q2");
        body.put("deviceId", "device-due");

        ResponseEntity<Object> first = gameController.answerArenaQuestion(gameId, body);
        ResponseEntity<Object> second = gameController.answerArenaQuestion(gameId, body);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) second.getBody()).get("replayed")).isEqualTo(true);
        assertThat(questionHistory.scores(gameId)).containsEntry("SquadraDue", 10);
    }
}
