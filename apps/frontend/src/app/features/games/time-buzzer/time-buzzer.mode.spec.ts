import { vi } from 'vitest';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { TimeBuzzerMode } from './time-buzzer.mode';

const PAYLOAD = { question: 'Quanto ci metti?' };

function setup(activePlayers = ['Anna', 'Bruno', 'Carla']) {
  const saved: Array<{ type: string; revision: number; state: any }> = [];
  const points: any[] = [];
  const mode = new TimeBuzzerMode();
  const config: GameModeConfig = {
    type: 'TIME_BUZZER',
    payload: PAYLOAD,
    gameId: 1,
    activePlayers,
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
    onAnswerReceived: (result) => points.push(result),
    startTimeBuzzer: async () => Date.now(),
  };

  mode.setConfig(config);
  mode.initialize(PAYLOAD);

  return { mode, saved, points };
}

describe('TimeBuzzerMode — ripresa dopo un refresh della TV', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('salva bersaglio e fase già durante la preparazione', async () => {
    vi.useFakeTimers();
    const { mode, saved } = setup();

    await mode.start();

    const state = saved.at(-1)?.state;
    expect(state).toMatchObject({ mancheIndex: 0, phase: 'spin', guesses: [] });
    expect(state.targetMs).toBeGreaterThanOrEqual(5000);
    expect(state.targetMs).toBeLessThanOrEqual(20000);

    mode.cleanup();
  });

  it('riprende la manche in corso con i tempi già arrivati', () => {
    const { mode, points } = setup();

    mode.restore(20, {
      revision: 3,
      state: {
        mancheIndex: 1,
        phase: 'running',
        startedAt: Date.now() - 5000,
        targetMs: 12000,
        guesses: [{ playerName: 'Anna', ms: 12000 }],
        eliminated: ['Carla'],
      },
    });

    const data = mode.getDisplayData();
    expect(data.manche).toBe(2);
    expect(data.phase).toBe('running');
    expect(data.targetMs).toBe(12000);
    expect(data.guesses).toEqual([{ playerName: 'Anna', ms: 12000 }]);
    expect(data.remaining).toEqual(['Anna', 'Bruno']);
    expect(data.startedAt).toBeGreaterThan(0);
    expect(mode.getTimerValue()).toBe(20);
    // Nessun punto: i tempi erano già stati mandati dai telefoni.
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('una manche già rivelata non ripaga i punti', () => {
    const { mode, points } = setup();
    const reveal = {
      target: 12000,
      results: [{ playerName: 'Anna', ms: 12000, error: 0, eliminated: false }],
      eliminated: ['Carla'],
      eliminatedNow: ['Carla'],
    };

    mode.restore(0, {
      revision: 4,
      state: {
        mancheIndex: 0,
        phase: 'running',
        startedAt: Date.now() - 31_000,
        targetMs: 12000,
        guesses: [{ playerName: 'Anna', ms: 12000 }],
        eliminated: ['Carla'],
        reveal,
      },
    });

    const data = mode.getDisplayData();
    expect(data.reveal).toEqual(reveal);
    expect(data.waitingNext).toBe(true);
    expect(data.phase).toBe('reveal');
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('se la manche non era ancora partita riparte dallo stesso bersaglio', () => {
    vi.useFakeTimers();
    const { mode } = setup();

    mode.restore(30, {
      revision: 5,
      state: { mancheIndex: 0, phase: 'countdown', targetMs: 15000, startedAt: 0 },
    });

    expect(mode.getDisplayData().targetMs).toBe(15000);
    expect(mode.getDisplayData().phase).toBe('spin');

    mode.cleanup();
  });

  it('non si rompe con un checkpoint senza stato utile', () => {
    const { mode } = setup();

    mode.restore(30, { revision: 6, state: { guesses: 'x', eliminated: null, targetMs: 'y' } });

    const data = mode.getDisplayData();
    expect(data.manche).toBe(1);
    expect(data.guesses).toEqual([]);
    expect(data.eliminated).toEqual([]);

    mode.cleanup();
  });
});
