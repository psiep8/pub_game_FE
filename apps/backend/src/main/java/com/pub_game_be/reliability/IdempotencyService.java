package com.pub_game_be.reliability;

import com.pub_game_be.reliability.domain.AnswerReceiptEntity;
import com.pub_game_be.reliability.repository.AnswerReceiptRepository;
import org.json.JSONObject;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Idempotenza dei comandi che modificano la partita.
 *
 * <p>La ricevuta viene scritta in una transazione breve e separata dall'azione.
 * Tenere la transazione aperta durante l'azione costava una connessione per
 * tutta la sua durata: con 16 risposte simultanee il pool Hikari (10) si
 * esauriva mentre le scritture su STATE_BLOB aspettavano il lock, e i client
 * andavano in timeout. Le azioni hanno già transazioni brevi proprie, quindi
 * qui si serializza per chiave senza trattenere connessioni.</p>
 *
 * <p>Conseguenza accettata: azione e ricevuta non sono più atomiche. Se il
 * processo cade tra le due, il retry ripete l'azione; le azioni di gioco sono
 * già monotone per chiave (domanda consumata, tiro assegnato, ordine
 * sostituito), quindi il doppio effetto non assegna punti due volte.</p>
 */
@Service
public class IdempotencyService {

    /** Basta a serializzare le chiavi calde senza una mappa che cresce. */
    private static final int STRIPES = 64;

    private final AnswerReceiptRepository receipts;
    private final TransactionTemplate tx;
    private final Object[] stripes = new Object[STRIPES];

    public IdempotencyService(AnswerReceiptRepository receipts,
            PlatformTransactionManager transactionManager) {
        this.receipts = receipts;
        this.tx = new TransactionTemplate(transactionManager);
        for (int index = 0; index < stripes.length; index++) {
            stripes[index] = new Object();
        }
    }

    /**
     * Esegue il comando una sola volta per chiave.
     *
     * <p>Se {@code action} restituisce {@code null} il comando non è valido e
     * non viene registrata nessuna ricevuta: un retry legittimo resta possibile.</p>
     */
    public Map<String, Object> executeOnce(long gameId, String commandKey, String kind, String deviceId,
            Supplier<Map<String, Object>> action) {
        if (commandKey == null || commandKey.isBlank()) {
            return action.get();
        }

        Object lock = stripes[Math.floorMod((gameId + ":" + commandKey).hashCode(), STRIPES)];
        synchronized (lock) {
            Optional<AnswerReceiptEntity> done = receipts.findByGameIdAndCommandKey(gameId, commandKey);
            if (done.isPresent()) {
                return replay(done.get());
            }

            // Fuori transazione: le scritture dell'azione prendono e rilasciano
            // la connessione da sole.
            Map<String, Object> result = action.get();
            if (result == null) {
                return null;
            }

            try {
                return record(gameId, commandKey, kind, deviceId, result);
            } catch (DataIntegrityViolationException duplicate) {
                // Un altro processo ha vinto la stessa chiave: si restituisce
                // la sua risposta, senza registrare una seconda ricevuta.
                return receipts.findByGameIdAndCommandKey(gameId, commandKey)
                        .map(this::replay)
                        .orElse(null);
            }
        }
    }

    /** Ricevuta in una transazione breve, solo per la riga di conferma. */
    private Map<String, Object> record(long gameId, String commandKey, String kind, String deviceId,
            Map<String, Object> result) {
        return tx.execute(status -> {
            AnswerReceiptEntity receipt = new AnswerReceiptEntity();
            receipt.setGameId(gameId);
            receipt.setCommandKey(commandKey);
            receipt.setKind(kind);
            receipt.setDeviceId(deviceId);
            receipt.setCreatedAt(System.currentTimeMillis());
            JSONObject body = new JSONObject(result);
            body.put("idempotencyKey", commandKey);
            body.put("replayed", false);
            body.put("ackedAt", System.currentTimeMillis());
            receipt.setResponse(body.toString());
            receipts.saveAndFlush(receipt);
            return JsonSupport.toMap(body);
        });
    }

    private Map<String, Object> replay(AnswerReceiptEntity receipt) {
        JSONObject body = new JSONObject(receipt.getResponse());
        body.put("replayed", true);
        return JsonSupport.toMap(body);
    }
}
