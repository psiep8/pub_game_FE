import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import {
  BLACKJACK_ROUNDS,
  BLACKJACK_WIN,
  BlackjackOutcome,
  handTotal,
  settleHand,
} from './blackjack-rules';

/** Fasi del Blackjack: le comuni arrivano da `GamePhase`. */
export const BlackjackPhase = {
  DECIDE: 'DECIDE',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type BlackjackPhase = (typeof BlackjackPhase)[keyof typeof BlackjackPhase];
export type BlackjackStatus = 'WAITING' | 'ACTIVE' | BlackjackOutcome;

export interface BlackjackRow {
  playerName: string;
  status: BlackjackStatus;
  /** Punti accumulati nei round già giocati. */
  points: number;
}

export interface BlackjackResult {
  outcome: BlackjackOutcome;
  points: number;
  round: number;
  handTotal: number;
  bankTotal: number;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Quindici secondi per decidere, quattro per il reveal. */
const DECIDE_SECONDS = 15;
const REVEAL_SECONDS = 4;
const FINALE_SECONDS = 6;

/**
 * BLACK JACK — la TV fa il banco, tre round contro ogni giocatore.
 *
 * Il round è sequenziale: entra un giocatore per volta e il banco viene
 * rimescolato a ogni mano, così tutti affrontano le stesse condizioni e nessuno
 * può decidere sapendo già il totale del banco. Un giro vale per tutti i
 * partecipanti collegati, qualunque sia il loro numero: dopo l'ultimo tavolo si
 * ricomincia da capo, per tre round in tutto.
 *
 * Ogni vittoria vale 250 punti che si sommano a quelli dei round precedenti
 * (250, poi 500, poi 750); il blackjack naturale paga 500 invece di 250. Una
 * sconfitta costa sempre 250, senza cumulare le perdite precedenti, e non porta
 * mai la classifica sotto zero. Il pari non muove nulla.
 */
export class BlackjackMode extends GameModeBase {
  readonly type: GameModeType = 'BLACKJACK';
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private deck: string[] = [];
  private bankCards: string[] = [];

  private handIndex = signal(0);
  private round = signal(1);
  private tableIndex = signal(0);
  private phase = signal<BlackjackPhase>(BlackjackPhase.DECIDE);
  private secondsLeft = signal(DECIDE_SECONDS);
  private cards = signal<string[]>([]);
  private bank = signal<{ cards: string[]; total: number | null; hidden: boolean }>({
    cards: [],
    total: null,
    hidden: true,
  });
  private choice = signal<'HIT' | 'STAND' | null>(null);
  private rows = signal<BlackjackRow[]>([]);
  private result = signal<BlackjackResult | null>(null);

  private finished = false;
  private clock?: ReturnType<typeof setInterval>;

  /**
   * Durata stimata dell'intero round, calcolata sui partecipanti collegati:
   * tre giri da una mano a testa. Il timer vero è quello delle fasi, questo
   * serve solo alle anteprime e al pannello admin.
   */
  get timerDuration(): number {
    const players = Math.max(1, this.players.length);
    return players * BLACKJACK_ROUNDS * (DECIDE_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  }

  protected onInitialize(): void {
    this.players = [];
    this.resetRound();
  }

  protected async onStart(): Promise<void> {
    // `activePlayers` arriva dopo `initialize`: si rilegge qui, come la Quota.
    this.players = [...(this.config.activePlayers ?? [])];
    this.resetRound();

    await this.runPreGameSequence(3000);
    this.startHand(0);
  }

  /** Le fasi hanno un cronometro proprio: il timer della base resta fermo. */
  protected override startTimer(): void {}

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.clearClock();
  }

  protected onCleanup(): void {
    this.clearClock();
    this.players = [];
    this.rows.set([]);
  }

  protected onTimeout(): void {
    this.finish();
  }

  /** Decisione del tavolo di turno: carta oppure stai. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'BLACKJACK_ACTION') return;
    if (this.phase() !== BlackjackPhase.DECIDE) return;

    const current = this.players[this.tableIndex()];
    const playerName = String(event.playerName ?? '').trim();
    if (!current || !playerName || playerName !== current) return;

    const kind = String(event.kind ?? '').toUpperCase();

    if (kind === 'STAND') {
      this.choice.set('STAND');
      this.reveal();
      return;
    }

    if (kind !== 'HIT') return;

    const cards = [...this.cards(), this.draw()];
    this.cards.set(cards);
    this.choice.set('HIT');

    if (handTotal(cards) >= 21) {
      this.reveal();
      return;
    }

    this.publish();
  }

  private availablePoints(playerName: string): number {
    return Math.max(0, Math.floor(this.config.playerPoints?.(playerName) ?? 0));
  }

  private resetRound(): void {
    this.finished = false;
    this.clearClock();
    this.deck = this.buildDeck();
    this.bankCards = [];
    this.handIndex.set(0);
    this.round.set(1);
    this.tableIndex.set(0);
    this.cards.set([]);
    this.bank.set({ cards: [], total: null, hidden: true });
    this.choice.set(null);
    this.result.set(null);
    this.phase.set(BlackjackPhase.DECIDE);
    this.secondsLeft.set(DECIDE_SECONDS);
    this.rows.set(this.players.map((playerName) => ({
      playerName,
      status: 'WAITING' as BlackjackStatus,
      points: 0,
    })));
    this.revealed.set(false);
    this.timer.set(this.timerDuration);
  }

  private startHand(index: number): void {
    this.clearClock();
    this.choice.set(null);
    this.result.set(null);
    this.cards.set([]);

    if (index >= this.players.length * BLACKJACK_ROUNDS) {
      this.finale();
      return;
    }

    const tableIndex = index % this.players.length;
    const playerName = this.players[tableIndex];

    this.handIndex.set(index);
    this.round.set(Math.floor(index / this.players.length) + 1);
    this.tableIndex.set(tableIndex);

    this.cards.set([this.draw(), this.draw()]);
    this.bankCards = [this.draw(), this.draw()];
    this.bank.set({
      cards: [this.bankCards[0]],
      total: handTotal([this.bankCards[0]]),
      hidden: true,
    });
    this.setRow(playerName, 'ACTIVE');

    this.phase.set(BlackjackPhase.DECIDE);
    this.publish();
    this.startClock(DECIDE_SECONDS, () => this.reveal(true));
  }

  private reveal(auto = false): void {
    if (this.phase() !== BlackjackPhase.DECIDE) return;
    this.clearClock();

    const playerName = this.players[this.tableIndex()];
    if (!playerName) {
      this.finale();
      return;
    }

    if (auto) this.choice.set('STAND');

    const cards = this.cards();
    const playerTotal = handTotal(cards);
    const natural = cards.length === 2 && playerTotal === 21;

    // Il banco pesca fino a 17 solo contro una mano ancora in gioco.
    if (playerTotal <= 21 && !natural) {
      while (handTotal(this.bankCards) < 17) this.bankCards.push(this.draw());
    }

    const bankTotal = handTotal(this.bankCards);
    const settlement = settleHand(cards, this.bankCards, this.availablePoints(playerName));

    this.bank.set({ cards: [...this.bankCards], total: bankTotal, hidden: false });
    this.result.set({
      outcome: settlement.outcome,
      points: settlement.points,
      round: this.round(),
      handTotal: playerTotal,
      bankTotal,
    });
    this.setRow(playerName, settlement.outcome, settlement.points);

    this.phase.set(BlackjackPhase.REVEAL);
    this.publish();
    this.startClock(REVEAL_SECONDS, () => this.startHand(this.handIndex() + 1));

    if (settlement.points !== 0) {
      this.config.onAnswerReceived?.({
        playerName,
        points: settlement.points,
        isCorrect: settlement.points > 0,
      });
    }
  }

  private finale(): void {
    this.clearClock();
    this.phase.set(BlackjackPhase.FINALE);
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finish());
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.clearClock();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  /** Aggiorna lo stato della riga e somma i punti dei round già giocati. */
  private setRow(playerName: string, status: BlackjackStatus, delta = 0): void {
    this.rows.update((rows) => rows.map((row) => (
      row.playerName === playerName
        ? { ...row, status, points: row.points + delta }
        : row
    )));
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.clearClock();
    this.secondsLeft.set(seconds);
    this.publish();

    this.clock = setInterval(() => {
      if (this.isPaused()) return;

      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();

      if (next <= 0) {
        this.clearClock();
        onEnd();
      }
    }, 1000);
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private publish(): void {
    this.config.onBroadcast?.({
      action: WsAction.BLACKJACK_STATE,
      state: this.getDisplayData(),
    });
  }

  private buildDeck(): string[] {
    const deck: string[] = [];
    RANKS.forEach((rank) => SUITS.forEach((suit) => deck.push(`${rank}${suit}`)));
    for (let index = deck.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }
    return deck;
  }

  private draw(): string {
    if (this.deck.length === 0) this.deck = this.buildDeck();
    return this.deck.pop()!;
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  getDisplayData() {
    const hand = this.cards();
    const currentTable = this.players[this.tableIndex()] ?? '';

    return {
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      round: this.round(),
      rounds: BLACKJACK_ROUNDS,
      index: this.players.length ? this.tableIndex() + 1 : 0,
      total: this.players.length,
      currentTable,
      cards: hand,
      handTotal: handTotal(hand),
      stake: BLACKJACK_WIN,
      bank: this.bank(),
      choice: this.choice(),
      result: this.result(),
      rows: this.rows(),
      isReading: this.isReading(),
    };
  }
}
