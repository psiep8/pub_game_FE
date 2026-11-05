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
 * <p>La mutazione e la ricevuta finiscono nella stessa transazione: se il
 * database non conferma, al client non arriva nessuna conferma e il comando non
 * ha effetto. Un retry con la stessa chiave non assegna punti due volte e
 * riceve la risposta originale.</p>
 */
@Service
public class IdempotencyService {

    private final AnswerReceiptRepository receipts;
    private final TransactionTemplate tx;

    public IdempotencyService(AnswerReceiptRepository receipts,
            PlatformTransactionManager transactionManager) {
        this.receipts = receipts;
        this.tx = new TransactionTemplate(transactionManager);
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

        Optional<AnswerReceiptEntity> done = receipts.findByGameIdAndCommandKey(gameId, commandKey);
        if (done.isPresent()) {
            return replay(done.get());
        }

        try {
            return tx.execute(status -> {
                Optional<AnswerReceiptEntity> inside = receipts.findByGameIdAndCommandKey(gameId, commandKey);
                if (inside.isPresent()) {
                    return replay(inside.get());
                }

                Map<String, Object> result = action.get();
                if (result == null) {
                    // Nessuna ricevuta: il comando non ha prodotto un effetto.
                    return null;
                }

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
        } catch (DataIntegrityViolationException duplicate) {
            // Un altro invio con la stessa chiave ha vinto: si restituisce la
            // sua risposta, senza ripetere la mutazione.
            return receipts.findByGameIdAndCommandKey(gameId, commandKey)
                    .map(this::replay)
                    .orElse(null);
        }
    }

    private Map<String, Object> replay(AnswerReceiptEntity receipt) {
        JSONObject body = new JSONObject(receipt.getResponse());
        body.put("replayed", true);
        return JsonSupport.toMap(body);
    }
}
