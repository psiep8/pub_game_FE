package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Ruota: la deduplica della serata vale anche per i proverbi.
 *
 * <p>Il controller prenota il payload con {@code payloadDedupeKey}; la banca
 * deve pescare solo fra i proverbi non ancora usati, altrimenti due round della
 * stessa serata possono mostrare la stessa frase.</p>
 */
class WheelProverbTest {

    private QuestionBankService bank() {
        return new QuestionBankService(
                mock(TMDBImageService.class),
                mock(AppleMusicCuratorService.class),
                mock(CelebrityImageService.class),
                mock(AzzardoMediaService.class),
                mock(LocalMediaBankService.class));
    }

    @Test
    void laRuotaNonRipeteLoStessoProverbioNellaStessaPartita() {
        QuestionBankService bank = bank();
        Set<String> used = new HashSet<>();

        for (int round = 1; round <= 30; round++) {
            String payload = bank.generateQuestionJson(null, "WHEEL_OF_FORTUNE", "facile",
                    key -> !used.contains(key));
            assertThat(payload).as("round %s", round).isNotBlank();
            assertThat(used.add(QuestionBankService.payloadDedupeKey(payload)))
                    .as("round %s ha ripetuto %s", round, payload)
                    .isTrue();
        }
    }

    @Test
    void conTuttiIProverbiUscitiLaRuotaRiparteDalMazzo() {
        QuestionBankService bank = bank();

        String payload = bank.generateQuestionJson(null, "WHEEL_OF_FORTUNE", "facile", key -> false);

        assertThat(payload).isNotBlank().doesNotContain("{");
    }
}
