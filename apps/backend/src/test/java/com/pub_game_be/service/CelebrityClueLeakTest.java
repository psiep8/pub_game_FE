package com.pub_game_be.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Un indizio che cita il nome o il cognome della celebrità regala la risposta.
 * Il taglio deve scartare quelle frasi e tenere solo quelle innocue.
 */
class CelebrityClueLeakTest {

    private final CelebrityImageService service = new CelebrityImageService(new RestTemplate());

    @Test
    void scartaLeFrasiCheCitanoNomeOCognome() {
        List<String> clues = service.cluesFromLocal(
                "Michael Jackson",
                "cantante statunitense",
                "Michael Jackson è stato un cantante. Ha rivoluzionato il pop. "
                        + "Jackson ha vinto molti premi. Il suo album Thriller è il più venduto.");

        assertThat(clues)
                .as("nome e cognome non devono comparire in nessun indizio")
                .noneMatch(clue -> clue.toLowerCase().contains("michael"))
                .noneMatch(clue -> clue.toLowerCase().contains("jackson"));
        assertThat(clues)
                .as("le frasi innocue restano")
                .anyMatch(clue -> clue.contains("rivoluzionato"))
                .anyMatch(clue -> clue.contains("Thriller"));
    }

    @Test
    void riconosceIlCognomeDaSoloAncheConAccentiMaiuscole() {
        List<String> clues = service.cluesFromLocal(
                "Dua Lipa",
                "cantante britannica",
                "LIPA ha vinto un Grammy. Ha pubblicato diversi album. È nata a Londra.");

        assertThat(clues).noneMatch(clue -> clue.toLowerCase().contains("lipa"));
        assertThat(clues).anyMatch(clue -> clue.contains("album"));
    }

    @Test
    void riconosceAncheUnNomeCorto() {
        List<String> clues = service.cluesFromLocal(
                "Tom Hanks",
                "attore statunitense",
                "Tom ha recitato in Forrest Gump. Ha vinto due Oscar. È noto per molti film.");

        assertThat(clues)
                .as("un nome di tre lettere non deve passare")
                .noneMatch(clue -> clue.toLowerCase().contains("tom"));
        assertThat(clues).anyMatch(clue -> clue.contains("Oscar"));
    }

    /**
     * La banca locale contiene 150 persone: un test su due nomi non basta.
     * Ogni indizio generato dalla banca non deve contenere nome o cognome.
     * La banca vera non è versionata: quando manca (in CI) si controlla la
     * mini-banca di prova in `src/test/resources`, così il test gira sempre.
     */
    @Test
    void tuttaLaBancaCelebritaNonEsponeIlNome() throws Exception {
        ClassPathResource bank = new ClassPathResource("questions/media-it.json");
        if (bank.exists()) {
            assertThat(checkBank(bank)).as("persone controllate").isGreaterThanOrEqualTo(100);
            return;
        }

        // La mini-banca sta in `src/test/resources`: se manca è un errore, non
        // un motivo per saltare il controllo come per la banca vera.
        ClassPathResource fallback = new ClassPathResource("questions/media-test.json");
        assertThat(fallback.exists()).as("mini-banca di prova presente").isTrue();
        assertThat(checkBank(fallback)).as("persone controllate nella mini-banca").isGreaterThanOrEqualTo(3);
    }

    /** Controlla una banca persone e ritorna quante ne ha esaminate. */
    private int checkBank(ClassPathResource bank) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        int checked = 0;

        try (InputStream stream = bank.getInputStream()) {
            JsonNode people = mapper.readTree(stream).path("people");
            for (JsonNode person : people) {
                String name = person.path("name").asText("");
                List<String> clues = service.cluesFromLocal(
                        name,
                        person.path("description").asText(""),
                        person.path("extract").asText(""));

                assertThat(clues).as("indizi per %s", name).isNotEmpty();
                for (String clue : clues) {
                    assertThat(mentionsName(clue, name))
                            .as("«%s» svela %s", clue, name)
                            .isFalse();
                }
                checked++;
            }
        }

        return checked;
    }

    private static final Set<String> PARTICLES = Set.of(
            "de", "del", "della", "di", "da", "dos", "du", "la", "le",
            "van", "von", "jr", "sr", "ii", "iii", "iv");

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

    private static String fold(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase();
    }

    @Test
    void nonScartaFrasiNormali() {
        List<String> clues = service.cluesFromLocal(
                "Cher",
                "cantante e attrice statunitense",
                "Ha vinto un Oscar. Ha pubblicato molti album. Ha debuttato negli anni Sessanta.");

        assertThat(clues).isNotEmpty();
        assertThat(clues).allMatch(clue -> !clue.toLowerCase().contains("cher"));
    }
}
