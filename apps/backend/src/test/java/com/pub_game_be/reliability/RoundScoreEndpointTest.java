package com.pub_game_be.reliability;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica il contratto HTTP che la TV usa davvero: PUT per round, GET dello
 * storico e sostituzione idempotente dello stesso roundIndex.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:round-scores-endpoint;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.security.control-secret=0123456789abcdef0123456789abcdef"
})
class RoundScoreEndpointTest {

    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient client = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @Test
    void salvaRileggeESostituisceIlRound() throws Exception {
        // La rotta è riservata alla TV/regia: senza sessione il server non la espone.
        assertThat(HttpClient.newHttpClient().send(HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/games/991/round-scores"))
                .GET().build(), HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
        String token = tvSession(991);
        HttpResponse<String> saved = put(991, token, 0, """
                {"type":"MUSIC","entries":[
                  {"playerName":"Anna","points":120,"totalPoints":320},
                  {"playerName":"Bruno","points":-40,"totalPoints":160}
                ]}
                """);

        assertThat(saved.statusCode()).isEqualTo(200);
        JsonNode savedBody = json.readTree(saved.body());
        assertThat(savedBody.path("gameId").asLong()).isEqualTo(991);
        assertThat(savedBody.path("roundIndex").asInt()).isZero();
        assertThat(savedBody.path("saved").asInt()).isEqualTo(2);

        JsonNode history = get(991, token);
        assertThat(history.path("gameId").asLong()).isEqualTo(991);
        assertThat(history.path("rounds")).hasSize(1);
        JsonNode round = history.path("rounds").get(0);
        assertThat(round.path("roundIndex").asInt()).isZero();
        assertThat(round.path("type").asText()).isEqualTo("MUSIC");
        assertThat(round.path("entries")).hasSize(2);
        assertThat(round.path("entries").get(0).path("playerName").asText()).isEqualTo("Anna");
        assertThat(round.path("entries").get(0).path("points").asInt()).isEqualTo(120);

        // Un retry dello stesso round sostituisce le righe, non le somma.
        HttpResponse<String> retried = put(991, token, 0, """
                {"type":"MUSIC","entries":[
                  {"playerName":"Anna","points":150,"totalPoints":350}
                ]}
                """);
        assertThat(retried.statusCode()).isEqualTo(200);

        JsonNode replaced = get(991, token).path("rounds").get(0);
        assertThat(replaced.path("entries")).hasSize(1);
        assertThat(replaced.path("entries").get(0).path("points").asInt()).isEqualTo(150);

        // Il round successivo si aggiunge e lo storico resta ordinato.
        assertThat(put(991, token, 1, """
                {"type":"QUIZ","entries":[
                  {"playerName":"Bruno","points":300,"totalPoints":460}
                ]}
                """).statusCode()).isEqualTo(200);

        JsonNode ordered = get(991, token).path("rounds");
        assertThat(ordered).hasSize(2);
        assertThat(ordered.get(0).path("roundIndex").asInt()).isZero();
        assertThat(ordered.get(1).path("roundIndex").asInt()).isEqualTo(1);
    }

    @Test
    void rifiutaUnIndiceFuoriIntervallo() throws Exception {
        String token = tvSession(992);
        HttpResponse<String> response = put(992, token, -1, """
                {"type":"QUIZ","entries":[]}
                """);

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(json.readTree(response.body()).path("error").asText())
                .isEqualTo("invalid-round-index");
    }

    private String tvSession(long gameId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/games/" + gameId + "/session"))
                .header("Content-Type", "application/json")
                .header("X-Control-Secret", "0123456789abcdef0123456789abcdef")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"deviceId\":\"round-score-tv\",\"role\":\"TV\"}"))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return json.readTree(response.body()).path("sessionToken").asText();
    }

    private HttpResponse<String> put(long gameId, String token, int roundIndex, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/games/" + gameId
                        + "/round-scores/" + roundIndex))
                .header("Content-Type", "application/json")
                .header("X-Session-Token", token)
                .PUT(HttpRequest.BodyPublishers.ofString(body))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode get(long gameId, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/games/" + gameId + "/round-scores"))
                .header("X-Session-Token", token)
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return json.readTree(response.body());
    }
}