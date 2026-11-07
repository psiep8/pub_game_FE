package com.pub_game_be.service;

import jakarta.annotation.PreDestroy;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Bomba — tabellone a turni, solo a malus.
 *
 * <p>La TV mostra una domanda con tutte le opzioni: quasi tutte vere, tranne
 * {@code ceil(n/3)} false (le "bombe"). Si gioca a turni, una squadra alla
 * volta: la squadra di turno dice un'opzione, poi passa alla successiva sia se
 * la casella è vera sia se è una bomba.
 *
 * <p>Una casella vera non cambia i punti; una bomba costa 200 punti alla
 * squadra che l'ha scelta e la toglie dal round. Il round finisce quando
 * esauriscono le caselle o quando tutte le squadre sono fuori. Le bombe mai
 * scelte vengono mostrate e disarmate senza conseguenze.
 *
 * <p>La posizione delle bombe resta sul server: esce solo per le caselle già
 * scelte (e a fine round, per il disarmo).
 */
@Service
public class BombaService {

    public static final int TURN_SECONDS = 20;
    public static final int BOMB_PENALTY = 200;

    private record Cell(int id, String label, boolean bomb) {
    }

    private static final class Round {
        private final long gameId;
        private final int act;
        private final List<String> players;
        private final String prompt;
        private final List<Cell> cells;
        private final Map<Integer, String> pickedBy = new LinkedHashMap<>();
        private final List<String> eliminated = new ArrayList<>();
        private final Map<String, Integer> penalties = new LinkedHashMap<>();

        private int turnIndex;
        private String phase = "TURN";
        private long turnDeadline;
        private long pausedAt;
        private boolean active = true;
        private boolean paused;
        private ScheduledFuture<?> task;
        private long eventSeq;
        private JSONObject lastEvent;

        private Round(long gameId, int act, List<String> players, String prompt, List<Cell> cells) {
            this.gameId = gameId;
            this.act = act;
            this.players = players;
            this.prompt = prompt;
            this.cells = cells;
            for (String player : players) {
                penalties.put(player, 0);
            }
        }

        private String currentPlayer() {
            return turnIndex >= 0 && turnIndex < players.size() ? players.get(turnIndex) : null;
        }
    }

    private final QuestionBankService questionBank;
    private final Map<Long, Round> rounds = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "pubgame-bomba");
        thread.setDaemon(true);
        return thread;
    });

    public BombaService(QuestionBankService questionBank) {
        this.questionBank = questionBank;
    }

    public JSONObject start(long gameId, List<String> rawPlayers, int requestedAct) {
        List<String> players = normalizePlayers(rawPlayers);
        if (players.size() < 2) {
            throw new IllegalArgumentException("Servono almeno 2 squadre per giocare a Bomba");
        }

        int act = Math.max(1, Math.min(5, requestedAct));
        QuestionBankService.ScossaBoard board = questionBank.scossaBoard(
                cellsFor(players.size()), bombsFor(players.size()));

        reset(gameId);
        Round round = new Round(gameId, act, players, board.prompt(), buildCells(board, players.size()));
        rounds.put(gameId, round);

        synchronized (round) {
            round.turnIndex = 0;
            round.turnDeadline = System.currentTimeMillis() + TURN_SECONDS * 1000L;
            scheduleDeadline(round);
            return publicState(round, null, System.currentTimeMillis());
        }
    }

    public JSONObject state(long gameId, String player) {
        Round round = rounds.get(gameId);
        if (round == null) {
            return emptyState(gameId);
        }
        synchronized (round) {
            return publicState(round, player, System.currentTimeMillis());
        }
    }

    /** La squadra di turno dice un'opzione: poi tocca alla successiva. */
    public JSONObject pick(long gameId, String rawPlayer, int cellId) {
        Round round = requireRound(gameId);
        synchronized (round) {
            ensureActive(round);

            String player = canonicalPlayer(round, rawPlayer);
            String current = round.currentPlayer();
            if (player == null) {
                throw new IllegalArgumentException("Giocatore non riconosciuto");
            }
            if (current == null || !current.equalsIgnoreCase(player)) {
                throw new IllegalArgumentException("Non è il tuo turno");
            }

            Cell cell = findCell(round, cellId);
            if (cell == null) {
                throw new IllegalArgumentException("Casella non valida");
            }
            if (round.pickedBy.containsKey(cellId)) {
                throw new IllegalArgumentException("Casella già scelta");
            }

            long now = System.currentTimeMillis();
            round.pickedBy.put(cellId, player);
            pushEvent(round, cell.bomb() ? "bomb" : "safe", player, cell.label());

            if (cell.bomb()) {
                round.penalties.merge(player, -BOMB_PENALTY, Integer::sum);
                round.eliminated.add(player);
            }

            advance(round, now);
            return publicState(round, player, now);
        }
    }

    public JSONObject pause(long gameId) {
        Round round = requireRound(gameId);
        synchronized (round) {
            if (!round.active || round.paused) {
                return publicState(round, null, System.currentTimeMillis());
            }
            round.paused = true;
            round.pausedAt = System.currentTimeMillis();
            cancel(round.task);
            return publicState(round, null, round.pausedAt);
        }
    }

    public JSONObject resume(long gameId) {
        Round round = requireRound(gameId);
        synchronized (round) {
            if (!round.active || !round.paused) {
                return publicState(round, null, System.currentTimeMillis());
            }
            long now = System.currentTimeMillis();
            round.paused = false;
            round.turnDeadline += Math.max(0, now - round.pausedAt);
            scheduleDeadline(round);
            return publicState(round, null, now);
        }
    }

    public void reset(long gameId) {
        Round round = rounds.remove(gameId);
        if (round == null) {
            return;
        }
        synchronized (round) {
            round.active = false;
            cancel(round.task);
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }

    // ------------------------------------------------------------------- turni

    private List<Cell> buildCells(QuestionBankService.ScossaBoard board, int players) {
        List<Cell> options = new ArrayList<>();

        List<String> safe = new ArrayList<>(board.safe());
        Collections.shuffle(safe);
        for (String label : safe) {
            options.add(new Cell(options.size() + 1, label, false));
        }

        List<String> intruders = new ArrayList<>(board.intruders());
        Collections.shuffle(intruders);
        for (String label : intruders) {
            options.add(new Cell(options.size() + 1, label, true));
        }

        Collections.shuffle(options);
        List<Cell> numbered = new ArrayList<>();
        for (int index = 0; index < options.size(); index++) {
            numbered.add(new Cell(index + 1, options.get(index).label(), options.get(index).bomb()));
        }
        return numbered;
    }

    private void advance(Round round, long now) {
        if (round.pickedBy.size() >= round.cells.size()
                || round.players.stream().allMatch(round.eliminated::contains)) {
            finish(round);
            return;
        }

        int next = nextActiveIndex(round);
        if (next < 0) {
            finish(round);
            return;
        }
        round.turnIndex = next;
        round.turnDeadline = now + TURN_SECONDS * 1000L;
        scheduleDeadline(round);
    }

    /** Prossima squadra ancora in gioco, saltando chi ha preso una bomba. */
    private int nextActiveIndex(Round round) {
        for (int step = 1; step <= round.players.size(); step++) {
            int index = (round.turnIndex + step) % round.players.size();
            if (!round.eliminated.contains(round.players.get(index))) {
                return index;
            }
        }
        return -1;
    }

    private void finish(Round round) {
        round.phase = "END";
        round.active = false;
        round.turnDeadline = 0;
        cancel(round.task);
    }

    private void scheduleDeadline(Round round) {
        cancel(round.task);
        if (!round.active || round.paused) {
            return;
        }
        long delay = Math.max(0, round.turnDeadline - System.currentTimeMillis());
        round.task = scheduler.schedule(() -> {
            synchronized (round) {
                if (!round.active || round.paused || rounds.get(round.gameId) != round) {
                    return;
                }
                if (round.turnDeadline > System.currentTimeMillis()) {
                    return;
                }
                // Turno scaduto: la squadra salta, nessuna penalità.
                String player = round.currentPlayer();
                pushEvent(round, "timeout", player == null ? "" : player, "");
                advance(round, System.currentTimeMillis());
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void pushEvent(Round round, String kind, String player, String label) {
        round.lastEvent = new JSONObject()
                .put("seq", ++round.eventSeq)
                .put("kind", kind)
                .put("player", player)
                .put("label", label);
    }

    // ------------------------------------------------------------------- stato

    private JSONObject publicState(Round round, String rawPlayer, long now) {
        long clock = round.paused ? round.pausedAt : now;
        boolean ended = !round.active;

        JSONArray cells = new JSONArray();
        for (Cell cell : round.cells) {
            JSONObject view = new JSONObject();
            view.put("id", cell.id());
            view.put("label", cell.label());
            boolean used = round.pickedBy.containsKey(cell.id());
            view.put("used", used);
            if (used) {
                view.put("pickedBy", round.pickedBy.get(cell.id()));
            }
            if (used || ended) {
                view.put("bomb", cell.bomb());
            }
            cells.put(view);
        }

        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", round.gameId);
        state.put("act", round.act);
        state.put("active", round.active);
        state.put("paused", round.paused);
        state.put("phase", round.phase);
        state.put("prompt", round.prompt);
        state.put("cells", cells);
        state.put("players", new JSONArray(round.players));
        state.put("eliminated", new JSONArray(round.eliminated));
        state.put("penalties", new JSONObject(round.penalties));
        state.put("turn", round.currentPlayer() == null ? "" : round.currentPlayer());
        state.put("turnSeconds", TURN_SECONDS);
        state.put("secondsLeft", round.active
                ? Math.max(0, (round.turnDeadline - clock + 999) / 1000)
                : 0);
        state.put("lastEvent", round.lastEvent == null ? JSONObject.NULL : round.lastEvent);

        String player = canonicalPlayer(round, rawPlayer);
        JSONObject you = new JSONObject();
        you.put("yourTurn", player != null && player.equalsIgnoreCase(round.currentPlayer() == null ? "" : round.currentPlayer()));
        you.put("penalty", player == null ? 0 : round.penalties.getOrDefault(player, 0));
        you.put("out", player != null && round.eliminated.contains(player));
        state.put("you", you);
        return state;
    }

    private JSONObject emptyState(long gameId) {
        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", gameId);
        state.put("act", 1);
        state.put("active", false);
        state.put("paused", false);
        state.put("phase", "END");
        state.put("prompt", "");
        state.put("cells", new JSONArray());
        state.put("players", new JSONArray());
        state.put("eliminated", new JSONArray());
        state.put("penalties", new JSONObject());
        state.put("turn", "");
        state.put("turnSeconds", TURN_SECONDS);
        state.put("secondsLeft", 0);
        state.put("lastEvent", JSONObject.NULL);
        state.put("you", new JSONObject().put("yourTurn", false).put("penalty", 0).put("out", false));
        return state;
    }

    // ------------------------------------------------------------------ utility

    private void ensureActive(Round round) {
        if (!round.active) {
            throw new IllegalArgumentException("Il round Bomba è finito");
        }
        if (round.paused) {
            throw new IllegalArgumentException("Il round Bomba è in pausa");
        }
    }

    private Round requireRound(long gameId) {
        Round round = rounds.get(gameId);
        if (round == null) {
            throw new IllegalArgumentException("Nessun round Bomba attivo");
        }
        return round;
    }

    private Cell findCell(Round round, int cellId) {
        return round.cells.stream().filter(cell -> cell.id() == cellId).findFirst().orElse(null);
    }

    private String canonicalPlayer(Round round, String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return round.players.stream()
                .filter(player -> player.equalsIgnoreCase(normalized))
                .findFirst()
                .orElse(null);
    }

    private List<String> normalizePlayers(List<String> rawPlayers) {
        if (rawPlayers == null) {
            return List.of();
        }
        List<String> players = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String raw : rawPlayers) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String player = raw.trim();
            if (seen.add(player.toLowerCase(Locale.ROOT))) {
                players.add(player);
            }
        }
        return List.copyOf(players);
    }

    private void cancel(ScheduledFuture<?> future) {
        if (future != null) {
            future.cancel(false);
        }
    }

    /** Tabellone: 2n + n/2 caselle, come da brief (8 squadre = 20). */
    static int cellsFor(int players) {
        return 2 * players + players / 2;
    }

    /** Bombe: ceil(n/3), come da brief (8 squadre = 3). */
    static int bombsFor(int players) {
        return Math.max(1, (int) Math.ceil(players / 3.0));
    }
}
