package com.pub_game_be.service;

import com.pub_game_be.domain.game_round.GameRound;
import com.pub_game_be.repository.GameRoundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GameService {

    private final GameRoundRepository gameRoundRepository;

    public Optional<GameRound> getCurrentRound(Long gameId) {
        return gameRoundRepository
                .findFirstByGameIdOrderByRoundIndexDesc(gameId);
    }

}