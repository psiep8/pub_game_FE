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
import { WebSocketService } from '../../../services/web-socket.service';

type Phase =
  | 'INTRO'
  | 'COLORS_PICK'
  | 'COLORS_REVEAL'
  | 'NUMBERS_PICK'
  | 'NUMBERS_REVEAL'
  | 'BJ_PICK'
  | 'BJ_REVEAL'
  | 'FINALE';

interface Row {
  playerName: string;
  label: string;
  points: number;
}

interface Reveal {
  heading: string;
  rows: Row[];
}

interface HandView {
  playerName: string;
  cards: string[];
  total: number;
}

interface DealerView {
  cards: string[];
  total: number;
  hidden: boolean;
}

const COLORS = ['ROSSO', 'NERO', 'VERDE', 'BLU', 'GIALLO', 'BIANCO'];
const COLOR_HEX: Record<string, string> = {
  ROSSO: '#dc2626',
  NERO: '#1f2937',
  VERDE: '#16a34a',
  BLU: '#2563eb',
  GIALLO: '#facc15',
  BIANCO: '#f8fafc',
};
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * CASINO — bonus unico di fine atto, tre manche:
 * roulette colori, roulette numerata e Black Jack.
 *
 * La TV tiene il banco e i punteggi; i telefoni mandano solo una scelta
 * (CASINO_ACTION). Nessun premio in classifica: i punti del bonus restano
 * nel riepilogo finché non verrà decisa la politica premi.
 */
@Component({
  selector: 'app-casino-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="casino-overlay">
      <div class="casino-card">
        <header class="casino-head">
          <div>
            <div class="casino-kicker">🎰 CASINO · BONUS DI FINE ATTO</div>
            <h1>MANCHE {{ manche() || 1 }} / 3 · {{ title() }}</h1>
            <p class="casino-rule">{{ rule() }}</p>
          </div>
          @if (secondsLeft() > 0) {
            <div class="casino-timer">{{ secondsLeft() }}s</div>
          }
        </header>

        @switch (phase()) {
          @case ('COLORS_PICK') {
            <div class="casino-colors">
              @for (color of options(); track color) {
                <div class="casino-color-chip" [style.background]="colorHex(color)">
                  <span>{{ color }}</span>
                  <b>{{ votesFor(color) }}</b>
                </div>
              }
            </div>
            <p class="casino-hint">Scegli un colore sul telefono. Il colore vincente vale 100 punti.</p>
          }

          @case ('NUMBERS_PICK') {
            <div class="casino-numbers">
              @for (number of options(); track number) {
                <div class="casino-number" [class.picked]="votesFor(number) > 0">
                  {{ number }}
                  @if (votesFor(number) > 0) { <b>{{ votesFor(number) }}</b> }
                </div>
              }
            </div>
            <p class="casino-hint">Scegli un numero da 0 a 36. Il numero esatto vale 300 punti.</p>
          }

          @case ('BJ_PICK') {
            <div class="casino-table">
              <div class="casino-dealer">
                <span class="casino-hand-label">BANCO</span>
                <div class="casino-cards">
                  @for (card of dealer().cards; track $index) {
                    <span class="casino-card" [class.red]="isRed(card)">{{ card }}</span>
                  }
                  <span class="casino-card back">?</span>
                </div>
                <b class="casino-hand-total">{{ dealer().total }}</b>
              </div>
              <div class="casino-hands">
                @for (hand of hands(); track hand.playerName) {
                  <div class="casino-hand-card">
                    <span class="casino-hand-name">{{ hand.playerName }}</span>
                    <div class="casino-cards">
                      @for (card of hand.cards; track $index) {
                        <span class="casino-card" [class.red]="isRed(card)">{{ card }}</span>
                      }
                    </div>
                    <b class="casino-hand-total" [class.bust]="hand.total > 21">{{ hand.total }}</b>
                  </div>
                }
              </div>
            </div>
            <p class="casino-hint">Tocca CARTA o STO sul telefono. Il banco pesca fino a 17.</p>
          }

          @case ('INTRO') {
            <div class="casino-intro">
              <span class="casino-dice">🎲</span>
              <p>Tre manche: colori, numeri, Black Jack.</p>
            </div>
          }

          @case ('FINALE') {
            <div class="casino-finale">
              <span class="casino-finale-kicker">CLASSIFICA BONUS</span>
              @for (row of totals(); track row.playerName; let i = $index) {
                <div class="casino-finale-row" [class.top]="i === 0">
                  <span>{{ i + 1 }}. {{ row.playerName }}</span>
                  <b>{{ row.score }}</b>
                </div>
              }
              @if (!totals().length) {
                <p class="casino-hint">Nessun punto registrato.</p>
              }
            </div>
          }
        }

        @if (winningColor(); as color) {
          <div class="casino-win">
            <span class="casino-win-label">COLORE VINCENTE</span>
            <b class="casino-win-value" [style.color]="colorHex(color)">{{ color }}</b>
          </div>
        }

        @if (winningNumber() !== null) {
          <div class="casino-win">
            <span class="casino-win-label">NUMERO VINCENTE</span>
            <b class="casino-win-value number">{{ winningNumber() }}</b>
          </div>
        }

        @if (phase() === 'BJ_REVEAL') {
          <div class="casino-dealer reveal">
            <span class="casino-hand-label">BANCO</span>
            <div class="casino-cards">
              @for (card of dealer().cards; track $index) {
                <span class="casino-card" [class.red]="isRed(card)">{{ card }}</span>
              }
            </div>
            <b class="casino-hand-total" [class.bust]="dealer().total > 21">{{ dealer().total }}</b>
          </div>
        }

        @if (reveal(); as rev) {
          <div class="casino-reveal">
            <div class="casino-reveal-head">{{ rev.heading }}</div>
            <div class="casino-rows">
              @for (row of rev.rows; track row.playerName) {
                <div class="casino-row" [class.win]="row.points > 0">
                  <span class="casino-row-name">{{ row.playerName }}</span>
                  <span class="casino-row-label">{{ row.label }}</span>
                  <b>{{ row.points > 0 ? '+' : '' }}{{ row.points }}</b>
                </div>
              }
              @if (!rev.rows.length) {
                <p class="casino-hint">Nessuna giocata su questa manche.</p>
              }
            </div>
          </div>
        }

        @if (totals().length) {
          <footer class="casino-totals">
            @for (row of totals(); track row.playerName) {
              <div class="casino-total">
                <span>{{ row.playerName }}</span>
                <b>{{ row.score }}</b>
              </div>
            }
          </footer>
        }
      </div>
    </div>
  `,
  styles: [`
    .casino-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(12px, 2vw, 28px);
      overflow: auto;
      background: radial-gradient(circle at 50% 0%, #1f2937 0%, #0b1020 55%, #05070f 100%);
      color: #f8fafc;
    }
    .casino-card {
      width: min(1400px, 96vw);
      max-height: 94vh;
      overflow: auto;
      padding: clamp(16px, 2.4vw, 34px);
      border: 3px solid #334155;
      border-radius: 24px;
      background: linear-gradient(165deg, #111827, #0b1020);
      box-shadow: 0 30px 90px rgba(0, 0, 0, .55);
    }
    .casino-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
    }
    .casino-kicker {
      color: #fbbf24;
      font-family: var(--font-mono, monospace);
      font-size: clamp(.6rem, .9vw, .78rem);
      font-weight: 700;
      letter-spacing: .22em;
    }
    .casino-head h1 {
      margin: 6px 0 4px;
      font-family: var(--font-display, inherit);
      font-size: clamp(1.4rem, 3vw, 2.5rem);
      line-height: 1;
      text-transform: uppercase;
    }
    .casino-rule { margin: 0; color: #94a3b8; font-size: clamp(.78rem, 1.1vw, 1rem); }
    .casino-timer {
      flex: 0 0 auto;
      padding: 10px 18px;
      border: 2px solid #fbbf24;
      border-radius: 14px;
      background: rgba(251, 191, 36, .12);
      color: #fbbf24;
      font-family: var(--font-mono, monospace);
      font-size: clamp(1.4rem, 2.4vw, 2.2rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .casino-colors {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: clamp(8px, 1vw, 14px);
    }
    .casino-color-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: clamp(14px, 2vw, 26px) 6px;
      border: 3px solid rgba(255, 255, 255, .25);
      border-radius: 16px;
      color: #fff;
      text-shadow: 0 2px 8px rgba(0, 0, 0, .45);
      font-weight: 900;
      letter-spacing: .06em;
    }
    .casino-color-chip b {
      min-width: 28px;
      padding: 1px 8px;
      border-radius: 999px;
      background: rgba(0, 0, 0, .45);
      font-family: var(--font-mono, monospace);
      font-size: .85rem;
    }
    .casino-numbers {
      display: grid;
      grid-template-columns: repeat(13, 1fr);
      gap: 6px;
    }
    .casino-number {
      position: relative;
      display: grid;
      place-items: center;
      min-height: clamp(34px, 4.2vh, 52px);
      border: 2px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      font-family: var(--font-mono, monospace);
      font-size: clamp(.8rem, 1.2vw, 1.15rem);
      font-weight: 700;
    }
    .casino-number.picked {
      border-color: #fbbf24;
      background: rgba(251, 191, 36, .16);
      color: #fbbf24;
    }
    .casino-number b {
      position: absolute;
      top: -6px;
      right: -6px;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fbbf24;
      color: #111827;
      font-size: .62rem;
    }
    .casino-hint { margin: 14px 0 0; color: #94a3b8; font-size: clamp(.76rem, 1vw, .95rem); text-align: center; }
    .casino-table {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) 3fr;
      gap: clamp(12px, 2vw, 24px);
      align-items: start;
    }
    .casino-dealer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border: 2px solid #475569;
      border-radius: 16px;
      background: #0f172a;
    }
    .casino-dealer.reveal { margin: 14px auto 0; max-width: 420px; }
    .casino-hand-label {
      color: #fbbf24;
      font-family: var(--font-mono, monospace);
      font-size: .68rem;
      font-weight: 700;
      letter-spacing: .2em;
    }
    .casino-hands {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }
    .casino-hand-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
      border: 2px solid #475569;
      border-radius: 14px;
      background: #0f172a;
    }
    .casino-hand-name { color: #cbd5e1; font-size: .84rem; font-weight: 700; }
    .casino-cards { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
    .casino-card {
      display: inline-grid;
      place-items: center;
      min-width: 40px;
      height: 54px;
      padding: 0 4px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      color: #0f172a;
      font-family: var(--font-mono, monospace);
      font-size: .95rem;
      font-weight: 800;
    }
    .casino-card.red { color: #dc2626; }
    .casino-card.back { background: #1e293b; color: #64748b; border-color: #334155; }
    .casino-hand-total { font-family: var(--font-mono, monospace); font-size: 1.35rem; }
    .casino-hand-total.bust { color: #f87171; }
    .casino-win {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin: 16px 0 0;
      padding: 12px;
      border: 2px solid rgba(251, 191, 36, .35);
      border-radius: 16px;
      background: rgba(251, 191, 36, .08);
    }
    .casino-win-label { color: #94a3b8; font-family: var(--font-mono, monospace); font-size: .66rem; letter-spacing: .2em; }
    .casino-win-value { font-family: var(--font-display, inherit); font-size: clamp(2rem, 5vw, 4.2rem); line-height: 1; }
    .casino-win-value.number { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-reveal { margin-top: 14px; }
    .casino-reveal-head {
      margin-bottom: 8px;
      color: #a3e635;
      font-family: var(--font-mono, monospace);
      font-size: clamp(.72rem, 1vw, .9rem);
      font-weight: 700;
      letter-spacing: .12em;
      text-align: center;
    }
    .casino-rows { display: flex; flex-direction: column; gap: 6px; }
    .casino-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 8px 14px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      font-size: clamp(.78rem, 1vw, .95rem);
    }
    .casino-row.win { border-color: #a3e635; background: rgba(163, 230, 53, .1); }
    .casino-row-label { color: #94a3b8; font-family: var(--font-mono, monospace); }
    .casino-row b { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-totals {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #1e293b;
    }
    .casino-total {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 5px 12px;
      border-radius: 999px;
      background: #0f172a;
      border: 1px solid #334155;
      font-size: .84rem;
    }
    .casino-total b { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-intro { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px; color: #cbd5e1; }
    .casino-dice { font-size: 4rem; animation: casinoFloat 1.4s ease-in-out infinite alternate; }
    @keyframes casinoFloat { to { transform: translateY(-8px) rotate(-8deg); } }
    .casino-finale { display: flex; flex-direction: column; gap: 8px; max-width: 760px; margin: 0 auto; }
    .casino-finale-kicker { color: #fbbf24; font-family: var(--font-mono, monospace); font-size: .72rem; letter-spacing: .2em; text-align: center; }
    .casino-finale-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 16px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      font-size: clamp(.9rem, 1.3vw, 1.2rem);
    }
    .casino-finale-row.top { border-color: #fbbf24; background: rgba(251, 191, 36, .12); }
    .casino-finale-row b { color: #fbbf24; font-family: var(--font-mono, monospace); }
  `],
})
export class CasinoBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  private ws = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);

  readonly phase = signal<Phase>('INTRO');
  readonly manche = signal(0);
  readonly title = signal('CASINO');
  readonly rule = signal('');
  readonly secondsLeft = signal(0);
  readonly options = signal<string[]>([]);
  readonly winningColor = signal<string | null>(null);
  readonly winningNumber = signal<number | null>(null);
  readonly reveal = signal<Reveal | null>(null);
  readonly dealer = signal<DealerView>({ cards: [], total: 0, hidden: true });
  readonly hands = signal<HandView[]>([]);
  readonly totals = signal<Array<{ playerName: string; score: number }>>([]);
  readonly votesView = signal<Array<{ playerName: string; choice: string }>>([]);

  private readonly votes = new Map<string, string>();
  private readonly scoreMap = new Map<string, number>();
  private readonly handsMap = new Map<string, string[]>();
  private dealerCards: string[] = [];
  private deck: string[] = [];
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private voteEnd: (() => void) | null = null;
  private voteClosed = true;

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(2500, () => this.startColors());
  }

  ngOnDestroy(): void {
    this.clearClock();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  colorHex(color: string): string {
    return COLOR_HEX[color] ?? '#64748b';
  }

  isRed(card: string): boolean {
    return card.includes('♥') || card.includes('♦');
  }

  votesFor(choice: string): number {
    return this.votesView().filter((vote) => vote.choice === choice).length;
  }

  private onStatus(status: any): void {
    if (status?.action !== 'CASINO_ACTION') return;

    const phase = this.phase();
    if (phase !== 'COLORS_PICK' && phase !== 'NUMBERS_PICK' && phase !== 'BJ_PICK') return;

    const playerName = String(status.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (Number(status.manche) !== this.manche()) return;

    const choice = String(status.choice ?? '').trim();
    if (!choice) return;
    if (phase === 'COLORS_PICK' && !COLORS.includes(choice)) return;
    if (phase === 'NUMBERS_PICK' && !this.validNumber(choice)) return;
    if (phase === 'BJ_PICK' && choice !== 'HIT' && choice !== 'STAND') return;
    if (this.votes.has(playerName)) return;

    this.votes.set(playerName, choice);
    this.publish();
    this.finishVoteEarly();
  }

  private validNumber(choice: string): boolean {
    if (!/^\d{1,2}$/.test(choice)) return false;
    const value = Number(choice);
    return Number.isInteger(value) && value >= 0 && value <= 36;
  }

  private startColors(): void {
    this.manche.set(1);
    this.title.set('ROULETTE COLORI');
    this.rule.set('Indovina il colore: 100 punti.');
    this.options.set([...COLORS]);
    this.winningColor.set(null);
    this.winningNumber.set(null);
    this.reveal.set(null);
    this.hands.set([]);
    this.beginVote('COLORS_PICK', 12, () => this.revealColors());
  }

  private revealColors(): void {
    this.phase.set('COLORS_REVEAL');
    const winner = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.winningColor.set(winner);

    const rows: Row[] = this.players.map((playerName) => {
      const pick = this.votes.get(playerName) ?? '';
      const points = pick === winner ? 100 : 0;
      if (points) this.addPoints(playerName, points);
      return { playerName, label: pick || '—', points };
    });

    this.reveal.set({ heading: `COLORE VINCENTE: ${winner}`, rows });
    this.secondsLeft.set(0);
    this.publish();
    this.emitRows(rows);
    this.later(5000, () => this.startNumbers());
  }

  private startNumbers(): void {
    this.manche.set(2);
    this.title.set('ROULETTE NUMERATA');
    this.rule.set('Indovina il numero esatto: 300 punti.');
    this.options.set(Array.from({ length: 37 }, (_, index) => String(index)));
    this.winningColor.set(null);
    this.winningNumber.set(null);
    this.reveal.set(null);
    this.beginVote('NUMBERS_PICK', 15, () => this.revealNumbers());
  }

  private revealNumbers(): void {
    this.phase.set('NUMBERS_REVEAL');
    const winner = Math.floor(Math.random() * 37);
    this.winningNumber.set(winner);

    const rows: Row[] = this.players.map((playerName) => {
      const pick = this.votes.get(playerName) ?? '';
      const points = pick && Number(pick) === winner ? 300 : 0;
      if (points) this.addPoints(playerName, points);
      return { playerName, label: pick || '—', points };
    });

    this.reveal.set({ heading: `NUMERO VINCENTE: ${winner}`, rows });
    this.secondsLeft.set(0);
    this.publish();
    this.emitRows(rows);
    this.later(5000, () => this.startBlackjack());
  }

  private startBlackjack(): void {
    this.manche.set(3);
    this.title.set('BLACK JACK');
    this.rule.set('Batti il banco: 150 punti. Pari: 50. Blackjack: 250.');
    this.options.set(['HIT', 'STAND']);
    this.winningColor.set(null);
    this.winningNumber.set(null);
    this.reveal.set(null);
    this.handsMap.clear();
    this.deck = this.buildDeck();

    this.players.forEach((playerName) => {
      this.handsMap.set(playerName, [this.drawCard(), this.drawCard()]);
    });

    this.dealerCards = [this.drawCard(), this.drawCard()];
    this.dealer.set({
      cards: [this.dealerCards[0]],
      total: this.handTotal([this.dealerCards[0]]),
      hidden: true,
    });
    this.refreshHands();

    this.beginVote('BJ_PICK', 15, () => this.revealBlackjack());
  }

  private revealBlackjack(): void {
    this.phase.set('BJ_REVEAL');

    this.players.forEach((playerName) => {
      const cards = this.handsMap.get(playerName) ?? [];
      if ((this.votes.get(playerName) ?? 'STAND') === 'HIT') {
        cards.push(this.drawCard());
        this.handsMap.set(playerName, cards);
      }
    });

    while (this.handTotal(this.dealerCards) < 17) {
      this.dealerCards.push(this.drawCard());
    }
    const dealerTotal = this.handTotal(this.dealerCards);
    this.dealer.set({ cards: [...this.dealerCards], total: dealerTotal, hidden: false });
    this.refreshHands();

    const rows: Row[] = this.players.map((playerName) => {
      const cards = this.handsMap.get(playerName) ?? [];
      const total = this.handTotal(cards);
      let points = 0;

      if (total <= 21) {
        if (cards.length === 2 && total === 21) {
          points = 250;
        } else if (dealerTotal > 21 || total > dealerTotal) {
          points = 150;
        } else if (total === dealerTotal) {
          points = 50;
        }
      }

      if (points) this.addPoints(playerName, points);
      return { playerName, label: `${total} vs ${dealerTotal}`, points };
    });

    this.reveal.set({ heading: `BANCO: ${dealerTotal}`, rows });
    this.secondsLeft.set(0);
    this.publish();
    this.emitRows(rows);
    this.later(7000, () => this.finale());
  }

  private finale(): void {
    this.phase.set('FINALE');
    this.secondsLeft.set(0);
    this.publish();
    this.later(7000, () => this.finished.emit());
  }

  private beginVote(phase: Phase, seconds: number, onEnd: () => void): void {
    this.clearClock();
    this.votes.clear();
    this.votesView.set([]);
    this.voteEnd = onEnd;
    this.voteClosed = false;
    this.phase.set(phase);
    this.secondsLeft.set(seconds);
    this.publish();

    this.clock = setInterval(() => {
      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();
      if (next <= 0) {
        this.clearClock();
        this.closeVote();
      }
    }, 1000);
  }

  private finishVoteEarly(): void {
    if (this.voteClosed) return;
    if (this.players.length === 0) return;
    if (!this.players.every((playerName) => this.votes.has(playerName))) return;
    this.clearClock();
    this.closeVote();
  }

  private closeVote(): void {
    if (this.voteClosed) return;
    this.voteClosed = true;
    const end = this.voteEnd;
    this.voteEnd = null;
    end?.();
  }

  private publish(): void {
    this.votesView.set(
      [...this.votes.entries()].map(([playerName, choice]) => ({ playerName, choice })),
    );
    this.ws.broadcastStatus(this.gameId, {
      action: 'CASINO_STATE',
      state: {
        phase: this.phase(),
        manche: this.manche(),
        title: this.title(),
        rule: this.rule(),
        secondsLeft: this.secondsLeft(),
        options: this.options(),
        votes: this.votesView(),
        winningColor: this.winningColor(),
        winningNumber: this.winningNumber(),
        hands: Object.fromEntries(
          this.hands().map((hand) => [hand.playerName, { cards: hand.cards, total: hand.total }]),
        ),
        dealer: this.dealer(),
        reveal: this.reveal(),
        scores: this.totals(),
      },
    });
  }

  private refreshHands(): void {
    this.hands.set(
      this.players.map((playerName) => {
        const cards = this.handsMap.get(playerName) ?? [];
        return { playerName, cards, total: this.handTotal(cards) };
      }),
    );
  }

  private addPoints(playerName: string, points: number): void {
    this.scoreMap.set(playerName, (this.scoreMap.get(playerName) ?? 0) + points);
    this.totals.set(
      [...this.scoreMap.entries()]
        .map(([name, score]) => ({ playerName: name, score }))
        .sort((a, b) => b.score - a.score),
    );
  }

  private emitRows(rows: Row[]): void {
    rows
      .filter((row) => row.points > 0)
      .forEach((row) => this.result.emit({ playerName: row.playerName, score: row.points }));
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

  private drawCard(): string {
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

  private later(ms: number, action: () => void): void {
    this.timers.push(setTimeout(action, ms));
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }
}
