/**
 * Mazzo napoletano da 40 carte.
 *
 * <p>Quattro semi (denari, coppe, spade, bastoni) per dieci valori: Asso, 2-7,
 * Fante, Cavallo e Re. Le carte sono stringhe `RANGO-SEME` perché viaggiano
 * dentro checkpoint e stato della TV come quelle del Blackjack: nessun oggetto
 * da ricostruire dopo un refresh.</p>
 */

export const NEAPOLITAN_SUITS = ['DENARI', 'COPPE', 'SPADE', 'BASTONI'] as const;
export type NeapolitanSuit = (typeof NEAPOLITAN_SUITS)[number];

export const NEAPOLITAN_RANKS = [
  'ASSO',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  'FANTE',
  'CAVALLO',
  'RE',
] as const;
export type NeapolitanRank = (typeof NEAPOLITAN_RANKS)[number];

const SUIT_NAMES: Record<NeapolitanSuit, string> = {
  DENARI: 'denari',
  COPPE: 'coppe',
  SPADE: 'spade',
  BASTONI: 'bastoni',
};

const RANK_NAMES: Record<NeapolitanRank, string> = {
  ASSO: 'Asso',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  FANTE: 'Fante',
  CAVALLO: 'Cavallo',
  RE: 'Re',
};

/** Le 40 carte, nell'ordine canonico del mazzo. */
export function buildNeapolitanDeck(): string[] {
  const deck: string[] = [];
  for (const suit of NEAPOLITAN_SUITS) {
    for (const rank of NEAPOLITAN_RANKS) {
      deck.push(`${rank}-${suit}`);
    }
  }
  return deck;
}

/** Fisher-Yates immutabile: il mazzo di partenza non viene toccato. */
export function shuffleDeck<T>(cards: readonly T[], random: () => number = Math.random): T[] {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

/**
 * Generatore deterministico per la simulazione e per il banco di prova: stesso
 * seme, stesso mazzo, stesso esito. Mulberry32 è piccolo e non ha dipendenze.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nome leggibile per la TV: «Re di denari», «7 di coppe». */
export function cardName(card: string): string {
  const [rank, suit] = String(card).split('-');
  const rankName = RANK_NAMES[rank as NeapolitanRank] ?? rank;
  const suitName = SUIT_NAMES[suit as NeapolitanSuit] ?? suit;
  return `${rankName} di ${suitName}`;
}

/** Sigla breve per il telefono: «R♦», «7♣». */
export function cardShort(card: string): string {
  const [rank, suit] = String(card).split('-');
  const rankShort: Record<string, string> = {
    ASSO: 'A',
    FANTE: 'F',
    CAVALLO: 'C',
    RE: 'R',
  };
  const suitShort: Record<string, string> = {
    DENARI: '♦',
    COPPE: '♥',
    SPADE: '♠',
    BASTONI: '♣',
  };
  return `${rankShort[rank] ?? rank}${suitShort[suit] ?? ''}`;
}
