package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il turno scaduto è un'eliminazione, non un semplice salto: costa la penalità
 * di una bomba e toglie la squadra dalle ondate successive. Gli esiti, però,
 * si scoprono solo a fine ondata, altrimenti basterebbe guardare il tabellone
 * per contare le bombe.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:bomba-timeout;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // Turni da un secondo: la prova non aspetta i venti veri.
        "pubgame.bomba.turn-seconds=1"
})
class BombaTimeoutTest {

    @Autowired
    private BombaService bomba;

    @Test
    void chiNonSceglieInTempoEEliminatoEGliEsitiEsconoSoloAFineOndata() throws Exception {
        long gameId = 920_001L;
        JSONObject start = bomba.start(gameId, List.of("Anna", "Bruno"), 1);

        // Nessuna casella scopre il proprio contenuto all'inizio.
        JSONArray cells = start.getJSONArray("cells");
        for (int index = 0; index < cells.length(); index++) {
            assertThat(cells.getJSONObject(index).has("bomb")).isFalse();
        }

        JSONObject ended = null;
        for (int attempt = 0; attempt < 40 && ended == null; attempt++) {
            JSONObject state = bomba.state(gameId, "Anna");
            if (state.getBoolean("active")) {
                // Durante l'ondata eliminati e penalità restano nascosti.
                assertThat(state.getJSONArray("eliminated").length()).isZero();
                assertThat(state.getJSONObject("penalties").isEmpty()).isTrue();
            } else {
                ended = state;
            }
            if (ended == null) Thread.sleep(150);
        }

        assertThat(ended).as("il round deve chiudersi quando tutti restano senza tempo").isNotNull();
        assertThat(ended.getJSONArray("eliminated").length()).isEqualTo(2);
        assertThat(ended.getJSONObject("penalties").getInt("Anna")).isEqualTo(-BombaService.BOMB_PENALTY);
        assertThat(ended.getJSONObject("penalties").getInt("Bruno")).isEqualTo(-BombaService.BOMB_PENALTY);

        // A fine ondata il tabellone si scopre tutto.
        JSONArray finalCells = ended.getJSONArray("cells");
        for (int index = 0; index < finalCells.length(); index++) {
            assertThat(finalCells.getJSONObject(index).has("bomb")).isTrue();
        }
    }
}
