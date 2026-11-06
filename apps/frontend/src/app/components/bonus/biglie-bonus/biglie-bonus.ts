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
import { WebSocketService } from '../../../services/web-socket.service';

type Phase = 'INTRO' | 'PICK' | 'RACE' | 'RACE_END' | 'FINALE';

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
  y: number;
  vy: number;
  finished: boolean;
  position: number | null;
  trail: Array<{ x: number; y: number }>;
  bumps: number[];
  nextBump: number;
  wobble: number;
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
const TRACK_END_PADDING = 160;
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
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="bg-overlay">
      <div class="bg-card">
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

        @switch (phase()) {
          @case ('INTRO') {
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

          @case ('PICK') {
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

          @case ('RACE') {
            <div class="bg-track-head">
              <span class="bg-surface" [style.background]="currentTrack()?.tint">
                {{ currentTrack()?.emoji }} {{ currentTrack()?.surface }}
              </span>
              <span class="bg-hint">Punti gara: 150 · 100 · 60 · 30 · punti cumulativi su quattro gare</span>
            </div>
            <div class="bg-race-stage">
              <canvas #raceCanvas></canvas>
            </div>
          }

          @case ('RACE_END') {
            <div class="bg-results">
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

          @case ('FINALE') {
            <div class="bg-results">
              @for (row of standings(); track row.playerName; let i = $index) {
                <div class="bg-row" [class.paid]="i === 0">
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
    .bg-race-stage canvas { display: block; width: 100%; height: 100%; }
    .bg-results { display: flex; flex-direction: column; gap: 5px; }
    .bg-row { display: grid; grid-template-columns: 30px 1fr auto auto auto; gap: 12px; align-items: center; padding: 7px 12px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.72rem, 1vw, .92rem); }
    .bg-row.paid { background: var(--acid); }
    .bg-row-pos { font-weight: 800; }
    .bg-row-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bg-row-marble { font-size: .82em; opacity: .7; }
    .bg-row-points { font-size: 1.05em; }
    .bg-row-total { min-width: 42px; text-align: right; font-weight: 800; }
    @keyframes bg-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class BiglieBonus implements OnInit, OnDestroy {
  private ws = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  @ViewChild('raceCanvas') private raceCanvas?: ElementRef<HTMLCanvasElement>;

  readonly tracks = TRACKS;

  readonly phase = signal<Phase>('INTRO');
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

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(700, () => this.startIntro());
  }

  ngOnDestroy(): void {
    this.clearClock();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.raceResize?.disconnect();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  heading(): string {
    switch (this.phase()) {
      case 'INTRO':
        return 'QUATTRO GARE, UNA BIGLIA';
      case 'PICK':
        return 'SCELTA DELLA BIGLIA';
      case 'RACE':
        return `GARA ${this.raceIndex() + 1} / ${TRACKS.length}`;
      case 'RACE_END':
        return "ORDINE D'ARRIVO";
      default:
        return 'CLASSIFICA FINALE';
    }
  }

  subtitle(): string {
    if (this.phase() === 'PICK') {
      return `ORDINE SORTEGGIATO · ${this.pickProgress()}`;
    }
    const track = this.currentTrack();
    if (track && (this.phase() === 'RACE' || this.phase() === 'RACE_END')) {
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
    this.phase.set('INTRO');
    this.secondsLeft.set(INTRO_SECONDS);
    this.publish();
    this.startClock(INTRO_SECONDS, () => this.preparePick());
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
      this.startRace(0);
      return;
    }

    this.phase.set('PICK');
    this.currentPlayer.set(this.pickOrder[this.pickCursor]);
    this.secondsLeft.set(PICK_SECONDS);
    this.publish();
    this.startClock(PICK_SECONDS, () => this.autoPick());
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

  private startRace(index: number): void {
    this.clearClock();

    if (index >= TRACKS.length) {
      this.finale();
      return;
    }

    this.raceIndex.set(index);
    this.finishCount = 0;
    this.raceResult.set(null);
    this.currentPlayer.set(null);
    this.raceMarbles = this.players.map((playerName) => ({
      playerName,
      marbleId: this.assignments.get(playerName) ?? '',
      x: 0,
      v: 0,
      y: 0,
      vy: 0,
      finished: false,
      position: null,
      trail: [],
      // Quattro dossi per corsia: la biglia salta e perde un filo di velocità.
      bumps: [
        10 + Math.random() * 12,
        32 + Math.random() * 12,
        55 + Math.random() * 12,
        78 + Math.random() * 12,
      ],
      nextBump: 0,
      wobble: Math.random() * Math.PI * 2,
    }));
    this.raceElapsed = 0;
    this.publishAcc = 0;
    this.raceEnding = false;
    this.cameraX = 0;
    this.cameraReady = false;
    this.lastFrame = 0;
    this.phase.set('RACE');
    this.secondsLeft.set(RACE_SECONDS);
    this.lanes.set(this.raceMarbles.map((marble) => ({
      playerName: marble.playerName,
      marbleId: marble.marbleId,
      progress: 0,
      finished: false,
      position: null,
    })));
    this.publish();
    requestAnimationFrame(() => this.attachCanvas());
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
  }

  private loop = (now: number): void => {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;

    if (this.phase() === 'RACE' && !this.raceEnding) {
      this.advanceRace(dt);
    }
    if (this.phase() === 'RACE') {
      this.drawRace(now);
    }

    this.frame = requestAnimationFrame(this.loop);
  };

  /** Fisica della corsa: ogni biglia accelera, subisce l'attrito del fondo e salta sui dossi. */
  private advanceRace(dt: number): void {
    const track = this.currentTrack();
    if (!track || dt <= 0) return;

    this.raceElapsed += dt;

    for (const marble of this.raceMarbles) {
      if (marble.finished) continue;

      const body = this.marbleById(marble.marbleId);
      if (!body) continue;

      const profile =
        (body.speed * track.weights.speed
          + body.accel * track.weights.accel
          + body.grip * track.weights.grip) / 10;
      // Il fondo premia un profilo diverso: la velocità converge al passo
      // della biglia senza far dominare sempre la stessa su tutte le piste.
      const cruise = 2.75 + profile * 1.25;
      const response = 1.15 + body.accel * 0.11;
      marble.v = Math.max(0, Math.min(6, marble.v + (cruise - marble.v) * response * dt));
      marble.x += marble.v * dt;

      if (marble.nextBump < marble.bumps.length && marble.x >= marble.bumps[marble.nextBump]) {
        marble.nextBump += 1;
        marble.vy = Math.max(0, 120 + Math.random() * 150 - body.grip * 8);
        marble.v *= 0.955;
      }

      if (marble.y > 0 || marble.vy !== 0) {
        marble.vy -= 820 * dt;
        marble.y += marble.vy * dt;
        if (marble.y <= 0) {
          marble.y = 0;
          marble.vy = Math.abs(marble.vy) > 90 ? -marble.vy * 0.3 : 0;
        }
      }

      marble.trail.push({ x: marble.x, y: marble.y });
      if (marble.trail.length > 30) marble.trail.shift();

      if (marble.x >= 100) {
        marble.x = 100;
        marble.finished = true;
        this.finishCount += 1;
        marble.position = this.finishCount;
      }
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
    this.phase.set('RACE_END');
    this.secondsLeft.set(BETWEEN_SECONDS);
    this.publish();

    this.startClock(BETWEEN_SECONDS, () => this.startRace(this.raceIndex() + 1));
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
    const maxCamera = Math.max(0, TRACK_START_X + TRACK_WORLD_LENGTH + TRACK_END_PADDING - w);
    const targetCamera = Math.max(0, Math.min(maxCamera, leaderPoint.x - w * 0.36));
    if (!this.cameraReady) {
      this.cameraX = targetCamera;
      this.cameraReady = true;
    } else {
      this.cameraX += (targetCamera - this.cameraX) * 0.09;
    }

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

    this.drawRaceHud(ctx, w);
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

  /** Punto della pista unica: curve e dossi disegnati in coordinate mondo. */
  private trackPoint(progress: number): { x: number; y: number; angle: number } {
    const p = Math.max(0, Math.min(1, progress));
    const waveA = Math.PI * 2 * 1.05;
    const waveB = Math.PI * 2 * 2.65;
    const waveC = Math.PI * 2 * 4.3;
    const y =
      Math.sin(p * waveA + 0.55) * 72 +
      Math.sin(p * waveB + 0.2) * 22 +
      Math.sin(p * waveC) * 7;
    const slope =
      Math.cos(p * waveA + 0.55) * 72 * waveA +
      Math.cos(p * waveB + 0.2) * 22 * waveB +
      Math.cos(p * waveC) * 7 * waveC;
    return {
      x: TRACK_START_X + p * TRACK_WORLD_LENGTH,
      y,
      angle: Math.atan2(slope, TRACK_WORLD_LENGTH),
    };
  }

  private raceTrackWidth(count: number): number {
    return Math.max(88, Math.min(210, 30 + count * 17));
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
        y: h * 0.55 + point.y,
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
      const py = h * 0.55 + point.y - Math.sin(point.angle) * side * trackWidth * 0.86;
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
          const py = h * 0.55 + point.y + Math.sin(index / 8 + now / 360 + row) * 4 + (row - 1) * 14;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    this.drawGate(ctx, 0, 'START', w, h, trackWidth);
    this.drawGate(ctx, 1, 'TRAGUARDO', w, h, trackWidth);
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

    const y = h * 0.55 + point.y;
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
    const body = this.marbleById(marble.marbleId);
    const color = body?.color ?? '#94a3b8';
    const radius = Math.max(8, Math.min(15, trackWidth / Math.max(10, count * 1.55)));
    const progress = Math.max(0, Math.min(1, marble.x / 100));
    const point = this.trackPoint(progress);
    const nx = -Math.sin(point.angle);
    const ny = Math.cos(point.angle);
    const spread = count <= 1 ? 0 : trackWidth * 0.72;
    const offset = ((index + 0.5) / count - 0.5) * spread;
    const baseX = point.x - this.cameraX + nx * offset;
    const baseY = h * 0.55 + point.y + ny * offset;
    const lift = marble.y * 0.9;
    const x = baseX;
    const y = baseY - lift + Math.sin(now / 130 + index) * 1.1;

    const trail = this.trailStyle(this.currentTrack()?.id ?? 'rally');
    marble.trail.forEach((trailPoint, trailIndex) => {
      const t = trailIndex / Math.max(1, marble.trail.length);
      const tp = this.trackPoint(Math.max(0, Math.min(1, trailPoint.x / 100)));
      const tx = tp.x - this.cameraX - Math.sin(tp.angle) * offset;
      const ty = h * 0.55 + tp.y + Math.cos(tp.angle) * offset - trailPoint.y * 0.9;
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

    const shadowScale = 1 - Math.min(0.55, lift / 60);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.34 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(
      baseX,
      baseY + radius * 0.6,
      radius * 0.9 * shadowScale,
      radius * 0.28 * shadowScale,
      0,
      0,
      Math.PI * 2,
    );
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
    ctx.fillText(body?.emoji ?? '⚪', x, y + 1);

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
    const boxHeight = 30 + ranked.length * rowHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 17, .7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, .16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(12, 12, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ORDINE DI CORSA', 24, 28);

    ranked.forEach((marble, index) => {
      const body = this.marbleById(marble.marbleId);
      const y = 44 + index * rowHeight;
      ctx.fillStyle = body?.color ?? '#94a3b8';
      ctx.beginPath();
      ctx.arc(27, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e7e5e4';
      ctx.font = '600 11px ui-monospace, monospace';
      const name =
        marble.playerName.length > 15 ? `${marble.playerName.slice(0, 14)}…` : marble.playerName;
      ctx.fillText(name, 37, y);
      ctx.fillStyle = 'rgba(231, 229, 228, .55)';
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
    this.phase.set('FINALE');
    this.secondsLeft.set(FINALE_SECONDS);
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finished.emit());
  }

  private onStatus(status: any): void {
    if (status?.action !== 'BIGLIE_ACTION') return;
    if (this.phase() !== 'PICK') return;

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
