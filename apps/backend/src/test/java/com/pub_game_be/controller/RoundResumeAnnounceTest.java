package com.pub_game_be.controller;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.IdempotencyService;
import com.pub_game_be.reliability.StateBlobService;
import com.pub_game_be.service.BasketService;
import com.pub_game_be.service.PartyGameService;
import com.pub_game_be.service.QuestionBankService;
import com.pub_game_be.service.QuestionHistoryService;
import com.pub_game_be.service.SpeedRushService;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * La ripresa del round vale anche per i telefoni: senza l'annuncio il cartello
 * "IN PAUSA" resta appeso finché una sincronizzazione non arriva, e può non
 * arrivare affatto.
 */
class RoundResumeAnnounceTest {

    private final GameStateService gameState = mock(GameStateService.class);
    private final SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
    private final SpeedRushService speedRush = mock(SpeedRushService.class);

    private PartyGamesController controller() {
        return new PartyGamesController(
                mock(PartyGameService.class), mock(QuestionBankService.class), messaging, gameState,
                mock(IdempotencyService.class), mock(StateBlobService.class), speedRush,
                mock(BasketService.class), mock(QuestionHistoryService.class));
    }

    @Test
    void laRipresaAnnonciaAiTelefoniCheLaPausaEFinita() {
        when(gameState.snapshot(12L)).thenReturn(new JSONObject()
                .put("paused", true).put("roundType", "AZZARDO"));
        when(gameState.resumeRound(12L)).thenReturn(4_500L);

        Map<String, Object> out = controller().resumeRound(12L);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(messaging).convertAndSend(eq("/topic/game/12/status"), body.capture());
        assertThat(new JSONObject(body.getValue()).getString("action")).isEqualTo("GAME_RESUMED");
        assertThat(out.get("shiftedMs")).isEqualTo(4_500L);
        verify(speedRush).resume(12L);
    }

    @Test
    void unaRipresaSenzaPausaNonDisturbaITelefoni() {
        when(gameState.snapshot(13L)).thenReturn(new JSONObject()
                .put("paused", false).put("roundType", "QUIZ"));
        when(gameState.resumeRound(13L)).thenReturn(0L);

        controller().resumeRound(13L);

        // Nessuna pausa da togliere: nessun annuncio inutile sul topic.
        verifyNoInteractions(messaging);
    }
}
