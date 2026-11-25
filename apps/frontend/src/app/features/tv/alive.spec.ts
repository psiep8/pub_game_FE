import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALIVE_LIMITS,
  ALIVE_SEED,
  AliveRuntime,
  aliveBubbles,
  alivePhase,
} from './alive';

const TEMPLATE = readFileSync('src/app/features/tv/game.component.html', 'utf8');
const CSS = readFileSync('src/app/features/tv/alive.css', 'utf8');

describe('alive — bolle di sfondo', () => {
  it('rispetta il budget: 8–20 bolle, opacità 5–15%, deriva entro 4 px', () => {
    const bubbles = aliveBubbles(ALIVE_SEED);
    expect(bubbles.length).toBeGreaterThanOrEqual(ALIVE_LIMITS.minBubbles);
    expect(bubbles.length).toBeLessThanOrEqual(ALIVE_LIMITS.maxBubbles);
    for (const bubble of bubbles) {
      expect(bubble.opacity).toBeGreaterThanOrEqual(ALIVE_LIMITS.bubbleMinOpacity);
      expect(bubble.opacity).toBeLessThanOrEqual(ALIVE_LIMITS.bubbleMaxOpacity);
      expect(Math.abs(bubble.drift)).toBeLessThanOrEqual(ALIVE_LIMITS.maxShiftPx);
      expect(bubble.duration).toBeGreaterThan(5);
      expect(bubble.style['--alive-duration']).toBe(`${bubble.duration.toFixed(2)}s`);
      expect(bubble.style['--alive-delay']).toBe(`${bubble.delay.toFixed(2)}s`);
    }
  });

  it('le fasi sono stabili: lo stesso seme dà sempre la stessa scena', () => {
    expect(aliveBubbles(7)).toEqual(aliveBubbles(7));
    expect(aliveBubbles(7)).not.toEqual(aliveBubbles(8));
  });

  it('nessuna bolla esce dal bordo destro', () => {
    for (const bubble of aliveBubbles(ALIVE_SEED)) {
      expect(bubble.left).toBeLessThanOrEqual(96);
      expect(bubble.left).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('alive — fasi degli elementi', () => {
  it('respiro 4–7 s, deriva 6–11 s, sempre deterministiche', () => {
    for (const seed of [1, 2, 3, 11]) {
      const breath = alivePhase(seed, 'breath');
      const drift = alivePhase(seed, 'drift');
      const breathSeconds = Number.parseFloat(breath.duration);
      const driftSeconds = Number.parseFloat(drift.duration);
      expect(breathSeconds).toBeGreaterThanOrEqual(ALIVE_LIMITS.breathMinSeconds);
      expect(breathSeconds).toBeLessThanOrEqual(ALIVE_LIMITS.breathMaxSeconds);
      expect(driftSeconds).toBeGreaterThanOrEqual(ALIVE_LIMITS.driftMinSeconds);
      expect(driftSeconds).toBeLessThanOrEqual(ALIVE_LIMITS.driftMaxSeconds);
      // Ritardo negativo: l'elemento è già in movimento, non parte con la scena.
      expect(Number.parseFloat(breath.delay)).toBeLessThanOrEqual(0);
      expect(alivePhase(seed, 'breath')).toEqual(breath);
    }
  });
});

describe('alive — riduzione automatica', () => {
  it('a 60 fps non riduce nulla', () => {
    const runtime = new AliveRuntime();
    let now = 0;
    for (let i = 0; i < 300; i++) {
      now += 16;
      runtime.tick(now);
    }
    expect(runtime.reduced).toBe(false);
    expect(runtime.fps).toBeGreaterThanOrEqual(ALIVE_LIMITS.lowFps);
  });

  it('sotto i 50 fps per tre secondi riduce le bolle', () => {
    const runtime = new AliveRuntime();
    let now = 0;
    for (let i = 0; i < 140; i++) {
      now += 40; // 25 fps
      runtime.tick(now);
    }
    expect(runtime.fps).toBeLessThan(ALIVE_LIMITS.lowFps);
    expect(runtime.reduced).toBe(true);
  });

  it('la riduzione non torna indietro: niente lampeggi a metà serata', () => {
    const runtime = new AliveRuntime();
    let now = 0;
    for (let i = 0; i < 140; i++) {
      now += 40;
      runtime.tick(now);
    }
    expect(runtime.reduced).toBe(true);
    for (let i = 0; i < 200; i++) {
      now += 16;
      runtime.tick(now);
    }
    expect(runtime.reduced).toBe(true);
  });
});

describe('alive — ogni schermata TV ha un elemento vivo', () => {
  it('le bolle sono un livello unico sopra la scena', () => {
    expect(TEMPLATE).toContain('class="alive-bubbles"');
    expect(TEMPLATE).toContain('visibleBubbles()');
  });

  it('lobby, round, categoria, timer, classifica, bonus, pausa e demo hanno il loro livello', () => {
    const screens = [
      'lobby-brand',
      'round-text',
      'question-category',
      'timer-bar',
      'category-slot',
      'auto-advance',
      'recent-item',
      'bonus-card',
      'demo-frame',
      'pause-card',
    ];
    for (const screen of screens) {
      // Il rullo categoria ha una sua animazione: basta che una delle sue
      // versioni (quella ferma) abbia il livello alive.
      const tags = TEMPLATE.match(new RegExp(`class="[^"]*\\b${screen}\\b[^"]*"[^>]*`, 'g')) ?? [];
      expect(tags.length, `${screen} non è nel template`).toBeGreaterThan(0);
      expect(tags.some((tag) => tag.includes('alive=')), `${screen} senza livello alive`).toBe(true);
    }
  });

  it('la pausa rallenta il movimento invece di fermarlo', () => {
    expect(TEMPLATE).toContain('[class.alive-calm]="isPaused()"');
    expect(CSS).toContain('.game-container.alive-calm');
  });

  it('muove solo transform e opacity, e il reduced-motion resta vivo', () => {
    const keyframes = CSS.split('@keyframes').slice(1).join('@keyframes');
    expect(keyframes).not.toContain('filter:');
    expect(keyframes).not.toContain('box-shadow:');
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(CSS).toContain('aliveBreathMin');
    expect(CSS).toContain('aliveDriftMin');
    // Il ridotto non spegne: c'è ancora un'animazione, lunga e minima.
    expect(CSS).toMatch(/aliveBreathMin\s+10s/);
  });
});
