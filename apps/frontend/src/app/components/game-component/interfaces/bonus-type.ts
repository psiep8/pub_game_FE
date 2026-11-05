/** I quattro bonus unici di fine atto. Non consumano round della scaletta. */
export type BonusType = 'CASINO' | 'BASKET' | 'CAVALLO' | 'TIME_BUZZER';

export const BONUS_LABELS: Record<BonusType, string> = {
  CASINO: 'CASINO',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
  TIME_BUZZER: 'TIME BUZZER',
};