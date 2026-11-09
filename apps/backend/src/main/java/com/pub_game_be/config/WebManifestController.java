package com.pub_game_be.config;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.Duration;

/**
 * Il manifest PWA deve uscire con un Content-Type riconosciuto dai browser.
 * Il resource handler di default lo serviva come octet-stream, che Chrome
 * rifiuta: senza questo handler la scorciatoia installabile non funziona,
 * anche con HTTPS.
 */
@Controller
public class WebManifestController {

    private static final MediaType WEB_MANIFEST = MediaType.parseMediaType("application/manifest+json");

    @GetMapping(value = "/manifest.webmanifest", produces = "application/manifest+json")
    public ResponseEntity<Resource> manifest() {
        Resource manifest = new ClassPathResource("static/manifest.webmanifest");
        if (!manifest.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(WEB_MANIFEST)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(manifest);
    }
}
