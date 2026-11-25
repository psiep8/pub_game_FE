package com.pub_game_be.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Banca del Karaoke: cinque manche, punti crescenti e file audio serviti. */
class KaraokeServiceTest {

    private final KaraokeService service = new KaraokeService();

    @Test
    void cinqueMancheConPuntiCrescenti() {
        List<KaraokeService.Manche> manches = service.manches();

        assertThat(manches).hasSize(5);
        assertThat(manches).extracting(KaraokeService.Manche::punti)
                .containsExactly(100, 150, 200, 250, 300);
        assertThat(manches).extracting(KaraokeService.Manche::manche)
                .containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void ogniMancheHaTitoloArtistaEAudio() {
        for (KaraokeService.Manche manche : service.manches()) {
            assertThat(manche.titolo()).as("titolo manche %d", manche.manche()).isNotBlank();
            assertThat(manche.artista()).as("artista manche %d", manche.manche()).isNotBlank();
            assertThat(manche.file()).as("file manche %d", manche.manche())
                    .startsWith("/media/music/")
                    .endsWith(".m4a");
        }
    }

    @Test
    void seIlTestoLocaleCeLeRigheSonoOrdinate() {
        for (KaraokeService.Manche manche : service.manches()) {
            if (manche.righe().isEmpty()) continue;
            assertThat(manche.righe()).as("righe manche %d", manche.manche())
                    .allSatisfy(line -> assertThat(line.testo()).isNotBlank());
            for (int index = 1; index < manche.righe().size(); index++) {
                assertThat(manche.righe().get(index).inizioMs())
                        .as("tempi manche %d", manche.manche())
                        .isGreaterThanOrEqualTo(manche.righe().get(index - 1).inizioMs());
            }
            assertThat(manche.testiPronti()).isTrue();
        }
    }
}
