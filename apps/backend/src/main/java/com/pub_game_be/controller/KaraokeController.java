package com.pub_game_be.controller;

import com.pub_game_be.service.KaraokeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Le manche del bonus Karaoke.
 *
 * <p>{@code gameId} è il seed: la stessa partita riceve sempre le stesse
 * cinque canzoni, pescate senza ripetizioni dalla banca.</p>
 */
@RestController
public class KaraokeController {

    private final KaraokeService karaoke;

    public KaraokeController(KaraokeService karaoke) {
        this.karaoke = karaoke;
    }

    @GetMapping("/karaoke/manche")
    public Map<String, Object> manches(@RequestParam(name = "gameId", defaultValue = "0") long gameId) {
        return Map.of(
                "gameId", gameId,
                "manche", karaoke.selezione(gameId));
    }

    /** Banca intera: serve al banco di prova e ai controlli dei testi. */
    @GetMapping("/karaoke/banca")
    public Map<String, Object> banca() {
        return Map.of("canzoni", karaoke.banca());
    }
}
