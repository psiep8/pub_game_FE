package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Lo storico deve restare per round, sostituire la riga a un retry e sparire
 * con il reset: è la base delle statistiche di N-15.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:round-scores;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RoundScoreServiceTest {

    @Autowired
    private RoundScoreService scores;

    @Test
    void salvaUnRoundPerVoltaESostituisceAlRetry() {
        long gameId = 901L;
        scores.save(gameId, 0, "MUSIC", List.of(
                Map.of("playerName", "Anna", "points", 120, "totalPoints", 320),
                Map.of("playerName", "Bruno", "points", 40, "totalPoints", 140)));

        JSONObject history = scores.history(gameId);
        JSONArray rounds = history.getJSONArray("rounds");
        assertThat(rounds.length()).isEqualTo(1);
        JSONObject first = rounds.getJSONObject(0);
        assertThat(first.getInt("roundIndex")).isZero();
        assertThat(first.getString("type")).isEqualTo("MUSIC");
        assertThat(first.getJSONArray("entries").length()).isEqualTo(2);

        // Un retry dello stesso round sostituisce, non somma.
        scores.save(gameId, 0, "MUSIC", List.of(
                Map.of("playerName", "Anna", "points", 150, "totalPoints", 350)));
        JSONObject replaced = scores.history(gameId).getJSONArray("rounds").getJSONObject(0);
        assertThat(replaced.getJSONArray("entries").length()).isEqualTo(1);
        assertThat(replaced.getJSONArray("entries").getJSONObject(0).getInt("points")).isEqualTo(150);

        scores.save(gameId, 1, "QUIZ", List.of(
                Map.of("playerName", "Anna", "points", -50, "totalPoints", 300)));
        JSONArray ordered = scores.history(gameId).getJSONArray("rounds");
        assertThat(ordered.length()).isEqualTo(2);
        assertThat(ordered.getJSONObject(1).getInt("roundIndex")).isEqualTo(1);
        assertThat(ordered.getJSONObject(1).getString("type")).isEqualTo("QUIZ");

        scores.forget(gameId);
        assertThat(scores.history(gameId).getJSONArray("rounds").length()).isZero();
    }

    @Test
    void scartaIndiciFuoriIntervallo() {
        assertThatThrownBy(() -> scores.save(902L, -1, "QUIZ", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> scores.save(902L, 128, "QUIZ", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void normalizzaNomiEDuplicati() {
        long gameId = 903L;
        int saved = scores.save(gameId, 2, "quiz", List.of(
                Map.of("playerName", " Anna ", "points", 10, "totalPoints", 10),
                Map.of("playerName", "Anna", "points", 999, "totalPoints", 999),
                Map.of("playerName", "", "points", 50, "totalPoints", 50)));

        assertThat(saved).isEqualTo(1);
        JSONObject entry = scores.history(gameId).getJSONArray("rounds")
                .getJSONObject(0).getJSONArray("entries").getJSONObject(0);
        assertThat(entry.getString("playerName")).isEqualTo("Anna");
        assertThat(entry.getInt("points")).isEqualTo(10);
    }
}