/**
 * I bonus di fine atto. Non consumano round della scaletta.
 *
 * I quattro automatici sono casino (atto 1), basket (atto 2), cavallo
 * (atto 3) e biglie (atto 4).
 */
export const BonusType = {
  CASINO: 'CASINO',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO',
  BIGLIE: 'BIGLIE',
} as const;

export type BonusType = (typeof BonusType)[keyof typeof BonusType];

export const BONUS_LABELS: Record<BonusType, string> = {
  CASINO: 'CASINO',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
  BIGLIE: 'BIGLIE',
};

/** I bonus nell'ordine degli atti. */
export const BONUS_TYPES: readonly BonusType[] = Object.values(BonusType);
