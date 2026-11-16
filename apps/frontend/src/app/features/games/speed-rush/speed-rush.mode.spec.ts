import { vi } from 'vitest';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { SpeedRushMode } from './speed-rush.mode';

function setup(overrides: Partial<GameModeConfig> = {}) {
  const saved: any[] = [];
  const received: any[] = [];
  const startSpeedRush = vi.fn().mockResolvedValue({});
  const finishSpeedRush = vi.fn().mockResolvedValue([{ playerName: 'Anna', points: 40 }]);
  const mode = new SpeedRushMode();
  const config: GameModeConfig = {
    type: 'SPEED_RUSH',
    payload: { question: 'Speed Rush!' },
    gameId: 1,
    activePlayers: ['Anna', 'Bruno'],
    onAnswerReceived: (result) => received.push(result),
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint),
    startSpeedRush,
    finishSpeedRush,
    ...overrides,
  };

  mode.initialize(config.payload);
  mode.setConfig(config);

  return { mode, saved, received, startSpeedRush, finishSpeedRush };
}

function checkpoint(state: any, revision = 3) {
  return { mode: 'SPEED_RUSH', revision, state };
}

describe('SpeedRushMode — ripresa dopo un refresh della TV', () => {
  it('ricostruisce corsie e tempo dal checkpoint senza riaprire la corsa', () => {
    const { mode, startSpeedRush } = setup();

    mode.restore(42, checkpoint({
      lanes: [
        { playerName: 'Anna', progress: 60, streak: 2, multiplier: 2, finished: false, position: null, finishedAt: null },
        { playerName: 'Bruno', progress: 100, streak: 3, multiplier: 2, finished: true, position: 1, finishedAt: 12_000 },
      ],
    }));

    const lanes = mode.getDisplayData().lanes;
    expect(lanes.map((lane: any) => lane.playerName)).toEqual(['Bruno', 'Anna']);
    expect(lanes[0]).toMatchObject({ progress: 100, position: 1, finished: true });
    expect(lanes[1]).toMatchObject({ progress: 60, streak: 2, multiplier: 2 });
    expect(mode.getDisplayData().revealed).toBe(false);
    expect(mode.getTimerValue()).toBe(42);
    // Il server ha ancora la sessione: la TV non la riapre.
    expect(startSpeedRush).not.toHaveBeenCalled();
    mode.cleanup();
  });

  it('aggiunge la corsia di chi si è unito durante il refresh', () => {
    const { mode } = setup({ activePlayers: ['Anna', 'Bruno', 'Carla'] });

    mode.restore(30, checkpoint({ lanes: [{ playerName: 'Anna', progress: 10 }] }));

    const lanes = mode.getDisplayData().lanes;
    expect(lanes.map((lane: any) => lane.playerName).sort()).toEqual(['Anna', 'Bruno', 'Carla']);
    expect(lanes.find((lane: any) => lane.playerName === 'Bruno')).toMatchObject({ progress: 0, streak: 0, multiplier: 1 });
    mode.cleanup();
  });

  it('salva un checkpoint a ogni avanzamento con la modalità Speed Rush', () => {
    const { mode, saved } = setup();
    mode.restore(30, checkpoint({ lanes: [] }, 4));

    mode.handlePartyEvent({ action: 'SPEED_RUSH_PROGRESS', playerName: 'anna', progress: 25, streak: 1, multiplier: 1 });

    expect(saved.at(-1)?.type).toBe('SPEED_RUSH');
    expect(saved.at(-1)?.revision).toBe(5);
    expect(saved.at(-1)?.state.lanes[0]).toMatchObject({ playerName: 'Anna', progress: 25, streak: 1 });
    mode.cleanup();
  });

  it('chiede i punti al server quando il tempo scade dopo il refresh', async () => {
    vi.useFakeTimers();
    const { mode, finishSpeedRush, received } = setup();

    mode.restore(2, checkpoint({ lanes: [{ playerName: 'Anna', progress: 80 }] }));
    await vi.advanceTimersByTimeAsync(3000);

    expect(finishSpeedRush).toHaveBeenCalledTimes(1);
    expect(received).toEqual([{ playerName: 'Anna', points: 40, isCorrect: true }]);
    mode.cleanup();
    vi.useRealTimers();
  });

  it('rifiuta un checkpoint senza revisione', () => {
    const { mode } = setup();
    expect(() => mode.restore(30, checkpoint({ lanes: [] }, 0)))
      .toThrow('Stato Speed Rush non ripristinabile');
  });
});
