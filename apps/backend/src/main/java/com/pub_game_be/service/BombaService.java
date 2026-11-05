package com.pub_game_be.service;

import jakarta.annotation.PreDestroy;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
 * Bomba: l'unico round in cui due tavoli si passano qualcosa.
 *
 * Lo stato vive sul server perché le micce, le scadenze delle domande e i
 * passaggi devono restare coerenti anche se la TV perde un secondo o un
 * telefono si ricarica. I client ricevono solo domande e opzioni, mai la
 * risposta corretta, e non ricevono mai il valore esatto della miccia.
 */
@Service
public class BombaService {

    public static final int ROUND_SECONDS = 90;
    private static final int BASE_SCORE = 1000;
    private static final int PASS_BONUS = 50;
    private static final int MAX_PASS_BONUS = 500;
    private static final int EXPLOSION_PENALTY = 300;
    private static final int PASS_SECONDS = 5;
    private static final int FUSE_PENALTY_SECONDS = 3;
    private static final int QUESTIONS_PER_REFILL = 80;

    private record BombaEvent(long id, String kind, String player, int bombId) {
    }

    private static final class Bomb {
        private final int id;
        private String holder;
        private String lastPasser;
        private long fuseEndsAt;
        private long questionEndsAt;
        private QuestionBankService.BombaQuestion question;
        private List<String> passOptions = List.of();
        private long passEndsAt;
        private ScheduledFuture<?> fuseTask;
        private ScheduledFuture<?> questionTask;
        private ScheduledFuture<?> passTask;

        private Bomb(int id) {
            this.id = id;
        }
    }

    private static final class Round {
        private final long gameId;
        private final int act;
        private final List<String> players;
        private final int bombCount;
        private final Random random = new Random();
        private final Map<String, Integer> scores = new LinkedHashMap<>();
        private final Map<String, Integer> passes = new LinkedHashMap<>();
        private final Map<String, Integer> held = new LinkedHashMap<>();
        private final List<Bomb> bombs = new ArrayList<>();
        private final Deque<QuestionBankService.BombaQuestion> questions = new ArrayDeque<>();
        private final Set<String> usedQuestionIds = new HashSet<>();
        private final List<BombaEvent> events = new ArrayList<>();
        private long endsAt;
        private long pausedAt;
        private boolean active = true;
        private boolean paused;
        private int nextBombId = 1;
        private long eventSeq;
        private String lastExplodedHolder;
        private ScheduledFuture<?> endTask;

        private Round(long gameId, int act, List<String> players, int bombCount) {
            this.gameId = gameId;
            this.act = act;
            this.players = players;
            this.bombCount = bombCount;
            for (String player : players) {
                scores.put(player, BASE_SCORE);
                passes.put(player, 0);
                held.put(player, 0);
            }
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
        reset(gameId);

        Round round = new Round(gameId, act, players, bombCountFor(players.size()));
        round.questions.addAll(questionBank.bombaQuestions(act, QUESTIONS_PER_REFILL));
        round.endsAt = System.currentTimeMillis() + ROUND_SECONDS * 1000L;

        List<String> holders = new ArrayList<>(players);
        Collections.shuffle(holders, round.random);
        for (int index = 0; index < round.bombCount; index++) {
            spawnBomb(round, holders.get(index), System.currentTimeMillis());
        }

        rounds.put(gameId, round);
        synchronized (round) {
            scheduleEnd(round);
            pushEvent(round, "start", null, 0);
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

    public JSONObject answer(long gameId, String rawPlayer, int bombId, int answerIndex) {
        Round round = requireRound(gameId);
        synchronized (round) {
            ensureActive(round);
            Bomb bomb = findBomb(round, bombId);
            String player = canonicalPlayer(round, rawPlayer);
            if (bomb == null || player == null || !same(bomb.holder, player)) {
                throw new IllegalArgumentException("Non è il tuo turno con questa bomba");
            }

            long now = System.currentTimeMillis();
            if (bomb.question == null) {
                throw new IllegalArgumentException("Nessuna domanda attiva su questa bomba");
            }
            if (now > bomb.questionEndsAt) {
                boolean exploded = penalize(round, bomb, now, "timeout");
                return result(false, null, bomb.id, exploded, true);
            }
            if (answerIndex < 0 || answerIndex >= bomb.question.options().size()) {
                throw new IllegalArgumentException("Risposta non valida");
            }

            boolean correct = bomb.question.options().get(answerIndex)
                    .equalsIgnoreCase(bomb.question.correctAnswer());
            if (!correct) {
                boolean exploded = penalize(round, bomb, now, "wrong");
                return result(false, null, bomb.id, exploded, false);
            }

            cancel(bomb.questionTask);
            bomb.questionTask = null;
            bomb.question = null;
            bomb.questionEndsAt = 0;

            List<String> targets = targetOptions(round, bomb);
            if (targets.isEmpty()) {
                // Senza un tavolo libero la bomba non può viaggiare: la miccia
                // perde comunque tre secondi, come una risposta sbagliata.
                boolean exploded = penalize(round, bomb, now, "no_target");
                return result(true, List.of(), bomb.id, exploded, false);
            }

            bomb.passOptions = targets;
            bomb.passEndsAt = now + PASS_SECONDS * 1000L;
            pushEvent(round, "correct", player, bomb.id);
            schedulePassTimeout(round, bomb);
            return result(true, targets, bomb.id, false, false);
        }
    }

    public JSONObject pass(long gameId, String rawPlayer, int bombId, String target) {
        Round round = requireRound(gameId);
        synchronized (round) {
            ensureActive(round);
            Bomb bomb = findBomb(round, bombId);
            String player = canonicalPlayer(round, rawPlayer);
            String destination = canonicalPlayer(round, target);
            long now = System.currentTimeMillis();

            if (bomb == null || player == null || !same(bomb.holder, player)) {
                throw new IllegalArgumentException("Non è il tuo turno con questa bomba");
            }
            if (bomb.passOptions.isEmpty() || destination == null || now > bomb.passEndsAt
                    || bomb.passOptions.stream().noneMatch(candidate -> same(candidate, destination))) {
                throw new IllegalArgumentException("Destinazione non più valida");
            }
            if (isHoldingAnotherBomb(round, destination, bomb)) {
                throw new IllegalArgumentException("Quel tavolo ha già una bomba");
            }

            cancel(bomb.passTask);
            bomb.passTask = null;
            bomb.passOptions = List.of();
            bomb.passEndsAt = 0;
            String passer = bomb.holder;
            bomb.lastPasser = passer;
            bomb.holder = destination;

            // Il bonus spetta al passaggio completato, non alla sola risposta
            // corretta: se il possessore non sceglie un tavolo, non guadagna.
            int passCount = round.passes.merge(passer, 1, Integer::sum);
            if (passCount <= MAX_PASS_BONUS / PASS_BONUS) {
                round.scores.merge(passer, PASS_BONUS, Integer::sum);
            }

            round.held.merge(destination, 1, Integer::sum);
            pushEvent(round, "pass", destination, bomb.id);

            bomb.question = nextQuestion(round);
            bomb.questionEndsAt = now + answerMillis(round);
            scheduleQuestionTimeout(round, bomb);
            scheduleFuse(round, bomb);

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
            cancel(round.endTask);
            for (Bomb bomb : round.bombs) {
                cancel(bomb.fuseTask);
                cancel(bomb.questionTask);
                cancel(bomb.passTask);
            }
            pushEvent(round, "pause", null, 0);
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
            round.endsAt += pauseMs;

            for (Bomb bomb : round.bombs) {
                bomb.fuseEndsAt += pauseMs;
                if (bomb.questionEndsAt > 0) {
                    bomb.questionEndsAt += pauseMs;
                }
                if (bomb.passEndsAt > 0) {
                    bomb.passEndsAt += pauseMs;
                }
                scheduleFuse(round, bomb);
                scheduleQuestionTimeout(round, bomb);
                schedulePassTimeout(round, bomb);
            }

            scheduleEnd(round);
            pushEvent(round, "resume", null, 0);
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
            cancel(round.endTask);
            for (Bomb bomb : round.bombs) {
                cancel(bomb.fuseTask);
                cancel(bomb.questionTask);
                cancel(bomb.passTask);
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }

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

    private Bomb findBomb(Round round, int bombId) {
        return round.bombs.stream().filter(bomb -> bomb.id == bombId).findFirst().orElse(null);
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

    private boolean same(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
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

    private int bombCountFor(int players) {
        if (players >= 7) {
            return 3;
        }
        if (players >= 4) {
            return 2;
        }
        return 1;
    }

    private void spawnBomb(Round round, String holder, long now) {
        Bomb bomb = new Bomb(round.nextBombId++);
        bomb.holder = holder;
        bomb.fuseEndsAt = now + fuseMillis(round);
        bomb.question = nextQuestion(round);
        bomb.questionEndsAt = now + answerMillis(round);
        round.bombs.add(bomb);
        round.held.merge(holder, 1, Integer::sum);
        pushEvent(round, "spawn", holder, bomb.id);
        scheduleFuse(round, bomb);
        scheduleQuestionTimeout(round, bomb);
    }

    private int fuseMillis(Round round) {
        int min;
        int max;
        if (round.act >= 5) {
            min = 15;
            max = 20;
        } else if (round.act >= 3) {
            min = 20;
            max = 25;
        } else {
            min = 25;
            max = 30;
        }
        return (min + round.random.nextInt(max - min + 1)) * 1000;
    }

    private int answerMillis(Round round) {
        return (round.act >= 5 ? 4 : 5) * 1000;
    }

    private QuestionBankService.BombaQuestion nextQuestion(Round round) {
        if (round.questions.isEmpty()) {
            round.questions.addAll(questionBank.bombaQuestions(round.act, QUESTIONS_PER_REFILL));
        }
        while (!round.questions.isEmpty()) {
            QuestionBankService.BombaQuestion candidate = round.questions.poll();
            if (candidate != null && round.usedQuestionIds.add(candidate.id())) {
                return candidate;
            }
        }
        // La banca non deve mai bloccare una bomba: questa domanda è solo la
        // rete di sicurezza se il file delle domande non è disponibile.
        return new QuestionBankService.BombaQuestion(
                "bomba-fallback",
                "Qual è la capitale d'Italia?",
                List.of("Roma", "Milano", "Napoli"),
                "Roma",
                "TRE_OPZIONI");
    }

    private List<String> targetOptions(Round round, Bomb bomb) {
        List<String> free = new ArrayList<>();
        for (String player : round.players) {
            if (same(player, bomb.holder) || same(player, bomb.lastPasser)) {
                continue;
            }
            if (isHoldingAnotherBomb(round, player, bomb)) {
                continue;
            }
            free.add(player);
        }

        // Con pochi tavoli liberi si accetta anche il passatore precedente:
        // meglio una scelta in meno che una bomba impossibile da passare.
        if (free.isEmpty()) {
            for (String player : round.players) {
                if (!same(player, bomb.holder) && !isHoldingAnotherBomb(round, player, bomb)) {
                    free.add(player);
                }
            }
        }
        if (free.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> selected = new LinkedHashSet<>();
        int holderIndex = indexOf(round.players, bomb.holder);

        // 1. Il tavolo immediatamente davanti al possessore: non sempre il
        // primo in classifica, così nessuno viene preso di mira da tutti.
        if (holderIndex > 0) {
            addIfFree(selected, round.players.get(holderIndex - 1), free);
        } else if (holderIndex + 1 < round.players.size()) {
            addIfFree(selected, round.players.get(holderIndex + 1), free);
        }

        // 2. Un tavolo vicino in classifica, entro due posizioni.
        List<String> nearby = new ArrayList<>();
        for (int delta = -2; delta <= 2; delta++) {
            if (delta == 0) {
                continue;
            }
            int index = holderIndex + delta;
            if (index >= 0 && index < round.players.size()) {
                String candidate = round.players.get(index);
                if (free.contains(candidate) && !selected.contains(candidate)) {
                    nearby.add(candidate);
                }
            }
        }
        Collections.shuffle(nearby, round.random);
        if (!nearby.isEmpty()) {
            selected.add(nearby.get(0));
        }

        // 3. Chi ha tenuto meno bombe, per non concentrare il gioco sempre
        // sugli stessi tavoli.
        int minimumHeld = free.stream()
                .mapToInt(player -> round.held.getOrDefault(player, 0))
                .min()
                .orElse(0);
        List<String> leastHeld = free.stream()
                .filter(player -> round.held.getOrDefault(player, 0) == minimumHeld)
                .toList();
        if (!leastHeld.isEmpty()) {
            selected.add(leastHeld.get(round.random.nextInt(leastHeld.size())));
        }

        List<String> shuffledFree = new ArrayList<>(free);
        Collections.shuffle(shuffledFree, round.random);
        for (String candidate : shuffledFree) {
            if (selected.size() >= 3) {
                break;
            }
            selected.add(candidate);
        }

        return selected.stream().limit(3).toList();
    }

    private void addIfFree(LinkedHashSet<String> selected, String candidate, List<String> free) {
        if (candidate != null && free.contains(candidate)) {
            selected.add(candidate);
        }
    }

    private int indexOf(List<String> players, String player) {
        for (int index = 0; index < players.size(); index++) {
            if (same(players.get(index), player)) {
                return index;
            }
        }
        return -1;
    }

    private boolean isHoldingAnotherBomb(Round round, String player, Bomb current) {
        return round.bombs.stream()
                .anyMatch(bomb -> bomb != current && same(bomb.holder, player));
    }

    private boolean penalize(Round round, Bomb bomb, long now, String kind) {
        cancel(bomb.questionTask);
        cancel(bomb.passTask);
        bomb.questionTask = null;
        bomb.passTask = null;
        bomb.question = null;
        bomb.questionEndsAt = 0;
        bomb.passOptions = List.of();
        bomb.passEndsAt = 0;
        bomb.fuseEndsAt -= FUSE_PENALTY_SECONDS * 1000L;
        pushEvent(round, kind, bomb.holder, bomb.id);

        if (bomb.fuseEndsAt <= now) {
            explode(round, bomb);
            return true;
        }

        bomb.question = nextQuestion(round);
        bomb.questionEndsAt = now + answerMillis(round);
        pushEvent(round, "question", bomb.holder, bomb.id);
        scheduleQuestionTimeout(round, bomb);
        scheduleFuse(round, bomb);
        return false;
    }

    private void explode(Round round, Bomb bomb) {
        if (!round.active || !round.bombs.contains(bomb)) {
            return;
        }

        cancel(bomb.fuseTask);
        cancel(bomb.questionTask);
        cancel(bomb.passTask);
        round.bombs.remove(bomb);

        String holder = bomb.holder;
        round.lastExplodedHolder = holder;
        int score = Math.max(0, round.scores.getOrDefault(holder, BASE_SCORE) - EXPLOSION_PENALTY);
        round.scores.put(holder, score);
        pushEvent(round, "explode", holder, bomb.id);

        long now = System.currentTimeMillis();
        if (round.endsAt - now >= 10_000L) {
            scheduler.schedule(() -> {
                synchronized (round) {
                    if (!round.active || round.paused || round.endsAt - System.currentTimeMillis() < 10_000L) {
                        return;
                    }
                    if (round.bombs.size() >= round.bombCount) {
                        return;
                    }
                    String nextHolder = chooseSpawnHolder(round);
                    if (nextHolder != null) {
                        spawnBomb(round, nextHolder, System.currentTimeMillis());
                    }
                }
            }, 1500, TimeUnit.MILLISECONDS);
        }
    }

    private String chooseSpawnHolder(Round round) {
        List<String> available = new ArrayList<>();
        for (String player : round.players) {
            if (same(player, round.lastExplodedHolder)) {
                continue;
            }
            if (round.bombs.stream().anyMatch(bomb -> same(bomb.holder, player))) {
                continue;
            }
            available.add(player);
        }
        if (available.isEmpty()) {
            return null;
        }
        int minimumHeld = available.stream()
                .mapToInt(player -> round.held.getOrDefault(player, 0))
                .min()
                .orElse(0);
        List<String> leastHeld = available.stream()
                .filter(player -> round.held.getOrDefault(player, 0) == minimumHeld)
                .toList();
        return leastHeld.get(round.random.nextInt(leastHeld.size()));
    }

    private void scheduleEnd(Round round) {
        cancel(round.endTask);
        long delay = Math.max(0, round.endsAt - System.currentTimeMillis());
        round.endTask = scheduler.schedule(() -> {
            synchronized (round) {
                if (round.active && rounds.get(round.gameId) == round) {
                    endRound(round);
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void endRound(Round round) {
        if (!round.active) {
            return;
        }
        round.active = false;
        round.paused = false;
        cancel(round.endTask);
        for (Bomb bomb : round.bombs) {
            cancel(bomb.fuseTask);
            cancel(bomb.questionTask);
            cancel(bomb.passTask);
            bomb.question = null;
            bomb.questionEndsAt = 0;
            bomb.passOptions = List.of();
            bomb.passEndsAt = 0;
        }
        pushEvent(round, "end", null, 0);
    }

    private void scheduleFuse(Round round, Bomb bomb) {
        cancel(bomb.fuseTask);
        if (!round.active || round.paused || !round.bombs.contains(bomb)) {
            return;
        }
        long delay = Math.max(0, bomb.fuseEndsAt - System.currentTimeMillis());
        bomb.fuseTask = scheduler.schedule(() -> {
            synchronized (round) {
                if (round.active && !round.paused && round.bombs.contains(bomb)
                        && bomb.fuseEndsAt <= System.currentTimeMillis()) {
                    explode(round, bomb);
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void scheduleQuestionTimeout(Round round, Bomb bomb) {
        cancel(bomb.questionTask);
        if (!round.active || round.paused || bomb.question == null || !round.bombs.contains(bomb)) {
            return;
        }
        long delay = Math.max(0, bomb.questionEndsAt - System.currentTimeMillis());
        bomb.questionTask = scheduler.schedule(() -> {
            synchronized (round) {
                if (round.active && !round.paused && round.bombs.contains(bomb)
                        && bomb.question != null && bomb.questionEndsAt <= System.currentTimeMillis()) {
                    penalize(round, bomb, System.currentTimeMillis(), "timeout");
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void schedulePassTimeout(Round round, Bomb bomb) {
        cancel(bomb.passTask);
        if (!round.active || round.paused || bomb.passOptions.isEmpty() || !round.bombs.contains(bomb)) {
            return;
        }
        long delay = Math.max(0, bomb.passEndsAt - System.currentTimeMillis());
        bomb.passTask = scheduler.schedule(() -> {
            synchronized (round) {
                if (round.active && !round.paused && round.bombs.contains(bomb)
                        && !bomb.passOptions.isEmpty() && bomb.passEndsAt <= System.currentTimeMillis()) {
                    penalize(round, bomb, System.currentTimeMillis(), "pass_timeout");
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void cancel(ScheduledFuture<?> future) {
        if (future != null) {
            future.cancel(false);
        }
    }

    private void pushEvent(Round round, String kind, String player, int bombId) {
        round.events.add(new BombaEvent(++round.eventSeq, kind, player, bombId));
        while (round.events.size() > 8) {
            round.events.remove(0);
        }
    }

    private String danger(Round round, Bomb bomb, long clock) {
        long remaining = bomb.fuseEndsAt - clock;
        int medium;
        int high;
        if (round.act >= 5) {
            medium = 8_000;
            high = 3_000;
        } else {
            medium = 12_000;
            high = 5_000;
        }
        if (remaining <= high) {
            return "HIGH";
        }
        if (remaining <= medium) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private JSONObject result(boolean correct, List<String> passOptions, int bombId,
            boolean exploded, boolean timeout) {
        JSONObject result = new JSONObject();
        result.put("correct", correct);
        result.put("bombId", bombId);
        result.put("exploded", exploded);
        result.put("timeout", timeout);
        result.put("fusePenalty", correct ? 0 : FUSE_PENALTY_SECONDS);
        result.put("passOptions", passOptions == null ? new JSONArray() : new JSONArray(passOptions));
        return result;
    }

    private JSONObject emptyState(long gameId) {
        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", gameId);
        state.put("act", 1);
        state.put("active", false);
        state.put("paused", false);
        state.put("remainingSeconds", 0);
        state.put("bombs", new JSONArray());
        state.put("scores", new JSONObject());
        state.put("passes", new JSONObject());
        state.put("heldCounts", new JSONObject());
        state.put("events", new JSONArray());
        state.put("you", JSONObject.NULL);
        return state;
    }

    private JSONObject publicState(Round round, String rawPlayer, long now) {
        long clock = round.paused ? round.pausedAt : now;
        JSONObject state = new JSONObject();
        state.put("type", "BOMBA");
        state.put("gameId", round.gameId);
        state.put("act", round.act);
        state.put("active", round.active);
        state.put("paused", round.paused);
        state.put("remainingSeconds", round.active ? Math.max(0, (round.endsAt - clock + 999) / 1000) : 0);

        JSONArray bombs = new JSONArray();
        for (Bomb bomb : round.bombs) {
            JSONObject view = new JSONObject();
            view.put("id", bomb.id);
            view.put("holder", bomb.holder);
            view.put("danger", danger(round, bomb, clock));
            if (bomb.question != null) {
                view.put("question", bomb.question.question());
                view.put("options", new JSONArray(bomb.question.options()));
                view.put("questionKind", bomb.question.kind());
                view.put("questionSecondsLeft",
                        Math.max(0, (bomb.questionEndsAt - clock + 999) / 1000));
            }
            bombs.put(view);
        }
        state.put("bombs", bombs);
        state.put("scores", new JSONObject(round.scores));
        state.put("passes", new JSONObject(round.passes));
        state.put("heldCounts", new JSONObject(round.held));

        JSONArray events = new JSONArray();
        for (BombaEvent event : round.events) {
            events.put(new JSONObject()
                    .put("id", event.id())
                    .put("kind", event.kind())
                    .put("player", event.player() == null ? JSONObject.NULL : event.player())
                    .put("bombId", event.bombId()));
        }
        state.put("events", events);

        String player = canonicalPlayer(round, rawPlayer);
        Bomb heldBomb = player == null ? null : round.bombs.stream()
                .filter(bomb -> same(bomb.holder, player))
                .findFirst()
                .orElse(null);
        if (heldBomb == null) {
            state.put("you", JSONObject.NULL);
            return state;
        }

        JSONObject you = new JSONObject();
        you.put("bombId", heldBomb.id);
        you.put("holder", heldBomb.holder);
        you.put("danger", danger(round, heldBomb, clock));
        you.put("score", round.scores.getOrDefault(player, BASE_SCORE));
        you.put("passes", round.passes.getOrDefault(player, 0));
        if (heldBomb.question != null) {
            you.put("question", heldBomb.question.question());
            you.put("options", new JSONArray(heldBomb.question.options()));
            you.put("questionKind", heldBomb.question.kind());
            you.put("questionSecondsLeft",
                    Math.max(0, (heldBomb.questionEndsAt - clock + 999) / 1000));
        }
        if (!heldBomb.passOptions.isEmpty()) {
            you.put("passOptions", new JSONArray(heldBomb.passOptions));
            you.put("passSecondsLeft",
                    Math.max(0, (heldBomb.passEndsAt - clock + 999) / 1000));
        }
        state.put("you", you);
        return state;
    }
}
