package com.pub_game_be.repository;

import com.pub_game_be.domain.game_round.GameRound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameRoundRepository extends JpaRepository<GameRound, Long> {

    long countByGameId(Long gameId);

    Optional<GameRound> findFirstByGameIdOrderByRoundIndexDesc(Long gameId);
}
