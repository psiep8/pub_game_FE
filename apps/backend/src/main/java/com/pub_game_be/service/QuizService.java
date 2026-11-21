package com.pub_game_be.service;

import com.pub_game_be.reliability.GameStateService;
import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Voti del Quiz arbitrati dal server.
 *
 * <p>Prima la TV contava le risposte: un telefono poteva votare due volte (bastava
 * rimandare il messaggio) e le risposte arrivate durante un refresh della TV
 * andavano perse. Qui il server sa quale manche è aperta (la TV la annuncia),
 * controlla tempo e soluzione, registra un solo voto per telefono e manche e
 * conserva le risposte così la TV può rileggerle dopo un refresh.</p>
 */
@Service
public class QuizService {

    /** Chiave del blob con la manche aperta e le risposte del round. */
    private static final String BLOB = "quiz";
    /** Durata della manche: la stessa che mostra la TV. */
    static final long MANCHE_MS = 15_000L;
    /** Penalità di una risposta sbagliata, come nel regolamento del round. */
    static final int WRONG_PENALTY = -1000;
    private static final int ROUND_POINTS = 1000;
    private static final int MAX_QUESTIONS = 3;

    private final StateBlobService stateBlobs;
    private final GameStateService gameState;

    public QuizService(StateBlobService stateBlobs, GameStateService gameState) {
        this.stateBlobs = stateBlobs;
        this.gameState = gameState;
    }

    /** Esito di un voto: `reason` spiega il rifiuto al telefono. */
    public record Outcome(boolean accepted, String reason, JSONObject result) {
        static Outcome rejected(String reason) {
            return new Outcome(false, reason, null);
        }
    }

    /**
     * Apre la manche annunciata dalla TV. Richiamarla sulla stessa manche non
     * azzera il cronometro: la TV può ripetere l'annuncio senza falsare il tempo.
     */
    /** Apertura piena: la manche comincia adesso, con tutti i suoi secondi. */
    public synchronized JSONObject startManche(long gameId, int manche, String expectedRoundStartId) {
        return startManche(gameId, manche, MANCHE_MS / 1000L, expectedRoundStartId);
    }

    /**
     * Apre (o riapre) la manche con il tempo che le resta.
     *
     * <p>La TV dopo un refresh riannuncia la manche corrente: se il server ha
     * ancora lo stato non cambia nulla, se l'ha perso (riavvio) o la finestra
     * era già chiusa la manche riparte con `startedAt` spostato indietro, così
     * i telefoni possono votare senza che i punti tornino pieni.</p>
     */
    public synchronized JSONObject startManche(long gameId, int manche, long remainingSeconds, String expectedRoundStartId) {
        return gameState.withRoundLock(gameId, () -> startMancheLocked(gameId, manche, remainingSeconds, expectedRoundStartId));
    }

    private JSONObject startMancheLocked(long gameId, int manche, long remainingSeconds, String expectedRoundStartId) {
        // Solo un round Quiz aperto può aprire una manche: un annuncio in
        // ritardo di un altro gioco non deve lasciare uno stato orfano.
        if (!gameState.isActiveRoundType(gameId, "QUIZ")) return null;

        JSONObject snapshot = gameState.snapshot(gameId);
        String roundKey = snapshot.optString("roundKey", "");
        String roundStartId = gameState.currentRoundStartId(gameId).orElse("");
        if (roundStartId.isBlank() || !roundStartId.equals(expectedRoundStartId)) return null;
        int index = Math.max(0, manche);
        long now = System.currentTimeMillis();

        JSONObject stored = load(gameId);
        // Dopo un aggiornamento a partita in corso un vecchio blob non prova
        // a quale apertura appartiene: conservarlo e non riaprire voti è più
        // sicuro che perdere le risposte registrate nella stessa chiave.
        if (stored != null && stored.optString("roundStartId").isBlank()
                && roundKey.equals(stored.optString("roundKey"))) return summary(stored);
        if (stored != null && roundStartId.equals(stored.optString("roundStartId"))
                && stored.optInt("mancheIndex", -1) > index) return summary(stored);
        if (stored != null
                && roundStartId.equals(stored.optString("roundStartId"))
                && stored.optInt("mancheIndex", -1) == index
                && stored.optLong("deadlineAt", 0L) > now) {
            return summary(stored);
        }

        JSONArray answers = new JSONArray();
        if (stored != null && roundStartId.equals(stored.optString("roundStartId"))) {
            JSONArray previous = stored.optJSONArray("answers");
            if (previous != null) answers = previous;
        }

        long remaining = Math.max(0L, Math.min(MANCHE_MS, remainingSeconds * 1000L));
        JSONObject state = new JSONObject()
                .put("roundKey", roundKey)
                .put("roundStartId", roundStartId)
                .put("mancheIndex", index)
                .put("startedAt", now - (MANCHE_MS - remaining))
                .put("deadlineAt", now + remaining)
                .put("answers", answers);
        save(gameId, state);
        return summary(state);
    }

    /** Registra il voto del telefono: un solo voto per giocatore e manche. */
    public synchronized Outcome answer(long gameId, String playerName, int optionIndex, int expectedManche, String expectedRoundStartId) {
        return gameState.withRoundLock(gameId,
                () -> answerLocked(gameId, playerName, optionIndex, expectedManche, expectedRoundStartId));
    }

    private Outcome answerLocked(long gameId, String playerName, int optionIndex, int expectedManche, String expectedRoundStartId) {
        String name = playerName == null ? "" : playerName.trim();
        if (name.isEmpty()) return Outcome.rejected("player-required");
        if (!gameState.isActiveRoundType(gameId, "QUIZ")) return Outcome.rejected("round-closed");

        JSONObject stored = load(gameId);
        JSONObject snapshot = gameState.snapshot(gameId);
        String roundKey = snapshot.optString("roundKey", "");
        long now = System.currentTimeMillis();
        String roundStartId = gameState.currentRoundStartId(gameId).orElse("");
        if (stored == null || !roundKey.equals(stored.optString("roundKey"))
                || roundStartId.isBlank() || !roundStartId.equals(stored.optString("roundStartId"))) {
            return Outcome.rejected("manche-closed");
        }
        int manche = stored.optInt("mancheIndex", -1);
        if (!roundStartId.equals(expectedRoundStartId) || manche != expectedManche) {
            return Outcome.rejected("manche-stale");
        }
        if (now > stored.optLong("deadlineAt", 0L)) return Outcome.rejected("manche-closed");
        JSONArray answers = stored.optJSONArray("answers");
        if (answers == null) answers = new JSONArray();
        for (int index = 0; index < answers.length(); index++) {
            JSONObject row = answers.optJSONObject(index);
            if (row != null && row.optInt("manche", -1) == manche
                    && name.equalsIgnoreCase(row.optString("playerName"))) {
                return Outcome.rejected("already-answered");
            }
        }

        List<JSONObject> questions = questions(payloadOf(snapshot));
        if (manche < 0 || manche >= questions.size()) return Outcome.rejected("manche-closed");
        JSONObject question = questions.get(manche);
        JSONArray options = question.optJSONArray("options");
        if (options == null || optionIndex < 0 || optionIndex >= options.length()) {
            return Outcome.rejected("invalid-option");
        }

        boolean correct = String.valueOf(options.opt(optionIndex)).trim()
                .equals(question.optString("correctAnswer", "").trim());
        long elapsed = Math.max(0L, now - stored.optLong("startedAt", now));
        int points = correct ? pointsFor(question.optInt("maxPoints", 0), elapsed) : WRONG_PENALTY;

        JSONObject result = new JSONObject()
                .put("playerName", name)
                .put("roundStartId", roundStartId)
                .put("manche", manche)
                .put("optionIndex", optionIndex)
                .put("isCorrect", correct)
                .put("points", points)
                .put("answeredAt", now);
        answers.put(result);
        stored.put("answers", answers);
        save(gameId, stored);
        return new Outcome(true, null, result);
    }

    /** Manche aperta e risposte registrate: è ciò che la TV rilegge al ritorno. */
    public synchronized JSONObject summary(long gameId) {
        return gameState.withRoundLock(gameId, () -> {
            JSONObject stored = load(gameId);
            if (stored == null || !gameState.isCurrentRoundType(gameId, "QUIZ")
                    || !gameState.currentRoundStartId(gameId).filter(id -> id.equals(stored.optString("roundStartId"))).isPresent()) {
                return emptySummary();
            }
            return summary(stored);
        });
    }

    private JSONObject emptySummary() {
        return new JSONObject()
                .put("roundStartId", "")
                .put("mancheIndex", -1)
                .put("startedAt", 0L)
                .put("deadlineAt", 0L)
                .put("serverTime", System.currentTimeMillis())
                .put("answers", new JSONArray());
    }

    public void forget(long gameId) {
        stateBlobs.forget(gameId, BLOB);
    }

    private JSONObject summary(JSONObject state) {
        JSONArray answers = state.optJSONArray("answers");
        return new JSONObject()
                .put("roundStartId", state.optString("roundStartId", ""))
                .put("mancheIndex", state.optInt("mancheIndex", 0))
                .put("startedAt", state.optLong("startedAt", 0L))
                .put("deadlineAt", state.optLong("deadlineAt", 0L))
                .put("serverTime", System.currentTimeMillis())
                .put("answers", answers == null ? new JSONArray() : answers);
    }

    /**
     * Domande del round con il valore di ciascuna. Il payload del Quiz può
     * essere una domanda sola o una lista: la TV fa la stessa cosa, e la
     * ripartizione dei 1000 punti deve coincidere, altrimenti server e
     * schermo non raccontano lo stesso punteggio.
     */
    private List<JSONObject> questions(JSONObject payload) {
        List<JSONObject> rows = new ArrayList<>();
        JSONArray raw = payload.optJSONArray("questions");
        if (raw != null) {
            for (int index = 0; index < raw.length(); index++) {
                JSONObject row = raw.optJSONObject(index);
                if (row != null && row.has("question") && row.optJSONArray("options") != null) rows.add(row);
            }
        }
        if (rows.isEmpty() && payload.has("question") && payload.optJSONArray("options") != null) {
            rows.add(payload);
        }
        if (rows.size() > MAX_QUESTIONS) rows = new ArrayList<>(rows.subList(0, MAX_QUESTIONS));
        if (rows.isEmpty()) return rows;

        int totalWeight = 0;
        for (JSONObject row : rows) totalWeight += weight(row.optString("difficulty"));
        int assigned = 0;
        for (int index = 0; index < rows.size(); index++) {
            JSONObject row = rows.get(index);
            int maxPoints = row.optInt("maxPoints", 0);
            if (maxPoints <= 0) {
                maxPoints = index == rows.size() - 1
                        ? Math.max(0, ROUND_POINTS - assigned)
                        : (int) Math.round((ROUND_POINTS * weight(row.optString("difficulty"))) / (double) totalWeight);
                row.put("maxPoints", maxPoints);
            }
            assigned += maxPoints;
        }
        return rows;
    }

    /** Il tempo taglia il valore: rispondere subito vale il tetto della domanda. */
    private int pointsFor(int maxPoints, long elapsedMs) {
        double ratio = 1.0 - Math.min(1.0, elapsedMs / (double) MANCHE_MS);
        return (int) Math.round(maxPoints * Math.max(0.0, ratio));
    }

    private int weight(String difficulty) {
        String text = difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT);
        if (text.equals("facile") || text.equals("easy")) return 1;
        if (text.equals("difficile") || text.equals("hard")) return 3;
        return 2;
    }

    private JSONObject payloadOf(JSONObject snapshot) {
        Object raw = snapshot.opt("payload");
        if (raw instanceof JSONObject object) return object;
        if (raw instanceof String text && !text.isBlank()) {
            try {
                return new JSONObject(text);
            } catch (org.json.JSONException ignored) {
                // Payload rotto: la manche non è giocabile, il voto viene rifiutato.
            }
        }
        return new JSONObject();
    }

    private JSONObject load(long gameId) {
        return stateBlobs.load(gameId, BLOB).map(JSONObject::new).orElse(null);
    }

    private void save(long gameId, JSONObject state) {
        stateBlobs.save(gameId, BLOB, state.toString());
    }
}
