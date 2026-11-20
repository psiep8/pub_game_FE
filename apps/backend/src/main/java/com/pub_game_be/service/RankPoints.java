package com.pub_game_be.service;

/**
 * Punti per piazzamento "a metà campo", la stessa funzione del frontend
 * (`rank-points.ts`). La usano Speed Rush, Time Buzzer e Biglie quando il
 * punteggio lo calcola il server.
 *
 * <p>Con N partecipanti i primi floor(N/2) prendono punti positivi, gli ultimi
 * floor(N/2) punti negativi; con N dispari il posto di mezzo prende zero.
 * L'arrotondamento è alla decina più vicina, simmetrico sui negativi.</p>
 */
public final class RankPoints {

    private RankPoints() {
    }

    public static int points(int rank, int n, int w, int l) {
        if (n < 2 || rank < 1 || rank > n) {
            return 0;
        }
        int half = n / 2;
        double raw;
        if (rank <= half) {
            raw = w * (double) (half - rank + 1) / half;
        } else if (rank > n - half) {
            int fromBottom = n - rank + 1;
            raw = l * (double) (half - fromBottom + 1) / half;
        } else {
            return 0;
        }
        return roundToTen(raw);
    }

    static int roundToTen(double value) {
        if (!Double.isFinite(value)) {
            return 0;
        }
        return (int) (Math.signum(value) * Math.round(Math.abs(value) / 10.0) * 10);
    }
}
