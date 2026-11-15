package com.pub_game_be.reliability;

import com.pub_game_be.service.QuestionHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Il timeout Arena è deciso dal server e non dal timer locale della TV. */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:arena-inactivity;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ArenaInactivityTest {

    @Autowired
    private QuestionHistoryService questionHistory;

    @Autowired
    private QuestionUsageService questionUsage;

    @Autowired
    private StateBlobService stateBlobs;

    @Test
    void laPenalitaScattaDopoQuindiciSecondiESopravviveAlRiavvio() {
        long gameId = 810L;
        questionHistory.forget(gameId);
        long start = 1_700_000_000_000L;

        assertThat(questionHistory.claimArenaInactivity(gameId, List.of("Anna", "Bruno"),
                "g810-r1", false, start)).isEmpty();

        // Nuova istanza sullo stesso database: il conteggio non riparte da zero.
        QuestionHistoryService restarted = new QuestionHistoryService(questionUsage, stateBlobs);
        assertThat(restarted.claimArenaInactivity(gameId, List.of("Anna", "Bruno"),
                "g810-r1", false, start + 14_999)).isEmpty();
        assertThat(restarted.claimArenaInactivity(gameId, List.of("Anna", "Bruno"),
                "g810-r1", false, start + 15_000))
                .extracting(QuestionHistoryService.ArenaInactivity::playerName)
                .containsExactly("Anna", "Bruno");
        // La risposta HTTP può andare persa: il totale viene restituito di nuovo,
        // anche dopo un altro riavvio, senza maturare una seconda penalità.
        QuestionHistoryService restartedAgain = new QuestionHistoryService(questionUsage, stateBlobs);
        assertThat(restartedAgain.claimArenaInactivity(gameId, List.of("Anna", "Bruno"),
                "g810-r1", false, start + 15_001))
                .extracting(QuestionHistoryService.ArenaInactivity::penalties)
                .containsExactly(1, 1);
        assertThat(restartedAgain.claimArenaInactivity(gameId, List.of("Anna", "Bruno"),
                "g810-r1", false, start + 30_000))
                .extracting(QuestionHistoryService.ArenaInactivity::penalties)
                .containsExactly(2, 2);
    }

    @Test
    void unaRispostaAzzeraIlConteggioDiInattivita() {
        long gameId = 811L;
        questionHistory.forget(gameId);
        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q-anna", "Anna", "Domanda", "VERO", "Storia"));
        long beforeAnswer = System.currentTimeMillis();

        assertThat(questionHistory.answerAt(gameId, "Anna", "q-anna", "VERO", beforeAnswer)).isPresent();
        assertThat(questionHistory.claimArenaInactivity(gameId, List.of("Anna"),
                "g811-r1", false, beforeAnswer + 14_999)).isEmpty();
        assertThat(questionHistory.claimArenaInactivity(gameId, List.of("Anna"),
                "g811-r1", false, beforeAnswer + 15_000))
                .extracting(QuestionHistoryService.ArenaInactivity::playerName)
                .containsExactly("Anna");
    }

    @Test
    void unaRispostaNonCancellaLaPenalitaMaturataPrimaDelTick() {
        long gameId = 813L;
        String round = "g813-r1";
        long start = 1_700_000_000_000L;
        questionHistory.forget(gameId);
        questionHistory.claimArenaInactivity(gameId, List.of("Anna"), round, false, start);
        questionHistory.assign(gameId,
                new QuestionHistoryService.ArenaAssignment("q813", "Anna", "Domanda", "VERO", "Storia"));
        assertThat(questionHistory.answerAt(gameId, "Anna", "q813", "VERO", start + 15_500)).isPresent();

        QuestionHistoryService restarted = new QuestionHistoryService(questionUsage, stateBlobs);
        assertThat(restarted.claimArenaInactivity(gameId, List.of("Anna"), round, false, start + 15_501))
                .extracting(QuestionHistoryService.ArenaInactivity::penalties).containsExactly(1);
        assertThat(restarted.claimArenaInactivity(gameId, List.of("Anna"), round, false, start + 30_499))
                .extracting(QuestionHistoryService.ArenaInactivity::penalties).containsExactly(1);
        assertThat(restarted.claimArenaInactivity(gameId, List.of("Anna"), round, false, start + 30_500))
                .extracting(QuestionHistoryService.ArenaInactivity::penalties).containsExactly(2);
    }

    @Test
    void inPausaNessunaPenalitaEUnNuovoRoundAzzeraIlConteggio() {
        long gameId = 812L;
        questionHistory.forget(gameId);
        long start = 1_700_000_000_000L;

        questionHistory.claimArenaInactivity(gameId, List.of("Anna"), "g812-r1", false, start);
        assertThat(questionHistory.claimArenaInactivity(gameId, List.of("Anna"),
                "g812-r1", true, start + 30_000)).isEmpty();
        // Nessun tick necessario durante la pausa: la ripresa accredita solo
        // il periodo fermo, conservando i 5 secondi già trascorsi prima.
        QuestionHistoryService restarted = new QuestionHistoryService(questionUsage, stateBlobs);
        restarted.resumeArenaInactivity(gameId, "g812-r1", start + 5_000, start + 35_000);
        // Un retry, anche dopo un altro riavvio, non accredita due volte.
        QuestionHistoryService retried = new QuestionHistoryService(questionUsage, stateBlobs);
        retried.resumeArenaInactivity(gameId, "g812-r1", start + 5_000, start + 35_000);
        assertThat(retried.claimArenaInactivity(gameId, List.of("Anna"),
                "g812-r1", false, start + 44_999)).isEmpty();
        assertThat(retried.claimArenaInactivity(gameId, List.of("Anna"),
                "g812-r1", false, start + 45_000))
                .extracting(QuestionHistoryService.ArenaInactivity::playerName)
                .containsExactly("Anna");

        assertThat(retried.claimArenaInactivity(gameId, List.of("Anna"),
                "g812-r2", false, start + 47_000)).isEmpty();
        assertThat(retried.claimArenaInactivity(gameId, List.of("Anna"),
                "g812-r2", false, start + 62_000))
                .extracting(QuestionHistoryService.ArenaInactivity::playerName)
                .containsExactly("Anna");
    }
}