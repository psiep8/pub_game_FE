/**
 * I quattro bonus di fine atto. Non consumano round della scaletta.
 *
 * Il vecchio CASINO unico è stato spezzato: roulette colorata, roulette
 * numerata e Black Jack arrivano uno per atto, così nessuno si ripete.
 */
export type BonusType = 'ROULETTE_COLORATA' | 'ROULETTE_NUMERATA' | 'BLACKJACK' | 'BASKET' | 'CAVALLO';

export const BONUS_LABELS: Record<BonusType, string> = {
  ROULETTE_COLORATA: 'ROULETTE COLORATA',
  ROULETTE_NUMERATA: 'ROULETTE NUMERATA',
  BLACKJACK: 'BLACK JACK',
  BASKET: 'BASKET',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
};