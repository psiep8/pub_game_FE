package com.pub_game_be.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Rotte del frontend servite dallo stesso jar.
 *
 * <p>Nell'immagine fullstack Angular viene copiato in {@code static/}: la
 * pagina iniziale e gli asset sono file statici, ma un refresh su {@code /tv}
 * o {@code /play} arriverebbe al backend come rotta REST. Qui viene inoltrato
 * a {@code index.html}, che poi lascia gestire il percorso al router Angular.</p>
 *
 * <p>Le API ({@code /games}, {@code /categories}, {@code /questions},
 * {@code /media}) e il WebSocket ({@code /ws-pubgame}) hanno i loro mapping e
 * non passano da questo controller.</p>
 */
@Controller
public class SpaForwardController {

    @GetMapping({"/tv", "/play", "/admin", "/basket", "/bonus-preview", "/bonus-preview/{type}"})
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
