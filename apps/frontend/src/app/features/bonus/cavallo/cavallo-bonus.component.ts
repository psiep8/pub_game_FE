import { GamePhase } from '../../../shared/enums/game-phase';
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
import { GameService } from '../../../core/services/game.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';

/**
 * Fasi del Cavallo di Battaglia. Le fasi comuni arrivano da `GamePhase`.
 */
const Phase = {
  INTRO: GamePhase.INTRO,
  CATEGORY: 'CATEGORY',
  LOADING: 'LOADING',
  QUESTION: 'QUESTION',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

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
/** Rush unica: tutte le domande dentro un minuto. */
const RUSH_SECONDS = 60;
const REVEAL_MS = 1600;
/** Passo tra due righe del tabellone: la differenza è lo spazio vuoto. */
const ROW_HEIGHT = 84;
const ROW_BODY = 68;

/** Domande locali per il banco di prova: la preview non dipende dal backend. */
const PREVIEW_QUESTIONS = [
  { question: 'Qual è la capitale del Giappone?', options: ['Pechino', 'Tokyo', 'Seul', 'Hanoi'], correctIndex: 1, category: 'GEOGRAFIA' },
  { question: 'Chi ha dipinto la Gioconda?', options: ['Michelangelo', 'Raffaello', 'Leonardo da Vinci', 'Caravaggio'], correctIndex: 2, category: 'ARTE' },
  { question: 'Quanto fa 12 × 12?', options: ['124', '144', '132', '154'], correctIndex: 1, category: 'MATEMATICA' },
  { question: 'Quale pianeta è conosciuto come pianeta rosso?', options: ['Venere', 'Giove', 'Marte', 'Mercurio'], correctIndex: 2, category: 'SCIENZA' },
  { question: 'In quale anno è caduto il muro di Berlino?', options: ['1987', '1989', '1991', '1993'], correctIndex: 1, category: 'STORIA' },
  { question: 'Chi ha scritto la Divina Commedia?', options: ['Dante Alighieri', 'Petrarca', 'Boccaccio', 'Manzoni'], correctIndex: 0, category: 'LETTERATURA' },
  { question: 'Qual è il fiume più lungo del mondo?', options: ['Nilo', 'Amazzoni', 'Danubio', 'Mississippi'], correctIndex: 0, category: 'GEOGRAFIA' },
  { question: 'Quante corde ha un violino?', options: ['4', '5', '6', '7'], correctIndex: 0, category: 'MUSICA' },
];

/**
 * CAVALLO DI BATTAGLIA — bonus di fine atto.
 *
 * La TV è solo cronometro e tabellone: il testo e le opzioni delle domande
 * vivono sul telefono. Il tabellone resta in scena dall'inizio alla fine e si
 * riordina a ogni reveal, così la classifica del bonus è sempre leggibile.
 */
@Component({
  selector: 'app-cavallo-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cav-overlay">
      <div class="cav-card">
        <header class="cav-head">
          <div class="cav-title">
            <div class="cav-kicker">🐎 BONUS DI FINE ATTO</div>
            <h1>CAVALLO DI BATTAGLIA</h1>
            <p class="cav-sub">{{ subtitle() }}</p>
          </div>
          @if (phase() === Phase.QUESTION || phase() === Phase.REVEAL) {
            <div class="cav-round">
              <span>DOMANDA</span>
              <b>{{ index() + 1 }} / {{ total() }}</b>
            </div>
          }
        </header>

        <div class="cav-body">
          <section class="cav-clock-panel">
            <div class="cav-clock" [class.hot]="phase() === Phase.QUESTION && secondsLeft() <= 10">
              @if (secondsLeft() > 0) {
                <b>{{ secondsLeft() }}</b>
                <span>SECONDI</span>
              } @else {
                <b class="cav-clock-word">{{ clockWord() }}</b>
              }
            </div>
            <p class="cav-call">{{ call() }}</p>
            <p class="cav-cat">{{ chosenCategory() || 'Categoria da scegliere' }}</p>
          </section>

          <section class="cav-board-panel">
            <div class="cav-board-head">
              <span>TABELLONE BONUS · GIUSTE / TOTALI</span>
              <span class="cav-board-state">{{ boardState() }}</span>
            </div>

            <div class="cav-board" [style.height.px]="boardHeight()">
              @for (row of totals(); track row.playerName; let i = $index) {
                <div
                  class="cav-row"
                  [class.lead]="i === 0 && row.score > 0"
                  [class.gain]="deltaFor(row.playerName) > 0"
                  [style.top.px]="i * rowHeight"
                >
                  <span class="cav-pos">{{ i + 1 }}</span>
                  <span class="cav-name">{{ row.playerName }}</span>
                  @if (deltaFor(row.playerName) > 0) {
                    <span class="cav-gain">+{{ deltaFor(row.playerName) }}</span>
                  }
                  <b class="cav-score">{{ row.score }}/{{ total() }}</b>
                </div>
              }
            </div>
          </section>
        </div>

        @if (phase() === Phase.FINALE) {
          <footer class="cav-finale">
            <span>BONUS CHIUSO</span>
            @if (message()) {
              <p>{{ message() }}</p>
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
      display: flex;
      flex-direction: column;
      width: min(1500px, 97vw);
      max-height: 94vh;
      overflow: hidden;
      padding: clamp(16px, 2.2vw, 32px);
      border: 3px solid #44403c;
      border-radius: 26px;
      background: linear-gradient(165deg, #1c1917, #0c0a09);
      box-shadow: 0 30px 90px rgba(0, 0, 0, .6);
    }
    .cav-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .cav-kicker { color: #f59e0b; font-family: var(--font-mono, monospace); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .22em; }
    .cav-head h1 { margin: 6px 0 4px; font-family: var(--font-display, inherit); font-size: clamp(1.5rem, 3vw, 2.5rem); line-height: 1; text-transform: uppercase; }
    .cav-sub { min-height: 1.2em; margin: 0; color: #a8a29e; font-size: clamp(.8rem, 1.1vw, 1rem); }
    .cav-round {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 8px 16px;
      border: 2px solid #57534e;
      border-radius: 14px;
      background: #1c1917;
    }
    .cav-round span { color: #a8a29e; font-family: var(--font-mono, monospace); font-size: .62rem; letter-spacing: .18em; }
    .cav-round b { color: #f59e0b; font-family: var(--font-mono, monospace); font-size: clamp(1.1rem, 1.8vw, 1.5rem); font-variant-numeric: tabular-nums; }
    .cav-body {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr);
      gap: clamp(16px, 2.4vw, 36px);
      margin-top: clamp(12px, 2vw, 24px);
      min-height: 0;
    }
    .cav-clock-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 0;
    }
    .cav-clock {
      display: grid;
      place-content: center;
      gap: 2px;
      width: min(44vh, 400px);
      max-width: 100%;
      aspect-ratio: 1;
      border: 4px solid #f59e0b;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 35%, #292524 0%, #171412 65%, #0c0a09 100%);
      box-shadow: inset 0 0 60px rgba(245, 158, 11, .12), 0 0 70px rgba(245, 158, 11, .16);
      text-align: center;
    }
    .cav-clock b {
      color: #fcd34d;
      font-family: var(--font-mono, monospace);
      font-size: clamp(5rem, 15vh, 12rem);
      font-weight: 800;
      line-height: .92;
      font-variant-numeric: tabular-nums;
    }
    .cav-clock span { color: #a8a29e; font-family: var(--font-mono, monospace); font-size: clamp(.6rem, 1vw, .82rem); letter-spacing: .32em; }
    .cav-clock-word { font-size: clamp(2rem, 5.4vh, 3.4rem) !important; letter-spacing: .12em; }
    .cav-clock.hot { border-color: #ef4444; box-shadow: inset 0 0 60px rgba(239, 68, 68, .18), 0 0 70px rgba(239, 68, 68, .25); animation: cavPulse .8s ease-in-out infinite; }
    .cav-clock.hot b { color: #fca5a5; }
    @keyframes cavPulse { 50% { transform: scale(1.03); } }
    .cav-call { margin: 0; color: #fafaf9; font-family: var(--font-display, inherit); font-size: clamp(1rem, 1.8vw, 1.6rem); font-weight: 800; letter-spacing: .14em; text-align: center; }
    .cav-cat { margin: 0; color: #f59e0b; font-family: var(--font-mono, monospace); font-size: clamp(.7rem, 1vw, .9rem); letter-spacing: .18em; text-align: center; }
    .cav-board-panel { display: flex; flex-direction: column; min-height: 0; }
    .cav-board-head { display: flex; align-items: center; justify-content: space-between; padding: 0 6px 10px; color: #a8a29e; font-family: var(--font-mono, monospace); font-size: clamp(.6rem, .9vw, .74rem); font-weight: 700; letter-spacing: .22em; }
    .cav-board-state { color: #f59e0b; }
    .cav-board { position: relative; width: 100%; }
    .cav-row {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 12px;
      height: 68px;
      padding: 0 clamp(10px, 1.4vw, 18px);
      border: 2px solid #44403c;
      border-radius: 14px;
      background: linear-gradient(180deg, #1f1b18, #171412);
      transition: top .55s cubic-bezier(.22, 1, .36, 1), border-color .25s ease, background .25s ease;
    }
    .cav-row.lead { border-color: #f59e0b; background: linear-gradient(180deg, rgba(245, 158, 11, .16), rgba(245, 158, 11, .04)); }
    .cav-row.gain { animation: cavGain .9s ease-out; }
    @keyframes cavGain {
      0% { border-color: #a3e635; background: rgba(163, 230, 53, .22); }
      100% { border-color: #44403c; background: linear-gradient(180deg, #1f1b18, #171412); }
    }
    .cav-pos {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #292524;
      color: #d6d3d1;
      font-family: var(--font-mono, monospace);
      font-size: .9rem;
      font-weight: 800;
    }
    .cav-row.lead .cav-pos { background: #f59e0b; color: #1c1917; }
    .cav-name { overflow: hidden; color: #fafaf9; font-family: var(--font-display, inherit); font-size: clamp(1rem, 1.6vw, 1.45rem); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .cav-gain { color: #a3e635; font-family: var(--font-mono, monospace); font-size: clamp(.8rem, 1.1vw, 1rem); font-weight: 800; }
    .cav-score { color: #fcd34d; font-family: var(--font-mono, monospace); font-size: clamp(1.3rem, 2.2vw, 2rem); font-variant-numeric: tabular-nums; }
    .cav-finale { display: flex; align-items: center; gap: 14px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #292524; }
    .cav-finale span { color: #f59e0b; font-family: var(--font-mono, monospace); font-size: .72rem; letter-spacing: .22em; }
    .cav-finale p { margin: 0; color: #a8a29e; font-size: .9rem; }
  `],
})
export class CavalloBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Input() categories: Category[] = [];
  /** Banco di prova: domande locali, voti demo e tempi ridotti. */
  @Input() preview = false;
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  private ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private destroyRef = inject(DestroyRef);

  readonly rowHeight = ROW_HEIGHT;

  readonly phase = signal<Phase>(Phase.INTRO);

  /** Fasi del gioco, disponibili anche nel template. */
  readonly Phase = Phase;
  readonly secondsLeft = signal(0);
  readonly chosenCategory = signal('');
  readonly index = signal(0);
  readonly total = signal(FLASH_QUESTIONS);
  readonly question = signal<{ text: string; options: string[] } | null>(null);
  readonly reveal = signal<Reveal | null>(null);
  readonly totals = signal<Array<{ playerName: string; score: number }>>([]);
  readonly deltas = signal<Record<string, number>>({});
  readonly message = signal('');

  private readonly categoryPicks = new Map<string, string>();
  private readonly categoryVotesView = signal<Array<{ playerName: string; category: string }>>([]);
  private readonly answers = new Map<string, { index: number; at: number }>();
  private readonly scoreMap = new Map<string, number>();
  private questions: Array<{ question: string; options: string[]; correctIndex: number; category: string }> = [];
  private questionStartedAt = 0;
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private rushExpired = false;
  private resultsEmitted = false;

  readonly categoryVoteCounts = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.players.forEach((playerName) => {
      if (!this.scoreMap.has(playerName)) this.scoreMap.set(playerName, 0);
    });
    this.refreshTotals();

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(this.preview ? 300 : 2500, () => this.startCategoryVote());
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

  /** Riga del tabellone per il tavolo, 0 se non ha guadagnato nell'ultimo reveal. */
  deltaFor(playerName: string): number {
    return this.deltas()[playerName] ?? 0;
  }

  boardHeight(): number {
    const rows = this.totals().length;
    return rows > 0 ? rows * ROW_HEIGHT - (ROW_HEIGHT - ROW_BODY) : 0;
  }

  subtitle(): string {
    const category = this.chosenCategory();
    switch (this.phase()) {
      case Phase.CATEGORY:
        return 'La categoria la sceglie la squadra dal telefono.';
      case Phase.LOADING:
        return 'Preparo otto domande difficili.';
      case Phase.QUESTION:
        return category ? 'Categoria ' + category + ' · rush da un minuto.' : 'Rush da un minuto.';
      case Phase.REVEAL:
        return 'Risposta esatta, si riparte subito.';
      case Phase.FINALE:
        return 'Classifica del bonus: giuste su totali.';
      default:
        return 'Otto domande flash, una dopo l\'altra.';
    }
  }

  call(): string {
    switch (this.phase()) {
      case Phase.CATEGORY:
        return 'VOTATE SUL TELEFONO';
      case Phase.LOADING:
        return 'PREPARO LE DOMANDE';
      case Phase.QUESTION:
        return 'RISPONDETE';
      case Phase.REVEAL:
        return 'GIUSTE';
      case Phase.FINALE:
        return 'BONUS CHIUSO';
      default:
        return 'SI PARTE';
    }
  }

  clockWord(): string {
    switch (this.phase()) {
      case Phase.LOADING:
        return '···';
      case Phase.REVEAL:
        return 'PUNTI';
      case Phase.FINALE:
        return 'FINE';
      default:
        return 'VIA';
    }
  }

  boardState(): string {
    switch (this.phase()) {
      case Phase.REVEAL:
        return 'AGGIORNATO';
      case Phase.FINALE:
        return Phase.FINALE;
      default:
        return 'IN DIRETTA';
    }
  }

  private onStatus(status: any): void {
    if (status?.action !== 'CAVALLO_ACTION') return;

    const playerName = String(status.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;

    if (status.kind === Phase.CATEGORY) {
      if (this.phase() !== Phase.CATEGORY) return;
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
      if (this.phase() !== Phase.QUESTION) return;
      const index = Number(status.value);
      const current = this.question();
      if (!current || !Number.isInteger(index) || index < 0 || index >= current.options.length) return;
      if (this.answers.has(playerName)) return;

      this.answers.set(playerName, { index, at: Date.now() - this.questionStartedAt });
      if (this.answers.size >= this.players.length) {
        // Il cronometro globale continua: qui si chiude solo la domanda.
        this.revealQuestion();
      }
    }
  }

  private startCategoryVote(): void {
    this.phase.set(Phase.CATEGORY);
    this.categoryPicks.clear();
    this.answers.clear();
    this.rushExpired = false;
    this.resultsEmitted = false;
    this.scoreMap.forEach((_, name) => this.scoreMap.set(name, 0));
    this.refreshTotals();
    this.refreshCategoryVotes();
    this.chosenCategory.set('');
    this.message.set('');
    if (this.preview) this.seedPreviewCategoryVotes();
    this.startClock(this.preview ? 2 : CATEGORY_SECONDS, () => this.closeCategoryVote());
  }

  private seedPreviewCategoryVotes(): void {
    const names = this.categoryNames();
    if (!names.length) return;
    this.later(500, () => {
      if (this.phase() !== Phase.CATEGORY) return;
      for (const playerName of this.players) {
        this.categoryPicks.set(playerName, names[Math.floor(Math.random() * names.length)]);
      }
      this.refreshCategoryVotes();
      this.publish();
    });
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
    if (this.phase() !== Phase.CATEGORY) return;
    if (this.players.length === 0) return;
    if (!this.players.every((playerName) => this.categoryPicks.has(playerName))) return;
    this.clearClock();
    this.closeCategoryVote();
  }

  private closeCategoryVote(): void {
    if (this.phase() !== Phase.CATEGORY) return;

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
    this.phase.set(Phase.LOADING);
    this.secondsLeft.set(0);
    this.publish();

    if (this.preview) {
      this.questions = PREVIEW_QUESTIONS.slice(0, FLASH_QUESTIONS);
      this.total.set(this.questions.length);
      this.later(350, () => this.startRush());
      return;
    }

    this.gameService.getCavalloQuestions(this.gameId, winner, FLASH_QUESTIONS).subscribe({
      next: (rows) => {
        this.questions = (rows ?? []).slice(0, FLASH_QUESTIONS);
        if (!this.questions.length) {
          this.message.set('Nessuna domanda disponibile per questa categoria.');
          this.finale(true);
          return;
        }
        this.total.set(this.questions.length);
        this.startRush();
      },
      error: () => {
        this.message.set('Domande non disponibili: riprova dal bonus.');
        this.finale(true);
      },
    });
  }

  /** Un solo cronometro per tutta la rush, non uno per domanda. */
  private startRush(): void {
    this.clearClock();
    this.startClock(this.preview ? 8 : RUSH_SECONDS, () => this.expireRush());
    this.startQuestion(0);
  }

  private startQuestion(index: number): void {
    const question = this.questions[index];
    if (!question || this.rushExpired || this.secondsLeft() <= 0) {
      this.finale(false);
      return;
    }

    this.index.set(index);
    this.phase.set(Phase.QUESTION);
    this.answers.clear();
    this.reveal.set(null);
    this.deltas.set({});
    this.question.set({ text: question.question, options: question.options });
    this.questionStartedAt = Date.now();
    if (this.preview) this.seedPreviewAnswers();
    this.publish();
  }

  private expireRush(): void {
    this.rushExpired = true;
    if (this.phase() === Phase.QUESTION) {
      this.revealQuestion(true);
    } else if (this.phase() === Phase.REVEAL) {
      this.finale(false);
    }
  }

  private seedPreviewAnswers(): void {
    const current = this.questions[this.index()];
    if (!current) return;
    this.later(650, () => {
      if (this.phase() !== Phase.QUESTION) return;
      for (const playerName of this.players) {
        if (this.answers.has(playerName)) continue;
        const index =
          Math.random() < 0.45
            ? current.correctIndex
            : Math.floor(Math.random() * current.options.length);
        this.answers.set(playerName, { index, at: Date.now() - this.questionStartedAt });
      }
    });
  }

  private revealQuestion(final = false): void {
    if (this.phase() !== Phase.QUESTION) return;

    const current = this.questions[this.index()];
    if (!current) {
      this.finale(false);
      return;
    }

    const gained: Record<string, number> = {};
    const rows: Row[] = this.players.map((playerName) => {
      const answer = this.answers.get(playerName);
      const correct = !!answer && answer.index === current.correctIndex;
      if (correct) {
        gained[playerName] = 1;
        this.addCorrect(playerName);
      }
      return {
        playerName,
        label: answer ? current.options[answer.index] ?? '—' : '—',
        points: correct ? 1 : 0,
      };
    });

    this.phase.set(Phase.REVEAL);
    this.deltas.set(gained);
    this.reveal.set({ heading: `RISPOSTA ESATTA: ${current.options[current.correctIndex]}`, rows });
    this.publish();

    this.later(this.preview ? 700 : REVEAL_MS, () => {
      if (this.phase() !== Phase.REVEAL) return;
      if (final || this.rushExpired || this.index() + 1 >= this.questions.length) {
        this.finale(false);
      } else {
        this.startQuestion(this.index() + 1);
      }
    });
  }

  private finale(empty: boolean): void {
    if (this.phase() === Phase.FINALE) return;
    this.clearClock();
    this.phase.set(Phase.FINALE);
    this.secondsLeft.set(0);
    this.question.set(null);
    this.deltas.set({});
    if (empty) {
      this.total.set(0);
    }
    this.emitFinalResults();
    this.publish();
    this.later(this.preview ? 4000 : empty ? 5000 : 7000, () => this.finished.emit());
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

  private addCorrect(playerName: string): void {
    this.scoreMap.set(playerName, (this.scoreMap.get(playerName) ?? 0) + 1);
    this.refreshTotals();
  }

  private refreshTotals(): void {
    // La TV parte dalla squadra peggiore: l'ordine è crescente per giuste.
    this.totals.set(
      [...this.scoreMap.entries()]
        .map(([playerName, score]) => ({ playerName, score }))
        .sort((a, b) => a.score - b.score),
    );
  }

  /** L'esito del bonus è il numero di giuste, non i punti: si emette una volta. */
  private emitFinalResults(): void {
    if (this.resultsEmitted) return;
    this.resultsEmitted = true;
    for (const row of this.totals()) {
      this.result.emit({ playerName: row.playerName, score: row.score });
    }
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
        correctIndex: this.phase() === Phase.REVEAL ? this.questions[this.index()]?.correctIndex ?? null : null,
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
