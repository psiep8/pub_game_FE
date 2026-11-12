package com.pub_game_be.reliability;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PairingCodeServiceTest {

    @Test
    void codiceValidoValeUnaVolta() {
        PairingCodeService service = new PairingCodeService();
        String code = service.issue(1L);

        assertEquals(6, code.length());
        assertTrue(service.redeem(1L, code));
        assertFalse(service.redeem(1L, code));
    }

    @Test
    void codiceErratoNonConsumaQuelloValido() {
        PairingCodeService service = new PairingCodeService();
        String code = service.issue(1L);
        String wrong = code.equals("000000") ? "111111" : "000000";

        assertFalse(service.redeem(1L, wrong));
        assertTrue(service.redeem(1L, code));
    }

    @Test
    void ogniPartitaHaUnCodiceProprio() {
        PairingCodeService service = new PairingCodeService();
        String codeA = service.issue(1L);
        String codeB = service.issue(2L);
        // Due codici casuali da 6 cifre coincidono con probabilità 1 su un milione: basta
        // escludere che la partita 2 accetti il codice della partita 1 quando sono diversi.
        if (!codeA.equals(codeB)) {
            assertFalse(service.redeem(2L, codeA));
        }
        assertTrue(service.redeem(2L, codeB));
        assertTrue(service.redeem(1L, codeA));
    }

    @Test
    void dopoCinqueErroriLaPartitaSiBloccaAncheConCodiceGiusto() {
        PairingCodeService service = new PairingCodeService();
        String code = service.issue(1L);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < PairingCodeService.MAX_FAILED_ATTEMPTS; i++) {
            assertFalse(service.redeem(1L, wrong));
        }
        assertFalse(service.redeem(1L, code));
    }

    @Test
    void codiceNullONessunoNonSonoAccettati() {
        PairingCodeService service = new PairingCodeService();
        assertFalse(service.redeem(1L, null));
        assertFalse(service.redeem(1L, "123456"));
    }
}
