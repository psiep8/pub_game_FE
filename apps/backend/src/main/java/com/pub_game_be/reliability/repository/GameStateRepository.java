package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.GameStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameStateRepository extends JpaRepository<GameStateEntity, Long> {

    /** Partita toccata più di recente: è quella che una nuova TV deve aprire. */
    Optional<GameStateEntity> findFirstByOrderByUpdatedAtDesc();
}
