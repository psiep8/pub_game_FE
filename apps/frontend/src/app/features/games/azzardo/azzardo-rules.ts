/**
 * Regole pure di Azzardo.
 *
 * Quattro manche, una per categoria, con quattro opzioni numeriche molto
 * vicine. La puntata è sui punti veri (100, 200 o 300), la vincita è
 * puntata × quota (2 facile, 3 media, 4 difficile) e la perdita scende lungo
 * le manche: 100%, 80%, 60%, 40%. Nessun esito porta la classifica sotto zero.
 */

export type AzzardoLevel = 1 | 2 | 3;

export const AZZARDO_CATEGORIES = ['CELEBRITÀ', 'CANZONI', 'PAESI', 'STORIA'] as const;
export type AzzardoCategory = (typeof AZZARDO_CATEGORIES)[number];

export const AZZARDO_BETS = [100, 200, 300] as const;
export type AzzardoBet = (typeof AZZARDO_BETS)[number];

/** Fiches della manche: dieci gettoni tutti uguali, da venti punti. */
export const AZZARDO_CHIPS = 10;
export const AZZARDO_CHIP_VALUE = 20;

/**
 * Tetto di fiches sul tavolo in una manche: dieci, come il credito iniziale.
 *
 * Il salvadanaio cresce (le fiches avanzate si sommano), la puntata no:
 * altrimenti chi risparmia due manche punterebbe il doppio e incasserebbe
 * cifre sproporzionate. Con il tetto, la manche paga al massimo
 * 10 × 20 × quota.
 */
export const AZZARDO_MAX_CHIPS_PER_MANCHE = AZZARDO_CHIPS;

/** Fiches giocabili adesso: salvadanaio, tetto di manche e credito punti. */
export function maxChipsFor(bank: number, available: number): number {
  return Math.max(0, Math.min(
    Math.floor(Number(bank) || 0),
    AZZARDO_MAX_CHIPS_PER_MANCHE,
    Math.floor(Math.max(0, Number(available) || 0) / AZZARDO_CHIP_VALUE),
  ));
}

/** Quattro manche per round, una per categoria. */
export const AZZARDO_MANCHES = 4;

/** Moltiplicatore della perdita, manche dopo manche. */
export const AZZARDO_LOSS_MULTIPLIERS = [1, 0.8, 0.6, 0.4] as const;

/** L'Azzardo arriva tre volte nella serata: la terza è la più difficile. */
export function levelForOccurrence(occurrence: number): AzzardoLevel {
  const value = Math.floor(occurrence);
  if (!Number.isFinite(value) || value <= 1) return 1;
  return value >= 3 ? 3 : 2;
}

/** Azzardo della vincita: ×2 facile, ×3 media, ×4 difficile. */
export function oddsForLevel(level: AzzardoLevel): number {
  return level + 1;
}

/** Perdita della manche: 100% alla prima, poi 80%, 60%, 40%. */
export function lossMultiplierFor(manche: number): number {
  const index = Math.min(
    AZZARDO_LOSS_MULTIPLIERS.length - 1,
    Math.max(0, Math.floor(manche)),
  );
  return AZZARDO_LOSS_MULTIPLIERS[index];
}

/**
 * Credito minimo di manche.
 *
 * Chi arriva all'Azzardo con pochi o zero punti in classifica deve poter
 * giocare lo stesso: il tavolo gli dà un credito di 300 punti. La perdita
 * però si taglia sempre sui punti veri, così la classifica non va mai sotto
 * zero.
 */
export const AZZARDO_MIN_BANK = 300;

/** Credito su cui si può puntare: i punti veri, ma mai meno del banco. */
export function bankFor(points: number): number {
  return Math.max(AZZARDO_MIN_BANK, Math.floor(Number(points) || 0));
}

/** Puntata massima consentita: mai più del credito, mai oltre 300. */
export function maxBetFor(points: number): number {
  return Math.max(0, Math.min(300, Math.floor(points)));
}

/** Puntata effettiva: solo 100/200/300, tagliata sui punti posseduti. */
export function clampAzzardoBet(value: number, available: number): number {
  const max = maxBetFor(available);
  const valid = AZZARDO_BETS.includes(value as AzzardoBet);
  if (!valid) return Math.min(AZZARDO_BETS[0], max);
  return Math.min(value, max);
}

export interface AzzardoChipsInput {
  chips: number[];
  answerIndex: number;
  level: AzzardoLevel;
  manche: number;
  available: number;
}

/** Come si trasforma una distribuzione di fiches in punti: serve a TV e telefono. */
export interface AzzardoChipsBreakdown {
  /** Fiches per opzione, come sono state giocate. */
  chips: number[];
  totalChips: number;
  /** Punti messi sul tavolo: fiches × valore della fiche. */
  stake: number;
  correctChips: number;
  wrongChips: number;
  odds: number;
  /** Perdita della manche in percentuale (100, 80, 60, 40). */
  lossPercent: number;
  /** Punti incassati dalle fiches sull'opzione giusta. */
  win: number;
  /** Punti bruciati dalle fiches sulle opzioni sbagliate. */
  loss: number;
  /** Variazione netta della classifica. */
  points: number;
}

/**
 * Conversione fiches → punti, spiegata voce per voce.
 *
 * Le fiches sull'opzione giusta pagano `fiche × valore × quota` (quota del
 * livello: ×2 facile, ×3 media, ×4 difficile); le fiches sulle opzioni
 * sbagliate perdono `fiche × valore × percentuale di manche` (100%, 80%, 60%,
 * 40%). La perdita non porta mai la classifica sotto zero.
 */
export function chipsBreakdown(input: AzzardoChipsInput): AzzardoChipsBreakdown {
  const chips = (Array.isArray(input.chips) ? input.chips : [])
    .map((value) => Math.max(0, Math.floor(Number(value) || 0)));
  const totalChips = chips.reduce((sum, value) => sum + value, 0);
  const odds = oddsForLevel(input.level);
  const lossPercent = Math.round(lossMultiplierFor(input.manche) * 100);

  if (totalChips <= 0) {
    return {
      chips, totalChips: 0, stake: 0, correctChips: 0, wrongChips: 0,
      odds, lossPercent, win: 0, loss: 0, points: 0,
    };
  }

  const correctChips = Math.max(0, Math.floor(chips[input.answerIndex] ?? 0));
  const wrongChips = totalChips - correctChips;
  const stake = totalChips * AZZARDO_CHIP_VALUE;
  const win = correctChips * AZZARDO_CHIP_VALUE * odds;
  const wrongStake = wrongChips * AZZARDO_CHIP_VALUE;
  const loss = Math.min(
    Math.round(wrongStake * lossMultiplierFor(input.manche)),
    Math.max(0, Math.floor(input.available)),
  );

  return { chips, totalChips, stake, correctChips, wrongChips, odds, lossPercent, win, loss, points: win - loss };
}

/** Esito con le fiches: solo la variazione netta della classifica. */
export function settleChips(input: AzzardoChipsInput): number {
  return chipsBreakdown(input).points;
}

export interface AzzardoSettlementInput {
  stake: number;
  correct: boolean;
  level: AzzardoLevel;
  /** Indice della manche, da 0 a 3. */
  manche: number;
  /** Punti posseduti prima dell'esito: la perdita non li supera mai. */
  available: number;
}

/** Variazione dei punti della manche: positiva in vincita, negativa in perdita. */
export function settleManche(input: AzzardoSettlementInput): number {
  const stake = clampAzzardoBet(input.stake, input.available);
  if (stake <= 0) return 0;

  if (input.correct) return stake * oddsForLevel(input.level);

  const loss = Math.round(stake * lossMultiplierFor(input.manche));
  const available = Math.max(0, Math.floor(input.available));
  return loss === 0 ? 0 : -Math.min(loss, available);
}

/** Etichetta del livello, usata da TV, telefono e pannello admin. */
export function levelLabel(level: AzzardoLevel): string {
  if (level === 1) return 'FACILE';
  return level === 3 ? 'DIFFICILE' : 'MEDIA';
}
