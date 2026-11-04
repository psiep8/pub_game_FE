package com.pub_game_be.service;

import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Memoria di partita: quali domande sono già uscite, quale domanda è stata
 * assegnata a ciascun dispositivo (arena) e i punteggi.
 *
 * Vive in memoria: un riavvio del backend azzera le partite in corso, cosa
 * accettabile per una serata in un pub.
 */
@Service
public class QuestionHistoryService {

    /** Domanda servita a un dispositivo: la risposta corretta resta sul server. */
    public record ArenaAssignment(String questionId, String playerId, String question,
            String correctAnswer, String category) {
    }

    /** Esito di una risposta dell'arena, calcolato dal server. */
    public record ArenaResult(boolean correct, String correctAnswer, int points, int totalScore) {
    }

    private final Map<Long, Set<String>> usedKeys = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, ArenaAssignment>> assignments = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Integer>> scores = new ConcurrentHashMap<>();
    private final Map<Long, AtomicLong> questionCounters = new ConcurrentHashMap<>();
    /** Quante VERO e quante FALSO sono già uscite: [vero, falso]. */
    private final Map<Long, int[]> arenaSides = new ConcurrentHashMap<>();

    /** Minuscole, senza accenti e senza punteggiatura: confronto tollerante. */
    public static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String flat = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return flat.replaceAll("[^a-z0-9]+", " ").trim();
    }

    /**
     * Chiave del fatto raccontato dalla domanda: testo e risposta. La categoria
     * resta fuori di proposito: la stessa domanda non deve passare nemmeno se
     * viene richiesta sotto etichette diverse.
     */
    public static String key(String question, String correctAnswer, String category) {
        return normalize(question) + "|" + normalize(correctAnswer);
    }

    /**
     * Chiave secondaria: due domande riformulate sullo stesso fatto hanno la
     * stessa risposta, quindi questa chiave le tratta come doppioni.
     */
    public static String answerKey(String correctAnswer, String category) {
        return "answer|" + normalize(correctAnswer);
    }

    public boolean isUsed(long gameId, String key) {
        // Le Vero/Falso non hanno chiave di risposta: "vero" e "falso" sono le
        // uniche due risposte, quindi deduplicarle per risposta bloccherebbe
        // tutta la banca dopo due domande.
        if (key == null || key.isBlank()) {
            return false;
        }
        return usedKeys.getOrDefault(gameId, Set.of()).contains(key);
    }

    /** Registra una domanda come uscita; false se era già stata servita. */
    public boolean claim(long gameId, String key) {
        if (key == null || key.isBlank()) {
            return true;
        }
        return usedKeys.computeIfAbsent(gameId, id -> ConcurrentHashMap.newKeySet()).add(key);
    }

    /**
     * Lato da servire adesso: si alterna per pareggiare VERO e FALSO anche se
     * la banca non è bilanciata (indovinare sempre VERO non deve convenire).
     */
    public boolean preferTrueSide(long gameId) {
        int[] counts = arenaSides.computeIfAbsent(gameId, id -> new int[2]);
        synchronized (counts) {
            return counts[0] <= counts[1];
        }
    }

    public void countArenaSide(long gameId, boolean isTrue) {
        int[] counts = arenaSides.computeIfAbsent(gameId, id -> new int[2]);
        synchronized (counts) {
            counts[isTrue ? 0 : 1]++;
        }
    }

    public String nextQuestionId(long gameId) {
        long counter = questionCounters.computeIfAbsent(gameId, id -> new AtomicLong()).incrementAndGet();
        return "g" + gameId + "-q" + counter;
    }

    public void assign(long gameId, ArenaAssignment assignment) {
        assignments.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .put(assignment.questionId(), assignment);
    }

    /**
     * Valida la risposta di un dispositivo. Vuoto se la domanda non esiste o
     * non è stata assegnata a quel giocatore.
     */
    public Optional<ArenaResult> answer(long gameId, String playerId, String questionId, String answer) {
        ArenaAssignment assignment = assignments.getOrDefault(gameId, Map.of()).get(questionId);
        if (assignment == null || !assignment.playerId().equals(playerId)) {
            return Optional.empty();
        }
        boolean correct = normalize(assignment.correctAnswer()).equals(normalize(answer));
        // Allineato alla TV: +10 per risposta esatta, -10 per errore.
        int points = correct ? 10 : -10;
        int totalScore = scores.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .merge(playerId, points, Integer::sum);
        return Optional.of(new ArenaResult(correct, assignment.correctAnswer(), points, totalScore));
    }

    /** Punteggi correnti della partita: è la verità che legge la TV. */
    public Map<String, Integer> scores(long gameId) {
        return Map.copyOf(scores.getOrDefault(gameId, Map.of()));
    }

    /** Dimentica tutto di una partita (nuova arena o reset dalla TV). */
    public void forget(long gameId) {
        usedKeys.remove(gameId);
        assignments.remove(gameId);
        scores.remove(gameId);
        questionCounters.remove(gameId);
        arenaSides.remove(gameId);
    }
}
