import { GameModeConfig } from '../interfaces/game-mode-type';
import { ChronoMode } from './chrono.mode';

function setup(payload: any) {
  const received: any[] = [];
  const mode = new ChronoMode();
  const config: GameModeConfig = {
    type: 'CHRONO',
    payload,
    gameId: 1,
    onAnswerReceived: (result) => received.push(result),
  };

  mode.setConfig(config);
  mode.initialize(payload);

  return { mode, received };
}

describe('ChronoMode', () => {
  const payload = { question: 'In che anno è avvenuto lo sbarco sulla Luna?', correctAnswer: '1969' };

  it('should award full points for the exact year', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 1969, 0);

    expect(received[0]).toMatchObject({ isCorrect: true, difference: 0, points: 1000 });
  });

  it('should flag a near miss within three years', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 1971, 3000);

    expect(received[0]).toMatchObject({ isCorrect: false, isClose: true, difference: 2, points: -450 });
  });

  it('should not flag a far miss as close', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 1980, 0);

    expect(received[0].isClose).toBeUndefined();
    expect(received[0].isCorrect).toBe(false);
  });

  it('should expose a slider range containing the correct year', () => {
    const { mode } = setup(payload);

    const data = mode.getDisplayData();

    expect(data.minYear).toBeLessThanOrEqual(1969);
    expect(data.maxYear).toBeGreaterThanOrEqual(1969);
    expect(data.step).toBe(1);
  });
});
