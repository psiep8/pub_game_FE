/**
 * Ritardo di riconnessione: backoff esponenziale con jitter.
 *
 * Senza jitter tutti i telefoni di un pub riproverebbero nello stesso
 * millisecondo dopo una caduta del Wi-Fi, affondando il backend. Il jitter
 * distribuisce i tentativi su una finestra, così la riconnessione di 20 remote
 * contemporanee non è un attacco di forza bruta.
 *
 * @param attempt numero del tentativo (0 = primo retry)
 * @param baseMs ritardo del primo tentativo
 * @param capMs tetto massimo
 * @param random sorgente casuale iniettabile nei test (0..1)
 */
export function backoffDelay(
  attempt: number,
  baseMs = 500,
  capMs = 15000,
  random: () => number = Math.random
): number {
  const raw = Number.isFinite(attempt) ? Math.floor(attempt) : 0;
  const safeAttempt = Math.max(0, Math.min(10, raw));
  const exponential = Math.min(capMs, baseMs * Math.pow(2, safeAttempt));
  // Jitter simmetrico del 25%: la finestra resta dentro il tetto.
  const jitter = 0.75 + random() * 0.5;
  return Math.round(Math.min(capMs, exponential * jitter));
}
