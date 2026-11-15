import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { handTotal } from '../../games/blackjack/blackjack-rules';
import { Blackjack } from '../../games/blackjack/blackjack.component';

const DECIDE_SECONDS = 15;
const REVEAL_SECONDS = 4;
const FINALE_SECONDS = 6;
const WIN_POINTS = 150;
const PUSH_POINTS = 75;

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

type Outcome = 'WIN' | 'PUSH' | 'BUST' | 'LOSE';
type Status = 'WAITING' | 'ACTIVE' | Outcome;

interface Row {
  playerName: string;
  status: Status;
  points: number;
}

/**
 * BLACKJACK BONUS — un turno per tavolo, dal fondo della classifica.
 *
 * La TV fa il banco una volta per ogni squadra. Il tavolo decide CARTA o STAI
 * dal telefono; il banco si ferma a 17. Una vittoria vale 150, un pari 75, una
 * sconfitta non toglie nulla: il bonus non può far scendere la classifica.
 */
@Component({
  selector: 'app-blackjack-bonus',
  standalone: true,
  imports: [CommonModule, Blackjack],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bjb-shell">
      <div class="bjb-kicker">🃏 BONUS BLACKJACK · UN TAVOLO ALLA VOLTA</div>
      <app-blackjack [displayData]="display()" />
    </div>
  `,
  styles: [`
    .bjb-shell {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: clamp(10px, 1.6vw, 20px);
      overflow: auto;
      background: var(--coal);
      color: var(--paper);
    }
    .bjb-kicker {
      align-self: center;
      padding: 4px 12px;
      border: 2px solid var(--paper-hi);
      background: var(--tomato);
      color: var(--paper-hi);
      font-family: var(--font-mono);
      font-size: clamp(.6rem, .9vw, .8rem);
      font-weight: 700;
      letter-spacing: .16em;
      transform: rotate(-1deg);
    }
  `],
})
export class BlackjackBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly display = signal<any>(null);

  private order: string[] = [];
  private index = 0;
  private deck: string[] = [];
  private hand: string[] = [];
  private bank: string[] = [];
  private rows: Row[] = [];
  private handPoints = 0;
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private destroyed = false;

  ngOnInit(): void {
    this.order = [...this.players].reverse();
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(500, () => this.startHand());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearClock();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  private startHand(): void {
    if (this.destroyed) return;

    if (!this.order.length || this.index >= this.order.length) {
      this.finale();
      return;
    }

    this.deck = this.shuffle(this.buildDeck());
    this.hand = [this.draw(), this.draw()];
    this.bank = [this.draw(), this.draw()];
    this.handPoints = 0;
    this.rows = this.order.map((playerName, position) => {
      const previous = this.rows[position];
      return {
        playerName,
        status: position === this.index ? 'ACTIVE' : previous?.status ?? 'WAITING',
        points: previous?.points ?? 0,
      };
    });

    this.publish('DECIDE');
    this.startClock(DECIDE_SECONDS, () => this.reveal(false));
  }

  private onStatus(status: any): void {
    if (status?.action !== 'BLACKJACK_ACTION') return;
    const state = this.display();
    if (!state || state.phase !== 'DECIDE') return;

    const playerName = String(status.playerName ?? '').trim();
    const current = this.currentPlayer();
    if (!playerName || playerName !== current) return;

    const kind = String(status.kind ?? '').toUpperCase();
    if (kind === 'STAND') {
      this.reveal(true);
      return;
    }
    if (kind !== 'HIT') return;

    this.hand = [...this.hand, this.draw()];
    this.publish('DECIDE', 'HIT');
    if (handTotal(this.hand) >= 21) this.reveal(false);
  }

  private reveal(stood: boolean): void {
    if (!this.display() || this.display().phase !== 'DECIDE') return;
    this.clearClock();

    while (handTotal(this.bank) < 17) this.bank = [...this.bank, this.draw()];

    const playerTotal = handTotal(this.hand);
    const bankTotal = handTotal(this.bank);
    let outcome: Outcome;
    let points = 0;

    if (playerTotal > 21) {
      outcome = 'BUST';
    } else if (bankTotal > 21 || playerTotal > bankTotal) {
      outcome = 'WIN';
      points = WIN_POINTS;
    } else if (playerTotal === bankTotal) {
      outcome = 'PUSH';
      points = PUSH_POINTS;
    } else {
      outcome = 'LOSE';
    }

    this.handPoints = points;
    const current = this.currentPlayer();
    this.rows = this.rows.map((row) => row.playerName === current
      ? { ...row, status: outcome, points }
      : row);

    if (points > 0 && current) this.result.emit({ playerName: current, score: points });

    this.publish('REVEAL', stood ? 'STAND' : 'HIT', {
      outcome,
      points,
      round: this.index + 1,
      handTotal: playerTotal,
      bankTotal,
    });

    this.later(REVEAL_SECONDS * 1000, () => {
      this.index += 1;
      this.startHand();
    });
  }

  private publish(
    phase: 'DECIDE' | 'REVEAL' | 'FINALE',
    choice: 'HIT' | 'STAND' | null = null,
    result: any = null,
  ): void {
    const playerTotal = handTotal(this.hand);
    this.display.set({
      phase,
      index: Math.min(this.index + 1, this.order.length),
      total: this.order.length,
      currentTable: this.currentPlayer(),
      stake: WIN_POINTS,
      cards: this.hand,
      handTotal: playerTotal,
      bank: {
        cards: phase === 'REVEAL' || phase === 'FINALE' ? this.bank : this.bank.slice(0, 1),
        total: phase === 'REVEAL' || phase === 'FINALE' ? handTotal(this.bank) : null,
        hidden: phase !== 'REVEAL' && phase !== 'FINALE',
      },
      choice,
      result,
      rows: this.rows,
    });

    this.ws.broadcastStatus(this.gameId, {
      action: 'BLACKJACK_STATE',
      state: this.display(),
    });
  }

  private finale(): void {
    if (this.destroyed) return;
    this.publish('FINALE');
    this.later(FINALE_SECONDS * 1000, () => this.finished.emit());
  }

  private currentPlayer(): string {
    return this.order[this.index] ?? '';
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.clearClock();
    let left = seconds;
    this.clock = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        this.clearClock();
        onEnd();
      }
    }, 1000);
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private later(ms: number, action: () => void): void {
    this.timers.push(setTimeout(() => {
      if (!this.destroyed) action();
    }, ms));
  }

  private buildDeck(): string[] {
    return RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
  }

  private draw(): string {
    if (!this.deck.length) this.deck = this.shuffle(this.buildDeck());
    return this.deck.pop()!;
  }

  private shuffle(cards: string[]): string[] {
    const copy = [...cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
