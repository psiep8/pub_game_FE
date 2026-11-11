package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Verifica che i due bonus non si fidino dei valori calcolati dal telefono. */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:speed-basket-service;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class SpeedRushBasketServiceTest {

    @Autowired
    private SpeedRushService speedRush;

    @Autowired
    private BasketService basket;

    @Test
    void speedRushNonEsponeLaSoluzioneEUnErroreNonAvanza() {
        long gameId = 810_001L;
        speedRush.start(gameId, List.of("Anna"), "speed-test-1");

        JSONObject task = speedRush.task(gameId, "Anna").orElseThrow();
        assertThat(task.has("answer")).isFalse();
        assertThat(task.getString("taskId")).isNotBlank();

        JSONObject result = speedRush.answer(
                gameId, "Anna", task.getString("taskId"), "RISPOSTA-SICURAMENTE-SBAGLIATA")
                .orElseThrow();
        assertThat(result.getBoolean("correct")).isFalse();
        assertThat(result.getInt("progress")).isZero();

        JSONArray finish = speedRush.finish(gameId);
        assertThat(finish.length()).isEqualTo(1);
        assertThat(finish.getJSONObject(0).getInt("points")).isZero();
    }

    @Test
    void basketAssegnaPuntiSoloAlTiroDentroLaFinestraDelServer() {
        long gameId = 810_002L;
        basket.start(gameId, List.of("Bruno"));
        JSONObject state = basket.state(gameId, "Bruno");

        double target = state.getDouble("targetPull");
        JSONObject made = basket.shot(gameId, "Bruno", state.getString("shotId"), target, 0)
                .orElseThrow();
        assertThat(made.getBoolean("made")).isTrue();
        assertThat(made.getInt("points")).isPositive();
        assertThat(made.getInt("score")).isEqualTo(made.getInt("points"));

        JSONObject missed = basket.shot(
                gameId, "Bruno", made.getString("nextShotId"), target > 0.5 ? 0.0 : 1.0, 0)
                .orElseThrow();
        assertThat(missed.getBoolean("made")).isFalse();
        assertThat(missed.getInt("points")).isZero();
        assertThat(missed.getInt("score")).isEqualTo(made.getInt("score"));
    }
}