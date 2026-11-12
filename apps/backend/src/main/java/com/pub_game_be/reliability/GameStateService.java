package com.pub_game_be.reliability;

import com.pub_game_be.domain.game_round.GameRound;
import com.pub_game_be.reliability.domain.GameEventEntity;
import com.pub_game_be.reliability.domain.GameStateEntity;
import com.pub_game_be.reliability.repository.GameEventRepository;
import com.pub_game_be.reliability.repository.GameStateRepository;
import com.pub_game_be.repository.GameRoundRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Consumer;

/**
 * Stato autorevole della partita, event log e snapshot.
 *
 * <p>Ogni mutazione significativa passa da qui: lo stato e l'evento vengono
 * scritti nella stessa transazione, quindi non esiste un evento pubblicato per
 * una modifica che il database non ha confermato. La sequenza per partita è
 * univoca e permette al client di chiedere esattamente gli eventi mancanti.</p>
 */
@Service
public class GameStateService {

    /** Esito di una mutazione: cosa dire al client per allinearlo. */
    public record Change(long version, long seq, String eventId) {
    }

    private final GameStateRepository states;
    private final GameEventRepository events;
    private final GameRoundRepository rounds;
    private final ReliabilityProperties props;
    private final TransactionTemplate tx;
    private final TransactionTemplate ensureTx;
    private final EntityManager entityManager;
    /** Un lock per partita: riduce il contention, ma il seq è deciso dal DB. */
    private final ConcurrentMap<Long, Object> eventLocks = new ConcurrentHashMap<>();

    public GameStateService(GameStateRepository states, GameEventRepository events,
            GameRoundRepository rounds, ReliabilityProperties props,
            PlatformTransactionManager transactionManager, EntityManager entityManager) {
        this.states = states;
        this.events = events;
        this.rounds = rounds;
        this.props = props;
        this.entityManager = entityManager;
        this.tx = new TransactionTemplate(transactionManager);
        this.ensureTx = new TransactionTemplate(transactionManager);
        this.ensureTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ------------------------------------------------------------------ Stato

    public GameStateEntity state(long gameId) {
        return states.findById(gameId).orElseGet(() -> ensureState(gameId));
    }

    private GameStateEntity ensureState(long gameId) {
        try {
            return ensureTx.execute(status -> states.findById(gameId).orElseGet(() -> {
                GameStateEntity fresh = newState(gameId);
                fresh.setUpdatedAt(System.currentTimeMillis());
                return states.saveAndFlush(fresh);
            }));
        } catch (DataIntegrityViolationException conflict) {
            // Un altro processo ha creato la riga nello stesso istante.
            return states.findById(gameId).orElseThrow(() -> conflict);
        }
    }

    /**
     * Apre un round con riferimenti temporali del server: la scadenza non è
     * calcolata dal telefono e resta valida anche dopo un riavvio.
     */
    public Change startRound(long gameId, String type, int roundIndex, String roundKey, String payload) {
        long now = System.currentTimeMillis();
        long deadline = now + windowSecondsFor(type) * 1000L;
        JSONObject event = new JSONObject()
                .put("type", type)
                .put("roundIndex", roundIndex)
                .put("roundKey", roundKey)
                .put("startedAt", now)
                .put("deadlineAt", deadline);
        return appendEvent(gameId, "ROUND_STARTED", event.toString(), gameId + "-r" + roundIndex, null,
                state -> {
                    state.setStatus("RUNNING");
                    state.setRoundType(type);
                    state.setRoundIndex(roundIndex);
                    state.setRoundKey(roundKey);
                    state.setPayload(payload);
                    state.setRoundStartedAt(now);
                    state.setRoundDeadlineAt(deadline);
                });
    }

    /** Il round accetta ancora risposte? Se nessun round è stato aperto, sì. */
    public boolean isRoundOpen(long gameId) {
        Optional<GameStateEntity> found = states.findById(gameId);
        if (found.isEmpty()) {
            return true;
        }
        GameStateEntity state = found.get();
        Long deadline = state.getRoundDeadlineAt();
        return deadline == null || System.currentTimeMillis() <= deadline;
    }

    /**
     * Partita aggiornata più di recente: una TV nuova la usa per riagganciarsi
     * alla serata in corso senza che l'operatore debba digitare l'ID.
     */
    public Optional<Long> latestGameId() {
        return states.findFirstByOrderByUpdatedAtDesc().map(GameStateEntity::getGameId);
    }

    /** Il round deve essere aperto e appartenere alla modalità richiesta. */
    public boolean isActiveRoundType(long gameId, String roundType) {
        return states.findById(gameId).filter(state -> "RUNNING".equals(state.getStatus())
                && roundType.equals(state.getRoundType())
                && (state.getRoundDeadlineAt() == null || System.currentTimeMillis() <= state.getRoundDeadlineAt()))
                .isPresent();
    }

    public Optional<Long> roundDeadline(long gameId) {
        return states.findById(gameId).map(GameStateEntity::getRoundDeadlineAt);
    }

    /** Chiude esplicitamente il round: nessuna risposta tardiva accettata. */
    public Change closeRound(long gameId, String reason) {
        return appendEvent(gameId, "ROUND_CLOSED",
                new JSONObject().put("reason", reason).toString(), null, null,
                state -> {
                    state.setStatus("WAITING");
                    state.setRoundDeadlineAt(System.currentTimeMillis());
                });
    }

    /**
     * Registra un evento e la mutazione di stato nello stesso commit.
     *
     * <p>Il seq viene assegnato da un UPDATE atomico su {@code game_state}:
     * è unico anche se più processi scrivono sulla stessa partita. Se l'insert
     * dell'evento viola comunque un vincolo, la transazione viene ritentata.</p>
     */
    public Change appendEvent(long gameId, String type, String payload, String roundKey, String deviceId,
            Consumer<GameStateEntity> mutation) {
        // Join, sync e avvio round possono arrivare nello stesso istante.
        // Il lock Java riduce il contention nel processo; l'unicità del seq è
        // garantita dall'UPDATE atomico sul database, quindi vale anche tra
        // processi diversi.
        Object lock = eventLocks.computeIfAbsent(gameId, key -> new Object());
        synchronized (lock) {
            ensureState(gameId);
            for (int attempt = 0; attempt < 3; attempt++) {
                try {
                    return tx.execute(status -> {
                        long now = System.currentTimeMillis();
                        int advanced = states.advanceSequence(gameId, now);
                        if (advanced != 1) {
                            throw new IllegalStateException("Stato assente per la partita " + gameId);
                        }

                        GameStateEntity state = states.findById(gameId)
                                .orElseThrow(() -> new IllegalStateException("Stato assente per la partita " + gameId));
                        // L'UPDATE nativo ha già incrementato seq e version:
                        // il refresh riporta nell'entità i valori appena scritti
                        // e mantiene il lock della riga fino al commit.
                        entityManager.refresh(state, LockModeType.PESSIMISTIC_WRITE);
                        long nextSeq = state.getSeq();

                        GameEventEntity event = new GameEventEntity();
                        event.setGameId(gameId);
                        event.setSeq(nextSeq);
                        event.setEventId(UUID.randomUUID().toString());
                        event.setType(type);
                        event.setPayload(payload);
                        event.setRoundKey(roundKey);
                        event.setDeviceId(deviceId);
                        event.setCreatedAt(now);

                        if (mutation != null) {
                            mutation.accept(state);
                        }
                        state.setUpdatedAt(now);
                        state.setLastSnapshotAt(now);

                        states.save(state);
                        events.saveAndFlush(event);
                        return new Change(state.getVersion(), nextSeq, event.getEventId());
                    });
                } catch (DataIntegrityViolationException conflict) {
                    // Vincolo violato da un altro scrittore: si riprova.
                }
            }
            throw new IllegalStateException("Impossibile registrare l'evento " + type + " per la partita " + gameId);
        }
    }

    public Change appendEvent(long gameId, String type, String payload) {
        return appendEvent(gameId, type, payload, null, null, null);
    }

    // -------------------------------------------------- Snapshot e sincronizzazione

    /** Snapshot completo: è ciò che un client chiede quando torna online. */
    public JSONObject snapshot(long gameId) {
        JSONObject out = new JSONObject();
        GameStateEntity state = states.findById(gameId).orElse(null);

        out.put("gameId", gameId);
        out.put("serverTime", System.currentTimeMillis());
        if (state == null) {
            out.put("version", 0);
            out.put("seq", 0);
            out.put("status", "CREATED");
            out.put("roundIndex", 0);
            out.put("hasState", false);
        } else {
            out.put("hasState", true);
            out.put("version", state.getVersion());
            out.put("seq", state.getSeq());
            out.put("status", state.getStatus());
            out.put("roundIndex", state.getRoundIndex());
            out.put("roundType", state.getRoundType());
            out.put("roundKey", state.getRoundKey());
            out.put("roundStartedAt", state.getRoundStartedAt() == null ? JSONObject.NULL : state.getRoundStartedAt());
            out.put("roundDeadlineAt", state.getRoundDeadlineAt() == null ? JSONObject.NULL : state.getRoundDeadlineAt());
            out.put("updatedAt", state.getUpdatedAt() == null ? JSONObject.NULL : state.getUpdatedAt());
            out.put("payload", parseOrNull(state.getPayload()));
        }

        Optional<GameRound> current = rounds.findFirstByGameIdOrderByRoundIndexDesc(gameId);
        out.put("currentRound", current.map(this::roundJson).orElse(null));
        return out;
    }

    /**
     * Azzera la partita: nessun round aperto, contatore a zero, eventi e round
     * cancellati. Serve al reset della TV, che altrimenti ripartiva da round 1
     * mentre il server restava al round della serata precedente.
     */
    public void reset(long gameId) {
        tx.executeWithoutResult(status -> {
            events.deleteByGameId(gameId);
            rounds.deleteByGameId(gameId);
            GameStateEntity state = states.findById(gameId).orElseGet(() -> newState(gameId));
            state.setStatus("CREATED");
            state.setRoundType(null);
            state.setRoundIndex(0);
            state.setRoundKey(null);
            state.setPayload(null);
            state.setRoundStartedAt(null);
            state.setRoundDeadlineAt(null);
            state.setSeq(0);
            state.setVersion(state.getVersion() + 1);
            state.setUpdatedAt(System.currentTimeMillis());
            state.setLastSnapshotAt(state.getUpdatedAt());
            states.save(state);
        });
    }

    /** Eventi successivi alla sequenza del client, in ordine. */
    public JSONArray eventsSince(long gameId, long sinceSeq) {
        List<GameEventEntity> found = events
                .findByGameIdAndSeqGreaterThanOrderBySeqAsc(gameId, sinceSeq);
        JSONArray array = new JSONArray();
        int limit = Math.max(1, props.getEventHistoryLimit());
        for (GameEventEntity event : found) {
            if (array.length() >= limit) {
                break;
            }
            array.put(eventJson(event));
        }
        return array;
    }

    /** Risposta completa alla riconnessione: snapshot + eventi mancanti. */
    public JSONObject sync(long gameId, long sinceSeq) {
        JSONObject snapshot = snapshot(gameId);
        long currentSeq = snapshot.optLong("seq", 0);
        boolean reset = sinceSeq > currentSeq;
        long from = reset ? 0 : Math.max(0, sinceSeq);
        JSONArray missed = eventsSince(gameId, from);
        long to = missed.isEmpty() ? from : missed.getJSONObject(missed.length() - 1).getLong("seq");

        JSONObject out = new JSONObject();
        out.put("snapshot", snapshot);
        out.put("events", missed);
        out.put("fromSeq", from);
        out.put("toSeq", to);
        out.put("complete", to >= currentSeq);
        out.put("stale", reset);
        out.put("serverTime", System.currentTimeMillis());
        return out;
    }

    public long currentSeq(long gameId) {
        return states.findById(gameId).map(GameStateEntity::getSeq).orElse(0L);
    }

    public long currentVersion(long gameId) {
        return states.findById(gameId).map(GameStateEntity::getVersion).orElse(0L);
    }

    /**
     * Fascia di difficolta delle domande Arena in base al tempo trascorso.
     *
     * <p>Primo quarto facile, meta centrale media, ultimo quarto difficile: il
     * riferimento e il timer del server, non quello del telefono, cosi la rampa
     * resta la stessa anche se un dispositivo si e appena riconnesso.</p>
     */
    public String arenaDifficultyBand(long gameId) {
        Optional<GameStateEntity> found = states.findById(gameId);
        if (found.isEmpty()) {
            return "medio";
        }
        GameStateEntity state = found.get();
        Long started = state.getRoundStartedAt();
        if (started == null) {
            return "medio";
        }

        long windowMs = Math.max(30, props.getArenaSeconds()) * 1000L;
        Long deadline = state.getRoundDeadlineAt();
        if (deadline != null && deadline > started) {
            windowMs = Math.min(windowMs, deadline - started);
        }

        long elapsed = System.currentTimeMillis() - started;
        if (elapsed <= 0) {
            return "facile";
        }
        double ratio = (double) elapsed / (double) windowMs;
        if (ratio <= 0.25) {
            return "facile";
        }
        if (ratio <= 0.75) {
            return "medio";
        }
        return "difficile";
    }

    // --------------------------------------------------------------- Diagnostica

    public Optional<GameEventEntity> lastEvent(long gameId) {
        return events.findFirstByGameIdOrderBySeqDesc(gameId);
    }

    public long eventCount(long gameId) {
        return events.countByGameId(gameId);
    }

    public JSONArray recentEvents(long gameId, int limit) {
        JSONArray array = new JSONArray();
        List<GameEventEntity> recent = events.findTop50ByGameIdOrderBySeqDesc(gameId);
        for (GameEventEntity event : recent) {
            if (array.length() >= limit) {
                break;
            }
            array.put(eventJson(event));
        }
        return array;
    }

    // ------------------------------------------------------------------ Interni

    private int windowSecondsFor(String type) {
        if (type == null) {
            return props.getAnswerWindowSeconds();
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "BOMBA" -> Math.min(props.getAnswerWindowSeconds(), 105);
            case "SPEED_RUSH" -> Math.min(props.getAnswerWindowSeconds(), 75);
            case "TIME_BUZZER" -> Math.min(props.getAnswerWindowSeconds(), 60);
            // Tre giri su tutti i tavoli: il round deve restare aperto per
            // l'intera partita, altrimenti dopo un refresh lo snapshot risulta
            // scaduto e il telefono non ritrova il Black Jack.
            case "BLACKJACK" -> 900;
            default -> props.getAnswerWindowSeconds();
        };
    }

    private GameStateEntity newState(long gameId) {
        GameStateEntity fresh = new GameStateEntity();
        fresh.setGameId(gameId);
        fresh.setVersion(1);
        fresh.setSeq(0);
        fresh.setStatus("CREATED");
        fresh.setUpdatedAt(System.currentTimeMillis());
        return fresh;
    }

    private JSONObject roundJson(GameRound round) {
        JSONObject json = new JSONObject();
        json.put("id", round.getId());
        json.put("type", round.getType() == null ? null : round.getType().name());
        json.put("status", round.getStatus() == null ? null : round.getStatus().name());
        json.put("roundIndex", round.getRoundIndex());
        json.put("payload", parseOrNull(round.getPayload()));
        return json;
    }

    private JSONObject eventJson(GameEventEntity event) {
        return new JSONObject()
                .put("seq", event.getSeq())
                .put("eventId", event.getEventId())
                .put("type", event.getType())
                .put("payload", parseOrNull(event.getPayload()))
                .put("roundKey", event.getRoundKey())
                .put("deviceId", event.getDeviceId())
                .put("createdAt", event.getCreatedAt());
    }

    private Object parseOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return JSONObject.NULL;
        }
        try {
            String trimmed = raw.trim();
            if (trimmed.startsWith("{")) {
                return new JSONObject(trimmed);
            }
            if (trimmed.startsWith("[")) {
                return new JSONArray(trimmed);
            }
        } catch (Exception ignored) {
            // Payload non JSON (testo semplice): si restituisce la stringa.
        }
        return raw;
    }
}
