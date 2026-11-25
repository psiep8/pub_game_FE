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

/** Indovina chi: tre manche, una per ambito, con punti decrescenti. */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:image-blur-manche;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "game.azzardo.media.enabled=false"
})
class ImageBlurManchePayloadTest {

    @Autowired
    private QuestionBankService bank;

    @Test
    void treMancheConAmbitiEPuntiDiversi() {
        JSONObject payload = new JSONObject(
                bank.generateQuestionJson("CELEBRITÀ", "IMAGE_BLUR", "facile"));

        JSONArray manches = payload.getJSONArray("manches");
        assertThat(manches.length()).as("tre manche").isEqualTo(3);
        assertThat(payload.getInt("totalManches")).isEqualTo(3);

        int[] expectedPoints = { 333, 333, 334 };
        Set<String> categories = new HashSet<>();
        Set<String> answers = new HashSet<>();
        for (int index = 0; index < manches.length(); index++) {
            JSONObject manche = manches.getJSONObject(index);
            assertThat(manche.getInt("manche")).as("indice manche").isEqualTo(index + 1);
            assertThat(manche.getInt("points")).as("punti manche %s", index + 1)
                    .isEqualTo(expectedPoints[index]);
            assertThat(manche.getString("categoryLabel")).as("ambito manche %s", index + 1)
                    .isNotBlank();
            assertThat(manche.getString("correctAnswer")).as("risposta manche %s", index + 1)
                    .isNotBlank();
            assertThat(manche.getString("imageUrl")).as("foto manche %s", index + 1)
                    .isNotBlank();

            categories.add(manche.getString("categoryLabel"));
            answers.add(manche.getString("correctAnswer"));
        }

        assertThat(categories).as("un ambito diverso per manche").hasSize(3);
        assertThat(answers).as("tre persone diverse").hasSize(3);
        assertThat(expectedPoints[0] + expectedPoints[1] + expectedPoints[2])
                .as("il round resta da 1000 punti")
                .isEqualTo(1000);
    }

    @Test
    void laChiavediDeduplicaCopreTutteLeManche() {
        JSONObject first = new JSONObject(
                bank.generateQuestionJson("CELEBRITÀ", "IMAGE_BLUR", "facile"));
        JSONObject changed = new JSONObject(first.toString());
        changed.getJSONArray("manches").getJSONObject(1).put("points", 123);

        assertThat(QuestionBankService.payloadDedupeKey(first.toString()))
                .as("lo stesso pacchetto è idempotente")
                .isEqualTo(QuestionBankService.payloadDedupeKey(first.toString()));
        assertThat(QuestionBankService.payloadDedupeKey(first.toString()))
                .as("due pacchetti con manche diverse non collidono")
                .isNotEqualTo(QuestionBankService.payloadDedupeKey(changed.toString()));
    }
}
