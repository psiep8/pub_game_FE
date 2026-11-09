package com.pub_game_be.config;

import com.pub_game_be.reliability.DeviceSessionService;
import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private static final Pattern DESTINATION = Pattern.compile("^/(app|topic)/game/(\\d+)/(status|responses|answer|admin)$");
    private static final Set<String> REMOTE_ACTIONS = Set.of("JOIN_GAME", "SCREAM", "PLAYER_AVATAR",
            "BIGLIE_ACTION", "ULTIMA_SPIAGGIA_ACTION", "AZZARDO_ACTION", "CASINO_ACTION",
            "BLACKJACK_ACTION", "CAVALLO_ACTION", "AIR_HOCKEY_BATTLE_ANSWER");
    private static final Set<String> ADMIN_ACTIONS = Set.of("ADMIN_REQUEST_STATE", "ADMIN_CONFIRM_CORRECT",
            "ADMIN_CONFIRM_WRONG", "ADMIN_NEXT_ROUND", "ADMIN_START_ROUND", "ADMIN_NEXT_MANCHE",
            "ADMIN_SHOW_LEADERBOARD", "ADMIN_TOGGLE_PAUSE", "ADMIN_SHOW_DEMO", "ADMIN_HIDE_DEMO",
            "ADMIN_START_BONUS", "ADMIN_STOP_BONUS", "CHRISTMAS_TOGGLE");
    private static final Set<String> TV_ACTIONS = Set.of("SHOW_QUESTION", "START_VOTING", "PLAYER_PRENOTATO",
            "ROUND_ENDED", "BLOCKED_ERROR", "BONUS_ENDED", "ARENA_ELIMINATED", "ARENA_ENDED",
            "GAME_PAUSED", "GAME_RESUMED", "QUIZ_STATE", "TIME_BUZZER_STATE", "TIME_BUZZER_START",
            "ULTIMA_SPIAGGIA_STATE", "AZZARDO_STATE", "AZZARDO_MESSAGE", "BLACKJACK_STATE",
            "AIR_HOCKEY_BATTLE_STATE", "CASINO_STATE", "CAVALLO_STATE", "BIGLIE_STATE", "ADMIN_STATE",
            "MUSIC_PHASE", "CHRISTMAS_TOGGLE");
    private final DeviceSessionService sessions;
    private final String[] origins;

    public WebSocketConfig(DeviceSessionService sessions,
            @Value("${game.security.allowed-origins:http://localhost:4200,http://127.0.0.1:4200}") String allowedOrigins) {
        this.sessions = sessions;
        this.origins = java.util.Arrays.stream(allowedOrigins.split(",")).map(String::trim).toArray(String[]::new);
    }

    @Bean
    public TaskScheduler heartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic").setHeartbeatValue(new long[] { 10000, 10000 })
                .setTaskScheduler(heartbeatScheduler());
        config.setApplicationDestinationPrefixes("/app");
    }

    public ChannelInterceptor clientInboundAuthorization() {
        return new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor headers = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (headers == null) return message;
                SimpMessageType type = headers.getMessageType();
                if (SimpMessageType.CONNECT.equals(type)) {
                    String token = headers.getFirstNativeHeader("X-Session-Token");
                    if (sessions.authenticate(token).isEmpty() || headers.getSessionAttributes() == null)
                        throw new AccessDeniedException("Sessione non valida");
                    headers.getSessionAttributes().put("token", token);
                    return message;
                }
                if (!SimpMessageType.MESSAGE.equals(type) && !SimpMessageType.SUBSCRIBE.equals(type)) return message;
                String token = headers.getSessionAttributes() == null ? null :
                        (String) headers.getSessionAttributes().get("token");
                DeviceSessionEntity session = sessions.authenticate(token)
                        .orElseThrow(() -> new AccessDeniedException("Sessione non valida"));
                String destination = headers.getDestination();
                Matcher match = DESTINATION.matcher(destination == null ? "" : destination);
                if (!match.matches() || !Long.toString(session.getGameId()).equals(match.group(2)))
                    throw new AccessDeniedException("Destinazione non consentita");
                if (SimpMessageType.SUBSCRIBE.equals(type)) {
                    if (!"topic".equals(match.group(1)) || "answer".equals(match.group(3))
                            || ("admin".equals(match.group(3)) && !"ADMIN".equals(session.getRole())))
                        throw new AccessDeniedException("Sottoscrizione non consentita");
                    return message;
                }
                if (!"app".equals(match.group(1)) || "responses".equals(match.group(3)) || "admin".equals(match.group(3)))
                    throw new AccessDeniedException("Pubblicazione non consentita");
                byte[] bytes = (byte[]) message.getPayload();
                if (bytes.length > 256_000) throw new AccessDeniedException("Messaggio troppo grande");
                JSONObject payload;
                try { payload = new JSONObject(new String(bytes, StandardCharsets.UTF_8)); }
                catch (Exception e) { throw new AccessDeniedException("Messaggio non valido"); }
                if ("REMOTE".equals(session.getRole())) {
                    if (!session.getPlayerName().equals(payload.optString("playerName", "")))
                        throw new AccessDeniedException("Squadra diversa dalla sessione");
                    if ("status".equals(match.group(3)) && !REMOTE_ACTIONS.contains(payload.optString("action")))
                        throw new AccessDeniedException("Azione non consentita");
                } else {
                    String action = payload.optString("action");
                    boolean permitted = ("TV".equals(session.getRole()) && TV_ACTIONS.contains(action))
                            || ("ADMIN".equals(session.getRole()) && ADMIN_ACTIONS.contains(action));
                    if ("answer".equals(match.group(3)) || !permitted)
                        throw new AccessDeniedException("Azione non consentita");
                }
                return message;
            }
        };
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(clientInboundAuthorization());
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-pubgame").setAllowedOrigins(origins);
        registry.addEndpoint("/ws-pubgame/sockjs").setAllowedOrigins(origins).withSockJS();
    }
}
