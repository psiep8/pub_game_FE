package com.pub_game_be.service;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
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

    @Autowired
    private StateBlobService stateBlobs;

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

    private String roundId(long gameId) {
        return gameState.currentRoundStartId(gameId).orElseThrow();
    }

    private QuizService.Outcome answer(long gameId, String playerName, int option) {
        return quiz.answer(gameId, playerName, option, quiz.summary(gameId).getInt("mancheIndex"),
                gameState.currentRoundStartId(gameId).orElseThrow());
    }

    @Test
    void rispostaCorrettaValeQuasiTuttiIPuntiSubito() {
        long gameId = 910_001L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));

        QuizService.Outcome outcome = answer(gameId, "Anna", 1);

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
        quiz.startManche(gameId, 0, roundId(gameId));

        QuizService.Outcome outcome = answer(gameId, "Anna", 0);

        assertThat(outcome.accepted()).isTrue();
        assertThat(outcome.result().getBoolean("isCorrect")).isFalse();
        assertThat(outcome.result().getInt("points")).isEqualTo(QuizService.WRONG_PENALTY);
    }

    @Test
    void unTelefonoNonVotaDueVolteNellaStessaManche() {
        long gameId = 910_003L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));

        assertThat(answer(gameId, "Anna", 1).accepted()).isTrue();
        QuizService.Outcome again = answer(gameId, "Anna", 0);

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

        QuizService.Outcome outcome = answer(gameId, "Anna", 1);

        assertThat(outcome.accepted()).isFalse();
        assertThat(outcome.reason()).isEqualTo("manche-closed");
    }

    @Test
    void leRisposteRestanoPerIlRecuperoDellaTv() {
        long gameId = 910_005L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));
        answer(gameId, "Anna", 1);
        answer(gameId, "Bruno", 0);

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
        JSONObject first = quiz.startManche(gameId, 0, roundId(gameId));
        assertThat(answer(gameId, "Anna", 1).accepted()).isTrue();

        JSONObject repeated = quiz.startManche(gameId, 0, roundId(gameId));
        assertThat(repeated.getLong("startedAt")).isEqualTo(first.getLong("startedAt"));

        quiz.startManche(gameId, 1, roundId(gameId));
        QuizService.Outcome second = answer(gameId, "Anna", 0);

        assertThat(second.accepted()).isTrue();
        assertThat(second.result().getInt("manche")).isEqualTo(1);
        assertThat(second.result().getBoolean("isCorrect")).isTrue();
        assertThat(quiz.summary(gameId).getJSONArray("answers").length()).isEqualTo(2);
    }

    @Test
    void votoFuoriDaUnaOpzioneEsistenteVieneRifiutato() {
        long gameId = 910_007L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));

        assertThat(answer(gameId, "Anna", 9).reason()).isEqualTo("invalid-option");
        assertThat(answer(gameId, "Anna", -1).reason()).isEqualTo("invalid-option");
    }

    @Test
    void laRipresaRiannunciaLaMancheConIlTempoCheResta() {
        long gameId = 910_009L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));
        answer(gameId, "Anna", 1);
        // Il backend è ripartito senza lo stato della manche.
        quiz.forget(gameId);

        JSONObject resumed = quiz.startManche(gameId, 0, 6, roundId(gameId));

        long remaining = resumed.getLong("deadlineAt") - System.currentTimeMillis();
        assertThat(remaining).isBetween(4_500L, 6_000L);
        assertThat(resumed.getLong("startedAt"))
                .isEqualTo(resumed.getLong("deadlineAt") - QuizService.MANCHE_MS);
        // La riannuncio non regala punti pieni: il tempo consumato conta.
        QuizService.Outcome again = answer(gameId, "Anna", 1);
        assertThat(again.accepted()).isTrue();
        assertThat(again.result().getInt("points")).isBetween(120, 180);
    }

    @Test
    void laRiannuncioSullaStessaMancheNonSpostaIlCronometro() {
        long gameId = 910_010L;
        apriRound(gameId, DUE_DOMANDE);
        JSONObject first = quiz.startManche(gameId, 0, roundId(gameId));

        JSONObject resumed = quiz.startManche(gameId, 0, 3, roundId(gameId));

        assertThat(resumed.getLong("startedAt")).isEqualTo(first.getLong("startedAt"));
        assertThat(resumed.getLong("deadlineAt")).isEqualTo(first.getLong("deadlineAt"));
    }

    @Test
    void unNuovoQuizArchiviaIVotiLegacySenzaSovrascriverli() {
        long gameId = 910_011L;
        apriRound(gameId, DUE_DOMANDE);
        String firstKey = gameState.snapshot(gameId).getString("roundKey");
        JSONObject firstLegacy = legacyBlob(firstKey, "Anna", 200);
        stateBlobs.save(gameId, "quiz", firstLegacy.toString());

        // Un cambio round non può cancellare i voti legacy: li archivia.
        gameState.startRound(gameId, "QUIZ", 2, "g910011-r2", DUE_DOMANDE);
        JSONObject opened = quiz.startManche(gameId, 0, roundId(gameId));
        assertThat(opened.getJSONArray("answers")).isEmpty();
        JSONObject archive = new JSONObject(stateBlobs.load(gameId, QuizService.LEGACY_ARCHIVE_BLOB)
                .orElseThrow());
        assertThat(archive.getString("replacedByRoundKey")).isEqualTo("g910011-r2");
        assertThat(archive.getJSONObject("legacy").getString("roundKey")).isEqualTo(firstKey);
        assertThat(archive.getJSONObject("legacy").getJSONArray("answers")
                .getJSONObject(0).getInt("points")).isEqualTo(200);

        // Un secondo legacy non sostituisce il primo archivio.
        stateBlobs.save(gameId, "quiz", legacyBlob("g910011-r2", "Bruno", 300).toString());
        gameState.startRound(gameId, "QUIZ", 3, "g910011-r3", DUE_DOMANDE);
        JSONObject reopened = quiz.startManche(gameId, 0, roundId(gameId));
        assertThat(reopened.getJSONArray("answers")).isEmpty();
        JSONObject stillFirst = new JSONObject(stateBlobs.load(gameId, QuizService.LEGACY_ARCHIVE_BLOB)
                .orElseThrow());
        assertThat(stillFirst.getJSONObject("legacy").getJSONArray("answers")
                .getJSONObject(0).getString("playerName")).isEqualTo("Anna");
    }

    private JSONObject legacyBlob(String roundKey, String playerName, int points) {
        return new JSONObject()
                .put("roundKey", roundKey)
                .put("mancheIndex", 0)
                .put("deadlineAt", System.currentTimeMillis() + 15_000)
                .put("answers", new JSONArray().put(new JSONObject()
                        .put("playerName", playerName)
                        .put("manche", 0)
                        .put("points", points)));
    }

    @Test
    void unRoundChiusoNonAccettaPiuVoti() {
        long gameId = 910_008L;
        apriRound(gameId, DUE_DOMANDE);
        quiz.startManche(gameId, 0, roundId(gameId));
        gameState.closeRound(gameId, "test");

        assertThat(answer(gameId, "Anna", 1).reason()).isEqualTo("round-closed");
    }
}
