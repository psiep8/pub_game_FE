package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Payload di Azzardo: quattro manche, una per categoria, con opzioni distinte. */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:azzardo-payload;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.azzardo.media.enabled=false"
})
class AzzardoPayloadTest {

    @Autowired
    private QuestionBankService bank;

    @Test
    void ogniLivelloHaQuattroCategorieEQuattroOpzioniVicine() {
        String[][] bands = { { "facile", "1" }, { "medio", "2" }, { "difficile", "3" } };

        for (String[] band : bands) {
            JSONObject payload = new JSONObject(
                    bank.generateQuestionJson("CULTURA GENERALE", "AZZARDO", band[0]));

            int level = Integer.parseInt(band[1]);
            assertThat(payload.getInt("level")).as("livello %s", band[0]).isEqualTo(level);
            assertThat(payload.getInt("odds")).as("quota %s", band[0]).isEqualTo(level + 1);

            JSONArray questions = payload.getJSONArray("questions");
            assertThat(questions.length()).as("manche %s", band[0]).isEqualTo(4);

            Set<String> categories = new HashSet<>();
            for (int index = 0; index < questions.length(); index++) {
                JSONObject question = questions.getJSONObject(index);
                categories.add(question.getString("category"));
                assertThat(question.getString("unit")).as("unita %s", band[0]).isNotBlank();

                JSONArray options = question.getJSONArray("options");
                assertThat(options.length()).as("opzioni %s", band[0]).isEqualTo(4);

                Set<Double> values = new HashSet<>();
                for (int option = 0; option < options.length(); option++) {
                    values.add(options.getDouble(option));
                }
                assertThat(values).as("opzioni distinte %s", question.getString("question")).hasSize(4);

                int answer = question.getInt("answerIndex");
                assertThat(answer).as("indice risposta %s", band[0]).isBetween(0, 3);
                assertThat(options.getDouble(answer))
                        .as("valore corretto %s", question.getString("question"))
                        .isEqualTo(question.getDouble("value"));
            }

            assertThat(categories)
                    .as("categorie %s", band[0])
                    .containsExactlyInAnyOrder("CELEBRITÀ", "CANZONI", "PAESI", "STORIA");
        }
    }
}
