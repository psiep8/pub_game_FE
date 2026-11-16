package com.pub_game_be.service;

import com.pub_game_be.reliability.GameStateService;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il voto del Quiz lo decide il server: tempo, soluzione e un solo voto per
 * telefono e manche. Prima la TV contava da sé, quindi un refresh perdeva le
 * risposte e un retry poteva valere doppio.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:quiz-answer;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class QuizServiceTest {

    @Autowired
    private GameStateService gameState;

    @Autowired
    private QuizService quiz;

    private static final String DUE_DOMANDE = """
            {"type":"QUIZ","category":"Storia",
             "questions":[
               {"question":"Capitale d'Italia?","options":["Milano","Roma","Napoli","Torino"],"correctAnswer":"Roma","difficulty":"medio"},
               {"question":"Chi scrisse la Divina Commedia?","options":["Dante","Petrarca","Boccaccio","Manzoni"],"correctAnswer":"Dante","difficulty":"difficile"}
             ]}
            """;

    private void apriRound(long gameId, String payload) {
        gameState.startRound(gameId, "QUIZ", 1, "g" + gameId + "-r1", payload);
    }

    @Test
    void rispostaCorrettaValeQuasiTuttiIPuntiSubito() {
        long gameId = 910_001L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);

        QuizService.Outcome outcome = quiz.answer(gameId, "Anna", 1);

        assertThat(outcome.accepted()).isTrue();
        assertThat(outcome.result().getBoolean("isCorrect")).isTrue();
        assertThat(outcome.result().getInt("manche")).isZero();
        // Due domande medio (2) e difficile (3): la prima vale 400 dei 1000 del round.
        assertThat(outcome.result().getInt("points")).isBetween(380, 400);
    }

    @Test
    void sbagliataSottraeMillePunti() {
        long gameId = 910_002L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);

        QuizService.Outcome outcome = quiz.answer(gameId, "Anna", 0);

        assertThat(outcome.accepted()).isTrue();
        assertThat(outcome.result().getBoolean("isCorrect")).isFalse();
        assertThat(outcome.result().getInt("points")).isEqualTo(QuizService.WRONG_PENALTY);
    }

    @Test
    void unTelefonoNonVotaDueVolteNellaStessaManche() {
        long gameId = 910_003L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);

        assertThat(quiz.answer(gameId, "Anna", 1).accepted()).isTrue();
        QuizService.Outcome again = quiz.answer(gameId, "Anna", 0);

        assertThat(again.accepted()).isFalse();
        assertThat(again.reason()).isEqualTo("already-answered");
        // Il primo voto resta quello registrato.
        assertThat(quiz.summary(gameId).getJSONArray("answers").length()).isEqualTo(1);
        assertThat(quiz.summary(gameId).getJSONArray("answers").getJSONObject(0).getInt("optionIndex"))
                .isEqualTo(1);
    }

    @Test
    void senzaMancheAnnunciataIlVotoNonEntra() {
        long gameId = 910_004L;
        apriRound(gameId, DUE_DOMANDE);

        QuizService.Outcome outcome = quiz.answer(gameId, "Anna", 1);

        assertThat(outcome.accepted()).isFalse();
        assertThat(outcome.reason()).isEqualTo("manche-closed");
    }

    @Test
    void leRisposteRestanoPerIlRecuperoDellaTv() {
        long gameId = 910_005L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);
        quiz.answer(gameId, "Anna", 1);
        quiz.answer(gameId, "Bruno", 0);

        JSONObject summary = quiz.summary(gameId);

        assertThat(summary.getInt("mancheIndex")).isZero();
        assertThat(summary.getJSONArray("answers").length()).isEqualTo(2);
        assertThat(summary.getJSONArray("answers").getJSONObject(0).getString("playerName")).isEqualTo("Anna");
        assertThat(summary.getLong("deadlineAt")).isGreaterThan(summary.getLong("startedAt"));
    }

    @Test
    void laMancheNuovaRiapreIlVotoElAnnuncioRipetutoNonAzzeraIlTempo() {
        long gameId = 910_006L;
        apriRound(gameId, DUE_DOMANDE);
        JSONObject first = quiz.startManche(gameId, 0);
        assertThat(quiz.answer(gameId, "Anna", 1).accepted()).isTrue();

        JSONObject repeated = quiz.startManche(gameId, 0);
        assertThat(repeated.getLong("startedAt")).isEqualTo(first.getLong("startedAt"));

        quiz.startManche(gameId, 1);
        QuizService.Outcome second = quiz.answer(gameId, "Anna", 0);

        assertThat(second.accepted()).isTrue();
        assertThat(second.result().getInt("manche")).isEqualTo(1);
        assertThat(second.result().getBoolean("isCorrect")).isTrue();
        assertThat(quiz.summary(gameId).getJSONArray("answers").length()).isEqualTo(2);
    }

    @Test
    void votoFuoriDaUnaOpzioneEsistenteVieneRifiutato() {
        long gameId = 910_007L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);

        assertThat(quiz.answer(gameId, "Anna", 9).reason()).isEqualTo("invalid-option");
        assertThat(quiz.answer(gameId, "Anna", -1).reason()).isEqualTo("invalid-option");
    }

    @Test
    void unRoundChiusoNonAccettaPiuVoti() {
        long gameId = 910_008L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0);
        gameState.closeRound(gameId, "test");

        assertThat(quiz.answer(gameId, "Anna", 1).reason()).isEqualTo("round-closed");
    }
}
