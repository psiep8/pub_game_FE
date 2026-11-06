/**
 * I bonus di fine atto. Non consumano round della scaletta.
 *
 * I quattro automatici sono roulette colorata (atto 1), basket (atto 2),
 * cavallo (atto 3) e biglie (atto 4). La roulette numerata resta come bonus
 * manuale dal pannello admin: le due roulette possono convivere nello stesso
 * bonus quando decideremo la sequenza completa delle manche del Casinò.
 */
export type BonusType = 'ROULETTE_COLORATA' | 'ROULETTE_NUMERATA' | 'BIGLIE' | 'BASKET' | 'CAVALLO';

export const BONUS_LABELS: Record<BonusType, string> = {
  ROULETTE_COLORATA: 'ROULETTE COLORATA',
  ROULETTE_NUMERATA: 'ROULETTE NUMERATA',
  BIGLIE: 'BIGLIE',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
};