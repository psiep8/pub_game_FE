/**
 * Punti per piazzamento "a metà campo" (sezione 1 della specifica).
 *
 * Vale per Time Buzzer (a manche), Speed Rush e Biglie (a gara). Con N
 * partecipanti si prendono `p = floor(N/2)` posti: i primi p guadagnano, gli
 * ultimi p pagano, e se N è dispari il posto di mezzo prende zero.
 *
 * @param rank piazzamento, 1 = primo.
 * @param n partecipanti.
 * @param w punti del primo (positivi).
 * @param l punti dell'ultimo (negativi).
 */
export function rankPoints(rank: number, n: number, w: number, l: number): number {
  const players = Math.floor(Number(n));
  if (!Number.isFinite(players) || players < 2) return 0;
  if (!Number.isInteger(rank) || rank < 1 || rank > players) return 0;

  const p = Math.floor(players / 2);
  let raw = 0;

  if (rank <= p) {
    raw = (w * (p - rank + 1)) / p;
  } else if (rank > players - p) {
    // k = posizioni dal fondo: 1 = ultimo.
    const k = players - rank + 1;
    raw = (l * (p - k + 1)) / p;
  } else {
    // Posto di mezzo con N dispari: zero.
    return 0;
  }

  return roundToTen(raw);
}

/** Arrotonda alla decina più vicina, simmetrico fra positivi e negativi. */
export function roundToTen(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.round(Math.abs(value) / 10) * 10;
}
