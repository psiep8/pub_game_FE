import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GameService } from '../../../core/services/game.service';
import { ReliabilityService } from '../../../core/services/reliability.service';
import {
  type BasketCamera,
  type BasketWorld,
  MANCHE_LABELS,
  type ShotState,
  type Vec3,
  createBasketWorld,
  createCamera,
  createShot,
  isShotResting,
  launchShot,
  previewTrajectory,
  projectPoint,
  stepShot,
} from './basket-physics';
import { createNetState, kickNet, stepNet, type NetState } from './basket-net';
import { drawBasketScene } from './basket-renderer';

type GameState = 'READY' | 'PLAYING' | 'MANCHE_END' | 'OVER';

const MANCHE_COUNT = 3;
const MANCHE_SECONDS = 30;

@Component({
  selector: 'app-basket-bonus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './basket-bonus.component.html',
  styleUrl: './basket-bonus.component.css',
})
export class BasketBonus implements AfterViewInit, OnDestroy {
  @ViewChild('court') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);
  private reliability = inject(ReliabilityService);

  readonly mancheCount = MANCHE_COUNT;
  readonly MANCHE_LABELS = MANCHE_LABELS;

  readonly score = signal(0);
  readonly mancheScore = signal(0);
  readonly mancheScores = signal<number[]>([0, 0, 0]);
  readonly manche = signal(0);
  readonly shots = signal(0);
  readonly timeLeft = signal(MANCHE_SECONDS);
  readonly state = signal<GameState>('READY');
  readonly best = signal(this.readBest());
  readonly message = signal<string | null>(null);
  readonly messageTone = signal<'score' | 'miss'>('score');
  readonly serverReady = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly targetPull = signal(0.5);
  readonly targetTolerance = signal(0.055);
  readonly power = signal(0);

  private world: BasketWorld = createBasketWorld(0);
  private shot: ShotState = createShot(this.world);
  private net: NetState = createNetState(this.world);
  private camera: BasketCamera | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private mancheTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTs = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private drag = false;
  private pointer: { x: number; y: number } | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private pull = 0;
  private side = 0;
  private trajectory: Vec3[] = [];
  private ballReleased = false;
  private resetAfter = 0;
  private restTime = 0;
  private lastImpactAt = 0;
  private netRimKicked = false;
  private netScoreKicked = false;
  private missShown = false;
  private gameId = Number(localStorage.getItem('activeGameId')) || 1;
  private shotId: string | null = null;
  private serverStartedAt = 0;
  private serverManche = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }

    this.raf = requestAnimationFrame(this.frame);
    void this.initServer();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.stopTimer();
    if (this.mancheTimer) clearTimeout(this.mancheTimer);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.resizeObserver?.disconnect();
  }

  mancheLabel(index = this.manche()): string {
    return MANCHE_LABELS[index] ?? MANCHE_LABELS[0];
  }

  targetPercent(): number {
    return Math.round(this.targetPull() * 100);
  }

  tolerancePercent(): number {
    return Math.max(1, Math.round(this.targetTolerance() * 100));
  }

  powerPercent(): number {
    return Math.round(this.power() * 100);
  }

  startGame(): void {
    this.stopTimer();
    if (this.mancheTimer) {
      clearTimeout(this.mancheTimer);
      this.mancheTimer = undefined;
    }

    this.score.set(0);
    this.mancheScore.set(0);
    this.mancheScores.set([0, 0, 0]);
    this.shots.set(0);
    this.message.set(null);
    this.messageTone.set('score');
    void this.startServerGame();
  }

  /** Apre la sessione REMOTE e carica il tabellone che ha creato la TV. */
  private async initServer(): Promise<boolean> {
    const playerName = this.resolvePlayerName();
    if (!playerName) {
      this.serverError.set('Torna al party e rientra con il tuo nome.');
      return false;
    }

    const registered = await this.reliability.start(this.gameId, 'REMOTE', playerName);
    if (!registered) {
      this.serverError.set('Sessione non disponibile: riprova tra poco.');
      return false;
    }

    try {
      const state = await firstValueFrom(this.gameService.getBasketState(this.gameId));
      if (!state?.active) {
        this.serverReady.set(false);
        this.serverError.set('Il bonus non è aperto. Attendi il via della TV.');
        return false;
      }
      this.applyServerState(state);
      this.serverReady.set(true);
      this.serverError.set(null);
      return true;
    } catch {
      this.serverReady.set(false);
      this.serverError.set('Tabellone non raggiungibile: riprova.');
      return false;
    }
  }

  private async startServerGame(): Promise<void> {
    if (!await this.initServer()) return;
    this.startManche(Math.max(0, Math.min(MANCHE_COUNT - 1, this.serverManche)));
  }

  private applyServerState(state: any): void {
    this.score.set(Number(state.score) || 0);
    this.shots.set(Number(state.shots) || 0);
    this.serverManche = Math.max(0, Number(state.manche ?? 1) - 1);
    this.manche.set(this.serverManche);
    this.mancheScores.set(
      Array.isArray(state.mancheScores)
        ? [...state.mancheScores].slice(0, 3).map((value) => Number(value) || 0)
        : [0, 0, 0],
    );
    this.targetPull.set(Number(state.targetPull) || 0.5);
    this.targetTolerance.set(Number(state.targetTolerance) || 0.055);
    this.shotId = typeof state.shotId === 'string' ? state.shotId : null;
    this.serverStartedAt = Number(state.startedAt) || 0;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.state() !== 'PLAYING' || this.ballReleased || !this.camera || !this.serverReady() || !this.shotId) return;

    const point = this.toLocal(event);
    const ball = projectPoint(this.camera, this.shot.position);
    const nearBall = ball.visible && Math.hypot(point.x - ball.x, point.y - ball.y) < Math.max(88, this.w * 0.22);
    const lowerZone = point.y > this.h * 0.55;

    if (!nearBall && !lowerZone) return;

    event.preventDefault();
    this.drag = true;
    this.dragStart = point;
    this.pointer = point;
    this.pull = 0;
    this.side = 0;
    this.trajectory = [];
    try {
      this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // Safari mobile e pointer sintetici possono non avere un pointer attivo:
      // il drag continua comunque sul canvas.
    }
    this.vibrate(8);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag) return;

    event.preventDefault();
    const point = this.toLocal(event);
    this.pointer = point;
    this.updateAim(point);
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drag) return;

    event.preventDefault();
    const point = this.toLocal(event);
    this.pointer = point;
    this.updateAim(point);
    this.drag = false;

    if (this.pull < 0.06) {
      this.trajectory = [];
      this.pointer = null;
      this.dragStart = null;
      return;
    }

    const pull = this.pull;
    const side = this.side;
    launchShot(this.shot, this.world, pull, side);
    this.ballReleased = true;
    this.shots.update((value) => value + 1);
    this.lastTs = 0;
    this.resetAfter = 0;
    this.restTime = 0;
    this.trajectory = [];
    this.pointer = null;
    this.dragStart = null;
    this.pull = 0;
    this.side = 0;
    this.power.set(0);
    this.vibrate(18);
    this.submitShot(pull, side);
  }

  onPointerCancel(event: PointerEvent): void {
    if (!this.drag) return;
    event.preventDefault();
    this.drag = false;
    this.trajectory = [];
    this.pointer = null;
    this.dragStart = null;
    this.pull = 0;
    this.side = 0;
  }

  private startManche(index: number): void {
    this.stopTimer();
    this.manche.set(index);
    this.mancheScore.set(0);
    const elapsed = this.serverStartedAt
      ? Math.max(0, Math.floor((Date.now() - this.serverStartedAt) / 1000))
      : index * MANCHE_SECONDS;
    const remaining = this.serverStartedAt
      ? Math.max(1, Math.min(MANCHE_SECONDS, (index + 1) * MANCHE_SECONDS - elapsed))
      : MANCHE_SECONDS;
    this.timeLeft.set(remaining);
    this.state.set('PLAYING');
    this.message.set(null);
    this.messageTone.set('score');
    this.world = createBasketWorld(index);
    this.net = createNetState(this.world);
    this.camera = this.w > 0 ? createCamera(this.w, this.h, this.world) : null;
    this.placeBall();
    this.lastTs = 0;

    this.timer = setInterval(() => {
      const next = this.timeLeft() - 1;
      this.timeLeft.set(Math.max(0, next));
      if (next <= 0) this.endManche();
    }, 1000);

    this.vibrate(18);
  }

  private endManche(): void {
    if (this.state() !== 'PLAYING') return;
    this.stopTimer();

    const scores = [...this.mancheScores()];
    scores[this.manche()] = this.mancheScores()[this.manche()] ?? 0;
    this.mancheScores.set(scores);
    this.state.set('MANCHE_END');
    this.drag = false;
    this.trajectory = [];
    this.vibrate(60);

    this.mancheTimer = setTimeout(() => {
      if (this.manche() < MANCHE_COUNT - 1) {
        this.startManche(this.manche() + 1);
      } else {
        this.finishGame();
      }
    }, 2600);
  }

  private finishGame(): void {
    this.state.set('OVER');
    this.message.set(null);

    if (this.score() > this.best()) {
      this.best.set(this.score());
      try {
        localStorage.setItem('basketBest', String(this.score()));
      } catch {
        // localStorage può essere bloccato: il record resta solo in memoria.
      }
    }
  }

  private frame = (ts: number): void => {
    const dt = this.lastTs > 0 ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (this.state() === 'PLAYING') this.updateShot(dt);
    this.updateNet(dt);
    this.draw(ts / 1000);

    this.raf = requestAnimationFrame(this.frame);
  };

  private updateShot(dt: number): void {
    if (dt <= 0) return;

    if (this.resetAfter > 0) {
      this.resetAfter -= dt;
      if (this.resetAfter <= 0) {
        this.placeBall();
        return;
      }
    }

    if (!this.ballReleased) return;

    const events = stepShot(this.shot, this.world, dt);
    if (events.scored) {
      if (!this.netScoreKicked) {
        kickNet(this.net, this.world, events.swish ? 1.55 : 1.2);
        this.netScoreKicked = true;
      }
      this.onScore(events.swish);
    }
    if (events.hitRim) {
      if (!this.netRimKicked) {
        kickNet(this.net, this.world, 0.7);
        this.netRimKicked = true;
      }
      this.impact(9);
    } else if (events.hitBoard) {
      this.impact(5);
    }

    if (!this.shot.scored && (events.hitFloor || this.shot.dead)) {
      this.reportMiss();
    }

    if (this.shot.dead) {
      this.resetAfter = Math.min(this.resetAfter > 0 ? this.resetAfter : 0.35, 0.35);
      return;
    }
    if (this.shot.scored) return;

    if (isShotResting(this.shot, this.world)) {
      this.reportMiss();
      this.restTime += dt;
      if (this.restTime > 0.75) this.placeBall();
    } else {
      this.restTime = 0;
    }
  }

  private onScore(swish: boolean): void {
    // L'animazione può suggerire il canestro, ma i punti arrivano solo dalla
    // risposta server: qui non si tocca né il punteggio né la classifica.
    this.resetAfter = 1.15;
    this.vibrate(swish ? [24, 30, 52] : [24, 30]);
  }

  private reportMiss(): void {
    if (this.missShown || this.shot.scored) return;
    this.missShown = true;

    const text = this.shot.hitRim
      ? 'FERRO · RIPROVA'
      : this.shot.hitBoard
        ? 'TABELLONE · RIPROVA'
        : 'FUORI · RIPROVA';
    this.flash(text, 'miss');
    this.vibrate(18);
  }

  private placeBall(): void {
    this.shot = createShot(this.world);
    this.ballReleased = false;
    this.netRimKicked = false;
    this.netScoreKicked = false;
    this.missShown = false;
    this.drag = false;
    this.trajectory = [];
    this.pointer = null;
    this.dragStart = null;
    this.pull = 0;
    this.side = 0;
    this.resetAfter = 0;
    this.restTime = 0;
  }

  private draw(time: number): void {
    const camera = this.camera;
    const ctx = this.ctx;
    if (!camera || !ctx) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBasketScene(ctx, {
      camera,
      world: this.world,
      net: this.net,
      shot: this.shot,
      dragging: this.drag,
      pull: this.pull,
      trajectory: this.trajectory,
      pointer: this.pointer,
      dragStart: this.dragStart,
      time,
    });
  }

  private updateNet(dt: number): void {
    if (dt <= 0) return;
    stepNet(this.net, this.world, this.shot.position, dt);
  }

  private updateAim(point: { x: number; y: number }): void {
    if (!this.dragStart) return;

    const pull = Math.min(1, Math.max(0, (this.dragStart.y - point.y) / (this.h * 0.3)));
    const side = Math.min(1, Math.max(-1, (point.x - this.dragStart.x) / (this.w * 0.34)));

    this.pull = pull;
    this.side = side;
    this.power.set(pull);
    this.trajectory = pull > 0.02 ? previewTrajectory(this.world, pull, side) : [];
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    this.w = rect.width;
    this.h = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * this.dpr);
    canvas.height = Math.round(rect.height * this.dpr);
    this.camera = createCamera(this.w, this.h, this.world);
  }

  private toLocal(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private submitShot(pull: number, side: number): void {
    const playerName = this.resolvePlayerName();
    const shotId = this.shotId;
    if (!playerName || !shotId) {
      this.flash('TIRO NON INVIATO · RIPROVA', 'miss');
      return;
    }

    this.shotId = null;
    this.gameService.basketShot(this.gameId, shotId, pull, side).subscribe({
      next: (result: any) => this.applyShotResult(result),
      error: () => this.flash('TIRO NON REGISTRATO · RIPROVA', 'miss'),
    });
  }

  private applyShotResult(result: any): void {
    if (!result) return;
    this.score.set(Number(result.score) || 0);
    this.shots.set(Number(result.shots) || this.shots());
    this.mancheScores.set(
      Array.isArray(result.mancheScores)
        ? [...result.mancheScores].slice(0, 3).map((value) => Number(value) || 0)
        : this.mancheScores(),
    );
    this.serverManche = Math.max(0, Number(result.manche ?? 1) - 1);
    this.targetPull.set(Number(result.targetPull) || 0.5);
    this.targetTolerance.set(Number(result.targetTolerance) || 0.055);
    this.shotId = typeof result.nextShotId === 'string'
      ? result.nextShotId
      : (typeof result.shotId === 'string' ? result.shotId : null);

    const serverScores = Array.isArray(result.mancheScores)
      ? result.mancheScores.map((value: unknown) => Number(value) || 0)
      : this.mancheScores();
    this.mancheScore.set(serverScores[this.manche()] ?? 0);

    const points = Number(result.points) || 0;
    if (result.made) {
      this.flash(`CANESTRO · +${points}`);
      this.vibrate([24, 30, 52]);
    } else {
      this.flash('FUORI · RIPROVA', 'miss');
      this.vibrate(18);
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private flash(text: string, tone: 'score' | 'miss' = 'score'): void {
    this.messageTone.set(tone);
    this.message.set(text);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.message.set(null), 1150);
  }

  private impact(strength: number): void {
    const now = Date.now();
    if (now - this.lastImpactAt < 90) return;
    this.lastImpactAt = now;
    this.vibrate(strength);
  }

  private resolvePlayerName(): string {
    try {
      const fromQuery = (new URLSearchParams(window.location.search).get('player') || '').trim();
      if (fromQuery) return fromQuery;
      return (localStorage.getItem('nickname') || localStorage.getItem('playerName') || '').trim();
    } catch {
      return '';
    }
  }

  private readBest(): number {
    try {
      const value = Number(localStorage.getItem('basketBest'));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  private vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  }
}
