package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** I buoni restano sul server, con codice a quattro cifre e stato di consegna. */
class VoucherServiceTest {

    /** Blob in memoria: stessa interfaccia del database, senza Spring. */
    private static class MemoryBlobs extends StateBlobService {
        private final Map<String, String> rows = new HashMap<>();

        MemoryBlobs() {
            super(null, null);
        }

        @Override
        public void save(long gameId, String blobKey, String payload) {
            rows.put(gameId + ":" + blobKey, payload);
        }

        @Override
        public Optional<String> load(long gameId, String blobKey) {
            return Optional.ofNullable(rows.get(gameId + ":" + blobKey));
        }

        @Override
        public void forget(long gameId, String blobKey) {
            rows.remove(gameId + ":" + blobKey);
        }
    }

    @Test
    void emetteUnCodiceDiQuattroCifreEPersisteIlBuono() {
        MemoryBlobs blobs = new MemoryBlobs();
        VoucherService vouchers = new VoucherService(blobs);

        JSONObject issued = vouchers.issue(1L, "Anna", "3 consumazioni al tavolo");

        assertThat(issued.optString("code")).matches("\\d{4}");
        assertThat(issued.optBoolean("delivered")).isFalse();
        assertThat(issued.optInt("id")).isPositive();

        // Un'altra istanza legge lo stesso blob: il buono è sul server, non in memoria.
        JSONArray fromServer = new VoucherService(blobs).list(1L);
        assertThat(fromServer).hasSize(1);
        assertThat(fromServer.getJSONObject(0).optString("playerName")).isEqualTo("Anna");
        assertThat(fromServer.getJSONObject(0).optString("code")).isEqualTo(issued.optString("code"));
    }

    @Test
    void nonDuplicaLoStessoPremioAncoraAperto() {
        VoucherService vouchers = new VoucherService(new MemoryBlobs());

        JSONObject first = vouchers.issue(1L, "Bruno", "1 consumazione di cibo");
        JSONObject again = vouchers.issue(1L, "Bruno", "1 consumazione di cibo");

        assertThat(again.optInt("id")).isEqualTo(first.optInt("id"));
        assertThat(vouchers.list(1L)).hasSize(1);
    }

    @Test
    void codiciUniciFraBuoniApertiEDiversiTavoli() {
        VoucherService vouchers = new VoucherService(new MemoryBlobs());

        vouchers.issue(1L, "Anna", "3 consumazioni al tavolo");
        vouchers.issue(1L, "Bruno", "3 consumazioni al tavolo");
        vouchers.issue(1L, "Carla", "1 consumazione di cibo");

        JSONArray list = vouchers.list(1L);
        assertThat(list).hasSize(3);
        java.util.Set<String> codes = new java.util.HashSet<>();
        for (int i = 0; i < list.length(); i++) {
            codes.add(list.getJSONObject(i).optString("code"));
        }
        assertThat(codes).hasSize(3);
    }

    @Test
    void laConsegnaSiRicordaESiVedeDalTelefono() {
        VoucherService vouchers = new VoucherService(new MemoryBlobs());
        JSONObject issued = vouchers.issue(1L, "Anna", "3 consumazioni al tavolo");

        assertThat(vouchers.forPlayer(1L, "Anna")).hasSize(1);
        assertThat(vouchers.forPlayer(1L, "Bruno")).isEmpty();

        JSONObject delivered = vouchers.markDelivered(1L, issued.optInt("id")).orElseThrow();
        assertThat(delivered.optBoolean("delivered")).isTrue();
        assertThat(delivered.optLong("deliveredAt")).isPositive();
        assertThat(vouchers.markDelivered(1L, 9999)).isEmpty();
    }
}
