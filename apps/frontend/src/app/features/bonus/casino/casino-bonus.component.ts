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
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Fasi del Casino. Le fasi comuni arrivano da `GamePhase`.
 */
const Phase = {
  INTRO: GamePhase.INTRO,
  PICK: GamePhase.PICK,
  SPIN: 'SPIN',
  RESPIN: 'RESPIN',
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

interface Manche {
  id: 'COLOR' | 'DOZEN' | 'SIXLINE' | 'NUMBER';
  title: string;
  rule: string;
  options: string[];
  seconds: number;
  points: number;
}

interface Pocket {
  number: number;
  fill: string;
  path: string;
  labelX: number;
  labelY: number;
  labelTransform: string;
}

const TAU = Math.PI * 2;
const CX = 300;
const CY = 300;
const OUTER_R = 240;
const INNER_R = 148;
const LABEL_R = 214;
const ORBIT_R = 256;
const POCKET_R = 184;
const SEG = 360 / 37;

/** Ordine reale della ruota europea a zero singolo. */
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function polar(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function pocketFill(number: number): string {
  if (number === 0) return 'url(#pocketGreen)';
  return RED_NUMBERS.has(number) ? 'url(#pocketRed)' : 'url(#pocketBlack)';
}

const POCKETS: Pocket[] = WHEEL_ORDER.map((number, index) => {
  const center = index * SEG;
  const [ox0, oy0] = polar(OUTER_R, center - SEG / 2);
  const [ox1, oy1] = polar(OUTER_R, center + SEG / 2);
  const [ix1, iy1] = polar(INNER_R, center + SEG / 2);
  const [ix0, iy0] = polar(INNER_R, center - SEG / 2);

  const path = [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${OUTER_R} ${OUTER_R} 0 0 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${INNER_R} ${INNER_R} 0 0 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ');

  const [lx, ly] = polar(LABEL_R, center);

  return {
    number,
    fill: pocketFill(number),
    path,
    labelX: lx,
    labelY: ly,
    labelTransform: `rotate(${center.toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)})`,
  };
});

const MANCHES: Manche[] = [
  {
    id: 'COLOR',
    title: 'COLORE',
    rule: 'Rosso o nero: 100 punti.',
    options: ['ROSSO', 'NERO'],
    seconds: 10,
    points: 100,
  },
  {
    id: 'DOZEN',
    title: 'DOZZINA',
    rule: 'Indovina la dozzina: 150 punti.',
    options: ['1-12', '13-24', '25-36'],
    seconds: 12,
    points: 150,
  },
  {
    id: 'SIXLINE',
    title: 'SESTINA',
    rule: 'Indovina la sestina: 200 punti.',
    options: ['1-6', '7-12', '13-18', '19-24', '25-30', '31-36'],
    seconds: 12,
    points: 200,
  },
  {
    id: 'NUMBER',
    title: 'NUMERO SECCO',
    rule: 'Il numero esatto vale 300 punti.',
    options: Array.from({ length: 37 }, (_, index) => String(index)),
    seconds: 15,
    points: 300,
  },
];

const THROW_MS = 2200;
const ORBIT_MS = 6200;
const DROP_MS = 3400;
const BOUNCE_MS = 1200;
const SETTLE_MS = 500;
const ROTOR_MS = THROW_MS + ORBIT_MS + DROP_MS;
const SPIN_MS = ROTOR_MS + BOUNCE_MS + SETTLE_MS;
const REVEAL_MS = 3600;
const BALL_R = 10.5;
/** Raggio di riposo: la pallina sta appena fuori dai separatori dei vani. */
const REST_R = POCKET_R + 6;
const WALL_R = 280;
const DEFLECTOR_R = 222;

const easeOutCubic = (p: number): number => 1 - Math.pow(1 - p, 3);

/**
 * CASINO — bonus di fine atto 1, quattro manche e una roulette vera in TV.
 *
 * Ogni manche si chiude con un giro della ruota europea (37 caselle): la
 * pallina parte sul bordo, orbita, scende, rimbalza sui vani e si ferma.
 *
 * Il numero esce qui, sul componente TV, nell'istante in cui chiudono le
 * puntate: è l'unica fonte di verità per il punteggio. L'animazione non
 * "decide" niente, è calcolata per atterrare esattamente in quel numero, con
 * lancio e rimbalzi diversi a ogni giro. Una simulazione libera avrebbe potuto
 * fermare la pallina in una casella diversa da quella pagata.
 *
 * La ruota si ferma su un angolo casuale: il vano vincente può cadere in
 * qualunque punto del cerchio, non sempre in alto. L'ultimo tratto è volutamente
 * lento — discesa che striscia e rimbalzi smorzati — per tenere il bar col fiato
 * sospeso fino all'ultimo istante.
 */
@Component({
  selector: 'app-casino-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="casino-overlay">
      <div class="casino-card">
        <header class="casino-head">
          <div>
            <div class="casino-kicker">🎰 CASINO · BONUS DI FINE ATTO</div>
            <h1>{{ title() }}</h1>
            <p class="casino-rule">{{ rule() }}</p>
          </div>
          @if (secondsLeft() > 0) {
            <div class="casino-timer">{{ secondsLeft() }}s</div>
          }
        </header>

        <div class="casino-manches">
          @for (item of manches; track item.id; let i = $index) {
            <div class="casino-manche" [class.on]="manche() === i + 1" [class.done]="manche() > i + 1">
              <span>{{ item.title }}</span>
              <b>{{ item.points }}</b>
            </div>
          }
        </div>

        <div class="casino-stage">
          <div class="casino-wheel-wrap">
            <svg class="casino-wheel" viewBox="0 0 600 600" role="img" aria-label="Roulette">
              <defs>
                <radialGradient id="casinoRim" cx="50%" cy="30%" r="76%">
                  <stop offset="0%" stop-color="#9a6631" />
                  <stop offset="30%" stop-color="#6f4623" />
                  <stop offset="62%" stop-color="#432814" />
                  <stop offset="100%" stop-color="#150c05" />
                </radialGradient>
                <linearGradient id="casinoSteel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#e2e8f0" />
                  <stop offset="30%" stop-color="#94a3b8" />
                  <stop offset="52%" stop-color="#f8fafc" />
                  <stop offset="74%" stop-color="#64748b" />
                  <stop offset="100%" stop-color="#cbd5e1" />
                </linearGradient>
                <linearGradient id="pocketRed" x1="0" y1="0" x2="0.35" y2="1">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="45%" stop-color="#b91c1c" />
                  <stop offset="100%" stop-color="#671414" />
                </linearGradient>
                <linearGradient id="pocketBlack" x1="0" y1="0" x2="0.35" y2="1">
                  <stop offset="0%" stop-color="#475569" />
                  <stop offset="45%" stop-color="#232c38" />
                  <stop offset="100%" stop-color="#0f141c" />
                </linearGradient>
                <linearGradient id="pocketGreen" x1="0" y1="0" x2="0.35" y2="1">
                  <stop offset="0%" stop-color="#22c55e" />
                  <stop offset="50%" stop-color="#15803d" />
                  <stop offset="100%" stop-color="#14532d" />
                </linearGradient>
                <radialGradient id="innerCone" cx="50%" cy="46%" r="55%">
                  <stop offset="0%" stop-color="#0b1020" />
                  <stop offset="55%" stop-color="#182233" />
                  <stop offset="100%" stop-color="#3b4a5f" />
                </radialGradient>
                <radialGradient id="casinoHub" cx="50%" cy="34%" r="72%">
                  <stop offset="0%" stop-color="#4b5b70" />
                  <stop offset="55%" stop-color="#1c2634" />
                  <stop offset="100%" stop-color="#0b1020" />
                </radialGradient>
                <radialGradient id="ballPaint" cx="34%" cy="28%" r="72%">
                  <stop offset="0%" stop-color="#ffffff" />
                  <stop offset="55%" stop-color="#f1f5f9" />
                  <stop offset="100%" stop-color="#8b9bb4" />
                </radialGradient>
              </defs>

              <circle cx="300" cy="300" r="300" fill="#071019" />
              <circle cx="300" cy="300" r="292" fill="url(#casinoRim)" />
              <circle cx="300" cy="300" r="286" fill="none" stroke="#2a1708" stroke-width="3" opacity=".7" />
              <circle cx="300" cy="300" r="278" fill="none" stroke="#d6a25c" stroke-width="1.5" opacity=".35" />

              <circle cx="300" cy="300" r="264" fill="#0b0f19" />
              <circle cx="300" cy="300" r="255" fill="none" stroke="url(#casinoSteel)" stroke-width="18" opacity=".32" />
              <circle cx="300" cy="300" r="264" fill="none" stroke="#060a10" stroke-width="3" />
              <circle cx="300" cy="300" r="246" fill="none" stroke="#060a10" stroke-width="3" />

              <g [attr.transform]="rotorTransform()">
                @for (pocket of pockets; track pocket.number) {
                  <path
                    [attr.d]="pocket.path"
                    [attr.fill]="pocket.fill"
                    [class.pocket-win]="settled() && pocket.number === spinNumber()"
                    stroke="url(#casinoSteel)"
                    stroke-width="1" />
                  <text
                    class="pocket-label"
                    [attr.x]="pocket.labelX"
                    [attr.y]="pocket.labelY"
                    [attr.transform]="pocket.labelTransform">{{ pocket.number }}</text>
                }
              </g>

              <circle cx="300" cy="300" r="148" fill="url(#innerCone)" />
              <circle cx="300" cy="300" r="148" fill="none" stroke="#0a0f18" stroke-width="5" />

              <circle cx="300" cy="300" r="112" fill="url(#casinoHub)" stroke="url(#casinoSteel)" stroke-width="4" />
              <circle cx="300" cy="300" r="94" fill="none" stroke="#fbbf24" stroke-width="2" opacity=".75" />
              <path d="M292 218 h16 v74 h74 v16 h-74 v74 h-16 v-74 h-74 v-16 h74 z" fill="url(#casinoSteel)" opacity=".9" />
              <circle cx="300" cy="300" r="62" fill="#0b1020" stroke="url(#casinoSteel)" stroke-width="3" />
              <circle cx="300" cy="300" r="26" fill="url(#casinoSteel)" stroke="#0b1020" stroke-width="2" />
              <circle cx="300" cy="300" r="9" fill="#fbbf24" />

              <polygon points="282,10 318,10 300,52" fill="url(#casinoSteel)" stroke="#8a6a1f" stroke-width="2" />
              <polygon points="292,16 308,16 300,40" fill="#fbbf24" opacity=".9" />

              <circle
                [attr.cx]="ballX() + 3"
                [attr.cy]="ballY() + 4"
                [attr.r]="ballSize()"
                fill="rgba(21, 21, 15, .38)" />
              <circle
                [attr.cx]="ballX()"
                [attr.cy]="ballY()"
                [attr.r]="ballSize()"
                fill="url(#ballPaint)"
                stroke="#64748b"
                stroke-width="1" />
            </svg>
          </div>

          <div class="casino-panel">
            @switch (phase()) {
              @case (Phase.INTRO) {
                <div class="casino-intro">
                  <span class="casino-dice">🎲</span>
                  <p>Quattro puntate, difficoltà crescente. Ogni manche si chiude con un giro di roulette: più stretta è la casella, più punti vale.</p>
                </div>
              }

              @case (Phase.PICK) {
                <div class="casino-grid" [class.numbers]="manche() === 4">
                  @for (option of options(); track option) {
                    <div class="casino-cell" [class.picked]="votesFor(option) > 0">
                      <span>{{ option }}</span>
                      @if (votesFor(option) > 0) {
                        <b>{{ votesFor(option) }}</b>
                      }
                    </div>
                  }
                </div>
                <p class="casino-hint">Scegli una casella sul telefono. Chi non sceglie resta a zero.</p>
              }

              @case (Phase.SPIN) {
                <div class="casino-spin">
                  <span class="casino-ball-icon">⚪</span>
                  <p>{{ slowMotion() ? 'Dove si ferma?' : 'Pallina in giro...' }}</p>
                  <span class="casino-hint">{{ slowMotion() ? 'La pallina sta cercando il vano...' : 'Puntate chiuse per la manche ' + manche() }}.</span>
                </div>
              }

              @case (Phase.RESPIN) {
                <div class="casino-spin">
                  <span class="casino-ball-icon">🎯</span>
                  <p>Nessun tavolo sul {{ spinNumber() }}</p>
                  <span class="casino-hint">Si rigira: la manche deve trovare un vincitore.</span>
                </div>
              }

              @case (Phase.REVEAL) {
                <div class="casino-win">
                  <span class="casino-win-label">ESCE</span>
                  <b class="casino-win-value" [class.number]="manche() === 4">{{ spinNumber() }}</b>
                  <span class="casino-win-cell">{{ winner() }}</span>
                </div>
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
                        <p class="casino-hint">Nessun tavolo in questa manche.</p>
                      }
                    </div>
                  </div>
                }
              }

              @case (Phase.FINALE) {
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
      width: min(1500px, 97vw);
      max-height: 95vh;
      overflow: auto;
      padding: clamp(16px, 2.2vw, 30px);
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
      margin-bottom: 12px;
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
      font-size: clamp(1.4rem, 2.6vw, 2.3rem);
      line-height: 1;
      text-transform: uppercase;
    }
    .casino-rule { margin: 0; color: #94a3b8; font-size: clamp(.78rem, 1.05vw, .98rem); }
    .casino-timer {
      flex: 0 0 auto;
      padding: 9px 16px;
      border: 2px solid #fbbf24;
      border-radius: 14px;
      background: rgba(251, 191, 36, .12);
      color: #fbbf24;
      font-family: var(--font-mono, monospace);
      font-size: clamp(1.3rem, 2.2vw, 2rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .casino-manches {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .casino-manche {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      color: #64748b;
      font-family: var(--font-mono, monospace);
      font-size: clamp(.58rem, .82vw, .74rem);
      letter-spacing: .08em;
    }
    .casino-manche.done { color: #94a3b8; }
    .casino-manche.on { border-color: #fbbf24; background: rgba(251, 191, 36, .14); color: #fbbf24; }
    .casino-manche b { font-size: 1.05em; }
    .casino-stage {
      display: grid;
      grid-template-columns: minmax(320px, 1.05fr) minmax(300px, .95fr);
      gap: clamp(16px, 2.2vw, 34px);
      align-items: start;
    }
    .casino-wheel-wrap { display: grid; place-items: center; }
    .casino-wheel {
      width: min(100%, 56vh);
      height: auto;
      filter: drop-shadow(0 18px 40px rgba(0, 0, 0, .6));
    }
    .pocket-label {
      fill: #fff8e8;
      stroke: #15150f;
      stroke-width: 1.4px;
      paint-order: stroke fill;
      font-family: var(--font-mono, monospace);
      font-size: 15.5px;
      font-weight: 800;
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .pocket-win { stroke: #ff4d2e; stroke-width: 5; }
    .casino-panel { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .casino-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(clamp(84px, 8vw, 120px), 1fr));
      gap: clamp(8px, 1vw, 14px);
    }
    .casino-grid.numbers { grid-template-columns: repeat(auto-fit, minmax(clamp(46px, 4.4vw, 66px), 1fr)); gap: 6px; }
    .casino-cell {
      position: relative;
      display: grid;
      place-items: center;
      min-height: clamp(58px, 8vh, 96px);
      padding: 8px;
      border: 2px solid #334155;
      border-radius: 14px;
      background: #0f172a;
      font-family: var(--font-mono, monospace);
      font-size: clamp(1rem, 1.9vw, 1.7rem);
      font-weight: 800;
      letter-spacing: .04em;
    }
    .casino-grid.numbers .casino-cell {
      min-height: clamp(34px, 4.4vh, 48px);
      font-size: clamp(.8rem, 1.15vw, 1rem);
    }
    .casino-cell.picked { border-color: #fbbf24; background: rgba(251, 191, 36, .16); color: #fbbf24; }
    .casino-cell b {
      position: absolute;
      top: -7px;
      right: -7px;
      display: grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      background: #fbbf24;
      color: #111827;
      font-size: .62rem;
    }
    .casino-hint { margin: 0; color: #94a3b8; font-size: clamp(.72rem, .95vw, .9rem); text-align: center; }
    .casino-intro { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 8px; color: #cbd5e1; text-align: center; }
    .casino-dice { font-size: 3.4rem; animation: casinoFloat 1.4s ease-in-out infinite alternate; }
    @keyframes casinoFloat { to { transform: translateY(-8px) rotate(-8deg); } }
    .casino-spin { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 8px; color: #cbd5e1; }
    .casino-spin p { margin: 0; font-family: var(--font-mono, monospace); letter-spacing: .14em; text-transform: uppercase; }
    .casino-ball-icon { font-size: 2.6rem; animation: casinoOrbit 1.1s linear infinite; }
    @keyframes casinoOrbit { to { transform: rotate(360deg); } }
    .casino-win {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 12px;
      border: 2px solid rgba(251, 191, 36, .35);
      border-radius: 16px;
      background: rgba(251, 191, 36, .08);
    }
    .casino-win-label { color: #94a3b8; font-family: var(--font-mono, monospace); font-size: .66rem; letter-spacing: .2em; }
    .casino-win-value { font-family: var(--font-display, inherit); font-size: clamp(2.4rem, 5vw, 4.4rem); line-height: 1; }
    .casino-win-value.number { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-win-cell { color: #fbbf24; font-family: var(--font-mono, monospace); font-size: clamp(.9rem, 1.3vw, 1.15rem); letter-spacing: .1em; }
    .casino-reveal { margin-top: 10px; }
    .casino-reveal-head {
      margin-bottom: 8px;
      color: #a3e635;
      font-family: var(--font-mono, monospace);
      font-size: clamp(.68rem, .95vw, .86rem);
      font-weight: 700;
      letter-spacing: .1em;
      text-align: center;
    }
    .casino-rows { display: flex; flex-direction: column; gap: 5px; }
    .casino-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 7px 12px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      font-size: clamp(.72rem, .95vw, .9rem);
    }
    .casino-row.win { border-color: #a3e635; background: rgba(163, 230, 53, .1); }
    .casino-row-label { color: #94a3b8; font-family: var(--font-mono, monospace); }
    .casino-row b { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-totals {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
      padding-top: 10px;
      border-top: 1px solid #1e293b;
    }
    .casino-total {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 11px;
      border-radius: 999px;
      background: #0f172a;
      border: 1px solid #334155;
      font-size: .78rem;
    }
    .casino-total b { color: #fbbf24; font-family: var(--font-mono, monospace); }
    .casino-finale { display: flex; flex-direction: column; gap: 7px; }
    .casino-finale-kicker { color: #fbbf24; font-family: var(--font-mono, monospace); font-size: .7rem; letter-spacing: .2em; text-align: center; }
    .casino-finale-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 9px 14px;
      border: 1px solid #334155;
      border-radius: 10px;
      background: #0f172a;
      font-size: clamp(.82rem, 1.15vw, 1.05rem);
    }
    .casino-finale-row.top { border-color: #fbbf24; background: rgba(251, 191, 36, .12); }
    .casino-finale-row b { color: #fbbf24; font-family: var(--font-mono, monospace); }
  `],
})
export class CasinoBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  /** Banco di prova: manche da 2 secondi, voti demo e reveal accorciato. */
  @Input() preview = false;
  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();

  private ws = inject(WebSocketService);
  private audio = inject(AudioService);
  private destroyRef = inject(DestroyRef);

  readonly manches = MANCHES;
  readonly pockets = POCKETS;
  readonly phase = signal<Phase>(Phase.INTRO);

  /** Fasi del gioco, disponibili anche nel template. */
  readonly Phase = Phase;
  readonly manche = signal(0);
  readonly title = signal('CASINO');
  readonly rule = signal('Quattro puntate a difficoltà crescente.');
  readonly secondsLeft = signal(0);
  readonly options = signal<string[]>([]);
  readonly winner = signal<string | null>(null);
  readonly reveal = signal<Reveal | null>(null);
  readonly totals = signal<Array<{ playerName: string; score: number }>>([]);
  readonly votesView = signal<Array<{ playerName: string; choice: string }>>([]);

  readonly rotorAngle = signal(0);
  readonly ballX = signal(CX);
  readonly ballY = signal(CY - REST_R);
  readonly ballSize = signal(BALL_R);
  readonly settled = signal(false);
  readonly slowMotion = signal(false);
  readonly spinNumber = signal<number | null>(null);

  readonly rotorTransform = computed(
    () => `rotate(${this.rotorAngle().toFixed(2)} ${CX} ${CY})`,
  );

  private matter?: any;
  private engine?: any;
  private ballBody?: any;
  /** Angolo della pallina nel sistema della ruota: da qui riparte il giro dopo. */
  private ballLocalAngle = 0;

  private readonly votes = new Map<string, string>();
  private readonly scoreMap = new Map<string, number>();
  private clock?: ReturnType<typeof setInterval>;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private voteEnd: (() => void) | null = null;
  private voteClosed = true;
  private frame?: number;
  private destroyed = false;

  ngOnInit(): void {
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      this.onStatus(status);
    });
    this.later(this.preview ? 300 : 2500, () => this.startManche(0));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearClock();
    this.destroyPhysics();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  votesFor(choice: string): number {
    return this.votesView().filter((vote) => vote.choice === choice).length;
  }

  private onStatus(status: any): void {
    if (status?.action !== 'CASINO_ACTION') return;
    if (this.phase() !== Phase.PICK) return;

    const playerName = String(status.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (Number(status.manche) !== this.manche()) return;

    const choice = String(status.choice ?? '').trim();
    if (!this.options().includes(choice)) return;
    if (this.votes.has(playerName)) return;

    this.votes.set(playerName, choice);
    this.publish();
    this.finishVoteEarly();
  }

  private startManche(index: number): void {
    if (index >= MANCHES.length) {
      this.finale();
      return;
    }

    const manche = MANCHES[index];
    this.manche.set(index + 1);
    this.title.set(manche.title);
    this.rule.set(manche.rule);
    this.options.set([...manche.options]);
    this.winner.set(null);
    this.reveal.set(null);
    this.settled.set(false);
    this.spinNumber.set(null);
    this.beginVote(Phase.PICK, this.preview ? 2 : manche.seconds, () => {
      void this.spinManche();
    });
  }

  /**
   * Il numero esce qui: è il valore che paga, non quello che l'animazione
   * "trova". Sul numero secco la manche deve avere almeno un vincitore:
   * finché nessun tavolo ha puntato il numero uscito, la ruota rigira.
   */
  private async spinManche(): Promise<void> {
    if (this.destroyed) return;

    const manche = MANCHES[this.manche() - 1];
    const chosen = new Set([...this.votes.values()]);
    const mustWin = !this.preview && manche.id === 'NUMBER' && chosen.size > 0;
    const labels = [...chosen];

    let number = Math.floor(Math.random() * 37);
    let attempts = 0;

    while (true) {
      await this.spinOnce(number, manche);
      if (this.destroyed) return;

      if (!mustWin || chosen.has(String(number))) break;

      attempts += 1;
      this.phase.set(Phase.RESPIN);
      this.rule.set(`Esce ${number}: nessun tavolo lo ha puntato. Si rigira.`);
      this.publish();
      await this.pause(1600);
      if (this.destroyed) return;

      // Dopo quindici giri senza fortuna si punta su un numero sicuramente
      // giocato: la regola che almeno un tavolo vinca resta garantita.
      number = attempts >= 15
        ? Number(labels[Math.floor(Math.random() * labels.length)])
        : Math.floor(Math.random() * 37);
    }

    this.showReveal(number);
  }

  private async spinOnce(number: number, manche: Manche): Promise<void> {
    this.title.set(manche.title);
    this.rule.set(manche.rule);
    this.spinNumber.set(number);
    this.phase.set(Phase.SPIN);
    this.secondsLeft.set(0);
    this.publish();
    this.audio.playRouletteTicks(SPIN_MS);
    await this.animateWheel(number);
    this.audio.playRouletteLanding();
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.push(setTimeout(resolve, ms));
    });
  }

  /**
   * Giro fisico: la pallina vive in un mondo Matter nel sistema della ruota
   * (muro, deflettori e separatori dei vani sono corpi statici) e in scena
   * viene disegnata ruotata dell'angolo del rotore. Una guida morbida la
   * accompagna verso il vano pagato, ma urti e rimbalzi sono del motore.
   */
  private async animateWheel(number: number): Promise<void> {
    const Matter = await this.ensureMatter();
    if (this.destroyed) return;

    const targetIndex = WHEEL_ORDER.indexOf(number);
    const targetLocal = (targetIndex * SEG * Math.PI) / 180;
    const startLocal = this.ballLocalAngle;
    const rotorStart = this.rotorAngle();
    // Angolo finale libero: il vano vincente non deve per forza finire in alto.
    const rotorFinal = rotorStart + (4 + Math.random()) * 360;

    // Giri nel sistema della ruota: somma il giro del tavolo e quello visto dal
    // pubblico, in senso antiorario.
    const localTurns = 7.2 + Math.random() * 1.0;
    let endLocal = targetLocal;
    while (endLocal > startLocal - localTurns * TAU) endLocal -= TAU;
    const delta = endLocal - startLocal;

    const engine = this.createWheelPhysics(Matter, startLocal);
    const body = this.ballBody;
    if (!body) return;

    const t1 = THROW_MS;
    const t2 = t1 + ORBIT_MS;
    const t3 = t2 + DROP_MS;
    const stepMs = 1000 / 60;

    // Raggio guidato: uscita sul bordo, orbita, poi discesa nel vano.
    const guide = (t: number): number => {
      if (t <= t1) return REST_R + (ORBIT_R - REST_R) * easeOutCubic(t / t1);
      if (t <= t2) return ORBIT_R;
      if (t <= t3) {
        const p = (t - t2) / DROP_MS;
        const base = ORBIT_R + (REST_R - ORBIT_R) * p * p;
        // Rimbalzi sui rombi: la discesa non è una linea liscia.
        const bounce = Math.sin(p * Math.PI * 5) * (1 - p) * 16;
        return base + bounce;
      }
      return REST_R;
    };

    // Frenata morbida: parte decisa e si spegne sul vano, senza inchiodare.
    const plan = (t: number): number => {
      const p = Math.min(1, t / ROTOR_MS);
      return startLocal + delta * (1 - Math.pow(1 - p, 1.7));
    };

    this.settled.set(false);
    this.slowMotion.set(false);

    await new Promise<void>((resolve) => {
      let sim = 0;
      let acc = 0;
      let last = performance.now();

      const sync = (): void => {
        const rad = (this.rotorAngle() * Math.PI) / 180;
        const dx = body.position.x - CX;
        const dy = body.position.y - CY;
        this.ballX.set(CX + dx * Math.cos(rad) - dy * Math.sin(rad));
        this.ballY.set(CY + dx * Math.sin(rad) + dy * Math.cos(rad));
      };

      const step = (now: number): void => {
        if (this.destroyed) {
          resolve();
          return;
        }

        acc += Math.min(80, now - last);
        last = now;

        let ran = 0;
        while (acc >= stepMs && sim < SPIN_MS && ran < 6) {
          sim = Math.min(SPIN_MS, sim + stepMs);
          acc -= stepMs;
          ran += 1;

          this.rotorAngle.set(
            rotorStart + (rotorFinal - rotorStart) * easeOutCubic(Math.min(1, sim / ROTOR_MS)),
          );

          // Velocità del piano + richiamo sull'errore: la traiettoria resta
          // precisa anche dopo un urto, che quindi si vede e si recupera.
          const angleNow = plan(sim);
          const radiusNow = guide(sim);
          const nextAngle = plan(sim + stepMs);
          const nextRadius = guide(sim + stepMs);
          const x0 = CX + radiusNow * Math.sin(angleNow);
          const y0 = CY - radiusNow * Math.cos(angleNow);
          const x1 = CX + nextRadius * Math.sin(nextAngle);
          const y1 = CY - nextRadius * Math.cos(nextAngle);

          const gain = sim > ROTOR_MS ? 0.22 : 0.11;
          let vx = (x1 - x0) / stepMs + (x0 - body.position.x) * gain;
          let vy = (y1 - y0) / stepMs + (y0 - body.position.y) * gain;
          const speed = Math.hypot(vx, vy);
          if (speed > 96) {
            vx = (vx / speed) * 96;
            vy = (vy / speed) * 96;
          }

          const blend = sim > ROTOR_MS ? 0.3 : 0.2;
          Matter.Body.setVelocity(body, {
            x: body.velocity.x + (vx - body.velocity.x) * blend,
            y: body.velocity.y + (vy - body.velocity.y) * blend,
          });

          Matter.Engine.update(engine, stepMs);

          // Limite duro del tavolo: la pallina non esce né finisce nel cono.
          const dx = body.position.x - CX;
          const dy = body.position.y - CY;
          const radius = Math.hypot(dx, dy) || 1;
          if (radius > WALL_R - BALL_R - 1.5) {
            const max = WALL_R - BALL_R - 1.5;
            Matter.Body.setPosition(body, {
              x: CX + (dx / radius) * max,
              y: CY + (dy / radius) * max,
            });
          } else if (radius < REST_R - 1) {
            Matter.Body.setPosition(body, {
              x: CX + (dx / radius) * (REST_R - 1),
              y: CY + (dy / radius) * (REST_R - 1),
            });
          }

          const slow = sim >= t2;
          if (this.slowMotion() !== slow) this.slowMotion.set(slow);
        }

        if (sim < SPIN_MS) {
          sync();
          this.frame = requestAnimationFrame(step);
          return;
        }

        Matter.Body.setPosition(body, {
          x: CX + REST_R * Math.sin(targetLocal),
          y: CY - REST_R * Math.cos(targetLocal),
        });
        this.ballLocalAngle = targetLocal;
        this.rotorAngle.set(rotorFinal);
        sync();
        this.slowMotion.set(false);
        this.settled.set(true);
        resolve();
      };

      this.frame = requestAnimationFrame(step);
    });
  }

  private async ensureMatter(): Promise<any> {
    if (!this.matter) {
      const module: any = await import('matter-js');
      this.matter = module.default?.default ?? module.default ?? module;
    }
    return this.matter;
  }

  /** Pista fisica nel sistema della ruota: muro, deflettori e separator di vano. */
  private createWheelPhysics(Matter: any, localAngle: number): any {
    this.destroyPhysics();

    const { Engine, Bodies, Composite } = Matter;
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;
    const world = engine.world;

    const ring = (radius: number, thickness: number, segments: number, restitution: number): void => {
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * TAU;
        const a1 = ((i + 1) / segments) * TAU;
        const x0 = CX + radius * Math.sin(a0);
        const y0 = CY - radius * Math.cos(a0);
        const x1 = CX + radius * Math.sin(a1);
        const y1 = CY - radius * Math.cos(a1);
        Composite.add(
          world,
          Bodies.rectangle(
            (x0 + x1) / 2,
            (y0 + y1) / 2,
            Math.hypot(x1 - x0, y1 - y0) + thickness,
            thickness,
            {
              isStatic: true,
              angle: Math.atan2(y1 - y0, x1 - x0),
              restitution,
            },
          ),
        );
      }
    };

    ring(WALL_R, 10, 56, 0.34);
    ring(INNER_R + 2, 8, 40, 0.3);

    // Separatori dei 37 vani: la pallina ci sbatte e si incastra nel vano.
    for (let i = 0; i < 37; i++) {
      const angle = ((i + 0.5) * SEG * Math.PI) / 180;
      Composite.add(
        world,
        Bodies.circle(
          CX + POCKET_R * Math.sin(angle),
          CY - POCKET_R * Math.cos(angle),
          4,
          { isStatic: true, restitution: 0.3 },
        ),
      );
    }

    // Deflettori della pista: deviano la pallina durante la discesa.
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU + 0.18;
      Composite.add(
        world,
        Bodies.circle(
          CX + DEFLECTOR_R * Math.sin(angle),
          CY - DEFLECTOR_R * Math.cos(angle),
          6,
          { isStatic: true, restitution: 0.46 },
        ),
      );
    }

    const ball = Bodies.circle(
      CX + REST_R * Math.sin(localAngle),
      CY - REST_R * Math.cos(localAngle),
      BALL_R,
      { friction: 0.002, frictionAir: 0, restitution: 0.38, density: 0.004 },
    );
    Composite.add(world, ball);

    this.engine = engine;
    this.ballBody = ball;
    return engine;
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

  private showReveal(number: number): void {
    const manche = MANCHES[this.manche() - 1];
    const winner = this.labelFor(manche.id, number);
    this.winner.set(winner);
    this.phase.set(Phase.REVEAL);

    const rows: Row[] = this.players.map((playerName) => {
      const pick = this.votes.get(playerName) ?? '';
      const points = pick === winner ? manche.points : 0;
      if (points) this.addPoints(playerName, points);
      return { playerName, label: pick || '—', points };
    });

    this.reveal.set({ heading: `MANCHE ${this.manche()} · ESCE ${number} · ${winner}`, rows });
    this.publish();
    this.emitRows(rows);
    this.later(this.preview ? 1500 : REVEAL_MS, () => this.startManche(this.manche()));
  }

  private labelFor(manche: Manche['id'], number: number): string {
    if (manche === 'NUMBER') return String(number);
    if (number === 0) return 'BANCO';

    if (manche === 'COLOR') return RED_NUMBERS.has(number) ? 'ROSSO' : 'NERO';

    if (manche === 'DOZEN') {
      const start = Math.floor((number - 1) / 12) * 12 + 1;
      return `${start}-${start + 11}`;
    }

    const start = Math.floor((number - 1) / 6) * 6 + 1;
    return `${start}-${start + 5}`;
  }

  private finale(): void {
    this.phase.set(Phase.FINALE);
    this.title.set('CASINO');
    this.rule.set('Quattro manche chiuse: classifica del bonus.');
    this.secondsLeft.set(0);
    this.publish();
    this.later(this.preview ? 4000 : 7000, () => this.finished.emit());
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
    if (this.preview) this.seedPreviewVotes(seconds);

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

  /** Nel banco di prova i voti arrivano da soli: la ruota deve girare subito. */
  private seedPreviewVotes(seconds: number): void {
    if (!this.players.length) return;
    this.later(Math.min(800, seconds * 350), () => {
      if (this.voteClosed || this.phase() !== Phase.PICK) return;
      const options = this.options();
      if (!options.length) return;
      for (const playerName of this.players) {
        if (!this.votes.has(playerName)) {
          this.votes.set(playerName, options[Math.floor(Math.random() * options.length)]);
        }
      }
      this.publish();
    });
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

    const phase = this.phase();
    const shown = phase === Phase.REVEAL || phase === Phase.RESPIN || phase === Phase.FINALE;

    this.ws.broadcastStatus(this.gameId, {
      action: 'CASINO_STATE',
      state: {
        phase: this.phase(),
        manche: this.manche(),
        totalManches: MANCHES.length,
        title: this.title(),
        rule: this.rule(),
        secondsLeft: this.secondsLeft(),
        options: this.options(),
        votes: this.votesView(),
        number: shown ? this.spinNumber() : null,
        winner: phase === Phase.REVEAL || phase === Phase.FINALE ? this.winner() : null,
        reveal: this.reveal(),
        scores: this.totals(),
      },
    });
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

  private later(ms: number, action: () => void): void {
    this.timers.push(setTimeout(action, ms));
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }
}
