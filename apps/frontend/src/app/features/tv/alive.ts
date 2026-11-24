/* eslint-disable @angular-eslint/directive-selector */
import { Directive, ElementRef, Input, OnInit } from '@angular/core';

/**
 * Vita continua in TV: un solo sistema di micro-movimento.
 *
 * <p>Tre livelli, con un'unica `@keyframes` per livello in `alive.css`:
 * respiro (scala 1 → 1,012), deriva (±2–4 px) e bolle di sfondo. Le fasi sono
 * casuali ma <b>stabili</b>: si calcolano una volta per elemento, non a ogni
 * render, così non pulsano tutti insieme e la scena non «salta» quando Angular
 * ridisegna.</p>
 *
 * <p>Qui sta anche il budget: sotto i 50 fps per tre secondi il sistema riduce
 * le bolle da solo. Non è un test di prestazioni, è la rete di sicurezza della
 * serata: un PC modesto con dieci squadre non deve perdere il ritmo.</p>
 */

export const ALIVE_LIMITS = {
  /** Ampiezza massima della deriva, in px. */
  maxShiftPx: 4,
  /** Scala massima del respiro (1,5%). */
  maxScale: 1.012,
  /** Elementi animati in contemporanea. */
  maxAnimatedElements: 60,
  /** Bolle: minimo e massimo della scena. */
  minBubbles: 8,
  maxBubbles: 20,
  /** Sotto questa soglia di fotogrammi scatta la riduzione. */
  lowFps: 50,
  /** Per quanto deve restare bassa prima di ridurre. */
  lowFpsSeconds: 3,
  /** Respiro: 4–7 s. */
  breathMinSeconds: 4,
  breathMaxSeconds: 7,
  /** Deriva: 6–11 s. */
  driftMinSeconds: 6,
  driftMaxSeconds: 11,
  /** Opacità delle bolle: 5–15%. */
  bubbleMinOpacity: 0.05,
  bubbleMaxOpacity: 0.15,
} as const;

/** Seme della serata: due TV sulla stessa partita hanno le stesse fasi. */
export const ALIVE_SEED = 0x50b6a1e;

export interface AliveBubble {
  /** Posizione orizzontale in percentuale. */
  left: number;
  /** Diametro in px. */
  size: number;
  /** Salita completa, in secondi. */
  duration: number;
  /** Ritardo negativo: la bolla è già a metà strada al primo fotogramma. */
  delay: number;
  opacity: number;
  /** Derivazione orizzontale durante la salita, in px (mai oltre 4). */
  drift: number;
  /** Stile già pronto per `[ngStyle]`, con le proprietà del livello. */
  style: Record<string, string>;
}

/** PRNG piccolo e deterministico: lo stesso seme dà sempre la stessa scena. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function between(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

/**
 * Bolle della scena. Il numero viene dal seme, dentro i limiti 8–20; ogni bolla
 * ha velocità, fase e ampiezza sue, così non salgono a pacchetti.
 */
export function aliveBubbles(seed = ALIVE_SEED): AliveBubble[] {
  const next = seeded(seed);
  const count =
    ALIVE_LIMITS.minBubbles
    + Math.floor(next() * (ALIVE_LIMITS.maxBubbles - ALIVE_LIMITS.minBubbles + 1));

  return Array.from({ length: count }, () => {
    const size = Math.round(between(next, 10, 46));
    const duration = between(next, 9, 21);
    const opacity = between(next, ALIVE_LIMITS.bubbleMinOpacity, ALIVE_LIMITS.bubbleMaxOpacity);
    const drift = between(next, -ALIVE_LIMITS.maxShiftPx, ALIVE_LIMITS.maxShiftPx);
    const delay = between(next, -duration, -1);
    const left = between(next, 2, 96);
    return {
      left,
      size,
      duration,
      delay,
      opacity,
      drift,
      style: {
        left: `${left.toFixed(2)}%`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: opacity.toFixed(3),
        '--alive-duration': `${duration.toFixed(2)}s`,
        '--alive-delay': `${delay.toFixed(2)}s`,
        '--alive-drift': `${drift.toFixed(2)}px`,
      },
    };
  });
}

/** Fase stabile di un elemento: ritardo e durata calcolati una volta sola. */
export function alivePhase(seed: number, level: 'breath' | 'drift'): {
  duration: string;
  delay: string;
} {
  const next = seeded(seed);
  const [min, max] = level === 'breath'
    ? [ALIVE_LIMITS.breathMinSeconds, ALIVE_LIMITS.breathMaxSeconds]
    : [ALIVE_LIMITS.driftMinSeconds, ALIVE_LIMITS.driftMaxSeconds];
  const duration = between(next, min, max);
  const delay = between(next, -duration, 0);
  return { duration: `${duration.toFixed(2)}s`, delay: `${delay.toFixed(2)}s` };
}

/**
 * Marca un elemento con il suo livello di vita. Fase e durata si calcolano al
 * montaggio e restano: nessuna nuova casualità a ogni render, nessun riavvio
 * dell'animazione quando Angular ridisegna.
 */
@Directive({ selector: '[alive]', standalone: true })
export class AliveDirective implements OnInit {
  @Input({ required: true }) alive!: 'breath' | 'drift';
  @Input() aliveSeed = 0;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const level = this.alive === 'drift' ? 'drift' : 'breath';
    const phase = alivePhase(ALIVE_SEED + this.aliveSeed * 37, level);
    const node = this.el.nativeElement;
    node.style.setProperty('--alive-duration', phase.duration);
    node.style.setProperty('--alive-delay', phase.delay);
    node.style.setProperty('--alive-drift', `${2 + (this.aliveSeed % 3)}px`);
    node.classList.add(level === 'breath' ? 'alive-breath' : 'alive-drift');
  }
}

export interface AliveSample {
  fps: number;
  reduced: boolean;
}

/**
 * Misura i fotogrammi senza disegnare nulla. Un campione al secondo; la
 * riduzione è definitiva per la serata, non un lampeggio.
 */
export class AliveRuntime {
  private lastAt = 0;
  private frames = 0;
  private lowForMs = 0;
  private fpsNow = 60;
  private reducedNow = false;

  get fps(): number {
    return this.fpsNow;
  }

  get reduced(): boolean {
    return this.reducedNow;
  }

  /** Un fotogramma. Torna il campione aggiornato (o quello corrente). */
  tick(now: number): AliveSample {
    if (!this.lastAt) {
      this.lastAt = now;
      return { fps: this.fpsNow, reduced: this.reducedNow };
    }
    const elapsed = now - this.lastAt;
    if (elapsed <= 0) return { fps: this.fpsNow, reduced: this.reducedNow };

    this.frames += 1;
    if (this.frames < 30) {
      // Troppo pochi fotogrammi per un campione stabile: si aspetta.
      if (elapsed < 1000) return { fps: this.fpsNow, reduced: this.reducedNow };
    }
    if (elapsed < 500) return { fps: this.fpsNow, reduced: this.reducedNow };

    this.fpsNow = Math.round((this.frames * 1000) / elapsed);
    this.frames = 0;
    this.lastAt = now;
    if (this.fpsNow < ALIVE_LIMITS.lowFps) {
      this.lowForMs += elapsed;
      if (this.lowForMs >= ALIVE_LIMITS.lowFpsSeconds * 1000) this.reducedNow = true;
    } else {
      this.lowForMs = 0;
    }
    return { fps: this.fpsNow, reduced: this.reducedNow };
  }
}
