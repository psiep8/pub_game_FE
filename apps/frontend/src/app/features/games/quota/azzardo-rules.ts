/**
 * Regole pure di Azzardo (l'ex round Quota).
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

/** Quota della vincita: ×2 facile, ×3 media, ×4 difficile. */
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

/** Puntata massima consentita: mai più dei punti posseduti, mai oltre 300. */
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
