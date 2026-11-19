import { describe, expect, it } from 'vitest';

import { countdownVisible, drawCountdown, type CountdownView } from './race-overlay';

/** Tela finta: registra solo le scritture, quel che serve a leggere il timbro. */
function fakeContext() {
  const texts: string[] = [];
  let rects = 0;
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    clip: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    rect: () => undefined,
    stroke: () => undefined,
    fillRect: () => {
      rects += 1;
    },
    strokeRect: () => {
      rects += 1;
    },
    fillText: (text: string) => {
      texts.push(text);
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, rects: () => rects };
}

const view = (overrides: Partial<CountdownView> = {}): CountdownView => ({
  secondsLeft: 0,
  flash: 0,
  raceNumber: 1,
  totalRaces: 2,
  surface: 'NEVE',
  ...overrides,
});

describe('Biglie — conto alla rovescia sulla tela', () => {
  it('senza secondi né flash la tela resta pulita', () => {
    const { ctx, texts, rects } = fakeContext();

    expect(countdownVisible(view())).toBe(false);
    drawCountdown(ctx, 1280, 720, view());

    expect(texts).toEqual([]);
    expect(rects()).toBe(0);
  });

  it('arrotonda per eccesso i secondi e segna «PRONTI»', () => {
    const { ctx, texts } = fakeContext();

    drawCountdown(ctx, 1280, 720, view({ secondsLeft: 2.4, raceNumber: 2 }));

    expect(texts).toContain('PRONTI');
    expect(texts).toContain('3');
    expect(texts).toContain('GARA 2 / 2 · NEVE');
  });

  it('dopo il via mostra il timbro «VIA! · SI PARTE»', () => {
    const { ctx, texts } = fakeContext();

    drawCountdown(ctx, 1280, 720, view({ flash: 0.4 }));

    expect(texts).toContain('SI PARTE');
    expect(texts).toContain('VIA!');
    expect(texts).not.toContain('PRONTI');
  });

  it('il timbro resta dentro la tela anche su uno schermo stretto', () => {
    const { ctx, rects } = fakeContext();

    drawCountdown(ctx, 400, 300, view({ secondsLeft: 1 }));

    expect(rects()).toBeGreaterThan(0);
  });
});
