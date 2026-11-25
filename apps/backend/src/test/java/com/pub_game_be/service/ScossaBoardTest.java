package com.pub_game_be.service;

import com.pub_game_be.service.QuestionBankService.BombaTopic;
import com.pub_game_be.service.QuestionBankService.ScossaBoard;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F-23: il tabellone Bomba non è più un elenco di affermazioni ma un argomento
 * «quali di questi…?» con elementi giusti e bombe plausibili già separati.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:scossa-board;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ScossaBoardTest {

    @Autowired
    private QuestionBankService bank;

    @Test
    void almenoSessantaArgomentiConVenticinqueSalviEDieciBombe() {
        List<BombaTopic> topics = bank.bombaTopics();

        assertThat(topics).as("argomenti F-23").hasSizeGreaterThanOrEqualTo(60);
        Set<String> ids = new HashSet<>();
        for (BombaTopic topic : topics) {
            assertThat(ids.add(topic.id())).as("id ripetuto: %s", topic.id()).isTrue();
            assertThat(topic.prompt()).as("%s: domanda", topic.id()).endsWith("?");
            assertThat(topic.safe()).as("%s: salvi", topic.id()).hasSizeGreaterThanOrEqualTo(25);
            assertThat(topic.intruders()).as("%s: bombe", topic.id()).hasSizeGreaterThanOrEqualTo(10);
            assertThat(topic.sources()).as("%s: fonti", topic.id()).isNotEmpty()
                    .allSatisfy(source -> assertThat(source).startsWith("https://"));
            assertThat(new HashSet<>(topic.safe())).as("%s: salvi duplicati", topic.id())
                    .hasSameSizeAs(topic.safe());
            assertThat(new HashSet<>(topic.intruders())).as("%s: bombe duplicate", topic.id())
                    .hasSameSizeAs(topic.intruders());
            assertThat(topic.safe()).as("%s: salvo e bomba insieme", topic.id())
                    .doesNotContainAnyElementsOf(topic.intruders());
        }
    }

    @Test
    void ogniAttoHaUnTabelloneGiocabileDaDueADieciSquadre() {
        for (int players = 2; players <= 10; players++) {
            int cells = BombaService.cellsFor(players);
            int bombs = BombaService.bombsFor(players);
            for (int act = 1; act <= 5; act++) {
                for (int run = 0; run < 3; run++) {
                    ScossaBoard board = bank.scossaBoard(cells, bombs, act);

                    assertThat(board.prompt()).as("atto %d, %d squadre", act, players).endsWith("?");
                    assertThat(board.safe()).as("celle salva-vita atto %d, %d squadre", act, players)
                            .hasSize(cells - bombs);
                    assertThat(board.intruders()).as("bombe atto %d, %d squadre", act, players)
                            .hasSize(bombs);

                    List<String> all = new ArrayList<>(board.safe());
                    all.addAll(board.intruders());
                    assertThat(new HashSet<>(all)).as("celle ripetute").hasSameSizeAs(all);
                }
            }
        }
    }

    @Test
    void gliArgomentiNonTornanoNellaStessaSerata() {
        bank.resetBombaTopics();
        Set<String> prompts = new HashSet<>();
        // Più di un giro completo della scorta: ogni prompt deve uscire una
        // volta prima di poter ricominciare.
        for (int index = 0; index < 60; index++) {
            ScossaBoard board = bank.scossaBoard(25, 4, 1);
            assertThat(prompts.add(board.prompt()))
                    .as("argomento ripetuto prima del giro completo: %s", board.prompt())
                    .isTrue();
        }
    }
}
