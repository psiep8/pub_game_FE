package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Payload di Ultima spiaggia: una sola manche per occorrenza, una categoria
 * fissa e cinque domande (una per livello 100-500) con quattro opzioni.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:ultima spiaggia-payload;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class UltimaSpiaggiaPayloadTest {

    private static final List<String> CATEGORIES = List.of(
            "Storia",
            "Geografia e Viaggi",
            "Scienza e Spazio",
            "Natura e Animali",
            "Sport",
            "Cinema, Serie TV",
            "TV e Spettacolo",
            "Musica",
            "Arte e Architettura",
            "Politica e Attualità",
            "Motori",
            "Cibo e Gastronomia",
            "Lingua e Letteratura",
            "Anime e manga",
            "Gaming e Tecnologia",
            "Curiosità");

    @Autowired
    private QuestionBankService bank;

    @Test
    void ogniOccorrenzaHaUnaCategoriaECinqueLivelliConQuattroOpzioni() {
        for (String category : CATEGORIES) {
            JSONObject payload = new JSONObject(
                    bank.generateQuestionJson(category, "ULTIMA_SPIAGGIA", "medio", key -> true));

            JSONArray rounds = payload.getJSONArray("rounds");
            assertThat(rounds.length()).as("un solo round %s", category).isEqualTo(1);

            JSONObject round = rounds.getJSONObject(0);
            String roundCategory = round.getString("category");
            assertThat(roundCategory).as("categoria %s", category).isNotBlank();
            assertThat(payload.getString("category")).as("categoria top-level %s", category)
                    .isEqualTo(roundCategory);

            JSONArray questions = round.getJSONArray("questions");
            assertThat(questions.length()).as("livelli %s", category).isEqualTo(5);
            assertThat(payload.getJSONArray("questions").length())
                    .as("domande top-level %s", category)
                    .isEqualTo(5);

            Set<Integer> levels = new HashSet<>();
            Set<String> texts = new HashSet<>();
            for (int index = 0; index < questions.length(); index++) {
                JSONObject question = questions.getJSONObject(index);
                levels.add(question.getInt("level"));
                texts.add(question.getString("question"));

                assertThat(question.getString("category"))
                        .as("categoria della domanda %s", category)
                        .isEqualTo(roundCategory);

                JSONArray options = question.getJSONArray("options");
                assertThat(options.length()).as("opzioni %s", category).isEqualTo(4);

                Set<String> values = new HashSet<>();
                for (int option = 0; option < options.length(); option++) {
                    values.add(options.getString(option));
                }
                assertThat(values).as("opzioni distinte %s", category).hasSize(4);
                assertThat(values).as("risposta presente %s", category)
                        .contains(question.getString("correctAnswer"));
            }

            assertThat(levels).as("livelli %s", category)
                    .containsExactlyInAnyOrder(100, 200, 300, 400, 500);
            assertThat(texts).as("domande distinte %s", category).hasSize(5);
        }
    }
}
