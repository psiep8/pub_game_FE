package com.pub_game_be.service;

import com.pub_game_be.service.QuestionBankService.ArenaQuestion;
import org.springframework.stereotype.Service;

import java.util.Deque;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Domande arena già generate e messe da parte: i telefoni le pescano da qui
 * invece di far partire una chiamata AI a testa.
 *
 * Una sola generazione per round (pacchetto) invece di N chiamate è ciò che
 * tiene il gioco sotto il limite TPM del provider.
 */
@Service
public class QuestionPoolService {

    private final Map<Long, Map<String, Deque<ArenaQuestion>>> pools = new ConcurrentHashMap<>();

    public void offer(long gameId, String category, ArenaQuestion question) {
        poolOf(gameId, category).addLast(question);
    }

    public void offerFirst(long gameId, String category, ArenaQuestion question) {
        poolOf(gameId, category).addFirst(question);
    }

    public Optional<ArenaQuestion> poll(long gameId, String category) {
        Deque<ArenaQuestion> pool = pools.getOrDefault(gameId, Map.of())
                .get(QuestionHistoryService.normalize(category));
        return pool == null ? Optional.empty() : Optional.ofNullable(pool.pollFirst());
    }

    public int size(long gameId, String category) {
        Deque<ArenaQuestion> pool = pools.getOrDefault(gameId, Map.of())
                .get(QuestionHistoryService.normalize(category));
        return pool == null ? 0 : pool.size();
    }

    public void clear(long gameId) {
        pools.remove(gameId);
    }

    private Deque<ArenaQuestion> poolOf(long gameId, String category) {
        return pools.computeIfAbsent(gameId, id -> new ConcurrentHashMap<>())
                .computeIfAbsent(QuestionHistoryService.normalize(category), key -> new ConcurrentLinkedDeque<>());
    }
}
