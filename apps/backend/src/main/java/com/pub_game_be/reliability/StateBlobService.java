package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.StateBlobEntity;
import com.pub_game_be.reliability.repository.StateBlobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

/**
 * Persistenza dei pezzi di partita che prima vivevano solo in memoria
 * (round Timeline, risposte già accettate, punteggi dell'arena).
 *
 * <p>Chiave stabile per partita, contenuto JSON: si legge al primo uso dopo un
 * riavvio, quindi il round riparte esattamente da dove era rimasto.</p>
 */
@Service
public class StateBlobService {

    private final StateBlobRepository blobs;
    private final TransactionTemplate tx;

    public StateBlobService(StateBlobRepository blobs, PlatformTransactionManager transactionManager) {
        this.blobs = blobs;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public void save(long gameId, String blobKey, String payload) {
        tx.executeWithoutResult(status -> {
            StateBlobEntity blob = blobs.findByGameIdAndBlobKey(gameId, blobKey)
                    .orElseGet(StateBlobEntity::new);
            blob.setGameId(gameId);
            blob.setBlobKey(blobKey);
            blob.setPayload(payload);
            blob.setUpdatedAt(System.currentTimeMillis());
            blobs.save(blob);
        });
    }

    public Optional<String> load(long gameId, String blobKey) {
        return blobs.findByGameIdAndBlobKey(gameId, blobKey)
                .map(StateBlobEntity::getPayload)
                .filter(payload -> payload != null && !payload.isBlank());
    }

    public boolean exists(long gameId, String blobKey) {
        return blobs.findByGameIdAndBlobKey(gameId, blobKey).isPresent();
    }

    public void forget(long gameId, String blobKey) {
        blobs.findByGameIdAndBlobKey(gameId, blobKey).ifPresent(blob ->
                tx.executeWithoutResult(status -> blobs.delete(blob)));
    }

    public void forgetAll(long gameId) {
        tx.executeWithoutResult(status -> blobs.deleteByGameId(gameId));
    }
}
