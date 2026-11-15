/**
 * I cinque bonus di fine atto. Non consumano round della scaletta.
 *
 * L'ordine è quello della serata: dopo ogni atto parte un bonus diverso.
 * Le tre varianti Casino usano la stessa ruota europea, ma una sola manche:
 * colore, dozzina o numero secco. Il Blackjack e il Cavallo hanno gare
 * dedicate.
 */
export const BonusType = {
  CASINO_COLOR: 'CASINO_COLOR',
  BLACKJACK: 'BLACKJACK',
  CASINO_DOZEN: 'CASINO_DOZEN',
  CAVALLO: 'CAVALLO',
  CASINO_NUMBER: 'CASINO_NUMBER',
} as const;

export type BonusType = (typeof BonusType)[keyof typeof BonusType];

export const BONUS_LABELS: Record<BonusType, string> = {
  CASINO_COLOR: 'CASINO BIANCO/ROSSO',
  BLACKJACK: 'BLACKJACK',
  CASINO_DOZEN: 'CASINO DOZZINA',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
  CASINO_NUMBER: 'CASINO NUMERO SECCO',
};

/** I bonus nell'ordine degli atti. */
export const BONUS_TYPES: readonly BonusType[] = Object.values(BonusType);

/** Le tre varianti che parlano la lingua della roulette. */
export const CASINO_BONUS_TYPES: readonly BonusType[] = [
  'CASINO_COLOR',
  'CASINO_DOZEN',
  'CASINO_NUMBER',
];
