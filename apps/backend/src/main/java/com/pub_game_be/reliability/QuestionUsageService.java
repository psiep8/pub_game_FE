package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.QuestionUsageEntity;
import com.pub_game_be.reliability.repository.QuestionUsageRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Anti-ripetizione centralizzata: quali domande sono già uscite.
 *
 * <p>La verità è nel database. La cache in memoria serve solo a evitare una
 * query per ogni candidato della banca; se il processo riparte la cache si
 * ricarica dalla tabella e le domande già usate restano escluse.</p>
 */
@Service
public class QuestionUsageService {

    private final QuestionUsageRepository usages;
    private final TransactionTemplate tx;
    private final Set<String> cache = ConcurrentHashMap.newKeySet();

    public QuestionUsageService(QuestionUsageRepository usages,
            PlatformTransactionManager transactionManager) {
        this.usages = usages;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @PostConstruct
    void warmUp() {
        for (QuestionUsageEntity usage : usages.findAll()) {
            cache.add(cacheKey(usage.getGameId(), usage.getQuestionKey()));
        }
        System.out.println("Anti-ripetizione: " + cache.size() + " domande già usate ricaricate dal database.");
    }

    public boolean isUsed(long gameId, String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        if (cache.contains(cacheKey(gameId, key))) {
            return true;
        }
        return usages.findByGameIdAndQuestionKey(gameId, key).isPresent();
    }

    /**
     * Riserva una domanda. {@code false} significa che era già uscita: il
     * chiamante deve ripescare, non riproporla.
     */
    public boolean claim(long gameId, String key, String questionId, String mode, Integer roundIndex) {
        if (key == null || key.isBlank()) {
            return true;
        }
        if (!cache.add(cacheKey(gameId, key))) {
            return false;
        }
        try {
            tx.executeWithoutResult(status -> {
                QuestionUsageEntity usage = new QuestionUsageEntity();
                usage.setGameId(gameId);
                usage.setQuestionKey(key);
                usage.setQuestionId(questionId);
                usage.setMode(mode);
                usage.setRoundIndex(roundIndex);
                usage.setUsedAt(System.currentTimeMillis());
                usages.saveAndFlush(usage);
            });
            return true;
        } catch (DataIntegrityViolationException alreadyUsed) {
            // Un altro processo l'ha riservata dopo il nostro controllo.
            return false;
        }
    }

    public boolean claim(long gameId, String key) {
        return claim(gameId, key, null, null, null);
    }

    /** Chiavi già usate in una partita: per filtrare un pool in un colpo solo. */
    public Set<String> usedKeys(long gameId) {
        Set<String> keys = new LinkedHashSet<>();
        String prefix = gameId + "|";
        for (String entry : cache) {
            if (entry.startsWith(prefix)) {
                keys.add(entry.substring(prefix.length()));
            }
        }
        return keys;
    }

    /** Storico completo (per diagnostica e analisi delle ripetizioni). */
    public Set<String> historicalKeys(long gameId) {
        Set<String> keys = new HashSet<>();
        for (QuestionUsageEntity usage : usages.findByGameId(gameId)) {
            keys.add(usage.getQuestionKey());
        }
        return keys;
    }

    public long count(long gameId) {
        return usages.countByGameId(gameId);
    }

    /** Solo quando l'admin azzera esplicitamente la partita. */
    public void forget(long gameId) {
        String prefix = gameId + "|";
        cache.removeIf(entry -> entry.startsWith(prefix));
        tx.executeWithoutResult(status -> usages.deleteByGameId(gameId));
    }

    private String cacheKey(long gameId, String key) {
        return gameId + "|" + key;
    }
}
