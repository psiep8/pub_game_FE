/**
 * I bonus di fine atto. Non consumano round della scaletta.
 *
 * I quattro automatici sono casino (atto 1), basket (atto 2), cavallo
 * (atto 3) e biglie (atto 4).
 */
export type BonusType = 'CASINO' | 'BIGLIE' | 'BASKET' | 'CAVALLO';

export const BONUS_LABELS: Record<BonusType, string> = {
  CASINO: 'CASINO',
  BIGLIE: 'BIGLIE',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
};