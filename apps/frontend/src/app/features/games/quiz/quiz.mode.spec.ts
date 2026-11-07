import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { QuizMode } from './quiz.mode';

function setup(payload: any) {
  const received: any[] = [];
  const mode = new QuizMode();
  const config: GameModeConfig = {
    type: 'QUIZ',
    payload,
    gameId: 1,
    onAnswerReceived: (result) => received.push(result),
  };

  mode.setConfig(config);
  mode.initialize(payload);

  return { mode, received };
}

describe('QuizMode', () => {
  const payload = {
    question: 'Qual è la capitale d’Italia?',
    options: ['Milano', 'Roma', 'Napoli', 'Torino'],
    correctAnswer: 'Roma',
  };

  it('should award points that decay with the response time', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 1, 2000);

    expect(received[0]).toMatchObject({
      playerName: 'Anna',
      isCorrect: true,
      playerChoice: 'Roma',
      points: 800,
    });
  });

  it('should subtract points for a wrong answer', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 0, 0);

    expect(received[0]).toMatchObject({ isCorrect: false, playerChoice: 'Milano', points: -1000 });
  });

  it('should hide the answer until the round is stopped', () => {
    const { mode } = setup(payload);

    expect(mode.getDisplayData().correctAnswer).toBeNull();

    mode.stop();

    expect(mode.getDisplayData().correctAnswer).toBe('Roma');
    expect(mode.isRevealed()).toBe(true);
  });

  it('should not allow buzzing before the question is active', () => {
    const { mode } = setup(payload);

    expect(mode.canBuzz()).toBe(false);
  });
});
