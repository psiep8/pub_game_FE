package com.pub_game_be.reliability;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Codici brevi per abbinare la regia da telefono.
 *
 * <p>La TV genera un codice numerico con scadenza; l'admin lo digita e ottiene
 * una sessione di regia. Il codice vale una sola volta e dopo troppi tentativi
 * sbagliati la partita si blocca per un po', così un codice a 6 cifre non si
 * può indovinare a forza bruta. Tutto resta in memoria: un riavvio annulla i
 * codici, che la TV rigenera al volo.</p>
 */
@Service
public class PairingCodeService {

    static final Duration TTL = Duration.ofMinutes(5);
    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCKOUT = Duration.ofMinutes(1);

    private record Code(String value, long expiresAt) {
    }

    private record Attempts(int failed, long lockedUntil) {
    }

    private final SecureRandom random = new SecureRandom();
    private final Map<Long, Code> codes = new ConcurrentHashMap<>();
    private final Map<Long, Attempts> attempts = new ConcurrentHashMap<>();

    /** Genera (o rigenera) il codice della partita. */
    public synchronized String issue(long gameId) {
        String value = String.format("%06d", random.nextInt(1_000_000));
        codes.put(gameId, new Code(value, System.currentTimeMillis() + TTL.toMillis()));
        return value;
    }

    /** Consuma il codice se è valido. Falso per codice errato, scaduto o bloccato. */
    public synchronized boolean redeem(long gameId, String supplied) {
        long now = System.currentTimeMillis();
        Attempts state = attempts.get(gameId);
        if (state != null && state.lockedUntil() > now) {
            return false;
        }
        Code code = codes.get(gameId);
        if (supplied == null || code == null || code.expiresAt() < now
                || !code.value().equals(supplied.trim())) {
            int failed = (state == null ? 0 : state.failed()) + 1;
            long lockedUntil = failed >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT.toMillis() : 0;
            attempts.put(gameId, new Attempts(lockedUntil > 0 ? 0 : failed, lockedUntil));
            return false;
        }
        codes.remove(gameId);
        attempts.remove(gameId);
        return true;
    }

    /** Elimina i codici scaduti, così la mappa non cresce per sempre. */
    public synchronized void purgeExpired() {
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<Long, Code>> it = codes.entrySet().iterator(); it.hasNext(); ) {
            if (it.next().getValue().expiresAt() < now) it.remove();
        }
    }
}
