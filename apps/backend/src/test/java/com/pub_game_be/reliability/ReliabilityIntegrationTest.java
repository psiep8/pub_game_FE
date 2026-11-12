package com.pub_game_be.reliability;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pub_game_be.controller.GameController;
import com.pub_game_be.reliability.repository.GameEventRepository;
import com.pub_game_be.reliability.repository.GameStateRepository;
import com.pub_game_be.reliability.repository.QuestionUsageRepository;
import com.pub_game_be.repository.GameRoundRepository;
import com.pub_game_be.service.QuestionHistoryService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CompletionStage;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import org.springframework.web.server.ResponseStatusException;

/**
 * Verifica i requisiti di affidabilità che non si vedono a occhio nudo:
 * idempotenza delle risposte, eventi mancanti, presenza dei dispositivi e
 * domande che restano usate anche dopo un riavvio del processo.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:reliability-it;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.reliability.answer-window-seconds=300",
        "game.security.control-secret=0123456789abcdef0123456789abcdef"
})
class ReliabilityIntegrationTest {

    private final ObjectMapper json = new ObjectMapper();

    @LocalServerPort
    private int port;

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

    @Autowired
    private GameStateRepository stateRepository;

    @Autowired
    private GameEventRepository eventRepository;

    @Autowired
    private GameRoundRepository roundRepository;

    @Autowired
    private com.pub_game_be.repository.GameRepository gameRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private com.pub_game_be.reliability.repository.DeviceSessionRepository sessionRepository;

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
    void ottoAppendConcorrentiNonDuplicanoLaSequenza() throws Exception {
        long gameId = 551L;
        gameState.state(gameId);

        // Due istanze con lock Java separati, come due processi che condividono
        // lo stesso database: l'unicità del seq non può dipendere dal lock JVM.
        GameStateService secondInstance = new GameStateService(stateRepository, eventRepository,
                roundRepository, properties, transactionManager, entityManager);

        int workers = 8;
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<GameStateService.Change>> futures = new ArrayList<>();
        try {
            for (int worker = 0; worker < workers; worker++) {
                int index = worker;
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    GameStateService target = index % 2 == 0 ? gameState : secondInstance;
                    return target.appendEvent(gameId, "TEST_EVENT", "{\"worker\":" + index + "}");
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Long> sequences = new ArrayList<>();
            for (Future<GameStateService.Change> future : futures) {
                sequences.add(future.get(30, TimeUnit.SECONDS).seq());
            }
            assertThat(sequences).doesNotHaveDuplicates();
            assertThat(sequences).containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L);
            assertThat(gameState.currentSeq(gameId)).isEqualTo(8);
            assertThat(gameState.eventCount(gameId)).isEqualTo(8);
        } finally {
            pool.shutdownNow();
        }
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
    void syncUsaIlTokenNellHeaderEIgnoraIlParametroUrl() throws Exception {
        long gameId = 509L;
        var registration = sessions.register(gameId, "remote-sync", "REMOTE", "Anna", null);
        sessions.disconnect(registration.sessionToken());
        HttpClient http = HttpClient.newHttpClient();
        var queryRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/games/" + gameId
                + "/sync?sessionToken=" + registration.sessionToken())).GET().build();
        assertThat(http.send(queryRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
        assertThat(sessions.isConnected(sessions.all(gameId).getFirst())).isFalse();

        var headerRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/games/" + gameId + "/sync"))
                .header("X-Session-Token", registration.sessionToken()).GET().build();
        assertThat(http.send(headerRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
        assertThat(sessions.isConnected(sessions.all(gameId).getFirst())).isTrue();
    }

    @Test
    void conoscereIlDeviceIdNonPermetteDiRecuperareUnToken() {
        long gameId = 508L;
        DeviceSessionService.Registration original = sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", null);
        assertThatThrownBy(() -> sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", null))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", "wrong"))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(sessions.register(gameId, "device-not-secret", "REMOTE", "Anna", original.sessionToken()).resumed()).isTrue();
    }

    @Test
    void laPresenzaEscludeGliOfflineEDeduplicaIPlayer() throws Exception {
        long gameId = 506L;

        DeviceSessionService.Registration first = sessions.register(gameId, "remote-a", "REMOTE", "Anna", null);
        assertThatThrownBy(() -> sessions.register(gameId, "remote-b", "REMOTE", "anna", null))
                .isInstanceOf(ResponseStatusException.class);
        DeviceSessionService.Registration offline = sessions.register(gameId, "remote-c", "REMOTE", "Carla", null);
        sessions.disconnect(offline.sessionToken());

        JsonNode presence = json.readTree(sessions.presence(gameId).toString());
        assertThat(presence).hasSize(1);
        assertThat(presence.get(0).get("playerName").asText()).isEqualTo("Anna");
        assertThat(presence.get(0).get("connected").asBoolean()).isTrue();

        sessions.disconnect(first.sessionToken());
        assertThat(json.readTree(sessions.presence(gameId).toString())).isEmpty();
        assertThat(json.readTree(sessions.summary(gameId).toString()).get("connected").asInt()).isZero();
    }

    @Test
    void autorizzazioneHttpRichiedeRuoloPartitaESquadra() throws Exception {
        long id = 511L;
        String base = "/games/" + id;
        String sessionBody = "{\"deviceId\":\"device\",\"role\":\"TV\"}";
        assertThat(request("POST", base + "/session", null, null, sessionBody).statusCode()).isEqualTo(401);
        assertThat(request("POST", base + "/session", null, "wrong", sessionBody).statusCode()).isEqualTo(401);
        var control = request("POST", base + "/session", null, "0123456789abcdef0123456789abcdef", sessionBody);
        assertThat(control.statusCode()).isEqualTo(200);
        String tv = json.readTree(control.body()).get("sessionToken").asText();
        assertThat(request("POST", base + "/session", null, null,
                "{\"deviceId\":\"device\",\"role\":\"TV\",\"sessionToken\":\"" + tv + "\"}").statusCode()).isEqualTo(200);
        var remote = request("POST", base + "/session", null, null,
                "{\"deviceId\":\"r\",\"role\":\"REMOTE\",\"playerName\":\"Anna\"}");
        assertThat(remote.statusCode()).isEqualTo(200);
        String anna = json.readTree(remote.body()).get("sessionToken").asText();
        var resumed = request("POST", base + "/session", null, null,
                "{\"deviceId\":\"r\",\"role\":\"REMOTE\",\"playerName\":\"Anna\",\"sessionToken\":\"" + anna + "\"}");
        assertThat(json.readTree(resumed.body()).get("resumed").asBoolean()).isTrue();
        assertThat(request("POST", base + "/session/heartbeat", anna, null,
                "{\"sessionToken\":\"" + anna + "\",\"seq\":0}").statusCode()).isEqualTo(200);
        // Token scaduto o body assente: il client deve ricevere 410 "ri-registra",
        // non un 401 che sembra una credenziale di regia sbagliata.
        assertThat(request("POST", base + "/session/heartbeat", null, null,
                "{\"sessionToken\":\"scaduto\",\"seq\":0}").statusCode()).isEqualTo(410);
        assertThat(request("POST", base + "/session/heartbeat", null, null, null).statusCode())
                .isEqualTo(410);
        assertThat(request("POST", base + "/session", null, null,
                "{\"deviceId\":\"x\",\"role\":\"REMOTE\",\"playerName\":\"anna\"}").statusCode()).isEqualTo(409);
        assertThat(request("POST", base + "/session", null, null,
                "{\"role\":\"REMOTE\",\"playerName\":\"Bruno\",\"sessionToken\":\"" + anna + "\"}").statusCode()).isEqualTo(403);
        assertThat(request("POST", base + "/reset", null, null, "{}").statusCode()).isEqualTo(401);
        assertThat(request("POST", base + "/reset", "wrong", null, "{}").statusCode()).isEqualTo(401);
        assertThat(request("POST", base + "/reset", anna, null, "{}").statusCode()).isEqualTo(403);
        assertThat(request("GET", "/games/512/sync", anna, null, null).statusCode()).isEqualTo(403);
        assertThat(request("GET", base + "/sync", anna, null, null).statusCode()).isEqualTo(200);
        assertThat(request("GET", base + "/arena-question?category=STORIA&playerId=Bruno", anna, null, null).statusCode()).isEqualTo(403);
        assertThat(request("GET", base + "/bomba/state?player=Bruno", anna, null, null).statusCode()).isEqualTo(403);
        for (String endpoint : new String[] { "timeline-answer", "bomba/pick", "time-buzzer/stop" }) {
            assertThat(request("POST", base + "/" + endpoint, anna, null,
                    "{\"playerName\":\"Bruno\"}").statusCode()).isEqualTo(403);
        }
        assertThat(request("POST", base + "/arena-answer", anna, null,
                "{\"playerId\":\"Bruno\"}").statusCode()).isEqualTo(403);
        var brunoResponse = request("POST", base + "/session", null, null,
                "{\"deviceId\":\"b\",\"role\":\"REMOTE\",\"playerName\":\"Bruno\"}");
        String bruno = json.readTree(brunoResponse.body()).get("sessionToken").asText();
        questionHistory.assign(id, new QuestionHistoryService.ArenaAssignment("anna-q", "Anna", "Q", "VERO", "S"));
        questionHistory.assign(id, new QuestionHistoryService.ArenaAssignment("bruno-q", "Bruno", "Q", "VERO", "S"));
        String answerA = "{\"playerId\":\"Anna\",\"questionId\":\"anna-q\",\"answer\":\"VERO\",\"idempotencyKey\":\"shared\"}";
        String answerB = "{\"playerId\":\"Bruno\",\"questionId\":\"bruno-q\",\"answer\":\"VERO\",\"idempotencyKey\":\"shared\"}";
        assertThat(json.readTree(request("POST", base + "/arena-answer", anna, null, answerA).body()).get("playerName").asText()).isEqualTo("Anna");
        assertThat(json.readTree(request("POST", base + "/arena-answer", bruno, null, answerB).body()).get("playerName").asText()).isEqualTo("Bruno");
        assertThat(request("POST", base + "/arena-answer", anna, null, answerA.replace("shared", "another-key")).statusCode()).isEqualTo(400);
        assertThat(request("POST", base + "/reset", tv, null, "{}").statusCode()).isEqualTo(200);
        var adminResponse = request("POST", base + "/session", null, "0123456789abcdef0123456789abcdef",
                "{\"deviceId\":\"admin\",\"role\":\"ADMIN\"}");
        assertThat(adminResponse.statusCode()).isEqualTo(200);
        String admin = json.readTree(adminResponse.body()).get("sessionToken").asText();
        assertThat(request("POST", base + "/session/disconnect", anna, null,
                "{\"sessionToken\":\"" + admin + "\"}").statusCode()).isEqualTo(403);
        assertThat(request("GET", base + "/diagnostics", admin, null, null).statusCode()).isEqualTo(200);
        var question = request("GET", base + "/arena-question?category=STORIA&playerId=Anna", anna, null, null);
        assertThat(question.statusCode()).isEqualTo(200);
        var arena = json.readTree(question.body());
        assertThat(arena.has("correctAnswer")).isFalse();
        assertThat(arena.has("explanation")).isFalse();
        assertThat(arena.has("correctIndex")).isFalse();
    }

    @Test
    void syncTelefonoNonEsponeLeSoluzioni() throws Exception {
        long id = 517L;
        var remote = sessions.register(id, "r", "REMOTE", "Anna", null);
        gameState.startRound(id, "QUIZ", 1, "quiz-517", "{\"question\":\"Q\",\"correctAnswer\":\"A\",\"questions\":[{\"correctAnswer\":\"B\",\"options\":[\"A\",\"B\"]}]}");
        gameState.appendEvent(id, "TEST_EVENT", "{\"description\":\"Messaggio\",\"nested\":\"{\\\"correctAnswer\\\":\\\"SECRET\\\",\\\"question\\\":\\\"Nascosta\\\"}\"}");
        var result = request("GET", "/games/517/sync", remote.sessionToken(), null, null);
        assertThat(result.statusCode()).isEqualTo(200);
        assertThat(result.body()).doesNotContain("correctAnswer", "correctIndex", "explanation", "SECRET");
        JsonNode sync = json.readTree(result.body());
        JsonNode payload = sync.path("snapshot").path("payload");
        assertThat(payload.path("question").asText()).isEqualTo("Q");
        assertThat(payload.path("questions").get(0).path("options").get(0).asText()).isEqualTo("A");
        assertThat(payload.path("questions").get(0).path("options").get(1).asText()).isEqualTo("B");
        JsonNode event = sync.path("events").get(1).path("payload");
        assertThat(event.path("description").asText()).isEqualTo("Messaggio");
        assertThat(json.readTree(event.path("nested").asText()).path("question").asText()).isEqualTo("Nascosta");
    }

    @Test
    void syncTelefonoNascondeProverbioEMetadatiDellaCanzone() throws Exception {
        var wheel = sessions.register(520L, "wheel", "REMOTE", "Anna", null);
        gameState.startRound(520L, "WHEEL_OF_FORTUNE", 1, "wheel", "{\"proverb\":\"SEGRETO\",\"hint\":\"Indizio\"}");
        var wheelSync = request("GET", "/games/520/sync", wheel.sessionToken(), null, null);
        assertThat(wheelSync.statusCode()).isEqualTo(200);
        assertThat(wheelSync.body()).contains("Indizio").doesNotContain("SEGRETO", "proverb");

        var music = sessions.register(521L, "music", "REMOTE", "Anna", null);
        gameState.startRound(521L, "MUSIC", 1, "music", "{\"songTitle\":\"TITOLO\",\"artist\":\"ARTISTA\",\"previewUrl\":\"/TITOLO.mp3\",\"albumCover\":\"/ARTISTA.jpg\",\"year\":1999}");
        var musicSync = request("GET", "/games/521/sync", music.sessionToken(), null, null);
        assertThat(musicSync.statusCode()).isEqualTo(200);
        assertThat(musicSync.body()).doesNotContain("TITOLO", "ARTISTA", "previewUrl", "albumCover", "1999");
    }

    @Test
    void aggiornaSchemaH2LegacySenzaRendereValidiIVecchiToken() throws Exception {
        String url = "jdbc:h2:mem:legacy-migration;DB_CLOSE_DELAY=-1";
        try (var db = java.sql.DriverManager.getConnection(url, "sa", ""); var sql = db.createStatement()) {
            sql.execute("CREATE TABLE device_session (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "
                    + "game_id BIGINT NOT NULL, device_id VARCHAR(128) NOT NULL, session_token VARCHAR(64) NOT NULL UNIQUE, "
                    + "role VARCHAR(16) NOT NULL, player_name VARCHAR(255), connection_id VARCHAR(64), "
                    + "last_heartbeat_at BIGINT, first_seen_at BIGINT, reconnections INTEGER NOT NULL, active BOOLEAN NOT NULL)");
            sql.execute("INSERT INTO device_session (game_id, device_id, session_token, role, player_name, reconnections, active) "
                    + "VALUES (1, 'old-1', 'old-token-1', 'REMOTE', 'Anna', 0, TRUE), "
                    + "(1, 'old-2', 'old-token-2', 'REMOTE', 'Anna', 0, TRUE)");
        }
        try (var context = new org.springframework.boot.builder.SpringApplicationBuilder(
                com.pub_game_be.PubGameBeApplication.class).run(
                        "--server.port=0", "--spring.datasource.url=" + url,
                        "--spring.jpa.hibernate.ddl-auto=update",
                        "--game.security.control-secret=0123456789abcdef0123456789abcdef")) {
            var migrated = context.getBean(DeviceSessionService.class);
            assertThat(migrated.authenticate("old-token-1")).isEmpty();
            assertThat(migrated.all(1L)).hasSize(2);
            var registration = migrated.register(1, "new", "REMOTE", "Anna", null);
            assertThat(migrated.authenticate(registration.sessionToken())).isPresent();
            assertThatThrownBy(() -> migrated.register(1, "other", "REMOTE", "anna", null))
                    .isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test
    void leSessioniLegacyNonSonoAttendibili() throws Exception {
        var legacy = new com.pub_game_be.reliability.domain.DeviceSessionEntity();
        legacy.setGameId(516L); legacy.setRole("TV"); legacy.setDeviceId("old-tv");
        legacy.setSessionToken("legacy-unauthenticated-token"); legacy.setActive(true);
        legacy.setLastHeartbeatAt(System.currentTimeMillis());
        sessionRepository.saveAndFlush(legacy);
        assertThat(request("POST", "/games/516/reset", legacy.getSessionToken(), null, "{}").statusCode()).isEqualTo(401);
        assertThat(request("POST", "/games/516/session", null, null,
                "{\"role\":\"TV\",\"sessionToken\":\"legacy-unauthenticated-token\"}").statusCode()).isEqualTo(401);
        assertThat(sessions.presence(516L).length()).isZero();
    }

    @Test
    void codiceDiAbbinamentoApreLaRegiaUnaSolaVolta() throws Exception {
        String secret = "0123456789abcdef0123456789abcdef";
        assertThat(request("POST", "/games/700/pairing-code", null, "sbagliato", "{}").statusCode()).isEqualTo(401);

        var issuedResponse = request("POST", "/games/700/pairing-code", null, secret, "{}");
        assertThat(issuedResponse.statusCode()).as(issuedResponse.body()).isEqualTo(200);
        var issued = new com.fasterxml.jackson.databind.ObjectMapper().readTree(issuedResponse.body());
        String code = issued.get("code").asText();
        assertThat(code).matches("\\d{6}");
        assertThat(issued.get("ttlSeconds").asLong()).isEqualTo(300L);

        var first = request("POST", "/games/700/session", null, null,
                "{\"role\":\"ADMIN\",\"pairingCode\":\"" + code + "\"}");
        assertThat(first.statusCode()).isEqualTo(200);

        var reused = request("POST", "/games/700/session", null, null,
                "{\"role\":\"ADMIN\",\"pairingCode\":\"" + code + "\"}");
        assertThat(reused.statusCode()).isEqualTo(401);
    }

    private HttpResponse<String> request(String method, String path, String token, String secret, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) builder.header("X-Session-Token", token);
        if (secret != null) builder.header("X-Control-Secret", secret);
        if (body == null && "GET".equals(method)) builder.GET();
        else builder.method(method, body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body));
        if (body != null) builder.header("Content-Type", "application/json");
        return HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void timelineRifiutaCarteRipetute() {
        long gameId = 524L;
        var payload = new org.json.JSONObject(partyGameService.startRound(gameId, "TIMELINE", "Storia"));
        var cards = payload.getJSONArray("items");
        String roundId = payload.getString("roundId");
        java.util.List<Integer> repeated = new java.util.ArrayList<>();
        for (int i = 0; i < cards.length(); i++) repeated.add(cards.getJSONObject(0).getInt("id"));
        assertThat(partyGameService.submitTimeline(gameId, roundId, "Anna", repeated)).isEmpty();
        java.util.List<Integer> valid = new java.util.ArrayList<>();
        for (int i = 0; i < cards.length(); i++) valid.add(cards.getJSONObject(i).getInt("id"));
        assertThat(partyGameService.submitTimeline(gameId, roundId, "Anna", valid)).isPresent();
    }

    @Test
    void timelineRifiutaRoundPrecedenteAncheConRicevuta() throws Exception {
        long gameId = 525L;
        String base = "/games/" + gameId;
        String token = sessions.register(gameId, "timeline-device", "REMOTE", "Anna", null).sessionToken();
        var first = new org.json.JSONObject(partyGameService.startRound(gameId, "TIMELINE", "Storia"));
        gameState.startRound(gameId, "TIMELINE", 1, "round-1", first.toString());
        var ids = new org.json.JSONArray();
        var cards = first.getJSONArray("items");
        for (int i = 0; i < cards.length(); i++) ids.put(cards.getJSONObject(i).getInt("id"));
        var answer = new org.json.JSONObject().put("playerName", "Anna").put("roundId", first.getString("roundId"))
                .put("order", ids).put("idempotencyKey", "same-key");
        assertThat(request("POST", base + "/timeline-answer", token, null, answer.toString()).statusCode()).isEqualTo(200);
        var second = new org.json.JSONObject(partyGameService.startRound(gameId, "TIMELINE", "Storia"));
        gameState.startRound(gameId, "TIMELINE", 2, "round-2", second.toString());
        assertThat(second.getString("roundId")).isNotEqualTo(first.getString("roundId"));
        assertThat(request("POST", base + "/timeline-answer", token, null, answer.toString()).statusCode()).isEqualTo(409);
        assertThat(partyGameService.timelineReveal(gameId).getJSONArray("results")).isEmpty();
        var nextIds = new org.json.JSONArray();
        var nextCards = second.getJSONArray("items");
        for (int i = 0; i < nextCards.length(); i++) nextIds.put(nextCards.getJSONObject(i).getInt("id"));
        answer.put("roundId", second.getString("roundId")).put("order", nextIds);
        assertThat(request("POST", base + "/timeline-answer", token, null, answer.toString()).statusCode()).isEqualTo(200);
        gameState.startRound(gameId, "QUIZ", 3, "round-3", "{}");
        assertThat(request("POST", base + "/timeline-answer", token, null, answer.toString()).statusCode()).isEqualTo(409);
        answer.remove("roundId");
        assertThat(request("POST", base + "/timeline-answer", token, null, answer.toString()).statusCode()).isEqualTo(400);
    }

    @Test
    void bombaRipristinaLaPartitaSenzaMostrareLeBombeEConsenteReset() {
        long gameId = 523L;
        var first = new com.pub_game_be.service.BombaService(questionBank, stateBlobs);
        var restarted = new com.pub_game_be.service.BombaService(questionBank, stateBlobs);
        try {
            var initial = first.start(gameId, java.util.List.of("Anna", "Bruno"), 1);
            int cellId = initial.getJSONArray("cells").getJSONObject(0).getInt("id");
            String turn = initial.getString("turn");
            var picked = first.pick(gameId, turn, cellId);
            var paused = first.pause(gameId);
            first.shutdown();
            var restored = restarted.state(gameId, "Bruno");
            assertThat(restored.getBoolean("paused")).isTrue();
            assertThat(restored.getString("turn")).isEqualTo(paused.getString("turn"));
            assertThat(restored.getJSONObject("penalties").toMap()).isEqualTo(picked.getJSONObject("penalties").toMap());
            var cells = restored.getJSONArray("cells");
            for (Object value : cells) {
                var cell = (org.json.JSONObject) value;
                if (!cell.getBoolean("used")) assertThat(cell.has("bomb")).isFalse();
            }
            restarted.resume(gameId);
            assertThat(restarted.state(gameId, "Anna").getBoolean("paused")).isFalse();
            restarted.reset(gameId);
            assertThat(stateBlobs.load(gameId, "bomba-round")).isEmpty();
            assertThat(restarted.state(gameId, "Anna").getBoolean("active")).isFalse();
        } finally {
            first.shutdown();
            restarted.shutdown();
        }
    }

    @Test
    void timeBuzzerRitrovaIlViaDopoRicreazioneControllerEScartaIlRoundVecchio() {
        long gameId = 522L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "buzzer-1", "{}");
        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));
        var start = party.timeBuzzerStart(gameId, Map.of("manche", 2));
        var restarted = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));
        assertThat(restarted.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 1)).getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) start.getBody()).get("manche")).isEqualTo(2);
        gameState.startRound(gameId, "TIME_BUZZER", 2, "buzzer-2", "{}");
        assertThat(restarted.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 1)).getStatusCode().value()).isEqualTo(409);
        restarted.timeBuzzerStart(gameId, Map.of());
        gameController.resetGame(gameId);
        assertThat(stateBlobs.load(gameId, "time-buzzer-start")).isEmpty();
    }

    @Autowired private com.pub_game_be.service.PartyGameService partyGameService;
    @Autowired private com.pub_game_be.service.QuestionBankService questionBank;
    @Autowired private org.springframework.messaging.simp.SimpMessagingTemplate messaging;
    @Autowired private StateBlobService stateBlobs;

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
    void stompRifiutaComandiEImpersonificazioneSuSocketReale() throws Exception {
        long game = 513L;
        var remote = sessions.register(game, "r-stomp", "REMOTE", "Anna", null);
        var tv = sessions.register(game, "tv-stomp", "TV", null, null);
        expectStompRejected(null, "CONNECT\naccept-version:1.2\n\n\0");
        expectStompRejected("wrong", "CONNECT\naccept-version:1.2\nX-Session-Token:wrong\n\n\0");
        expectStompRejected(remote.sessionToken(), "SEND\ndestination:/app/game/513/status\ncontent-type:application/json\n\n{\"action\":\"ADMIN_START_ROUND\",\"playerName\":\"Anna\"}\0");
        expectStompRejected(remote.sessionToken(), "SEND\ndestination:/app/game/513/answer\ncontent-type:application/json\n\n{\"playerName\":\"Bruno\",\"answerIndex\":1}\0");
        expectStompRejected(remote.sessionToken(), "SUBSCRIBE\nid:foreign\ndestination:/topic/game/514/status\n\n\0");
        expectStompRejected(remote.sessionToken(), "SUBSCRIBE\nid:private\ndestination:/topic/game/513/admin\n\n\0");
        expectStompRejected(remote.sessionToken(), "SEND\ndestination:/topic/game/513/status\ncontent-type:application/json\n\n{}\0");
        expectStompRejected(remote.sessionToken(), "SEND\ndestination:/app/game/513/status\ncontent-type:application/json\n\n{\"action\":\"BONUS_RESULT\",\"playerName\":\"Anna\",\"score\":9999}\0");
        expectStompRejected(tv.sessionToken(), "SEND\ndestination:/app/game/513/status\ncontent-type:application/json\n\n{\"action\":\"ARENA_ANSWER\",\"playerName\":\"Anna\"}\0");
    }

    private void expectStompRejected(String token, String frame) throws Exception {
        BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(URI.create("ws://localhost:" + port + "/ws-pubgame"), new WebSocket.Listener() {
                    @Override public void onOpen(WebSocket ws) { ws.request(1); }
                    @Override public CompletionStage<?> onText(WebSocket ws, CharSequence text, boolean last) {
                        messages.add(text.toString()); ws.request(1); return null;
                    }
                    @Override public CompletionStage<?> onClose(WebSocket ws, int status, String reason) {
                        messages.add("CLOSED"); return null;
                    }
                }).join();
        try {
            if (!frame.startsWith("CONNECT")) {
                socket.sendText("CONNECT\naccept-version:1.2\nX-Session-Token:" + token + "\n\n\0", true).join();
                assertThat(messages.poll(5, TimeUnit.SECONDS)).startsWith("CONNECTED");
            }
            socket.sendText(frame, true).join();
            assertThat(messages.poll(5, TimeUnit.SECONDS)).startsWith("ERROR");
        } finally { socket.abort(); }
    }

    @Test
    void statoDiRegiaPrivatoESanitizzatoPerIlTopicComune() throws Exception {
        long game = 519L;
        var tv = sessions.register(game, "tv", "TV", null, null);
        var admin = sessions.register(game, "admin", "ADMIN", null, null);
        var remote = sessions.register(game, "phone", "REMOTE", "Anna", null);
        BlockingQueue<String> privateFrames = new LinkedBlockingQueue<>();
        BlockingQueue<String> publicFrames = new LinkedBlockingQueue<>();
        WebSocket adminSocket = socket(admin.sessionToken(), privateFrames);
        WebSocket remoteSocket = socket(remote.sessionToken(), publicFrames);
        WebSocket tvSocket = socket(tv.sessionToken(), new LinkedBlockingQueue<>());
        try {
            adminSocket.sendText("SUBSCRIBE\nid:admin\ndestination:/topic/game/519/admin\n\n\0", true).join();
            remoteSocket.sendText("SUBSCRIBE\nid:public\ndestination:/topic/game/519/status\n\n\0", true).join();
            // Il messaggio di prova conferma che entrambe le sottoscrizioni sono attive.
            String prefix = "SEND\ndestination:/app/game/519/status\ncontent-type:application/json\n\n";
            tvSocket.sendText(prefix + "{\"action\":\"SHOW_QUESTION\",\"type\":\"MUSIC\",\"payload\":\"{\\\"question\\\":\\\"Q\\\",\\\"correctAnswer\\\":\\\"SECRET\\\",\\\"proverb\\\":\\\"SECRET\\\",\\\"songTitle\\\":\\\"SECRET\\\",\\\"previewUrl\\\":\\\"SECRET\\\"}\",\"rawPayload\":\"SECRET\"}\0", true).join();
            String publicFrame = publicFrames.poll(5, TimeUnit.SECONDS);
            String privateFrame = privateFrames.poll(5, TimeUnit.SECONDS);
            assertThat(publicFrame).contains("SHOW_QUESTION").doesNotContain("SECRET", "correctAnswer", "rawPayload");
            assertThat(privateFrame).contains("SHOW_QUESTION", "SECRET");
        } finally { adminSocket.abort(); remoteSocket.abort(); tvSocket.abort(); }
    }

    private WebSocket socket(String token, BlockingQueue<String> messages) throws Exception {
        WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(URI.create("ws://localhost:" + port + "/ws-pubgame"), new WebSocket.Listener() {
                    @Override public void onOpen(WebSocket ws) { ws.request(1); }
                    @Override public CompletionStage<?> onText(WebSocket ws, CharSequence text, boolean last) {
                        messages.add(text.toString()); ws.request(1); return null;
                    }
                }).join();
        socket.sendText("CONNECT\naccept-version:1.2\nX-Session-Token:" + token + "\n\n\0", true).join();
        assertThat(messages.poll(5, TimeUnit.SECONDS)).startsWith("CONNECTED");
        return socket;
    }

    @Test
    void ilTelefonoPuoInviareUnAzioneLegittimaSuWebSocketReale() throws Exception {
        long game = 518L;
        var remote = sessions.register(game, "r", "REMOTE", "Anna", null);
        BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(URI.create("ws://localhost:" + port + "/ws-pubgame"), new WebSocket.Listener() {
                    @Override public void onOpen(WebSocket ws) { ws.request(1); }
                    @Override public CompletionStage<?> onText(WebSocket ws, CharSequence text, boolean last) {
                        messages.add(text.toString()); ws.request(1); return null;
                    }
                }).join();
        try {
            socket.sendText("CONNECT\naccept-version:1.2\nX-Session-Token:" + remote.sessionToken() + "\n\n\0", true).join();
            assertThat(messages.poll(5, TimeUnit.SECONDS)).startsWith("CONNECTED");
            socket.sendText("SUBSCRIBE\nid:status\ndestination:/topic/game/518/status\n\n\0", true).join();
            socket.sendText("SEND\ndestination:/app/game/518/status\ncontent-type:application/json\n\n"
                    + "{\"action\":\"JOIN_GAME\",\"playerName\":\"Anna\"}\0", true).join();
            assertThat(messages.poll(5, TimeUnit.SECONDS)).contains("JOIN_GAME", "Anna");
        } finally { socket.abort(); }
    }

    @Test
    void risultatoArenaPubblicatoDalServerUnaVoltaSulWebSocketReale() throws Exception {
        long gameId = 510L;
        BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        var tv = sessions.register(gameId, "tv-ws", "TV", null, null);
        WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(URI.create("ws://localhost:" + port + "/ws-pubgame"), new WebSocket.Listener() {
                    private final StringBuilder buffer = new StringBuilder();
                    @Override
                    public void onOpen(WebSocket webSocket) { webSocket.request(1); }
                    @Override
                    public CompletionStage<?> onText(WebSocket webSocket, CharSequence text, boolean last) {
                        buffer.append(text);
                        if (last) { frames.add(buffer.toString()); buffer.setLength(0); }
                        webSocket.request(1);
                        return null;
                    }
                }).join();
        try {
            socket.sendText("CONNECT\naccept-version:1.2\nX-Session-Token:" + tv.sessionToken() + "\n\n\0", true).join();
            assertThat(frames.poll(5, TimeUnit.SECONDS)).startsWith("CONNECTED");
            socket.sendText("SUBSCRIBE\nid:status\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            // Il messaggio di controllo conferma che la sottoscrizione è attiva.
            socket.sendText("SEND\ndestination:/app/game/" + gameId + "/status\ncontent-type:application/json\n\n"
                    + "{\"action\":\"CHRISTMAS_TOGGLE\",\"enabled\":true}\0", true).join();
            assertThat(frames.poll(5, TimeUnit.SECONDS)).contains("CHRISTMAS_TOGGLE");

            questionHistory.assign(gameId,
                    new QuestionHistoryService.ArenaAssignment("q-ws", "Anna", "Domanda", "VERO", "Storia"));
            Map<String, Object> answer = Map.of("playerId", "Anna", "questionId", "q-ws",
                    "answer", "VERO", "idempotencyKey", "arena-ws-510");
            assertThat(gameController.answerArenaQuestion(gameId, answer).getStatusCode().value()).isEqualTo(200);
            String event = frames.poll(5, TimeUnit.SECONDS);
            assertThat(event).contains("ARENA_ANSWER", "Anna", "isCorrect", "points");
            assertThat(gameController.answerArenaQuestion(gameId, answer).getStatusCode().value()).isEqualTo(200);
            assertThat(frames.poll(500, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join();
        }
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

    @Test
    void timeBuzzerStartRipetutoNonAzzeraIlCronometro() throws Exception {
        long gameId = 529L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "g529-r1", "{}");

        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));

        var first = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        var firstBody = (Map<?, ?>) first.getBody();
        long startedAt = ((Number) firstBody.get("startedAt")).longValue();
        assertThat(firstBody.get("replayed")).isEqualTo(false);

        Thread.sleep(250);
        var second = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        var secondBody = (Map<?, ?>) second.getBody();
        // Il secondo via non sposta l'istante: gli stop già partiti restano validi.
        assertThat(secondBody.get("replayed")).isEqualTo(true);
        assertThat(((Number) secondBody.get("startedAt")).longValue()).isEqualTo(startedAt);

        long clientMs = System.currentTimeMillis() - startedAt;
        var stop = party.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", clientMs));
        assertThat(stop.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void dueStartTimeBuzzerConcorrentiHannoUnSoloVia() throws Exception {
        long gameId = 553L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "g553-r1",
                "{\"type\":\"TIME_BUZZER\",\"duration\":30}");
        stateBlobs.forget(gameId, "time-buzzer-start");

        var sender = mock(SimpMessagingTemplate.class);
        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                sender, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));

        int workers = 2;
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<ResponseEntity<Object>>> futures = new ArrayList<>();
        try {
            for (int worker = 0; worker < workers; worker++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    return party.timeBuzzerStart(gameId, Map.of("manche", 1));
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<ResponseEntity<Object>> responses = new ArrayList<>();
            for (Future<ResponseEntity<Object>> future : futures) {
                responses.add(future.get(30, TimeUnit.SECONDS));
            }
            assertThat(responses).allSatisfy(response ->
                    assertThat(response.getStatusCode().value()).isEqualTo(200));

            var first = (Map<?, ?>) responses.get(0).getBody();
            var second = (Map<?, ?>) responses.get(1).getBody();
            assertThat(((Number) first.get("startedAt")).longValue())
                    .isEqualTo(((Number) second.get("startedAt")).longValue());
            assertThat(List.of(first.get("replayed"), second.get("replayed")))
                    .containsExactlyInAnyOrder(false, true);
            // Solo il vincitore del CAS manda TIME_BUZZER_START.
            verify(sender, times(1)).convertAndSend(eq("/topic/game/" + gameId + "/status"), anyString());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void timeBuzzerStartFuoriDalRoundNonParte() {
        long gameId = 530L;
        gameState.startRound(gameId, "QUIZ", 1, "g530-r1", "{}");

        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));

        var response = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(stateBlobs.load(gameId, "time-buzzer-start")).isEmpty();
    }

    @Test
    void timeBuzzerUsaLaDurataDelRoundPerLaFinestra() {
        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));

        // Durata dichiarata dal round: la finestra della manche la segue.
        long gameId = 532L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "g532-r1",
                "{\"type\":\"TIME_BUZZER\",\"duration\":20}");
        expireRound(gameId);
        assertThat(party.timeBuzzerStart(gameId, Map.of("manche", 1)).getStatusCode().value()).isEqualTo(200);
        long remaining = gameState.roundDeadline(gameId).orElse(0L) - System.currentTimeMillis();
        assertThat(remaining).isBetween(15_000L, 25_000L);

        // Senza durata nel payload resta il ripiego di 45 s.
        long fallbackGame = 533L;
        gameState.startRound(fallbackGame, "TIME_BUZZER", 1, "g533-r1", "{}");
        expireRound(fallbackGame);
        assertThat(party.timeBuzzerStart(fallbackGame, Map.of("manche", 1)).getStatusCode().value()).isEqualTo(200);
        long fallback = gameState.roundDeadline(fallbackGame).orElse(0L) - System.currentTimeMillis();
        assertThat(fallback).isBetween(40_000L, 50_000L);
    }

    /** Porta la scadenza del round nel passato, come a fine manche. */
    private void expireRound(long gameId) {
        var state = stateRepository.findById(gameId).orElseThrow();
        state.setRoundDeadlineAt(System.currentTimeMillis() - 5_000);
        stateRepository.saveAndFlush(state);
        entityManager.clear();
    }

    @Test
    void timeBuzzerSecondaMancheRiapreLaFinestraDelRound() throws Exception {
        long gameId = 531L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "g531-r1", "{}");

        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs));

        var first = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(party.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 120))
                .getStatusCode().value()).isEqualTo(200);

        // Fine della prima manche: la finestra del round è già consumata, come
        // succede davvero con tre manche da 30 s dentro una finestra più corta.
        var state = stateRepository.findById(gameId).orElseThrow();
        state.setRoundDeadlineAt(System.currentTimeMillis() - 5_000);
        stateRepository.saveAndFlush(state);
        entityManager.clear();
        assertThat(gameState.isRoundOpen(gameId)).isFalse();

        // Il via della manche 2 rinnova la finestra invece di essere rifiutato.
        var second = party.timeBuzzerStart(gameId, Map.of("manche", 2));
        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) second.getBody()).get("manche")).isEqualTo(2);
        assertThat(gameState.isRoundOpen(gameId)).isTrue();
        assertThat(party.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 90))
                .getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void timelineUnaSolaRispostaPerGiocatoreAncheSeCorregge() throws Exception {
        long gameId = 528L;
        var token = sessions.register(gameId, "timeline-revise", "REMOTE", "Anna", null).sessionToken();
        var payload = new org.json.JSONObject(partyGameService.startRound(gameId, "TIMELINE", "Storia"));
        gameState.startRound(gameId, "TIMELINE", 1, "revise-1", payload.toString());

        var cards = payload.getJSONArray("items");
        var order = new org.json.JSONArray();
        var reversed = new org.json.JSONArray();
        for (int i = 0; i < cards.length(); i++) order.put(cards.getJSONObject(i).getInt("id"));
        for (int i = cards.length() - 1; i >= 0; i--) reversed.put(cards.getJSONObject(i).getInt("id"));

        var first = new org.json.JSONObject().put("playerName", "Anna")
                .put("roundId", payload.getString("roundId")).put("order", order)
                .put("idempotencyKey", "revise-1");
        var second = new org.json.JSONObject().put("playerName", "Anna")
                .put("roundId", payload.getString("roundId")).put("order", reversed)
                .put("idempotencyKey", "revise-2");

        long eventsBefore = gameState.currentSeq(gameId);
        assertThat(request("POST", "/games/" + gameId + "/timeline-answer", token, null, first.toString()).statusCode())
                .isEqualTo(200);
        assertThat(request("POST", "/games/" + gameId + "/timeline-answer", token, null, second.toString()).statusCode())
                .isEqualTo(200);

        // La correzione vale (ultima risposta), ma l'evento è uno solo:
        // niente ricevute duplicate nella sequenza della partita.
        assertThat(gameState.currentSeq(gameId)).isEqualTo(eventsBefore + 1);
        var reveal = partyGameService.timelineReveal(gameId);
        assertThat(reveal.getJSONArray("results")).hasSize(1);
        assertThat(reveal.getJSONArray("results").getJSONObject(0).getString("playerName")).isEqualTo("Anna");
    }

    @Test
    void timelineRetryConcorrentiCreanoUnSoloPrimoInvio() throws Exception {
        long gameId = 552L;
        var payload = new org.json.JSONObject(partyGameService.startRound(gameId, "TIMELINE", "Storia"));
        var cards = payload.getJSONArray("items");
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < cards.length(); i++) {
            order.add(cards.getJSONObject(i).getInt("id"));
        }
        String roundId = payload.getString("roundId");

        int workers = 8;
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        try {
            for (int worker = 0; worker < workers; worker++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    return partyGameService.submitTimelineDecision(gameId, roundId, "Anna", order)
                            .orElseThrow().firstAnswer();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Boolean> firstAnswers = new ArrayList<>();
            for (Future<Boolean> future : futures) {
                firstAnswers.add(future.get(30, TimeUnit.SECONDS));
            }
            assertThat(firstAnswers).hasSize(workers);
            assertThat(firstAnswers.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void currentRoundSegueLoStatoAutorevole() throws Exception {
        var game = new com.pub_game_be.domain.game.Game();
        game.setStatus(com.pub_game_be.domain.enums.GameStatus.RUNNING);
        var savedGame = gameRepository.saveAndFlush(game);
        long gameId = savedGame.getId();

        // Il game_round salvato è ancora il round precedente.
        var oldRound = new com.pub_game_be.domain.game_round.GameRound();
        oldRound.setGame(savedGame);
        oldRound.setRoundIndex(3);
        oldRound.setType(com.pub_game_be.domain.enums.GameType.WHEEL_OF_FORTUNE);
        oldRound.setPayload("{\"proverb\":\"vecchio\"}");
        roundRepository.saveAndFlush(oldRound);

        gameState.startRound(gameId, "TIMELINE", 4, "g-r4-timeline", "{\"type\":\"TIMELINE\",\"count\":6}");

        var tv = sessions.register(gameId, "tv-current", "TV", null, null);
        var response = request("GET", "/games/" + gameId + "/current-round", tv.sessionToken(), null, null);
        assertThat(response.statusCode()).isEqualTo(200);
        var body = json.readTree(response.body());
        assertThat(body.get("type").asText()).isEqualTo("TIMELINE");
        assertThat(body.get("roundKey").asText()).isEqualTo("g-r4-timeline");
        // Il payload resta una stringa JSON, come nel contratto di GameRound.
        assertThat(body.get("payload").isTextual()).isTrue();
        assertThat(json.readTree(body.get("payload").asText()).get("count").asInt()).isEqualTo(6);
    }

    @Test
    void currentRoundSenzaPayloadRestituisceNull() throws Exception {
        var game = new com.pub_game_be.domain.game.Game();
        game.setStatus(com.pub_game_be.domain.enums.GameStatus.RUNNING);
        long gameId = gameRepository.saveAndFlush(game).getId();

        gameState.startRound(gameId, "TIMELINE", 1, "g-r1-senza-payload", null);

        var tv = sessions.register(gameId, "tv-senza-payload", "TV", null, null);
        var response = request("GET", "/games/" + gameId + "/current-round", tv.sessionToken(), null, null);
        assertThat(response.statusCode()).isEqualTo(200);
        var body = json.readTree(response.body());
        // null, non "": il client fa JSON.parse solo sulle stringhe.
        assertThat(body.get("payload").isNull()).isTrue();
        assertThat(body.get("roundKey").asText()).isEqualTo("g-r1-senza-payload");
    }

    @Test
    void arenaSiPuoAprirePiuVolteNellaStessaPartita() {
        var game = new com.pub_game_be.domain.game.Game();
        game.setStatus(com.pub_game_be.domain.enums.GameStatus.RUNNING);
        long gameId = gameRepository.saveAndFlush(game).getId();

        // Il wrapper Arena non contiene una domanda: non deve essere trattato
        // come un doppione quando la scaletta prevede due Arena (round 24/40).
        var first = gameController.generateAiRound(gameId, "Sport", "ARENA", "medio");
        var second = gameController.generateAiRound(gameId, "Sport", "ARENA", "medio");

        assertThat(first.getRoundIndex()).isZero();
        assertThat(second.getRoundIndex()).isEqualTo(1);
        assertThat(first.getType()).isEqualTo(com.pub_game_be.domain.enums.GameType.ARENA);
        assertThat(second.getType()).isEqualTo(com.pub_game_be.domain.enums.GameType.ARENA);
    }

    @Test
    void arenaChiusaIndicaQuandoRiprovare() throws Exception {
        long gameId = 527L;
        var tv = sessions.register(gameId, "tv-arena-retry", "TV", null, null);
        gameState.startRound(gameId, "ARENA", 1, "g527-r1", "{}");
        gameState.closeRound(gameId, "skipped");

        var response = request("GET", "/games/" + gameId
                + "/arena-question?category=STORIA&playerId=Anna", tv.sessionToken(), null, null);
        assertThat(response.statusCode()).isEqualTo(409);
        var body = json.readTree(response.body());
        assertThat(body.get("error").asText()).isEqualTo("round-closed");
        assertThat(body.get("retryAfterMs").asLong()).isPositive();
    }
}
