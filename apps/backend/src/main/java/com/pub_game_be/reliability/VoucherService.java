package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Buoni di Blackjack e Cavallo: premi fisici, non punti.
 *
 * <p>Ogni buono ha un codice di quattro cifre, un tavolo e uno stato
 * consegnato/non consegnato. Vive in un blob per partita, quindi sopravvive a
 * un refresh della TV, a un riavvio del backend e alla chiusura del browser
 * della regia. Un buono già emesso per lo stesso tavolo e lo stesso premio non
 * viene duplicato: una ripresa del bonus non regala due buoni.</p>
 */
@Service
public class VoucherService {

    public static final String BLOB = "bonus-vouchers";
    private static final int CODE_MODULO = 10_000;

    private final StateBlobService stateBlobs;
    private final SecureRandom random = new SecureRandom();
    /** Serializza lettura-modifica-scrittura del blob per ogni partita. */
    private final ConcurrentMap<Long, Object> locks = new ConcurrentHashMap<>();

    public VoucherService(StateBlobService stateBlobs) {
        this.stateBlobs = stateBlobs;
    }

    /** Emette il buono, oppure restituisce quello ancora aperto dello stesso tavolo. */
    public JSONObject issue(long gameId, String playerName, String label) {
        Object lock = locks.computeIfAbsent(gameId, key -> new Object());
        synchronized (lock) {
            JSONObject root = read(gameId);
            JSONArray list = root.optJSONArray("vouchers");
            if (list == null) {
                list = new JSONArray();
                root.put("vouchers", list);
            }

            for (int i = 0; i < list.length(); i++) {
                JSONObject existing = list.optJSONObject(i);
                if (existing == null || existing.optBoolean("delivered")) continue;
                if (playerName.equals(existing.optString("playerName"))
                        && label.equals(existing.optString("label"))) {
                    return existing;
                }
            }

            int id = root.optInt("nextId", 1);
            JSONObject voucher = new JSONObject()
                    .put("id", id)
                    .put("code", nextCode(list))
                    .put("playerName", playerName)
                    .put("label", label)
                    .put("delivered", false)
                    .put("issuedAt", System.currentTimeMillis());
            list.put(voucher);
            root.put("nextId", id + 1);
            stateBlobs.save(gameId, BLOB, root.toString());
            return voucher;
        }
    }

    /** Tutti i buoni della partita, dal più recente. */
    public JSONArray list(long gameId) {
        JSONArray stored = read(gameId).optJSONArray("vouchers");
        JSONArray out = new JSONArray();
        if (stored == null) return out;
        for (int i = stored.length() - 1; i >= 0; i--) {
            JSONObject row = stored.optJSONObject(i);
            if (row != null) out.put(row);
        }
        return out;
    }

    /** Buoni di un tavolo: il telefono li ritrova anche dopo un refresh. */
    public JSONArray forPlayer(long gameId, String playerName) {
        JSONArray out = new JSONArray();
        JSONArray all = list(gameId);
        for (int i = 0; i < all.length(); i++) {
            JSONObject row = all.optJSONObject(i);
            if (row != null && playerName.equals(row.optString("playerName"))) out.put(row);
        }
        return out;
    }

    /** Segna consegnato; un buono già consegnato resta consegnato. */
    public Optional<JSONObject> markDelivered(long gameId, int voucherId) {
        Object lock = locks.computeIfAbsent(gameId, key -> new Object());
        synchronized (lock) {
            JSONObject root = read(gameId);
            JSONArray list = root.optJSONArray("vouchers");
            if (list == null) return Optional.empty();
            for (int i = 0; i < list.length(); i++) {
                JSONObject row = list.optJSONObject(i);
                if (row == null || row.optInt("id") != voucherId) continue;
                if (!row.optBoolean("delivered")) {
                    row.put("delivered", true);
                    row.put("deliveredAt", System.currentTimeMillis());
                    stateBlobs.save(gameId, BLOB, root.toString());
                }
                return Optional.of(row);
            }
            return Optional.empty();
        }
    }

    private JSONObject read(long gameId) {
        return stateBlobs.load(gameId, BLOB).map(JSONObject::new).orElseGet(JSONObject::new);
    }

    /** Codice a quattro cifre, con gli zeri iniziali, unico fra i buoni aperti. */
    private String nextCode(JSONArray list) {
        for (int attempt = 0; attempt < CODE_MODULO * 2; attempt++) {
            String code = String.format("%04d", random.nextInt(CODE_MODULO));
            boolean used = false;
            for (int i = 0; i < list.length(); i++) {
                JSONObject row = list.optJSONObject(i);
                if (row != null && !row.optBoolean("delivered") && code.equals(row.optString("code"))) {
                    used = true;
                    break;
                }
            }
            if (!used) return code;
        }
        // Spazio dei codici esaurito: si usa un progressivo, sempre a quattro cifre.
        return String.format("%04d", list.length() % CODE_MODULO);
    }
}
