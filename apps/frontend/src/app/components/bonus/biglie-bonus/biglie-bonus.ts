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
    weights: { speed: 0.45, accel: 0.35, grip: 0.2 },
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
    weights: { speed: 0.15, accel: 0.25, grip: 0.6 },
  },
  {
    id: 'acqua',
    name: 'ACQUA',
    surface: 'ACQUA',
    emoji: '🌊',
    tint: '#0369a1',
    weights: { speed: 0.35, accel: 0.5, grip: 0.15 },
  },
];

const RACE_POINTS = [150, 100, 60, 30];
const INTRO_SECONDS = 4;
const PICK_SECONDS = 10;
const RACE_SECONDS = 18;
const BETWEEN_SECONDS = 4;
const FINALE_SECONDS = 7;
const TICK_MS = 250;

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
              <span class="bg-hint">Punti gara: 150 · 100 · 60 · 30</span>
            </div>
            <div class="bg-lanes">
              @for (lane of lanes(); track lane.playerName; let i = $index) {
                <div class="bg-lane" [class.done]="lane.finished">
                  <span class="bg-pos">{{ lane.position ?? i + 1 }}</span>
                  <span class="bg-lane-name">{{ lane.playerName }}</span>
                  <div class="bg-bar">
                    <div class="bg-fill" [style.width.%]="lane.progress" [style.background]="marbleColor(lane.marbleId)"></div>
                    <span class="bg-bead" [style.left.%]="lane.progress">{{ marbleEmoji(lane.marbleId) }}</span>
                  </div>
                  <span class="bg-pct">{{ pct(lane.progress) }}%</span>
                </div>
              }
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
    .bg-lanes { display: flex; flex-direction: column; gap: clamp(5px, .8vh, 10px); }
    .bg-lane { display: flex; align-items: center; gap: clamp(8px, 1vw, 16px); }
    .bg-pos { width: 26px; text-align: center; font-family: var(--font-mono); font-weight: 800; font-size: .85rem; opacity: .7; }
    .bg-lane.done .bg-pos { background: var(--acid); border: 2px solid var(--coal); opacity: 1; }
    .bg-lane-name { width: clamp(110px, 10vw, 190px); font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .84rem); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bg-bar { position: relative; flex: 1; height: clamp(22px, 3vh, 30px); background: rgba(30, 25, 20, .1); border: 2px solid var(--coal); overflow: hidden; }
    .bg-fill { position: absolute; inset: 0 auto 0 0; opacity: .55; transition: width .2s linear; }
    .bg-bead { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: clamp(.9rem, 1.3vw, 1.2rem); transition: left .2s linear; }
    .bg-pct { width: 46px; text-align: right; font-family: var(--font-mono); font-size: .72rem; opacity: .7; }
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

  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

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
  private raceTicks = 0;
  private clock?: ReturnType<typeof setInterval>;
  private raceClock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(700, () => this.startIntro());
  }

  ngOnDestroy(): void {
    this.clearClock();
    this.clearRaceClock();
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
    this.raceTicks = 0;
    this.raceResult.set(null);
    this.currentPlayer.set(null);
    this.phase.set('RACE');
    this.secondsLeft.set(RACE_SECONDS);
    this.lanes.set(this.players.map((playerName) => ({
      playerName,
      marbleId: this.assignments.get(playerName) ?? '',
      progress: 0,
      finished: false,
      position: null,
    })));
    this.publish();
    this.startRaceClock();
  }

  private startRaceClock(): void {
    this.clearRaceClock();

    this.raceClock = setInterval(() => {
      this.raceTicks += 1;
      this.stepRace();

      const elapsed = this.raceTicks * TICK_MS;
      this.secondsLeft.set(Math.max(0, Math.ceil((RACE_SECONDS * 1000 - elapsed) / 1000)));
      this.publish();

      if (this.lanes().every((lane) => lane.finished) || elapsed >= RACE_SECONDS * 1000) {
        this.clearRaceClock();
        this.endRace();
      }
    }, TICK_MS);
  }

  private stepRace(): void {
    const track = this.currentTrack();
    if (!track) return;

    const dt = TICK_MS / 1000;

    this.lanes.update((lanes) => lanes.map((lane) => {
      if (lane.finished) return lane;

      const marble = this.marbleById(lane.marbleId);
      if (!marble) return lane;

      const profile =
        (marble.speed * track.weights.speed
          + marble.accel * track.weights.accel
          + marble.grip * track.weights.grip) / 10;
      const pace = (5 + 3 * profile) * (0.92 + Math.random() * 0.16);
      const progress = Math.min(100, lane.progress + pace * dt);

      if (progress < 100) return { ...lane, progress };

      this.finishCount += 1;
      return { ...lane, progress: 100, finished: true, position: this.finishCount };
    }));
  }

  private endRace(): void {
    this.clearRaceClock();

    const ranked = [...this.lanes()].sort((a, b) => {
      const positionA = a.position ?? 999;
      const positionB = b.position ?? 999;
      if (positionA !== positionB) return positionA - positionB;
      return b.progress - a.progress;
    });

    const rows: RaceRow[] = ranked.map((lane, index) => {
      const points = RACE_POINTS[index] ?? 0;
      const total = (this.totals.get(lane.playerName) ?? 0) + points;
      this.totals.set(lane.playerName, total);

      if (points > 0) {
        this.result.emit({ playerName: lane.playerName, score: points });
      }

      return {
        playerName: lane.playerName,
        marbleId: lane.marbleId,
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

  private finale(): void {
    this.clearClock();
    this.clearRaceClock();
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

  private clearRaceClock(): void {
    if (this.raceClock) clearInterval(this.raceClock);
    this.raceClock = undefined;
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
