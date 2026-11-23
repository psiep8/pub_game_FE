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
import { TvPause } from '../../../shared/tv-pause';

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
 * CAVALLO DI BATTAGLIA — bonus dell'atto.
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
            <div class="cav-kicker">🐎 BONUS DELL'ATTO</div>
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

            <div
              class="cav-board"
              [style.height]="'calc(var(--row) * ' + totals().length + ' - (var(--row) - var(--row-body)))'"
            >
              @for (row of totals(); track row.playerName; let i = $index) {
                <div
                  class="cav-row"
                  [class.lead]="i === 0 && row.score > 0"
                  [class.gain]="deltaFor(row.playerName) > 0"
                  [style.top]="'calc(var(--row) * ' + i + ')'"
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
      background: var(--coal);
      color: var(--paper);
    }
    .cav-card {
      display: flex;
      flex-direction: column;
      width: min(1500px, 97vw);
      max-height: 94vh;
      overflow: hidden;
      padding: clamp(16px, 2.2vw, 32px);
      border: 4px solid var(--paper-hi);
      background: var(--paper);
      color: var(--coal);
      box-shadow: 14px 14px 0 var(--tomato);
    }
    .cav-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .cav-kicker {
      display: inline-block;
      padding: 3px 10px;
      border: 2px solid var(--coal);
      background: var(--tomato);
      color: var(--paper-hi);
      font-family: var(--font-mono);
      font-size: clamp(.6rem, .9vw, .78rem);
      font-weight: 800;
      letter-spacing: .18em;
      transform: rotate(-1deg);
    }
    .cav-head h1 {
      margin: 8px 0 4px;
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 3vw, 2.5rem);
      font-weight: 400;
      line-height: .95;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .cav-sub {
      min-height: 1.2em;
      margin: 0;
      color: color-mix(in srgb, var(--coal) 68%, transparent);
      font-family: var(--font-mono);
      font-size: clamp(.72rem, 1vw, .9rem);
    }
    .cav-round {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 8px 14px;
      border: 3px solid var(--coal);
      background: var(--paper-hi);
    }
    .cav-round span { color: color-mix(in srgb, var(--coal) 65%, transparent); font-family: var(--font-mono); font-size: .62rem; letter-spacing: .18em; }
    .cav-round b { font-family: var(--font-mono); font-size: clamp(1.1rem, 1.8vw, 1.5rem); font-variant-numeric: tabular-nums; }
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
      border: 4px solid var(--coal);
      border-radius: 50%;
      background: var(--acid);
      color: var(--coal);
      box-shadow: 10px 10px 0 var(--coal);
      text-align: center;
    }
    .cav-clock b {
      font-family: var(--font-mono);
      font-size: clamp(5rem, 15vh, 12rem);
      font-weight: 800;
      line-height: .92;
      font-variant-numeric: tabular-nums;
    }
    .cav-clock span { font-family: var(--font-mono); font-size: clamp(.6rem, 1vw, .82rem); letter-spacing: .26em; }
    .cav-clock-word { font-size: clamp(2rem, 5.4vh, 3.4rem) !important; letter-spacing: .12em; }
    .cav-clock.hot { background: var(--tomato); color: var(--paper-hi); animation: cavPulse .8s steps(2, end) infinite; }
    .cav-clock.hot b { color: var(--paper-hi); }
    @keyframes cavPulse { 50% { transform: scale(1.025); } }
    .cav-call {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(1rem, 1.8vw, 1.6rem);
      font-weight: 400;
      letter-spacing: .1em;
      text-align: center;
      text-transform: uppercase;
    }
    .cav-cat {
      margin: 0;
      padding: 4px 10px;
      border: 2px solid var(--coal);
      background: var(--mustard);
      font-family: var(--font-mono);
      font-size: clamp(.68rem, .95vw, .85rem);
      font-weight: 800;
      letter-spacing: .12em;
      text-align: center;
      text-transform: uppercase;
    }
    .cav-board-panel { display: flex; flex-direction: column; min-height: 0; }
    .cav-board-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px 10px;
      border-bottom: 3px solid var(--coal);
      font-family: var(--font-mono);
      font-size: clamp(.58rem, .85vw, .72rem);
      font-weight: 800;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .cav-board-state { color: var(--tomato); }
    .cav-board {
      --row: clamp(52px, 7.4vh, 84px);
      --row-body: calc(var(--row) - 14px);
      position: relative;
      width: 100%;
    }
    .cav-row {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 12px;
      height: var(--row-body);
      padding: 0 clamp(10px, 1.4vw, 18px);
      border: 2px solid var(--coal);
      background: var(--paper-hi);
      /* Il riordino cambia top: animarlo faceva incrociare due righe
         assolute e per un frame una spariva dietro l'altra. */
      transition: background .2s steps(2, end);
    }
    .cav-row.lead { background: var(--acid); box-shadow: 5px 5px 0 var(--coal); }
    .cav-row.gain { animation: cavGain .8s steps(3, end); }
    @keyframes cavGain {
      0% { background: var(--tomato); color: var(--paper-hi); }
      100% { background: var(--paper-hi); }
    }
    .cav-pos {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 2px solid var(--coal);
      background: var(--paper);
      font-family: var(--font-mono);
      font-size: .9rem;
      font-weight: 800;
    }
    .cav-row.lead .cav-pos { background: var(--coal); color: var(--paper-hi); }
    .cav-name {
      overflow: hidden;
      font-family: var(--font-display);
      font-size: clamp(1rem, 1.6vw, 1.45rem);
      font-weight: 400;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .cav-gain { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.8rem, 1.1vw, 1rem); font-weight: 800; }
    .cav-score { font-family: var(--font-mono); font-size: clamp(1.3rem, 2.2vw, 2rem); font-variant-numeric: tabular-nums; }
    .cav-finale {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 3px solid var(--coal);
    }
    .cav-finale span {
      padding: 3px 8px;
      border: 2px solid var(--coal);
      background: var(--tomato);
      color: var(--paper-hi);
      font-family: var(--font-mono);
      font-size: .7rem;
      font-weight: 800;
      letter-spacing: .16em;
    }
    .cav-finale p { margin: 0; font-family: var(--font-mono); font-size: .86rem; }
    @media (max-width: 900px) {
      .cav-body { grid-template-columns: 1fr; }
      .cav-clock { width: min(30vh, 240px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cav-row { transition: none; }
      .cav-row.gain, .cav-clock.hot { animation: none; }
    }
  `],
})
export class CavalloBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Input() categories: Category[] = [];
  /** Banco di prova: domande locali, voti demo e tempi ridotti. */
  @Input() preview = false;
  /** Bonus interrotto da un refresh: si riparte dallo stato salvato. */
  @Input() resume: any | null = null;
  /**
   * Pausa della TV: ferma votazione, domanda e podio senza toccare punti e
   * regole. Lo stato arriva dalla TV, come per le Biglie.
   */
  @Input()
  set paused(value: boolean) {
    const was = this.pause.isPaused;
    this.pause.setPaused(value);
    // La pausa è uno stato del bonus: senza checkpoint, un refresh della TV
    // riaprirebbe la votazione già in corsa.
    if (this.pausedReady && was !== this.pause.isPaused) this.saveCheckpoint();
  }
  get paused(): boolean {
    return this.pause.isPaused;
  }
  @Output() finished = new EventEmitter<void>();
  /** Stato della rush, da salvare sul server a ogni cambio di fase. */
  @Output() checkpoint = new EventEmitter<any>();

  private ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private destroyRef = inject(DestroyRef);

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
  /** Pausa, cronometro e attese: un solo posto per fermarli e riarmarli. */
  /** Input iniziale applicato: da lì in poi ogni cambio di pausa va nel checkpoint. */
  private pausedReady = false;
  private readonly pause = new TvPause();
  /** Annulla il reveal automatico della domanda in corso. */
  private cancelQuestionReveal?: () => void;
  private rushExpired = false;

  readonly categoryVoteCounts = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.pausedReady = true;
    this.players.forEach((playerName) => {
      if (!this.scoreMap.has(playerName)) this.scoreMap.set(playerName, 0);
    });
    this.refreshTotals();

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    if (this.resume) {
      this.applyResume(this.resume);
      return;
    }
    this.later(this.preview ? 300 : 2500, () => this.startCategoryVote());
  }

  /**
   * Riprende il bonus dopo un refresh: voti, domande, tabellone e fase tornano
   * come li aveva lasciati la TV. I punti del bonus si pagano solo alla fine,
   * quindi rimettere il tabellone non paga nulla due volte.
   */
  private applyResume(state: any): void {
    const phase = String(state?.phase ?? '');
    this.chosenCategory.set(String(state?.chosenCategory ?? ''));

    this.questions = Array.isArray(state?.questions)
      ? state.questions
        .filter((question: any) => question && question.question && Array.isArray(question.options))
        .map((question: any) => ({
          question: String(question.question),
          options: question.options.map((option: any) => String(option)),
          correctIndex: Number(question.correctIndex) || 0,
          category: String(question.category ?? ''),
        }))
      : [];

    const savedTotal = Number(state?.total);
    this.total.set(savedTotal > 0 ? Math.round(savedTotal) : (this.questions.length || FLASH_QUESTIONS));
    const savedIndex = Number(state?.index);
    this.index.set(Number.isFinite(savedIndex) && savedIndex >= 0 ? Math.floor(savedIndex) : 0);

    this.scoreMap.clear();
    this.players.forEach((playerName) => this.scoreMap.set(playerName, 0));
    if (Array.isArray(state?.scores)) {
      for (const row of state.scores) {
        const name = String(row?.playerName ?? '').trim();
        if (!name) continue;
        this.scoreMap.set(name, Number(row?.score) || 0);
      }
    }
    this.refreshTotals();

    this.categoryPicks.clear();
    if (Array.isArray(state?.votes)) {
      for (const vote of state.votes) {
        const name = String(vote?.playerName ?? '').trim();
        const category = String(vote?.category ?? '').trim();
        if (!name || !category || !this.categoryNames().includes(category)) continue;
        this.categoryPicks.set(name, category);
      }
    }
    this.refreshCategoryVotes();

    this.answers.clear();
    if (Array.isArray(state?.answers)) {
      for (const answer of state.answers) {
        const name = String(answer?.playerName ?? '').trim();
        const index = Number(answer?.index);
        if (!name || !Number.isInteger(index)) continue;
        this.answers.set(name, { index, at: 0 });
      }
    }

    this.message.set(String(state?.message ?? ''));
    this.rushExpired = state?.rushExpired === true;
    const current = this.questions[this.index()];
    this.question.set(current ? { text: current.question, options: current.options } : null);
    this.reveal.set(state?.reveal && Array.isArray(state.reveal.rows) ? state.reveal : null);
    this.deltas.set(state?.deltas && typeof state.deltas === 'object' ? state.deltas : {});

    const savedSeconds = Number(state?.secondsLeft);
    const savedAt = Number(state?.savedAt);
    const elapsed = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      : 0;
    const seconds = Number.isFinite(savedSeconds) ? Math.max(0, Math.round(savedSeconds) - elapsed) : 0;

    if (phase === Phase.FINALE) {
      this.phase.set(Phase.FINALE);
      this.secondsLeft.set(0);
      this.question.set(null);
      this.publish();
      this.later((seconds > 0 ? seconds : 3) * 1000, () => this.finished.emit());
      return;
    }

    if (phase === Phase.LOADING) {
      // Le domande non erano ancora arrivate: si richiedono per la categoria scelta.
      const category = this.chosenCategory();
      if (category) {
        this.loadRushQuestions(category);
      } else {
        this.startCategoryVote();
      }
      return;
    }

    if (phase === Phase.REVEAL && this.reveal()) {
      this.phase.set(Phase.REVEAL);
      this.startClock(seconds, () => this.expireRush());
      this.later(this.preview ? 700 : REVEAL_MS, () => this.afterReveal(false));
      return;
    }

    if (phase === Phase.QUESTION && current) {
      this.phase.set(Phase.QUESTION);
      this.questionStartedAt = Date.now();
      this.startClock(seconds, () => this.expireRush());
      this.clearQuestionTimer();
      this.scheduleQuestionReveal(
        Math.min(this.preview ? 1500 : 7000, Math.max(0, seconds) * 1000),
      );
      // Tutti avevano già risposto: manca solo l'esito della domanda.
      if (this.players.length && this.answers.size >= this.players.length) {
        this.revealQuestion();
      }
      return;
    }

    // Votazione della categoria: si riprendono i voti già arrivati.
    this.phase.set(Phase.CATEGORY);
    this.startClock(seconds > 0 ? seconds : CATEGORY_SECONDS, () => this.closeCategoryVote());
    this.finishCategoryEarly();
  }

  private saveCheckpoint(): void {
    this.checkpoint.emit({
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      paused: this.paused,
      savedAt: Date.now(),
      chosenCategory: this.chosenCategory(),
      questions: this.questions.map((question) => ({ ...question })),
      index: this.index(),
      total: this.total(),
      scores: this.totals(),
      votes: this.categoryVotesView(),
      answers: [...this.answers].map(([playerName, answer]) => ({ playerName, index: answer.index })),
      deltas: { ...this.deltas() },
      reveal: this.reveal(),
      message: this.message(),
      rushExpired: this.rushExpired,
    });
  }

  ngOnDestroy(): void {
    this.clearQuestionTimer();
    this.pause.dispose();
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
    // Pausa della TV: scelta e risposta arrivate dal telefono non contano.
    if (this.pause.isSuspended) return;

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
      this.saveCheckpoint();
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
    this.scoreMap.forEach((_, name) => this.scoreMap.set(name, 0));
    this.refreshTotals();
    this.refreshCategoryVotes();
    this.chosenCategory.set('');
    this.message.set('');
    if (this.preview) this.seedPreviewCategoryVotes();
    this.startClock(this.preview ? 2 : CATEGORY_SECONDS, () => this.closeCategoryVote());
    this.saveCheckpoint();
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
    this.pause.clearClock();
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

    this.loadRushQuestions(winner);
  }

  /** Categoria decisa: carica le otto domande (o le prende dal banco di prova). */
  private loadRushQuestions(winner: string): void {
    this.chosenCategory.set(winner);
    this.phase.set(Phase.LOADING);
    this.secondsLeft.set(0);
    this.publish();
    this.saveCheckpoint();

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
    this.pause.clearClock();
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
    this.saveCheckpoint();

    // La domanda scorre da sola: nessun countdown in TV, ma la rush non si
    // blocca se un tavolo smette di rispondere.
    this.clearQuestionTimer();
    this.scheduleQuestionReveal(this.preview ? 1500 : 7000);
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
    this.clearQuestionTimer();

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
    this.saveCheckpoint();

    this.later(this.preview ? 700 : REVEAL_MS, () => this.afterReveal(final));
  }

  /** Dopo il reveal: domanda successiva o chiusura del bonus. */
  private afterReveal(final: boolean): void {
    if (this.phase() !== Phase.REVEAL) return;
    if (final || this.rushExpired || this.index() + 1 >= this.questions.length) {
      this.finale(false);
    } else {
      this.startQuestion(this.index() + 1);
    }
  }

  private finale(empty: boolean): void {
    if (this.phase() === Phase.FINALE) return;
    this.pause.clearClock();
    this.clearQuestionTimer();
    this.phase.set(Phase.FINALE);
    this.secondsLeft.set(0);
    this.question.set(null);
    this.deltas.set({});
    if (empty) {
      this.total.set(0);
    }
    this.publish();
    this.saveCheckpoint();
    this.later(this.preview ? 4000 : empty ? 5000 : 7000, () => this.finished.emit());
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.pause.clearClock();
    this.secondsLeft.set(seconds);
    this.publish();
    this.pause.startClock(() => {
      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();
      if (next > 0) return true;
      onEnd();
      return false;
    });
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
    this.pause.later(ms, action);
  }

  private scheduleQuestionReveal(ms: number): void {
    this.clearQuestionTimer();
    this.cancelQuestionReveal = this.pause.later(ms, () => {
      this.cancelQuestionReveal = undefined;
      this.revealQuestion();
    });
  }

  private clearQuestionTimer(): void {
    this.cancelQuestionReveal?.();
    this.cancelQuestionReveal = undefined;
  }
}
