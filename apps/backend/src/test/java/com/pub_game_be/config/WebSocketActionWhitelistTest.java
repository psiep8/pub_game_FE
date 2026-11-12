package com.pub_game_be.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Confronta le azioni che i client pubblicano sullo stato con le whitelist di
 * {@link WebSocketConfig}: un'azione legittima fuori elenco fa scattare
 * {@code AccessDeniedException}, il client riceve un frame ERROR e Spring chiude
 * la sessione (1002) a metà partita.
 *
 * <p>La fonte è l'enum {@code WsAction} del frontend, diviso per sezioni: ogni
 * voce è l'azione che quella sezione pubblica davvero.
 */
class WebSocketActionWhitelistTest {
    /** Pubblicate su /app/game/{id}/answer, dove l'interceptor non filtra per azione. */
    private static final Set<String> SOLO_ANSWER = Set.of(
            "ANSWER", "ARENA_ANSWER", "TIME_BUZZER_ANSWER", "SPEED_RUSH_PROGRESS");
    /** Dichiarate nell'enum ma nessun client le invia ancora. */
    private static final Set<String> NON_INVIATE = Set.of(
            "BUTTON_TEST_STEP", "BUTTON_TEST_START", "BUTTON_TEST_RESET", "BUTTON_TEST_SKIP", "BUTTON_TEST_FINISH");

    private static final Path ENUM_FILE = Path.of(
            "..", "frontend", "src", "app", "shared", "enums", "ws-action.ts");
    private static final Pattern VOCE = Pattern.compile("^\\s*([A-Z_]+):\\s*'([A-Z_]+)',?\\s*$");

    @Test
    void ogniAzionePubblicataDaiClientHaUnaWhitelist() throws IOException {
        Map<String, Set<String>> sezioni = leggiEnum();
        assertThat(sezioni).as("sezioni dell'enum WsAction").isNotEmpty();

        Map<String, Set<String>> ammesse = new LinkedHashMap<>();
        ammesse.put("Telefono -> server", unione(WebSocketConfig.REMOTE_ACTIONS, SOLO_ANSWER, WebSocketConfig.TV_ACTIONS));
        ammesse.put("Prova dei pulsanti", unione(WebSocketConfig.TV_ACTIONS, WebSocketConfig.REMOTE_ACTIONS, NON_INVIATE));
        ammesse.put("Bonus giocati dai telefoni", WebSocketConfig.REMOTE_ACTIONS);
        ammesse.put("TV -> telefoni", WebSocketConfig.TV_ACTIONS);
        ammesse.put("Stato dei singoli giochi", WebSocketConfig.TV_ACTIONS);
        ammesse.put("Comandi del pannello admin", unione(WebSocketConfig.ADMIN_ACTIONS, WebSocketConfig.TV_ACTIONS));

        List<String> violazioni = new ArrayList<>();
        for (Map.Entry<String, Set<String>> sezione : sezioni.entrySet()) {
            Set<String> autorizzate = ammesse.get(sezione.getKey());
            assertThat(autorizzate)
                    .as("sezione '%s' assente dal test: aggiornare ammesse", sezione.getKey())
                    .isNotNull();
            for (String azione : sezione.getValue()) {
                if (!autorizzate.contains(azione)) {
                    violazioni.add(sezione.getKey() + ": " + azione);
                }
            }
        }

        assertThat(violazioni)
                .as("azioni legittime che oggi chiuderebbero la sessione con 1002")
                .isEmpty();
    }

    @Test
    void laTvPuoPubblicareQuelloCheMandaDavvero() {
        assertThat(WebSocketConfig.TV_ACTIONS).contains(
                "BUTTON_TEST_PING", "BONUS_RESULT", "BIGLIE_STATE", "CASINO_STATE", "CAVALLO_STATE",
                "MUSIC_PHASE", "ADMIN_STATE", "TIME_BUZZER_START");
        assertThat(WebSocketConfig.ADMIN_ACTIONS).contains("ADMIN_SHOW_INTRO", "CHRISTMAS_TOGGLE");
        assertThat(WebSocketConfig.REMOTE_ACTIONS).contains("BUTTON_TEST_PING", "PLAYER_AVATAR");
        assertThat(WebSocketConfig.TV_ACTIONS).doesNotContain("BASKET_STATE");
    }

    /** Legge `WsAction` tenendo la sezione del commento che precede ogni voce. */
    private static Map<String, Set<String>> leggiEnum() throws IOException {
        Map<String, Set<String>> sezioni = new LinkedHashMap<>();
        String sezione = "senza sezione";
        for (String riga : Files.readAllLines(ENUM_FILE, StandardCharsets.UTF_8)) {
            String testo = riga.trim();
            if (testo.startsWith("// ")) {
                sezione = testo.substring(3).trim();
                continue;
            }
            Matcher voce = VOCE.matcher(riga);
            if (!voce.matches()) continue;
            assertThat(voce.group(1)).as("chiave e valore devono coincidere").isEqualTo(voce.group(2));
            sezioni.computeIfAbsent(sezione, chiave -> new LinkedHashSet<>()).add(voce.group(2));
        }
        return sezioni;
    }

    @SafeVarargs
    private static Set<String> unione(Set<String>... insiemi) {
        Set<String> totale = new LinkedHashSet<>();
        for (Set<String> insieme : insiemi) totale.addAll(insieme);
        return totale;
    }
}
