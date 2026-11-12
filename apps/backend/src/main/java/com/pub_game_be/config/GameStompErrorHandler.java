package com.pub_game_be.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.converter.MessageConversionException;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

/**
 * Errori STOMP verso il client con un codice stabile, loggati a WARN.
 *
 * <p>Spring logga {@code "Failed to send message to MessageChannel"} a ERROR per
 * ogni SEND rifiutato dall'interceptor (token scaduto, azione non consentita):
 * senza codice né motivo vero, a fine serata non si distingue un telefono che
 * sbaglia da un guasto del server. Qui l'ERROR frame porta {@code code} e il
 * messaggio della causa radice, e nel log resta una sola riga WARN.</p>
 */
public class GameStompErrorHandler extends StompSubProtocolErrorHandler {

    /** Il client ha mandato qualcosa che non può fare: si corregge, non è un guasto. */
    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    /** Frame illeggibile o payload non convertibile. */
    public static final String FRAME_NOT_VALID = "FRAME_NOT_VALID";
    /** Tutto il resto: qui vale la pena guardare il log. */
    public static final String MESSAGE_NOT_DELIVERED = "MESSAGE_NOT_DELIVERED";

    private static final Logger log = LoggerFactory.getLogger(GameStompErrorHandler.class);

    @Override
    protected Message<byte[]> handleInternal(StompHeaderAccessor errorAccessor, byte[] errorPayload,
            Throwable cause, StompHeaderAccessor clientAccessor) {
        if (cause != null) {
            String code = code(cause);
            String sessionId = clientAccessor == null ? null : clientAccessor.getSessionId();
            String reason = rootMessage(cause);
            errorAccessor.setNativeHeader("code", code);
            errorAccessor.setMessage(reason);
            if (ACCESS_DENIED.equals(code)) {
                // Un client che sbaglia non merita uno stack trace.
                log.warn("STOMP {} sessione {}: {}", code, sessionId, reason);
            } else {
                log.warn("STOMP {} sessione {}: {}", code, sessionId, cause.toString(), cause);
            }
        }
        return super.handleInternal(errorAccessor, errorPayload, cause, clientAccessor);
    }

    private static String code(Throwable cause) {
        if (hasCause(cause, AccessDeniedException.class)) {
            return ACCESS_DENIED;
        }
        if (hasCause(cause, MessageConversionException.class) || hasCause(cause, IllegalArgumentException.class)) {
            return FRAME_NOT_VALID;
        }
        return MESSAGE_NOT_DELIVERED;
    }

    /** La causa più profonda con un messaggio: è quella che spiega l'errore. */
    private static String rootMessage(Throwable cause) {
        Throwable current = cause;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }

    private static boolean hasCause(Throwable cause, Class<? extends Throwable> type) {
        for (Throwable current = cause; current != null; current = current.getCause()) {
            if (type.isInstance(current)) {
                return true;
            }
            if (current.getCause() == current) {
                break;
            }
        }
        return false;
    }
}
