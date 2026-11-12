package com.pub_game_be.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.core.spi.FilterReply;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class StompSendFailureTurboFilterTest {

    private final StompSendFailureTurboFilter filter = new StompSendFailureTurboFilter();

    @Test
    void invioFallitoScendeAWarn() {
        var logger = mock(Logger.class);
        String message = "Failed to send message to MessageChannel in session s-1:Sessione non valida";

        assertThat(filter.decide(null, logger, Level.ERROR, message, null, null)).isEqualTo(FilterReply.DENY);
        verify(logger).warn(message);
    }

    @Test
    void gliAltriErroriRestanoErrori() {
        var logger = mock(Logger.class);
        String message = "Expected byte[] payload. Ignoring ...";

        assertThat(filter.decide(null, logger, Level.ERROR, message, null, null)).isEqualTo(FilterReply.NEUTRAL);
        verify(logger, never()).warn(anyString());
    }

    @Test
    void ilWarnRiscrittoNonRientraNelFiltro() {
        var logger = mock(Logger.class);

        assertThat(filter.decide(null, logger, Level.WARN, StompSendFailureTurboFilter.SPRING_MESSAGE, null, null))
                .isEqualTo(FilterReply.NEUTRAL);
        verify(logger, never()).warn(anyString());
    }
}
