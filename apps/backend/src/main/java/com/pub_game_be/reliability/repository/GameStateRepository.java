package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.GameStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameStateRepository extends JpaRepository<GameStateEntity, Long> {
}
