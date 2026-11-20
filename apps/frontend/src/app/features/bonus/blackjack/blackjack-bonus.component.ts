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
import { TvPause } from '../../../shared/tv-pause';

const DECIDE_SECONDS = 15;
const REVEAL_SECONDS = 4;
const FINALE_SECONDS = 6;
/** Banco di prova: mano corta e tavolo che gioca da solo. */
const PREVIEW_REVEAL_SECONDS = 2;
const PREVIEW_FINALE_SECONDS = 3;
const PREVIEW_HIT_MS = 450;
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
  /** Banco di prova: mano da 4 secondi e scelte automatiche dei tavoli. */
  @Input() preview = false;
  /** Mano salvata sul server: se c'è, il bonus riparte da lì. */
  @Input() resume: any | null = null;
  /**
   * Pausa della TV: ferma la decisione e il passaggio di mano senza toccare
   * regole e punti. Lo stato arriva dalla TV, come per le Biglie.
   */
  @Input()
  set paused(value: boolean) {
    const was = this.pause.isPaused;
    this.pause.setPaused(value);
    // La pausa è uno stato del bonus: senza checkpoint, un refresh della TV
    // riaprirebbe la mano già in corsa.
    if (this.pausedReady && was !== this.pause.isPaused) this.saveCheckpoint();
  }
  get paused(): boolean {
    return this.pause.isPaused;
  }
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();
  /** Mano corrente, da salvare sul server a ogni cambio di stato. */
  @Output() checkpoint = new EventEmitter<any>();

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
  private secondsLeft = DECIDE_SECONDS;
  /** Pausa, cronometro e attese: un solo posto per fermarli e riarmarli. */
  /** Input iniziale applicato: da lì in poi ogni cambio di pausa va nel checkpoint. */
  private pausedReady = false;
  private readonly pause = new TvPause();
  private destroyed = false;

  ngOnInit(): void {
    this.pausedReady = true;
    this.order = [...this.players].reverse();
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    if (this.resume) {
      this.applyResume(this.resume);
      return;
    }
    this.later(500, () => this.startHand());
  }

  /**
   * Riprende la mano salvata sul server senza ridistribuire: la TV resta sullo
   * stesso tavolo, con le carte già uscite e il tempo che avanza.
   */
  private applyResume(state: any): void {
    const order = Array.isArray(state?.order)
      ? state.order.map((name: any) => String(name).trim()).filter((name: string) => name.length > 0)
      : [];
    if (order.length) this.order = order;

    this.index = this.clampIndex(Number(state?.index));
    this.deck = this.cardsOf(state?.deck);
    this.hand = this.cardsOf(state?.hand);
    this.bank = this.cardsOf(state?.bank);
    this.handPoints = Number(state?.handPoints) || 0;
    this.rows = Array.isArray(state?.rows)
      ? state.rows
        .filter((row: any) => row && typeof row.playerName === 'string')
        .map((row: any) => ({
          playerName: String(row.playerName),
          status: this.readStatus(row.status),
          points: Number(row.points) || 0,
        }))
      : [];

    // Una mano senza carte non è giocabile: si riparte dalla prima.
    if (this.hand.length < 2 || this.bank.length < 2) {
      this.index = 0;
      this.startHand();
      return;
    }

    // I tavoli già chiusi non sono stati pagati (il bonus paga alla fine):
    // rimandandoli alla TV si ricostruisce il totale dopo il refresh.
    this.rows
      .filter((row) => row.points > 0)
      .forEach((row) => this.result.emit({ playerName: row.playerName, score: row.points }));

    const savedSeconds = Number(state?.secondsLeft);
    const savedAt = Number(state?.savedAt);
    const elapsed = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      : 0;
    const seconds = Number.isFinite(savedSeconds)
      ? Math.max(0, Math.round(savedSeconds) - elapsed)
      : DECIDE_SECONDS;

    const phase = String(state?.phase ?? 'DECIDE');
    const choice = state?.choice === 'HIT' || state?.choice === 'STAND' ? state.choice : null;
    const result = state?.result && typeof state.result === 'object' ? state.result : null;

    this.secondsLeft = seconds;

    if (phase === 'FINALE' || this.index >= this.order.length) {
      this.index = this.order.length;
      this.publish('FINALE');
      this.later(seconds * 1000, () => this.finished.emit());
      return;
    }

    if (phase === 'REVEAL' && result) {
      // Esito già calcolato: non si rigioca la mano, si mostra e si passa.
      this.publish('REVEAL', choice, result);
      this.later(seconds * 1000, () => {
        this.index += 1;
        this.startHand();
      });
      return;
    }

    this.publish('DECIDE', choice);
    this.startClock(seconds, () => this.reveal(false));
  }

  private clampIndex(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(0, Math.floor(value)), Math.max(0, this.order.length));
  }

  private cardsOf(value: unknown): string[] {
    return Array.isArray(value) ? value.map((card) => String(card)) : [];
  }

  private readStatus(value: unknown): Status {
    const status = String(value);
    if (status === 'ACTIVE' || status === 'WAITING' || status === 'WIN'
      || status === 'PUSH' || status === 'BUST' || status === 'LOSE') {
      return status;
    }
    return 'WAITING';
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.pause.dispose();
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

    this.secondsLeft = DECIDE_SECONDS;
    this.publish('DECIDE');
    if (this.preview) {
      // Banco di prova: la mano la chiude il tavolo demo, senza conto alla
      // rovescia che possa tagliare la sequenza delle carte.
      this.later(400, () => this.previewChoice());
      return;
    }
    this.startClock(DECIDE_SECONDS, () => this.reveal(false));
  }

  private onStatus(status: any): void {
    if (status?.action !== 'BLACKJACK_ACTION') return;
    // Pausa della TV: la mossa arrivata dal telefono nel frattempo non conta.
    if (this.pause.isSuspended) return;
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

    this.hit();
  }

  /** Una carta in più: la stessa mossa del telefono e del banco di prova. */
  private hit(): void {
    this.hand = [...this.hand, this.draw()];
    this.publish('DECIDE', 'HIT');
    if (handTotal(this.hand) >= 21) {
      this.reveal(false);
      return;
    }
    if (this.preview) this.later(PREVIEW_HIT_MS, () => this.previewChoice());
  }

  /** Banco di prova: il tavolo gioca da solo, con la regola del banco a 17. */
  private previewChoice(): void {
    if (this.destroyed || !this.preview) return;
    if (this.display()?.phase !== 'DECIDE') return;
    if (handTotal(this.hand) < 17) this.hit();
    else this.reveal(true);
  }

  private reveal(stood: boolean): void {
    if (!this.display() || this.display().phase !== 'DECIDE') return;
    this.pause.clearClock();

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

    this.secondsLeft = this.preview ? PREVIEW_REVEAL_SECONDS : REVEAL_SECONDS;
    this.publish('REVEAL', stood ? 'STAND' : 'HIT', {
      outcome,
      points,
      round: this.index + 1,
      handTotal: playerTotal,
      bankTotal,
    });

    this.later(this.secondsLeft * 1000, () => {
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
    this.saveCheckpoint();
  }

  /** Mano completa: carte, mazzo, tavoli, fase e tempo residuo. */
  private saveCheckpoint(): void {
    const display = this.display();
    this.checkpoint.emit({
      order: [...this.order],
      index: this.index,
      deck: [...this.deck],
      hand: [...this.hand],
      bank: [...this.bank],
      rows: this.rows.map((row) => ({ ...row })),
      handPoints: this.handPoints,
      phase: display?.phase ?? 'DECIDE',
      choice: display?.choice ?? null,
      result: display?.result ?? null,
      secondsLeft: this.secondsLeft,
      paused: this.paused,
      savedAt: Date.now(),
    });
  }

  private finale(): void {
    if (this.destroyed) return;
    this.secondsLeft = this.preview ? PREVIEW_FINALE_SECONDS : FINALE_SECONDS;
    this.publish('FINALE');
    this.later(this.secondsLeft * 1000, () => this.finished.emit());
  }

  private currentPlayer(): string {
    return this.order[this.index] ?? '';
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.pause.clearClock();
    this.secondsLeft = seconds;
    this.pause.startClock(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      if (this.secondsLeft > 0) return true;
      onEnd();
      return false;
    });
  }

  private later(ms: number, action: () => void): void {
    this.pause.later(ms, () => {
      if (!this.destroyed) action();
    });
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
