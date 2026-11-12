package com.pub_game_be.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.turbo.TurboFilter;
import ch.qos.logback.core.spi.FilterReply;
import org.slf4j.Marker;

/**
 * Abbassa a WARN la sola riga che Spring scrive quando un SEND STOMP non
 * arriva al canale (di solito un telefono appena staccatosi).
 *
 * <p>Quella riga finiva a ERROR a ogni serata, senza dire se era grave.
 * Logback non permette di cambiare il livello di un evento, quindi il filtro
 * la riscrive a WARN e scarta l'originale: resta una riga sola. Tutti gli
 * altri ERROR di {@code StompSubProtocolHandler} passano intatti.</p>
 */
public class StompSendFailureTurboFilter extends TurboFilter {

    /** Testo esatto con cui Spring annuncia l'invio fallito verso il canale. */
    static final String SPRING_MESSAGE = "Failed to send message to MessageChannel";

    @Override
    public FilterReply decide(Marker marker, Logger logger, Level level, String format, Object[] params,
            Throwable throwable) {
        if (!isSpringSendFailure(level, format)) {
            return FilterReply.NEUTRAL;
        }
        if (params == null || params.length == 0) {
            logger.warn(format);
        } else {
            logger.warn(format, params);
        }
        return FilterReply.DENY;
    }

    private static boolean isSpringSendFailure(Level level, String format) {
        return Level.ERROR.equals(level) && format != null && format.contains(SPRING_MESSAGE);
    }
}
