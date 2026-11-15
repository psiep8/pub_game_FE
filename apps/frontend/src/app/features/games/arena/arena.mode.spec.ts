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

  it('recupera il totale del server senza riapplicare una risposta ripetuta', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      onArenaInactivityCheck: async () => {
        calls++;
        if (calls === 2) throw new Error('risposta persa');
        return calls === 1 ? [] : [{ playerName: 'Anna', count: calls < 5 ? 1 : 2 }];
      },
    });
    mode.initialize({});
    await mode.start();
    const initial = mode.getDisplayData().teams[0].distance;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 24);
    mode.cleanup();
  });

  it('conserva le penalità ricevute durante la pausa e le applica alla ripresa', async () => {
    vi.useFakeTimers();
    let resolveCheck!: (rows: Array<{ playerName: string; count: number }>) => void;
    const check = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveCheck = resolve; }))
      .mockResolvedValue([]);
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      onArenaInactivityCheck: check,
    });
    mode.initialize({});
    await mode.start();
    const initial = mode.getDisplayData().teams[0].distance;

    mode.pause();
    resolveCheck([{ playerName: 'Anna', count: 1 }]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial);

    mode.resume();
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mode.getDisplayData().teams[0].distance).toBe(initial + 12);
    mode.cleanup();
  });

  it('ignora una risposta ritardata dopo la pulizia della modalità', async () => {
    vi.useFakeTimers();
    let resolveCheck!: (rows: Array<{ playerName: string; count: number }>) => void;
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      onArenaInactivityCheck: () => new Promise((resolve) => { resolveCheck = resolve; }),
    });
    mode.initialize({});
    await mode.start();
    mode.cleanup();
    resolveCheck([{ playerName: 'Anna', count: 1 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(mode.getDisplayData().teams).toEqual([]);
  });

  it('applica a tutte le squadre le penalità simultanee prima di terminare il round', async () => {
    vi.useFakeTimers();
    let due = false;
    const eliminated = vi.fn();
    const mode = new ArenaMode();
    mode.setConfig({
      type: 'ARENA', payload: {}, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      onPlayerEliminated: eliminated,
      onArenaInactivityCheck: async () => due
        ? [{ playerName: 'Bruno', count: 2 }, { playerName: 'Anna', count: 6 }]
        : [],
    });
    mode.initialize({});
    await mode.start();
    await vi.advanceTimersByTimeAsync(30_000);
    due = true;
    await vi.advanceTimersByTimeAsync(2_000);

    const result = mode.getDisplayData();
    expect(result.teams).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: 'Anna', distance: 100, eliminated: true }),
      expect.objectContaining({ playerName: 'Bruno', distance: 100, eliminated: true }),
    ]));
    expect(eliminated).toHaveBeenCalledTimes(2);
    expect(result.gameEnded).toBe(true);
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
