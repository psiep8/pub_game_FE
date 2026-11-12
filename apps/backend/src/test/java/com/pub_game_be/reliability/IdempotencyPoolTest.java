package com.pub_game_be.reliability;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Concorrenza dell'idempotenza con un pool volutamente minuscolo: se la
 * transazione della ricevuta tenesse la connessione durante l'azione, i thread
 * in attesa andrebbero in timeout Hikari (partita #161, 10/10 connessioni
 * occupate da 16 risposte simultanee).
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:idempotency-pool;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.connection-timeout=500",
        "game.security.control-secret=0123456789abcdef0123456789abcdef"
})
class IdempotencyPoolTest {

    @Autowired
    private IdempotencyService idempotency;

    @Autowired
    private StateBlobService stateBlobs;

    @Test
    void ottoAzioniSimultaneeNonEsaurisconoIlPool() throws Exception {
        long gameId = 901L;
        int players = 8;
        var pool = Executors.newFixedThreadPool(players);
        var start = new CountDownLatch(1);
        var results = new ArrayList<java.util.concurrent.Future<Map<String, Object>>>();
        try {
            for (int index = 0; index < players; index++) {
                String name = "giocatore-" + index;
                results.add(pool.submit(() -> {
                    start.await();
                    return idempotency.executeOnce(gameId, "chiave-" + name, "ARENA_ANSWER", name, () -> {
                        // Come le azioni vere: scrivono un blob e poi "lavorano".
                        stateBlobs.save(gameId, "risposte-" + name, "{\"count\":1}");
                        sleep(1000);
                        return Map.of("playerName", name);
                    });
                }));
            }
            long startedAt = System.currentTimeMillis();
            start.countDown();
            List<Map<String, Object>> done = new ArrayList<>();
            for (var future : results) {
                done.add(future.get(15, TimeUnit.SECONDS));
            }
            long elapsed = System.currentTimeMillis() - startedAt;

            assertThat(done).hasSize(players).allSatisfy(result -> assertThat(result)
                    .containsEntry("replayed", false));
            // Le azioni girano in parallelo: se il pool fosse occupato dalle
            // transazioni si arriverebbe almeno a 8 × 1 s.
            assertThat(elapsed).isLessThan(5_000);
        } finally {
            pool.shutdownNow();
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
