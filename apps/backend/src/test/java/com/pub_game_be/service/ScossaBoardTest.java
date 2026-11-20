package com.pub_game_be.service;

import com.pub_game_be.service.QuestionBankService.BombaStatement;
import com.pub_game_be.service.QuestionBankService.ScossaBoard;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il tabellone Bomba è fatto di affermazioni: quelle vere salvano, quelle
 * false sono bombe. Non si chiede più "quale non appartiene alla categoria".
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:scossa-board;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ScossaBoardTest {

    @Autowired
    private QuestionBankService bank;

    private Map<String, Boolean> truthByStatement() {
        Map<String, Boolean> truth = new HashMap<>();
        for (BombaStatement row : bank.bombaBank()) {
            truth.put(row.statement(), row.truth());
        }
        return truth;
    }

    @Test
    void laBancaHaAffermazioniVereEFalse() {
        long trueRows = bank.bombaBank().stream().filter(BombaStatement::truth).count();
        long falseRows = bank.bombaBank().size() - trueRows;

        assertThat(trueRows).as("affermazioni vere").isGreaterThanOrEqualTo(22);
        assertThat(falseRows).as("bombe disponibili").isGreaterThanOrEqualTo(3);
        assertThat(bank.bombaBank())
                .allSatisfy(row -> {
                    assertThat(row.statement()).isNotBlank();
                    assertThat(row.source()).as("fonte di %s", row.statement()).startsWith("https://");
                });
    }

    @Test
    void ogniAttoHaUnTabelloneGiocabileDaDueAOttoSquadre() {
        Map<String, Boolean> truth = truthByStatement();
        for (int players = 2; players <= 10; players++) {
            int cells = BombaService.cellsFor(players);
            int bombs = BombaService.bombsFor(players);
            for (int act = 1; act <= 5; act++) {
                for (int run = 0; run < 3; run++) {
                    ScossaBoard board = bank.scossaBoard(cells, bombs, act);

                    assertThat(board.prompt()).as("atto %d, %d squadre", act, players)
                            .contains("affermazione")
                            .doesNotContainIgnoringCase("non appartiene");
                    assertThat(board.safe()).as("celle salva-vita atto %d, %d squadre", act, players)
                            .hasSize(cells - bombs);
                    assertThat(board.intruders()).as("bombe atto %d, %d squadre", act, players)
                            .hasSize(bombs);

                    List<String> all = new ArrayList<>(board.safe());
                    all.addAll(board.intruders());
                    Set<String> seen = new HashSet<>();
                    for (String statement : board.safe()) {
                        assertThat(truth.get(statement)).as("«%s» deve essere vera", statement).isTrue();
                        assertThat(seen.add(statement)).as("duplicato «%s»", statement).isTrue();
                    }
                    for (String statement : board.intruders()) {
                        assertThat(truth.get(statement)).as("«%s» deve essere falsa", statement).isFalse();
                        assertThat(seen.add(statement)).as("duplicato «%s»", statement).isTrue();
                    }
                }
            }
        }
    }
}
