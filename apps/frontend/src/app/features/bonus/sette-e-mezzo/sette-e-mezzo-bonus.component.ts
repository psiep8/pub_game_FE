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
import { SetteEMezzoTable } from './sette-e-mezzo-table.component';
import {
  BANCO_SOGLIA,
  SETTE_E_MEZZO_TARGET,
  SetteEMezzoOutcome,
  bankShouldDraw,
  handTotal,
  isBust,
  isNatural,
  settleHand,
} from '../../games/sette-e-mezzo/sette-e-mezzo-rules';
import {
  buildSetteEMezzoDeck,
  shuffleSetteEMezzoDeck,
} from '../../games/sette-e-mezzo/sette-e-mezzo-game';
import { TvPause } from '../../../shared/tv-pause';

const DECIDE_SECONDS = 15;
const REVEAL_SECONDS = 4;
const FINALE_SECONDS = 6;
const PREVIEW_REVEAL_SECONDS = 2;
const PREVIEW_FINALE_SECONDS = 3;
const PREVIEW_HIT_MS = 450;

type Outcome = SetteEMezzoOutcome;
type Status = 'WAITING' | 'ACTIVE' | Outcome;

interface Row {
  playerName: string;
  status: Status;
  points: number;
}

/**
 * BONUS SETTE E MEZZO — un turno per tavolo, dal fondo della classifica.
 *
 * La TV fa il banco una volta per ogni squadra. Il tavolo decide CARTA o STAI
 * dal telefono; il banco pesca fino a 7,25 e vince i pareggi. Il premio del bar
 * lo consegnano presentatore e barista: l'app mostra solo l'esito della mano e
 * non assegna punti. Le sconfitte non tolgono nulla.
 *
 * Riusa BLACKJACK_STATE/BLACKJACK_ACTION e il checkpoint `blackjack-hand`:
 * sono i canali già collaudati di telefoni e ripresa TV. Il gioco Blackjack
 * resta in codice ma non è più collegato a questo slot.
 */
@Component({
  selector: 'app-sette-e-mezzo-bonus',
  standalone: true,
  imports: [CommonModule, SetteEMezzoTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="semb-shell">
      <div class="semb-kicker">🃏 BONUS SETTE E MEZZO · UN TAVOLO ALLA VOLTA</div>
      <app-sette-e-mezzo-table [display]="display()" />
    </div>
  `,
  styles: [`
    .semb-shell {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: clamp(10px, 1.6vw, 20px);
      overflow: auto;
      background: var(--coal);
      color: var(--paper);
    }
    .semb-kicker {
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
export class SetteEMezzoBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  /** Banco di prova: mano da 4 secondi e scelte automatiche dei tavoli. */
  @Input() preview = false;
  /** Mano salvata sul server: se c'è, il bonus riparte da lì. */
  @Input() resume: any | null = null;
  @Input()
  set paused(value: boolean) {
    const was = this.pause.isPaused;
    this.pause.setPaused(value);
    if (this.pausedReady && was !== this.pause.isPaused) this.saveCheckpoint();
  }
  get paused(): boolean {
    return this.pause.isPaused;
  }
  @Output() finished = new EventEmitter<void>();
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
  private secondsLeft = DECIDE_SECONDS;
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

  private applyResume(state: any): void {
    const order = Array.isArray(state?.order)
      ? state.order.map((name: any) => String(name).trim()).filter((name: string) => name.length > 0)
      : [];
    if (order.length) this.order = order;

    this.index = this.clampIndex(Number(state?.index));
    this.deck = this.cardsOf(state?.deck);
    this.hand = this.cardsOf(state?.hand);
    this.bank = this.cardsOf(state?.bank);
    this.rows = Array.isArray(state?.rows)
      ? state.rows
        .filter((row: any) => row && typeof row.playerName === 'string')
        .map((row: any) => ({
          playerName: String(row.playerName),
          status: this.readStatus(row.status),
          points: 0,
        }))
      : [];

    if (this.hand.length < 2 || this.bank.length < 2) {
      this.index = 0;
      this.startHand();
      return;
    }

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
      || status === 'NATURAL' || status === 'BUST' || status === 'LOSE') {
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

    this.deck = shuffleSetteEMezzoDeck(buildSetteEMezzoDeck());
    this.hand = [this.draw(), this.draw()];
    this.bank = [this.draw(), this.draw()];
    this.rows = this.order.map((playerName, position) => {
      const previous = this.rows[position];
      return {
        playerName,
        status: position === this.index ? 'ACTIVE' : previous?.status ?? 'WAITING',
        points: 0,
      };
    });

    this.secondsLeft = DECIDE_SECONDS;
    this.publish('DECIDE');

    // Naturale: la mano si chiude subito, il banco prova a pareggiarlo.
    if (isNatural(this.hand)) {
      this.later(500, () => this.reveal(false));
      return;
    }

    if (this.preview) {
      this.later(400, () => this.previewChoice());
      return;
    }
    this.startClock(DECIDE_SECONDS, () => this.reveal(false));
  }

  private onStatus(status: any): void {
    if (status?.action !== 'BLACKJACK_ACTION') return;
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

  private hit(): void {
    this.hand = [...this.hand, this.draw()];
    this.publish('DECIDE', 'HIT');
    if (isBust(handTotal(this.hand)) || isNatural(this.hand)) {
      this.reveal(false);
      return;
    }
    if (this.preview) this.later(PREVIEW_HIT_MS, () => this.previewChoice());
  }

  /** Banco di prova: il tavolo gioca da solo con la strategia «sta a 5,5». */
  private previewChoice(): void {
    if (this.destroyed || !this.preview) return;
    if (this.display()?.phase !== 'DECIDE') return;
    if (handTotal(this.hand) < 5.5) this.hit();
    else this.reveal(true);
  }

  private reveal(stood: boolean): void {
    if (!this.display() || this.display().phase !== 'DECIDE') return;
    this.pause.clearClock();

    while (bankShouldDraw(handTotal(this.bank))) {
      this.bank = [...this.bank, this.draw()];
    }

    const playerTotal = handTotal(this.hand);
    const bankTotal = handTotal(this.bank);
    const settlement = settleHand(this.hand, this.bank);
    const outcome = settlement.outcome;
    const current = this.currentPlayer();

    this.rows = this.rows.map((row) => row.playerName === current
      ? { ...row, status: outcome, points: 0 }
      : row);

    this.secondsLeft = this.preview ? PREVIEW_REVEAL_SECONDS : REVEAL_SECONDS;
    this.publish('REVEAL', stood ? 'STAND' : 'HIT', {
      outcome,
      points: 0,
      round: this.index + 1,
      handTotal: playerTotal,
      bankTotal,
      natural: isNatural(this.hand),
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
      type: 'SETTE_E_MEZZO',
      phase,
      index: Math.min(this.index + 1, this.order.length),
      total: this.order.length,
      currentTable: this.currentPlayer(),
      stake: 0,
      cards: this.hand,
      handTotal: playerTotal,
      bank: {
        cards: phase === 'REVEAL' || phase === 'FINALE' ? this.bank : this.bank.slice(0, 1),
        total: phase === 'REVEAL' || phase === 'FINALE' ? handTotal(this.bank) : null,
        hidden: phase !== 'REVEAL' && phase !== 'FINALE',
      },
      target: SETTE_E_MEZZO_TARGET,
      bankThreshold: BANCO_SOGLIA,
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

  private saveCheckpoint(): void {
    const display = this.display();
    this.checkpoint.emit({
      type: 'SETTE_E_MEZZO',
      order: [...this.order],
      index: this.index,
      deck: [...this.deck],
      hand: [...this.hand],
      bank: [...this.bank],
      rows: this.rows.map((row) => ({ ...row })),
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

  private draw(): string {
    if (!this.deck.length) this.deck = shuffleSetteEMezzoDeck(buildSetteEMezzoDeck());
    return this.deck.pop()!;
  }
}
