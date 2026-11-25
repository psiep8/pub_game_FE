package com.pub_game_be.controller;

import com.pub_game_be.service.KaraokeService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class KaraokeControllerTest {

    @Test
    void esponeLeCinqueManche() {
        var body = new KaraokeController(new KaraokeService()).manches();

        assertThat(body).containsKey("manche");
        assertThat((List<?>) body.get("manche")).hasSize(5);
    }
}
