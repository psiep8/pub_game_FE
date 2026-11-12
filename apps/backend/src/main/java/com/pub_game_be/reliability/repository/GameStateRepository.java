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

    /**
     * Sposta la scadenza solo in avanti, senza riscrivere stato, round o
     * payload: un Time Buzzer che parte mentre arrivano risposte non deve
     * sovrascrivere una mutazione concorrente con una copia vecchia.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "update game_state set round_deadline_at = case "
            + "when round_deadline_at is null or round_deadline_at < :deadline then :deadline "
            + "else round_deadline_at end, updated_at = :now, version = version + 1 "
            + "where game_id = :gameId", nativeQuery = true)
    int extendRoundDeadline(@Param("gameId") Long gameId, @Param("deadline") long deadline,
            @Param("now") long now);
}
