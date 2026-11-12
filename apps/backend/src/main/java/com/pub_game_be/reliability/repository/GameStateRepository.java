package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.GameStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameStateRepository extends JpaRepository<GameStateEntity, Long> {

    /** Partita toccata più di recente: è quella che una nuova TV deve aprire. */
    Optional<GameStateEntity> findFirstByOrderByUpdatedAtDesc();

    /**
     * Incrementa la sequenza direttamente sul database. L'UPDATE è atomico:
     * due processi che condividono lo stesso DB non possono assegnare lo stesso
     * seq, anche se hanno lock Java separati (o nessun lock in comune).
     *
     * <p>Il chiamante deve eseguire questo metodo dentro una transazione e
     * rileggere lo stato dopo l'update: il valore restituito è il numero di righe
     * aggiornate, non il nuovo seq.</p>
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "update game_state set seq = seq + 1, version = version + 1, "
            + "updated_at = :now, last_snapshot_at = :now where game_id = :gameId",
            nativeQuery = true)
    int advanceSequence(@Param("gameId") Long gameId, @Param("now") long now);
}
