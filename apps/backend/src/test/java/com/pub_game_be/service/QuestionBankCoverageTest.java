package com.pub_game_be.service;

import com.pub_game_be.service.QuestionBankService.ArenaQuestion;
import com.pub_game_be.service.QuestionBankService.BombaQuestion;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.TestPropertySource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Copertura della banca domande.
 *
 * <p>La regola della serata: le categorie a branca unica hanno 15 domande per
 * fascia di difficoltà, le categorie a due branche ne hanno 10 per branca e per
 * fascia (10 Geografia + 10 Viaggi, 10 Scienza + 10 Spazio, ...). Le modalità
 * che pescano dalla banca — Arena, Cavallo di Battaglia, Bomba — devono poter
 * partire senza restare a secco.</p>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:bank-coverage;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class QuestionBankCoverageTest {

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

    private static final List<String> BANDS = List.of("facile", "medio", "difficile");

    /** Categorie a due branche: il tema dichiarato nella domanda decide la copertura. */
    private static final Map<String, List<String>> BRANCHES = Map.ofEntries(
            Map.entry("Geografia e Viaggi", List.of("Geografia", "Viaggi")),
            Map.entry("Scienza e Spazio", List.of("Scienza", "Spazio")),
            Map.entry("Natura e Animali", List.of("Natura", "Animali")),
            Map.entry("Cinema, Serie TV", List.of("Cinema", "Serie TV")),
            Map.entry("TV e Spettacolo", List.of("TV", "Spettacolo")),
            Map.entry("Arte e Architettura", List.of("Arte", "Architettura")),
            Map.entry("Politica e Attualità", List.of("Politica", "Attualità")),
            Map.entry("Cibo e Gastronomia", List.of("Cibo", "Gastronomia")),
            Map.entry("Lingua e Letteratura", List.of("Lingua", "Letteratura")),
            Map.entry("Anime e manga", List.of("Anime", "Manga")),
            Map.entry("Gaming e Tecnologia", List.of("Gaming", "Tecnologia")));

    @Autowired
    private QuestionBankService bank;

    /** Cinema, Serie TV vale doppio: dieci domande di film e dieci di serie. */
    private int targetFor(String category) {
        return "Cinema, Serie TV".equals(category) ? 20 : 15;
    }

    @Test
    void ogniCategoriaHaQuindiciDomandePerFascia() throws Exception {
        Map<String, Map<String, Integer>> counts = bandCounts();

        for (String category : CATEGORIES) {
            Map<String, Integer> perBand = counts.getOrDefault(category, Map.of());
            for (String band : BANDS) {
                assertThat(perBand.getOrDefault(band, 0))
                        .as("%s - %s", category, band)
                        .isGreaterThanOrEqualTo(targetFor(category));
            }
        }
    }

    /** Regola 10 + 10: ogni branca ha dieci domande in ognuna delle tre fasce. */
    @Test
    void ogniBrancaHaDieciDomandePerFascia() throws Exception {
        Map<String, Map<String, Integer>> counts = themeCounts();

        for (Map.Entry<String, List<String>> category : BRANCHES.entrySet()) {
            for (String branch : category.getValue()) {
                Map<String, Integer> perBand = counts.getOrDefault(category.getKey() + "|" + branch, Map.of());
                for (String band : BANDS) {
                    assertThat(perBand.getOrDefault(band, 0))
                            .as("%s - %s - %s", category.getKey(), branch, band)
                            .isGreaterThanOrEqualTo(10);
                }
            }
        }
    }

    @Test
    void laBancaCopreTutteLeCategorieUfficiali() throws Exception {
        Map<String, Map<String, Integer>> counts = bandCounts();
        for (String category : CATEGORIES) {
            assertThat(counts).as("categoria %s", category).containsKey(category);
        }
        assertThat(bank.bankSize()).isGreaterThanOrEqualTo(950);
    }

    /** Arena: ogni categoria ha abbastanza Vero/Falso per un round intero. */
    @Test
    void lArenaHaAlmenoQuindiciDomandePerCategoria() {
        for (String category : CATEGORIES) {
            List<ArenaQuestion> batch = bank.generateArenaBatch(category, 15, candidate -> true);
            assertThat(batch).as("arena %s", category).hasSize(15);
        }
    }

    /** Cavallo di Battaglia: otto domande giocabili della categoria scelta. */
    @Test
    void ilCavalloHaOttoDomandePerOgniCategoria() {
        for (String category : CATEGORIES) {
            List<Map<String, Object>> rows = bank.cavalloQuestions(category, 8);
            assertThat(rows).as("cavallo %s", category).hasSize(8);
            for (Map<String, Object> row : rows) {
                @SuppressWarnings("unchecked")
                List<String> options = (List<String>) row.get("options");
                assertThat(options).as("opzioni cavallo %s", category)
                        .contains(String.valueOf(row.get("correctAnswer")));
            }
        }
    }

    /** Quiz: il round parte già con tre domande e quattro opzioni. */
    @Test
    void ilQuizHaTreDomandePronteAllAvvio() {
        JSONObject payload = new JSONObject(bank.generateQuestionJson("Storia", "QUIZ", "medio"));
        JSONArray questions = payload.getJSONArray("questions");

        assertThat(questions).hasSize(3);
        for (int index = 0; index < questions.length(); index++) {
            JSONObject question = questions.getJSONObject(index);
            assertThat(question.getString("question")).isNotBlank();
            assertThat(question.getJSONArray("options")).hasSize(4);
            assertThat(question.getString("correctAnswer")).isNotBlank();
        }
    }

    /** Bomba: tutti e cinque gli atti hanno domande a sufficienza. */
    @Test
    void laBombaHaDomandePerOgniAtto() {
        for (int act = 1; act <= 5; act++) {
            List<BombaQuestion> questions = bank.bombaQuestions(act, 12);
            assertThat(questions).as("bomba atto %d", act).hasSize(12);
            for (BombaQuestion question : questions) {
                assertThat(question.options())
                        .as("opzioni bomba atto %d", act)
                        .contains(question.correctAnswer());
            }
        }
    }

    /** Conteggio per categoria + branca e fascia, letto dal file della banca. */
    private Map<String, Map<String, Integer>> themeCounts() throws Exception {
        Map<String, Map<String, Integer>> counts = new HashMap<>();
        for (JSONObject item : readQuestions()) {
            String theme = item.optString("theme", "");
            if (theme.isEmpty()) {
                continue;
            }
            String key = item.optString("category", "") + "|" + theme;
            String band = item.optString("difficulty", "").toLowerCase(Locale.ROOT);
            counts.computeIfAbsent(key, ignored -> new HashMap<>()).merge(band, 1, Integer::sum);
        }
        return counts;
    }

    /** Conteggio per categoria e fascia letto direttamente dal file della banca. */
    private Map<String, Map<String, Integer>> bandCounts() throws Exception {
        Map<String, Map<String, Integer>> counts = new HashMap<>();
        for (JSONObject item : readQuestions()) {
            String category = item.optString("category", "");
            String band = item.optString("difficulty", "").toLowerCase(Locale.ROOT);
            counts.computeIfAbsent(category, key -> new HashMap<>())
                    .merge(band, 1, Integer::sum);
        }
        return counts;
    }

    /** Domande giocabili (QUIZ e Vero/Falso) presenti nel file della banca. */
    private List<JSONObject> readQuestions() throws Exception {
        try (InputStream stream = new ClassPathResource("questions/questions-it.json").getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            JSONArray questions = root.getJSONArray("questions");
            List<JSONObject> playable = new java.util.ArrayList<>();
            for (int index = 0; index < questions.length(); index++) {
                JSONObject item = questions.getJSONObject(index);
                String type = item.optString("type", "").toUpperCase(Locale.ROOT);
                if ("QUIZ".equals(type) || "TRUE_FALSE".equals(type)) {
                    playable.add(item);
                }
            }
            return playable;
        }
    }
}
