package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import com.pub_game_be.reliability.repository.DeviceSessionRepository;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Sessioni dei dispositivi: TV, remote e admin.
 *
 * <p>Il token di sessione è il modo con cui un telefono ritrova la propria
 * squadra dopo una riconnessione (o un riavvio del telefono) senza reinserire
 * il codice partita e senza diventare un secondo giocatore.</p>
 */
@Service
public class DeviceSessionService {

    public record Registration(String sessionToken, String connectionId, String deviceId, String role,
            String playerName, boolean resumed, boolean duplicateDisplay) {
    }

    private final DeviceSessionRepository sessions;
    private final ReliabilityProperties props;

    public DeviceSessionService(DeviceSessionRepository sessions, ReliabilityProperties props) {
        this.sessions = sessions;
        this.props = props;
    }

    /**
     * Registra o riprende una sessione.
     *
     * <p>Se il dispositivo presenta un token valido per questa partita la
     * sessione viene ripresa: stessa identità, stessi punti, contatore di
     * riconnessioni incrementato.</p>
     */
    public Registration register(long gameId, String deviceId, String role, String playerName, String token) {
        String safeRole = normalizeRole(role);
        String safeDevice = (deviceId == null || deviceId.isBlank()) ? "device-" + UUID.randomUUID() : deviceId.trim();
        String safePlayer = playerName == null ? null : playerName.trim();
        long now = System.currentTimeMillis();

        Optional<DeviceSessionEntity> byToken = (token == null || token.isBlank())
                ? Optional.empty()
                : sessions.findBySessionToken(token).filter(session -> session.getGameId() == gameId);

        if (byToken.isPresent()) {
            DeviceSessionEntity session = byToken.get();
            boolean duplicate = "TV".equals(safeRole) && hasOtherConnectedDisplay(gameId, session.getId(), now);
            session.setConnectionId(UUID.randomUUID().toString());
            session.setLastHeartbeatAt(now);
            session.setActive(true);
            session.setReconnections(session.getReconnections() + 1);
            if (safePlayer != null && !safePlayer.isBlank()) {
                session.setPlayerName(safePlayer);
            }
            sessions.save(session);
            return new Registration(session.getSessionToken(), session.getConnectionId(),
                    session.getDeviceId(), session.getRole(), session.getPlayerName(), true, duplicate);
        }

        Optional<DeviceSessionEntity> sameDevice = sessions
                .findFirstByGameIdAndDeviceIdAndRoleOrderByLastHeartbeatAtDesc(gameId, safeDevice, safeRole);

        DeviceSessionEntity session = sameDevice.orElseGet(DeviceSessionEntity::new);
        boolean resumed = sameDevice.isPresent();
        if (!resumed) {
            session.setGameId(gameId);
            session.setDeviceId(safeDevice);
            session.setRole(safeRole);
            session.setSessionToken(UUID.randomUUID().toString());
            session.setFirstSeenAt(now);
        } else {
            session.setReconnections(session.getReconnections() + 1);
        }
        if (session.getSessionToken() == null) {
            session.setSessionToken(UUID.randomUUID().toString());
        }
        if (safePlayer != null && !safePlayer.isBlank()) {
            session.setPlayerName(safePlayer);
        }
        session.setConnectionId(UUID.randomUUID().toString());
        session.setLastHeartbeatAt(now);
        session.setActive(true);
        sessions.save(session);

        boolean duplicate = "TV".equals(safeRole) && hasOtherConnectedDisplay(gameId, session.getId(), now);
        return new Registration(session.getSessionToken(), session.getConnectionId(), session.getDeviceId(),
                session.getRole(), session.getPlayerName(), resumed, duplicate);
    }

    /** Heartbeat: vuoto se il token non esiste più (il client deve registrarsi). */
    public Optional<DeviceSessionEntity> heartbeat(long gameId, String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        Optional<DeviceSessionEntity> found = sessions.findBySessionToken(token)
                .filter(session -> session.getGameId() == gameId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        DeviceSessionEntity session = found.get();
        session.setLastHeartbeatAt(System.currentTimeMillis());
        session.setActive(true);
        sessions.save(session);
        return Optional.of(session);
    }

    public void disconnect(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        sessions.findBySessionToken(token).ifPresent(session -> {
            session.setActive(false);
            session.setLastHeartbeatAt(session.getLastHeartbeatAt());
            sessions.save(session);
        });
    }

    public boolean isConnected(DeviceSessionEntity session) {
        long timeout = Math.max(5, props.getHeartbeatTimeoutSeconds()) * 1000L;
        Long last = session.getLastHeartbeatAt();
        return session.isActive() && last != null && System.currentTimeMillis() - last <= timeout;
    }

    public JSONArray presence(long gameId) {
        JSONArray array = new JSONArray();
        long now = System.currentTimeMillis();
        for (DeviceSessionEntity session : sessions.findByGameIdOrderByLastHeartbeatAtDesc(gameId)) {
            array.put(new JSONObject()
                    .put("deviceId", session.getDeviceId())
                    .put("role", session.getRole())
                    .put("playerName", session.getPlayerName())
                    .put("connectionId", session.getConnectionId())
                    .put("connected", isConnected(session))
                    .put("lastHeartbeatAt", session.getLastHeartbeatAt() == null ? JSONObject.NULL : session.getLastHeartbeatAt())
                    .put("lastHeartbeatAgoMs", session.getLastHeartbeatAt() == null ? JSONObject.NULL : now - session.getLastHeartbeatAt())
                    .put("reconnections", session.getReconnections()));
        }
        return array;
    }

    public List<DeviceSessionEntity> all(long gameId) {
        return new ArrayList<>(sessions.findByGameIdOrderByLastHeartbeatAtDesc(gameId));
    }

    public JSONObject summary(long gameId) {
        List<DeviceSessionEntity> all = all(gameId);
        int connected = 0;
        int totalReconnections = 0;
        for (DeviceSessionEntity session : all) {
            if (isConnected(session)) {
                connected++;
            }
            totalReconnections += session.getReconnections();
        }
        return new JSONObject()
                .put("devices", all.size())
                .put("connected", connected)
                .put("offline", all.size() - connected)
                .put("reconnections", totalReconnections);
    }

    private boolean hasOtherConnectedDisplay(long gameId, Long selfId, long now) {
        for (DeviceSessionEntity other : sessions.findByGameIdOrderByLastHeartbeatAtDesc(gameId)) {
            if (!"TV".equals(other.getRole())) {
                continue;
            }
            if (selfId != null && selfId.equals(other.getId())) {
                continue;
            }
            if (isConnected(other)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "REMOTE";
        }
        return switch (role.trim().toUpperCase(Locale.ROOT)) {
            case "TV", "DISPLAY", "SCREEN" -> "TV";
            case "ADMIN", "PRESENTER" -> "ADMIN";
            default -> "REMOTE";
        };
    }
}
