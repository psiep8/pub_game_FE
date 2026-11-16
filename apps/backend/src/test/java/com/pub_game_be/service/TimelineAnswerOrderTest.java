package com.pub_game_be.service;

import com.pub_game_be.reliability.QuestionUsageService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TimelineAnswerOrderTest {

    private PartyGameService service() {
        StateBlobService blobs = mock(StateBlobService.class);
        when(blobs.load(anyLong(), anyString())).thenReturn(Optional.empty());
        QuestionUsageService usage = mock(QuestionUsageService.class);
        when(usage.isUsed(anyLong(), anyString())).thenReturn(false);
        return new PartyGameService(blobs, usage);
    }

    private String roundId(JSONObject payload) {
        return payload.getString("roundId");
    }

    private List<Integer> cardIds(JSONObject payload) {
        List<Integer> ids = new ArrayList<>();
        JSONArray items = payload.getJSONArray("items");
        for (int index = 0; index < items.length(); index++) {
            ids.add(items.getJSONObject(index).getInt("id"));
        }
        return ids;
    }

    @Test
    void lOrdineInviatoTornaAlTelefono() {
        PartyGameService service = service();
        JSONObject payload = new JSONObject(service.startRound(1L, "TIMELINE", "STORIA", 1));
        String roundId = roundId(payload);
        List<Integer> cards = cardIds(payload);
        List<Integer> order = new ArrayList<>(cards);
        java.util.Collections.reverse(order);

        service.submitTimelineDecision(1L, roundId, "Anna", order);

        assertThat(service.timelineAnswerOrder(1L, roundId, "Anna")).contains(order);
    }

    @Test
    void chiNonHaAncoraRispostoNonHaOrdine() {
        PartyGameService service = service();
        String roundId = roundId(new JSONObject(service.startRound(2L, "TIMELINE", "STORIA", 1)));

        assertThat(service.timelineAnswerOrder(2L, roundId, "Bruno")).isEmpty();
    }

    @Test
    void unAltroRoundNonRestituisceLOrdineDiQuelloPrecedente() {
        PartyGameService service = service();
        JSONObject first = new JSONObject(service.startRound(3L, "TIMELINE", "STORIA", 1));
        String firstRound = roundId(first);
        service.submitTimelineDecision(3L, firstRound, "Anna", cardIds(first));

        String secondRound = roundId(new JSONObject(service.startRound(3L, "TIMELINE", "STORIA", 1)));

        assertThat(secondRound).isNotEqualTo(firstRound);
        assertThat(service.timelineAnswerOrder(3L, secondRound, "Anna")).isEmpty();
    }
}