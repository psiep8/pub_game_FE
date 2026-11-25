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
 * Chi prende una bomba deve capirlo subito: l'evento parte alla scelta, non a
 * fine ondata. Il tabellone resta coperto e gli altri non vedono né l'elenco
 * degli eliminati né le penalità finché il round non è chiuso.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:bomba-explosion;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "pubgame.bomba.turn-seconds=30",
        "pubgame.bomba.reading-seconds=0"
})
class BombaExplosionEventTest {

    @Autowired
    private BombaService bomba;

    @Test
    void laBombaEsplodeSubitoSenzaScoprireIlTabellone() {
        JSONObject exploded = null;
        String bombPlayer = null;
        int chosenCell = -1;
        long gameId = 930_000L;

        // Con tre squadre il round resta quasi sempre aperto dopo la bomba. Se
        // la bomba fosse l ultima casella il tabellone si chiuderebbe subito:
        // in quel caso si riprova, perché il caso interessante e quello aperto.
        for (int attempt = 0; attempt < 6 && exploded == null; attempt++) {
            gameId = 930_000L + attempt;
            JSONObject state = bomba.start(gameId, List.of("Anna", "Bruno", "Carla"), 1);
            assertThat(state.getBoolean("active")).isTrue();

            JSONObject found = null;
            String finder = null;
            int cellId = -1;

            for (int pick = 0; pick < 40 && found == null; pick++) {
                state = bomba.state(gameId, "Anna");
                if (!state.getBoolean("active")) break;
                String turn = state.getString("turn");
                Integer free = firstFreeCell(state.getJSONArray("cells"));
                if (free == null) break;

                JSONObject after = bomba.pick(gameId, turn, free);
                JSONObject event = after.optJSONObject("lastEvent");
                if (event != null && "bomb".equals(event.optString("kind"))) {
                    if (after.getBoolean("active")) {
                        found = after;
                        finder = event.getString("player");
                        cellId = free;
                    }
                    break;
                }
            }

            if (found != null) {
                exploded = found;
                bombPlayer = finder;
                chosenCell = cellId;
            } else {
                bomba.reset(gameId);
            }
        }

        assertThat(exploded).as("serve un round ancora aperto dopo la bomba").isNotNull();
        String other = "Anna".equals(bombPlayer) ? "Bruno" : "Anna";

        // La casella scelta resta coperta: non si rivela la mappa delle bombe.
        JSONObject chosen = cellById(exploded.getJSONArray("cells"), chosenCell);
        assertThat(chosen.getBoolean("used")).isTrue();
        assertThat(chosen.has("bomb")).isFalse();

        // Gli esiti collettivi restano nascosti fino a fine ondata.
        assertThat(exploded.getJSONArray("eliminated").length()).isZero();
        assertThat(exploded.getJSONObject("penalties").isEmpty()).isTrue();

        // Chi ha scelto la bomba vede subito di essere fuori e la penalità.
        JSONObject mine = bomba.state(gameId, bombPlayer);
        assertThat(mine.getJSONObject("you").getBoolean("out")).isTrue();
        assertThat(mine.getJSONObject("you").getInt("penalty")).isEqualTo(-BombaService.BOMBA_PEAK);
        assertThat(eventoPenalty(exploded)).isEqualTo(BombaService.BOMBA_PEAK);

        // L'altra squadra non riceve la penalita al posto suo.
        JSONObject theirs = bomba.state(gameId, other);
        assertThat(theirs.getJSONObject("you").getBoolean("out")).isFalse();
        assertThat(theirs.getJSONObject("you").getInt("penalty")).isZero();

        bomba.reset(gameId);
    }

    private static int eventoPenalty(JSONObject state) {
        return state.getJSONObject("lastEvent").getInt("penalty");
    }

    private static Integer firstFreeCell(JSONArray cells) {
        for (int index = 0; index < cells.length(); index++) {
            JSONObject cell = cells.getJSONObject(index);
            if (!cell.getBoolean("used")) return cell.getInt("id");
        }
        return null;
    }

    private static JSONObject cellById(JSONArray cells, int id) {
        for (int index = 0; index < cells.length(); index++) {
            if (cells.getJSONObject(index).getInt("id") == id) return cells.getJSONObject(index);
        }
        throw new AssertionError("Casella " + id + " assente dallo stato");
    }
}
