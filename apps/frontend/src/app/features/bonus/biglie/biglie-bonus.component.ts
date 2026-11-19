import { GamePhase } from '../../../shared/enums/game-phase';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
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
import { AudioService } from '../../../core/services/audio.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import {
  BIGLIE_RACES,
  biglieRaceNumber,
  biglieRoundSlot,
  planRoundTracks,
  type BiglieTrack,
  type TrackId,
  TRACKS_PER_ROUND,
  TRACK_CATALOG,
  trackById,
} from './track-plan';
import {
  buildTrack,
  edgePoints,
  frameAtProgress,
  pointAtS,
  projectOnTrack,
  wallSegments,
  type TrackGeometry,
} from './track-geometry';
import { drawCountdown } from './race-overlay';
import { ACID, COBALT, INK, MINT, MUSTARD, PAPER, PAPER_HI, TOMATO } from './race-theme';
import {
  createDrama,
  createLineCharacter,
  dramaFactor,
  fieldProfile,
  CLOSING_BOOST,
  CLOSING_FROM,
  HEAD_WIND,
  hazardPenalty,
  marbleRadiusFor,
  paceFor,
  lineOffset,
  resumeAccel,
  rubberBand,
  stepSpeed,
  trackWidthFor,
  wallPenalty,
  type DramaProfile,
  type LineCharacter,
} from './race-dynamics';
import { buildHazards, type Hazard, type HazardKind } from './hazard-plan';
import { MARBLES, type Marble } from './marbles';

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

interface MarbleView extends Marble {
  owner: string | null;
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
  /** Ultimo campione della linea centrale: accorcia la proiezione. */
  spine: number;
  bumped: Set<string>;
  /** Effetti di pista attivi, misurati in secondi di gara. */
  slowUntil: number;
  boostUntil: number;
  /** Velocità propria in px per passo: a regime è quella di sempre, dopo un
   * colpo è più bassa e ci vuole secondi a risalire. */
  speed: number;
  /** Secondi di gara in cui la biglia striscia senza ripartire. */
  stunUntil: number;
  /** Secondi di gara in cui la ripresa è a metà gas. */
  recoverUntil: number;
  /** Corsia personale: la biglia non segue la linea comune. */
  line: LineCharacter;
  /** Spinte e crisi della sua gara: è qui che nasce il sorpasso. */
  drama: DramaProfile;
  /** Watchdog: secondi senza avanzare e progresso migliore già raggiunto. */
  stuckFor: number;
  bestProgress: number;
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

/**
 * Punti per gara, nell'ordine d'arrivo: i primi quattro guadagnano, gli ultimi
 * quattro pagano il piazzamento. Le Biglie sono un round, quindi anche la coda
 * della classifica pesa.
 */
const RACE_POINTS = [150, 100, 60, 30, -30, -60, -100, -150];
const INTRO_SECONDS = 4;
const PICK_SECONDS = 10;
/**
 * Tempo di gara sul cartello: settanta secondi. Non è il traguardo — la gara
 * chiude quando l'ultima biglia arriva — è il conto alla rovescia che tiene
 * su la sala. La simulazione headless tiene le otto piste fra i 47 e i 66
 * secondi con l'ultima biglia, quindi la volata ci sta dentro.
 */
const RACE_SECONDS = 70;
/**
 * Rete di sicurezza vera, non un taglio: se per un bug una biglia restasse
 * ferma, dopo due minuti la gara si chiude lo stesso in classifica. Nessuna
 * gara misurata si avvicina a questo tempo.
 */
const RACE_HARD_STOP = 120;
const TRACK_START_X = 140;
/** Pista lunga: una gara dura fra i 60 e i 70 secondi anche senza ostacoli. */
const TRACK_WORLD_LENGTH = 12000;
/** 3 · 2 · 1 come al via di un kart: la corsa parte solo dopo. */
const COUNTDOWN_SECONDS = 3;
/**
 * Ostacoli per fondo: tanti e piccoli, così la corsa ha interruzioni continue
 * (fango, ghiaccio, strettoie) invece di due isole grandi come i vecchi bivi.
 */

const PHYSICS_STEP = 1000 / 60;
const TRACK_END_PADDING = 80;
/** Il centro della pista (y = 0) cade a metà dello schermo: il nastro occupa tutto. */
const TRACK_VIEW_CENTER = 0.5;
const BETWEEN_SECONDS = 4;
const FINALE_SECONDS = 7;

/**
 * BIGLIE — round di serata (e banco di prova).
 *
 * Una biglia per tavolo, tutte diverse e mai condivise. La scelta si fa una
 * volta sola, in ordine sorteggiato: chi è ultimo prende quella che resta.
 * Poi due gare del round, su due delle otto piste scelte dal seme, con punti
 * cumulativi: il profilo che vince una gara affonda nella successiva. I punti
 * seguono l'ordine d'arrivo in entrambe le direzioni: +150/+100/+60/+30 ai
 * primi quattro, −30/−60/−100/−150 agli ultimi quattro.
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
            <div class="bg-kicker">{{ roundMode ? '🎱 BIGLIE · ROUND' : '🎱 BIGLIE · BONUS DELL\'ATTO' }}</div>
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
                @for (t of roundTracks(); track t.id) {
                  <span class="bg-track-chip" [style.border-color]="t.tint">
                    <b>{{ t.emoji }} {{ t.name }}</b>
                    <span>{{ t.surface }}</span>
                  </span>
                }
              </div>
              <p class="bg-hint">
                Una biglia a testa, scelta una volta sola in ordine sorteggiato.
                Due gare, punti cumulativi: 150 / 100 / 60 / 30 ai primi,
                −30 / −60 / −100 / −150 agli ultimi.
                {{ roundMode ? 'I punti delle gare entrano nella classifica della serata.' : '' }}
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
              <span class="bg-hint">Punti gara: 150 · 100 · 60 · 30 · −30 · −60 · −100 · −150 · due gare per round</span>
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
                <span class="bg-result-track">{{ currentTrack()?.emoji }} GARA {{ raceNumber() }} / {{ totalRaces }} · {{ currentTrack()?.name }}</span>
              </div>
              <div class="bg-result-columns">
                <span>POS</span><span>TAVOLO</span><span>BIGLIA</span><span>PUNTI</span><span>TOTALE</span>
              </div>
              @for (row of raceResult() ?? []; track row.playerName; let i = $index) {
                <div class="bg-row" [class.paid]="row.points > 0">
                  <span class="bg-row-pos">{{ i + 1 }}</span>
                  <span class="bg-row-name">{{ row.playerName }}</span>
                  <span class="bg-row-marble">{{ marbleEmoji(row.marbleId) }} {{ marbleName(row.marbleId) }}</span>
                  <b class="bg-row-points">{{ signedPoints(row.points) }}</b>
                  <span class="bg-row-total">{{ row.total }}</span>
                </div>
              }
            </div>
          }

          @case (Phase.FINALE) {
            <div class="bg-finale">
              <div class="bg-finale-head">
                <span class="bg-finale-kicker">CLASSIFICA FINALE</span>
                <span class="bg-finale-note">2 GARE · PUNTI CUMULATIVI</span>
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
    .bg-sub { margin: 4px 0 0; font-family: var(--font-mono); font-size: clamp(.62rem, .95vw, .82rem); letter-spacing: .12em; color: color-mix(in srgb, var(--coal) 62%, transparent); text-transform: uppercase; }
    .bg-timer { font-family: var(--font-mono); font-size: clamp(1.2rem, 2vw, 1.9rem); font-weight: 800; }
    .bg-timer.hot { color: var(--tomato); animation: bg-pulse .8s infinite; }
    .bg-hint { margin: 0; font-family: var(--font-mono); font-size: clamp(.62rem, .92vw, .8rem); color: color-mix(in srgb, var(--coal) 62%, transparent); }
    .bg-intro { display: flex; flex-direction: column; gap: 14px; }
    .bg-track-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
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
    .bg-prof { font-size: clamp(.55rem, .78vw, .68rem); letter-spacing: .08em; color: color-mix(in srgb, var(--coal) 60%, transparent); }
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
    .bg-result-track { color: color-mix(in srgb, var(--coal) 66%, transparent); font-family: var(--font-mono); font-size: clamp(.55rem, .82vw, .7rem); font-weight: 800; letter-spacing: .08em; text-align: right; }
    .bg-result-columns { display: grid; grid-template-columns: 30px 1fr auto auto auto; gap: 12px; padding: 0 12px; color: color-mix(in srgb, var(--coal) 55%, transparent); font-family: var(--font-mono); font-size: clamp(.46rem, .7vw, .58rem); font-weight: 800; letter-spacing: .12em; }
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
    .bg-finale-note { color: color-mix(in srgb, var(--coal) 62%, transparent); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); letter-spacing: .12em; text-align: right; }
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
  private audio = inject(AudioService);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  /** Banco di prova: intro breve, scelta automatica e gare senza attese. */
  @Input() preview = false;
  /** Banco di prova: forza una pista per rivederla (ignorato in partita). */
  @Input() trackOverride: TrackId | null = null;
  /** Round della scaletta: i punti entrano in classifica, non in un bonus. */
  @Input() roundMode = false;
  /** Round di serata (0-based): decide le due piste e il numero delle gare. */
  @Input() roundIndex = 0;
  /** Round interrotto da un refresh: si riparte dallo stato salvato. */
  @Input() resume: any | null = null;
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();
  /** Stato del round (biglie assegnate, gare chiuse, classifica) per il server. */
  @Output() checkpoint = new EventEmitter<any>();

  @ViewChild('raceCanvas') private raceCanvas?: ElementRef<HTMLCanvasElement>;

  /** Le due piste del round, decise dal seme e salvate nel checkpoint. */
  readonly roundTracks = signal<BiglieTrack[]>([]);
  readonly totalRaces = BIGLIE_RACES;

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
  /** Secondi che mancano al via (3 · 2 · 1) e coda del cartello VIA!. */
  private countdownLeft = 0;
  private countdownFlash = 0;
  private publishAcc = 0;
  private raceEnding = false;
  private frame = 0;
  private lastFrame = 0;
  /** TV in secondo piano: la corsa è ferma, non solo invisibile. */
  private suspended = false;
  private raceCtx: CanvasRenderingContext2D | null = null;
  private raceW = 0;
  private raceH = 0;
  private raceDpr = 1;
  private raceResize?: ResizeObserver;
  private cameraX = 0;
  private cameraY = 0;
  private cameraReady = false;
  /** Linea centrale della gara: uguale per disegno, muri e proiezione. */
  private geometry: TrackGeometry | null = null;
  /** Scala uniforme mondo→schermo (la pista resta quella della fisica). */
  private drawScale = 1;
  private trackSeed = 0;
  /** Seme del round: decide le due piste e resta nel checkpoint. */
  private planSeed = 0;
  /** Spinte e rimbalzi della gara: stesso seme, stessa corsa. */
  private raceRng: () => number = Math.random;
  private hazards: Hazard[] = [];

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    if (this.resume) {
      this.applyResume(this.resume);
      return;
    }
    this.later(this.preview ? 200 : 700, () => this.startIntro());
  }

  /**
   * Riprende il round senza rigiocare i punti: biglie assegnate, gare chiuse e
   * classifica tornano dal checkpoint. La fisica invece non si può riprendere,
   * quindi se la TV è caduta durante una gara quella gara si rigioca: i punti
   * delle gare già chiuse non vengono rimandati, perché sono già in classifica.
   */
  private applyResume(state: any): void {
    const savedMarbles = Array.isArray(state?.marbles)
      ? state.marbles
        .filter((marble: any) => marble && typeof marble.id === 'string' && typeof marble.name === 'string')
        .map((marble: any) => ({
          id: String(marble.id),
          name: String(marble.name),
          color: String(marble.color ?? '#94a3b8'),
          emoji: String(marble.emoji ?? '⚪'),
          speed: Number(marble.speed) || 0,
          accel: Number(marble.accel) || 0,
          grip: Number(marble.grip) || 0,
        }))
      : [];
    this.marbleSet = savedMarbles.length
      ? savedMarbles
      : this.buildMarbleSet(this.players.length);

    this.pickOrder = Array.isArray(state?.pickOrder)
      ? state.pickOrder.map((name: any) => String(name)).filter((name: string) => this.players.includes(name))
      : [...this.players];
    if (!this.pickOrder.length) this.pickOrder = [...this.players];

    const cursor = Number(state?.pickCursor);
    this.pickCursor = Number.isFinite(cursor)
      ? Math.min(Math.max(0, Math.floor(cursor)), this.pickOrder.length)
      : 0;

    this.assignments.clear();
    if (Array.isArray(state?.assignments)) {
      for (const row of state.assignments) {
        if (!Array.isArray(row)) continue;
        const playerName = String(row[0]).trim();
        const marbleId = String(row[1]).trim();
        if (!this.players.includes(playerName)) continue;
        if (!this.marbleSet.some((marble) => marble.id === marbleId)) continue;
        this.assignments.set(playerName, marbleId);
      }
    }
    this.syncMarbles();

    this.totals.clear();
    this.players.forEach((playerName) => this.totals.set(playerName, 0));
    if (Array.isArray(state?.totals)) {
      for (const row of state.totals) {
        if (!Array.isArray(row)) continue;
        this.totals.set(String(row[0]).trim(), Number(row[1]) || 0);
      }
    }

    const rows = (value: any): RaceRow[] => Array.isArray(value)
      ? value
        .filter((row: any) => row && typeof row.playerName === 'string')
        .map((row: any) => ({
          playerName: String(row.playerName),
          marbleId: String(row.marbleId ?? ''),
          position: Number(row.position) || 0,
          points: Number(row.points) || 0,
          total: Number(row.total) || 0,
        }))
      : [];
    this.standings.set(rows(state?.standings));
    this.raceResult.set(Array.isArray(state?.raceResult) ? rows(state.raceResult) : null);

    // Piano delle piste: quello salvato vince, altrimenti si ricostruisce
    // dallo stesso seme del round. Un refresh non cambia le due piste.
    const savedPlanned = Array.isArray(state?.trackPlan)
      ? state.trackPlan
        .map((id: any) => String(id))
        .filter((id: string): id is TrackId => TRACK_CATALOG.some((track) => track.id === id))
      : [];
    const savedSeed = Number(state?.trackSeed);
    this.planSeed = Number.isFinite(savedSeed) && savedSeed > 0
      ? Math.floor(savedSeed) >>> 0
      : Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.applyPlan(
      savedPlanned.length === TRACKS_PER_ROUND
        ? savedPlanned
        : planRoundTracks(this.planSeed, this.roundSlot()),
    );

    const savedIndex = Number(state?.raceIndex);
    this.raceIndex.set(Number.isFinite(savedIndex)
      ? Math.min(Math.max(0, Math.floor(savedIndex)), TRACKS_PER_ROUND)
      : 0);

    const savedSeconds = Number(state?.secondsLeft);
    const savedAt = Number(state?.savedAt);
    const elapsed = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      : 0;
    const seconds = Number.isFinite(savedSeconds) ? Math.max(0, Math.round(savedSeconds) - elapsed) : 0;

    const phase = String(state?.phase ?? '');

    if (phase === Phase.FINALE) {
      this.phase.set(Phase.FINALE);
      this.secondsLeft.set(0);
      this.publish();
      this.later((seconds > 0 ? seconds : FINALE_SECONDS) * 1000, () => this.finished.emit());
      return;
    }

    if (phase === Phase.PICK) {
      this.phase.set(Phase.PICK);
      const player = this.pickOrder[this.pickCursor] ?? null;
      this.currentPlayer.set(player);
      if (!player) {
        void this.startRace(this.raceIndex());
        return;
      }
      this.startClock(seconds > 0 ? seconds : PICK_SECONDS, () => this.autoPick());
      return;
    }

    if (phase === Phase.RACE_END) {
      // Gara già pagata: si rivede l'ordine d'arrivo e si passa alla prossima.
      this.phase.set(Phase.RACE_END);
      this.publish();
      this.startClock(
        seconds > 0 ? seconds : BETWEEN_SECONDS,
        () => void this.startRace(this.raceIndex() + 1),
      );
      return;
    }

    if (phase === Phase.RACE) {
      // La gara interrotta si rigioca: i punti si pagano solo alla sua fine.
      void this.startRace(this.raceIndex());
      return;
    }

    this.startIntro();
  }

  /** Biglie, gare chiuse e classifica: tutto ciò che una gara non ricalcola. */
  private saveCheckpoint(): void {
    this.checkpoint.emit({
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      savedAt: Date.now(),
      raceIndex: this.raceIndex(),
      roundIndex: this.roundIndex,
      trackSeed: this.planSeed,
      trackPlan: this.roundTracks().map((track) => track.id),
      pickOrder: [...this.pickOrder],
      pickCursor: this.pickCursor,
      marbles: this.marbleSet.map((marble) => ({ ...marble })),
      assignments: [...this.assignments],
      totals: [...this.totals],
      standings: this.standings(),
      raceResult: this.raceResult(),
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.audio.stopMarbleBed();
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
        return 'DUE GARE, UNA BIGLIA';
      case Phase.PICK:
        return 'SCELTA DELLA BIGLIA';
      case Phase.RACE:
        return `GARA ${this.raceNumber()} / ${BIGLIE_RACES}`;
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
      return `${track.emoji} ${track.name} · FONDO ${track.surface} · GARA ${this.raceNumber()}`;
    }
    return 'UNA BIGLIA PER TAVOLO, MAI CONDIVISA';
  }

  pickProgress(): string {
    if (!this.pickOrder.length) return '';
    return `${Math.min(this.pickCursor + 1, this.pickOrder.length)} / ${this.pickOrder.length}`;
  }

  currentTrack(): BiglieTrack | null {
    return this.roundTracks()[this.raceIndex()] ?? null;
  }

  /** Numero della gara nella serata: 1–8, due per round. */
  raceNumber(): number {
    return biglieRaceNumber(this.roundIndex, this.raceIndex());
  }

  private roundSlot(): number {
    return biglieRoundSlot(this.roundIndex);
  }

  pct(value: number): number {
    return Math.round(Number(value) || 0);
  }

  /** Punti con il segno: le Biglie pagano e tolgono. */
  signedPoints(value: number): string {
    const points = Number(value) || 0;
    if (points === 0) return '0';
    return points > 0 ? `+${points}` : `−${Math.abs(points)}`;
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

  /** Le due piste del round: seme della serata, una sola volta per round. */
  private ensurePlan(): void {
    if (this.roundTracks().length) return;
    if (
      this.preview
      && this.trackOverride
      && TRACK_CATALOG.some((track) => track.id === this.trackOverride)
    ) {
      this.applyPlan([this.trackOverride, this.trackOverride]);
      return;
    }
    if (!this.planSeed) this.planSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.applyPlan(planRoundTracks(this.planSeed, this.roundSlot()));
  }

  private applyPlan(ids: readonly TrackId[]): void {
    this.roundTracks.set(ids.slice(0, TRACKS_PER_ROUND).map((id) => trackById(id)));
  }

  private startIntro(): void {
    this.ensurePlan();
    const seconds = this.preview ? 1 : INTRO_SECONDS;
    this.phase.set(Phase.INTRO);
    this.secondsLeft.set(seconds);
    this.publish();
    this.saveCheckpoint();
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
      this.saveCheckpoint();
      this.later(220, () => this.previewPick());
      return;
    }

    this.secondsLeft.set(PICK_SECONDS);
    this.publish();
    this.saveCheckpoint();
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
    // Fra una gara e l'altra il rotolamento tace: riparte col via della nuova.
    this.audio.stopMarbleBed();

    if (index >= TRACKS_PER_ROUND) {
      this.finale();
      return;
    }

    this.ensurePlan();
    this.raceIndex.set(index);
    // Disegno della pista: seme del round più la gara. Le due gare hanno curve
    // diverse, ma la stessa gara resta identica dopo un refresh.
    this.trackSeed = (this.planSeed + index * 0x9e3779b9) >>> 0;
    this.raceRng = this.seededRandom(this.trackSeed ^ 0x9e3779b9);
    this.geometry = this.buildGeometry();
    const track = this.currentTrack();
    if (track) this.generateHazards(track);
    this.finishCount = 0;
    this.raceResult.set(null);
    this.currentPlayer.set(null);
    this.raceMarbles = this.players.map((playerName, slot) => ({
      playerName,
      marbleId: this.assignments.get(playerName) ?? '',
      x: 0,
      v: 0,
      body: null,
      finished: false,
      position: null,
      trail: [],
      spine: 0,
      bumped: new Set<string>(),
      slowUntil: 0,
      boostUntil: 0,
      speed: 0,
      line: createLineCharacter(this.raceRng, slot, this.players.length),
      drama: createDrama(this.raceRng),
      stunUntil: 0,
      recoverUntil: 0,
      stuckFor: 0,
      bestProgress: 0,
    }));
    this.raceElapsed = 0;
    this.countdownLeft = COUNTDOWN_SECONDS;
    this.countdownFlash = 0;
    this.publishAcc = 0;
    this.raceEnding = false;
    this.cameraX = 0;
    this.cameraY = 0;
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
    this.saveCheckpoint();

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
   * Mondo fisico nella stessa geometria del disegno: i muri sono i segmenti
   * del bordo (`wallSegments`), le isole dei bivi la stessa striscia del
   * renderer (`islandSegments`), gli ostacoli stanno dove sono dipinti.
   */
  private createPhysics(Matter: any): void {
    this.destroyPhysics();

    const geometry = this.geometry;
    if (!geometry) return;

    const { Engine, Bodies, Body, Composite, Events } = Matter;
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;
    const world = engine.world;
    const count = Math.max(1, this.raceMarbles.length);
    const trackWidth = geometry.width;
    const radius = this.marbleRadius(count, trackWidth);
    // Il fondo decide quanto rimbalza il muro: il vetro restituisce energia,
    // la sabbia la mangia. Prima era 0,42 per tutte le piste.
    const physics = this.currentTrack()?.physics;
    const wallBounce = Math.max(0.08, Math.min(0.92, physics?.bounce ?? 0.42));
    const wallFriction = 0.02 + (physics?.friction ?? 1) * 0.03;
    // Muri sottili: nei tornanti stretti lasciano passare la biglia larga.
    const wallThickness = 16;

    // Muri: gli stessi segmenti che il renderer tratteggia sul bordo.
    for (const side of [-1, 1] as const) {
      for (const segment of wallSegments(geometry, side, -6, 3)) {
        Composite.add(
          world,
          Bodies.rectangle(segment.x, segment.y, segment.length, wallThickness, {
            isStatic: true,
            angle: segment.angle,
            restitution: wallBounce,
            friction: wallFriction,
            label: side < 0 ? 'wall-left' : 'wall-right',
          }),
        );
      }
    }

    const start = pointAtS(geometry, 0);
    Composite.add(
      world,
      Bodies.rectangle(start.x - start.tx * 46, start.y - start.ty * 46, 44, trackWidth + 90, {
        isStatic: true,
        angle: start.angle,
        restitution: wallBounce * 0.7,
        label: 'wall-back',
      }),
    );

    for (const hazard of this.hazards) {
      const frame = frameAtProgress(geometry, hazard.progress);
      const lateral = hazard.offset * trackWidth * 0.3;
      const x = frame.x + frame.nx * lateral;
      const y = frame.y + frame.ny * lateral;
      Composite.add(
        world,
        Bodies.circle(x, y, hazard.radius + 1, {
          isStatic: true,
          isSensor: true,
          label: hazard.id,
        }),
      );

      // Sassi, scogli, meteoriti e paracarri sono solidi: deviano davvero.
      if (
        hazard.kind === 'sasso'
        || hazard.kind === 'scoglio'
        || hazard.kind === 'meteorite'
        || hazard.kind === 'paracarro'
      ) {
        Composite.add(
          world,
          Bodies.circle(x, y, hazard.radius * 0.82, {
            isStatic: true,
            restitution: Math.min(0.9, wallBounce * 1.1),
            friction: 0.08 + (physics?.friction ?? 1) * 0.02,
            label: `rock-${hazard.id}`,
          }),
        );
      }
    }

    // Griglia di partenza: colonne sulla larghezza, file dietro la linea,
    // posate sulla linea centrale con la sua tangente.
    const cols = Math.min(4, count);
    const laneStep = cols <= 1 ? 0 : (trackWidth - radius * 2 - 14) / (cols - 1);
    this.raceMarbles.forEach((marble, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      // Ogni biglia parte con uno scarto diverso: niente binari identici.
      const jitter = (this.raceRng() - 0.5) * radius * 0.5;
      const lateral = -trackWidth / 2 + radius + 8 + col * laneStep + jitter;
      const along = 30 + row * (radius * 2 + 14) + (this.raceRng() - 0.5) * 12;
      const frame = pointAtS(geometry, along);
      const x = frame.x + frame.nx * lateral;
      const y = frame.y + frame.ny * lateral;
      const body = Bodies.circle(x, y, radius, {
        label: `marble-${index}`,
        friction: 0.02 + (physics?.friction ?? 1) * 0.02,
        frictionAir: (physics?.friction ?? 1) * 0.0016,
        restitution: 0.52,
        density: 0.002,
      });
      marble.body = body;
      marble.x = 0;
      marble.spine = Math.round(along / 6);
      Composite.add(world, body);
    });

    Events.on(engine, 'collisionStart', (event: any) => {
      for (const pair of event.pairs) {
        const first = this.marbleForBody(pair.bodyA);
        const second = this.marbleForBody(pair.bodyB);

        // Biglia contro biglia: scintille e scatto secco nel punto di contatto.
        if (first && second) {
          if (!first.finished && !second.finished) {
            const support = pair.collision?.supports?.[0];
            this.spawnClash(
              support?.x ?? (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
              support?.y ?? (pair.bodyA.position.y + pair.bodyB.position.y) / 2,
            );
            if (this.impactSpeed(pair) > 0.55) this.audio.playMarbleHit();
          }
          continue;
        }

        const marble = first ?? second;
        if (!marble || marble.finished) continue;

        // Muro vero: bordo della pista o isola di un bivio. Sfiorarlo non suona.
        if (this.labelledBody(pair, 'wall-')) {
          // Il muro costa come un ostacolo: la biglia perde velocità, resta
          // appoggiata un attimo e riparte a metà gas. L'urto secco pesa il
          // doppio della strisciata.
          const hit = this.impactSpeed(pair);
          const wall = wallPenalty(hit > 1.6);
          marble.speed *= wall.factor;
          marble.stunUntil = Math.max(marble.stunUntil, this.raceElapsed + wall.stun);
          marble.recoverUntil = Math.max(marble.recoverUntil, this.raceElapsed + wall.recover);
          if (hit > 0.9) this.audio.playMarbleWall();
          continue;
        }

        // Sassi, scogli e meteoriti: la biglia sbatte su una superficie solida.
        if (this.labelledBody(pair, 'rock-')) {
          if (this.impactSpeed(pair) > 0.9) {
            this.audio.playMarbleSurface(this.surfaceIsSoft());
          }
          continue;
        }

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

        // L'ostacolo mangia velocità, blocca la biglia un istante e le impone
        // una ripartenza a metà gas: le penalità stanno in `race-dynamics`.
        const penalty = hazardPenalty(hazard.kind);
        marble.speed *= penalty.factor;
        marble.stunUntil = Math.max(marble.stunUntil, this.raceElapsed + penalty.stun);
        marble.recoverUntil = Math.max(marble.recoverUntil, this.raceElapsed + penalty.recover);
        // Fango e sabbia restano lenti anche dopo: la biglia ci sguazza.
        if (hazard.kind === 'fango' || hazard.kind === 'sabbia' || hazard.kind === 'pozzanghera') {
          marble.slowUntil = this.raceElapsed + (hazard.kind === 'fango' ? 0.9 : 0.6);
        }
        // Il ghiaccio è l'unica superficie che regala: niente penalità, spinta.
        if (hazard.kind === 'ghiaccio') marble.boostUntil = this.raceElapsed + 0.9;

        // Il colpo di lato resta quello del fondo: la sabbia sbanda, il magma
        // spinge in alto, il cordolo rimbalza.
        const sideways = hazard.kind === 'fango'
          ? (this.raceRng() - 0.5) * 1.2
          : hazard.kind === 'sabbia' || hazard.kind === 'pozzanghera'
            ? (this.raceRng() - 0.5) * 1.9
            : hazard.kind === 'magma'
              ? -2.2 - this.raceRng() * 0.6
              : hazard.kind === 'onda'
                ? -3.1 - this.raceRng() * 0.8
                : hazard.kind === 'meteorite' || hazard.kind === 'scoglio'
                  ? -1.4 - this.raceRng() * 0.6
                  : hazard.kind === 'ghiaccio'
                    ? 0
                    : -1.2 - this.raceRng() * 0.8;
        this.kickMarble(marble, 0.55, sideways);

        this.spawnImpact(marble, hazard.kind);
        this.audio.playMarbleSurface(this.surfaceIsSoft());
      }
    });

    this.engine = engine;
  }

  /**
   * Spinta nel sistema della pista: rallenta lungo la tangente e spinge di
   * lato, senza perdere il riferimento alla curva.
   */
  private kickMarble(marble: RaceMarble, alongFactor: number, lateralKick: number): void {
    const body = marble.body;
    const geometry = this.geometry;
    if (!body || !geometry || !this.matter) return;

    const projection = projectOnTrack(geometry, body.position.x, body.position.y, marble.spine);
    marble.spine = projection.index;
    const frame = pointAtS(geometry, projection.s);
    const along = body.velocity.x * frame.tx + body.velocity.y * frame.ty;
    const lateral = body.velocity.x * frame.nx + body.velocity.y * frame.ny;
    const nextAlong = along * alongFactor;
    const nextLateral = lateral * 0.85 + lateralKick;
    this.matter.Body.setVelocity(body, {
      x: frame.tx * nextAlong + frame.nx * nextLateral,
      y: frame.ty * nextAlong + frame.ny * nextLateral,
    });
  }
  private marbleForBody(body: any): RaceMarble | undefined {
    return this.raceMarbles.find((marble) => marble.body === body);
  }

  private labelledBody(pair: any, ...prefixes: string[]): any | null {
    for (const body of [pair.bodyA, pair.bodyB]) {
      const label = typeof body?.label === 'string' ? body.label : '';
      if (prefixes.some((prefix) => label.startsWith(prefix))) return body;
    }
    return null;
  }

  /** Velocità dell'urto: sotto la soglia il contatto non fa rumore. */
  private impactSpeed(pair: any): number {
    const speed = (body: any): number =>
      body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
    return Math.max(speed(pair.bodyA), speed(pair.bodyB));
  }

  /** Fondi morbidi: l'urto su una superficie suona sordo, non secco. */
  private surfaceIsSoft(): boolean {
    const id = this.currentTrack()?.id ?? 'rally';
    return id !== 'f1' && id !== 'vetro';
  }

  private spawnImpact(marble: RaceMarble, hazard?: HazardKind): void {
    const body = marble.body;
    if (!body) return;

    const palette = hazard
      ? this.hazardPalette(hazard)
      : this.surfacePalette(this.currentTrack()?.id ?? 'rally');
    for (let index = 0; index < 9; index++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const speed = 30 + Math.random() * 95;
      this.particles.push({
        x: body.position.x,
        y: body.position.y,
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
  private spawnClash(x: number, y: number): void {
    for (let index = 0; index < 7; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        x,
        y,
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

    // La geometria resta quella della gara: cambia solo la scala di disegno.
    this.cameraReady = false;
  }

  /**
   * TV in secondo piano o scheda nascosta: la fisica si ferma davvero. Senza
   * questo il browser sospende i frame ma il rotolamento continua a suonare, e
   * al ritorno la corsa riparte con un salto di tempo. Al ritorno si riparte
   * dallo stesso istante: `lastFrame` a zero vale un primo frame a dt = 0.
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.suspendRace();
    } else {
      this.resumeRace();
    }
  }

  private suspendRace(): void {
    if (this.suspended) return;
    this.suspended = true;
    if (this.phase() === Phase.RACE) this.audio.stopMarbleBed();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private resumeRace(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.lastFrame = 0;
    this.physicsAccumulator = 0;
    if (this.phase() !== Phase.RACE) return;
    // La gara era già partita: il fondo della pista torna a suonare.
    if (this.countdownLeft <= 0 && !this.raceEnding) {
      this.audio.startMarbleBed(this.currentTrack()?.id);
    }
    // Dopo `suspendRace` il frame è sempre a zero: il loop riparte da qui.
    this.ngZone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(this.loop);
    });
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

    // Via alla kart: prima dei 3 · 2 · 1 nessuna biglia si muove e il clock
    // della gara non parte.
    if (this.countdownLeft > 0) {
      this.countdownLeft = Math.max(0, this.countdownLeft - dt);
      if (this.countdownLeft === 0) {
        this.countdownFlash = 1;
        // Le biglie cominciano a scivolare: il fondo della pista dà il timbro.
        this.audio.startMarbleBed(this.currentTrack()?.id);
      }
      return;
    }
    if (this.countdownFlash > 0) this.countdownFlash = Math.max(0, this.countdownFlash - dt);

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

    // Si chiude quando arrivano tutti: il tempo non taglia mai il traguardo.
    if (this.raceMarbles.every((marble) => marble.finished) || this.raceElapsed >= RACE_HARD_STOP) {
      this.raceEnding = true;
      this.ngZone.run(() => this.endRace());
    }
  }

  private stepPhysics(): void {
    const track = this.currentTrack();
    const geometry = this.geometry;
    if (!track || !geometry || !this.engine || !this.matter) return;

    const { Engine, Body, Composite } = this.matter;
    const count = Math.max(1, this.raceMarbles.length);
    const radius = this.marbleRadius(count, geometry.width);
    const dtSeconds = PHYSICS_STEP / 1000;
    // Media del gruppo: serve alla rimonta, così i primi non scappano via e la
    // volata resta aperta fino al traguardo.
    const running = this.raceMarbles.filter((marble) => !marble.finished);
    const fieldProgress = running.length
      ? running.reduce((sum, marble) => sum + Math.min(1, marble.x / 100), 0) / running.length
      : 0;
    // Chi è davanti adesso: paga il vento in faccia.
    const leadX = running.reduce((lead, marble) => Math.max(lead, marble.x), 0);
    // Media delle schede in gara: sulla pista gli scarti si assottigliano.
    const profileMean = running.length
      ? running.reduce((sum, marble) => {
          const stats = this.marbleById(marble.marbleId);
          return stats
            ? sum
                + (stats.speed * track.weights.speed
                  + stats.accel * track.weights.accel
                  + stats.grip * track.weights.grip) / 10
            : sum;
        }, 0) / running.length
      : 0;

    for (const marble of this.raceMarbles) {
      if (marble.finished || !marble.body) continue;

      const data = this.marbleById(marble.marbleId);
      if (!data) continue;

      const body = marble.body;
      // Progresso e lato vengono dalla linea centrale: la biglia corre dove
      // la pista è disegnata, non in un corridoio a parte.
      const projection = projectOnTrack(geometry, body.position.x, body.position.y, marble.spine);
      marble.spine = projection.index;
      const frame = pointAtS(geometry, projection.s);

      const physics = track.physics;
      const profile = fieldProfile(
        (data.speed * track.weights.speed
          + data.accel * track.weights.accel
          + data.grip * track.weights.grip) / 10,
        profileMean,
      );
      // L'attrito del fondo pesa sulla velocità che la biglia può tenere:
      // il vetro quasi non frena, la sabbia toglie oltre un terzo.
      // Bersaglio di velocità: lo calcola `race-dynamics`, così la simulazione
      // headless misura esattamente la corsa della TV.
      let target = paceFor(profile, physics.friction);
      if (marble.slowUntil > this.raceElapsed) target *= 0.45;
      if (marble.boostUntil > this.raceElapsed) target *= 1.12;
      // Il gruppo si tiene stretto: chi è davanti paga la fuga, chi insegue
      // tiene qualche punto in più. Mai abbastanza per annullare un distacco.
      const progress = Math.min(1, marble.x / 100);
      target *= rubberBand(progress, fieldProgress, progress > CLOSING_FROM ? CLOSING_BOOST : 1);
      // Spinta e crisi: il primo può sfilare, il penultimo può rientrare.
      target *= dramaFactor(marble.drama, this.raceElapsed);
      // Chi è davanti non ha scia: la prima posizione costa sempre qualcosa.
      if (marble.x >= leadX) target *= HEAD_WIND;

      // La velocità non si riscrive più a ogni passo: la biglia ha la sua e ci
      // torna con l'accelerazione del profilo. A regime il valore è esattamente
      // il bersaglio di sempre, quindi la corsa è quella di prima; dopo un
      // fosso, un muro o uno scontro è scesa, e risalire costa secondi.
      const stunned = marble.stunUntil > this.raceElapsed;
      const recovering = marble.recoverUntil > this.raceElapsed;
      const accel = resumeAccel(data.accel, recovering);
      marble.speed = stepSpeed(
        marble.speed,
        stunned ? target * 0.12 : target,
        accel,
        dtSeconds,
      );
      const along = marble.speed;

      // Corsia personale: ogni biglia punta al suo lato, non alla linea della
      // pista. Il bersaglio si sposta piano, quindi il percorso è irripetibile
      // e due biglie vicine non disegnano la stessa curva.
      const halfLane = Math.max(6, frame.width / 2 - radius - 6);
      const want = lineOffset(marble.line, this.raceElapsed, halfLane * 0.9);
      const lateralPosition =
        (body.position.x - frame.x) * frame.nx + (body.position.y - frame.y) * frame.ny;
      const toward = want - lateralPosition;
      const steer = Math.max(-1.1, Math.min(1.1, toward * 0.05));
      // Gravità sulla componente verticale della pista, trattenuta dalla
      // tenuta del fondo; i dossi aggiungono il sobbalzo.
      const pull = physics.gravity * 0.012;
      const gripDamping = 1 - Math.min(0.6, physics.grip * 0.07);
      const bump = (this.raceRng() - 0.5) * physics.bumps * 0.32;
      // Colpo di sonno: ogni tanto una biglia sbanda di lato senza motivo.
      const shove = this.raceRng() < 0.003 ? (this.raceRng() - 0.5) * 5 : 0;
      const lateralSpeed = body.velocity.x * frame.nx + body.velocity.y * frame.ny;
      const lateral = Math.max(
        -4,
        Math.min(4, (lateralSpeed * 0.86 + steer + pull + bump + shove) * gripDamping),
      );

      // Velocità lungo la tangente della pista: la biglia segue la curva e
      // sbatte sui muri veri solo quando viene spinta di lato.
      Body.setVelocity(body, {
        x: frame.tx * along + frame.nx * lateral,
        y: frame.ty * along + frame.ny * lateral,
      });
    }

    Engine.update(this.engine, PHYSICS_STEP);

    const finishS = geometry.totalLength - radius;
    for (const marble of this.raceMarbles) {
      if (marble.finished || !marble.body) continue;

      const body = marble.body;
      const projection = projectOnTrack(geometry, body.position.x, body.position.y, marble.spine);
      marble.spine = projection.index;
      marble.x = Math.max(0, Math.min(100, projection.progress * 100));
      marble.v = Math.hypot(body.velocity.x, body.velocity.y);

      // Watchdog anti-incastro: se la biglia resta ferma su un angolo o contro
      // un paracarro, viene rimessa al centro poco più avanti. La corsa non si
      // blocca mai per colpa di un ostacolo.
      if (projection.progress > marble.bestProgress + 0.0015) {
        marble.bestProgress = projection.progress;
        marble.stuckFor = 0;
      } else {
        marble.stuckFor += PHYSICS_STEP / 1000;
      }
      if (marble.stuckFor > 2) {
        const resume = Math.min(geometry.totalLength - radius, projection.s + 70);
        const frame = pointAtS(geometry, resume);
        Body.setPosition(body, { x: frame.x, y: frame.y });
        Body.setVelocity(body, { x: frame.tx * 2, y: frame.ty * 2 });
        marble.speed = 2;
        marble.spine = Math.round(resume / 6);
        marble.stuckFor = 0;
        marble.bestProgress = projection.progress;
      }
      marble.trail.push({ x: body.position.x, y: body.position.y });
      if (marble.trail.length > 30) marble.trail.shift();

      if (projection.s >= finishS) {
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
    this.audio.stopMarbleBed();
    // Traguardo: la sala applaude, come a fine di ogni gara vera.
    this.audio.playApplause();
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

      // Anche i piazzamenti negativi entrano in classifica: senza l'emit il
      // quinto resterebbe a zero invece di pagare la sua gara.
      if (points !== 0) {
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
    this.saveCheckpoint();

    this.startClock(this.preview ? 1 : BETWEEN_SECONDS, () => {
      void this.startRace(this.raceIndex() + 1);
    });
  }

  private drawRace(now: number): void {
    const ctx = this.raceCtx;
    const track = this.currentTrack();
    const geometry = this.geometry;
    if (!ctx || !track || !geometry || this.raceW < 20 || this.raceH < 20) return;

    const w = this.raceW;
    const h = this.raceH;
    ctx.setTransform(this.raceDpr, 0, 0, this.raceDpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawBackdrop(ctx, track, w, h, now);

    const count = Math.max(1, this.raceMarbles.length);
    const trackWidth = geometry.width;
    this.drawScale = this.viewScaleFor(geometry);

    const leader = this.leaderMarble();
    const leaderPoint = frameAtProgress(geometry, Math.max(0, Math.min(1, (leader?.x ?? 0) / 100)));
    const maxCamera = Math.max(
      geometry.bounds.minX,
      geometry.bounds.maxX + TRACK_END_PADDING - w / this.drawScale,
    );
    // La TV insegue le prime biglie: il gruppo di testa sta poco oltre il
    // centro, con la strada davanti e gli inseguitori ancora in campo. Sul
    // verticale la camera segue il nastro, così riempie tutta l'altezza.
    const targetCamera = Math.max(
      geometry.bounds.minX - 40,
      Math.min(maxCamera, leaderPoint.x - (w * 0.58) / this.drawScale),
    );
    // Il nastro intero deve stare nel quadro: la camera verticale resta sul
    // centro dell'inviluppo, senza tagliare le punte dei tornanti.
    const targetHeight = (geometry.bounds.minY + geometry.bounds.maxY) / 2;
    if (!this.cameraReady) {
      this.cameraX = targetCamera;
      this.cameraY = targetHeight;
      this.cameraReady = true;
    } else {
      this.cameraX += (targetCamera - this.cameraX) * 0.09;
      this.cameraY += (targetHeight - this.cameraY) * 0.08;
    }

    const shake = this.cameraShake;
    const shakeX = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0.1 ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    // Da qui in poi si disegna in coordinate di mondo: le stesse dei corpi
    // fisici. La scala è uniforme, quindi la pista vista è quella giocata.
    ctx.translate(0, h * TRACK_VIEW_CENTER);
    ctx.scale(this.drawScale, this.drawScale);
    ctx.translate(-this.cameraX, -this.cameraY);

    this.drawTrack(ctx, track, trackWidth, now);

    const drawOrder = [...this.raceMarbles].sort((a, b) => {
      const pointA = a.body?.position.y ?? 0;
      const pointB = b.body?.position.y ?? 0;
      return pointA - pointB;
    });

    for (const marble of drawOrder) {
      const index = this.raceMarbles.indexOf(marble);
      this.drawRacer(ctx, marble, index, count, trackWidth, now, marble === leader);
    }

    this.drawParticles(ctx);
    ctx.restore();
    this.drawRaceHud(ctx, w);
    drawCountdown(ctx, w, h, {
      secondsLeft: this.countdownLeft,
      flash: this.countdownFlash,
      raceNumber: this.raceNumber(),
      totalRaces: this.totalRaces,
      surface: track.surface,
    });
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    if (!this.particles.length) return;

    const left = this.cameraX - 20 / this.drawScale;
    const right = this.cameraX + this.raceW / this.drawScale + 20;
    ctx.save();
    for (const particle of this.particles) {
      if (particle.x < left || particle.x > right) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        particle.x - particle.size / 2,
        particle.y - particle.size / 2,
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
   * Serpentina con tornanti: la fisica resta una corsia sola, ma il disegno
   * piega a destra e a sinistra con curve strette. Il seme decide onde,
   * ampiezza e fase: lo stesso seme ridisegna la stessa pista.
   */
  /** La pista della gara: pezzi dal catalogo, linea unica per disegno e fisica. */
  private buildGeometry(): TrackGeometry {
    const count = Math.max(1, this.raceMarbles.length || this.players.length || 4);
    return buildTrack(this.trackSeed || 1, {
      width: this.raceTrackWidth(count),
      length: TRACK_WORLD_LENGTH,
      startX: TRACK_START_X,
      // La pista viene dal fondo: la stessa linea dà bordi, muri Matter e
      // proiezione della biglia, quindi quello che si vede è quello che pesa.
      profile: this.currentTrack()?.geometry,
    });
  }

  /**
   * Scala uniforme mondo→schermo: tutto il serpente (bordi e punte dei
   * tornanti) sta nell'altezza del quadro, senza bande vuote né "mangiate".
   */
  private viewScaleFor(geometry: TrackGeometry): number {
    const span = Math.max(
      1,
      geometry.bounds.maxY - geometry.bounds.minY + geometry.width + 16,
    );
    return Math.max(0.4, Math.min(3.4, (this.raceH - 4) / span));
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

  private generateHazards(track: BiglieTrack): void {
    // La lista vive in `hazard-plan.ts`: la stessa che usa la simulazione.
    this.hazards = buildHazards(track.id, this.trackSeed);
  }

  private hazardLane(
    hazard: Hazard,
    trackWidth: number,
  ): { x: number; y: number; angle: number } {
    const geometry = this.geometry;
    if (!geometry) return { x: 0, y: 0, angle: 0 };
    const frame = frameAtProgress(geometry, hazard.progress);
    const lateral = hazard.offset * trackWidth * 0.3;
    return {
      x: frame.x + frame.nx * lateral,
      y: frame.y + frame.ny * lateral,
      angle: frame.angle,
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
      case 'sabbia':
        return { top: MUSTARD, bottom: '#b07a12', speck: PAPER_HI };
      case 'magma':
        return { top: TOMATO, bottom: '#7a1a0a', speck: MUSTARD };
      case 'meteorite':
        return { top: '#2b2b2b', bottom: INK, speck: PAPER };
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
      case 'paracarro':
        return { top: PAPER_HI, bottom: TOMATO, speck: INK };
      default:
        return { top: MUSTARD, bottom: '#b07a12', speck: PAPER_HI };
    }
  }

  private raceTrackWidth(count: number): number {
    // Corsia stretta: le biglie si toccano, il tracciato serpeggia di più e a
    // 720p resta largo abbastanza per il gruppo di testa.
    return trackWidthFor(count);
  }

  private marbleRadius(count: number, trackWidth: number): number {
    return marbleRadiusFor(count, trackWidth);
  }

  private drawBackdrop(
    ctx: CanvasRenderingContext2D,
    track: BiglieTrack,
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

  private skyPalette(track: BiglieTrack): {
    top: string;
    bottom: string;
    hill: string;
    hillFar: string;
    ground: string;
    glow: string;
  } {
    switch (track.id) {
      case 'vetro':
        return {
          top: INK,
          bottom: '#9fd8c8',
          hill: '#1f3a34',
          hillFar: '#152823',
          ground: MINT,
          glow: 'rgba(139, 227, 196, .3)',
        };
      case 'sabbia':
        return {
          top: '#2b1a0c',
          bottom: '#c98b2e',
          hill: '#4a2f14',
          hillFar: '#331f0d',
          ground: MUSTARD,
          glow: 'rgba(255, 197, 61, .3)',
        };
      case 'spazio':
        return {
          top: '#08080a',
          bottom: '#23306a',
          hill: '#141414',
          hillFar: '#0d0d10',
          ground: '#141414',
          glow: 'rgba(241, 228, 201, .22)',
        };
      case 'magma':
        return {
          top: '#1a0906',
          bottom: '#8f2b12',
          hill: '#3d120a',
          hillFar: '#2a0c06',
          ground: '#5a1d10',
          glow: 'rgba(255, 77, 46, .34)',
        };
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
    track: BiglieTrack,
    trackWidth: number,
    now: number,
  ): void {
    const geometry = this.geometry;
    if (!geometry) return;

    const palette = this.surfacePalette(track.id);
    const left = edgePoints(geometry, -1, 2);
    const right = edgePoints(geometry, 1, 2);
    const surface = this.trackPolygon(left, right);

    ctx.save();
    ctx.translate(0, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, .42)';
    ctx.fill(surface);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#070a0f';
    ctx.lineWidth = 10;
    ctx.stroke(surface);

    // Il fondo variabile (strettoie comprese) è un poligono, non una striscia
    // a larghezza fissa: il disegno segue esattamente i muri fisici.
    const fill = ctx.createLinearGradient(
      0,
      geometry.bounds.minY - trackWidth / 2,
      0,
      geometry.bounds.maxY + trackWidth / 2,
    );
    fill.addColorStop(0, palette.top);
    fill.addColorStop(1, palette.bottom);
    ctx.fillStyle = fill;
    ctx.fill(surface);

    const center = this.trackLine(geometry.nodes.map((node) => ({ x: node.x, y: node.y })));
    ctx.setLineDash([16, 20]);
    ctx.strokeStyle = 'rgba(255, 255, 255, .24)';
    ctx.lineWidth = 2;
    ctx.stroke(center);
    ctx.setLineDash([]);

    for (const side of [-1, 1] as const) {
      const edge = this.trackLine(edgePoints(geometry, side, 3));
      ctx.setLineDash([20, 18]);
      ctx.strokeStyle = side > 0 ? 'rgba(255, 255, 255, .62)' : 'rgba(248, 113, 113, .62)';
      ctx.lineWidth = 3;
      ctx.stroke(edge);
      ctx.setLineDash([]);
    }

    for (let index = 0; index < 150; index++) {
      const node = geometry.nodes[Math.floor((index / 150) * (geometry.nodes.length - 1))];
      const side = Math.sin(index * 12.9898) * 0.5;
      const nx = -Math.sin(node.angle);
      const ny = Math.cos(node.angle);
      const px = node.x + nx * side * trackWidth * 0.86;
      const py = node.y + ny * side * trackWidth * 0.86;
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
          const node = geometry.nodes[Math.floor((index / 120) * (geometry.nodes.length - 1))];
          const offset = (row - 1) * 14;
          const px = node.x - Math.sin(node.angle) * offset;
          const py = node.y + Math.cos(node.angle) * offset
            + Math.sin(index / 8 + now / 360 + row) * 4;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    if (track.id === 'f1') this.drawCurbs(ctx, trackWidth);
    if (track.id === 'neve') this.drawSnowbanks(ctx, trackWidth);

    this.drawHazards(ctx, trackWidth, now);

    this.drawGate(ctx, 0, 'START', trackWidth);
    this.drawGate(ctx, 1, 'TRAGUARDO', trackWidth);
  }

  private trackPolygon(
    left: Array<{ x: number; y: number }>,
    right: Array<{ x: number; y: number }>,
  ): Path2D {
    const path = new Path2D();
    left.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    for (let index = right.length - 1; index >= 0; index--) {
      path.lineTo(right[index].x, right[index].y);
    }
    path.closePath();
    return path;
  }

  private trackLine(points: Array<{ x: number; y: number }>): Path2D {
    const path = new Path2D();
    points.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    return path;
  }

  /** Ostacoli disegnati a terra, nella posizione dei loro sensori fisici. */
  private drawHazards(
    ctx: CanvasRenderingContext2D,
    trackWidth: number,
    now: number,
  ): void {
    const left = this.cameraX - 40 / this.drawScale;
    const right = this.cameraX + this.raceW / this.drawScale + 40;

    for (const hazard of this.hazards) {
      const lane = this.hazardLane(hazard, trackWidth);
      if (lane.x < left || lane.x > right) continue;

      ctx.save();
      ctx.translate(lane.x, lane.y - 4);
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
        case 'sabbia':
          this.drawPatch(ctx, 24, 10, MUSTARD, PAPER_HI, 0.6);
          ctx.fillStyle = INK;
          for (let grain = 0; grain < 5; grain++) {
            ctx.fillRect(-14 + grain * 7, -2 + (grain % 2) * 3, 2, 2);
          }
          break;
        case 'magma':
          this.drawPatch(ctx, 25, 10, TOMATO, MUSTARD, 0.85);
          ctx.strokeStyle = MUSTARD;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-9, 1);
          ctx.lineTo(-2, -3);
          ctx.lineTo(4, 0);
          ctx.lineTo(10, -2);
          ctx.stroke();
          break;
        case 'sasso':
          this.drawRock(ctx, 9, '#6f6652', '#3a3a2c');
          break;
        case 'meteorite':
          this.drawRock(ctx, 11, '#6b6b5a', '#2b2b2b');
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
          this.drawRock(ctx, 9, '#3a3a2c', INK);
          this.drawWave(ctx, trackWidth * 0.7, now, true);
          break;
        case 'paracarro':
          this.drawParacarro(ctx);
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

  /** Paracarro: un paletto basso a strisce, piccolo ma solido. */
  private drawParacarro(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, .35)';
    ctx.beginPath();
    ctx.ellipse(1, 5, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PAPER_HI;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(-4, -9, 8, 13);
    ctx.strokeRect(-4, -9, 8, 13);

    ctx.fillStyle = TOMATO;
    ctx.fillRect(-4, -9, 8, 4);
    ctx.fillStyle = INK;
    ctx.fillRect(-4, -1, 8, 2);
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

  private drawCurbs(ctx: CanvasRenderingContext2D, trackWidth: number): void {
    const geometry = this.geometry;
    if (!geometry) return;

    for (const side of [-1, 1] as const) {
      const edge = edgePoints(geometry, side, 7);
      for (let index = 0; index + 6 < edge.length; index += 6) {
        const a = edge[index];
        const b = edge[index + 6];
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = (index / 6) % 2 === 0 ? TOMATO : PAPER_HI;
        ctx.fillRect(-7, -4.5, 14, 9);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-7, -4.5, 14, 9);
        ctx.restore();
      }
    }
  }

  private drawSnowbanks(ctx: CanvasRenderingContext2D, trackWidth: number): void {
    const geometry = this.geometry;
    if (!geometry) return;

    for (const side of [-1, 1] as const) {
      const edge = edgePoints(geometry, side, -8);
      for (let index = 8; index < edge.length; index += 20) {
        const point = edge[index];
        ctx.fillStyle = 'rgba(241, 228, 201, .85)';
        ctx.strokeStyle = 'rgba(21, 21, 15, .45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, 15, 6, point.angle + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawGate(
    ctx: CanvasRenderingContext2D,
    progress: number,
    label: string,
    trackWidth: number,
  ): void {
    const geometry = this.geometry;
    if (!geometry) return;

    const point = frameAtProgress(geometry, progress);
    const left = this.cameraX - 180 / this.drawScale;
    const right = this.cameraX + this.raceW / this.drawScale + 180;
    if (point.x < left || point.x > right) return;

    const half = trackWidth / 2 + 18;
    const blocks = 14;
    const block = (half * 2) / blocks;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(point.angle);
    for (let row = 0; row < 2; row++) {
      for (let index = 0; index < blocks; index++) {
        ctx.fillStyle = (index + row) % 2 === 0 ? '#f8fafc' : '#111827';
        ctx.fillRect(-8 + row * 8, -half + index * block, 8, block);
      }
    }
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 ${12 / this.drawScale}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, point.x, point.y - half - 18 / this.drawScale);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  private drawRacer(
    ctx: CanvasRenderingContext2D,
    marble: RaceMarble,
    index: number,
    count: number,
    trackWidth: number,
    now: number,
    leader: boolean,
  ): void {
    const body = marble.body;
    const data = this.marbleById(marble.marbleId);
    if (!body || !data) return;

    const color = data.color;
    const radius = this.marbleRadius(count, trackWidth);
    const x = body.position.x;
    const y = body.position.y;
    const bob = marble.finished ? Math.sin(now / 180 + index) * 0.8 : 0;
    const floorY = y + radius * 0.82;

    const trail = this.trailStyle(this.currentTrack()?.id ?? 'rally');
    marble.trail.forEach((trailPoint, trailIndex) => {
      const t = trailIndex / Math.max(1, marble.trail.length);
      ctx.globalAlpha = t * 0.34;
      ctx.fillStyle = trail.color;
      ctx.beginPath();
      ctx.arc(trailPoint.x, trailPoint.y + radius * 0.25, radius * (0.16 + t * trail.scale), 0, Math.PI * 2);
      ctx.fill();
      if (trailIndex % 3 === 0) {
        ctx.globalAlpha = t * 0.22;
        ctx.beginPath();
        ctx.arc(
          trailPoint.x + Math.sin(trailIndex * 2.1 + index) * 5,
          trailPoint.y + radius * 0.4,
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
    ctx.arc(x, y + bob, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, .5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `${Math.round(radius * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.emoji, x, y + bob + 1);

    if (leader && !marble.finished) {
      ctx.font = `${Math.round(radius * 1.1)}px system-ui, sans-serif`;
      ctx.fillText('👑', x, y + bob - radius - 9);
    }

    if (count <= 6) {
      // Il testo vive in coordinate di mondo: si divide per la scala per
      // restare leggibile come sul resto della TV.
      ctx.font = `600 ${11 / this.drawScale}px ui-monospace, monospace`;
      ctx.fillStyle = '#e7e5e4';
      const name =
        marble.playerName.length > 14 ? `${marble.playerName.slice(0, 13)}…` : marble.playerName;
      ctx.fillText(name, x, y + bob - radius - (leader && !marble.finished ? 25 : 12) / this.drawScale);
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
      ctx.fillStyle = 'color-mix(in srgb, var(--coal) 56%, transparent)';
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
      case 'vetro':
        return { color: 'rgba(255, 248, 232, .8)', scale: 0.3 };
      case 'sabbia':
        return { color: 'rgba(255, 197, 61, .7)', scale: 0.36 };
      case 'spazio':
        return { color: 'rgba(241, 228, 201, .45)', scale: 0.24 };
      case 'magma':
        return { color: 'rgba(255, 77, 46, .7)', scale: 0.34 };
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
      case 'vetro':
        return { top: '#e8fbf4', bottom: '#a9dccb', speck: 'rgba(47, 91, 255, .22)' };
      case 'sabbia':
        return { top: '#e0a63a', bottom: '#b07a12', speck: 'rgba(21, 21, 15, .28)' };
      case 'spazio':
        return { top: '#1c1c22', bottom: '#101014', speck: 'rgba(241, 228, 201, .5)' };
      case 'magma':
        return { top: '#5a1d10', bottom: '#2b0c05', speck: 'rgba(255, 197, 61, .4)' };
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
    // Classifica finale: applausi e fanfara del vincitore, non un silenzio.
    this.audio.playApplause();
    this.audio.playPodiumReveal(1);
    this.phase.set(Phase.FINALE);
    this.secondsLeft.set(FINALE_SECONDS);
    this.publish();
    this.saveCheckpoint();
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
        races: TRACKS_PER_ROUND,
        totalRaces: BIGLIE_RACES,
        roundIndex: this.roundIndex,
        raceNumber: this.raceNumber(),
        trackPlan: this.roundTracks().map((track) => track.id),
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
