import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

/** Fasi del Blackjack: le comuni arrivano da `GamePhase`. */
export const BlackjackPhase = {
  DECIDE: 'DECIDE',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type BlackjackPhase = (typeof BlackjackPhase)[keyof typeof BlackjackPhase];
export type BlackjackOutcome = 'WIN' | 'PUSH' | 'BLACKJACK' | 'BUST' | 'LOSE';
export type BlackjackStatus = 'WAITING' | 'ACTIVE' | 'WIN' | 'PUSH' | 'BLACKJACK' | 'BUST' | 'LOSE';

export interface BlackjackRow {
  playerName: string;
  status: BlackjackStatus;
  points: number;
}

export interface BlackjackResult {
  outcome: BlackjackOutcome;
  points: number;
  handTotal: number;
  bankTotal: number;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Un tavolo alla volta: quindici secondi di decisione, quattro di reveal. */
const DECIDE_SECONDS = 15;
const REVEAL_SECONDS = 4;
const FINALE_SECONDS = 6;
const MAX_TABLES = 8;

const POINTS = { WIN: 250 } as const;
const REPEAT_WIN = 500;

/**
 * BLACK JACK — il tavolo gioca la sua mano contro un banco nuovo.
 *
 * Il round è sequenziale: entra un tavolo per volta, quindi ogni squadra ha il
 * suo momento. Il banco viene rimescolato a ogni tavolo, così tutti affrontano
 * le stesse condizioni e nessuno può decidere sapendo già il totale del banco.
 *
 * Il tavolo può chiedere carte quante ne vuole dentro il cronometro: allo
 * scadere la mano si chiude in automatico con «stai». Ogni vittoria vale 250
 * punti la prima volta; chi ha già vinto in un round precedente della stessa
 * serata porta a casa 500. Perdere non toglie nulla, ma non cancella la
 * vittoria già in memoria.
 */
export class BlackjackMode extends GameModeBase {
  readonly type: GameModeType = 'BLACKJACK';
  readonly timerDuration = MAX_TABLES * (DECIDE_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private deck: string[] = [];
  private bankCards: string[] = [];

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
  private wonBefore = new Set<string>();
  private storageKey = 'pubgame.blackjack.won';

  protected onInitialize(): void {
    this.players = [];
    this.resetRound();
  }

  protected async onStart(): Promise<void> {
    // `activePlayers` arriva dopo `initialize`: si rilegge qui, come la Quota.
    this.players = [...(this.config.activePlayers ?? [])];
    this.storageKey = `pubgame.blackjack.won.${this.config.gameId || 0}`;
    this.loadWins();
    this.resetRound();

    await this.runPreGameSequence(3000);
    this.startTable(0);
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

    const total = this.handTotal(cards);
    if (total >= 21) {
      this.reveal();
      return;
    }

    this.publish();
  }

  private resetRound(): void {
    this.finished = false;
    this.clearClock();
    this.deck = this.buildDeck();
    this.bankCards = [];
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

  private startTable(index: number): void {
    this.clearClock();
    this.choice.set(null);
    this.result.set(null);

    if (index >= this.players.length) {
      this.finale();
      return;
    }

    this.tableIndex.set(index);
    const playerName = this.players[index];

    this.cards.set([this.draw(), this.draw()]);
    this.bankCards = [this.draw(), this.draw()];
    this.bank.set({
      cards: [this.bankCards[0]],
      total: this.handTotal([this.bankCards[0]]),
      hidden: true,
    });
    this.setRow(playerName, 'ACTIVE', 0);

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
    const handTotal = this.handTotal(cards);
    const bust = handTotal > 21;

    // Il banco pesca fino a 17 solo se il tavolo è ancora in gioco.
    if (!bust) {
      while (this.handTotal(this.bankCards) < 17) this.bankCards.push(this.draw());
    }
    const bankTotal = this.handTotal(this.bankCards);

    let outcome: BlackjackOutcome = 'LOSE';
    let points = 0;

    if (bust) {
      outcome = 'BUST';
    } else if (bankTotal > 21 || handTotal > bankTotal) {
      outcome = cards.length === 2 && handTotal === 21 ? 'BLACKJACK' : 'WIN';
      points = this.wonBefore.has(playerName) ? REPEAT_WIN : POINTS.WIN;
      this.rememberWin(playerName);
    } else if (handTotal === bankTotal) {
      outcome = 'PUSH';
      points = 0;
    }

    this.bank.set({ cards: [...this.bankCards], total: bankTotal, hidden: false });
    this.result.set({ outcome, points, handTotal, bankTotal });
    this.setRow(playerName, outcome as BlackjackStatus, points);

    this.phase.set(BlackjackPhase.REVEAL);
    this.publish();
    this.startClock(REVEAL_SECONDS, () => this.startTable(this.tableIndex() + 1));

    if (points > 0) {
      this.config.onAnswerReceived?.({ playerName, points, isCorrect: true });
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

  /** Vittorie già ottenute in questa partita: restano anche dopo una sconfitta. */
  private loadWins(): void {
    this.wonBefore.clear();
    try {
      const raw = localStorage.getItem(this.storageKey);
      const names = raw ? JSON.parse(raw) : [];
      if (Array.isArray(names)) {
        names.forEach((name) => this.wonBefore.add(String(name)));
      }
    } catch {
      // Storage non disponibile: la memoria vale solo per il round corrente.
    }
  }

  private rememberWin(playerName: string): void {
    this.wonBefore.add(playerName);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.wonBefore]));
    } catch {
      // Nessuna persistenza: il round successivo ripartirà da 250.
    }
  }

  private setRow(playerName: string, status: BlackjackStatus, points: number): void {
    this.rows.update((rows) => rows.map((row) => (
      row.playerName === playerName ? { ...row, status, points } : row
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

  private handTotal(cards: string[]): number {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      const rank = card.slice(0, -1);
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

    return {
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      index: this.players.length ? Math.min(this.tableIndex() + 1, this.players.length) : 0,
      total: this.players.length,
      currentTable: this.players[this.tableIndex()] ?? '',
      cards: hand,
      handTotal: this.handTotal(hand),
      bank: this.bank(),
      choice: this.choice(),
      result: this.result(),
      rows: this.rows(),
      isReading: this.isReading(),
    };
  }
}
