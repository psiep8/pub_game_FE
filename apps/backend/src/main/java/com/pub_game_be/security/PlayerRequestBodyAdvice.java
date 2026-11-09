package com.pub_game_be.security;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashMap;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@ControllerAdvice
public class PlayerRequestBodyAdvice extends RequestBodyAdviceAdapter {
    @Override
    public boolean supports(MethodParameter parameter, Type type, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object afterBodyRead(Object body, HttpInputMessage input, MethodParameter parameter, Type type,
            Class<? extends HttpMessageConverter<?>> converterType) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        Object principal = request.getAttribute("pubgame.session");
        if (!(principal instanceof DeviceSessionEntity session) || !(body instanceof Map<?, ?> map)) return body;
        String path = request.getServletPath();
        if (path.endsWith("/session/heartbeat") || path.endsWith("/session/disconnect")) {
            if (!session.getSessionToken().equals(map.get("sessionToken"))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Token diverso dalla sessione");
            }
        }
        if ("REMOTE".equals(session.getRole())) {
            String field = path.endsWith("/arena-answer") ? "playerId" : "playerName";
            if (Set.of("/arena-answer", "/timeline-answer", "/time-buzzer/stop", "/bomba/pick")
                    .stream().anyMatch(path::endsWith) && !session.getPlayerName().equals(map.get(field))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Squadra diversa dalla sessione");
            }
        }
        // Le chiavi di idempotenza dei telefoni appartengono alla sessione,
        // non devono poter richiamare o anticipare le ricevute di altre squadre.
        if ("REMOTE".equals(session.getRole()) && map.get("idempotencyKey") instanceof String key && !key.isBlank()) {
            try {
                byte[] digest = MessageDigest.getInstance("SHA-256")
                        .digest((session.getId() + ":" + key).getBytes(StandardCharsets.UTF_8));
                Map<Object, Object> scoped = new LinkedHashMap<>(map);
                scoped.put("idempotencyKey", HexFormat.of().formatHex(digest));
                return scoped;
            } catch (NoSuchAlgorithmException error) {
                throw new IllegalStateException("SHA-256 non disponibile", error);
            }
        }
        return body;
    }
}
