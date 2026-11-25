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
  'TIME_BUZZER', 'BOMBA', 'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];

export const ROUNDS_SERATA = [
  ['MUSIC', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIME_BUZZER', 'IMAGE_BLUR', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA'],
  ['AZZARDO', 'WHEEL_OF_FORTUNE', 'BIGLIE', 'QUIZ', 'TENNIS_BATTLE', 'TIMELINE', 'MUSIC', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'SPEED_RUSH', 'IMAGE_BLUR', 'TENNIS_BATTLE', 'TIME_BUZZER', 'BIGLIE', 'ULTIMA_SPIAGGIA', 'ARENA'],
  ['AZZARDO', 'BOMBA', 'MUSIC', 'BIGLIE', 'QUIZ', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'BOMBA', 'MUSIC', 'TENNIS_BATTLE', 'IMAGE_BLUR', 'BIGLIE', 'ULTIMA_SPIAGGIA', 'ARENA'],
].flat();

/** Contratto della serata: se cambia la scaletta, la simulazione non parte. */
export const EXPECTED_SERATA_ROUNDS = 40;
export const BONUSES_SERATA = [
  'KARAOKE', 'BLACKJACK', 'CASINO_FIVE', 'CAVALLO', 'CASINO_NUMBER',
];
// Elenco indipendente: se BONUSES_SERATA perde un bonus, il confronto fallisce.
const EXPECTED_BONUSES = [
  'KARAOKE', 'BLACKJACK', 'CASINO_FIVE', 'CAVALLO', 'CASINO_NUMBER',
];

/**
 * Verifica il numero di round e l'insieme esatto dei cinque bonus.
 * Accetta valori espliciti per rendere il controllo testabile.
 */
export function assertSerataContract({ rounds = ROUNDS_SERATA, bonuses = BONUSES_SERATA } = {}) {
  const problems = [];
  if (rounds.length !== EXPECTED_SERATA_ROUNDS) {
    problems.push(`attesi ${EXPECTED_SERATA_ROUNDS} round, trovati ${rounds.length}`);
  }
  const uniqueBonuses = new Set(bonuses);
  const missing = EXPECTED_BONUSES.filter((type) => !uniqueBonuses.has(type));
  if (bonuses.length !== EXPECTED_BONUSES.length || uniqueBonuses.size !== EXPECTED_BONUSES.length || missing.length) {
    problems.push(`attesi i cinque bonus ${EXPECTED_BONUSES.join(', ')}; trovati ${bonuses.join(', ') || 'nessuno'}`);
  }
  if (problems.length) {
    throw new Error(`[sim] Contratto serata violato: ${problems.join('; ')}`);
  }
}

// Il controllo gira all'import: full-match e tv-pilot falliscono prima di
// creare la partita o aprire socket se qualcuno rompe la scaletta.
assertSerataContract();

/** La scaletta scelta da `ROUNDS_MODE` (default: esercitazione). */
export function simRounds() {
  return process.env.ROUNDS_MODE === 'serata' ? ROUNDS_SERATA : ROUNDS_ESERCITAZIONE;
}
