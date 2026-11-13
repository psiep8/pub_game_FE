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
    void laCorsaNonSiChiudeConPocheRisposteGiuste() {
        // Prima bastavano 4-5 risposte: il traguardo deve richiederne almeno 20.
        assertThat(SpeedRushService.minimumCorrectAnswers()).isGreaterThanOrEqualTo(20);
    }

    @Test
    void laCorsaNonRipeteLeProveENonParteSempreFacile() {
        java.util.Set<String> asked = new java.util.LinkedHashSet<>();
        java.util.Set<String> signatures = new java.util.HashSet<>();

        for (int index = 0; index < 60; index++) {
            String difficulty = speedRush.difficultyFor(index);
            assertThat(difficulty).isIn("EASY", "MEDIUM", "HARD");
            SpeedRushService.Task task = speedRush.newTask(null, difficulty, asked);
            assertThat(signatures.add(speedRush.signature(task)))
                    .as("prova ripetuta: " + speedRush.signature(task))
                    .isTrue();
        }

        assertThat(speedRush.difficultyFor(0)).isEqualTo("EASY");
        assertThat(speedRush.difficultyFor(40)).isEqualTo("MEDIUM");
        assertThat(speedRush.difficultyFor(80)).isEqualTo("HARD");

        // Le moltiplicazioni difficili non sono più 2 × 2.
        for (int index = 0; index < 40; index++) {
            SpeedRushService.Task task = speedRush.newTask(null, "HARD", new java.util.HashSet<>());
            if (!"math".equals(task.kind())) continue;
            String text = new JSONObject(task.publicJson()).getString("text");
            int first = Integer.parseInt(text.split(" ")[0]);
            assertThat(first).isGreaterThanOrEqualTo(12);
        }
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

        // Potenza giusta ma tiro largo: il ferro è piccolo, non basta la forza.
        JSONObject wide = basket.shot(
                gameId, "Bruno", missed.getString("nextShotId"),
                missed.getDouble("targetPull"), 0.9)
                .orElseThrow();
        assertThat(wide.getBoolean("made")).isFalse();
        assertThat(wide.getInt("points")).isZero();
    }
}