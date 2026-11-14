package com.pub_game_be.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Un indizio che cita il nome o il cognome della celebrità regala la risposta.
 * Il taglio deve scartare quelle frasi e tenere solo quelle innocue.
 */
class CelebrityClueLeakTest {

    private final CelebrityImageService service = new CelebrityImageService(new RestTemplate());

    @Test
    void scartaLeFrasiCheCitanoNomeOCognome() {
        List<String> clues = service.cluesFromLocal(
                "Michael Jackson",
                "cantante statunitense",
                "Michael Jackson è stato un cantante. Ha rivoluzionato il pop. "
                        + "Jackson ha vinto molti premi. Il suo album Thriller è il più venduto.");

        assertThat(clues)
                .as("nome e cognome non devono comparire in nessun indizio")
                .noneMatch(clue -> clue.toLowerCase().contains("michael"))
                .noneMatch(clue -> clue.toLowerCase().contains("jackson"));
        assertThat(clues)
                .as("le frasi innocue restano")
                .anyMatch(clue -> clue.contains("rivoluzionato"))
                .anyMatch(clue -> clue.contains("Thriller"));
    }

    @Test
    void riconosceIlCognomeDaSoloAncheConAccentiMaiuscole() {
        List<String> clues = service.cluesFromLocal(
                "Dua Lipa",
                "cantante britannica",
                "LIPA ha vinto un Grammy. Ha pubblicato diversi album. È nata a Londra.");

        assertThat(clues).noneMatch(clue -> clue.toLowerCase().contains("lipa"));
        assertThat(clues).anyMatch(clue -> clue.contains("album"));
    }

    @Test
    void nonScartaFrasiNormali() {
        List<String> clues = service.cluesFromLocal(
                "Cher",
                "cantante e attrice statunitense",
                "Ha vinto un Oscar. Ha pubblicato molti album. Ha debuttato negli anni Sessanta.");

        assertThat(clues).isNotEmpty();
        assertThat(clues).allMatch(clue -> !clue.toLowerCase().contains("cher"));
    }
}
