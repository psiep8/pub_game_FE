package com.pub_game_be.config;

import com.pub_game_be.reliability.DeviceSessionService;
import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Il topic nudo {@code /topic/game/{id}} portava il {@code GameRound} completo
 * (payload e soluzioni): nessun dispositivo deve poterlo sottoscrivere. Servono
 * solo i topic con suffisso, e lo stato resta aperto anche allo schermo senza
 * regia.
 */
class WebSocketConfigTest {

    private static final String TOKEN = "tv-token";

    @Test
    void ilTopicNudoConIlRoundCompletoNonSiPuoSottoscrivere() {
        ChannelInterceptor interceptor = interceptorFor(false);

        assertThatThrownBy(() -> interceptor.preSend(subscribe("/topic/game/7"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void loSchermoSenzaRegiaPuoSottoscrivereLoStato() {
        ChannelInterceptor interceptor = interceptorFor(false);

        assertThatCode(() -> interceptor.preSend(subscribe("/topic/game/7/status"), null))
                .doesNotThrowAnyException();
    }

    @Test
    void laTvRegiaPuoSottoscrivereGliStessiTopicDelloSchermo() {
        ChannelInterceptor interceptor = interceptorFor(true);

        assertThatCode(() -> interceptor.preSend(subscribe("/topic/game/7/status"), null))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> interceptor.preSend(subscribe("/topic/game/7"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    private ChannelInterceptor interceptorFor(boolean regia) {
        DeviceSessionService sessions = mock(DeviceSessionService.class);
        DeviceSessionEntity tv = new DeviceSessionEntity();
        tv.setGameId(7L);
        tv.setRole("TV");
        tv.setSessionToken(TOKEN);
        tv.setSecurityVersion(1);
        tv.setRegia(regia);
        when(sessions.authenticate(TOKEN)).thenReturn(Optional.of(tv));
        return new WebSocketConfig(sessions, "http://127.0.0.1:4200").clientInboundAuthorization();
    }

    private Message<byte[]> subscribe(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("token", TOKEN);
        accessor.setSessionAttributes(attributes);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
