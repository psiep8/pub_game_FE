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
        "pubgame.bomba.turn-seconds=30"
})
class BombaExplosionEventTest {

    @Autowired
    private BombaService bomba;

    @Test
    void laBombaEsplodeSubitoSenzaScoprireIlTabellone() {
        long gameId = 930_001L;
        JSONObject state = bomba.start(gameId, List.of("Anna", "Bruno"), 1);
        assertThat(state.getBoolean("active")).isTrue();

        JSONObject exploded = null;
        String bombPlayer = null;
        int chosenCell = -1;

        for (int attempt = 0; attempt < 30 && exploded == null; attempt++) {
            state = bomba.state(gameId, "Anna");
            if (!state.getBoolean("active")) break;
            String turn = state.getString("turn");
            Integer free = firstFreeCell(state.getJSONArray("cells"));
            if (free == null) break;

            JSONObject after = bomba.pick(gameId, turn, free);
            JSONObject event = after.optJSONObject("lastEvent");
            if (event != null && "bomb".equals(event.optString("kind"))) {
                exploded = after;
                bombPlayer = event.getString("player");
                chosenCell = free;
            }
        }

        assertThat(exploded).as("una bomba deve uscire in poche scelte").isNotNull();
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
        assertThat(mine.getJSONObject("you").getInt("penalty")).isEqualTo(-BombaService.BOMB_PENALTY);

        // L'altra squadra non riceve la penalità al posto suo.
        JSONObject theirs = bomba.state(gameId, other);
        assertThat(theirs.getJSONObject("you").getBoolean("out")).isFalse();
        assertThat(theirs.getJSONObject("you").getInt("penalty")).isZero();
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
