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
 * Bomba — gioco a tabellone in stile "Scossa", solo a malus.
 *
 * <p>Con {@code n} squadre il tabellone ha {@code 2n + n/2} caselle e
 * {@code ceil(n/3)} bombe. La domanda è sempre "quale tra queste NON
 * appartiene a…?": le caselle sono elementi veri della categoria, le bombe sono
 * gli intrusi. Ogni ondata dura 15 secondi e ogni squadra sceglie una casella;
 * chi sceglie la stessa casella condivide l'esito. Alla rivelazione le caselle
 * sicure si salvano, le bombe esplodono e costano 200 punti a chi le ha scelte.
 * Le bombe mai scelte restano sul tabellone e a fine round vengono disarmate.
 *
 * <p>Lo stato vive sul server perché le scadenze delle ondate e le scelte dei
 * telefoni devono restare coerenti anche se la TV si ricarica. La posizione
 * delle bombe non esce dal server finché l'ondata non viene rivelata.
 */
@Service
public class BombaService {

    public static final int WAVES = 3;
    public static final int WAVE_SECONDS = 15;
    public static final int REVEAL_SECONDS = 5;
    public static final int BOMB_PENALTY = 200;

    /** Casella del tabellone: la posizione delle bombe resta privata. */
    private record Cell(int id, String label, boolean bomb) {
    }

    private static final class Wave {
        private final int index;
        private final List<Cell> cells;
        private final Map<String, Integer> picks = new LinkedHashMap<>();
        private final Map<String, Integer> hitPlayers = new LinkedHashMap<>();
        private boolean revealed;

        private Wave(int index, List<Cell> cells) {
            this.index = index;
            this.cells = cells;
        }

        private Cell cell(int id) {
            return cells.stream().filter(cell -> cell.id() == id).findFirst().orElse(null);
        }
    }

    private static final class Round {
        private final long gameId;
        private final int act;
        private final List<String> players;
        private final int cellsPerWave;
        private final int bombsPerWave;
        private final String prompt;
        private final List<String> safePool;
        private final List<String> bombPool;
        private final List<Wave> waves = new ArrayList<>();
        private final Map<String, Integer> penalties = new LinkedHashMap<>();
        private final Random random = new Random();

        private int waveIndex;
        private String phase = "PICK";
        private long deadline;
        private long pausedAt;
        private boolean active = true;
        private boolean paused;
        private ScheduledFuture<?> task;

        private Round(long gameId, int act, List<String> players, int cellsPerWave, int bombsPerWave,
                String prompt, List<String> safePool, List<String> bombPool) {
            this.gameId = gameId;
            this.act = act;
            this.players = players;
            this.cellsPerWave = cellsPerWave;
            this.bombsPerWave = bombsPerWave;
            this.prompt = prompt;
            this.safePool = safePool;
            this.bombPool = bombPool;
            for (String player : players) {
                penalties.put(player, 0);
            }
        }

        private Wave currentWave() {
            return waves.isEmpty() ? null : waves.get(waves.size() - 1);
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
        int cells = cellsFor(players.size());
        int bombs = bombsFor(players.size());
        QuestionBankService.ScossaBoard board = questionBank.scossaBoard(cells, bombs);

        reset(gameId);

        Round round = new Round(gameId, act, players, cells, bombs,
                board.prompt(), board.safe(), board.intruders());
        rounds.put(gameId, round);

        synchronized (round) {
            nextWave(round);
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

    /** Scelta di una casella da parte di una squadra, una per ondata. */
    public JSONObject pick(long gameId, String rawPlayer, int cellId) {
        Round round = requireRound(gameId);
        synchronized (round) {
            ensureActive(round);
            String player = canonicalPlayer(round, rawPlayer);
            if (player == null) {
                throw new IllegalArgumentException("Giocatore non riconosciuto");
            }

            Wave wave = round.currentWave();
            if (wave == null || !"PICK".equals(round.phase) || wave.revealed) {
                throw new IllegalArgumentException("L'ondata è chiusa");
            }
            if (wave.picks.containsKey(player)) {
                throw new IllegalArgumentException("Hai già scelto in questa ondata");
            }
            if (wave.cell(cellId) == null) {
                throw new IllegalArgumentException("Casella non valida");
            }

            wave.picks.put(player, cellId);
            if (wave.picks.size() >= round.players.size()) {
                revealWave(round);
            }
            return publicState(round, player, System.currentTimeMillis());
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
            long pauseMs = Math.max(0, now - round.pausedAt);
            round.paused = false;
            round.deadline += pauseMs;
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

    // ------------------------------------------------------------------ ondate

    private void nextWave(Round round) {
        Wave wave = buildWave(round);
        round.waves.add(wave);
        round.phase = "PICK";
        round.deadline = System.currentTimeMillis() + WAVE_SECONDS * 1000L;
        scheduleDeadline(round);
    }

    private Wave buildWave(Round round) {
        List<Cell> cells = new ArrayList<>();
        int safeNeeded = Math.max(1, round.cellsPerWave - round.bombsPerWave);

        List<String> safe = new ArrayList<>(round.safePool);
        Collections.shuffle(safe, round.random);
        for (int index = 0; index < Math.min(safeNeeded, safe.size()); index++) {
            cells.add(new Cell(cells.size() + 1, safe.get(index), false));
        }

        List<String> bombs = new ArrayList<>(round.bombPool);
        Collections.shuffle(bombs, round.random);
        for (int index = 0; index < round.bombsPerWave; index++) {
            cells.add(new Cell(cells.size() + 1, bombs.get(index % bombs.size()), true));
        }

        Collections.shuffle(cells, round.random);
        List<Cell> numbered = new ArrayList<>();
        for (int index = 0; index < cells.size(); index++) {
            Cell cell = cells.get(index);
            numbered.add(new Cell(index + 1, cell.label(), cell.bomb()));
        }
        return new Wave(round.waveIndex + 1, numbered);
    }

    private void revealWave(Round round) {
        Wave wave = round.currentWave();
        if (wave == null || wave.revealed) {
            return;
        }
        wave.revealed = true;
        round.phase = "REVEAL";
        round.deadline = System.currentTimeMillis() + REVEAL_SECONDS * 1000L;

        for (Map.Entry<String, Integer> entry : wave.picks.entrySet()) {
            Cell cell = wave.cell(entry.getValue());
            if (cell != null && cell.bomb()) {
                wave.hitPlayers.put(entry.getKey(), 1);
                round.penalties.merge(entry.getKey(), -BOMB_PENALTY, Integer::sum);
            }
        }
        scheduleDeadline(round);
    }

    private void advance(Round round) {
        if (round.waveIndex + 1 >= WAVES) {
            round.phase = "END";
            round.active = false;
            round.deadline = 0;
            cancel(round.task);
            return;
        }
        round.waveIndex++;
        nextWave(round);
    }

    private void scheduleDeadline(Round round) {
        cancel(round.task);
        if (!round.active || round.paused) {
            return;
        }
        long delay = Math.max(0, round.deadline - System.currentTimeMillis());
        round.task = scheduler.schedule(() -> {
            synchronized (round) {
                if (!round.active || round.paused || rounds.get(round.gameId) != round) {
                    return;
                }
                if ("PICK".equals(round.phase)) {
                    revealWave(round);
                } else if ("REVEAL".equals(round.phase)) {
                    advance(round);
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    // ------------------------------------------------------------------- stato

    private JSONObject publicState(Round round, String rawPlayer, long now) {
        long clock = round.paused ? round.pausedAt : now;
        Wave wave = round.currentWave();
        boolean revealed = wave != null && wave.revealed;

        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", round.gameId);
        state.put("act", round.act);
        state.put("active", round.active);
        state.put("paused", round.paused);
        state.put("phase", round.phase);
        state.put("wave", Math.min(round.waveIndex + 1, WAVES));
        state.put("waves", WAVES);
        state.put("waveSeconds", WAVE_SECONDS);
        state.put("prompt", round.prompt);
        state.put("secondsLeft", secondsLeft(round, clock));

        JSONArray cells = new JSONArray();
        JSONArray picks = new JSONArray();
        int remainingBombs = 0;
        if (wave != null) {
            for (Cell cell : wave.cells) {
                JSONObject view = new JSONObject();
                view.put("id", cell.id());
                view.put("label", cell.label());
                if (revealed) {
                    view.put("bomb", cell.bomb());
                }
                JSONArray owners = new JSONArray();
                for (Map.Entry<String, Integer> entry : wave.picks.entrySet()) {
                    if (entry.getValue() == cell.id()) {
                        owners.put(entry.getKey());
                    }
                }
                view.put("pickedBy", owners);
                cells.put(view);
            }

            for (Map.Entry<String, Integer> entry : wave.picks.entrySet()) {
                Cell cell = wave.cell(entry.getValue());
                picks.put(new JSONObject()
                        .put("player", entry.getKey())
                        .put("cellId", entry.getValue())
                        .put("label", cell == null ? "" : cell.label()));
            }

            if (revealed) {
                for (Cell cell : wave.cells) {
                    if (cell.bomb() && wave.picks.values().stream().noneMatch(id -> id == cell.id())) {
                        remainingBombs++;
                    }
                }
            }
        }
        state.put("cells", cells);
        state.put("picks", picks);
        state.put("remainingBombs", remainingBombs);
        state.put("defused", new JSONArray(round.active ? List.of() : defusedLabels(round)));
        state.put("penalties", new JSONObject(round.penalties));

        JSONArray hits = new JSONArray();
        if (wave != null && revealed) {
            for (String player : wave.hitPlayers.keySet()) {
                hits.put(new JSONObject()
                        .put("player", player)
                        .put("bombs", 1)
                        .put("penalty", -BOMB_PENALTY));
            }
        }
        state.put("hits", hits);

        String player = canonicalPlayer(round, rawPlayer);
        if (player == null || wave == null || !wave.picks.containsKey(player)) {
            state.put("you", JSONObject.NULL);
            return state;
        }

        int cellId = wave.picks.get(player);
        Cell chosen = wave.cell(cellId);
        JSONObject you = new JSONObject();
        you.put("cellId", cellId);
        you.put("label", chosen == null ? "" : chosen.label());
        you.put("hit", revealed && chosen != null && chosen.bomb());
        you.put("penalty", round.penalties.getOrDefault(player, 0));
        state.put("you", you);
        return state;
    }

    private long secondsLeft(Round round, long clock) {
        if (!round.active || round.deadline <= 0) {
            return 0;
        }
        return Math.max(0, (round.deadline - clock + 999) / 1000);
    }

    /** Bombe mai scelte in nessuna ondata: a fine round vengono disarmate. */
    private List<String> defusedLabels(Round round) {
        List<String> labels = new ArrayList<>();
        for (Wave wave : round.waves) {
            if (!wave.revealed) {
                continue;
            }
            for (Cell cell : wave.cells) {
                if (!cell.bomb()) {
                    continue;
                }
                boolean chosen = wave.picks.containsValue(cell.id());
                // Un'intrusa può uscire in più ondate: in TV compare una volta.
                if (!chosen && labels.stream().noneMatch(label -> label.equalsIgnoreCase(cell.label()))) {
                    labels.add(cell.label());
                }
            }
        }
        return labels;
    }

    private JSONObject emptyState(long gameId) {
        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", gameId);
        state.put("act", 1);
        state.put("active", false);
        state.put("paused", false);
        state.put("phase", "END");
        state.put("wave", 0);
        state.put("waves", WAVES);
        state.put("waveSeconds", WAVE_SECONDS);
        state.put("prompt", "");
        state.put("secondsLeft", 0);
        state.put("cells", new JSONArray());
        state.put("picks", new JSONArray());
        state.put("hits", new JSONArray());
        state.put("defused", new JSONArray());
        state.put("penalties", new JSONObject());
        state.put("remainingBombs", 0);
        state.put("you", JSONObject.NULL);
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
