/**
 * Regole pure del Sette e Mezzo.
 *
 * <p>Stanno fuori dal componente TV perché sono la parte da testare. Il mazzo è
 * quello napoletano da 40 carte: Asso vale 1, i numeri il loro valore, le
 * figure mezzo punto. Il Re di denari è la matta: vale 1 o 0,5, sempre nel modo
 * che avvicina di più la mano a 7,5 senza sballare.</p>
 *
 * <p>Il banco gioca da solo: pesca finché non raggiunge la soglia scelta dalla
 * simulazione (`BANCO_SOGLIA`), poi sta. Il banco vince i pareggi; il naturale
 * (7 + figura) vince subito, salvo il naturale del banco.</p>
 */

export type SetteEMezzoOutcome = 'WIN' | 'NATURAL' | 'BUST' | 'LOSE';

/** Il traguardo: chi lo supera sballa. */
export const SETTE_E_MEZZO_TARGET = 7.5;

/** Il Re di denari è la matta. */
export const MATTA = 'RE-DENARI';

/**
 * D1: la matta è attiva. Il valore è scelto in automatico da `handTotal`, non
 * dal tavolo: così la regola resta una sola per TV, telefono e simulazione.
 */
export const MATTA_ATTIVA = true;

/** Punti di una mano vinta contro il banco. */
export const SETTE_E_MEZZO_WIN = 250;

/** Il naturale (7 + figura) paga il doppio. */
export const SETTE_E_MEZZO_NATURAL_WIN = 500;

/** Punti persi in una mano persa: sempre gli stessi, senza cumuli. */
export const SETTE_E_MEZZO_LOSS = 250;

/**
 * Soglia del banco: pesca finché il totale è sotto questo valore.
 *
 * <p>Il valore è quello che, nella simulazione `scripts/sim/sette-mezzo.mjs`
 * con la strategia credibile «sta a 5,5», porta la vittoria delle squadre fra
 * il 42% e il 45%. A 7,25 il banco pesca sul 7 e sta sul 7,5.</p>
 */
export const BANCO_SOGLIA = 7.25;

const FIGURES = new Set(['FANTE', 'CAVALLO', 'RE']);

/** Rango di una carta `RANGO-SEME`. */
export function rankOf(card: string): string {
  return String(card).split('-')[0] ?? '';
}

/** Seme di una carta `RANGO-SEME`. */
export function suitOf(card: string): string {
  return String(card).split('-')[1] ?? '';
}

export function isMatta(card: string): boolean {
  return card === MATTA;
}

/** Valore di una carta, matta esclusa: la matta la conta `handTotal`. */
export function cardValue(card: string): number {
  const rank = rankOf(card);
  if (rank === 'ASSO') return 1;
  if (FIGURES.has(rank)) return 0.5;
  const numeric = Number(rank);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Arrotonda a un decimale: 0,5 + 0,5 non deve diventare 7.500000001. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Totale della mano. La matta vale 1 se ci sta, altrimenti 0,5: è il valore
 * ottimale automatico, non una scelta del giocatore.
 */
export function handTotal(cards: readonly string[], mattaAttiva = MATTA_ATTIVA): number {
  let total = 0;
  let matta = false;

  for (const card of cards) {
    if (mattaAttiva && isMatta(card)) {
      matta = true;
      continue;
    }
    total += cardValue(card);
  }

  if (matta) {
    total += total + 1 <= SETTE_E_MEZZO_TARGET ? 1 : 0.5;
  }

  return round(total);
}

export function isBust(total: number): boolean {
  return total > SETTE_E_MEZZO_TARGET + 1e-9;
}

/**
 * Naturale: due carte, 7 + figura, totale 7,5. Il Re di denari conta come
 * figura, quindi 7 + matta è un naturale.
 */
export function isNatural(cards: readonly string[], mattaAttiva = MATTA_ATTIVA): boolean {
  if (cards.length !== 2) return false;
  if (handTotal(cards, mattaAttiva) !== SETTE_E_MEZZO_TARGET) return false;
  const ranks = cards.map(rankOf);
  return ranks.includes('7') && ranks.some((rank) => FIGURES.has(rank));
}

export interface SetteEMezzoSettlement {
  outcome: SetteEMezzoOutcome;
  /** Variazione dei punti: positiva in vincita, negativa in perdita. */
  points: number;
}

/**
 * Esito della mano. Il banco vince i pareggi; una sconfitta costa sempre
 * `SETTE_E_MEZZO_LOSS` ma non porta mai la classifica sotto zero.
 */
export function settleHand(
  hand: readonly string[],
  bank: readonly string[],
  availablePoints = Number.MAX_SAFE_INTEGER,
  mattaAttiva = MATTA_ATTIVA,
): SetteEMezzoSettlement {
  const playerTotal = handTotal(hand, mattaAttiva);
  const bankTotal = handTotal(bank, mattaAttiva);
  const available = Math.max(0, Math.floor(availablePoints));
  const lost = Math.min(SETTE_E_MEZZO_LOSS, available);
  const loss = lost === 0 ? 0 : -lost;

  if (isBust(playerTotal)) return { outcome: 'BUST', points: loss };

  if (isNatural(hand, mattaAttiva)) {
    return isNatural(bank, mattaAttiva)
      ? { outcome: 'LOSE', points: loss }
      : { outcome: 'NATURAL', points: SETTE_E_MEZZO_NATURAL_WIN };
  }

  if (isBust(bankTotal)) return { outcome: 'WIN', points: SETTE_E_MEZZO_WIN };
  if (playerTotal > bankTotal) return { outcome: 'WIN', points: SETTE_E_MEZZO_WIN };

  // Pareggio: il banco vince.
  return { outcome: 'LOSE', points: loss };
}

/** Il banco pesca finché è sotto soglia e non ha sballato. */
export function bankShouldDraw(total: number, soglia = BANCO_SOGLIA): boolean {
  return !isBust(total) && total < soglia;
}
