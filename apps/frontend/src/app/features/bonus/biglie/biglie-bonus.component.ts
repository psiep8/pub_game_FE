import { GamePhase } from '../../../shared/enums/game-phase';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../core/websocket/web-socket.service';

/**
 * Fasi delle Biglie. Le fasi comuni arrivano da `GamePhase`.
 */
const Phase = {
  INTRO: GamePhase.INTRO,
  PICK: GamePhase.PICK,
  RACE: GamePhase.RACE,
  RACE_END: 'RACE_END',
  FINALE: GamePhase.FINALE,
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

interface Marble {
  id: string;
  name: string;
  color: string;
  emoji: string;
  speed: number;
  accel: number;
  grip: number;
}

interface MarbleView extends Marble {
  owner: string | null;
}

interface Track {
  id: string;
  name: string;
  surface: string;
  emoji: string;
  tint: string;
  weights: { speed: number; accel: number; grip: number };
}

interface Lane {
  playerName: string;
  marbleId: string;
  progress: number;
  finished: boolean;
  position: number | null;
}

/** Stato fisico della biglia in corsa: vive solo sulla TV. */
interface RaceMarble {
  playerName: string;
  marbleId: string;
  x: number;
  v: number;
  body: any;
  finished: boolean;
  position: number | null;
  trail: Array<{ x: number; y: number }>;
  bumped: Set<string>;
  /** Effetti di pista attivi, misurati in secondi di gara. */
  slowUntil: number;
  boostUntil: number;
}

type HazardKind =
  | 'fango'
  | 'pozzanghera'
  | 'sasso'
  | 'cordolo'
  | 'cumulo'
  | 'ghiaccio'
  | 'onda'
  | 'boa'
  | 'scoglio';

interface Hazard {
  id: string;
  kind: HazardKind;
  progress: number;
  offset: number;
  radius: number;
  patch: boolean;
}

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface RaceRow {
  playerName: string;
  marbleId: string;
  position: number;
  points: number;
  total: number;
}

const MARBLES: Marble[] = [
  { id: 'fulmine', name: 'FULMINE', color: '#facc15', emoji: '⚡', speed: 10, accel: 6, grip: 3 },
  { id: 'scheggia', name: 'SCHEGGIA', color: '#fb7185', emoji: '🔥', speed: 8, accel: 9, grip: 3 },
  { id: 'chiodo', name: 'CHIODO', color: '#38bdf8', emoji: '🧲', speed: 4, accel: 6, grip: 10 },
  { id: 'piuma', name: 'PIUMA', color: '#a3e635', emoji: '🪶', speed: 6, accel: 10, grip: 5 },
  { id: 'tank', name: 'TANK', color: '#94a3b8', emoji: '🛡️', speed: 5, accel: 5, grip: 9 },
  { id: 'vortice', name: 'VORTICE', color: '#c084fc', emoji: '🌀', speed: 9, accel: 7, grip: 5 },
  { id: 'sasso', name: 'SASSO', color: '#f97316', emoji: '🪨', speed: 6, accel: 5, grip: 8 },
  { id: 'lampo', name: 'LAMPO', color: '#22d3ee', emoji: '💧', speed: 7, accel: 8, grip: 6 },
];

/** Fondi diversi: è la ragione per cui la scelta unica conta. */
const TRACKS: Track[] = [
  {
    id: 'rally',
    name: 'RALLY',
    surface: 'TERRA',
    emoji: '🏁',
    tint: '#b45309',
    weights: { speed: 0.2, accel: 0.6, grip: 0.2 },
  },
  {
    id: 'f1',
    name: 'F1',
    surface: 'ASFALTO',
    emoji: '🏎️',
    tint: '#334155',
    weights: { speed: 0.8, accel: 0.15, grip: 0.05 },
  },
  {
    id: 'neve',
    name: 'NEVE',
    surface: 'NEVE',
    emoji: '❄️',
    tint: '#0ea5e9',
    weights: { speed: 0.1, accel: 0.25, grip: 0.65 },
  },
  {
    id: 'acqua',
    name: 'ACQUA',
    surface: 'ACQUA',
    emoji: '🌊',
    tint: '#0369a1',
    weights: { speed: 0.3, accel: 0.55, grip: 0.15 },
  },
];

const RACE_POINTS = [150, 100, 60, 30];
const INTRO_SECONDS = 4;
const PICK_SECONDS = 10;
const RACE_SECONDS = 30;
const TRACK_START_X = 140;
const TRACK_WORLD_LENGTH = 3600;
/** Ostacoli per fondo: cambiano la gara, non solo il colore dell'asfalto. */
const HAZARD_PLANS: Record<string, HazardKind[]> = {
  rally: ['fango', 'pozzanghera', 'sasso', 'sasso', 'fango', 'pozzanghera', 'sasso', 'fango', 'pozzanghera', 'sasso', 'fango', 'pozzanghera', 'sasso', 'fango'],
  f1: ['cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo', 'cordolo'],
  neve: ['cumulo', 'ghiaccio', 'cumulo', 'ghiaccio', 'cumulo', 'ghiaccio', 'cumulo', 'ghiaccio', 'cumulo', 'ghiaccio', 'cumulo', 'ghiaccio'],
  acqua: ['onda', 'boa', 'scoglio', 'onda', 'boa', 'scoglio', 'onda', 'boa', 'scoglio', 'onda', 'boa', 'scoglio'],
};

/** Palette carta/inchiostro usata su tela per gli ostacoli. */
const INK = '#15150f';
const PAPER = '#f1e4c9';
const PAPER_HI = '#fff8e8';
const TOMATO = '#ff4d2e';
const MUSTARD = '#ffc53d';
const COBALT = '#2f5bff';
const MINT = '#8be3c4';
const ACID = '#d9ff43';
const PHYSICS_STEP = 1000 / 60;
const TRACK_END_PADDING = 80;
/** Centro verticale della pista disegnata: alza il serpentone e libera il bordo basso. */
const TRACK_VIEW_CENTER = 0.51;
const BETWEEN_SECONDS = 4;
const FINALE_SECONDS = 7;

/**
 * BIGLIE — bonus di fine atto 4.
 *
 * Una biglia per tavolo, tutte diverse e mai condivise. La scelta si fa una
 * volta sola, in ordine sorteggiato: chi è ultimo prende quella che resta.
 * Poi quattro gare su fondi diversi (terra, asfalto, neve, acqua) con punti
 * cumulativi: il profilo che vince una gara affonda nella successiva.
 */
@Component({
  selector: 'app-biglie-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-overlay" [class.racing-overlay]="phase() === Phase.RACE">
      <div class="bg-card" [class.racing]="phase() === Phase.RACE">
        @if (phase() !== Phase.RACE) {
        <header class="bg-head">
          <div>
            <div class="bg-kicker">🎱 BIGLIE · BONUS DI FINE ATTO</div>
            <h1>{{ heading() }}</h1>
            <p class="bg-sub">{{ subtitle() }}</p>
          </div>
          @if (secondsLeft() > 0) {
            <div class="bg-timer" [class.hot]="secondsLeft() <= 4">{{ secondsLeft() }}s</div>
          }
        </header>
        }

        @switch (phase()) {
          @case (Phase.INTRO) {
            <div class="bg-intro">
              <div class="bg-track-row">
                @for (t of tracks; track t.id) {
                  <span class="bg-track-chip" [style.border-color]="t.tint">
                    <b>{{ t.emoji }} {{ t.name }}</b>
                    <span>{{ t.surface }}</span>
                  </span>
                }
              </div>
              <p class="bg-hint">
                Una biglia a testa, scelta una volta sola in ordine sorteggiato.
                Quattro gare, punti cumulativi: 150 / 100 / 60 / 30 a gara.
              </p>
            </div>
          }

          @case (Phase.PICK) {
            <div class="bg-pick">
              <div class="bg-turn">
                TOCCA A <b>{{ currentPlayer() }}</b>
                <span class="bg-order">{{ pickProgress() }}</span>
              </div>
              <div class="bg-marble-grid">
                @for (marble of marbles(); track marble.id) {
                  <div class="bg-marble" [class.taken]="marble.owner">
                    <span class="bg-dot" [style.background]="marble.color">{{ marble.emoji }}</span>
                    <b>{{ marble.name }}</b>
                    <span class="bg-prof">V{{ marble.speed }} · A{{ marble.accel }} · T{{ marble.grip }}</span>
                    @if (marble.owner) {
                      <span class="bg-owner">{{ marble.owner }}</span>
                    }
                  </div>
                }
              </div>
            </div>
          }

          @case (Phase.RACE) {
            <div class="bg-track-head">
              <span class="bg-surface" [style.background]="currentTrack()?.tint">
                {{ currentTrack()?.emoji }} {{ currentTrack()?.surface }}
              </span>
              <span class="bg-hint">Punti gara: 150 · 100 · 60 · 30 · punti cumulativi su quattro gare</span>
              <span class="bg-race-clock" [class.hot]="secondsLeft() <= 4">{{ secondsLeft() }}s</span>
            </div>
            <div class="bg-race-stage">
              <canvas #raceCanvas></canvas>
            </div>
          }

          @case (Phase.RACE_END) {
            <div class="bg-results">
              <div class="bg-result-head">
                <span class="bg-result-kicker">LEGENDA · ORDINE D'ARRIVO</span>
                <span class="bg-result-track">{{ currentTrack()?.emoji }} GARA {{ raceIndex() + 1 }} · {{ currentTrack()?.name }}</span>
              </div>
              <div class="bg-result-columns">
                <span>POS</span><span>TAVOLO</span><span>BIGLIA</span><span>PUNTI</span><span>TOTALE</span>
              </div>
              @for (row of raceResult() ?? []; track row.playerName; let i = $index) {
                <div class="bg-row" [class.paid]="row.points > 0">
                  <span class="bg-row-pos">{{ i + 1 }}</span>
                  <span class="bg-row-name">{{ row.playerName }}</span>
                  <span class="bg-row-marble">{{ marbleEmoji(row.marbleId) }} {{ marbleName(row.marbleId) }}</span>
                  <b class="bg-row-points">{{ row.points > 0 ? '+' + row.points : '0' }}</b>
                  <span class="bg-row-total">{{ row.total }}</span>
                </div>
              }
            </div>
          }

          @case (Phase.FINALE) {
            <div class="bg-finale">
              <div class="bg-finale-head">
                <span class="bg-finale-kicker">CLASSIFICA FINALE</span>
                <span class="bg-finale-note">4 GARE · PUNTI CUMULATIVI</span>
              </div>
              <div class="bg-results">
              @for (row of standings(); track row.playerName; let i = $index) {
                <div class="bg-row bg-final-row" [class.paid]="i === 0">
                  <span class="bg-row-pos">{{ i + 1 }}</span>
                  <span class="bg-row-name">{{ row.playerName }}</span>
                  <span class="bg-row-marble">{{ marbleEmoji(row.marbleId) }} {{ marbleName(row.marbleId) }}</span>
                  <b class="bg-row-points">{{ row.total }}</b>
                </div>
              }
              @if (!standings().length) {
                <p class="bg-hint">Nessun tavolo in gara.</p>
              }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .bg-overlay { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: clamp(10px, 2vw, 28px); background: rgba(8, 6, 4, .62); }
    .bg-card { width: min(1380px, 97vw); max-height: 96vh; overflow: hidden; display: flex; flex-direction: column; gap: clamp(10px, 1.6vh, 20px); padding: clamp(16px, 2.4vw, 34px); background: var(--paper); color: var(--coal); border: 4px solid var(--coal); box-shadow: 12px 12px 0 var(--tomato); }
    .bg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .bg-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 800; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .bg-head h1 { margin: 6px 0 0; font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 2.6rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .bg-sub { margin: 4px 0 0; font-family: var(--font-mono); font-size: clamp(.62rem, .95vw, .82rem); letter-spacing: .12em; color: rgba(30, 25, 20, .62); text-transform: uppercase; }
    .bg-timer { font-family: var(--font-mono); font-size: clamp(1.2rem, 2vw, 1.9rem); font-weight: 800; }
    .bg-timer.hot { color: var(--tomato); animation: bg-pulse .8s infinite; }
    .bg-hint { margin: 0; font-family: var(--font-mono); font-size: clamp(.62rem, .92vw, .8rem); color: rgba(30, 25, 20, .62); }
    .bg-intro { display: flex; flex-direction: column; gap: 14px; }
    .bg-track-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .bg-track-chip { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--paper-hi); border: 3px solid var(--coal); font-family: var(--font-mono); }
    .bg-track-chip b { font-size: clamp(.85rem, 1.2vw, 1.05rem); }
    .bg-track-chip span { font-size: .72rem; letter-spacing: .14em; opacity: .65; }
    .bg-turn { display: flex; align-items: baseline; gap: 12px; font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); letter-spacing: .1em; }
    .bg-turn b { font-size: 1.4em; }
    .bg-order { margin-left: auto; font-size: .8em; opacity: .6; }
    .bg-marble-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 1.2vw, 16px); margin-top: clamp(8px, 1.4vh, 16px); }
    .bg-marble { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: var(--paper-hi); border: 3px solid var(--coal); font-family: var(--font-mono); }
    .bg-marble.taken { opacity: .38; }
    .bg-dot { display: grid; place-items: center; width: clamp(38px, 3.6vw, 54px); height: clamp(38px, 3.6vw, 54px); border-radius: 50%; border: 3px solid var(--coal); font-size: clamp(1rem, 1.6vw, 1.5rem); }
    .bg-prof { font-size: clamp(.55rem, .78vw, .68rem); letter-spacing: .08em; color: rgba(30, 25, 20, .6); }
    .bg-owner { position: absolute; inset: auto 4px 4px auto; padding: 1px 6px; background: var(--coal); color: var(--paper-hi); font-size: .6rem; letter-spacing: .06em; }
    .bg-track-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bg-surface { padding: 4px 12px; color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.62rem, .92vw, .8rem); font-weight: 800; letter-spacing: .16em; }
    .bg-race-stage { position: relative; flex: 1; min-height: clamp(340px, 56vh, 640px); background: #101418; border: 3px solid var(--coal); overflow: hidden; }
    .bg-race-stage canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
    .bg-overlay.racing-overlay { padding: 0; place-items: stretch; background: var(--bg-0); }
    .bg-card.racing { width: 100vw; height: 100dvh; max-height: none; padding: 8px 10px 10px; border: 0; box-shadow: none; gap: 6px; }
    .bg-card.racing .bg-track-head { flex: 0 0 auto; padding: 2px 2px 0; }
    .bg-card.racing .bg-race-stage { flex: 1; min-height: 0; border-width: 2px; }
    .bg-race-clock { display: inline-grid; place-items: center; min-width: 58px; padding: 3px 9px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.9rem, 1.6vw, 1.35rem); font-weight: 800; font-variant-numeric: tabular-nums; }
    .bg-race-clock.hot { background: var(--tomato); color: var(--paper-hi); }
    .bg-result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 3px; padding-bottom: 6px; border-bottom: 3px solid var(--coal); }
    .bg-result-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .86vw, .76rem); font-weight: 800; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .bg-result-track { color: rgba(30, 25, 20, .66); font-family: var(--font-mono); font-size: clamp(.55rem, .82vw, .7rem); font-weight: 800; letter-spacing: .08em; text-align: right; }
    .bg-result-columns { display: grid; grid-template-columns: 30px 1fr auto auto auto; gap: 12px; padding: 0 12px; color: rgba(30, 25, 20, .55); font-family: var(--font-mono); font-size: clamp(.46rem, .7vw, .58rem); font-weight: 800; letter-spacing: .12em; }
    .bg-result-columns span:nth-child(n + 3) { text-align: right; }
    .bg-results { display: flex; flex-direction: column; gap: 5px; }
    .bg-row { display: grid; grid-template-columns: 30px 1fr auto auto auto; gap: 12px; align-items: center; padding: 7px 12px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.72rem, 1vw, .92rem); }
    .bg-row.paid { background: var(--acid); }
    .bg-row-pos { font-weight: 800; }
    .bg-row-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bg-row-marble { font-size: .82em; opacity: .7; }
    .bg-row-points { font-size: 1.05em; }
    .bg-row-total { min-width: 42px; text-align: right; font-weight: 800; }
    .bg-finale { display: flex; flex-direction: column; gap: 10px; }
    .bg-finale-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 3px solid var(--coal); }
    .bg-finale-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 800; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .bg-finale-note { color: rgba(30, 25, 20, .62); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); letter-spacing: .12em; text-align: right; }
    .bg-final-row { grid-template-columns: 46px 1fr auto auto !important; padding: clamp(8px, 1.2vh, 12px) clamp(12px, 1.4vw, 18px); }
    .bg-final-row.paid { box-shadow: 6px 6px 0 var(--tomato); }
    .bg-final-row .bg-row-pos { display: grid; place-items: center; width: 32px; height: 32px; background: var(--coal); color: var(--paper-hi); font-family: var(--font-mono); }
    .bg-final-row.paid .bg-row-pos { background: var(--tomato); }
    .bg-final-row .bg-row-points { color: var(--coal); font-size: clamp(1rem, 1.5vw, 1.35rem); }
    .bg-final-row.paid .bg-row-name::after { content: 'VINCITORE'; display: inline-block; margin-left: 10px; padding: 2px 7px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: .55em; letter-spacing: .12em; vertical-align: middle; }
    @keyframes bg-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class BiglieBonus implements OnInit, OnDestroy {
  private ws = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  /** Banco di prova: intro breve, scelta automatica e gare senza attese. */
  @Input() preview = false;
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  @ViewChild('raceCanvas') private raceCanvas?: ElementRef<HTMLCanvasElement>;

  readonly tracks = TRACKS;

  readonly phase = signal<Phase>(Phase.INTRO);

  /** Fasi del gioco, disponibili anche nel template. */
  readonly Phase = Phase;
  readonly secondsLeft = signal(0);
  readonly raceIndex = signal(0);
  readonly currentPlayer = signal<string | null>(null);
  readonly marbles = signal<MarbleView[]>([]);
  readonly lanes = signal<Lane[]>([]);
  readonly standings = signal<RaceRow[]>([]);
  readonly raceResult = signal<RaceRow[] | null>(null);

  private pickOrder: string[] = [];
  private pickCursor = 0;
  private assignments = new Map<string, string>();
  private marbleSet: Marble[] = [];
  private totals = new Map<string, number>();
  private finishCount = 0;
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  private raceMarbles: RaceMarble[] = [];
  private matter?: any;
  private engine?: any;
  private destroyed = false;
  private physicsAccumulator = 0;
  private particles: ImpactParticle[] = [];
  private cameraShake = 0;
  private raceElapsed = 0;
  private publishAcc = 0;
  private raceEnding = false;
  private frame = 0;
  private lastFrame = 0;
  private raceCtx: CanvasRenderingContext2D | null = null;
  private raceW = 0;
  private raceH = 0;
  private raceDpr = 1;
  private raceResize?: ResizeObserver;
  private cameraX = 0;
  private cameraReady = false;
  private trackSamples: Array<{ x: number; y: number }> = [];
  private trackSeed = 0;
  private hazards: Hazard[] = [];

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(this.preview ? 200 : 700, () => this.startIntro());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearClock();
    this.destroyPhysics();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.raceResize?.disconnect();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  heading(): string {
    switch (this.phase()) {
      case Phase.INTRO:
        return 'QUATTRO GARE, UNA BIGLIA';
      case Phase.PICK:
        return 'SCELTA DELLA BIGLIA';
      case Phase.RACE:
        return `GARA ${this.raceIndex() + 1} / ${TRACKS.length}`;
      case Phase.RACE_END:
        return "ORDINE D'ARRIVO";
      default:
        return 'CLASSIFICA FINALE';
    }
  }

  subtitle(): string {
    if (this.phase() === Phase.PICK) {
      return `ORDINE SORTEGGIATO · ${this.pickProgress()}`;
    }
    const track = this.currentTrack();
    if (track && (this.phase() === Phase.RACE || this.phase() === Phase.RACE_END)) {
      return `${track.emoji} ${track.name} · FONDO ${track.surface}`;
    }
    return 'UNA BIGLIA PER TAVOLO, MAI CONDIVISA';
  }

  pickProgress(): string {
    if (!this.pickOrder.length) return '';
    return `${Math.min(this.pickCursor + 1, this.pickOrder.length)} / ${this.pickOrder.length}`;
  }

  currentTrack(): Track | null {
    return TRACKS[this.raceIndex()] ?? null;
  }

  pct(value: number): number {
    return Math.round(Number(value) || 0);
  }

  marbleColor(id: string): string {
    return this.marbleById(id)?.color ?? '#94a3b8';
  }

  marbleEmoji(id: string): string {
    return this.marbleById(id)?.emoji ?? '⚪';
  }

  marbleName(id: string): string {
    return this.marbleById(id)?.name ?? '—';
  }

  private startIntro(): void {
    const seconds = this.preview ? 1 : INTRO_SECONDS;
    this.phase.set(Phase.INTRO);
    this.secondsLeft.set(seconds);
    this.publish();
    this.startClock(seconds, () => this.preparePick());
  }

  private preparePick(): void {
    this.clearClock();
    this.marbleSet = this.buildMarbleSet(this.players.length);
    this.assignments.clear();
    this.totals.clear();
    this.standings.set([]);
    this.raceResult.set(null);
    this.syncMarbles();

    this.pickOrder = this.shuffle([...this.players]);
    this.pickCursor = 0;
    this.startPick();
  }

  private startPick(): void {
    if (this.pickCursor >= this.pickOrder.length) {
      void this.startRace(0);
      return;
    }

    this.phase.set(Phase.PICK);
    this.currentPlayer.set(this.pickOrder[this.pickCursor]);

    if (this.preview) {
      this.secondsLeft.set(0);
      this.publish();
      this.later(220, () => this.previewPick());
      return;
    }

    this.secondsLeft.set(PICK_SECONDS);
    this.publish();
    this.startClock(PICK_SECONDS, () => this.autoPick());
  }

  /** Scelta demo: biglia libera a caso, così la preview mostra subito la gara. */
  private previewPick(): void {
    const player = this.currentPlayer();
    if (!player || this.phase() !== Phase.PICK) return;

    const taken = new Set(this.assignments.values());
    const free = this.marbleSet.filter((marble) => !taken.has(marble.id));
    if (!free.length) {
      this.pickCursor += 1;
      this.startPick();
      return;
    }

    this.assignMarble(player, free[Math.floor(Math.random() * free.length)].id);
  }

  private autoPick(): void {
    const taken = new Set(this.assignments.values());
    const free = this.marbleSet.find((marble) => !taken.has(marble.id));
    const player = this.currentPlayer();

    if (!free || !player) {
      this.pickCursor += 1;
      this.startPick();
      return;
    }

    this.assignMarble(player, free.id);
  }

  private assignMarble(playerName: string, marbleId: string): void {
    this.assignments.set(playerName, marbleId);
    this.syncMarbles();
    this.pickCursor += 1;
    this.startPick();
  }

  private async startRace(index: number): Promise<void> {
    this.clearClock();

    if (index >= TRACKS.length) {
      this.finale();
      return;
    }

    this.raceIndex.set(index);
    this.trackSeed = Math.floor(Math.random() * 0xffffffff);
    this.layoutTrack();
    this.generateHazards(TRACKS[index]);
    this.finishCount = 0;
    this.raceResult.set(null);
    this.currentPlayer.set(null);
    this.raceMarbles = this.players.map((playerName) => ({
      playerName,
      marbleId: this.assignments.get(playerName) ?? '',
      x: 0,
      v: 0,
      body: null,
      finished: false,
      position: null,
      trail: [],
      bumped: new Set<string>(),
      slowUntil: 0,
      boostUntil: 0,
    }));
    this.raceElapsed = 0;
    this.publishAcc = 0;
    this.raceEnding = false;
    this.cameraX = 0;
    this.cameraReady = false;
    this.lastFrame = 0;
    this.physicsAccumulator = 0;
    this.particles = [];
    this.cameraShake = 0;
    this.phase.set(Phase.RACE);
    this.secondsLeft.set(RACE_SECONDS);
    this.lanes.set(this.raceMarbles.map((marble) => ({
      playerName: marble.playerName,
      marbleId: marble.marbleId,
      progress: 0,
      finished: false,
      position: null,
    })));
    this.publish();

    try {
      const Matter = await this.ensureMatter();
      if (this.destroyed || this.phase() !== Phase.RACE || this.raceIndex() !== index) return;
      this.createPhysics(Matter);
      requestAnimationFrame(() => this.attachCanvas());
    } catch (error) {
      console.error('Biglie: impossibile caricare Matter.js', error);
    }
  }

  private async ensureMatter(): Promise<any> {
    if (!this.matter) {
      const module: any = await import('matter-js');
      this.matter = module.default?.default ?? module.default ?? module;
    }
    return this.matter;
  }

  /**
   * Corridoio fisico rettilineo: x = progresso, y = lato della pista.
   * La pista disegnata è curva, ma la simulazione vive in coordinate di pista:
   * così le biglie sono cerchi veri che si urtano, si spintonano e si superano.
   */
  private createPhysics(Matter: any): void {
    this.destroyPhysics();

    const { Engine, Bodies, Body, Composite, Events } = Matter;
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;
    const world = engine.world;
    const count = Math.max(1, this.raceMarbles.length);
    const trackWidth = this.raceTrackWidth(count);
    const radius = this.marbleRadius(count, trackWidth);
    const half = trackWidth / 2;
    const laneLength = TRACK_WORLD_LENGTH + 500;

    Composite.add(world, [
      Bodies.rectangle(TRACK_START_X + TRACK_WORLD_LENGTH / 2, -half - 12, laneLength, 24, {
        isStatic: true,
        restitution: 0.42,
        friction: 0.02,
        label: 'wall-up',
      }),
      Bodies.rectangle(TRACK_START_X + TRACK_WORLD_LENGTH / 2, half + 12, laneLength, 24, {
        isStatic: true,
        restitution: 0.42,
        friction: 0.02,
        label: 'wall-down',
      }),
      Bodies.rectangle(TRACK_START_X - 46, 0, 42, half * 2 + 90, {
        isStatic: true,
        restitution: 0.3,
        label: 'wall-back',
      }),
    ]);

    for (const hazard of this.hazards) {
      const lateral = hazard.offset * trackWidth * 0.3;
      const x = TRACK_START_X + hazard.progress * TRACK_WORLD_LENGTH;
      Composite.add(
        world,
        Bodies.circle(x, lateral, hazard.radius + 1, {
          isStatic: true,
          isSensor: true,
          label: hazard.id,
        }),
      );

      // Sassoi e scogli sono solidi: non solo effetto, deviano davvero.
      if (hazard.kind === 'sasso' || hazard.kind === 'scoglio') {
        Composite.add(
          world,
          Bodies.circle(x, lateral, hazard.radius * 0.82, {
            isStatic: true,
            restitution: 0.46,
            friction: 0.08,
            label: `rock-${hazard.id}`,
          }),
        );
      }
    }

    // Griglia di partenza: colonne sulla larghezza, file dietro la linea.
    const cols = Math.min(4, count);
    const laneStep = cols <= 1 ? 0 : (trackWidth - radius * 2 - 14) / (cols - 1);
    this.raceMarbles.forEach((marble, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const lateral = -half + radius + 7 + col * laneStep;
      const x = TRACK_START_X + 18 + row * (radius * 2 + 14);
      const body = Bodies.circle(x, lateral, radius, {
        label: `marble-${index}`,
        friction: 0.02,
        frictionAir: 0,
        restitution: 0.52,
        density: 0.002,
      });
      marble.body = body;
      marble.x = 0;
      Composite.add(world, body);
    });

    Events.on(engine, 'collisionStart', (event: any) => {
      for (const pair of event.pairs) {
        const first = this.marbleForBody(pair.bodyA);
        const second = this.marbleForBody(pair.bodyB);

        // Biglia contro biglia: scintille nel punto di contatto.
        if (first && second) {
          if (!first.finished && !second.finished) {
            const support = pair.collision?.supports?.[0];
            this.spawnClash(
              support?.x ?? (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
              support?.y ?? (pair.bodyA.position.y + pair.bodyB.position.y) / 2,
            );
          }
          continue;
        }

        const marble = first ?? second;
        if (!marble || marble.finished) continue;

        const hazardBody = pair.bodyA.label?.startsWith('hazard-')
          ? pair.bodyA
          : pair.bodyB.label?.startsWith('hazard-')
            ? pair.bodyB
            : null;
        if (!hazardBody) continue;
        if (marble.bumped.has(hazardBody.label)) continue;

        const hazard = this.hazards.find((item) => item.id === hazardBody.label);
        if (!hazard) continue;

        marble.bumped.add(hazard.id);
        const body = marble.body;

        if (hazard.kind === 'fango' || hazard.kind === 'pozzanghera') {
          marble.slowUntil = this.raceElapsed + (hazard.kind === 'fango' ? 1.1 : 0.7);
          Body.setVelocity(body, {
            x: body.velocity.x * (hazard.kind === 'fango' ? 0.6 : 0.82),
            y: Math.min(body.velocity.y, -0.7),
          });
        } else if (hazard.kind === 'ghiaccio') {
          marble.boostUntil = this.raceElapsed + 0.9;
          Body.setVelocity(body, {
            x: body.velocity.x * 1.08,
            y: body.velocity.y,
          });
        } else if (hazard.kind === 'onda') {
          Body.setVelocity(body, {
            x: body.velocity.x * 0.94,
            y: Math.min(body.velocity.y, -3.1 - Math.random() * 0.8),
          });
        } else if (hazard.kind === 'cordolo') {
          Body.setVelocity(body, {
            x: body.velocity.x * 0.96,
            y: Math.min(body.velocity.y, -1.9 - Math.random() * 0.5),
          });
        } else {
          Body.setVelocity(body, {
            x: body.velocity.x * 0.985,
            y: Math.min(body.velocity.y, -2.6 - Math.random() * 0.7),
          });
        }

        this.spawnImpact(marble, hazard.kind);
      }
    });

    this.engine = engine;
  }

  private marbleForBody(body: any): RaceMarble | undefined {
    return this.raceMarbles.find((marble) => marble.body === body);
  }

  private spawnImpact(marble: RaceMarble, hazard?: HazardKind): void {
    const body = marble.body;
    if (!body) return;

    const palette = hazard
      ? this.hazardPalette(hazard)
      : this.surfacePalette(this.currentTrack()?.id ?? 'rally');
    const at = this.simToView(body.position.x, body.position.y);
    for (let index = 0; index < 9; index++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const speed = 30 + Math.random() * 95;
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        color: index % 2 === 0 ? palette.top : palette.speck,
        size: 1.5 + Math.random() * 2.5,
      });
    }
    if (this.particles.length > 220) {
      this.particles.splice(0, this.particles.length - 220);
    }
    this.cameraShake = Math.min(6, this.cameraShake + 2.4);
  }

  /** Scintille e colpo di camera quando due biglie si scontrano davvero. */
  private spawnClash(x: number, lateral: number): void {
    const at = this.simToView(x, lateral);
    for (let index = 0; index < 7; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.25,
        max: 0.45,
        color: index % 2 === 0 ? PAPER_HI : MUSTARD,
        size: 1.4 + Math.random() * 2,
      });
    }
    if (this.particles.length > 220) {
      this.particles.splice(0, this.particles.length - 220);
    }
    this.cameraShake = Math.min(7, this.cameraShake + 1.8);
  }

  /** Da coordinate di pista (x, lato) al punto disegnato sulla pista curva. */
  private simToView(x: number, lateral: number): { x: number; y: number } {
    const progress = Math.max(
      0,
      Math.min(1, (x - TRACK_START_X) / TRACK_WORLD_LENGTH),
    );
    const point = this.trackPoint(progress);
    return {
      x: point.x - Math.sin(point.angle) * lateral,
      y: point.y + Math.cos(point.angle) * lateral,
    };
  }

  private destroyPhysics(): void {
    if (!this.engine) return;
    if (this.matter) {
      this.matter.Events.off(this.engine);
      this.matter.Composite.clear(this.engine.world, false, true);
      this.matter.Engine.clear(this.engine);
    }
    this.engine = undefined;
  }

  private attachCanvas(attempt = 0): void {
    const canvas = this.raceCanvas?.nativeElement;
    if (!canvas) {
      if (attempt < 10) requestAnimationFrame(() => this.attachCanvas(attempt + 1));
      return;
    }

    this.raceCtx = canvas.getContext('2d');
    this.raceResize?.disconnect();
    this.raceResize = new ResizeObserver(() => this.resizeRaceCanvas());
    this.raceResize.observe(canvas);
    this.resizeRaceCanvas();

    if (!this.frame) {
      this.ngZone.runOutsideAngular(() => {
        this.frame = requestAnimationFrame(this.loop);
      });
    }
  }

  private resizeRaceCanvas(): void {
    const canvas = this.raceCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    this.raceDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.raceW = rect.width;
    this.raceH = rect.height;
    canvas.width = Math.round(rect.width * this.raceDpr);
    canvas.height = Math.round(rect.height * this.raceDpr);

    // La pista è solo disegno: si può ridimensionare senza toccare la fisica.
    if (this.trackSeed) this.layoutTrack();
  }

  private loop = (now: number): void => {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;

    if (this.phase() === Phase.RACE && !this.raceEnding) {
      this.advanceRace(dt);
    }
    if (this.phase() === Phase.RACE) {
      this.drawRace(now);
    }

    this.frame = requestAnimationFrame(this.loop);
  };

  /** Passo fisso: la simulazione non dipende dal refresh della TV. */
  private advanceRace(dt: number): void {
    const track = this.currentTrack();
    if (!track || dt <= 0) return;

    this.raceElapsed += dt;

    if (this.engine) {
      this.physicsAccumulator = Math.min(250, this.physicsAccumulator + dt * 1000);
      let steps = 0;
      while (this.physicsAccumulator >= PHYSICS_STEP && steps < 4) {
        this.stepPhysics();
        this.physicsAccumulator -= PHYSICS_STEP;
        steps += 1;
      }
      this.stepParticles(dt);
    }

    this.publishAcc += dt;
    if (this.publishAcc >= 0.16) {
      this.publishAcc = 0;
      this.ngZone.run(() => this.syncRaceView());
    }

    if (this.raceMarbles.every((marble) => marble.finished) || this.raceElapsed >= RACE_SECONDS) {
      this.raceEnding = true;
      this.ngZone.run(() => this.endRace());
    }
  }

  private stepPhysics(): void {
    const track = this.currentTrack();
    if (!track || !this.engine || !this.matter) return;

    const { Engine, Body, Composite } = this.matter;
    const count = Math.max(1, this.raceMarbles.length);
    const radius = this.marbleRadius(count, this.raceTrackWidth(count));

    for (const marble of this.raceMarbles) {
      if (marble.finished || !marble.body) continue;

      const data = this.marbleById(marble.marbleId);
      if (!data) continue;

      const profile =
        (data.speed * track.weights.speed
          + data.accel * track.weights.accel
          + data.grip * track.weights.grip) / 10;
      let target = 3.1 + profile * 1.15;
      if (marble.slowUntil > this.raceElapsed) target *= 0.52;
      if (marble.boostUntil > this.raceElapsed) target *= 1.12;
      const body = marble.body;
      Body.setVelocity(body, {
        x: body.velocity.x + (target - body.velocity.x) * 0.1,
        y: body.velocity.y,
      });
    }

    Engine.update(this.engine, PHYSICS_STEP);

    const finishX = TRACK_START_X + TRACK_WORLD_LENGTH - radius;
    for (const marble of this.raceMarbles) {
      if (marble.finished || !marble.body) continue;

      const body = marble.body;
      marble.x = Math.max(
        0,
        Math.min(100, ((body.position.x - TRACK_START_X) / TRACK_WORLD_LENGTH) * 100),
      );
      marble.v = body.velocity.x;
      marble.trail.push({ x: body.position.x, y: body.position.y });
      if (marble.trail.length > 30) marble.trail.shift();

      if (body.position.x >= finishX) {
        marble.x = 100;
        marble.finished = true;
        this.finishCount += 1;
        marble.position = this.finishCount;
        Composite.remove(this.engine.world, body);
      }
    }
  }

  private stepParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 220 * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 22);
  }

  private syncRaceView(): void {
    this.secondsLeft.set(Math.max(0, Math.ceil(RACE_SECONDS - this.raceElapsed)));
    this.lanes.set(this.raceMarbles.map((marble) => ({
      playerName: marble.playerName,
      marbleId: marble.marbleId,
      progress: Math.min(100, marble.x),
      finished: marble.finished,
      position: marble.position,
    })));
    this.publish();
  }

  private endRace(): void {
    const ranked = [...this.raceMarbles].sort((a, b) => {
      const positionA = a.position ?? 999;
      const positionB = b.position ?? 999;
      if (positionA !== positionB) return positionA - positionB;
      return b.x - a.x;
    });

    const rows: RaceRow[] = ranked.map((marble, index) => {
      const points = RACE_POINTS[index] ?? 0;
      const total = (this.totals.get(marble.playerName) ?? 0) + points;
      this.totals.set(marble.playerName, total);

      if (points > 0) {
        this.result.emit({ playerName: marble.playerName, score: points });
      }

      return {
        playerName: marble.playerName,
        marbleId: marble.marbleId,
        position: index + 1,
        points,
        total,
      };
    });

    this.raceResult.set(rows);
    this.standings.set([...rows].sort((a, b) => b.total - a.total));
    this.phase.set(Phase.RACE_END);
    this.secondsLeft.set(BETWEEN_SECONDS);
    this.publish();

    this.startClock(this.preview ? 1 : BETWEEN_SECONDS, () => {
      void this.startRace(this.raceIndex() + 1);
    });
  }

  private drawRace(now: number): void {
    const ctx = this.raceCtx;
    const track = this.currentTrack();
    if (!ctx || !track || this.raceW < 20 || this.raceH < 20) return;

    const w = this.raceW;
    const h = this.raceH;
    ctx.setTransform(this.raceDpr, 0, 0, this.raceDpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawBackdrop(ctx, track, w, h, now);

    const count = Math.max(1, this.raceMarbles.length);
    const trackWidth = this.raceTrackWidth(count);
    const leader = this.leaderMarble();
    const leaderPoint = this.trackPoint(Math.max(0, Math.min(1, (leader?.x ?? 0) / 100)));
    const maxTrackX = this.trackSamples.length
      ? Math.max(...this.trackSamples.map((sample) => sample.x))
      : TRACK_START_X + TRACK_WORLD_LENGTH;
    const maxCamera = Math.max(0, maxTrackX + TRACK_END_PADDING - w);
    // La TV resta su una sola corsia e insegue le prime biglie: il gruppo di
    // testa sta poco oltre il centro, con la strada davanti e gli inseguitori
    // ancora in campo a sinistra.
    const targetCamera = Math.max(0, Math.min(maxCamera, leaderPoint.x - w * 0.58));
    if (!this.cameraReady) {
      this.cameraX = targetCamera;
      this.cameraReady = true;
    } else {
      this.cameraX += (targetCamera - this.cameraX) * 0.09;
    }

    const shake = this.cameraShake;
    const shakeX = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawTrack(ctx, track, w, h, trackWidth, now);

    const drawOrder = [...this.raceMarbles].sort((a, b) => {
      const pointA = this.trackPoint(Math.min(1, a.x / 100));
      const pointB = this.trackPoint(Math.min(1, b.x / 100));
      return pointA.y - pointB.y;
    });

    for (const marble of drawOrder) {
      const index = this.raceMarbles.indexOf(marble);
      this.drawRacer(ctx, marble, index, count, trackWidth, h, now, marble === leader);
    }

    this.drawParticles(ctx, w, h);
    ctx.restore();
    this.drawRaceHud(ctx, w);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.particles.length) return;

    ctx.save();
    for (const particle of this.particles) {
      const x = particle.x - this.cameraX;
      if (x < -20 || x > w + 20) continue;
      const y = h * TRACK_VIEW_CENTER + particle.y;
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        x - particle.size / 2,
        y - particle.size / 2,
        particle.size,
        particle.size,
      );
    }
    ctx.restore();
  }

  private leaderMarble(): RaceMarble | null {
    return (
      [...this.raceMarbles].sort((a, b) => {
        const positionA = a.position ?? 999;
        const positionB = b.position ?? 999;
        if (positionA !== positionB) return positionA - positionB;
        return b.x - a.x;
      })[0] ?? null
    );
  }

  /**
   * Una sola corsia orizzontale, come il vecchio tabellone: la camera scorre
   * da sinistra verso destra e tiene inquadrato il gruppo di testa. La fisica
   * vive in coordinate di pista, quindi il disegno resta un semplice rettilineo.
   */
  private layoutTrack(): void {
    const count = 901;
    this.trackSamples = Array.from({ length: count }, (_, index) => ({
      x: TRACK_START_X + (TRACK_WORLD_LENGTH * index) / (count - 1),
      y: 0,
    }));
  }

  private seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private generateHazards(track: Track): void {
    const rng = this.seededRandom(Math.floor(Math.random() * 0xffffffff));
    const plan = HAZARD_PLANS[track.id] ?? HAZARD_PLANS['rally'];
    const hazards: Hazard[] = [];
    const used: number[] = [];

    plan.forEach((kind, index) => {
      let progress = 0;
      for (let attempt = 0; attempt < 40; attempt++) {
        progress = 0.09 + rng() * 0.82;
        if (used.every((value) => Math.abs(value - progress) > 0.05)) break;
      }
      used.push(progress);

      const patch = kind === 'fango' || kind === 'pozzanghera' || kind === 'ghiaccio';
      hazards.push({
        id: `hazard-${track.id}-${index}`,
        kind,
        progress,
        offset:
          kind === 'cordolo'
            ? index % 2 === 0
              ? 0.84
              : -0.84
            : (rng() * 2 - 1) * 0.62,
        radius: patch
          ? kind === 'ghiaccio'
            ? 17
            : 15
          : kind === 'scoglio'
            ? 11
            : kind === 'cumulo'
              ? 10
              : 9,
        patch,
      });
    });

    this.hazards = hazards;
  }

  private hazardLane(
    hazard: Hazard,
    trackWidth: number,
  ): { x: number; y: number; angle: number } {
    const point = this.trackPoint(hazard.progress);
    const lateral = hazard.offset * trackWidth * 0.3;
    const nx = -Math.sin(point.angle);
    const ny = Math.cos(point.angle);
    return {
      x: point.x + nx * lateral,
      y: point.y + ny * lateral,
      angle: point.angle,
    };
  }

  private hazardPalette(kind: HazardKind): { top: string; bottom: string; speck: string } {
    switch (kind) {
      case 'fango':
        return { top: '#6b3a12', bottom: '#3f210a', speck: '#c08b4a' };
      case 'pozzanghera':
        return { top: COBALT, bottom: '#1d3ba8', speck: MINT };
      case 'ghiaccio':
        return { top: PAPER_HI, bottom: MINT, speck: COBALT };
      case 'cumulo':
        return { top: PAPER_HI, bottom: '#c9d8e8', speck: COBALT };
      case 'onda':
        return { top: MINT, bottom: COBALT, speck: PAPER_HI };
      case 'boa':
        return { top: TOMATO, bottom: '#b32714', speck: PAPER_HI };
      case 'scoglio':
        return { top: '#3a3a2c', bottom: INK, speck: '#6f6652' };
      case 'cordolo':
        return { top: TOMATO, bottom: PAPER, speck: INK };
      default:
        return { top: MUSTARD, bottom: '#b07a12', speck: PAPER_HI };
    }
  }

  /** Punto campionato della pista: curve corte, senza salti tra i tratti. */
  private trackPoint(progress: number): { x: number; y: number; angle: number } {
    const p = Math.max(0, Math.min(1, progress));
    const samples = this.trackSamples;

    if (samples.length < 2) {
      return { x: TRACK_START_X + p * TRACK_WORLD_LENGTH, y: 0, angle: 0 };
    }

    const exact = p * (samples.length - 1);
    const index = Math.min(samples.length - 2, Math.floor(exact));
    const local = exact - index;
    const start = samples[index];
    const end = samples[index + 1];
    return {
      x: start.x + (end.x - start.x) * local,
      y: start.y + (end.y - start.y) * local,
      angle: Math.atan2(end.y - start.y, Math.max(0.001, end.x - start.x)),
    };
  }

  private raceTrackWidth(count: number): number {
    // Una corsia sola deve contenere tutte le biglie e restare leggibile a 720p.
    return Math.max(210, Math.min(300, count * 30));
  }

  private marbleRadius(count: number, trackWidth: number): number {
    return Math.max(9, Math.min(15, trackWidth / Math.max(11, count * 1.7)));
  }

  private drawBackdrop(
    ctx: CanvasRenderingContext2D,
    track: Track,
    w: number,
    h: number,
    now: number,
  ): void {
    const sky = this.skyPalette(track);
    const skyFill = ctx.createLinearGradient(0, 0, 0, h);
    skyFill.addColorStop(0, sky.top);
    skyFill.addColorStop(1, sky.bottom);
    ctx.fillStyle = skyFill;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.78, h * 0.18, 8, w * 0.78, h * 0.18, 190);
    glow.addColorStop(0, sky.glow);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const shift = (this.cameraX * 0.14) % 520;
    for (let layer = 0; layer < 2; layer++) {
      const base = h * (0.62 + layer * 0.05);
      const offset = -shift * (layer === 0 ? 0.8 : 1.1) - 520;
      ctx.fillStyle = layer === 0 ? sky.hillFar : sky.hill;
      for (let index = 0; index < Math.ceil(w / 520) + 3; index++) {
        const x = offset + index * 520;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + 150, base - 130 + layer * 35, x + 300, base);
        ctx.quadraticCurveTo(x + 390, base - 70 + layer * 20, x + 520, base);
        ctx.lineTo(x + 520, h);
        ctx.closePath();
        ctx.fill();
      }
    }

    const ground = ctx.createLinearGradient(0, h * 0.66, 0, h);
    ground.addColorStop(0, sky.ground);
    ground.addColorStop(1, '#070a0f');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.66, w, h * 0.34);

    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let index = 0; index < 38; index++) {
      const drift = track.id === 'neve' ? 0.018 : track.id === 'acqua' ? 0.008 : 0.003;
      const px = ((index * 167 + now * drift) % (w + 80)) - 40;
      const py = 22 + ((index * 97) % Math.max(1, h * 0.58));
      ctx.fillStyle =
        track.id === 'neve'
          ? 'rgba(248, 250, 252, .8)'
          : track.id === 'acqua'
            ? 'rgba(125, 211, 252, .45)'
            : track.id === 'f1'
              ? 'rgba(251, 191, 36, .45)'
              : 'rgba(214, 162, 92, .38)';
      ctx.beginPath();
      ctx.arc(px, py, track.id === 'neve' ? 2.1 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private skyPalette(track: Track): {
    top: string;
    bottom: string;
    hill: string;
    hillFar: string;
    ground: string;
    glow: string;
  } {
    switch (track.id) {
      case 'neve':
        return {
          top: '#0b3049',
          bottom: '#7dd3fc',
          hill: '#224c6b',
          hillFar: '#17364e',
          ground: '#dbeafe',
          glow: 'rgba(224, 242, 254, .42)',
        };
      case 'acqua':
        return {
          top: '#041f2e',
          bottom: '#0e7490',
          hill: '#083344',
          hillFar: '#062b3a',
          ground: '#082f49',
          glow: 'rgba(125, 211, 252, .28)',
        };
      case 'f1':
        return {
          top: '#0b1220',
          bottom: '#334155',
          hill: '#1e293b',
          hillFar: '#172233',
          ground: '#1e293b',
          glow: 'rgba(251, 191, 36, .2)',
        };
      default:
        return {
          top: '#241209',
          bottom: '#7c4a21',
          hill: '#3f2412',
          hillFar: '#2a170d',
          ground: '#3b2412',
          glow: 'rgba(251, 146, 60, .24)',
        };
    }
  }

  private drawTrack(
    ctx: CanvasRenderingContext2D,
    track: Track,
    w: number,
    h: number,
    trackWidth: number,
    now: number,
  ): void {
    const palette = this.surfacePalette(track.id);
    const points: Array<{ x: number; y: number; nx: number; ny: number }> = [];
    for (let index = 0; index <= 280; index++) {
      const point = this.trackPoint(index / 280);
      points.push({
        x: point.x - this.cameraX,
        y: h * TRACK_VIEW_CENTER + point.y,
        nx: -Math.sin(point.angle),
        ny: Math.cos(point.angle),
      });
    }

    const path = this.trackPath(points, 0);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(0, 10);
    ctx.strokeStyle = 'rgba(0, 0, 0, .42)';
    ctx.lineWidth = trackWidth + 16;
    ctx.stroke(path);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#070a0f';
    ctx.lineWidth = trackWidth + 10;
    ctx.stroke(path);

    const surface = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.85);
    surface.addColorStop(0, palette.top);
    surface.addColorStop(1, palette.bottom);
    ctx.strokeStyle = surface;
    ctx.lineWidth = trackWidth;
    ctx.stroke(path);

    ctx.strokeStyle = 'rgba(255, 255, 255, .16)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);

    ctx.setLineDash([16, 20]);
    ctx.strokeStyle = 'rgba(255, 255, 255, .24)';
    ctx.lineWidth = 2;
    ctx.stroke(path);
    ctx.setLineDash([]);

    for (const side of [-1, 1]) {
      const edge = this.trackPath(points, side * (trackWidth / 2 - 3));
      ctx.setLineDash([20, 18]);
      ctx.strokeStyle = side > 0 ? 'rgba(255, 255, 255, .62)' : 'rgba(248, 113, 113, .62)';
      ctx.lineWidth = 3;
      ctx.stroke(edge);
      ctx.setLineDash([]);
    }

    for (let index = 0; index < 150; index++) {
      const point = this.trackPoint((index * 0.0067) % 1);
      const side = Math.sin(index * 12.9898) * 0.5;
      const px = point.x - this.cameraX + Math.cos(point.angle) * side * trackWidth * 0.86;
      const py = h * TRACK_VIEW_CENTER + point.y - Math.sin(point.angle) * side * trackWidth * 0.86;
      ctx.globalAlpha = 0.22 + (index % 3) * 0.08;
      ctx.fillStyle = palette.speck;
      ctx.beginPath();
      ctx.arc(px, py, 1 + (index % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (track.id === 'acqua') {
      for (let row = 0; row < 3; row++) {
        ctx.strokeStyle = 'rgba(186, 230, 253, .26)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let index = 0; index <= 120; index++) {
          const point = this.trackPoint(index / 120);
          const px = point.x - this.cameraX;
          const py = h * TRACK_VIEW_CENTER + point.y + Math.sin(index / 8 + now / 360 + row) * 4 + (row - 1) * 14;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    if (track.id === 'f1') this.drawCurbs(ctx, points, trackWidth);
    if (track.id === 'neve') this.drawSnowbanks(ctx, points, trackWidth);

    this.drawHazards(ctx, w, h, trackWidth, now);

    this.drawGate(ctx, 0, 'START', w, h, trackWidth);
    this.drawGate(ctx, 1, 'TRAGUARDO', w, h, trackWidth);
  }

  /** Ostacoli disegnati a terra, con ombre piatte e inchiostro pieno. */
  private drawHazards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    trackWidth: number,
    now: number,
  ): void {
    for (const hazard of this.hazards) {
      const lane = this.hazardLane(hazard, trackWidth);
      const x = lane.x - this.cameraX;
      if (x < -90 || x > w + 90) continue;

      const y = h * TRACK_VIEW_CENTER + lane.y - 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lane.angle);

      switch (hazard.kind) {
        case 'fango':
          this.drawPatch(ctx, 24, 10, '#5a3315', '#8a5a2b');
          break;
        case 'pozzanghera':
          this.drawPatch(ctx, 21, 9, COBALT, MINT, 0.55);
          break;
        case 'ghiaccio':
          this.drawPatch(ctx, 23, 9, PAPER_HI, ACID, 0.7);
          ctx.strokeStyle = COBALT;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(-2, -3);
          ctx.lineTo(7, 2);
          ctx.moveTo(2, -6);
          ctx.lineTo(9, -2);
          ctx.stroke();
          break;
        case 'sasso':
          this.drawRock(ctx, 9, '#6f6652', '#3a3a2c');
          break;
        case 'cordolo':
          this.drawCurb(ctx, trackWidth);
          break;
        case 'cumulo':
          this.drawSnowMound(ctx);
          break;
        case 'onda':
          this.drawWave(ctx, trackWidth, now);
          break;
        case 'boa':
          this.drawBuoy(ctx);
          break;
        case 'scoglio':
          this.drawRock(ctx, 11, '#3a3a2c', INK);
          this.drawWave(ctx, trackWidth * 0.7, now, true);
          break;
      }

      ctx.restore();
    }
  }

  private drawPatch(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    fill: string,
    highlight: string,
    highlightAlpha = 0.4,
  ): void {
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = highlightAlpha;
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.18, -ry * 0.2, rx * 0.55, ry * 0.4, -0.2, 0, Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawRock(
    ctx: CanvasRenderingContext2D,
    radius: number,
    fill: string,
    shade: string,
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, .38)';
    ctx.beginPath();
    ctx.ellipse(2, radius * 0.7, radius * 0.95, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = shade;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius, 2);
    ctx.lineTo(-radius * 0.55, -radius * 0.7);
    ctx.lineTo(radius * 0.15, -radius);
    ctx.lineTo(radius * 0.9, -radius * 0.35);
    ctx.lineTo(radius, radius * 0.45);
    ctx.lineTo(radius * 0.25, radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, -radius * 0.35);
    ctx.lineTo(radius * 0.1, -radius * 0.85);
    ctx.lineTo(radius * 0.55, -radius * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  private drawCurb(ctx: CanvasRenderingContext2D, trackWidth: number): void {
    const length = Math.max(22, Math.min(40, trackWidth * 0.28));
    ctx.fillStyle = 'rgba(0, 0, 0, .35)';
    ctx.fillRect(-length / 2 + 2, -1, length, 12);

    for (let index = 0; index < 4; index++) {
      ctx.fillStyle = index % 2 === 0 ? TOMATO : PAPER_HI;
      ctx.fillRect(-length / 2 + (length / 4) * index, -7, length / 4, 12);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(-length / 2, -7, length, 12);
  }

  private drawSnowMound(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, .22)';
    ctx.beginPath();
    ctx.ellipse(1, 7, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PAPER_HI;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 5);
    ctx.quadraticCurveTo(-9, -8, -1, -7);
    ctx.quadraticCurveTo(7, -10, 12, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(47, 91, 255, .4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.quadraticCurveTo(0, -2, 6, 1);
    ctx.stroke();
  }

  private drawWave(
    ctx: CanvasRenderingContext2D,
    width: number,
    now: number,
    foamOnly = false,
  ): void {
    const span = Math.max(28, Math.min(64, width * 0.45));
    ctx.strokeStyle = foamOnly ? MINT : COBALT;
    ctx.lineWidth = 2.4;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      for (let index = 0; index <= 14; index++) {
        const t = index / 14;
        const x = -span / 2 + span * t;
        const y = row * 4 - 4 + Math.sin(t * Math.PI * 3 + now / 170 + row) * 2.2;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = PAPER_HI;
    for (let index = 0; index < 3; index++) {
      const x = -span / 2 + ((now / 22 + index * 19) % span);
      ctx.beginPath();
      ctx.arc(x, -6 + index * 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBuoy(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, .35)';
    ctx.beginPath();
    ctx.ellipse(1, 7, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, -14);
    ctx.stroke();

    ctx.fillStyle = TOMATO;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, -10);
    ctx.lineTo(0, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = PAPER_HI;
    ctx.beginPath();
    ctx.arc(0, 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCurbs(
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number; nx: number; ny: number }>,
    trackWidth: number,
  ): void {
    const half = trackWidth / 2 - 7;
    const step = 6;
    for (const side of [-1, 1]) {
      for (let index = 0; index + step < points.length; index += step) {
        const a = points[index];
        const b = points[index + step];
        const x = (a.x + b.x) / 2 + a.nx * half * side;
        const y = (a.y + b.y) / 2 + a.ny * half * side;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = (index / step) % 2 === 0 ? TOMATO : PAPER_HI;
        ctx.fillRect(-7, -4.5, 14, 9);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-7, -4.5, 14, 9);
        ctx.restore();
      }
    }
  }

  private drawSnowbanks(
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number; nx: number; ny: number }>,
    trackWidth: number,
  ): void {
    const half = trackWidth / 2 + 8;
    for (let index = 8; index < points.length; index += 20) {
      for (const side of [-1, 1]) {
        const point = points[index];
        const x = point.x + point.nx * half * side;
        const y = point.y + point.ny * half * side;
        ctx.fillStyle = 'rgba(241, 228, 201, .85)';
        ctx.strokeStyle = 'rgba(21, 21, 15, .45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 15, 6, Math.atan2(point.ny, point.nx), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private trackPath(
    points: Array<{ x: number; y: number; nx: number; ny: number }>,
    offset: number,
  ): Path2D {
    const path = new Path2D();
    points.forEach((point, index) => {
      const x = point.x + point.nx * offset;
      const y = point.y + point.ny * offset;
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    return path;
  }

  private drawGate(
    ctx: CanvasRenderingContext2D,
    progress: number,
    label: string,
    w: number,
    h: number,
    trackWidth: number,
  ): void {
    const point = this.trackPoint(progress);
    const x = point.x - this.cameraX;
    if (x < -180 || x > w + 180) return;

    const y = h * TRACK_VIEW_CENTER + point.y;
    const half = trackWidth / 2 + 18;
    const blocks = 14;
    const block = (half * 2) / blocks;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(point.angle);
    for (let row = 0; row < 2; row++) {
      for (let index = 0; index < blocks; index++) {
        ctx.fillStyle = (index + row) % 2 === 0 ? '#f8fafc' : '#111827';
        ctx.fillRect(-8 + row * 8, -half + index * block, 8, block);
      }
    }
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, y - half - 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  private drawRacer(
    ctx: CanvasRenderingContext2D,
    marble: RaceMarble,
    index: number,
    count: number,
    trackWidth: number,
    h: number,
    now: number,
    leader: boolean,
  ): void {
    const body = marble.body;
    const data = this.marbleById(marble.marbleId);
    if (!body || !data) return;

    const color = data.color;
    const radius = this.marbleRadius(count, trackWidth);
    const progress = Math.max(
      0,
      Math.min(1, (body.position.x - TRACK_START_X) / TRACK_WORLD_LENGTH),
    );
    const point = this.trackPoint(progress);
    const nx = -Math.sin(point.angle);
    const ny = Math.cos(point.angle);
    const lateral = body.position.y;
    const x = point.x - this.cameraX + nx * lateral;
    const bob = marble.finished ? Math.sin(now / 180 + index) * 0.8 : 0;
    const y = h * TRACK_VIEW_CENTER + point.y + ny * lateral + bob;
    const floorY = y + radius * 0.82;

    const trail = this.trailStyle(this.currentTrack()?.id ?? 'rally');
    marble.trail.forEach((trailPoint, trailIndex) => {
      const t = trailIndex / Math.max(1, marble.trail.length);
      const tp = this.trackPoint(
        Math.max(0, Math.min(1, (trailPoint.x - TRACK_START_X) / TRACK_WORLD_LENGTH)),
      );
      const tnx = -Math.sin(tp.angle);
      const tny = Math.cos(tp.angle);
      const tx = tp.x - this.cameraX + tnx * trailPoint.y;
      const ty = h * TRACK_VIEW_CENTER + tp.y + tny * trailPoint.y;
      ctx.globalAlpha = t * 0.34;
      ctx.fillStyle = trail.color;
      ctx.beginPath();
      ctx.arc(tx, ty + radius * 0.25, radius * (0.16 + t * trail.scale), 0, Math.PI * 2);
      ctx.fill();
      if (trailIndex % 3 === 0) {
        ctx.globalAlpha = t * 0.22;
        ctx.beginPath();
        ctx.arc(
          tx + Math.sin(trailIndex * 2.1 + index) * 5,
          ty + radius * 0.4,
          radius * 0.12,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0, 0, 0, .34)';
    ctx.beginPath();
    ctx.ellipse(x, floorY + 2, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    const shine = ctx.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.4,
      radius * 0.15,
      x,
      y,
      radius,
    );
    shine.addColorStop(0, '#ffffff');
    shine.addColorStop(0.3, color);
    shine.addColorStop(1, this.shade(color, 0.55));
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, .5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `${Math.round(radius * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.emoji, x, y + 1);

    if (leader && !marble.finished) {
      ctx.font = `${Math.round(radius * 1.1)}px system-ui, sans-serif`;
      ctx.fillText('👑', x, y - radius - 9);
    }

    if (count <= 6) {
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillStyle = '#e7e5e4';
      const name =
        marble.playerName.length > 14 ? `${marble.playerName.slice(0, 13)}…` : marble.playerName;
      ctx.fillText(name, x, y - radius - (leader && !marble.finished ? 25 : 12));
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  private drawRaceHud(ctx: CanvasRenderingContext2D, w: number): void {
    const ranked = [...this.raceMarbles].sort((a, b) => {
      const positionA = a.position ?? 999;
      const positionB = b.position ?? 999;
      if (positionA !== positionB) return positionA - positionB;
      return b.x - a.x;
    });
    const rowHeight = 17;
    const boxWidth = Math.min(232, Math.max(176, w * 0.24));
    const boxHeight = 40 + ranked.length * rowHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(241, 228, 201, .96)';
    ctx.strokeStyle = '#15150f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(12, 12, boxWidth, boxHeight);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff4d2e';
    ctx.fillRect(12, 12, boxWidth, 26);

    ctx.fillStyle = '#fff8e8';
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ORDINE DI CORSA', 24, 26);

    ranked.forEach((marble, index) => {
      const body = this.marbleById(marble.marbleId);
      const y = 50 + index * rowHeight;
      ctx.fillStyle = body?.color ?? '#94a3b8';
      ctx.beginPath();
      ctx.arc(27, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15150f';
      ctx.font = '700 11px ui-monospace, monospace';
      const name =
        marble.playerName.length > 15 ? `${marble.playerName.slice(0, 14)}…` : marble.playerName;
      ctx.fillText(name, 37, y);
      ctx.fillStyle = 'rgba(21, 21, 15, .56)';
      ctx.textAlign = 'right';
      ctx.fillText(
        marble.finished ? `P${marble.position}` : `${Math.round(Math.min(100, marble.x))}%`,
        boxWidth,
        y,
      );
      ctx.textAlign = 'left';
    });
    ctx.restore();
  }

  private trailStyle(id: string): { color: string; scale: number } {
    switch (id) {
      case 'rally':
        return { color: 'rgba(180, 120, 60, .65)', scale: 0.38 };
      case 'f1':
        return { color: 'rgba(203, 213, 225, .65)', scale: 0.3 };
      case 'neve':
        return { color: 'rgba(248, 250, 252, .85)', scale: 0.34 };
      default:
        return { color: 'rgba(125, 211, 252, .7)', scale: 0.28 };
    }
  }

  private surfacePalette(id: string): { top: string; bottom: string; speck: string } {
    switch (id) {
      case 'rally':
        return { top: '#7c4a21', bottom: '#4b2a11', speck: 'rgba(30, 16, 6, .35)' };
      case 'f1':
        return { top: '#3b424d', bottom: '#232830', speck: 'rgba(255, 255, 255, .08)' };
      case 'neve':
        return { top: '#e2e8f0', bottom: '#b8c6d9', speck: 'rgba(255, 255, 255, .8)' };
      default:
        return { top: '#0b4a6f', bottom: '#06283d', speck: 'rgba(125, 211, 252, .22)' };
    }
  }

  private shade(hex: string, factor: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const num = parseInt(full, 16);
    const r = Math.round(((num >> 16) & 255) * factor);
    const g = Math.round(((num >> 8) & 255) * factor);
    const b = Math.round((num & 255) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private finale(): void {
    this.clearClock();
    this.phase.set(Phase.FINALE);
    this.secondsLeft.set(FINALE_SECONDS);
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finished.emit());
  }

  private onStatus(status: any): void {
    if (status?.action !== 'BIGLIE_ACTION') return;
    if (this.phase() !== Phase.PICK) return;

    const playerName = String(status.playerName ?? '').trim();
    const current = this.currentPlayer();
    if (!playerName || !current || playerName !== current) return;
    if (this.assignments.has(playerName)) return;

    const marbleId = String(status.value ?? '');
    if (!this.marbleSet.some((marble) => marble.id === marbleId)) return;
    if (new Set(this.assignments.values()).has(marbleId)) return;

    this.assignMarble(playerName, marbleId);
  }

  private syncMarbles(): void {
    const owners = new Map<string, string>();
    this.assignments.forEach((marbleId, playerName) => owners.set(marbleId, playerName));

    this.marbles.set(this.marbleSet.map((marble) => ({
      ...marble,
      owner: owners.get(marble.id) ?? null,
    })));
  }

  private buildMarbleSet(count: number): Marble[] {
    if (count <= 0) return [];

    const pool = this.shuffle([...MARBLES]);
    const set: Marble[] = [];

    for (let index = 0; index < count; index++) {
      const source = pool[index % pool.length];
      set.push(count <= pool.length
        ? source
        : { ...source, id: `${source.id}-${index}`, name: `${source.name} ${index + 1}` });
    }

    return set;
  }

  private marbleById(id: string): Marble | undefined {
    return this.marbleSet.find((marble) => marble.id === id)
      ?? MARBLES.find((marble) => marble.id === id);
  }

  private shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [values[index], values[swap]] = [values[swap], values[index]];
    }
    return values;
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

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private later(ms: number, action: () => void): void {
    this.timers.push(setTimeout(action, ms));
  }

  private publish(): void {
    this.ws.broadcastStatus(this.gameId, {
      action: 'BIGLIE_STATE',
      state: {
        phase: this.phase(),
        secondsLeft: this.secondsLeft(),
        raceIndex: this.raceIndex(),
        races: TRACKS.length,
        track: this.currentTrack(),
        currentPlayer: this.currentPlayer(),
        order: this.pickOrder,
        marbles: this.marbles(),
        lanes: this.lanes(),
        standings: this.standings(),
        raceResult: this.raceResult(),
      },
    });
  }
}
