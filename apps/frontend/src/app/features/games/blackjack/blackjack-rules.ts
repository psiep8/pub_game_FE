/**
 * Regole pure del Blackjack: totale della mano ed esito.
 *
 * Stanno fuori dal componente TV perché sono la parte da testare: la TV fa il
 * banco per tre round contro ogni giocatore, ogni vittoria vale 250 punti che
 * si sommano a quelli dei round precedenti, il naturale paga il doppio e una
 * sconfitta costa sempre 250, senza cumulare le perdite.
 */

export type BlackjackOutcome = 'WIN' | 'PUSH' | 'BLACKJACK' | 'BUST' | 'LOSE';

/** Tre round: la TV fa il banco una volta per ogni giocatore. */
export const BLACKJACK_ROUNDS = 3;

/** Punti di una mano vinta contro il banco. */
export const BLACKJACK_WIN = 250;

/** Il blackjack naturale paga il doppio della mano vinta. */
export const BLACKJACK_NATURAL_WIN = 500;

/** Punti persi in una mano persa: sempre gli stessi, senza cumuli. */
export const BLACKJACK_LOSS = 250;

export interface BlackjackSettlement {
  outcome: BlackjackOutcome;
  /** Variazione dei punti: positiva in vincita, negativa in perdita. */
  points: number;
}

/** Totale della mano, con gli assi che scendono da 11 a 1 quando serve. */
export function handTotal(cards: readonly string[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    const rank = String(card).slice(0, -1);
    if (rank === 'A') {
      aces += 1;
      total += 11;
    } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
      total += 10;
    } else {
      total += Number(rank) || 0;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isNatural(cards: readonly string[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

/**
 * Esito della mano. Il banco si ferma a 17 (lo fa il chiamante): qui si
 * confrontano solo i totali. Naturale contro naturale è pari; il naturale
 * batte una mano normale da 21 e paga 500 invece di 250. La perdita è sempre
 * 250 ma non porta mai la classifica sotto zero.
 */
export function settleHand(
  hand: readonly string[],
  bank: readonly string[],
  availablePoints = Number.MAX_SAFE_INTEGER,
): BlackjackSettlement {
  const playerTotal = handTotal(hand);
  const bankTotal = handTotal(bank);
  const available = Math.max(0, Math.floor(availablePoints));
  const lost = Math.min(BLACKJACK_LOSS, available);
  const loss = lost === 0 ? 0 : -lost;

  if (playerTotal > 21) return { outcome: 'BUST', points: loss };
  if (isNatural(hand)) {
    return isNatural(bank) || bankTotal === 21
      ? { outcome: 'PUSH', points: 0 }
      : { outcome: 'BLACKJACK', points: BLACKJACK_NATURAL_WIN };
  }
  if (bankTotal > 21 || playerTotal > bankTotal) return { outcome: 'WIN', points: BLACKJACK_WIN };
  if (playerTotal === bankTotal) return { outcome: 'PUSH', points: 0 };
  return { outcome: 'LOSE', points: loss };
}
