/**
 * Simulazione del Sette e Mezzo.
 *
 * <p>Serve a una cosa sola: scegliere la soglia del banco. Le squadre giocano
 * una strategia semplice e dichiarata (pescano sotto 4,5, stanno a 4,5 o più); il
 * banco pesca finché è sotto la soglia. Si cerca la soglia che fa vincere le
 * squadre fra il 42% e il 45% delle mani, come chiede il foglio della serata.</p>
 *
 * <p>Le regole sono le stesse di
 * `apps/frontend/src/app/features/games/sette-e-mezzo/sette-e-mezzo-rules.ts`:
 * Asso 1, numeri il loro valore, figure 0,5, Re di denari matta al valore
 * ottimale, banco che vince i pareggi.</p>
 */

import { pathToFileURL } from 'node:url';

export const SUITS = ['DENARI', 'COPPE', 'SPADE', 'BASTONI'];
export const RANKS = ['ASSO', '2', '3', '4', '5', '6', '7', 'FANTE', 'CAVALLO', 'RE'];
export const MATTA = 'RE-DENARI';
export const TARGET = 7.5;

const FIGURES = new Set(['FANTE', 'CAVALLO', 'RE']);

export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(`${rank}-${suit}`);
  }
  return deck;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards, random) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function cardValue(card) {
  const rank = String(card).split('-')[0];
  if (rank === 'ASSO') return 1;
  if (FIGURES.has(rank)) return 0.5;
  const numeric = Number(rank);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

export function handTotal(cards) {
  let total = 0;
  let matta = false;
  for (const card of cards) {
    if (card === MATTA) {
      matta = true;
      continue;
    }
    total += cardValue(card);
  }
  if (matta) total += total + 1 <= TARGET ? 1 : 0.5;
  return round(total);
}

export function isNatural(cards) {
  if (cards.length !== 2) return false;
  if (handTotal(cards) !== TARGET) return false;
  const ranks = cards.map((card) => String(card).split('-')[0]);
  return ranks.includes('7') && ranks.some((rank) => FIGURES.has(rank));
}

export function bankShouldDraw(total, soglia) {
  return total <= TARGET && total < soglia;
}

export function settleHand(hand, bank) {
  const playerTotal = handTotal(hand);
  const bankTotal = handTotal(bank);

  if (playerTotal > TARGET) return 'BUST';
  if (isNatural(hand)) return isNatural(bank) ? 'LOSE' : 'NATURAL';
  if (bankTotal > TARGET) return 'WIN';
  if (playerTotal > bankTotal) return 'WIN';
  // Pareggio: vince il banco.
  return 'LOSE';
}

/** Una mano: mazzo rimescolato, due carte a testa, poi le pescate. */
export function playHand(random, soglia, standAt = 4.5) {
  const deck = shuffle(buildDeck(), random);
  const hand = [deck.pop(), deck.pop()];
  const bank = [deck.pop(), deck.pop()];

  // Il naturale non pesca: la mano è già chiusa.
  if (!isNatural(hand) && !isNatural(bank)) {
    while (handTotal(hand) < standAt && hand.length < 10) {
      hand.push(deck.pop());
      if (handTotal(hand) > TARGET) break;
    }
    while (bankShouldDraw(handTotal(bank), soglia) && bank.length < 10) {
      bank.push(deck.pop());
      if (handTotal(bank) > TARGET) break;
    }
  }

  return settleHand(hand, bank);
}

/**
 * Frequenze su `hands` mani. `seed` rende la misura ripetibile: due giri con
 * lo stesso seme danno lo stesso numero, anche su macchine diverse.
 */
export function simulate(soglia, hands = 200_000, seed = 2026, standAt = 4.5) {
  const random = seededRandom(seed);
  let wins = 0;
  let naturals = 0;
  let busts = 0;

  for (let index = 0; index < hands; index += 1) {
    const outcome = playHand(random, soglia, standAt);
    if (outcome === 'WIN') wins += 1;
    if (outcome === 'NATURAL') {
      wins += 1;
      naturals += 1;
    }
    if (outcome === 'BUST') busts += 1;
  }

  return {
    soglia,
    hands,
    wins,
    winRate: wins / hands,
    naturalRate: naturals / hands,
    bustRate: busts / hands,
  };
}

/**
 * Sceglie la soglia con la vittoria delle squadre fra 42% e 45%, la più vicina
 * al centro della forbice. Se nessuna ci cade, restituisce la più vicina.
 */
export function chooseThreshold(hands = 200_000, standAt = 4.5) {
  const rows = [];
  for (let soglia = 4; soglia <= 7.0001; soglia += 0.25) {
    rows.push(simulate(Number(soglia.toFixed(2)), hands, 2026, standAt));
  }

  const inRange = rows.filter((row) => row.winRate >= 0.42 && row.winRate <= 0.45);
  const pool = inRange.length ? inRange : rows;
  const best = pool.reduce((chosen, row) =>
    Math.abs(row.winRate - 0.435) < Math.abs(chosen.winRate - 0.435) ? row : chosen);

  return { best, rows };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { best, rows } = chooseThreshold();
  console.log('SOGLIA  VITTORIE  NATURALI  SBALLI');
  for (const row of rows) {
    const mark = row.soglia === best.soglia ? '  ← scelta' : '';
    console.log(
      `${row.soglia.toFixed(2).padStart(5)}  ${(row.winRate * 100).toFixed(1).padStart(7)}%  `
      + `${(row.naturalRate * 100).toFixed(1).padStart(7)}%  ${(row.bustRate * 100).toFixed(1).padStart(6)}%${mark}`,
    );
  }
  console.log(`\nBANCO_SOGLIA = ${best.soglia.toFixed(2)} → squadre ${(best.winRate * 100).toFixed(1)}%`);
}
