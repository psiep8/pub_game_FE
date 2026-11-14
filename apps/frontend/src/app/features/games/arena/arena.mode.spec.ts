import { vi } from 'vitest';
import { ArenaMode } from './arena.mode';

describe('ArenaMode: restringimento', () => {
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
});
