/**
 * Scalette della simulazione, condivise da `full-match.mjs` e `tv-pilot.mjs`.
 *
 * `esercitazione` è la lista corta (13 round, uno per gioco) usata per le prove
 * rapide. `serata` è la scaletta vera di `shared/schedule.ts` (`ACT_DECKS`):
 * 40 round, cinque atti, due Arena, cinque Ultima spiaggia.
 *
 * `ROUNDS_MODE=serata` seleziona la scaletta vera in entrambi i processi.
 */
export const ROUNDS_ESERCITAZIONE = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE',
  'TIME_BUZZER', 'BOMBA', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];

export const ROUNDS_SERATA = [
  'QUIZ', 'MUSIC', 'BLACKJACK', 'TIME_BUZZER', 'BOMBA', 'TIMELINE', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'WHEEL_OF_FORTUNE', 'BLACKJACK', 'QUIZ', 'AIR_HOCKEY_BATTLE', 'TIME_BUZZER', 'MUSIC', 'ULTIMA_SPIAGGIA',
  'QUIZ', 'SPEED_RUSH', 'IMAGE_BLUR', 'AIR_HOCKEY_BATTLE', 'TIME_BUZZER', 'BLACKJACK', 'ULTIMA_SPIAGGIA', 'ARENA',
  'IMAGE_BLUR', 'BOMBA', 'MUSIC', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA',
  'QUIZ', 'MUSIC', 'BOMBA', 'IMAGE_BLUR', 'AZZARDO', 'TIMELINE', 'ULTIMA_SPIAGGIA', 'ARENA',
];

/** La scaletta scelta da `ROUNDS_MODE` (default: esercitazione). */
export function simRounds() {
  return process.env.ROUNDS_MODE === 'serata' ? ROUNDS_SERATA : ROUNDS_ESERCITAZIONE;
}
