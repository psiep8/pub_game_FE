import { describe, expect, it, vi } from 'vitest';
import { BombaMode } from './bomba.mode';

/** Tabellone come lo manda il server: qui serve solo la forma minima. */
function board(overrides: any = {}): any {
  return {
    type: 'BOMBA',
    active: true,
    phase: 'TURN',
    prompt: 'Quale non è vera?',
    cells: [{ id: 1, label: 'Roma', used: false }],
    players: ['Anna', 'Bruno'],
    eliminated: [],
    penalties: {},
    turn: 'Anna',
    turnSeconds: 20,
    secondsLeft: 18,
    lastEvent: null,
    ...overrides,
  };
}

function fakeApi(current: () => any) {
  return {
    start: vi.fn(async () => current()),
    state: vi.fn(async () => current()),
    pick: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
  };
}

describe('BombaMode — ripresa dopo un refresh della TV', () => {
  it('riprende dal checkpoint senza riapplicare la bomba già contata', async () => {
    vi.useFakeTimers();
    let current = board({ lastEvent: { seq: 4, kind: 'bomb', player: 'Anna' } });
    const api = fakeApi(() => current);
    const penalty = vi.fn();
    const saved: Array<{ type: string; revision: number; state: any }> = [];
    const mode = new BombaMode();
    mode.setConfig({
      type: 'BOMBA', payload: { act: 1 }, gameId: 1, activePlayers: ['Anna', 'Bruno'], bomba: api,
      onAnswerReceived: penalty,
      onTvCheckpoint: (checkpoint) => saved.push(checkpoint),
    });
    mode.initialize({ act: 1 });

    mode.restore(18, { revision: 3, state: { lastEventSeq: 4 } });
    await vi.advanceTimersByTimeAsync(500);

    expect(api.start).not.toHaveBeenCalled();
    expect(penalty).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
    expect(mode.getDisplayData().cells).toHaveLength(1);

    // Una bomba arrivata durante il refresh: si applica una volta sola.
    current = board({ lastEvent: { seq: 5, kind: 'bomb', player: 'Bruno' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(penalty).toHaveBeenCalledTimes(1);
    expect(penalty).toHaveBeenCalledWith({ playerName: 'Bruno', points: -200, isCorrect: false });
    expect(saved).toHaveLength(1);
    expect(saved[0].revision).toBe(4);
    expect(saved[0].state).toEqual({ lastEventSeq: 5 });

    // Lo stesso evento ai poll successivi non conta di nuovo.
    await vi.advanceTimersByTimeAsync(800);
    expect(penalty).toHaveBeenCalledTimes(1);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('rifiuta un checkpoint con revisione o sequenza non valide', () => {
    const mode = new BombaMode();
    mode.setConfig({
      type: 'BOMBA', payload: { act: 1 }, gameId: 1, activePlayers: ['Anna'], bomba: fakeApi(() => board()),
    });
    mode.initialize({ act: 1 });

    expect(() => mode.restore(10, { revision: 0, state: { lastEventSeq: 0 } }))
      .toThrow('Stato Bomba non ripristinabile');
    expect(() => mode.restore(10, { revision: 1, state: { lastEventSeq: -1 } }))
      .toThrow('Stato Bomba non ripristinabile');
    expect(() => mode.restore(10, { revision: 'x', state: { lastEventSeq: 1 } }))
      .toThrow('Stato Bomba non ripristinabile');
  });

  it('chiude il round se il server lo dà già finito', async () => {
    vi.useFakeTimers();
    const ended = board({
      active: false,
      secondsLeft: 0,
      cells: [{ id: 1, label: 'Roma', used: true, bomb: true }],
    });
    const onTimerEnd = vi.fn();
    const mode = new BombaMode();
    mode.setConfig({
      type: 'BOMBA', payload: { act: 1 }, gameId: 1, activePlayers: ['Anna', 'Bruno'],
      bomba: fakeApi(() => ended), onTimerEnd,
    });
    mode.initialize({ act: 1 });

    mode.restore(0, { revision: 1, state: { lastEventSeq: 2 } });
    await vi.advanceTimersByTimeAsync(500);

    expect(onTimerEnd).toHaveBeenCalledTimes(1);
    expect(mode.getDisplayData().revealed).toBe(true);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('salva subito un checkpoint quando il round parte da zero', async () => {
    vi.useFakeTimers();
    const api = fakeApi(() => board());
    const saved: Array<{ type: string; revision: number; state: any }> = [];
    const mode = new BombaMode();
    mode.setConfig({
      type: 'BOMBA', payload: { act: 1 }, gameId: 1, activePlayers: ['Anna', 'Bruno'], bomba: api,
      onTvCheckpoint: (checkpoint) => saved.push(checkpoint),
    });
    mode.initialize({ act: 1 });

    await mode.start();
    await vi.advanceTimersByTimeAsync(500);

    expect(saved[0].revision).toBe(1);
    expect(saved[0].type).toBe('BOMBA');
    expect(saved[0].state).toEqual({ lastEventSeq: 0 });

    mode.cleanup();
    vi.useRealTimers();
  });
});
