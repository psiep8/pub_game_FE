package com.pub_game_be.controller;

import com.pub_game_be.service.KaraokeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Le cinque manche del bonus Karaoke, con testi locali se presenti. */
@RestController
public class KaraokeController {

    private final KaraokeService karaoke;

    public KaraokeController(KaraokeService karaoke) {
        this.karaoke = karaoke;
    }

    @GetMapping("/karaoke/manche")
    public Map<String, Object> manches() {
        return Map.of("manche", karaoke.manches());
    }
}
