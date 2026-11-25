package com.pub_game_be.service;

import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F-21: prima del primo turno c'è la lettura dell'argomento. Il tabellone è
 * già visibile, ma il server non accetta scelte finché la fase non passa a TURN.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:bomba-reading;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "pubgame.bomba.reading-seconds=1",
        "pubgame.bomba.turn-seconds=1"
})
class BombaReadingTest {

    @Autowired
    private BombaService bomba;

    @Test
    void duranteLaLetturaSiGuardaSoloEIlTurnoParteDopo() throws Exception {
        long gameId = 920_101L;
        JSONObject start = bomba.start(gameId, List.of("Anna", "Bruno"), 1);

        assertThat(start.getString("phase")).isEqualTo("READING");
        assertThat(start.getBoolean("reading")).isTrue();
        assertThat(start.getString("prompt")).isNotBlank();
        assertThat(start.getInt("secondsLeft")).isBetween(1, 2);

        JSONObject refused = bomba.pick(gameId, "Anna", 1);
        assertThat(refused.getString("phase")).isEqualTo("READING");
        assertThat(refused.getJSONArray("cells").getJSONObject(0).getBoolean("used")).isFalse();

        JSONObject state = null;
        for (int attempt = 0; attempt < 30; attempt++) {
            state = bomba.state(gameId, "Anna");
            if ("TURN".equals(state.getString("phase"))) break;
            Thread.sleep(100);
        }
        assertThat(state).isNotNull();
        assertThat(state.getString("phase")).isEqualTo("TURN");
        assertThat(state.getBoolean("reading")).isFalse();
    }
}
