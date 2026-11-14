package com.pub_game_be.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

abstract class CorsOriginsChecks {
    @LocalServerPort
    int port;

    HttpResponse<String> get(String path, String origin) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Origin", origin).GET().build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:cors-wildcard;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.security.allowed-origins=*"
})
class CorsWildcardTest extends CorsOriginsChecks {
    @Test
    void wildcardAccettaHttpESockJsSenzaErroreCredenziali() throws Exception {
        HttpResponse<String> http = get("/health", "http://example.test");
        assertThat(http.headers().firstValue("access-control-allow-origin")).contains("*");
        assertThat(http.headers().firstValue("access-control-allow-credentials")).isEmpty();

        HttpResponse<String> sockjs = get("/ws-pubgame/sockjs/info", "http://example.test");
        assertThat(sockjs.statusCode()).isEqualTo(200);
        assertThat(sockjs.headers().firstValue("access-control-allow-origin")).contains("http://example.test");
        assertThat(sockjs.headers().firstValue("access-control-allow-credentials")).contains("true");
    }
}

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:cors-explicit;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.security.allowed-origins=http://allowed.test"
})
class CorsExplicitOriginsTest extends CorsOriginsChecks {
    @Test
    void originiEspliciteNonConsentonoAltriSiti() throws Exception {
        HttpResponse<String> allowed = get("/ws-pubgame/sockjs/info", "http://allowed.test");
        assertThat(allowed.statusCode()).isEqualTo(200);
        assertThat(allowed.headers().firstValue("access-control-allow-origin")).contains("http://allowed.test");
        assertThat(allowed.headers().firstValue("access-control-allow-credentials")).contains("true");
        assertThat(get("/ws-pubgame/sockjs/info", "http://other.test").statusCode()).isEqualTo(403);
        assertThat(get("/health", "http://other.test").statusCode()).isEqualTo(403);
    }
}
