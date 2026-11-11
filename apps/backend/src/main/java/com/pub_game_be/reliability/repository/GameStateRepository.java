package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.GameStateEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameStateRepository extends JpaRepository<GameStateEntity, Long> {

    /** Partita toccata più di recente: è quella che una nuova TV deve aprire. */
    Optional<GameStateEntity> findFirstByOrderByUpdatedAtDesc();

    /**
     * Legge lo stato tenendo la riga bloccata fino al commit: due risposte
     * simultanee non possono leggere lo stesso seq e inserire lo stesso evento.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from GameStateEntity s where s.gameId = :gameId")
    Optional<GameStateEntity> findForUpdate(@Param("gameId") Long gameId);
}
