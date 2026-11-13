import { vi } from 'vitest';

import { MusicMode } from './music.mode';

function createMode(ticks: number[] = []): MusicMode {
  const mode = new MusicMode();
  mode.setConfig({
    type: 'MUSIC',
    payload: {},
    gameId: 1,
    activePlayers: ['Anna'],
    onTimerTick: (seconds: number) => ticks.push(seconds),
  });
  mode.initialize({
    songTitle: 'Canzone',
    artist: 'Artista',
    previewUrl: 'https://audio.example/brano.mp3',
  });
  return mode;
}

describe('MusicMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('conta trenta secondi per manche, non un unico conto da duecento', async () => {
    vi.useFakeTimers();
    const ticks: number[] = [];
    const mode = createMode(ticks);

    await mode.start();

    expect(mode.timerDuration).toBe(30);
    expect(mode.getTimerValue()).toBe(30);
    expect(ticks.at(-1)).toBe(30);

    await vi.advanceTimersByTimeAsync(3000);
    expect(mode.getTimerValue()).toBe(27);

    mode.cleanup();
  });

  it('paga in proporzione ai secondi rimasti e non scende sotto 250', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    // Con tutta la manche davanti il brano vale il massimo.
    expect(mode.pointsFor(true, 0)).toBe(1000);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mode.pointsFor(true, 15_000)).toBe(500);

    // All'ultimo secondo resta il minimo garantito.
    await vi.advanceTimersByTimeAsync(14_000);
    expect(mode.pointsFor(true, 29_000)).toBe(250);

    expect(mode.pointsFor(false, 15_000)).toBe(-1000);

    mode.cleanup();
  });
});
