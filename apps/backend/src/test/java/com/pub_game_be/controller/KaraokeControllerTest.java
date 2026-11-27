package com.pub_game_be.controller;

import com.pub_game_be.service.KaraokeService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KaraokeControllerTest {

    private final KaraokeController controller = new KaraokeController(new KaraokeService());

    @Test
    void esponeCinqueMancheConIPuntiDellaPosizione() {
        Map<String, Object> body = controller.manches(12);
        List<?> manche = (List<?>) body.get("manche");

        assertThat(manche).hasSize(5);
        assertThat(((List<?>) body.get("manche")).stream()
                .map((voce) -> ((KaraokeService.Manche) voce).punti()))
                .containsExactly(100, 150, 200, 250, 300);
        assertThat(((List<?>) body.get("manche")).stream()
                .map((voce) -> ((KaraokeService.Manche) voce).titolo())
                .distinct()
                .count())
                .isEqualTo(5);
    }

    @Test
    void loStessoGameIdRiceveLeStesseManche() {
        List<String> prima = ((List<?>) controller.manches(77).get("manche")).stream()
                .map((voce) -> ((KaraokeService.Manche) voce).titolo()).toList();
        List<String> dopo = ((List<?>) controller.manches(77).get("manche")).stream()
                .map((voce) -> ((KaraokeService.Manche) voce).titolo()).toList();

        assertThat(dopo).containsExactlyElementsOf(prima);
    }

    @Test
    void ilPronosticoDiceQuanteCanzoniSonoCantabili() {
        Map<String, Object> body = controller.pronostico();
        List<?> canzoni = (List<?>) controller.banca().get("canzoni");
        int pronte = (int) ((List<?>) canzoni).stream()
                .filter((voce) -> ((KaraokeService.Brano) voce).testiPronti())
                .count();

        assertThat(body.get("canzoni")).isEqualTo(canzoni.size());
        assertThat(body.get("pronte")).isEqualTo(pronte);
        assertThat(body.get("minimo")).isEqualTo(KaraokeService.MANCHE_PER_PARTITA);
        assertThat(body.get("ok")).isEqualTo(pronte >= KaraokeService.MANCHE_PER_PARTITA);
    }

    @Test
    void laBancaEsponeAlmenoDieciCanzoni() {
        List<?> canzoni = (List<?>) controller.banca().get("canzoni");

        assertThat(canzoni).hasSizeGreaterThanOrEqualTo(10);
    }
}
