package com.pub_game_be.repository;

import com.pub_game_be.domain.game.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {

    /** Ultima partita creata, usata come fallback prima che esista uno stato. */
    Optional<Game> findTopByOrderByIdDesc();
}
