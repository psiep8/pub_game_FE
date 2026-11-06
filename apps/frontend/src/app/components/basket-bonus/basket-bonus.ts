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
import { WebSocketService } from '../../services/web-socket.service';

type GameState = 'READY' | 'PLAYING' | 'MANCHE_END' | 'OVER';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const MANCHE_COUNT = 3;
const MANCHE_SECONDS = 20;
const MANCHE_LABELS = ['CANESTRO GRANDE', 'CANESTRO MEDIO', 'CANESTRO PICCOLO'];
/** Premio per canestro: cresce quando il ferro si stringe. */
const MANCHE_POINTS = [2, 3, 5];
/** Il ferro si rimpicciolisce a ogni manche. */
const RIM_SCALES = [1.35, 1, 0.72];
const GRAVITY = 1500;
const LAUNCH_POWER = 4.2;
const MAX_SPEED = 1600;

@Component({
  selector: 'app-basket-bonus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="basket-page">
      <header class="basket-head">
        <div class="basket-brand">
          <span class="brand-ball">🏀</span>
          <div>
            <h1>BONUS BASKET</h1>
            <p>3 manche · {{ mancheLabel() }}</p>
          </div>
        </div>
        <div class="basket-stats">
          <div class="stat">
            <span>PUNTI</span>
            <b>{{ score() }}</b>
          </div>
          <div class="stat manche">
            <span>MANCHE</span>
            <b>{{ manche() + 1 }}/{{ mancheCount }}</b>
          </div>
          <div class="stat time" [class.hot]="timeLeft() <= 5">
            <span>TEMPO</span>
            <b>{{ timeLeft() }}s</b>
          </div>
        </div>
      </header>

      <div class="court-wrap">
        <canvas
          #court
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerUp($event)"
        ></canvas>

        @if (message(); as msg) {
          <div class="basket-toast">{{ msg }}</div>
        }

        @if (state() === 'READY') {
          <div class="basket-overlay">
            <span class="overlay-ball">🏀</span>
            <h2>Tre manche al canestro</h2>
            <p>
              Trascina la palla verso il basso e rilascia.<br />
              Manche 1 grande (+2) · Manche 2 media (+3) · Manche 3 piccola (+5).<br />
              Swish senza ferro: un punto in più.
            </p>
            <button class="basket-play" (click)="startGame()">GIOCA 3 MANCHE</button>
          </div>
        }

        @if (state() === 'MANCHE_END') {
          <div class="basket-overlay over">
            <span class="overlay-kicker">MANCHE {{ manche() + 1 }} FINITA</span>
            <div class="final-score">{{ mancheScore() }}</div>
            <p>punti in questa manche · {{ mancheLabel() }}</p>
            <p class="record">
              {{ manche() < mancheCount - 1 ? 'Prossima: ' + MANCHE_LABELS[manche() + 1] : 'Bonus completato' }}
            </p>
          </div>
        }

        @if (state() === 'OVER') {
          <div class="basket-overlay over">
            <span class="overlay-kicker">BONUS COMPLETATO</span>
            <div class="final-score">{{ score() }}</div>
            <p>punti totali · {{ shots() }} tiri</p>
            <div class="manche-breakdown">
              @for (value of mancheScores(); track $index; let i = $index) {
                <div><span>{{ MANCHE_LABELS[i] }}</span><b>{{ value }}</b></div>
              }
            </div>
            <p class="record">Record personale: {{ best() }}</p>
            <button class="basket-play" (click)="startGame()">RIPROVA</button>
          </div>
        }
      </div>

      <footer class="basket-foot">
        <span>Trascina la palla e rilascia per tirare</span>
        <a href="/play">Torna al party</a>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100dvh;
        overflow: hidden;
        background: #0b1220;
        color: #f8fafc;
      }
      * { box-sizing: border-box; }
      .basket-page {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: max(10px, env(safe-area-inset-top)) 12px max(10px, env(safe-area-inset-bottom));
      }
      .basket-head {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .basket-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .brand-ball {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #f97316;
        font-size: 1.35rem;
        box-shadow: 0 0 0 3px rgba(249, 115, 22, .25);
      }
      .basket-brand h1 {
        margin: 0;
        font-size: clamp(1.05rem, 4.4vw, 1.45rem);
        letter-spacing: .04em;
        line-height: 1;
      }
      .basket-brand p {
        margin: 4px 0 0;
        color: #94a3b8;
        font-size: .66rem;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .basket-stats { display: flex; align-items: stretch; gap: 8px; flex: 0 0 auto; }
      .stat {
        min-width: 54px;
        padding: 6px 9px;
        border: 2px solid #334155;
        border-radius: 10px;
        background: #111827;
        text-align: center;
      }
      .stat span {
        display: block;
        color: #94a3b8;
        font-size: .52rem;
        font-weight: 700;
        letter-spacing: .14em;
      }
      .stat b {
        display: block;
        margin-top: 1px;
        font-size: 1.2rem;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .stat.manche b { color: #f97316; font-size: 1rem; }
      .stat.time b { color: #a3e635; }
      .stat.time.hot b { color: #f87171; animation: pulse .7s infinite; }
      @keyframes pulse { 50% { opacity: .4; } }

      .court-wrap {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        border: 3px solid #334155;
        border-radius: 18px;
        background: #0f172a;
        box-shadow: 0 18px 40px rgba(0, 0, 0, .35);
      }
      canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
      canvas:active { cursor: grabbing; }

      .basket-toast {
        position: absolute;
        top: 12%;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 14px;
        border-radius: 999px;
        background: #a3e635;
        color: #1a2e05;
        font-size: .9rem;
        font-weight: 900;
        letter-spacing: .06em;
        white-space: nowrap;
        animation: toastIn .2s ease-out;
      }
      @keyframes toastIn { from { transform: translate(-50%, -8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

      .basket-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 26px;
        text-align: center;
        background: rgba(2, 6, 23, .78);
        backdrop-filter: blur(3px);
      }
      .overlay-ball { font-size: 3.2rem; animation: float 1.4s ease-in-out infinite alternate; }
      @keyframes float { to { transform: translateY(-8px) rotate(-6deg); } }
      .basket-overlay h2 {
        margin: 0;
        font-size: clamp(1.7rem, 8vw, 2.4rem);
        line-height: 1;
        text-transform: uppercase;
      }
      .basket-overlay p {
        max-width: 330px;
        margin: 0;
        color: #cbd5e1;
        font-size: .86rem;
        line-height: 1.45;
      }
      .overlay-kicker { color: #f97316; font-size: .68rem; font-weight: 800; letter-spacing: .2em; }
      .final-score {
        font-size: clamp(4rem, 26vw, 7rem);
        font-weight: 900;
        line-height: .9;
        color: #f97316;
        font-variant-numeric: tabular-nums;
      }
      .record { color: #a3e635 !important; font-weight: 700; }
      .manche-breakdown {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: min(280px, 80vw);
        margin: 6px 0;
      }
      .manche-breakdown div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, .08);
        color: #e2e8f0;
        font-size: .78rem;
        letter-spacing: .06em;
      }
      .manche-breakdown b { color: #f97316; }
      .basket-play {
        margin-top: 8px;
        padding: 14px 26px;
        border: 0;
        border-radius: 14px;
        background: #a3e635;
        color: #1a2e05;
        font-size: 1rem;
        font-weight: 900;
        letter-spacing: .06em;
        box-shadow: 0 5px 0 #4d7c0f;
      }
      .basket-play:active { transform: translateY(3px); box-shadow: 0 2px 0 #4d7c0f; }

      .basket-foot {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #64748b;
        font-size: .66rem;
      }
      .basket-foot a { color: #94a3b8; text-decoration: none; border-bottom: 1px solid #475569; }
    `,
  ],
})
export class BasketBonus implements AfterViewInit, OnDestroy {
  @ViewChild('court') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ws = inject(WebSocketService);

  readonly mancheCount = MANCHE_COUNT;
  readonly MANCHE_LABELS = MANCHE_LABELS;

  readonly score = signal(0);
  readonly mancheScore = signal(0);
  readonly mancheBaskets = signal(0);
  readonly mancheScores = signal<number[]>([0, 0, 0]);
  readonly manche = signal(0);
  readonly shots = signal(0);
  readonly timeLeft = signal(MANCHE_SECONDS);
  readonly state = signal<GameState>('READY');
  readonly best = signal(this.readBest());
  readonly message = signal<string | null>(null);

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private mancheTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTs = 0;
  private physAcc = 0;
  private matter?: any;
  private engine?: any;
  private ballBody?: any;
  private destroyed = false;
  private mancheToken = 0;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private floorY = 0;
  private hoopX = 0;
  private hoopY = 0;
  private rimR = 40;
  private rimScale = RIM_SCALES[0];
  private backX = 0;
  private backTop = 0;
  private backBottom = 0;
  private startX = 0;
  private startY = 0;

  private ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, r: 20 };
  private drag = false;
  private dragX = 0;
  private dragY = 0;
  private shot = false;
  private touchedRim = false;
  private scoredThisShot = false;
  private resetAfter = 0;
  private restTime = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.raf = requestAnimationFrame(this.frame);
    void this.ensureMatter().catch((error) =>
      console.error('Basket: impossibile caricare Matter.js', error),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.stopTimer();
    if (this.mancheTimer) clearTimeout(this.mancheTimer);
    this.resizeObserver?.disconnect();
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.destroyPhysics();
  }

  mancheLabel(index = this.manche()): string {
    return MANCHE_LABELS[index] ?? MANCHE_LABELS[0];
  }

  startGame(): void {
    this.stopTimer();
    if (this.mancheTimer) {
      clearTimeout(this.mancheTimer);
      this.mancheTimer = undefined;
    }

    this.score.set(0);
    this.mancheScore.set(0);
    this.mancheBaskets.set(0);
    this.mancheScores.set([0, 0, 0]);
    this.shots.set(0);
    this.message.set(null);
    void this.startManche(0);
  }

  private async startManche(index: number): Promise<void> {
    this.stopTimer();
    const token = ++this.mancheToken;
    const Matter = await this.ensureMatter().catch(() => null);
    if (this.destroyed || token !== this.mancheToken) return;
    if (!Matter) {
      this.flash('Fisica non disponibile');
      return;
    }

    this.manche.set(index);
    this.mancheScore.set(0);
    this.mancheBaskets.set(0);
    this.timeLeft.set(MANCHE_SECONDS);
    this.state.set('PLAYING');
    this.message.set(null);
    this.rimScale = RIM_SCALES[index] ?? 1;
    this.lastTs = 0;
    this.layout();
    this.createPhysics(Matter);
    this.placeBall();

    this.timer = setInterval(() => {
      const next = this.timeLeft() - 1;
      this.timeLeft.set(Math.max(0, next));
      if (next <= 0) this.endManche();
    }, 1000);

    this.vibrate(20);
  }

  private endManche(): void {
    if (this.state() !== 'PLAYING') return;
    this.stopTimer();

    const gained = this.mancheScore();
    const scores = [...this.mancheScores()];
    scores[this.manche()] = gained;
    this.mancheScores.set(scores);
    this.score.update((value) => value + gained);
    this.state.set('MANCHE_END');
    this.vibrate(60);

    this.mancheTimer = setTimeout(() => {
      if (this.manche() < MANCHE_COUNT - 1) {
        void this.startManche(this.manche() + 1);
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

  /** Ogni canestro aggiorna subito la TV: un pallone e i punti della manche. */
  private sendBasket(points: number): void {
    const playerName = this.resolvePlayerName();
    if (!playerName) return;

    const gameId = Number(localStorage.getItem('activeGameId')) || 1;
    this.ws.subscribeToGame(gameId);
    this.ws.broadcastStatus(gameId, {
      action: 'BONUS_RESULT',
      playerName,
      score: points,
      baskets: 1,
      manche: this.manche() + 1,
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (this.state() !== 'PLAYING' || this.shot) return;

    const point = this.toLocal(event);
    if (Math.hypot(point.x - this.ball.x, point.y - this.ball.y) > this.ball.r * 3.2) return;

    event.preventDefault();
    this.drag = true;
    this.dragX = point.x;
    this.dragY = point.y;
    this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
    this.vibrate(8);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag) return;

    event.preventDefault();
    const point = this.toLocal(event);
    this.dragX = point.x;
    this.dragY = point.y;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drag) return;

    event.preventDefault();
    this.drag = false;

    let vx = (this.ball.x - this.dragX) * LAUNCH_POWER;
    let vy = (this.ball.y - this.dragY) * LAUNCH_POWER;
    const speed = Math.hypot(vx, vy);
    if (speed < 180) return;

    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }

    this.ball.vx = vx;
    this.ball.vy = vy;
    this.shot = true;
    this.scoredThisShot = false;
    this.touchedRim = false;
    this.restTime = 0;
    this.resetAfter = 0;
    this.physAcc = 0;
    this.shots.update((value) => value + 1);
    this.launchBody(vx, vy);
    this.vibrate(20);
  }

  /** La velocità del tiro è in px/s: Matter lavora in px per passo (1/60 s). */
  private launchBody(vx: number, vy: number): void {
    if (!this.matter || !this.ballBody) return;
    this.matter.Body.setVelocity(this.ballBody, { x: vx / 60, y: vy / 60 });
    this.matter.Body.setAngularVelocity(this.ballBody, (vx / 60) * 0.02);
  }

  private frame = (ts: number): void => {
    const dt = this.lastTs > 0 ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (this.state() === 'PLAYING') this.update(dt);
    this.draw();

    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    if (dt <= 0) return;

    if (this.resetAfter > 0) {
      this.resetAfter -= dt;
      if (this.resetAfter <= 0) {
        this.placeBall();
        return;
      }
    }

    const engine = this.engine;
    const body = this.ballBody;
    if (!this.shot || !engine || !body || !this.matter) return;

    const prevY = body.position.y;
    this.physAcc += Math.min(dt, 0.05) * 1000;
    const step = 1000 / 60;
    let steps = 0;
    while (this.physAcc >= step && steps < 4) {
      this.matter.Engine.update(engine, step);
      this.physAcc -= step;
      steps += 1;
    }
    if (steps === 0) return;
    if (steps === 4) this.physAcc = 0;

    this.ball.x = body.position.x;
    this.ball.y = body.position.y;
    this.ball.vx = body.velocity.x * 60;
    this.ball.vy = body.velocity.y * 60;

    // Canestro: la palla attraversa il ferro dall'alto verso il basso.
    if (
      !this.scoredThisShot &&
      prevY < this.hoopY &&
      body.position.y >= this.hoopY &&
      body.velocity.y > 0 &&
      Math.abs(body.position.x - this.hoopX) < this.rimR - this.ball.r * 0.15
    ) {
      const base = MANCHE_POINTS[this.manche()] ?? 2;
      const points = base + (this.touchedRim ? 0 : 1);
      this.mancheScore.update((value) => value + points);
      this.mancheBaskets.update((value) => value + 1);
      this.sendBasket(points);
      this.scoredThisShot = true;
      this.flash(this.touchedRim ? `CANESTRO +${points}` : `SWISH! +${points}`);
      this.vibrate(60);
      this.resetAfter = 1.1;
    }

    const resting = body.position.y >= this.floorY - this.ball.r - 2 && body.speed < 0.6;
    if (resting && !this.scoredThisShot) {
      this.restTime += dt;
      if (this.restTime > 0.6) this.placeBall();
    } else {
      this.restTime = 0;
    }

    if (
      body.position.y > this.h + this.ball.r * 4 ||
      body.position.x < -this.ball.r * 4 ||
      body.position.x > this.w + this.ball.r * 4
    ) {
      this.resetAfter = 0.25;
    }
  }

  private async ensureMatter(): Promise<any> {
    if (!this.matter) {
      const module: any = await import('matter-js');
      this.matter = module.default?.default ?? module.default ?? module;
    }
    return this.matter;
  }

  /** Campo fisico: pavimento, tetto, pareti, tabellone e i due ferri. */
  private createPhysics(Matter: any): void {
    this.destroyPhysics();

    const { Engine, Bodies, Composite, Events } = Matter;
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.y = 1.5;
    engine.gravity.scale = 0.001;
    const world = engine.world;
    const boardHeight = Math.max(10, this.backBottom - this.backTop);

    Composite.add(world, [
      Bodies.rectangle(this.w / 2, this.floorY + 60, this.w * 2, 120, {
        isStatic: true,
        restitution: 0.42,
        friction: 0.9,
        label: 'floor',
      }),
      Bodies.rectangle(this.w / 2, -60, this.w * 2, 120, {
        isStatic: true,
        restitution: 0.3,
        label: 'ceiling',
      }),
      Bodies.rectangle(-30, this.h / 2, 60, this.h * 2, {
        isStatic: true,
        restitution: 0.5,
        label: 'wall-left',
      }),
      Bodies.rectangle(this.w + 30, this.h / 2, 60, this.h * 2, {
        isStatic: true,
        restitution: 0.5,
        label: 'wall-right',
      }),
      Bodies.rectangle(this.backX + 5, (this.backTop + this.backBottom) / 2, 10, boardHeight, {
        isStatic: true,
        restitution: 0.5,
        friction: 0.2,
        label: 'backboard',
      }),
    ]);

    // Ferro in due corpi: il centro resta aperto al passaggio della palla.
    const rimRadius = Math.max(4, this.rimR * 0.12);
    for (const x of [this.hoopX - this.rimR, this.hoopX + this.rimR]) {
      Composite.add(
        world,
        Bodies.circle(x, this.hoopY, rimRadius, {
          isStatic: true,
          restitution: 0.62,
          friction: 0.1,
          label: 'rim',
        }),
      );
    }

    const ball = Bodies.circle(this.startX, this.startY, this.ball.r, {
      label: 'ball',
      restitution: 0.46,
      friction: 0.02,
      frictionAir: 0.002,
      density: 0.002,
    });
    Composite.add(world, ball);

    Events.on(engine, 'collisionStart', (event: any) => {
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('ball') && (labels.includes('rim') || labels.includes('backboard'))) {
          this.touchedRim = true;
        }
      }
    });

    this.engine = engine;
    this.ballBody = ball;
    this.physAcc = 0;
  }

  private destroyPhysics(): void {
    if (!this.engine) return;
    if (this.matter) {
      this.matter.Events.off(this.engine);
      this.matter.Composite.clear(this.engine.world, false, true);
      this.matter.Engine.clear(this.engine);
    }
    this.engine = undefined;
    this.ballBody = undefined;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx || this.w <= 0 || this.h <= 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#f1e4c9');
    bg.addColorStop(0.55, '#e3d2ae');
    bg.addColorStop(1, '#d4bc97');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // Pubblico stilizzato
    for (let i = 0; i < 26; i++) {
      const x = ((i * 73) % 100) / 100 * this.w;
      const y = 18 + ((i * 37) % 60);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,77,46,.22)' : 'rgba(21,21,15,.14)';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pavimento
    ctx.fillStyle = '#b07a45';
    ctx.fillRect(0, this.floorY, this.w, this.h - this.floorY);
    ctx.strokeStyle = 'rgba(21, 21, 15, .18)';
    ctx.lineWidth = 2;
    for (let x = 0; x < this.w; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, this.floorY);
      ctx.lineTo(x, this.h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ff4d2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.floorY);
    ctx.lineTo(this.w, this.floorY);
    ctx.stroke();

    this.drawHoop(ctx);

    if (this.drag && !this.shot) this.drawAim(ctx);

    const b = this.ball;
    const grad = ctx.createRadialGradient(
      b.x - b.r * 0.35,
      b.y - b.r * 0.35,
      b.r * 0.2,
      b.x,
      b.y,
      b.r
    );
    grad.addColorStop(0, '#ff8a6a');
    grad.addColorStop(0.55, '#ff4d2e');
    grad.addColorStop(1, '#b32d16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#15150f';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = '#15150f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.r, b.y);
    ctx.quadraticCurveTo(b.x, b.y - b.r * 0.45, b.x + b.r, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - b.r);
    ctx.quadraticCurveTo(b.x - b.r * 0.45, b.y, b.x, b.y + b.r);
    ctx.stroke();
  }

  private drawHoop(ctx: CanvasRenderingContext2D): void {
    // Palo e base
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = Math.max(4, this.w * 0.012);
    ctx.beginPath();
    ctx.moveTo(this.backX + 4, this.backBottom);
    ctx.lineTo(this.backX + 4, this.floorY);
    ctx.stroke();
    ctx.fillStyle = '#15150f';
    ctx.fillRect(this.backX - 18, this.floorY - 8, 44, 8);

    // Tabellone
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(this.backX, this.backTop, 10, this.backBottom - this.backTop);
    ctx.strokeStyle = '#ff4d2e';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.backX, this.backTop, 10, this.backBottom - this.backTop);

    // Ferro
    ctx.strokeStyle = '#ff4d2e';
    ctx.lineWidth = Math.max(4, this.w * 0.014);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.hoopX - this.rimR, this.hoopY);
    ctx.lineTo(this.hoopX + this.rimR, this.hoopY);
    ctx.stroke();

    // Rete
    const netBottom = this.hoopY + this.rimR * 0.85;
    ctx.strokeStyle = 'rgba(21, 21, 15, .45)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const x = this.hoopX - this.rimR + (this.rimR * 2 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, this.hoopY);
      ctx.lineTo(this.hoopX + (x - this.hoopX) * 0.35, netBottom);
      ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
      const t = j / 3;
      const y = this.hoopY + (netBottom - this.hoopY) * t;
      const half = this.rimR * (1 - t * 0.65);
      ctx.beginPath();
      ctx.moveTo(this.hoopX - half, y);
      ctx.lineTo(this.hoopX + half, y);
      ctx.stroke();
    }

    // Estremità del ferro
    ctx.fillStyle = '#15150f';
    for (const x of [this.hoopX - this.rimR, this.hoopX + this.rimR]) {
      ctx.beginPath();
      ctx.arc(x, this.hoopY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D): void {
    const dx = this.ball.x - this.dragX;
    const dy = this.ball.y - this.dragY;
    const speed = Math.hypot(dx, dy);

    ctx.strokeStyle = 'rgba(255, 77, 46, .55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(this.ball.x, this.ball.y);
    ctx.lineTo(this.dragX, this.dragY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (speed < 10) return;

    let vx = dx * LAUNCH_POWER;
    let vy = dy * LAUNCH_POWER;
    const total = Math.hypot(vx, vy);
    if (total > MAX_SPEED) {
      vx = (vx / total) * MAX_SPEED;
      vy = (vy / total) * MAX_SPEED;
    }

    let x = this.ball.x;
    let y = this.ball.y;
    for (let i = 0; i < 30; i++) {
      vy += GRAVITY * 0.035;
      x += vx * 0.035;
      y += vy * 0.035;
      if (y > this.floorY || x < 0 || x > this.w) break;

      ctx.globalAlpha = Math.max(0.08, 0.55 - i * 0.015);
      ctx.fillStyle = '#ff4d2e';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private toLocal(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private layout(): void {
    this.floorY = this.h - Math.max(46, this.h * 0.075);
    this.hoopX = this.w * 0.72;
    this.hoopY = this.h * 0.33;
    this.rimR = Math.min(this.w * 0.12, 46) * this.rimScale;
    this.ball.r = Math.min(this.w * 0.065, 24);
    this.startX = this.w * 0.24;
    this.startY = this.floorY - this.ball.r - 8;
    this.backX = this.hoopX + this.rimR + 10;
    this.backTop = this.hoopY - this.rimR * 1.9;
    this.backBottom = this.hoopY + this.rimR * 0.45;
  }

  private placeBall(): void {
    this.ball.x = this.startX;
    this.ball.y = this.startY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.shot = false;
    this.touchedRim = false;
    this.scoredThisShot = false;
    this.drag = false;
    this.resetAfter = 0;
    this.restTime = 0;
    this.physAcc = 0;

    if (this.matter && this.ballBody) {
      this.matter.Body.setPosition(this.ballBody, { x: this.startX, y: this.startY });
      this.matter.Body.setVelocity(this.ballBody, { x: 0, y: 0 });
      this.matter.Body.setAngularVelocity(this.ballBody, 0);
      this.matter.Body.setAngle(this.ballBody, 0);
    }
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
    this.layout();

    if (!this.matter || !this.engine) {
      if (!this.shot) this.placeBall();
      return;
    }

    // Il campo è cambiato: si ricostruiscono i corpi statici e si tiene la
    // palla dov'è se un tiro è ancora in volo.
    const position = this.ballBody ? { ...this.ballBody.position } : null;
    const velocity = this.ballBody ? { ...this.ballBody.velocity } : null;
    this.createPhysics(this.matter);
    if (this.shot && position && velocity && this.ballBody) {
      this.matter.Body.setPosition(this.ballBody, position);
      this.matter.Body.setVelocity(this.ballBody, velocity);
    } else {
      this.placeBall();
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private flash(text: string): void {
    this.message.set(text);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.message.set(null), 1100);
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
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }
}
