import { BonusType } from './enums/bonus-type';
import { GameModeType } from './enums/game-mode-type';

/** Round per atto: la serata è divisa in cinque atti uguali. */
export const ROUNDS_PER_ACT = 8;
export const TOTAL_ROUNDS = 40;

/**
 * Scaletta in cinque atti da otto round.
 *
 * L'ordine è fisso e già verificato rispetto ai vincoli: mai due giochi in
 * tempo reale di fila (Bomba, Arena, Speed Rush, Tennis, Biglie), mai due
 * giochi a prenotazione consecutivi (Musica, Indovina chi, Ruota), la Ruota
 * esce due volte e l'Arena chiude la serata.
 *
 * Nessun atto ripete l'apertura del precedente. Le Biglie sono quattro round
 * separati, uno per atto dal secondo al quinto (11, 22, 28, 38), mai
 * consecutivi e mai nello stesso atto: ogni gara vive nel proprio round e
 * assegna i punti della serata. Il Black Jack non è più nella scaletta: resta
 * come bonus, fuori dai quaranta round.
 *
 * Conteggi concordati: 5 Quiz, 4 Musica, 2 Azzardo, 2 Arena, 2 Bomba, 3
 * Celebrità (Indovina chi), 0 Black Jack, 3 Timeline, 2 Ruota, 3 Speed Rush,
 * 2 Time Buzzer, 3 Tennis, 4 Biglie e 5 Ultima spiaggia.
 *
 * Ultima spiaggia chiude gli atti 1, 2 e 4 (8, 16, 32) ed è al penultimo
 * round degli atti 3 e 5 (23, 39), subito prima dell'Arena (24, 40).
 *
 * Q-04: l'atto 1 apre con Musica e non con Quiz (altrimenti Musica e Ruota
 * sarebbero due prenotazioni di fila); l'atto 5 mette Tennis prima di
 * Indovina chi, così Biglie e Tennis non sono due giochi in tempo reale
 * consecutivi. I vincoli restano protetti dai test di RoundManagerService.
 */
export const ACT_DECKS: readonly (readonly GameModeType[])[] = [
  ['MUSIC', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIME_BUZZER', 'IMAGE_BLUR', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA'],
  ['AZZARDO', 'WHEEL_OF_FORTUNE', 'BIGLIE', 'QUIZ', 'TENNIS_BATTLE', 'TIMELINE', 'MUSIC', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'SPEED_RUSH', 'IMAGE_BLUR', 'TENNIS_BATTLE', 'TIME_BUZZER', 'BIGLIE', 'ULTIMA_SPIAGGIA', 'ARENA'],
  ['AZZARDO', 'BOMBA', 'MUSIC', 'BIGLIE', 'QUIZ', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA'],
  ['QUIZ', 'BOMBA', 'MUSIC', 'TENNIS_BATTLE', 'IMAGE_BLUR', 'BIGLIE', 'ULTIMA_SPIAGGIA', 'ARENA'],
];

/** Tutti i round della serata, nell'ordine in cui vengono giocati. */
export const SCHEDULE: readonly GameModeType[] = ACT_DECKS.flat();

/** Classifiche: rapida a metà atto, dettagliata a fine atto. */
export const QUICK_LEADERBOARD_ROUNDS = [4, 12, 20, 28, 36] as const;
export const DETAILED_LEADERBOARD_ROUNDS = [8, 16, 24, 32, 40] as const;

/** Un bonus diverso per ognuno dei cinque atti. */
export const BONUS_AFTER_ACT: readonly (BonusType | null)[] = [
  'CASINO_COLOR',
  'BLACKJACK',
  'CASINO_DOZEN',
  'CAVALLO',
  'CASINO_NUMBER',
];

/**
 * Round di un atto in cui può cadere il bonus: mai l'apertura, mai l'ultimo
 * round (che ha la classifica dettagliata) e mai il quarto (classifica rapida).
 */
export const BONUS_ROUND_SLOTS = [2, 3, 5, 6, 7] as const;

/** Un bonus e il round dopo il quale si gioca (1-based). */
export interface BonusSlot {
  act: number;
  type: BonusType;
  round: number;
}

/** PRNG piccolo e deterministico: lo stesso seme dà sempre la stessa serata. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sparpaglia i cinque bonus dentro gli atti: uno per atto, in un round interno
 * scelto dal seme. La posizione resta la stessa per tutta la serata, anche
 * dopo un refresh, perché il seme vive nello stato del round manager.
 */
export function planBonusSlots(seed: number): BonusSlot[] {
  const next = seededRandom(seed);
  return BONUS_AFTER_ACT.flatMap((type, act) => {
    if (!type) return [];
    const local = BONUS_ROUND_SLOTS[Math.floor(next() * BONUS_ROUND_SLOTS.length)];
    return [{ act, type, round: act * ROUNDS_PER_ACT + local }];
  });
}

/** Il bonus che cade dopo il round indicato (1-based), se c'è. */
export function bonusForRound(
  slots: readonly BonusSlot[],
  round: number,
): BonusSlot | null {
  return slots.find((slot) => slot.round === round) ?? null;
}

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
