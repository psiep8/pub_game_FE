package com.pub_game_be.service;

import com.pub_game_be.controller.GameController;
import com.pub_game_be.controller.PartyGamesController;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.domain.game_round.GameRound;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test di avvio: per ogni gioco della scaletta crea una partita e apre
 * davvero il primo round; per i bonus verifica i servizi che hanno bisogno del
 * server (Bomba, Speed Rush, Basket, Karaoke, Cavallo, Tennis).
 *
 * <p>Casino, Blackjack e Biglie sono guidati dalla TV: il backend apre il loro
 * round/configurazione, mentre la mano o la gara vive nel mode della TV. Casino
 * non ha un endpoint di avvio BE separato.</p>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:all-games-startup;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AllGamesStartupTest {

    private record GameCase(String type, String category, String difficulty) {
    }

    private static final List<GameCase> GAMES = List.of(
            new GameCase("QUIZ", "Storia", "medio"),
            new GameCase("MUSIC", "Musica", "medio"),
            new GameCase("IMAGE_BLUR", "CELEBRITÀ", "facile"),
            new GameCase("WHEEL_OF_FORTUNE", "PROVERBI", "facile"),
            new GameCase("ARENA", "Storia", "medio"),
            new GameCase("TIMELINE", "Storia", "medio"),
            new GameCase("TIME_BUZZER", "Storia", "medio"),
            new GameCase("BOMBA", "Storia", "medio"),
            new GameCase("SPEED_RUSH", "Storia", "medio"),
            new GameCase("TENNIS_BATTLE", "Storia", "medio"),
            new GameCase("ULTIMA_SPIAGGIA", "Storia", "medio"),
            new GameCase("AZZARDO", "CELEBRITÀ", "facile"),
            new GameCase("BLACKJACK", "Storia", "medio"),
            new GameCase("BIGLIE", "Storia", "medio"));

    private static final List<String> PLAYERS = List.of("Anna", "Bruno", "Carla", "Dario", "Elena");

    @Autowired
    private GameController gameController;

    @Autowired
    private PartyGamesController partyGamesController;

    @Autowired
    private BombaService bombaService;

    @Autowired
    private SpeedRushService speedRushService;

    @Autowired
    private BasketService basketService;

    @Autowired
    private KaraokeService karaokeService;

    @Test
    void tuttiIGiochiDellaScalettaAprionoIlPrimoRound() {
        for (GameCase gameCase : GAMES) {
            Game game = gameController.create();
            GameRound round = gameController.generateAiRound(game.getId(), gameCase.category(),
                    gameCase.type(), gameCase.difficulty());

            assertThat(round).as("round creato per %s", gameCase.type()).isNotNull();
            assertThat(round.getType().name()).as("tipo di %s", gameCase.type())
                    .isEqualTo(gameCase.type());
            assertThat(round.getPayload()).as("payload di %s", gameCase.type())
                    .isNotBlank();
        }
    }

    @Test
    void iBonusConStatoServerPartono() {
        JSONObject bomba = bombaService.start(9_001L, PLAYERS, 1);
        assertThat(bomba.getJSONArray("cells")).as("tabellone Bomba 5 squadre").hasSize(12);
        assertThat(bomba.getJSONArray("players")).hasSize(5);
        assertThat(bomba.getString("phase")).isEqualTo("READING");
        bombaService.reset(9_001L);

        JSONObject speed = speedRushService.start(9_002L, PLAYERS, "smoke-round");
        assertThat(speed.getBoolean("active")).as("Speed Rush attivo").isTrue();
        assertThat(speed.getJSONArray("players")).hasSize(5);

        JSONObject basket = basketService.start(9_003L, PLAYERS);
        assertThat(basket.getBoolean("active")).as("Basket attivo").isTrue();
        assertThat(basket.getInt("players")).isEqualTo(5);
        JSONObject basketState = basketService.state(9_003L, "Anna");
        assertThat(basketState.getBoolean("active")).as("turno Basket di Anna").isTrue();
        assertThat(basketState.getString("shotId")).isNotBlank();

        assertThat(karaokeService.selezione(9_004L)).as("cinque manche Karaoke").hasSize(5);

        List<Map<String, Object>> tennis = partyGamesController.tennisQuestions(9_005L, "MIXED", 12);
        assertThat(tennis).as("domande Tennis").hasSize(12);
        assertThat(tennis).allSatisfy(row -> {
            assertThat(row.get("question")).as("testo Tennis").isNotNull();
            assertThat((List<?>) row.get("options")).as("opzioni Tennis").hasSize(4);
        });

        List<Map<String, Object>> cavallo = partyGamesController.cavalloQuestions(9_006L, "Storia", 8);
        assertThat(cavallo).as("domande Cavallo").hasSize(8);
        assertThat(cavallo).allSatisfy(row -> {
            List<?> options = (List<?>) row.get("options");
            assertThat(options).map(String::valueOf).as("opzioni Cavallo")
                    .contains(String.valueOf(row.get("correctAnswer")));
        });
    }
}
