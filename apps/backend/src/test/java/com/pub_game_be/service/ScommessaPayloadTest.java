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
 * Payload di Tutto o metà: cinque domande, una per livello 100-500, tutte della
 * categoria estratta per il round, con quattro opzioni e una risposta presente.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:scommessa-payload;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ScommessaPayloadTest {

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
    void ogniCategoriaHaCinqueLivelliConQuattroOpzioni() {
        for (String category : CATEGORIES) {
            JSONObject payload = new JSONObject(
                    bank.generateQuestionJson(category, "SCOMMESSA", "medio", key -> true));

            JSONArray questions = payload.getJSONArray("questions");
            assertThat(questions.length()).as("livelli %s", category).isEqualTo(5);
            assertThat(payload.getString("category")).as("categoria %s", category).isNotBlank();

            Set<Integer> levels = new HashSet<>();
            Set<String> texts = new HashSet<>();
            for (int index = 0; index < questions.length(); index++) {
                JSONObject question = questions.getJSONObject(index);
                levels.add(question.getInt("level"));
                texts.add(question.getString("question"));

                assertThat(question.getString("category"))
                        .as("categoria della domanda %s", category)
                        .isEqualTo(payload.getString("category"));

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
