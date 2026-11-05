package com.pub_game_be.service;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.domain.enums.GameType;
import com.pub_game_be.domain.enums.RoundStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.domain.game_round.GameRound;
import com.pub_game_be.repository.CategoryRepository;
import com.pub_game_be.repository.GameRoundRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Random;

/**
 * Crea il round classico (TV + telefoni) pescando dalla banca domande.
 *
 * <p>La vecchia query su questions non trovava mai nulla: il database nasce con
 * le categorie ma senza domande, quindi l'endpoint rispondeva 500.</p>
 *
 * <p>La domanda viene prenotata prima che il round esista: se il pool non ha
 * più contenuti nuovi il round non parte con un doppione.</p>
 */
@Service
public class SimpleRoundService {

    private final CategoryRepository categoryRepository;
    private final GameRoundRepository gameRoundRepository;
    private final QuestionBankService questionBank;
    private final QuestionHistoryService questionHistory;
    private final Random random = new Random();

    public SimpleRoundService(CategoryRepository categoryRepository,
            GameRoundRepository gameRoundRepository,
            QuestionBankService questionBank,
            QuestionHistoryService questionHistory) {
        this.categoryRepository = categoryRepository;
        this.gameRoundRepository = gameRoundRepository;
        this.questionBank = questionBank;
        this.questionHistory = questionHistory;
    }

    public GameRound createRound(Game game, String difficulty) {
        List<Category> categories = categoryRepository.findByActiveTrueOrderBySortOrderAscNameAsc();
        if (categories.isEmpty()) {
            throw new RuntimeException("Nessuna categoria trovata nel database!");
        }

        String category = categories.get(random.nextInt(categories.size())).getName();
        String payload = questionBank.generateQuestionJson(category, "QUIZ", difficulty,
                key -> !questionHistory.isUsed(game.getId(), key));

        String questionKey = QuestionBankService.payloadDedupeKey(payload);
        if (!questionHistory.claim(game.getId(), questionKey, questionKey, "QUIZ")) {
            // La domanda era già uscita: si ripesca una volta sola.
            payload = questionBank.generateQuestionJson(category, "QUIZ", difficulty,
                    key -> !questionHistory.isUsed(game.getId(), key));
            questionKey = QuestionBankService.payloadDedupeKey(payload);
            if (!questionHistory.claim(game.getId(), questionKey, questionKey, "QUIZ")) {
                throw new IllegalStateException(
                        "Nessuna domanda nuova disponibile: il pool della serata è esaurito.");
            }
        }

        GameRound round = new GameRound();
        round.setGame(game);
        round.setPayload(payload);
        round.setStatus(RoundStatus.CREATED);
        round.setType(GameType.QUIZ);
        round.setRoundIndex((int) gameRoundRepository.countByGameId(game.getId()) + 1);
        return gameRoundRepository.save(round);
    }
}
