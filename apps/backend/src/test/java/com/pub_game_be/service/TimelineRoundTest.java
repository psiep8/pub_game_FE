package com.pub_game_be.service;

import com.pub_game_be.reliability.QuestionUsageService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Timeline: sempre otto carte per round e tabella punti della sezione 2.2. */
class TimelineRoundTest {

    private PartyGameService service() {
        StateBlobService blobs = mock(StateBlobService.class);
        when(blobs.load(anyLong(), anyString())).thenReturn(Optional.empty());
        QuestionUsageService usage = mock(QuestionUsageService.class);
        when(usage.isUsed(anyLong(), anyString())).thenReturn(false);
        return new PartyGameService(blobs, usage);
    }

    /** Usage reale in memoria: `claim` aggiorna le chiavi che `isUsed` vede. */
    private PartyGameService serviceWithUsage() {
        StateBlobService blobs = mock(StateBlobService.class);
        when(blobs.load(anyLong(), anyString())).thenReturn(Optional.empty());
        QuestionUsageService usage = mock(QuestionUsageService.class);
        Set<String> used = new HashSet<>();
        when(usage.isUsed(anyLong(), anyString())).thenAnswer(invocation ->
                used.contains(invocation.getArgument(0) + "|" + invocation.getArgument(1)));
        when(usage.claim(anyLong(), anyString(), nullable(String.class), nullable(String.class),
                nullable(Integer.class))).thenAnswer(invocation ->
                used.add(invocation.getArgument(0) + "|" + invocation.getArgument(1)));
        return new PartyGameService(blobs, usage);
    }

    @Test
    void ogniRoundHaOttoCarteAncheSenzaFinale() {
        PartyGameService service = service();
        for (int round = 1; round <= 3; round++) {
            JSONObject payload = new JSONObject(service.startRound(10L, "TIMELINE", "Storia", round));
            JSONArray items = payload.getJSONArray("items");
            assertThat(items.length()).as("round %d", round).isEqualTo(8);
            assertThat(payload.getInt("count")).isEqualTo(8);
        }
    }

    @Test
    void treRoundSullaStessaCategoriaNonRipetonoCarte() {
        PartyGameService service = serviceWithUsage();
        Set<String> labels = new HashSet<>();

        for (int round = 1; round <= 3; round++) {
            JSONObject payload = new JSONObject(service.startRound(40L, "TIMELINE", "Storia", round));
            assertThat(payload.has("poolWarning")).as("round %d senza ripetizioni", round).isFalse();
            JSONArray items = payload.getJSONArray("items");
            assertThat(items.length()).as("round %d", round).isEqualTo(8);
            for (int index = 0; index < items.length(); index++) {
                assertThat(labels.add(items.getJSONObject(index).getString("label")))
                        .as("carta ripetuta al round %d", round)
                        .isTrue();
            }
        }

        assertThat(labels).hasSize(24);
    }

    @Test
    void leCarteDiUnRoundDistantAlmenoTreAnni() {
        PartyGameService service = service();
        for (int run = 0; run < 30; run++) {
            service.startRound(20L + run, "TIMELINE", null, 1);
            JSONObject reveal = service.timelineReveal(20L + run);
            JSONArray ordered = reveal.getJSONArray("items");
            assertThat(ordered.length()).isEqualTo(8);
            int previous = Integer.MIN_VALUE;
            for (int index = 0; index < ordered.length(); index++) {
                int year = ordered.getJSONObject(index).getInt("year");
                assertThat(year).as("ordine crescente").isGreaterThan(previous);
                previous = year;
            }
            for (int first = 0; first < ordered.length(); first++) {
                for (int second = first + 1; second < ordered.length(); second++) {
                    int gap = Math.abs(ordered.getJSONObject(first).getInt("year")
                            - ordered.getJSONObject(second).getInt("year"));
                    assertThat(gap).as("distanza fra due carte").isGreaterThanOrEqualTo(3);
                }
            }
        }
    }

    @Test
    void laTabellaDeiPostiGiustiVaDaQuattrocentoAMenoDuecento() {
        assertThat(PartyGameService.timelineScore(8, 8)).isEqualTo(400);
        assertThat(PartyGameService.timelineScore(7, 8)).isEqualTo(300);
        assertThat(PartyGameService.timelineScore(6, 8)).isEqualTo(200);
        assertThat(PartyGameService.timelineScore(5, 8)).isEqualTo(100);
        assertThat(PartyGameService.timelineScore(4, 8)).isZero();
        assertThat(PartyGameService.timelineScore(3, 8)).isEqualTo(-50);
        assertThat(PartyGameService.timelineScore(2, 8)).isEqualTo(-100);
        assertThat(PartyGameService.timelineScore(1, 8)).isEqualTo(-200);
        assertThat(PartyGameService.timelineScore(0, 8)).isEqualTo(-200);
    }

    @Test
    void unOrdinePerfettoPagaQuattrocento() {
        PartyGameService service = service();
        JSONObject payload = new JSONObject(service.startRound(30L, "TIMELINE", null, 1));
        String roundId = payload.getString("roundId");
        JSONObject reveal = service.timelineReveal(30L);
        JSONArray ordered = reveal.getJSONArray("items");

        // Gli id delle carte seguono l'ordine vero: si ricostruisce la mappa
        // id -> posizione dal payload e si invia quello.
        JSONArray items = payload.getJSONArray("items");
        java.util.List<Integer> ids = new java.util.ArrayList<>();
        java.util.Map<Integer, String> labels = new java.util.HashMap<>();
        for (int index = 0; index < items.length(); index++) {
            labels.put(items.getJSONObject(index).getInt("id"), items.getJSONObject(index).getString("label"));
            ids.add(items.getJSONObject(index).getInt("id"));
        }
        java.util.List<Integer> perfect = new java.util.ArrayList<>(ids);
        perfect.sort(java.util.Comparator.comparingInt(id -> {
            for (int index = 0; index < ordered.length(); index++) {
                if (ordered.getJSONObject(index).getString("label").equals(labels.get(id))) {
                    return index;
                }
            }
            return 0;
        }));

        PartyGameService.TimelineDecision decision = service
                .submitTimelineDecision(30L, roundId, "Anna", perfect)
                .orElseThrow();

        assertThat(decision.submission().correctPairs()).isEqualTo(8);
        assertThat(decision.submission().score()).isEqualTo(400);
    }
}
