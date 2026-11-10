package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Prova dei pulsanti: cinque passi per ogni telefono, salvati sul server.
 *
 * <p>Il telefono può ricaricarsi a metà prova: al rientro ritrova i passi già
 * completati. Il nome non arriva mai dal client, ma dalla sessione autenticata,
 * così una squadra non può dichiarare l'esito di un'altra.</p>
 */
@Service
public class ButtonTestService {

    public static final int STEPS = 5;
    /** La TV chiede la lettera B: un solo bersaglio per tutti, facile da leggere. */
    public static final int TARGET_INDEX = 1;
    private static final class TeamState {
        int completedSteps;
        long updatedAt;
        long latencyMs = -1;
        Boolean vibrated;
        boolean flagged;
        boolean skipped;
        boolean completed;
    }

    private static final class Session {
        boolean active = true;
        long startedAt = System.currentTimeMillis();
        final Map<String, TeamState> teams = new LinkedHashMap<>();
    }

    private final Map<Long, Session> sessions = new LinkedHashMap<>();

    /** Snapshot per TV e admin; aggiunge le squadre presenti ma non ancora registrate. */
    public synchronized JSONObject snapshot(long gameId, List<String> playerNames) {
        Session session = session(gameId);
        for (String name : playerNames) {
            if (name != null && !name.isBlank()) {
                session.teams.computeIfAbsent(name.trim(), ignored -> new TeamState());
            }
        }
        JSONArray teams = new JSONArray();
        boolean allReady = !session.teams.isEmpty();
        for (Map.Entry<String, TeamState> entry : session.teams.entrySet()) {
            TeamState state = entry.getValue();
            boolean ready = state.completed || state.skipped;
            allReady &= ready;
            teams.put(toJson(entry.getKey(), state));
        }
        return new JSONObject()
                .put("active", session.active)
                .put("steps", STEPS)
                .put("targetIndex", TARGET_INDEX)
                .put("targetLabel", String.valueOf((char) ('A' + TARGET_INDEX)))
                .put("allReady", allReady)
                .put("startedAt", session.startedAt)
                .put("teams", teams);
    }

    /** Vista privata del telefono: riprende dal primo passo non completato. */
    public synchronized JSONObject team(long gameId, String playerName) {
        TeamState state = teamState(gameId, playerName);
        return toJson(playerName, state)
                .put("targetIndex", TARGET_INDEX)
                .put("targetLabel", String.valueOf((char) ('A' + TARGET_INDEX)))
                .put("steps", STEPS);
    }

    /** Registra un passo; il server controlla che sia quello successivo. */
    public synchronized JSONObject recordStep(long gameId, String playerName, int step,
            boolean vibrated, long latencyMs, boolean flagged) {
        if (step < 1 || step > STEPS) {
            throw new BadButtonTestRequest("Passo non valido");
        }
        TeamState state = teamState(gameId, playerName);
        int expected = state.completedSteps + 1;
        if (step != expected && !(step <= state.completedSteps)) {
            throw new BadButtonTestRequest("Passo fuori ordine");
        }
        state.completedSteps = Math.max(state.completedSteps, step);
        state.updatedAt = System.currentTimeMillis();
        state.flagged |= flagged;
        if (step == 4) state.vibrated = vibrated;
        if (step == 5) {
            state.latencyMs = Math.max(0, latencyMs);
            state.completed = true;
        }
        return team(gameId, playerName);
    }

    /** Reset globale: riparte la prova per tutte le squadre presenti. */
    public synchronized JSONObject start(long gameId, List<String> playerNames) {
        Session session = session(gameId);
        session.active = true;
        session.startedAt = System.currentTimeMillis();
        session.teams.clear();
        for (String name : playerNames) {
            if (name != null && !name.isBlank()) {
                session.teams.put(name.trim(), new TeamState());
            }
        }
        return snapshot(gameId, playerNames);
    }

    /** Rifà la prova di una sola squadra. */
    public synchronized JSONObject resetTeam(long gameId, String playerName) {
        session(gameId).teams.put(playerName, new TeamState());
        return team(gameId, playerName);
    }

    /** Salta la prova per tutti: la serata può partire, ma resta il segno "da controllare". */
    public synchronized JSONObject skipAll(long gameId, List<String> playerNames) {
        Session session = session(gameId);
        for (String name : playerNames) {
            if (name == null || name.isBlank()) continue;
            TeamState state = session.teams.computeIfAbsent(name.trim(), ignored -> new TeamState());
            state.skipped = true;
            state.completed = true;
            state.updatedAt = System.currentTimeMillis();
        }
        return snapshot(gameId, playerNames);
    }

    /** Chiude la prova quando parte il primo round. */
    public synchronized JSONObject finish(long gameId) {
        Session session = session(gameId);
        session.active = false;
        return snapshot(gameId, List.of());
    }

    private TeamState teamState(long gameId, String playerName) {
        if (playerName == null || playerName.isBlank()) {
            throw new BadButtonTestRequest("Squadra richiesta");
        }
        return session(gameId).teams.computeIfAbsent(playerName.trim(), ignored -> new TeamState());
    }

    private Session session(long gameId) {
        return sessions.computeIfAbsent(gameId, ignored -> new Session());
    }

    private JSONObject toJson(String playerName, TeamState state) {
        boolean[] done = new boolean[STEPS];
        for (int i = 0; i < Math.min(state.completedSteps, STEPS); i++) done[i] = true;
        return new JSONObject()
                .put("playerName", playerName)
                .put("completedSteps", state.completedSteps)
                .put("nextStep", state.completed ? STEPS : Math.min(STEPS, state.completedSteps + 1))
                .put("done", new JSONArray(done))
                .put("latencyMs", state.latencyMs)
                .put("vibrated", state.vibrated == null ? JSONObject.NULL : state.vibrated)
                .put("flagged", state.flagged)
                .put("skipped", state.skipped)
                .put("completed", state.completed || state.skipped)
                .put("updatedAt", state.updatedAt);
    }

    /** Errore di protocollo: il controller lo traduce in 400. */
    public static class BadButtonTestRequest extends RuntimeException {
        public BadButtonTestRequest(String message) {
            super(message);
        }
    }
}
