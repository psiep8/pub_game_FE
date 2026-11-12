package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.StateBlobEntity;
import com.pub_game_be.reliability.repository.StateBlobRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

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
    /** Un lock per (partita, chiave): due scritture dello stesso blob non si sovrappongono. */
    private final ConcurrentMap<String, Object> locks = new ConcurrentHashMap<>();

    public StateBlobService(StateBlobRepository blobs, PlatformTransactionManager transactionManager) {
        this.blobs = blobs;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public void save(long gameId, String blobKey, String payload) {
        Object lock = locks.computeIfAbsent(gameId + ":" + blobKey, key -> new Object());
        synchronized (lock) {
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
    }

    /**
     * Scrive il blob solo se il valore attuale è esattamente quello atteso.
     *
     * <p>Il lock per (partita, chiave) serializza il test-and-set nello stesso
     * processo; il vincolo unique su {@code state_blob} respinge l'insert di un
     * secondo processo. In caso di conflitto il chiamante rilegge e decide.</p>
     */
    public boolean compareAndSet(long gameId, String blobKey, String expectedPayload, String payload) {
        Object lock = locks.computeIfAbsent(gameId + ":" + blobKey, key -> new Object());
        synchronized (lock) {
            try {
                return Boolean.TRUE.equals(tx.execute(status -> {
                    Optional<StateBlobEntity> found = blobs.findByGameIdAndBlobKey(gameId, blobKey);
                    String current = found.map(StateBlobEntity::getPayload).orElse(null);
                    if (!Objects.equals(current, expectedPayload)) {
                        return false;
                    }
                    StateBlobEntity blob = found.orElseGet(StateBlobEntity::new);
                    blob.setGameId(gameId);
                    blob.setBlobKey(blobKey);
                    blob.setPayload(payload);
                    blob.setUpdatedAt(System.currentTimeMillis());
                    blobs.saveAndFlush(blob);
                    return true;
                }));
            } catch (DataIntegrityViolationException conflict) {
                return false;
            }
        }
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
