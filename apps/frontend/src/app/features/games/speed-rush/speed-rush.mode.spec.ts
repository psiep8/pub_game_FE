import { vi } from 'vitest';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { SpeedRushMode } from './speed-rush.mode';

function setup(overrides: Partial<GameModeConfig> = {}) {
  const saved: any[] = [];
  const received: any[] = [];
  const startSpeedRush = vi.fn().mockResolvedValue({ players: [] });
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

const summary = (players: any[]) => ({ active: true, startedAt: 1, deadlineAt: 90_001, players });

describe('SpeedRushMode — ripresa dopo un refresh della TV', () => {
  it('rilegge le corsie dal server e riparte dal tempo che resta', async () => {
    const startSpeedRush = vi.fn().mockResolvedValue(summary([
      { playerName: 'Anna', progress: 60, streak: 2, multiplier: 2, finished: false, position: null, finishedAt: null },
      { playerName: 'Bruno', progress: 100, streak: 3, multiplier: 2, finished: true, position: 1, finishedAt: 12_000 },
    ]));
    const { mode, saved } = setup({ startSpeedRush });

    mode.restore(42);

    expect(mode.getTimerValue()).toBe(42);
    expect(saved).toHaveLength(0);
    expect(mode.getDisplayData().revealed).toBe(false);
    await vi.waitFor(() => expect(mode.getDisplayData().lanes).toHaveLength(2));

    const lanes = mode.getDisplayData().lanes;
    expect(lanes.map((lane: any) => lane.playerName)).toEqual(['Bruno', 'Anna']);
    expect(lanes[0]).toMatchObject({ progress: 100, position: 1, finished: true });
    expect(lanes[1]).toMatchObject({ progress: 60, streak: 2, multiplier: 2 });
    expect(startSpeedRush).toHaveBeenCalledWith(['Anna', 'Bruno']);
    mode.cleanup();
  });

  it('non scrive checkpoint: gli avanzamenti restano sul server', () => {
    const { mode, saved } = setup();
    mode.restore(30);

    mode.handlePartyEvent({ action: 'SPEED_RUSH_PROGRESS', playerName: 'Anna', progress: 20, streak: 1, multiplier: 1 });
    mode.handlePartyEvent({ action: 'SPEED_RUSH_PROGRESS', playerName: 'Bruno', progress: 10, streak: 0, multiplier: 1 });

    expect(saved).toHaveLength(0);
    expect(mode.getDisplayData().lanes[0]).toMatchObject({ playerName: 'Anna', progress: 20 });
    mode.cleanup();
  });

  it('mostra le corsie attive anche se il server non risponde', async () => {
    const startSpeedRush = vi.fn().mockRejectedValue(new Error('offline'));
    const { mode } = setup({ startSpeedRush });

    mode.restore(30);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const lanes = mode.getDisplayData().lanes;
    expect(lanes.map((lane: any) => lane.playerName).sort()).toEqual(['Anna', 'Bruno']);
    expect(lanes.every((lane: any) => lane.progress === 0)).toBe(true);
    mode.cleanup();
  });

  it('chiede i punti al server quando il tempo scade dopo il refresh', async () => {
    vi.useFakeTimers();
    const { mode, finishSpeedRush, received } = setup();

    mode.restore(2);
    await vi.advanceTimersByTimeAsync(3000);

    expect(finishSpeedRush).toHaveBeenCalledTimes(1);
    expect(received).toEqual([{ playerName: 'Anna', points: 40, isCorrect: true }]);
    mode.cleanup();
    vi.useRealTimers();
  });
});
