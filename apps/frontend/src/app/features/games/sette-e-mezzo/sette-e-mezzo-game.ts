import {
  BANCO_SOGLIA,
  SETTE_E_MEZZO_TARGET,
  SetteEMezzoOutcome,
  bankShouldDraw,
  handTotal,
  isBust,
  isMatta,
  isNatural,
  rankOf,
  settleHand,
  suitOf,
} from './sette-e-mezzo-rules';

/** Mani di una partita: cinque, come nella simulazione. */
export const SETTE_E_MEZZO_HANDS = 5;

const RANKS = ['ASSO', '2', '3', '4', '5', '6', '7', 'FANTE', 'CAVALLO', 'RE'];
const SUITS = ['DENARI', 'COPPE', 'SPADE', 'BASTONI'];

export type SetteEMezzoPhase = 'PLAY' | 'REVEAL' | 'FINALE';

export interface SetteEMezzoResult {
  outcome: SetteEMezzoOutcome;
  points: number;
  playerTotal: number;
  bankTotal: number;
  natural: boolean;
}

export interface SetteEMezzoSnapshot {
  phase: SetteEMezzoPhase;
  handIndex: number;
  handNumber: number;
  hands: number;
  score: number;
  player: readonly string[];
  bank: readonly string[];
  playerTotal: number;
  bankTotal: number;
  bankHidden: boolean;
  result: SetteEMezzoResult | null;
  target: number;
  bankThreshold: number;
}

/** Mazzo napoletano da 40 carte, nell'ordine canonico. */
export function buildSetteEMezzoDeck(): string[] {
  const deck: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) deck.push(`${rank}-${suit}`);
  }
  return deck;
}

/** Fisher-Yates; il generatore è iniettabile per i test. */
export function shuffleSetteEMezzoDeck(
  deck: readonly string[],
  random: () => number = Math.random,
): string[] {
  const copy = [...deck];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Motore puro di una partita a Sette e Mezzo contro il banco.
 *
 * <p>Il tavolo non decide i punti: `settleHand` e `handTotal` restano l'unica
 * regola condivisa con la simulazione. Qui si gestiscono solo mazzo, mano,
 * pescata del banco e cinque mani di partita.</p>
 */
export class SetteEMezzoGame {
  readonly hands = SETTE_E_MEZZO_HANDS;

  deck: string[] = [];
  player: string[] = [];
  bank: string[] = [];
  handIndex = 0;
  score = 0;
  phase: SetteEMezzoPhase = 'PLAY';
  result: SetteEMezzoResult | null = null;
  bankHidden = true;

  constructor(private readonly random: () => number = Math.random) {
    this.startHand();
  }

  get playerTotal(): number {
    return handTotal(this.player);
  }

  /** Prima del reveal il banco mostra solo la prima carta. */
  get bankTotal(): number {
    return this.bankHidden ? handTotal(this.bank.slice(0, 1)) : handTotal(this.bank);
  }

  get handNumber(): number {
    return Math.min(this.handIndex + 1, this.hands);
  }

  get canAct(): boolean {
    return this.phase === 'PLAY';
  }

  hit(): void {
    if (!this.canAct) return;
    this.player.push(this.draw());
    if (isBust(this.playerTotal) || isNatural(this.player)) this.reveal();
  }

  stand(): void {
    if (!this.canAct) return;
    this.reveal();
  }

  next(): void {
    if (this.phase !== 'REVEAL') return;
    this.handIndex += 1;
    if (this.handIndex >= this.hands) {
      this.phase = 'FINALE';
      return;
    }
    this.startHand();
  }

  reset(): void {
    this.handIndex = 0;
    this.score = 0;
    this.phase = 'PLAY';
    this.result = null;
    this.bankHidden = true;
    this.startHand();
  }

  snapshot(): SetteEMezzoSnapshot {
    return {
      phase: this.phase,
      handIndex: this.handIndex,
      handNumber: this.handNumber,
      hands: this.hands,
      score: this.score,
      player: [...this.player],
      bank: [...this.bank],
      playerTotal: this.playerTotal,
      bankTotal: this.bankTotal,
      bankHidden: this.bankHidden,
      result: this.result ? { ...this.result } : null,
      target: SETTE_E_MEZZO_TARGET,
      bankThreshold: BANCO_SOGLIA,
    };
  }

  private startHand(): void {
    this.deck = shuffleSetteEMezzoDeck(buildSetteEMezzoDeck(), this.random);
    this.player = [this.draw(), this.draw()];
    this.bank = [this.draw(), this.draw()];
    this.result = null;
    this.bankHidden = true;
    this.phase = 'PLAY';
    // Naturale: la mano si chiude subito, il banco prova a pareggiarlo.
    if (isNatural(this.player)) this.reveal();
  }

  private reveal(): void {
    while (bankShouldDraw(handTotal(this.bank))) this.bank.push(this.draw());

    const settlement = settleHand(this.player, this.bank, Math.max(0, this.score));
    this.score = Math.max(0, this.score + settlement.points);
    this.result = {
      outcome: settlement.outcome,
      points: settlement.points,
      playerTotal: this.playerTotal,
      bankTotal: handTotal(this.bank),
      natural: isNatural(this.player),
    };
    this.bankHidden = false;
    this.phase = 'REVEAL';
  }

  private draw(): string {
    if (!this.deck.length) {
      this.deck = shuffleSetteEMezzoDeck(buildSetteEMezzoDeck(), this.random);
    }
    return this.deck.pop()!;
  }
}

/** Etichette corte per il tavolo: A, 2…7, F, C, R. */
export function shortRank(card: string): string {
  const rank = rankOf(card);
  if (rank === 'ASSO') return 'A';
  if (rank === 'FANTE') return 'F';
  if (rank === 'CAVALLO') return 'C';
  if (rank === 'RE') return 'R';
  return rank;
}

export function suitShort(card: string): string {
  switch (suitOf(card)) {
    case 'DENARI':
      return 'DEN';
    case 'COPPE':
      return 'COP';
    case 'SPADE':
      return 'SPA';
    case 'BASTONI':
      return 'BAS';
    default:
      return '';
  }
}

export function isMattaCard(card: string): boolean {
  return isMatta(card);
}
