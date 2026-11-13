package com.pub_game_be.service;

import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bonus Basket con tiro e punteggio verificati dal server.
 *
 * <p>Il server assegna a ogni tiro una finestra di potenza e un gettone
 * monouso. Il telefono disegna il tabellone e anima il tiro, ma non decide se
 * il canestro è entrato né quanti punti vale: manda potenza e direzione, il
 * server controlla la finestra e aggiorna il totale.</p>
 */
@Service
public class BasketService {

    private static final String BLOB = "basket";
    private static final long DURATION_MS = 90_000L;
    private static final long MANCHE_MS = 30_000L;
    private static final double TOLERANCE = 0.055;
    private static final int[] BASE_POINTS = {2, 3, 5};

    /**
     * Quanto può essere largo il tiro per entrare: la finestra stringe man mano
     * che il canestro si rimpicciolisce. Prima il laterale era ignorato e si
     * segnava anche tirando di lato.
     */
    private static final double[] SIDE_TOLERANCE = {0.24, 0.17, 0.11};

    private static final class PlayerState {
        String name;
        int score;
        int baskets;
        int shots;
        double targetPull;
        double tolerance = TOLERANCE;
        String shotId;
        final int[] mancheScores = new int[3];
    }

    private static final class Session {
        long startedAt;
        long endsAt;
        boolean active = true;
        final Map<String, PlayerState> players = new LinkedHashMap<>();
    }

    private final StateBlobService stateBlobs;
    private final Map<Long, Session> sessions = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public BasketService(StateBlobService stateBlobs) {
        this.stateBlobs = stateBlobs;
    }

    public synchronized JSONObject start(long gameId, List<String> playerNames) {
        Session session = new Session();
        session.startedAt = System.currentTimeMillis();
        session.endsAt = session.startedAt + DURATION_MS;
        Set<String> seen = new LinkedHashSet<>();
        if (playerNames != null) {
            for (String raw : playerNames) {
                String name = raw == null ? "" : raw.trim();
                if (name.isEmpty() || !seen.add(name.toLowerCase(Locale.ROOT))) {
                    continue;
                }
                PlayerState player = new PlayerState();
                player.name = name;
                newTarget(player);
                session.players.put(name.toLowerCase(Locale.ROOT), player);
            }
        }
        sessions.put(gameId, session);
        persist(gameId, session);
        return new JSONObject()
                .put("active", true)
                .put("startedAt", session.startedAt)
                .put("endsAt", session.endsAt)
                .put("players", session.players.size());
    }

    public synchronized JSONObject state(long gameId, String playerName) {
        Session session = session(gameId);
        if (!active(session)) {
            return new JSONObject().put("active", false);
        }
        PlayerState player = player(session, playerName);
        if (player == null) {
            return new JSONObject().put("active", false);
        }
        return playerJson(session, player);
    }

    public synchronized Optional<JSONObject> shot(long gameId, String playerName, String shotId,
            double pull, double side) {
        Session session = session(gameId);
        if (!active(session)) {
            return Optional.empty();
        }
        PlayerState player = player(session, playerName);
        if (player == null || shotId == null || !shotId.equals(player.shotId)
                || !Double.isFinite(pull) || pull < 0 || pull > 1
                || !Double.isFinite(side) || side < -1 || side > 1) {
            return Optional.empty();
        }

        long now = System.currentTimeMillis();
        int manche = manche(session, now);
        double distance = Math.abs(pull - player.targetPull);
        double lateral = Math.abs(side);
        double sideTolerance = SIDE_TOLERANCE[Math.min(manche, SIDE_TOLERANCE.length - 1)];
        boolean made = distance <= player.tolerance && lateral <= sideTolerance;
        boolean centered = lateral <= sideTolerance * 0.4;
        int points = made
                ? BASE_POINTS[manche] + (distance <= player.tolerance * 0.4 && centered ? 1 : 0)
                : 0;

        player.shots++;
        if (made) {
            player.baskets++;
            player.score += points;
            player.mancheScores[manche] += points;
        }
        newTarget(player);
        persist(gameId, session);

        JSONObject result = playerJson(session, player);
        result.put("made", made)
                .put("points", points)
                .put("shotId", shotId)
                .put("manche", manche + 1)
                .put("nextShotId", player.shotId)
                .put("targetPull", player.targetPull)
                .put("targetTolerance", player.tolerance);
        return Optional.of(result);
    }

    public synchronized JSONArray finish(long gameId) {
        Session session = session(gameId);
        if (session == null) {
            return new JSONArray();
        }
        session.active = false;
        List<PlayerState> ranked = new ArrayList<>(session.players.values());
        ranked.sort(Comparator
                .comparingInt((PlayerState player) -> player.score).reversed()
                .thenComparing(Comparator.comparingInt((PlayerState player) -> player.baskets).reversed())
                .thenComparing(player -> player.name, String.CASE_INSENSITIVE_ORDER));
        JSONArray results = new JSONArray();
        for (int index = 0; index < ranked.size(); index++) {
            PlayerState player = ranked.get(index);
            results.put(new JSONObject()
                    .put("playerName", player.name)
                    .put("position", index + 1)
                    .put("score", player.score)
                    .put("baskets", player.baskets)
                    .put("shots", player.shots));
        }
        persist(gameId, session);
        return results;
    }

    public synchronized void forget(long gameId) {
        sessions.remove(gameId);
        stateBlobs.forget(gameId, BLOB);
    }

    private boolean active(Session session) {
        if (session == null || !session.active) {
            return false;
        }
        if (System.currentTimeMillis() > session.endsAt) {
            session.active = false;
            return false;
        }
        return true;
    }

    private PlayerState player(Session session, String name) {
        if (session == null || name == null) {
            return null;
        }
        return session.players.get(name.trim().toLowerCase(Locale.ROOT));
    }

    private int manche(Session session, long now) {
        long elapsed = Math.max(0, now - session.startedAt);
        return (int) Math.min(2, elapsed / MANCHE_MS);
    }

    private void newTarget(PlayerState player) {
        player.targetPull = 0.30 + random.nextDouble() * 0.34;
        player.tolerance = TOLERANCE;
        player.shotId = "bk-" + UUID.randomUUID();
    }

    private JSONObject playerJson(Session session, PlayerState player) {
        JSONArray mancheScores = new JSONArray();
        for (int value : player.mancheScores) mancheScores.put(value);
        return new JSONObject()
                .put("active", true)
                .put("playerName", player.name)
                .put("score", player.score)
                .put("baskets", player.baskets)
                .put("shots", player.shots)
                .put("manche", manche(session, System.currentTimeMillis()) + 1)
                .put("mancheScores", mancheScores)
                .put("targetPull", player.targetPull)
                .put("targetTolerance", player.tolerance)
                .put("shotId", player.shotId)
                .put("endsAt", session.endsAt)
                .put("serverTime", System.currentTimeMillis());
    }

    private Session session(long gameId) {
        Session session = sessions.get(gameId);
        if (session != null) {
            return session;
        }
        Optional<String> blob = stateBlobs.load(gameId, BLOB);
        if (blob.isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            Session restored = new Session();
            restored.startedAt = json.optLong("startedAt", 0);
            restored.endsAt = json.optLong("endsAt", 0);
            restored.active = json.optBoolean("active", false);
            JSONArray players = json.optJSONArray("players");
            for (int index = 0; players != null && index < players.length(); index++) {
                JSONObject row = players.optJSONObject(index);
                if (row == null) continue;
                PlayerState player = new PlayerState();
                player.name = row.optString("name", "");
                player.score = row.optInt("score", 0);
                player.baskets = row.optInt("baskets", 0);
                player.shots = row.optInt("shots", 0);
                player.targetPull = row.optDouble("targetPull", 0.5);
                player.tolerance = row.optDouble("tolerance", TOLERANCE);
                player.shotId = row.optString("shotId", "");
                JSONArray mancheScores = row.optJSONArray("mancheScores");
                for (int i = 0; mancheScores != null && i < player.mancheScores.length; i++) {
                    player.mancheScores[i] = mancheScores.optInt(i, 0);
                }
                if (!player.name.isBlank()) {
                    restored.players.put(player.name.toLowerCase(Locale.ROOT), player);
                }
            }
            sessions.put(gameId, restored);
            return restored;
        } catch (Exception malformed) {
            System.out.println("⚠️ Basket illeggibile per la partita " + gameId + ": " + malformed.getMessage());
            return null;
        }
    }

    private void persist(long gameId, Session session) {
        JSONArray players = new JSONArray();
        for (PlayerState player : session.players.values()) {
            JSONArray mancheScores = new JSONArray();
            for (int value : player.mancheScores) mancheScores.put(value);
            players.put(new JSONObject()
                    .put("name", player.name)
                    .put("score", player.score)
                    .put("baskets", player.baskets)
                    .put("shots", player.shots)
                    .put("targetPull", player.targetPull)
                    .put("tolerance", player.tolerance)
                    .put("shotId", player.shotId)
                    .put("mancheScores", mancheScores));
        }
        stateBlobs.save(gameId, BLOB, new JSONObject()
                .put("startedAt", session.startedAt)
                .put("endsAt", session.endsAt)
                .put("active", session.active)
                .put("players", players)
                .toString());
    }
}
