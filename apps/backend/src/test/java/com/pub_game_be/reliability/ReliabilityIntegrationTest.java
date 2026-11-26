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
import org.mockito.ArgumentCaptor;
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
    private StateBlobService stateBlobService;

    @Autowired
    private com.pub_game_be.reliability.repository.DeviceSessionRepository sessionRepository;

    private QuestionHistoryService.ArenaAssignment arenaAssignment(long gameId, String questionId,
            String player, String question, String answer, String category) {
        return new QuestionHistoryService.ArenaAssignment(questionId, player, question, answer, category,
                gameState.currentRoundStartId(gameId).orElseThrow());
    }

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
                roundRepository, properties, transactionManager, entityManager, stateBlobService);

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
        gameState.startRound(id, "ARENA", 1, "arena-511", "{}");
        questionHistory.assign(id, arenaAssignment(id, "anna-q", "Anna", "Q", "VERO", "S"));
        questionHistory.assign(id, arenaAssignment(id, "bruno-q", "Bruno", "Q", "VERO", "S"));
        String answerA = "{\"playerId\":\"Anna\",\"questionId\":\"anna-q\",\"answer\":\"VERO\",\"idempotencyKey\":\"shared\"}";
        String answerB = "{\"playerId\":\"Bruno\",\"questionId\":\"bruno-q\",\"answer\":\"VERO\",\"idempotencyKey\":\"shared\"}";
        assertThat(json.readTree(request("POST", base + "/arena-answer", anna, null, answerA).body()).get("playerName").asText()).isEqualTo("Anna");
        assertThat(json.readTree(request("POST", base + "/arena-answer", bruno, null, answerB).body()).get("playerName").asText()).isEqualTo("Bruno");
        assertThat(request("POST", base + "/arena-answer", anna, null, answerA.replace("shared", "another-key")).statusCode()).isEqualTo(400);
        assertThat(request("POST", base + "/reset", tv, null, "{}").statusCode()).isEqualTo(200);
        var annaAfterResetResponse = request("POST", base + "/session", null, null,
                "{\"deviceId\":\"r-after-reset\",\"role\":\"REMOTE\",\"playerName\":\"Anna\"}");
        assertThat(annaAfterResetResponse.statusCode()).isEqualTo(200);
        String annaAfterReset = json.readTree(annaAfterResetResponse.body()).get("sessionToken").asText();
        var adminResponse = request("POST", base + "/session", null, "0123456789abcdef0123456789abcdef",
                "{\"deviceId\":\"admin\",\"role\":\"ADMIN\"}");
        assertThat(adminResponse.statusCode()).isEqualTo(200);
        String admin = json.readTree(adminResponse.body()).get("sessionToken").asText();
        assertThat(request("POST", base + "/session/disconnect", annaAfterReset, null,
                "{\"sessionToken\":\"" + admin + "\"}").statusCode()).isEqualTo(403);
        var adminDiagnostics = json.readTree(request("GET", base + "/diagnostics", admin, null, null).body());
        assertThat(adminDiagnostics.get("recentEventsHidden").asBoolean()).isFalse();
        // Regia non ancora abbinata: la diagnostica resta leggibile, ma senza gli eventi
        // recenti, che contengono le soluzioni delle domande.
        var guestDiagnostics = json.readTree(request("GET", base + "/diagnostics", null, null, null).body());
        assertThat(guestDiagnostics.get("recentEvents").size()).isZero();
        assertThat(guestDiagnostics.get("recentEventsHidden").asBoolean()).isTrue();
        assertThat(guestDiagnostics.has("status")).isTrue();
        gameState.startRound(id, "ARENA", 1, "arena-511-after-reset", "{}");
        var question = request("GET", base + "/arena-question?category=STORIA&playerId=Anna", annaAfterReset, null, null);
        assertThat(question.statusCode()).isEqualTo(200);
        var arena = json.readTree(question.body());
        assertThat(arena.has("correctAnswer")).isFalse();
        assertThat(arena.has("explanation")).isFalse();
        assertThat(arena.has("correctIndex")).isFalse();
    }

    @Test
    void tennisECavalloNonRipetonoLeDomandeNellaStessaSerata() throws Exception {
        // F-08: il Tennis chiedeva 12 domande per round ma ne servono ~44, e il
        // Cavallo non passava dallo storico: le stesse domande tornavano anche
        // tre o quattro volte nella serata.
        long gameId = 8301L;
        String tv = sessions.register(gameId, "banca-tv", "TV", null, null).sessionToken();

        java.util.Set<String> viste = new java.util.HashSet<>();
        for (int blocco = 0; blocco < 4; blocco++) {
            var risposta = request("GET",
                    "/games/" + gameId + "/tennis/questions?difficulty=MIXED&count=60",
                    tv, null, null);
            assertThat(risposta.statusCode()).isEqualTo(200);
            JsonNode righe = json.readTree(risposta.body());
            assertThat(righe.size()).isEqualTo(60);
            for (JsonNode riga : righe) {
                String domanda = riga.get("question").asText();
                assertThat(viste.add(domanda)).as("domanda ripetuta: " + domanda).isTrue();
            }
        }
        assertThat(viste).hasSize(240);

        var primoCavallo = request("GET",
                "/games/" + gameId + "/cavallo/questions?category=Storia&count=8", tv, null, null);
        assertThat(primoCavallo.statusCode()).isEqualTo(200);
        JsonNode righeCavallo = json.readTree(primoCavallo.body());
        assertThat(righeCavallo.size()).isEqualTo(8);
        java.util.Set<String> cavallo = new java.util.HashSet<>();
        for (JsonNode riga : righeCavallo) {
            cavallo.add(riga.get("question").asText());
        }

        var secondoCavallo = request("GET",
                "/games/" + gameId + "/cavallo/questions?category=Storia&count=8", tv, null, null);
        assertThat(secondoCavallo.statusCode()).isEqualTo(200);
        for (JsonNode riga : json.readTree(secondoCavallo.body())) {
            assertThat(cavallo).doesNotContain(riga.get("question").asText());
        }

        // Lo storico è davvero scritto: 240 domande di Tennis + 8 di Cavallo.
        assertThat(questionUsage.count(gameId)).isGreaterThanOrEqualTo(248);
    }

    private String mancheQuiz(int manche, String roundStartId) {
        return "{\"manche\":" + manche + ",\"roundStartId\":\"" + roundStartId + "\"}";
    }

    @Test
    void ilResetDellaTvRevocaLeSquadreELasciaLaRegia() {
        long gameId = 550L;
        var tv = sessions.register(gameId, "reset-tv", "TV", null, null);
        var admin = sessions.register(gameId, "reset-admin", "ADMIN", null, null);
        var anna = sessions.register(gameId, "reset-anna", "REMOTE", "Anna", null);

        gameController.resetGame(gameId);

        assertThat(sessions.authenticate(anna.sessionToken())).isEmpty();
        assertThat(sessions.authenticate(tv.sessionToken())).isPresent();
        assertThat(sessions.authenticate(admin.sessionToken())).isPresent();
        // Restano online solo TV e regia: la squadra non è più in presenza.
        assertThat(sessions.presence(gameId).length()).isEqualTo(2);

        // Il nome è tornato libero: la squadra può rientrare solo dal setup.
        var rejoin = sessions.register(gameId, "reset-anna-2", "REMOTE", "Anna", null);
        assertThat(rejoin.sessionToken()).isNotEqualTo(anna.sessionToken());
    }

    @Test
    void dueTelefoniVotanoIlQuizERitrovanoSoloLaPropriaRisposta() throws Exception {
        long gameId = 8101L;
        String base = "/games/" + gameId;
        String tv = sessions.register(gameId, "quiz-tv", "TV", null, null).sessionToken();
        String anna = sessions.register(gameId, "quiz-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "quiz-b", "REMOTE", "Bruno", null).sessionToken();
        gameState.startRound(gameId, "QUIZ", 1, "quiz-8101", """
                {"type":"QUIZ","questions":[{"question":"Prova?","options":["A","B"],"correctAnswer":"A"}]}
                """);
        String roundStartId = gameState.currentRoundStartId(gameId).orElseThrow();
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, roundStartId)).statusCode()).isEqualTo(200);
        String voteA = "{\"optionIndex\":0,\"manche\":0,\"roundStartId\":\"" + roundStartId + "\"}";
        String voteB = "{\"optionIndex\":1,\"manche\":0,\"roundStartId\":\"" + roundStartId + "\"}";
        ExecutorService clients = Executors.newFixedThreadPool(2);
        try {
            Future<HttpResponse<String>> first = clients.submit(() -> request("POST", base + "/quiz/answer", anna, null, voteA));
            Future<HttpResponse<String>> second = clients.submit(() -> request("POST", base + "/quiz/answer", bruno, null, voteB));
            assertThat(first.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
        } finally {
            clients.shutdownNow();
        }
        assertThat(request("POST", base + "/quiz/answer", anna, null, voteA).statusCode()).isEqualTo(409);
        var a = request("GET", base + "/quiz/answers", anna, null, null);
        var b = request("GET", base + "/quiz/answers", bruno, null, null);
        var all = request("GET", base + "/quiz/answers", tv, null, null);
        assertThat(a.statusCode()).isEqualTo(200);
        assertThat(b.statusCode()).isEqualTo(200);
        assertThat(json.readTree(a.body()).path("answers")).hasSize(1);
        assertThat(json.readTree(a.body()).path("answers").get(0).path("playerName").asText()).isEqualTo("Anna");
        assertThat(json.readTree(b.body()).path("answers")).hasSize(1);
        assertThat(json.readTree(b.body()).path("answers").get(0).path("playerName").asText()).isEqualTo("Bruno");
        assertThat(json.readTree(all.body()).path("answers")).hasSize(2);
        assertThat(request("POST", base + "/quiz/manche", anna, null, "{\"manche\":0}").statusCode()).isEqualTo(403);
    }

    @Test
    void votiQuizTardiviNonPassanoAllaMancheOAlRoundSuccessivi() throws Exception {
        long gameId = 8106L;
        String base = "/games/" + gameId;
        String tv = sessions.register(gameId, "late-quiz-tv", "TV", null, null).sessionToken();
        String anna = sessions.register(gameId, "late-quiz-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "late-quiz-b", "REMOTE", "Bruno", null).sessionToken();
        String payload = """
                {"type":"QUIZ","questions":[
                  {"question":"Prima?","options":["A","B"],"correctAnswer":"A"},
                  {"question":"Seconda?","options":["A","B"],"correctAnswer":"B"}]}
                """;
        gameState.startRound(gameId, "QUIZ", 1, "quiz-8106", payload);
        String firstRound = gameState.currentRoundStartId(gameId).orElseThrow();
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, firstRound)).statusCode()).isEqualTo(200);
        String oldVote = "{\"optionIndex\":0,\"manche\":0,\"roundStartId\":\"" + firstRound + "\"}";
        assertThat(request("POST", base + "/quiz/answer", anna, null, oldVote).statusCode()).isEqualTo(200);
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(1, firstRound)).statusCode()).isEqualTo(200);
        assertThat(json.readTree(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, firstRound)).body())
                .path("mancheIndex").asInt()).isEqualTo(1);
        var late = request("POST", base + "/quiz/answer", bruno, null, oldVote);
        assertThat(late.statusCode()).isEqualTo(409);
        assertThat(json.readTree(late.body()).path("error").asText()).isEqualTo("manche-stale");
        assertThat(request("POST", base + "/quiz/answer", bruno, null, "{\"optionIndex\":1}").statusCode()).isEqualTo(400);
        String currentVote = "{\"optionIndex\":1,\"manche\":1,\"roundStartId\":\"" + firstRound + "\"}";
        assertThat(request("POST", base + "/quiz/answer", bruno, null, currentVote).statusCode()).isEqualTo(200);
        assertThat(json.readTree(request("GET", base + "/quiz/answers", tv, null, null).body()).path("answers")).hasSize(2);
        gameState.startRound(gameId, "QUIZ", 1, "quiz-8106", payload);
        var beforeManche = json.readTree(request("GET", base + "/quiz/answers", anna, null, null).body());
        assertThat(beforeManche.path("answers")).isEmpty();
        assertThat(beforeManche.path("mancheIndex").asInt()).isEqualTo(-1);
        assertThat(json.readTree(request("GET", base + "/sync", anna, null, null).body())
                .path("snapshot").path("roundStartId").asText()).isEqualTo(gameState.currentRoundStartId(gameId).orElseThrow());
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, firstRound)).statusCode()).isEqualTo(409);
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, gameState.currentRoundStartId(gameId).orElseThrow())).statusCode()).isEqualTo(200);
        assertThat(request("POST", base + "/quiz/answer", bruno, null, oldVote).statusCode()).isEqualTo(409);
        assertThat(json.readTree(request("GET", base + "/quiz/answers", tv, null, null).body()).path("answers")).isEmpty();
    }

    @Test
    void quizLegacyAmbiguoConservaVotiERifiutaLaRipresa() throws Exception {
        long gameId = 8107L;
        String base = "/games/" + gameId;
        String tv = sessions.register(gameId, "legacy-quiz-tv", "TV", null, null).sessionToken();
        String anna = sessions.register(gameId, "legacy-quiz-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "legacy-quiz-b", "REMOTE", "Bruno", null).sessionToken();
        String payload = "{\"type\":\"QUIZ\",\"questions\":[{\"question\":\"Q\",\"options\":[\"A\",\"B\"],\"correctAnswer\":\"A\"}]}";
        gameState.startRound(gameId, "QUIZ", 1, "legacy-key", payload);
        String firstId = gameState.currentRoundStartId(gameId).orElseThrow();
        String legacy = "{\"roundKey\":\"legacy-key\",\"mancheIndex\":0,\"deadlineAt\":"
                + (System.currentTimeMillis() + 15000) + ",\"answers\":[{\"playerName\":\"Anna\",\"manche\":0,\"points\":200}]}";
        stateBlobService.save(gameId, "quiz", legacy);
        for (String token : List.of(tv, anna, bruno)) {
            var summary = json.readTree(request("GET", base + "/quiz/answers", token, null, null).body());
            assertThat(summary.path("recoveryBlocked").asText()).isEqualTo("legacy-quiz-state");
            assertThat(summary.path("answers")).isEmpty();
        }
        var opening = request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, firstId));
        assertThat(opening.statusCode()).isEqualTo(409);
        assertThat(json.readTree(opening.body()).path("error").asText()).isEqualTo("legacy-quiz-state");
        String vote = "{\"optionIndex\":0,\"manche\":0,\"roundStartId\":\"" + firstId + "\"}";
        assertThat(request("POST", base + "/quiz/answer", bruno, null, vote).statusCode()).isEqualTo(409);
        assertThat(stateBlobService.load(gameId, "quiz")).contains(legacy);
        // Neppure una nuova apertura con la stessa chiave prova l'origine del blob.
        gameState.startRound(gameId, "QUIZ", 1, "legacy-key", payload);
        String secondId = gameState.currentRoundStartId(gameId).orElseThrow();
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, secondId)).statusCode()).isEqualTo(409);
        assertThat(stateBlobService.load(gameId, "quiz")).contains(legacy);
        // Finché resta la stessa chiave il legacy occupa ancora il blob attivo.
        assertThat(stateBlobService.exists(gameId, "quiz-legacy-archive")).isFalse();
        // Una chiave diversa può aprire il nuovo round normalmente, ma prima
        // archivia il legacy: il nuovo stato non lo cancella.
        gameState.startRound(gameId, "QUIZ", 2, "new-key", payload);
        String thirdId = gameState.currentRoundStartId(gameId).orElseThrow();
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, thirdId)).statusCode()).isEqualTo(200);
        JsonNode archive = json.readTree(stateBlobService.load(gameId, "quiz-legacy-archive").orElseThrow());
        assertThat(archive.path("replacedByRoundKey").asText()).isEqualTo("new-key");
        assertThat(archive.path("legacy").path("roundKey").asText()).isEqualTo("legacy-key");
        assertThat(archive.path("legacy").path("answers").get(0).path("points").asInt()).isEqualTo(200);
        assertThat(request("POST", base + "/quiz/answer", bruno, null,
                "{\"optionIndex\":0,\"manche\":0,\"roundStartId\":\"" + thirdId + "\"}").statusCode()).isEqualTo(200);
        // Un secondo legacy non sostituisce l'archivio già scritto.
        stateBlobService.save(gameId, "quiz", legacy.replace("legacy-key", "new-key"));
        gameState.startRound(gameId, "QUIZ", 3, "later-key", payload);
        String fourthId = gameState.currentRoundStartId(gameId).orElseThrow();
        assertThat(request("POST", base + "/quiz/manche", tv, null, mancheQuiz(0, fourthId)).statusCode()).isEqualTo(200);
        JsonNode unchanged = json.readTree(stateBlobService.load(gameId, "quiz-legacy-archive").orElseThrow());
        assertThat(unchanged.path("legacy").path("roundKey").asText()).isEqualTo("legacy-key");
        assertThat(unchanged.path("legacy").path("answers").get(0).path("playerName").asText()).isEqualTo("Anna");
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
    void imageBlurRestaApertoPerTutteETreLeManche() {
        gameState.startRound(640L, "IMAGE_BLUR", 1, "blur-3-manche", "{}");
        long deadline = gameState.roundDeadline(640L).orElseThrow();
        long window = deadline - System.currentTimeMillis();
        // N-03: con 60 s la finestra si chiudeva a metà manche 2 e i telefoni
        // non potevano prenotarsi per la manche 2 e 3.
        assertThat(window).isGreaterThan(3 * 45_000L);
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

    @Test
    void laRegiaEspelleUnaSquadraELiberaIlNomePerIlRientro() throws Exception {
        long gameId = 531L;
        String base = "/games/" + gameId;
        var anna = sessions.register(gameId, "remote-expel", "REMOTE", "Anna", null);
        var admin = sessions.register(gameId, "admin-expel", "ADMIN", null, null);
        var tv = sessions.register(gameId, "tv-expel", "TV", null, null);

        // Solo la regia espelle: la TV non è autorizzata.
        assertThat(request("POST", base + "/players/expel", tv.sessionToken(), null,
                "{\"playerName\":\"Anna\"}").statusCode()).isEqualTo(403);

        var expelled = request("POST", base + "/players/expel", admin.sessionToken(), null,
                "{\"playerName\":\"Anna\"}");
        assertThat(expelled.statusCode()).as(expelled.body()).isEqualTo(200);
        assertThat(json.readTree(expelled.body()).get("removed").asInt()).isEqualTo(1);

        // La vecchia sessione non autentica più e il telefono non può risincronizzarsi.
        assertThat(sessions.authenticate(anna.sessionToken())).isEmpty();
        assertThat(request("GET", base + "/sync", anna.sessionToken(), null, null).statusCode())
                .isEqualTo(401);

        // Il nome è libero: chi rientra ottiene una sessione nuova, non quella espulsa.
        var again = sessions.register(gameId, "remote-expel-2", "REMOTE", "Anna", null);
        assertThat(again.resumed()).isFalse();
        assertThat(again.sessionToken()).isNotEqualTo(anna.sessionToken());
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
    void ilTickDiInattivitaArenaRispondeSoloAllaRegia() throws Exception {
        long gameId = 532L;
        String base = "/games/" + gameId;
        var tv = sessions.register(gameId, "tv-inactivity", "TV", null, null);
        var remote = sessions.register(gameId, "remote-inactivity", "REMOTE", "Anna", null);
        gameState.startRound(gameId, "ARENA", 1, "g532-r1", "{}");

        // Prima richiesta: il server registra l'istante di partenza, nessuna penalità.
        var first = request("POST", base + "/arena-inactivity", tv.sessionToken(), null,
                "{\"players\":[\"Anna\"]}");
        assertThat(first.statusCode()).as(first.body()).isEqualTo(200);
        assertThat(json.readTree(first.body()).get("penalties")).isEmpty();
        assertThat(request("POST", base + "/arena-inactivity", remote.sessionToken(), null,
                "{\"players\":[\"Anna\"]}").statusCode()).isEqualTo(403);

        // Simula un round iniziato 15 secondi fa: il tick HTTP deve riportare
        // la penalità che la TV dovrà applicare.
        questionHistory.forget(gameId);
        questionHistory.claimArenaInactivity(gameId, List.of("Anna"), "g532-r1", false,
                System.currentTimeMillis() - 15_100);
        var due = request("POST", base + "/arena-inactivity", tv.sessionToken(), null,
                "{\"players\":[\"Anna\"]}");
        assertThat(due.statusCode()).as(due.body()).isEqualTo(200);
        var penalties = json.readTree(due.body()).get("penalties");
        assertThat(penalties).hasSize(1);
        assertThat(penalties.get(0).get("playerName").asText()).isEqualTo("Anna");
        assertThat(penalties.get(0).get("count").asInt()).isEqualTo(1);
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
        var first = new com.pub_game_be.service.BombaService(
                questionBank, stateBlobs, com.pub_game_be.service.BombaService.TURN_SECONDS, 0);
        var restarted = new com.pub_game_be.service.BombaService(
                questionBank, stateBlobs, com.pub_game_be.service.BombaService.TURN_SECONDS, 0);
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
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);
        var start = party.timeBuzzerStart(gameId, Map.of("manche", 2));
        var restarted = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);
        assertThat(restarted.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 1)).getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) start.getBody()).get("manche")).isEqualTo(2);
        gameState.startRound(gameId, "TIME_BUZZER", 2, "buzzer-2", "{}");
        assertThat(restarted.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 1)).getStatusCode().value()).isEqualTo(409);
        restarted.timeBuzzerStart(gameId, Map.of());
        gameController.resetGame(gameId);
        assertThat(stateBlobs.load(gameId, "time-buzzer-start")).isEmpty();
    }

    @Test
    void timeBuzzerMantieneITempiDopoUnaPausaLunga() throws InterruptedException {
        // F-06: il telefono corregge il proprio cronometro alla ripresa, il
        // server no: dopo una pausa oltre la tolleranza di rete ogni tempo
        // arrivato era «non plausibile» e la TV restava senza tabella.
        long gameId = 523L;
        gameState.startRound(gameId, "TIME_BUZZER", 1, "buzzer-pausa", "{}");
        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

        var start = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        long startedAt = ((Number) ((Map<?, ?>) start.getBody()).get("startedAt")).longValue();
        assertThat(startedAt).isGreaterThan(0L);

        assertThat(gameState.pauseRound(gameId)).isTrue();
        Thread.sleep(6000L);
        party.resumeRound(gameId);

        var stop = party.timeBuzzerStop(gameId, Map.of("playerName", "Anna", "ms", 120));
        assertThat(stop.getStatusCode().value()).isEqualTo(200);
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
    void dueTelefoniRicevonoPrimoQuizDaTvSenzaSoluzioni() throws Exception {
        long gameId = 8103L;
        String tv = sessions.register(gameId, "quiz-ws-tv", "TV", null, null).sessionToken();
        String anna = sessions.register(gameId, "quiz-ws-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "quiz-ws-b", "REMOTE", "Bruno", null).sessionToken();
        gameState.startRound(gameId, "QUIZ", 1, "quiz-ws-8103", "{}");
        BlockingQueue<String> framesA = new LinkedBlockingQueue<>();
        BlockingQueue<String> framesB = new LinkedBlockingQueue<>();
        WebSocket a = socket(anna, framesA);
        WebSocket b = socket(bruno, framesB);
        WebSocket screen = socket(tv, new LinkedBlockingQueue<>());
        String prefix = "SEND\ndestination:/app/game/" + gameId + "/status\ncontent-type:application/json\n\n";
        try {
            a.sendText("SUBSCRIBE\nid:a\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            b.sendText("SUBSCRIBE\nid:b\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            // Ripetere la sonda finché entrambi hanno realmente sottoscritto.
            // Sonda finché entrambe le sottoscrizioni rispondono: il tempo per
            // sonda è solo un limite, il ciclo esce appena la condizione è vera.
            long subscribeDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
            boolean seenA = false, seenB = false;
            while ((!seenA || !seenB) && System.nanoTime() < subscribeDeadline) {
                screen.sendText(prefix + "{\"action\":\"CHRISTMAS_TOGGLE\",\"enabled\":true}\0", true).join();
                if (!seenA) seenA = frameContaining(framesA, "CHRISTMAS_TOGGLE", 1) != null;
                if (!seenB) seenB = frameContaining(framesB, "CHRISTMAS_TOGGLE", 1) != null;
            }
            assertThat(seenA).as("sottoscrizione A attiva").isTrue();
            assertThat(seenB).as("sottoscrizione B attiva").isTrue();
            framesA.clear();
            framesB.clear();
            String roundStartId = gameState.currentRoundStartId(gameId).orElseThrow();
            screen.sendText(prefix + "{\"action\":\"START_VOTING\",\"type\":\"QUIZ\",\"roundStartId\":\"" + roundStartId + "\","
                    + "\"payload\":{\"question\":\"Test?\",\"options\":[\"A\",\"B\"],\"correctAnswer\":\"SECRET\"}}\0", true).join();
            assertThat(frameContaining(framesA, "START_VOTING")).contains("QUIZ", "options", roundStartId).doesNotContain("SECRET", "correctAnswer");
            assertThat(frameContaining(framesB, "START_VOTING")).contains("QUIZ", "options", roundStartId).doesNotContain("SECRET", "correctAnswer");

            // Stessa chiave, apertura diversa: né gli annunci né il vecchio
            // stato devono arrivare ai telefoni o sbloccare lo snapshot.
            gameState.startRound(gameId, "QUIZ", 1, "quiz-ws-8103", "{}");
            String nextRound = gameState.currentRoundStartId(gameId).orElseThrow();
            assertThat(nextRound).isNotEqualTo(roundStartId);
            assertThat(gameState.snapshot(gameId).getBoolean("announced")).isFalse();
            for (String action : List.of("SHOW_QUESTION", "START_VOTING", "QUIZ_STATE")) {
                screen.sendText(prefix + "{\"action\":\"" + action + "\",\"type\":\"QUIZ\",\"roundStartId\":\"" + roundStartId + "\",\"state\":{\"manche\":2}}\0", true).join();
            }
            screen.sendText(prefix + "{\"action\":\"START_VOTING\",\"type\":\"QUIZ\"}\0", true).join();
            screen.sendText(prefix + "{\"action\":\"CHRISTMAS_TOGGLE\",\"enabled\":false}\0", true).join();
            assertThat(framesA.poll(5, TimeUnit.SECONDS)).contains("CHRISTMAS_TOGGLE");
            assertThat(framesB.poll(5, TimeUnit.SECONDS)).contains("CHRISTMAS_TOGGLE");
            assertThat(gameState.snapshot(gameId).getBoolean("announced")).isFalse();
            screen.sendText(prefix + "{\"action\":\"START_VOTING\",\"type\":\"QUIZ\",\"roundStartId\":\"" + nextRound + "\"}\0", true).join();
            assertThat(frameContaining(framesA, "START_VOTING")).contains(nextRound);
            assertThat(frameContaining(framesB, "START_VOTING")).contains(nextRound);
            assertThat(gameState.snapshot(gameId).getBoolean("announced")).isTrue();
        } finally {
            a.abort(); b.abort(); screen.abort();
        }
    }

    /**
     * Un annuncio accettato mentre il round cambia non deve essere consegnato
     * ai telefoni dopo il via del round nuovo: la pubblicazione avviene nello
     * stesso lock dell'apertura, quindi entrambi i telefoni vedono l'ordine
     * del server.
     */
    @Test
    void dueTelefoniNonRicevonoUnAnnuncioQuizDopoIlCambioRound() throws Exception {
        long gameId = 8108L;
        String payload = "{}";
        String tv = sessions.register(gameId, "order-tv", "TV", null, null).sessionToken();
        String anna = sessions.register(gameId, "order-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "order-b", "REMOTE", "Bruno", null).sessionToken();
        gameState.startRound(gameId, "QUIZ", 1, "order-r1", payload);
        String first = gameState.currentRoundStartId(gameId).orElseThrow();
        BlockingQueue<String> framesA = new LinkedBlockingQueue<>();
        BlockingQueue<String> framesB = new LinkedBlockingQueue<>();
        WebSocket a = socket(anna, framesA);
        WebSocket b = socket(bruno, framesB);
        WebSocket screen = socket(tv, new LinkedBlockingQueue<>());
        String prefix = "SEND\ndestination:/app/game/" + gameId + "/status\ncontent-type:application/json\n\n";
        try {
            a.sendText("SUBSCRIBE\nid:a\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            b.sendText("SUBSCRIBE\nid:b\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            // Sonda finché entrambe le sottoscrizioni rispondono: il tempo per
            // sonda è solo un limite, il ciclo esce appena la condizione è vera.
            long subscribeDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
            boolean seenA = false, seenB = false;
            while ((!seenA || !seenB) && System.nanoTime() < subscribeDeadline) {
                screen.sendText(prefix + "{\"action\":\"CHRISTMAS_TOGGLE\",\"enabled\":true}\0", true).join();
                if (!seenA) seenA = frameContaining(framesA, "CHRISTMAS_TOGGLE", 1) != null;
                if (!seenB) seenB = frameContaining(framesB, "CHRISTMAS_TOGGLE", 1) != null;
            }
            assertThat(seenA).as("sottoscrizione A attiva").isTrue();
            assertThat(seenB).as("sottoscrizione B attiva").isTrue();
            framesA.clear();
            framesB.clear();

            // L'annuncio del round 1 e il cambio round corrono insieme.
            ExecutorService opener = Executors.newSingleThreadExecutor();
            try {
                Future<?> announcement = opener.submit(() -> screen.sendText(prefix
                        + "{\"action\":\"START_VOTING\",\"type\":\"QUIZ\",\"roundStartId\":\"" + first + "\"}\0",
                        true).join());
                gameState.startRound(gameId, "QUIZ", 2, "order-r2", payload);
                String second = gameState.currentRoundStartId(gameId).orElseThrow();
                announcement.get(10, TimeUnit.SECONDS);
                screen.sendText(prefix + "{\"action\":\"START_VOTING\",\"type\":\"QUIZ\",\"roundStartId\":\""
                        + second + "\"}\0", true).join();
                for (BlockingQueue<String> frames : List.of(framesA, framesB)) {
                    List<String> ids = new ArrayList<>();
                    List<Long> started = new ArrayList<>();
                    // Condizione, non tempo fisso: si attende il secondo
                    // annuncio con una scadenza ampia, che si interrompe appena
                    // arriva. Una sonda come barriera poteva superarlo.
                    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
                    long remaining;
                    while (!ids.contains(second) && (remaining = deadline - System.nanoTime()) > 0) {
                        String frame = frames.poll(remaining, TimeUnit.NANOSECONDS);
                        if (frame == null) break;
                        JsonNode body = stompBody(frame);
                        if (body == null || !"START_VOTING".equals(body.path("action").asText())) continue;
                        ids.add(body.path("roundStartId").asText());
                        started.add(body.path("roundStartedAt").asLong());
                    }
                    // Un annuncio vecchio che arriva DOPO il nuovo è il guasto
                    // che questo test cerca: si svuota la coda finché tace.
                    long quietUntil = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(500);
                    while ((remaining = quietUntil - System.nanoTime()) > 0) {
                        String frame = frames.poll(remaining, TimeUnit.NANOSECONDS);
                        if (frame == null) break;
                        quietUntil = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(500);
                        JsonNode body = stompBody(frame);
                        if (body == null || !"START_VOTING".equals(body.path("action").asText())) continue;
                        ids.add(body.path("roundStartId").asText());
                        started.add(body.path("roundStartedAt").asLong());
                    }
                    assertThat(ids).isNotEmpty();
                    // Se il primo annuncio è passato, precede il secondo; in
                    // nessun caso un annuncio vecchio arriva dopo quello nuovo.
                    assertThat(ids.get(ids.size() - 1)).isEqualTo(second);
                    if (ids.contains(first)) assertThat(ids.indexOf(first)).isLessThan(ids.indexOf(second));
                    assertThat(started).isSorted().allMatch(value -> value > 0);
                }
            } finally {
                opener.shutdownNow();
            }
        } finally {
            a.abort(); b.abort(); screen.abort();
        }
    }

    /** Corpo JSON di un frame STOMP, senza terminatori. */
    private JsonNode stompBody(String frame) {
        int body = frame.indexOf("\n\n");
        if (body < 0) return null;
        try {
            return json.readTree(frame.substring(body + 2).replace("\0", "").trim());
        } catch (Exception malformed) {
            return null;
        }
    }

    private String frameContaining(BlockingQueue<String> frames, String text) throws InterruptedException {
        return frameContaining(frames, text, 15);
    }

    /** Attende la prima cornice che contiene `text`, scartando le altre. */
    private String frameContaining(BlockingQueue<String> frames, String text, long seconds)
            throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        long remaining;
        while ((remaining = deadline - System.nanoTime()) > 0) {
            String frame = frames.poll(remaining, TimeUnit.NANOSECONDS);
            if (frame == null) return null;
            if (frame.contains(text)) return frame;
        }
        return null;
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
    void dueTelefoniArenaRispondonoAllaPropriaDomandaConRetryEChiusura() throws Exception {
        long gameId = 8102L;
        String base = "/games/" + gameId;
        String anna = sessions.register(gameId, "arena-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "arena-b", "REMOTE", "Bruno", null).sessionToken();
        gameState.startRound(gameId, "ARENA", 1, "arena-8102", "{}");
        questionHistory.assign(gameId, arenaAssignment(gameId, "qa", "Anna", "A?", "VERO", "test"));
        questionHistory.assign(gameId, arenaAssignment(gameId, "qb", "Bruno", "B?", "FALSO", "test"));
        String a = "{\"playerId\":\"Anna\",\"questionId\":\"qa\",\"answer\":\"VERO\",\"idempotencyKey\":\"arena-a-8102\"}";
        String b = "{\"playerId\":\"Bruno\",\"questionId\":\"qb\",\"answer\":\"FALSO\",\"idempotencyKey\":\"arena-b-8102\"}";
        assertThat(request("POST", base + "/arena-answer", anna, null,
                a.replace("qa", "qb")).statusCode()).isEqualTo(400);
        ExecutorService clients = Executors.newFixedThreadPool(2);
        try {
            Future<HttpResponse<String>> first = clients.submit(() -> request("POST", base + "/arena-answer", anna, null, a));
            Future<HttpResponse<String>> second = clients.submit(() -> request("POST", base + "/arena-answer", bruno, null, b));
            assertThat(first.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
        } finally {
            clients.shutdownNow();
        }
        assertThat(questionHistory.scores(gameId)).containsEntry("Anna", 10).containsEntry("Bruno", 10);
        var replay = request("POST", base + "/arena-answer", anna, null, a);
        assertThat(replay.statusCode()).isEqualTo(200);
        assertThat(json.readTree(replay.body()).path("replayed").asBoolean()).isTrue();
        assertThat(questionHistory.scores(gameId)).containsEntry("Anna", 10).containsEntry("Bruno", 10);
        gameState.closeRound(gameId, "test");
        assertThat(request("POST", base + "/arena-answer", bruno, null, b).statusCode()).isEqualTo(409);
    }

    @Test
    void risposteArenaTardiveNonPassanoAUnAltroRound() throws Exception {
        long gameId = 8104L;
        String base = "/games/" + gameId;
        String anna = sessions.register(gameId, "arena-late-a", "REMOTE", "Anna", null).sessionToken();
        String bruno = sessions.register(gameId, "arena-late-b", "REMOTE", "Bruno", null).sessionToken();
        gameState.startRound(gameId, "ARENA", 1, "arena-8104-r1", "{}");
        questionHistory.assign(gameId, arenaAssignment(gameId, "qa-old", "Anna", "A?", "VERO", "test"));
        questionHistory.assign(gameId, arenaAssignment(gameId, "qb-old", "Bruno", "B?", "VERO", "test"));
        String a = "{\"playerId\":\"Anna\",\"questionId\":\"qa-old\",\"answer\":\"VERO\",\"idempotencyKey\":\"arena-late-a\"}";
        String b = "{\"playerId\":\"Bruno\",\"questionId\":\"qb-old\",\"answer\":\"VERO\",\"idempotencyKey\":\"arena-late-b\"}";
        assertThat(request("POST", base + "/arena-answer", anna, null, a).statusCode()).isEqualTo(200);
        assertThat(json.readTree(request("POST", base + "/arena-answer", anna, null, a).body()).path("replayed").asBoolean()).isTrue();

        // Il round e l'assegnazione sopravvivono al riavvio del servizio.
        QuestionHistoryService restarted = new QuestionHistoryService(questionUsage, stateBlobService);
        assertThat(restarted.assignment(gameId, "Bruno", "qb-old").orElseThrow().roundStartId())
                .isEqualTo(gameState.currentRoundStartId(gameId).orElseThrow());
        gameState.startRound(gameId, "QUIZ", 2, "quiz-8104-r2", "{}");
        assertThat(request("GET", base + "/arena-question?category=STORIA&playerId=Bruno", bruno, null, null).statusCode()).isEqualTo(409);
        assertThat(request("POST", base + "/arena-answer", bruno, null, b).statusCode()).isEqualTo(409);
        assertThat(request("POST", base + "/arena-answer", anna, null, a).statusCode()).isEqualTo(409);
        gameState.startRound(gameId, "ARENA", 3, "arena-8104-r3", "{}");
        var stale = request("POST", base + "/arena-answer", bruno, null, b);
        assertThat(stale.statusCode()).isEqualTo(409);
        assertThat(json.readTree(stale.body()).path("error").asText()).isEqualTo("arena-question-stale");
        assertThat(request("POST", base + "/arena-answer", anna, null, a).statusCode()).isEqualTo(409);
        assertThat(questionHistory.scores(gameId)).containsEntry("Anna", 10).doesNotContainKey("Bruno");
    }

    @Test
    void assegnazioneArenaLegacyNonVerificabileNonAssegnaPunti() throws Exception {
        long gameId = 8105L;
        String token = sessions.register(gameId, "arena-legacy", "REMOTE", "Anna", null).sessionToken();
        gameState.startRound(gameId, "ARENA", 1, "arena-legacy", "{}");
        questionHistory.assign(gameId, new QuestionHistoryService.ArenaAssignment("old", "Anna", "Q?", "VERO", "test"));
        var response = request("POST", "/games/" + gameId + "/arena-answer", token, null,
                "{\"playerId\":\"Anna\",\"questionId\":\"old\",\"answer\":\"VERO\",\"idempotencyKey\":\"legacy\"}");
        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(json.readTree(response.body()).path("error").asText()).isEqualTo("arena-question-stale");
        assertThat(questionHistory.scores(gameId)).doesNotContainKey("Anna");
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
            assertThat(frameContaining(frames, "CONNECTED")).startsWith("CONNECTED");
            socket.sendText("SUBSCRIBE\nid:status\ndestination:/topic/game/" + gameId + "/status\n\n\0", true).join();
            // Il messaggio di controllo conferma che la sottoscrizione è attiva.
            socket.sendText("SEND\ndestination:/app/game/" + gameId + "/status\ncontent-type:application/json\n\n"
                    + "{\"action\":\"CHRISTMAS_TOGGLE\",\"enabled\":true}\0", true).join();
            assertThat(frameContaining(frames, "CHRISTMAS_TOGGLE")).contains("CHRISTMAS_TOGGLE");

            gameState.startRound(gameId, "ARENA", 1, "arena-ws-510", "{}");
            questionHistory.assign(gameId, arenaAssignment(gameId, "q-ws", "Anna", "Domanda", "VERO", "Storia"));
            Map<String, Object> answer = Map.of("playerId", "Anna", "questionId", "q-ws",
                    "answer", "VERO", "idempotencyKey", "arena-ws-510");
            var accepted = gameController.answerArenaQuestion(gameId, answer);
            assertThat(accepted.getStatusCode().value()).isEqualTo(200);
            Map<?, ?> result = (Map<?, ?>) accepted.getBody();
            String event = frameContaining(frames, "ARENA_ANSWER");
            assertThat(event).contains("ARENA_ANSWER", "Anna", "isCorrect", "points",
                    String.valueOf(result.get("eventId")), "\"eventSeq\":" + result.get("eventSeq"));
            var stored = gameState.eventsSince(gameId, 0);
            assertThat(stored.getJSONObject(stored.length() - 1).getString("eventId")).isEqualTo(result.get("eventId"));
            assertThat(stored.getJSONObject(stored.length() - 1).getLong("seq"))
                    .isEqualTo(((Number) result.get("eventSeq")).longValue());
            assertThat(gameController.answerArenaQuestion(gameId, answer).getStatusCode().value()).isEqualTo(200);
            assertThat(frames.poll(500, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join();
        }
    }

    @Test
    void laRispostaArenaPassaDalControllerSoloUnaVolta() {
        long gameId = 505L;
        gameState.startRound(gameId, "ARENA", 1, "arena-505", "{}");
        questionHistory.assign(gameId, arenaAssignment(gameId, "q-2", "SquadraDue", "Domanda", "FALSO", "Storia"));

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
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

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
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

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
            long startedAt = ((Number) first.get("startedAt")).longValue();
            assertThat(((Number) second.get("startedAt")).longValue()).isEqualTo(startedAt);
            assertThat(List.of(first.get("replayed"), second.get("replayed")))
                    .containsExactlyInAnyOrder(false, true);

            // Ogni richiesta rimanda il via (serve a riarmare un telefono
            // riconnesso), ma il metro del tempo è uno solo: entrambi i
            // messaggi portano lo startedAt del vincitore del CAS.
            ArgumentCaptor<String> payloads = ArgumentCaptor.forClass(String.class);
            verify(sender, times(2))
                    .convertAndSend(eq("/topic/game/" + gameId + "/status"), payloads.capture());
            assertThat(payloads.getAllValues()).allSatisfy(payload -> {
                var json = new org.json.JSONObject(payload);
                assertThat(json.getString("action")).isEqualTo("TIME_BUZZER_START");
                assertThat(json.getLong("startedAt")).isEqualTo(startedAt);
                assertThat(json.getInt("manche")).isEqualTo(1);
            });
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
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

        var response = party.timeBuzzerStart(gameId, Map.of("manche", 1));
        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(stateBlobs.load(gameId, "time-buzzer-start")).isEmpty();
    }

    @Test
    void timeBuzzerUsaLaDurataDelRoundPerLaFinestra() {
        var party = new com.pub_game_be.controller.PartyGamesController(partyGameService, questionBank,
                messaging, gameState, idempotency, stateBlobs,
                new com.pub_game_be.service.SpeedRushService(stateBlobs),
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

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
                new com.pub_game_be.service.BasketService(stateBlobs), questionHistory);

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
