package com.pub_game_be.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L'indice media è locale e non versionato: un clone pulito non ce l'ha.
 * Indizi e temi sono versionati e devono restare disponibili lo stesso.
 */
class LocalMediaBankServiceTest {

    @Test
    void senzaIndiceMediaCaricaComunqueIndiziETemi() {
        LocalMediaBankService bank = new LocalMediaBankService(
                "", new ClassPathResource("questions/media-it-assente.json"));

        assertThat(bank.hasPeople()).as("nessun volto senza indice media").isFalse();
        assertThat(bank.namesWithClues()).as("volti della banca indizi").isNotEmpty();
        assertThat(bank.clues(bank.namesWithClues().get(0))).as("quattro indizi").hasSize(4);
        assertThat(bank.hasMusicThemes()).as("temi Musica versionati").isTrue();
    }
}
