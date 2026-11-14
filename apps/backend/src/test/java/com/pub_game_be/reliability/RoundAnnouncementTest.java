package com.pub_game_be.reliability;

import com.pub_game_be.reliability.repository.GameEventRepository;
import com.pub_game_be.reliability.repository.GameStateRepository;
import com.pub_game_be.repository.GameRoundRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F04: un telefono che si riallinea non deve vedere il round nuovo prima che
 * la TV abbia finito l'intro. L'annuncio arriva con START_VOTING e deve
 * sopravvivere a un riavvio del server.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:round-announcement;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RoundAnnouncementTest {

    @Autowired
    private GameStateService gameState;

    @Autowired
    private GameStateRepository states;

    @Autowired
    private GameEventRepository events;

    @Autowired
    private GameRoundRepository rounds;

    @Autowired
    private ReliabilityProperties props;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private StateBlobService stateBlobs;

    @Test
    void loSnapshotNonAnticipaIlRoundPrimaDellAnnuncio() {
        long gameId = 740L;
        gameState.startRound(gameId, "QUIZ", 1, "g740-r1", "{}");

        assertThat(gameState.snapshot(gameId).getBoolean("announced")).isFalse();

        gameState.markRoundAnnounced(gameId);

        assertThat(gameState.snapshot(gameId).getBoolean("announced")).isTrue();
    }

    @Test
    void lAnnuncioSopravviveAlRiavvioDelServer() {
        long gameId = 741L;
        gameState.startRound(gameId, "QUIZ", 1, "g741-r1", "{}");
        gameState.markRoundAnnounced(gameId);

        GameStateService restarted = new GameStateService(
                states, events, rounds, props, transactionManager, entityManager, stateBlobs);

        assertThat(restarted.snapshot(gameId).getBoolean("announced")).isTrue();
    }
}
