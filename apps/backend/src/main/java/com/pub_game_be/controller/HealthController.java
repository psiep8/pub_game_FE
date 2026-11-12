package com.pub_game_be.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Sonda di salute per Docker e per il controllo a freddo prima di una serata.
 *
 * <p>Risponde se il processo è in piedi e sa servire richieste. Volutamente non
 * interroga il database: un guasto del DB deve far fallire i round, non far
 * riavviare il container in loop mentre la serata è in corso.
 */
@RestController
public class HealthController {
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "time", Instant.now().toString());
    }
}
