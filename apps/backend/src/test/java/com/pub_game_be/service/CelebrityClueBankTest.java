package com.pub_game_be.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Banca degli indizi Celebrità: quattro indizi per persona, due ampi e due
 * specifici, ognuno con la fonte, e nessuno che sveli il nome.
 *
 * <p>Il file è versionato (al contrario di `media-it.json`), quindi questo test
 * gira sempre, anche in CI. La revisione umana dei contenuti resta a campione su
 * `docs/DOMANDE-DA-REVISIONARE.md`: qui si controlla la forma e la provenienza,
 * non la verità storica di ogni frase.</p>
 */
class CelebrityClueBankTest {

    private static final List<String> LIVELLI = List.of("ampio", "ampio", "specifico", "specifico");
    private static final Set<String> SOTTO_AMBITI = Set.of(
            "storia", "arte", "scienza", "musica", "sport", "cinema", "tv", "spettacolo");

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void ogniPersonaHaQuattroIndiziOrdinatiConFonte() throws Exception {
        JsonNode root = bank();
        JsonNode persone = root.path("persone");
        assertThat(persone.isArray()).as("elenco delle persone").isTrue();
        // La banca si completa a mano: qui basta che ci siano le persone già
        // risolte con fonte certa. Quelle non risolte stanno nell'elenco
        // `nonRisolte` e non si usano, come chiede la specifica.
        assertThat(persone.size()).as("persone con indizi").isGreaterThanOrEqualTo(15);

        Set<String> testi = new HashSet<>();
        List<String> problems = new ArrayList<>();

        for (JsonNode persona : persone) {
            String nome = persona.path("nome").asText("").trim();
            assertThat(nome).as("nome della persona").isNotBlank();

            int ambito = persona.path("ambito").asInt(0);
            if (ambito < 1 || ambito > 3) {
                problems.add(nome + ": ambito " + ambito);
            }
            if (!SOTTO_AMBITI.contains(persona.path("sottoAmbito").asText(""))) {
                problems.add(nome + ": sotto-ambito " + persona.path("sottoAmbito").asText(""));
            }
            if (!persona.path("pagina").asText("").startsWith("https://it.wikipedia.org/")) {
                problems.add(nome + ": pagina Wikipedia assente");
            }

            JsonNode indizi = persona.path("indizi");
            if (!indizi.isArray() || indizi.size() != 4) {
                problems.add(nome + ": indizi " + indizi.size() + " invece di 4");
                continue;
            }

            for (int index = 0; index < indizi.size(); index++) {
                JsonNode indizio = indizi.get(index);
                String testo = indizio.path("testo").asText("").trim();
                String livello = indizio.path("livello").asText("");
                String fonte = indizio.path("fonte").asText("");

                if (!LIVELLI.get(index).equals(livello)) {
                    problems.add(nome + ": indizio " + (index + 1) + " è " + livello
                            + ", atteso " + LIVELLI.get(index));
                }
                if (testo.length() < 12 || testo.length() > 220) {
                    problems.add(nome + ": indizio " + (index + 1) + " lungo " + testo.length());
                }
                if (!fonte.startsWith("https://")) {
                    problems.add(nome + ": indizio " + (index + 1) + " senza fonte");
                }
                if (mentionsName(testo, nome)) {
                    problems.add(nome + ": indizio " + (index + 1) + " svela il nome");
                }
                if (!indizio.path("verificato").asBoolean(false)) {
                    problems.add(nome + ": indizio " + (index + 1) + " non verificato");
                }
                String key = fold(testo);
                if (!testi.add(key)) {
                    problems.add(nome + ": indizio ripetuto in un'altra persona");
                }
            }
        }

        assertThat(problems).as("banca indizi interrogabile").isEmpty();
    }

    @Test
    void leNonRisolteHannoSempreIlMotivo() throws Exception {
        JsonNode root = bank();
        for (JsonNode persona : root.path("nonRisolte")) {
            assertThat(persona.path("nome").asText("")).as("nome nella lista non risolte").isNotBlank();
            assertThat(persona.path("motivo").asText("")).as("motivo per %s", persona.path("nome").asText(""))
                    .isNotBlank();
        }
    }

    private JsonNode bank() throws Exception {
        ClassPathResource resource = new ClassPathResource("questions/celebrita-indizi.json");
        assertThat(resource.exists()).as("banca indizi versionata presente").isTrue();
        try (InputStream stream = resource.getInputStream()) {
            return mapper.readTree(stream);
        }
    }

    /** Stesse regole di CelebrityImageService: nome, cognome e nomi corti svelano. */
    private static boolean mentionsName(String text, String name) {
        String haystack = fold(text);
        for (String token : fold(name).split("[^\\p{L}0-9]+")) {
            if (token.length() < 3 || PARTICLES.contains(token)) continue;
            if (Pattern.compile("(?<!\\p{L})" + Pattern.quote(token) + "(?!\\p{L})")
                    .matcher(haystack).find()) {
                return true;
            }
        }
        return false;
    }

    private static final Set<String> PARTICLES = Set.of(
            "de", "del", "della", "di", "da", "dos", "du", "la", "le",
            "van", "von", "jr", "sr", "ii", "iii", "iv");

    private static String fold(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }
}
