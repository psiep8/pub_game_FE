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
import { GameService } from '../../../services/game.service';
import { WebSocketService } from '../../../services/web-socket.service';

type Phase = 'INTRO' | 'CATEGORY' | 'LOADING' | 'QUESTION' | 'REVEAL' | 'FINALE';

interface Row {
  playerName: string;
  label: string;
  points: number;
}

interface Reveal {
  heading: string;
  rows: Row[];
}

interface Category {
  id: number;
  name: string;
  emoji?: string;
  active?: boolean;
}

const FLASH_QUESTIONS = 8;
const CATEGORY_SECONDS = 15;
const QUESTION_SECONDS = 10;
const REVEAL_MS = 4500;

/**
 * CAVALLO DI BATTAGLIA — bonus unico di fine atto.
 *
 * Prima del round la squadra sceglie una categoria (voto dai telefoni); poi
 * arrivano otto domande flash difficili di quella categoria. Ogni risposta
 * esatta vale 100 punti, la prima esatta della manche altri 50.
 */
@Component({
  selector: 'app-cavallo-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cav-overlay">
      <div class="cav-card">
        <header class="cav-head">
          <div>
            <div class="cav-kicker">🐎 CAVALLO DI BATTAGLIA · BONUS DI FINE ATTO</div>
            @if (phase() === 'QUESTION' || phase() === 'REVEAL') {
              <h1>DOMANDA {{ index() + 1 }} / {{ total() }}</h1>
              <p class="cav-sub">{{ chosenCategory() }}</p>
            } @else {
              <h1>OTTO DOMANDE FLASH</h1>
              <p class="cav-sub">Una categoria scelta dalla squadra, poi si corre.</p>
            }
          </div>
          @if (secondsLeft() > 0) {
            <div class="cav-timer">{{ secondsLeft() }}s</div>
          }
        </header>

        @switch (phase()) {
          @case ('INTRO') {
            <div class="cav-intro">
              <span class="cav-horse">🐎</span>
              <p>La squadra sceglie la categoria. Poi otto domande difficili, una dopo l'altra.</p>
            </div>
          }

          @case ('CATEGORY') {
            <p class="cav-prompt">Scegli la categoria sul telefono</p>
            <div class="cav-categories">
              @for (category of categoryNames(); track category) {
                <div class="cav-category" [class.voted]="categoryVotes(category) > 0">
                  <span>{{ category }}</span>
                  @if (categoryVotes(category) > 0) {
                    <b>{{ categoryVotes(category) }}</b>
                  }
                </div>
              }
            </div>
          }

          @case ('LOADING') {
            <div class="cav-intro">
              <span class="cav-horse run">🐎</span>
              <p>Preparo otto domande difficili di {{ chosenCategory() }}…</p>
            </div>
          }

          @case ('QUESTION') {
            @if (question(); as q) {
              <div class="cav-question">{{ q.text }}</div>
              <div class="cav-options" [class.two]="q.options.length <= 2">
                @for (option of q.options; track $index; let i = $index) {
                  <div class="cav-option">
                    <span class="cav-letter">{{ letter(i) }}</span>
                    <span>{{ option }}</span>
                  </div>
                }
              </div>
              <p class="cav-hint">Rispondi sul telefono. Prima risposta esatta: +50.</p>
            } @else {
              <div class="cav-intro"><p>Preparazione domanda…</p></div>
            }
          }

          @case ('REVEAL') {
            @if (reveal(); as rev) {
              <div class="cav-reveal-head">{{ rev.heading }}</div>
              <div class="cav-rows">
                @for (row of rev.rows; track row.playerName) {
                  <div class="cav-row" [class.win]="row.points > 0">
                    <span class="cav-row-name">{{ row.playerName }}</span>
                    <span class="cav-row-label">{{ row.label }}</span>
                    <b>{{ row.points > 0 ? '+' : '' }}{{ row.points }}</b>
                  </div>
                }
                @if (!rev.rows.length) {
                  <p class="cav-hint">Nessuna risposta registrata.</p>
                }
              </div>
            }
          }

          @case ('FINALE') {
            <div class="cav-finale">
              <span class="cav-finale-kicker">CLASSIFICA BONUS</span>
              @if (message()) {
                <p class="cav-hint">{{ message() }}</p>
              }
              @for (row of totals(); track row.playerName; let i = $index) {
                <div class="cav-finale-row" [class.top]="i === 0">
                  <span>{{ i + 1 }}. {{ row.playerName }}</span>
                  <b>{{ row.score }}</b>
                </div>
              }
              @if (!totals().length) {
                <p class="cav-hint">Nessun punto registrato.</p>
              }
            </div>
          }
        }

        @if (totals().length && phase() !== 'FINALE') {
          <footer class="cav-totals">
            @for (row of totals(); track row.playerName) {
              <div class="cav-total">
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
    .cav-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(12px, 2vw, 28px);
      overflow: auto;
      background: radial-gradient(circle at 50% 0%, #1c1917 0%, #0c0a09 60%, #030201 100%);
      color: #fafaf9;
    }
    .cav-card {
      width: min(1320px, 96vw);
      max-height: 94vh;
      overflow: auto;
      padding: clamp(16px, 2.4vw, 34px);
      border: 3px solid #44403c;
      border-radius: 24px;
      background: linear-gradient(165deg, #1c1917, #0c0a09);
      box-shadow: 0 30px 90px rgba(0, 0, 0, .6);
    }
    .cav-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
    .cav-kicker { color: #f59e0b; font-family: var(--font-mono, monospace); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .2em; }
    .cav-head h1 { margin: 6px 0 4px; font-family: var(--font-display, inherit); font-size: clamp(1.5rem, 3.2vw, 2.6rem); line-height: 1; text-transform: uppercase; }
    .cav-sub { margin: 0; color: #a8a29e; font-size: clamp(.8rem, 1.1vw, 1rem); }
    .cav-timer { flex: 0 0 auto; padding: 10px 18px; border: 2px solid #f59e0b; border-radius: 14px; background: rgba(245, 158, 11, .12); color: #f59e0b; font-family: var(--font-mono, monospace); font-size: clamp(1.4rem, 2.4vw, 2.2rem); font-weight: 800; font-variant-numeric: tabular-nums; }
    .cav-prompt { margin: 0 0 12px; color: #e7e5e4; font-size: clamp(.9rem, 1.2vw, 1.1rem); text-align: center; }
    .cav-categories { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .cav-category {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: clamp(46px, 6vh, 64px);
      padding: 10px 14px;
      border: 2px solid #44403c;
      border-radius: 12px;
      background: #1c1917;
      font-size: clamp(.78rem, 1vw, .95rem);
      font-weight: 700;
    }
    .cav-category.voted { border-color: #f59e0b; background: rgba(245, 158, 11, .12); color: #fcd34d; }
    .cav-category b { display: grid; place-items: center; min-width: 22px; height: 22px; border-radius: 50%; background: #f59e0b; color: #1c1917; font-size: .72rem; }
    .cav-intro { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; text-align: center; color: #d6d3d1; }
    .cav-horse { font-size: clamp(3.4rem, 8vw, 6rem); animation: cavGallop 1.1s ease-in-out infinite alternate; }
    .cav-horse.run { animation-duration: .5s; }
    @keyframes cavGallop { to { transform: translateX(14px) rotate(-6deg); } }
    .cav-question {
      margin: 10px auto 18px;
      max-width: 1100px;
      color: #fafaf9;
      font-family: var(--font-display, inherit);
      font-size: clamp(1.3rem, 3vw, 2.4rem);
      line-height: 1.2;
      text-align: center;
    }
    .cav-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 1100px; margin: 0 auto; }
    .cav-options.two { grid-template-columns: 1fr 1fr; max-width: 700px; }
    .cav-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: clamp(10px, 1.4vw, 16px);
      border: 2px solid #57534e;
      border-radius: 12px;
      background: #1c1917;
      font-size: clamp(.85rem, 1.2vw, 1.1rem);
      font-weight: 700;
    }
    .cav-letter { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border-radius: 8px; background: #f59e0b; color: #1c1917; font-family: var(--font-mono, monospace); font-size: .85rem; }
    .cav-hint { margin: 14px 0 0; color: #a8a29e; font-size: clamp(.76rem, 1vw, .92rem); text-align: center; }
    .cav-reveal-head { margin: 6px 0 12px; color: #a3e635; font-family: var(--font-mono, monospace); font-size: clamp(.78rem, 1.2vw, 1rem); font-weight: 700; letter-spacing: .1em; text-align: center; }
    .cav-rows { display: flex; flex-direction: column; gap: 6px; max-width: 900px; margin: 0 auto; }
    .cav-row { display: grid; grid-template-columns: 1.4fr 1fr auto; gap: 12px; align-items: center; padding: 8px 14px; border: 1px solid #44403c; border-radius: 10px; background: #1c1917; font-size: clamp(.78rem, 1vw, .95rem); }
    .cav-row.win { border-color: #a3e635; background: rgba(163, 230, 53, .1); }
    .cav-row-label { color: #a8a29e; font-family: var(--font-mono, monospace); }
    .cav-row b { color: #f59e0b; font-family: var(--font-mono, monospace); }
    .cav-totals { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; padding-top: 12px; border-top: 1px solid #292524; }
    .cav-total { display: flex; align-items: center; gap: 10px; padding: 5px 12px; border: 1px solid #44403c; border-radius: 999px; background: #1c1917; font-size: .84rem; }
    .cav-total b { color: #f59e0b; font-family: var(--font-mono, monospace); }
    .cav-finale { display: flex; flex-direction: column; gap: 8px; max-width: 760px; margin: 0 auto; }
    .cav-finale-kicker { color: #f59e0b; font-family: var(--font-mono, monospace); font-size: .72rem; letter-spacing: .2em; text-align: center; }
    .cav-finale-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 16px; border: 1px solid #44403c; border-radius: 10px; background: #1c1917; font-size: clamp(.9rem, 1.3vw, 1.2rem); }
    .cav-finale-row.top { border-color: #f59e0b; background: rgba(245, 158, 11, .12); }
    .cav-finale-row b { color: #f59e0b; font-family: var(--font-mono, monospace); }
  `],
})
export class CavalloBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Input() categories: Category[] = [];
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  private ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private destroyRef = inject(DestroyRef);

  readonly phase = signal<Phase>('INTRO');
  readonly secondsLeft = signal(0);
  readonly chosenCategory = signal('');
  readonly index = signal(0);
  readonly total = signal(FLASH_QUESTIONS);
  readonly question = signal<{ text: string; options: string[] } | null>(null);
  readonly reveal = signal<Reveal | null>(null);
  readonly totals = signal<Array<{ playerName: string; score: number }>>([]);
  readonly message = signal('');

  private readonly categoryPicks = new Map<string, string>();
  private readonly categoryVotesView = signal<Array<{ playerName: string; category: string }>>([]);
  private readonly answers = new Map<string, { index: number; at: number }>();
  private readonly scoreMap = new Map<string, number>();
  private questions: Array<{ question: string; options: string[]; correctIndex: number; category: string }> = [];
  private questionStartedAt = 0;
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  readonly categoryVoteCounts = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(2500, () => this.startCategoryVote());
  }

  ngOnDestroy(): void {
    this.clearClock();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  categoryNames(): string[] {
    const active = this.categories.filter((category) => category.active !== false);
    const names = active.map((category) => category.name).filter(Boolean);
    return names.length ? names : ['CULTURA GENERALE'];
  }

  categoryVotes(category: string): number {
    return this.categoryVoteCounts()[category] ?? 0;
  }

  private onStatus(status: any): void {
    if (status?.action !== 'CAVALLO_ACTION') return;

    const playerName = String(status.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;

    if (status.kind === 'CATEGORY') {
      if (this.phase() !== 'CATEGORY') return;
      const category = String(status.value ?? '').trim();
      if (!this.categoryNames().includes(category)) return;
      if (this.categoryPicks.has(playerName)) return;

      this.categoryPicks.set(playerName, category);
      this.refreshCategoryVotes();
      this.publish();
      this.finishCategoryEarly();
      return;
    }

    if (status.kind === 'ANSWER') {
      if (this.phase() !== 'QUESTION') return;
      const index = Number(status.value);
      const current = this.question();
      if (!current || !Number.isInteger(index) || index < 0 || index >= current.options.length) return;
      if (this.answers.has(playerName)) return;

      this.answers.set(playerName, { index, at: Date.now() - this.questionStartedAt });
      if (this.answers.size >= this.players.length) {
        this.clearClock();
        this.revealQuestion();
      }
    }
  }

  private startCategoryVote(): void {
    this.phase.set('CATEGORY');
    this.categoryPicks.clear();
    this.answers.clear();
    this.refreshCategoryVotes();
    this.chosenCategory.set('');
    this.message.set('');
    this.startClock(CATEGORY_SECONDS, () => this.closeCategoryVote());
  }

  private refreshCategoryVotes(): void {
    this.categoryVotesView.set(
      [...this.categoryPicks.entries()].map(([playerName, category]) => ({ playerName, category })),
    );
    const counts: Record<string, number> = {};
    this.categoryPicks.forEach((category) => {
      counts[category] = (counts[category] ?? 0) + 1;
    });
    this.categoryVoteCounts.set(counts);
  }

  private finishCategoryEarly(): void {
    if (this.phase() !== 'CATEGORY') return;
    if (this.players.length === 0) return;
    if (!this.players.every((playerName) => this.categoryPicks.has(playerName))) return;
    this.clearClock();
    this.closeCategoryVote();
  }

  private closeCategoryVote(): void {
    if (this.phase() !== 'CATEGORY') return;

    const counts = this.categoryVoteCounts();
    let winner = '';
    let best = 0;
    Object.entries(counts).forEach(([category, votes]) => {
      if (votes > best) {
        best = votes;
        winner = category;
      }
    });
    if (!winner) {
      const names = this.categoryNames();
      winner = names[Math.floor(Math.random() * names.length)];
    }

    this.chosenCategory.set(winner);
    this.phase.set('LOADING');
    this.secondsLeft.set(0);
    this.publish();

    this.gameService.getCavalloQuestions(this.gameId, winner, FLASH_QUESTIONS).subscribe({
      next: (rows) => {
        this.questions = (rows ?? []).slice(0, FLASH_QUESTIONS);
        if (!this.questions.length) {
          this.message.set('Nessuna domanda disponibile per questa categoria.');
          this.finale(true);
          return;
        }
        this.total.set(this.questions.length);
        this.startQuestion(0);
      },
      error: () => {
        this.message.set('Domande non disponibili: riprova dal bonus.');
        this.finale(true);
      },
    });
  }

  private startQuestion(index: number): void {
    const question = this.questions[index];
    if (!question) {
      this.finale(false);
      return;
    }

    this.index.set(index);
    this.phase.set('QUESTION');
    this.answers.clear();
    this.reveal.set(null);
    this.question.set({ text: question.question, options: question.options });
    this.questionStartedAt = Date.now();
    this.startClock(QUESTION_SECONDS, () => this.revealQuestion());
  }

  private revealQuestion(): void {
    if (this.phase() !== 'QUESTION') return;
    this.clearClock();

    const current = this.questions[this.index()];
    if (!current) {
      this.finale(false);
      return;
    }

    const ordered = [...this.answers.entries()].sort((a, b) => a[1].at - b[1].at);
    const firstCorrect = ordered.find(([, answer]) => answer.index === current.correctIndex)?.[0] ?? '';

    const rows: Row[] = this.players.map((playerName) => {
      const answer = this.answers.get(playerName);
      let points = 0;
      if (answer && answer.index === current.correctIndex) {
        points = 100;
        if (playerName === firstCorrect) points += 50;
      }
      if (points) this.addPoints(playerName, points);
      return {
        playerName,
        label: answer ? current.options[answer.index] ?? '—' : '—',
        points,
      };
    });

    this.phase.set('REVEAL');
    this.secondsLeft.set(0);
    this.reveal.set({ heading: `RISPOSTA ESATTA: ${current.options[current.correctIndex]}`, rows });
    this.publish();
    this.emitRows(rows);

    this.later(REVEAL_MS, () => {
      if (this.index() + 1 >= this.questions.length) {
        this.finale(false);
      } else {
        this.startQuestion(this.index() + 1);
      }
    });
  }

  private finale(empty: boolean): void {
    this.phase.set('FINALE');
    this.secondsLeft.set(0);
    this.question.set(null);
    if (empty) {
      this.total.set(0);
    }
    this.publish();
    this.later(empty ? 5000 : 7000, () => this.finished.emit());
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.clearClock();
    this.secondsLeft.set(seconds);
    this.publish();

    this.clock = setInterval(() => {
      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();
      if (next <= 0) {
        this.clearClock();
        onEnd();
      }
    }, 1000);
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

  private publish(): void {
    const current = this.question();
    this.ws.broadcastStatus(this.gameId, {
      action: 'CAVALLO_STATE',
      state: {
        phase: this.phase(),
        secondsLeft: this.secondsLeft(),
        categories: this.categoryNames(),
        votes: this.categoryVotesView(),
        chosenCategory: this.chosenCategory(),
        question: current
          ? {
              index: this.index() + 1,
              total: this.total(),
              text: current.text,
              options: current.options,
            }
          : null,
        correctIndex: this.phase() === 'REVEAL' ? this.questions[this.index()]?.correctIndex ?? null : null,
        reveal: this.reveal(),
        scores: this.totals(),
        message: this.message(),
      },
    });
  }

  private later(ms: number, action: () => void): void {
    this.timers.push(setTimeout(action, ms));
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }
}
