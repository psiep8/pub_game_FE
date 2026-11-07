package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Banca di Azzardo: trenta domande per categoria e livello, quattro opzioni
 * vicine e un solo valore corretto. Il file è generato da
 * scripts/generate-questions/build_azzardo_bank.py.
 */
class AzzardoBankTest {

    private static final List<String> CATEGORIES = List.of("CELEBRITÀ", "CANZONI", "PAESI", "STORIA");
    private static final List<Integer> LEVELS = List.of(1, 2, 3);

    @Test
    void trentaDomandePerCategoriaELivello() throws Exception {
        List<JSONObject> rows = read();

        for (int level : LEVELS) {
            for (String category : CATEGORIES) {
                long count = rows.stream()
                        .filter(row -> row.optInt("level") == level)
                        .filter(row -> category.equals(row.optString("category")))
                        .count();
                assertThat(count).as("%s livello %d", category, level).isGreaterThanOrEqualTo(30);
            }
        }
        assertThat(rows).hasSizeGreaterThanOrEqualTo(360);
    }

    @Test
    void leDomandeSonoUnichePerCategoriaELivello() throws Exception {
        Set<String> seen = new HashSet<>();
        for (JSONObject row : read()) {
            String key = row.optInt("level") + "|" + row.optString("category") + "|" + row.optString("question");
            assertThat(seen.add(key)).as("domanda ripetuta: %s", key).isTrue();
        }
    }

    @Test
    void ogniDomandaHaUnValoreEPassoUtili() throws Exception {
        for (JSONObject row : read()) {
            assertThat(row.optString("question")).as("domanda vuota").isNotBlank();
            assertThat(row.optString("unit")).as("unita vuota: %s", row.optString("question")).isNotBlank();
            assertThat(row.optDouble("value")).as("valore: %s", row.optString("question")).isGreaterThan(0);
            assertThat(row.optDouble("step")).as("passo: %s", row.optString("question")).isGreaterThan(0);

            if ("PAESI".equals(row.optString("category")) && row.optInt("level") < 3) {
                assertThat(row.optDouble("value")).as("confini: %s", row.optString("question"))
                        .isBetween(1.0, 20.0);
            }
        }
    }

    private List<JSONObject> read() throws Exception {
        try (InputStream stream = new ClassPathResource("questions/azzardo-it.json").getInputStream()) {
            JSONArray rows = new JSONArray(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            List<JSONObject> parsed = new ArrayList<>();
            for (int index = 0; index < rows.length(); index++) {
                parsed.add(rows.getJSONObject(index));
            }
            return parsed;
        }
    }
}
