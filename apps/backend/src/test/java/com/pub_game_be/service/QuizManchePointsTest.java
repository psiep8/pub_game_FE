package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Valore delle tre manche del Quiz: i cinque mix di difficoltà che la banca
 * gioca davvero e la somma del round, che deve restare 1000.
 */
class QuizManchePointsTest {

    /** I cinque mix di `QuestionBankService.QUIZ_PATTERNS`, nell'ordine delle manche. */
    private static final List<String> FACILE_FACILE_MEDIO = List.of("facile", "facile", "medio");
    private static final List<String> FACILE_MEDIO_MEDIO = List.of("facile", "medio", "medio");
    private static final List<String> FACILE_MEDIO_DIFFICILE = List.of("facile", "medio", "difficile");
    private static final List<String> MEDIO_MEDIO_DIFFICILE = List.of("medio", "medio", "difficile");
    private static final List<String> MEDIO_DIFFICILE_DIFFICILE = List.of("medio", "difficile", "difficile");

    @Test
    void iCinqueMixValgonoLeQuoteConcordate() {
        // Due facili più una media: le facili restano a 250, la media prende il resto.
        assertThat(QuizService.manchePoints(FACILE_FACILE_MEDIO)).containsExactly(250, 250, 500);
        // Una facile più due medie: la facile 250, le medie 375.
        assertThat(QuizService.manchePoints(FACILE_MEDIO_MEDIO)).containsExactly(250, 375, 375);
        // Tre difficoltà diverse: la scala 200 / 350 / 450.
        assertThat(QuizService.manchePoints(FACILE_MEDIO_DIFFICILE)).containsExactly(200, 350, 450);
        // Due medie più una difficile.
        assertThat(QuizService.manchePoints(MEDIO_MEDIO_DIFFICILE)).containsExactly(250, 250, 500);
        // Una media più due difficili.
        assertThat(QuizService.manchePoints(MEDIO_DIFFICILE_DIFFICILE)).containsExactly(250, 375, 375);
    }

    @Test
    void laSommaDelRoundRestaMille() {
        for (List<String> mix : List.of(
                FACILE_FACILE_MEDIO,
                FACILE_MEDIO_MEDIO,
                FACILE_MEDIO_DIFFICILE,
                MEDIO_MEDIO_DIFFICILE,
                MEDIO_DIFFICILE_DIFFICILE)) {
            int[] points = QuizService.manchePoints(mix);
            assertThat(Arrays.stream(points).sum())
                    .as("mix %s", mix)
                    .isEqualTo(1000);
        }
    }
}
