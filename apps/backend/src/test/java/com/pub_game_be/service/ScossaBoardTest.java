package com.pub_game_be.service;

import com.pub_game_be.service.QuestionBankService.ScossaBoard;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il filtro per difficoltà non deve svuotare il tabellone: da due a otto
 * squadre, in tutti gli atti, servono abbastanza celle sicure e bombe distinte.
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
    void ogniAttoHaUnTabelloneGiocabileDaDueAOttoSquadre() {
        for (int players = 2; players <= 8; players++) {
            int cells = BombaService.cellsFor(players);
            int bombs = BombaService.bombsFor(players);
            for (int act = 1; act <= 5; act++) {
                for (int run = 0; run < 3; run++) {
                    ScossaBoard board = bank.scossaBoard(cells, bombs, act);

                    assertThat(board.prompt()).as("atto %d, %d squadre", act, players).isNotBlank();
                    assertThat(board.safe()).as("celle sicure atto %d, %d squadre", act, players)
                            .hasSize(cells - bombs);
                    assertThat(board.intruders()).as("bombe atto %d, %d squadre", act, players)
                            .hasSize(bombs);

                    List<String> all = new ArrayList<>(board.safe());
                    all.addAll(board.intruders());
                    Set<String> seen = new HashSet<>();
                    for (String item : all) {
                        assertThat(item).as("valore atto %d, %d squadre", act, players).isNotBlank();
                        assertThat(seen.add(item.toLowerCase(Locale.ROOT)))
                                .as("duplicato «%s» atto %d, %d squadre", item, act, players)
                                .isTrue();
                    }
                }
            }
        }
    }
}
