import { vi } from 'vitest';
import { ArenaMode } from './arena.mode';

describe('ArenaMode', () => {
  afterEach(() => vi.useRealTimers());

  it('inizia dopo venti secondi e raggiunge il minimo alla fine', async () => {
    vi.useFakeTimers();
    const mode = new ArenaMode();
    mode.setConfig({ type: 'ARENA', payload: {}, gameId: 1, activePlayers: [] });
    mode.initialize({});
    await mode.start();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(mode.getDisplayData().circleRadius).toBe(100);
    await vi.advanceTimersByTimeAsync(2_000);
    const firstRadius = mode.getDisplayData().circleRadius;
    expect(firstRadius).toBeLessThan(100);
    expect(firstRadius).toBeGreaterThan(99);
    await vi.advanceTimersByTimeAsync(108_000);
    expect(mode.getDisplayData().circleRadius).toBeCloseTo(14 + 86 / 110);
    mode.cleanup();
  });

  it('avanza verso il centro più lentamente e arretra meno dopo un errore', async () => {
    vi.useFakeTimers();
    const mode = new ArenaMode();
    mode.setConfig({ type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'] });
    mode.initialize({});
    await mode.start();

    mode.applyArenaAnswer('Anna', true);
    expect(mode.getDisplayData().teams[0].distance).toBe(25);
    mode.applyArenaAnswer('Anna', false);
    expect(mode.getDisplayData().teams[0].distance).toBe(37);
    mode.cleanup();
  });

  it('spinge fuori chi resta inattivo e azzera il conteggio quando risponde', async () => {
    vi.useFakeTimers();
    const mode = new ArenaMode();
    mode.setConfig({ type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'] });
    mode.initialize({});
    await mode.start();

    const initial = mode.getDisplayData().teams[0].distance;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);

    mode.applyArenaAnswer('Anna', true);
    const afterAnswer = mode.getDisplayData().teams[0].distance;
    expect(afterAnswer).toBe(initial + 12 - 5);

    await vi.advanceTimersByTimeAsync(14_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(afterAnswer);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(afterAnswer + 12);
    mode.cleanup();
  });
});
