import { BonusType } from './enums/bonus-type';
import { GameModeType } from './enums/game-mode-type';

/** Round per atto: la serata è divisa in cinque atti uguali. */
export const ROUNDS_PER_ACT = 8;
export const TOTAL_ROUNDS = 40;

/**
 * Scaletta in cinque atti da otto round.
 *
 * L'ordine è fisso e già verificato rispetto ai vincoli: mai due giochi in
 * tempo reale di fila (Bomba, Arena, Speed Rush, Tennis, Black Jack), mai
 * due giochi a prenotazione consecutivi (Musica, Indovina chi, Ruota), la
 * Ruota esce due volte e l'Arena chiude la serata.
 *
 * Nessun atto ripete l'apertura del precedente. Il Black Jack esce tre volte,
 * una per atto, sempre nei primi tre atti: è il round che dà il momento di
 * vetrina a un tavolo alla volta.
 *
 * Conteggi concordati: 5 Quiz, 4 Musica, 2 Azzardo, 2 Arena, 3 Bomba,
 * 3 Celebrità (Indovina chi), 3 Black Jack, 3 Timeline, 2 Ruota, 2 Speed Rush,
 * 3 Time Buzzer, 3 Tennis e 5 Ultima spiaggia.
 *
 * Ultima spiaggia chiude gli atti 1, 2 e 4 (8, 16, 32) ed è al penultimo
 * round degli atti 3 e 5 (23, 39), subito prima dell'Arena (24, 40).
 */
export const ACT_DECKS: readonly (readonly GameModeType[])[] = [
  ['QUIZ', 'MUSIC', 'BLACKJACK', 'TIME_BUZZER', 'BOMBA', 'TIMELINE', 'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA'],
  ['AZZARDO', 'WHEEL_OF_FORTUNE', 'BLACKJACK', 'QUIZ', 'TENNIS_BATTLE', 'TIME_BUZZER', 'MUSIC', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'SPEED_RUSH', 'IMAGE_BLUR', 'TENNIS_BATTLE', 'TIME_BUZZER', 'BLACKJACK', 'ULTIMA_SPIAGGIA', 'ARENA'],
  ['IMAGE_BLUR', 'BOMBA', 'MUSIC', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'MUSIC', 'BOMBA', 'IMAGE_BLUR', 'AZZARDO', 'TIMELINE', 'ULTIMA_SPIAGGIA', 'ARENA'],
];

/** Tutti i round della serata, nell'ordine in cui vengono giocati. */
export const SCHEDULE: readonly GameModeType[] = ACT_DECKS.flat();

/** Classifiche: rapida a metà atto, dettagliata a fine atto. */
export const QUICK_LEADERBOARD_ROUNDS = [4, 12, 20, 28, 36] as const;
export const DETAILED_LEADERBOARD_ROUNDS = [8, 16, 24, 32, 40] as const;

/** Bonus dopo ogni atto; dopo il quinto non c'è bonus. */
export const BONUS_AFTER_ACT: readonly (BonusType | null)[] = [
  'CASINO',
  'BASKET',
  'CAVALLO',
  'BIGLIE',
  null,
];

/** Le modalità della scaletta senza doppioni, nell'ordine della prima uscita. */
export function scheduledModes(): GameModeType[] {
  return [...new Set(SCHEDULE)];
}

/** Quante volte una modalità esce nei quaranta round. */
export function occurrencesOf(type: GameModeType): number {
  return SCHEDULE.filter((mode) => mode === type).length;
}

/** Atto (0-based) a cui appartiene un round 1-based. */
export function actOfRound(round: number): number {
  return Math.min(ACT_DECKS.length - 1, Math.max(0, Math.floor(round / ROUNDS_PER_ACT)));
}
