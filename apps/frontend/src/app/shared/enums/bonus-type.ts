/**
 * I cinque bonus, uno dentro ogni atto. Non consumano round della scaletta.
 *
 * L'ordine è quello della serata:
 * 1. KARAOKE — cinque manche, microfono conteso;
 * 2. BLACKJACK — un turno per tavolo;
 * 3. CASINO 5 MANCHE — colore, dozzina, parità, alto/basso, numero secco;
 * 4. CAVALLO DI BATTAGLIA — otto domande flash;
 * 5. CASINO NUMERO — numero scelto una volta e tre girate.
 */
export const BonusType = {
  KARAOKE: 'KARAOKE',
  BLACKJACK: 'BLACKJACK',
  CASINO_FIVE: 'CASINO_FIVE',
  CAVALLO: 'CAVALLO',
  CASINO_NUMBER: 'CASINO_NUMBER',
} as const;

export type BonusType = (typeof BonusType)[keyof typeof BonusType];

export const BONUS_LABELS: Record<BonusType, string> = {
  KARAOKE: 'KARAOKE',
  BLACKJACK: 'BLACKJACK',
  CASINO_FIVE: 'CASINO 5 MANCHE',
  CAVALLO: 'CAVALLO DI BATTAGLIA',
  CASINO_NUMBER: 'CASINO NUMERO SECCO',
};

/** I bonus nell'ordine degli atti. */
export const BONUS_TYPES: readonly BonusType[] = Object.values(BonusType);

/** I bonus che usano la ruota del Casino. */
export const CASINO_BONUS_TYPES: readonly BonusType[] = [
  'CASINO_FIVE',
  'CASINO_NUMBER',
];
