package com.pub_game_be.security;

import com.pub_game_be.reliability.DeviceSessionService;
import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Explicitly grants public and player routes; every other API route is regia-only. */
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    private static final Pattern GAME_PATH = Pattern.compile("^/games/(\\d+)(?:/(.*))?$");
    private static final Set<String> PLAYER_GET = Set.of("sync", "arena-question", "bomba/state");
    private static final Set<String> PLAYER_POST = Set.of("session/heartbeat", "session/disconnect",
            "arena-answer", "timeline-answer", "time-buzzer/stop", "bomba/pick");
    /** Pagine e file serviti dal jar: devono essere leggibili prima del login. */
    private static final Set<String> PUBLIC_GET = Set.of("/", "/index.html", "/favicon.ico",
            "/manifest.webmanifest", "/ngsw.json", "/ngsw-worker.js", "/games/active", "/error");
    private static final Set<String> SPA_ROUTES = Set.of("/tv", "/play", "/admin", "/basket",
            "/bonus-preview");
    private static final Pattern STATIC_ASSET = Pattern.compile(
            "^/(?:[\\w.-]+/)*[\\w.-]+\\.(?:js|css|ico|png|svg|webp|avif|jpg|jpeg|gif|woff2?|ttf|otf|webmanifest|json)$");
    private final DeviceSessionService sessions;

    public SessionAuthenticationFilter(DeviceSessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        String method = request.getMethod();
        Matcher game = GAME_PATH.matcher(path);
        if (isPublicAsset(path, method)
                || "OPTIONS".equals(method) || path.equals("/ws-pubgame") || path.startsWith("/ws-pubgame/sockjs")
                || ("GET".equals(method) && (path.equals("/categories") || path.startsWith("/media/")))
                || ("POST".equals(method) && game.matches() && "session".equals(game.group(2)))) {
            if (path.endsWith("/session")) response.setHeader("Cache-Control", "no-store");
            chain.doFilter(request, response);
            return;
        }
        DeviceSessionEntity session = sessions.authenticate(request.getHeader("X-Session-Token")).orElse(null);
        if (session == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        boolean gameRoute = game.matches();
        if (gameRoute && !Long.toString(session.getGameId()).equals(game.group(1))) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        request.setAttribute("pubgame.session", session);
        if ("REMOTE".equals(session.getRole())) {
            String endpoint = gameRoute ? game.group(2) : null;
            boolean allowed = endpoint != null && (("GET".equals(method) && PLAYER_GET.contains(endpoint))
                    || ("POST".equals(method) && PLAYER_POST.contains(endpoint)));
            if (!allowed) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN);
                return;
            }
            if ("GET".equals(method) && ("arena-question".equals(endpoint) || "bomba/state".equals(endpoint))) {
                String player = request.getParameter("arena-question".equals(endpoint) ? "playerId" : "player");
                if (!session.getPlayerName().equals(player)) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN);
                    return;
                }
            }
        } else if (!Set.of("TV", "ADMIN").contains(session.getRole())) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        response.setHeader("Cache-Control", "no-store");
        chain.doFilter(request, response);
    }

    /**
     * Asset del frontend e pagine SPA: sono pubblici per definizione, ma restano
     * separati dalle API, che continuano a richiedere una sessione.
     */
    private boolean isPublicAsset(String path, String method) {
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            return false;
        }
        return PUBLIC_GET.contains(path)
                || SPA_ROUTES.contains(path)
                || path.startsWith("/bonus-preview/")
                || path.startsWith("/icons/")
                || path.startsWith("/assets/")
                || STATIC_ASSET.matcher(path).matches();
    }
}
