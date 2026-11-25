package com.pub_game_be.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Banca del Karaoke: almeno dieci canzoni, gli artisti richiesti, cinque
 * manche senza ripetizioni e punti che dipendono dalla posizione.
 */
class KaraokeServiceTest {

    private final KaraokeService service = new KaraokeService();

    @Test
    void laBancaHaAlmenoDieciCanzoni() {
        assertThat(service.banca()).hasSizeGreaterThanOrEqualTo(10);
    }

    @Test
    void titoliEFileSonoUnici() {
        assertThat(service.banca()).extracting(KaraokeService.Brano::titolo)
                .doesNotHaveDuplicates();
        assertThat(service.banca()).extracting(KaraokeService.Brano::file)
                .doesNotHaveDuplicates();
    }

    @Test
    void ogniCanzoneHaTitoloArtistaEAudioServito() {
        for (KaraokeService.Brano brano : service.banca()) {
            assertThat(brano.titolo()).as("titolo").isNotBlank();
            assertThat(brano.artista()).as("artista di %s", brano.titolo()).isNotBlank();
            assertThat(brano.file()).as("file di %s", brano.titolo())
                    .startsWith("/media/music/")
                    .endsWith(".m4a");
            // Le clip stanno in static/media, cartella locale e ignorata da git:
            // qui si controlla che il percorso sia quello servito, non il file.
            ClassPathResource clip = new ClassPathResource("static" + brano.file());
            assertThat(clip.getPath()).as("clip di %s", brano.titolo())
                    .matches("static/media/music/[a-z0-9-]+\\.m4a");
        }
    }

    @Test
    void laBancaCopreGliArtistiRichiesti() {
        Set<String> artisti = service.banca().stream()
                .map((brano) -> brano.artista().toLowerCase())
                .collect(Collectors.toSet());

        assertThat(artisti).contains("vasco rossi", "ligabue", "cesare cremonini",
                "lucio dalla", "lucio battisti", "rino gaetano");
    }

    @Test
    void laBancaHaAlmenoTreCanzoniRecenti() {
        long recenti = service.banca().stream().filter((brano) -> brano.anno() >= 2018).count();

        assertThat(recenti).isGreaterThanOrEqualTo(3);
    }

    @Test
    void laPartitaPescaCinqueMancheSenzaRipetizioni() {
        List<KaraokeService.Manche> manches = service.selezione(42);

        assertThat(manches).hasSize(KaraokeService.MANCHE_PER_PARTITA);
        assertThat(manches).extracting(KaraokeService.Manche::titolo).doesNotHaveDuplicates();
        assertThat(manches).extracting(KaraokeService.Manche::file).doesNotHaveDuplicates();
        assertThat(manches).extracting(KaraokeService.Manche::manche)
                .containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void iPuntiDipendonoDallaPosizioneDellaManche() {
        for (long seed : new long[] { 0, 1, 7, 2026 }) {
            assertThat(service.selezione(seed)).extracting(KaraokeService.Manche::punti)
                    .as("seed %d", seed)
                    .containsExactly(100, 150, 200, 250, 300);
        }
    }

    @Test
    void laStessaPartitaRiceveLaStessaSelezione() {
        List<String> prima = service.selezione(313).stream()
                .map(KaraokeService.Manche::titolo).toList();
        List<String> dopo = service.selezione(313).stream()
                .map(KaraokeService.Manche::titolo).toList();

        assertThat(dopo).containsExactlyElementsOf(prima);
    }

    @Test
    void laSelezioneCambiaFraPartiteDiverse() {
        List<String> prima = service.selezione(1).stream()
                .map(KaraokeService.Manche::titolo).toList();
        List<String> dopo = service.selezione(999).stream()
                .map(KaraokeService.Manche::titolo).toList();

        assertThat(dopo).isNotEqualTo(prima);
    }

    @Test
    void ogniMancheRecenteeCopertaAlmenoUnaVolta() {
        // Su un giro di seed le canzoni cantabili devono poter uscire tutte: se la
        // selezione restasse sempre sulle stesse non sarebbe un pescaggio.
        Set<String> viste = new java.util.HashSet<>();
        for (long seed = 0; seed < 200; seed++) {
            service.selezione(seed).forEach((manche) -> viste.add(manche.titolo()));
        }

        assertThat(viste).containsAll(service.banca().stream()
                .filter(KaraokeService.Brano::testiPronti)
                .map(KaraokeService.Brano::titolo)
                .toList());
        assertThat(viste).hasSizeLessThanOrEqualTo(service.banca().size());
    }

    @Test
    void seIlTestoLocaleCeLeRigheSonoOrdinateAltrimentiIlFallbackEDichiarato() {
        for (KaraokeService.Brano brano : service.banca()) {
            if (brano.righe().isEmpty()) {
                assertThat(brano.testiPronti())
                        .as("testi assenti dichiarati per %s", brano.titolo())
                        .isFalse();
                continue;
            }
            assertThat(brano.testiPronti()).as("testi pronti per %s", brano.titolo()).isTrue();
            assertThat(brano.righe()).allSatisfy((line) -> assertThat(line.testo()).isNotBlank());
            assertThat(brano.risposte()).as("frasi da cantare per %s", brano.titolo()).isNotEmpty();
            for (int index = 1; index < brano.righe().size(); index++) {
                assertThat(brano.righe().get(index).inizioMs())
                        .as("tempi di %s", brano.titolo())
                        .isGreaterThanOrEqualTo(brano.righe().get(index - 1).inizioMs());
            }
            assertThat(brano.righe()).allSatisfy((line) -> assertThat(line.inizioMs())
                    .as("riga dentro la clip di %s", brano.titolo())
                    .isBetween(0, 30_000));
        }
    }
}
