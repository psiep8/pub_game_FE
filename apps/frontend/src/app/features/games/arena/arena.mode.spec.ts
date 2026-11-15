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

  it('applica solo le penalità di inattività decise dal server', async () => {
    vi.useFakeTimers();
    let checks = 0;
    const seenPlayers: string[][] = [];
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      onArenaInactivityCheck: async (players) => {
        seenPlayers.push(players);
        checks++;
        return checks < 3 ? [] : [{ playerName: 'Anna', count: 1 }];
      },
    });
    mode.initialize({});
    await mode.start();

    const initial = mode.getDisplayData().teams[0].distance;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);
    expect(seenPlayers[0]).toEqual(['Anna', 'Bruno']);

    mode.pause();
    const whilePaused = checks;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(checks).toBeGreaterThan(whilePaused);
    mode.resume();
    mode.cleanup();
  });

  it('non inventa penalità se il server non risponde', async () => {
    vi.useFakeTimers();
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna'],
      onArenaInactivityCheck: async () => [],
    });
    mode.initialize({});
    await mode.start();

    const initial = mode.getDisplayData().teams[0].distance;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial);
    mode.cleanup();
  });
});
