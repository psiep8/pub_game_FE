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
    void speedRushDuraNovantaSecondiDallaPrimaRisposta() {
        JSONObject session = speedRush.start(810_003L, List.of("Anna"), "speed-test-durata");
        // F-32: all'apertura non c'è ancora un tempo che scorre.
        assertThat(session.getLong("deadlineAt")).isZero();
    }

    @Test
    void laRipresaRileggeLeCorsieSenzaRiavviareLaCorsa() {
        // La TV, dopo un refresh, richiama lo start: stessa sessione e corsie complete.
        long gameId = 810_004L;
        JSONObject first = speedRush.start(gameId, List.of("Anna"), "speed-test-ripresa");
        JSONObject again = speedRush.start(gameId, List.of("Anna"), "speed-test-ripresa");

        assertThat(again.getLong("startedAt")).isEqualTo(first.getLong("startedAt"));
        JSONObject lane = again.getJSONArray("players").getJSONObject(0);
        assertThat(lane.getString("playerName")).isEqualTo("Anna");
        assertThat(lane.keySet())
                .contains("progress", "streak", "multiplier", "finished", "position", "finishedAt");
    }

    @Test
    void laCorsaNonSiChiudeConPocheRisposteGiuste() {
        // Le prime sei corrette valgono 2, dalla settima il raddoppio porta 4:
        // il traguardo da 100 richiede 28 risposte, non 25.
        assertThat(SpeedRushService.minimumCorrectAnswers()).isEqualTo(28);
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
    void iProverbiHannoTreFinaliDistintiEUsanoIlSestoTipo() {
        java.util.Set<String> kinds = new java.util.HashSet<>();
        for (int index = 0; index < 120; index++) {
            SpeedRushService.Task task = speedRush.newTask(null, "MEDIUM", new java.util.HashSet<>());
            kinds.add(task.kind());
            if (!"proverb".equals(task.kind())) continue;

            JSONObject pub = new JSONObject(task.publicJson());
            JSONArray options = pub.getJSONArray("options");
            java.util.Set<String> unique = new java.util.HashSet<>();
            boolean answerPresent = false;
            for (int option = 0; option < options.length(); option++) {
                String value = options.getString(option);
                unique.add(value);
                answerPresent |= task.answer().equals(value);
            }
            assertThat(options.length()).isEqualTo(3);
            assertThat(unique).hasSize(3);
            assertThat(answerPresent).isTrue();
            assertThat(pub.getString("prompt")).endsWith("...");
        }
        assertThat(kinds).contains("proverb");
    }

    @Test
    void iVecchiMicrogiochiEIlGeograficoArrivanoSuTutteLeFasce() {
        java.util.Set<String> kinds = new java.util.HashSet<>();
        for (String difficulty : List.of("EASY", "MEDIUM", "HARD")) {
            for (int index = 0; index < 120; index++) {
                SpeedRushService.Task task = speedRush.newTask(null, difficulty, new java.util.HashSet<>());
                kinds.add(task.kind());
                JSONObject pub = new JSONObject(task.publicJson());

                switch (task.kind()) {
                    case "geo" -> {
                        JSONArray options = pub.getJSONArray("options");
                        assertThat(options.length()).isEqualTo(3);
                        assertThat(pub.getString("prompt")).contains("regione").contains("«");
                        java.util.Set<String> unique = new java.util.HashSet<>();
                        boolean answerPresent = false;
                        for (int option = 0; option < options.length(); option++) {
                            unique.add(options.getString(option));
                            answerPresent |= task.answer().equals(options.getString(option));
                        }
                        assertThat(unique).hasSize(3);
                        assertThat(answerPresent).isTrue();
                    }
                    case "tap" -> assertThat(task.answer())
                            .isEqualTo(String.valueOf(pub.getInt("target")));
                    case "odd" -> {
                        JSONArray options = pub.getJSONArray("options");
                        assertThat(options.length()).isGreaterThanOrEqualTo(4);
                        boolean answerPresent = false;
                        for (int option = 0; option < options.length(); option++) {
                            answerPresent |= task.answer().equals(options.getString(option));
                        }
                        assertThat(answerPresent).isTrue();
                    }
                    case "order" -> {
                        String[] answer = task.answer().split("\\|");
                        assertThat(answer).hasSize(pub.getJSONArray("options").length());
                        assertThat(new java.util.HashSet<>(java.util.List.of(answer)))
                                .hasSize(answer.length);
                    }
                    case "reaction" -> assertThat(pub.getInt("delayMs"))
                            .isBetween(900, 3099);
                    default -> { }
                }
            }
        }

        assertThat(kinds).contains("math", "colors", "flag", "words", "translate", "proverb",
                "tap", "odd", "order", "reaction", "geo");
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

    @Test
    void speedRushIlTempoParteAllaPrimaRisposta() {
        long gameId = 810_201L;
        JSONObject started = speedRush.start(gameId, List.of("Anna", "Bruno"), "clock-test-1");
        assertThat(started.getLong("deadlineAt")).isZero();

        JSONObject task = speedRush.task(gameId, "Anna").orElseThrow();
        speedRush.answer(gameId, "Anna", task.getString("taskId"), "SBAGLIATA").orElseThrow();

        JSONObject after = speedRush.start(gameId, List.of("Anna", "Bruno"), "clock-test-1");
        assertThat(after.getLong("deadlineAt"))
                .isGreaterThan(System.currentTimeMillis() + 80_000L);
    }

    @Test
    void speedRushNienteDueCategorieDiFilaENellePrimeOtto() {
        long gameId = 810_202L;
        speedRush.start(gameId, List.of("Anna"), "order-test-1");

        List<String> kinds = new java.util.ArrayList<>();
        for (int index = 0; index < 8; index++) {
            JSONObject task = speedRush.task(gameId, "Anna").orElseThrow();
            kinds.add(task.getString("kind"));
            speedRush.answer(gameId, "Anna", task.getString("taskId"), "SBAGLIATA").orElseThrow();
        }

        assertThat(kinds).doesNotHaveDuplicates();
    }

    @Test
    void speedRushNonRipeteDuecentoProveNellaStessaSessione() {
        long gameId = 810_203L;
        speedRush.start(gameId, List.of("Anna"), "dedupe-test-1");

        java.util.Set<String> signatures = new java.util.HashSet<>();
        for (int index = 0; index < 200; index++) {
            JSONObject task = speedRush.task(gameId, "Anna").orElseThrow();
            String signature = speedRush.signature(new SpeedRushService.Task(
                    task.getString("taskId"), task.getString("kind"),
                    task.toString(), String.valueOf(task.opt("answer"))));
            assertThat(signatures.add(signature))
                    .as("prova ripetuta alla pescata %d: %s", index, signature)
                    .isTrue();
            speedRush.answer(gameId, "Anna", task.getString("taskId"), "SBAGLIATA").orElseThrow();
        }
    }
}
