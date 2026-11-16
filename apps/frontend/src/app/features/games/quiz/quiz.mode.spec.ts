import { vi } from 'vitest';
import { GAME_TIMINGS } from '../../../shared/models/game-timings';
import { REVEAL_DELAY_MS } from '../../../shared/models/scoring-rules';
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
      // Il valore scende in proporzione ai secondi rimasti della manche.
      points: Math.round(1000 * (1 - 2000 / (GAME_TIMINGS.QUIZ.mancheSeconds * 1000))),
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

describe('QuizMode — ripresa dopo un refresh della TV', () => {
  const treManches = {
    category: 'Storia',
    questions: [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', difficulty: 'facile', maxPoints: 300 },
      { question: 'Q2', options: ['C', 'D'], correctAnswer: 'C', difficulty: 'medio', maxPoints: 300 },
      { question: 'Q3', options: ['E', 'F'], correctAnswer: 'E', difficulty: 'difficile', maxPoints: 400 },
    ],
  };

  function setupConCheckpoint() {
    const saved: any[] = [];
    const received: any[] = [];
    const mode = new QuizMode();
    mode.setConfig({
      type: 'QUIZ', payload: treManches, gameId: 1,
      onAnswerReceived: (result) => received.push(result),
      onTvCheckpoint: (checkpoint) => saved.push(checkpoint),
    });
    mode.initialize(treManches);
    return { mode, saved, received };
  }

  it('riprende manche e tempo dal checkpoint senza tornare alla prima', async () => {
    vi.useFakeTimers();
    const { mode, saved, received } = setupConCheckpoint();

    mode.restore(20, {
      revision: 5,
      state: {
        mancheIndex: 1, secondsLeft: 7, stage: 'play',
        answers: [{ playerName: 'Anna', points: 120, isCorrect: true, manche: 1 }],
        answeredThisManche: ['Anna'],
      },
    });

    const data = mode.getDisplayData();
    expect(data.question).toBe('Q2');
    expect(data.manche).toBe(2);
    expect(mode.getTimerValue()).toBe(7);

    await vi.advanceTimersByTimeAsync(2000);
    expect(mode.getTimerValue()).toBe(5);
    // Il cronometro non scrive checkpoint: una POST al secondo era troppo.
    expect(saved).toHaveLength(0);

    // Chi ha già risposto in questa manche non risponde una seconda volta.
    mode.handleAnswer('Anna', 0, 1000);
    expect(received).toHaveLength(0);
    mode.handleAnswer('Bruno', 1, 1000);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ playerName: 'Bruno', isCorrect: false });

    mode.cleanup();
    vi.useRealTimers();
  });

  it('riprende la suspense e mostra la soluzione scaduta', async () => {
    vi.useFakeTimers();
    const { mode } = setupConCheckpoint();

    mode.restore(10, {
      revision: 2,
      state: { mancheIndex: 0, secondsLeft: 0, stage: 'suspense' },
    });
    expect(mode.getDisplayData().revealPending).toBe(true);

    await vi.advanceTimersByTimeAsync(REVEAL_DELAY_MS);
    expect(mode.getDisplayData().mancheReveal?.question).toBe('Q1');

    await vi.advanceTimersByTimeAsync(3000);
    expect(mode.getDisplayData().question).toBe('Q2');

    mode.cleanup();
    vi.useRealTimers();
  });

  it('riprende la soluzione mostrata e passa alla manche dopo', async () => {
    vi.useFakeTimers();
    const { mode } = setupConCheckpoint();

    mode.restore(10, {
      revision: 3,
      state: { mancheIndex: 2, secondsLeft: 0, stage: 'reveal' },
    });
    expect(mode.getDisplayData().mancheReveal?.question).toBe('Q3');

    await vi.advanceTimersByTimeAsync(3000);
    expect(mode.isRevealed()).toBe(true);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('salva un checkpoint a ogni risposta con la modalità Quiz', () => {
    const { mode, saved } = setupConCheckpoint();
    mode.restore(15, { revision: 1, state: { mancheIndex: 0, secondsLeft: 10, stage: 'play' } });

    mode.handleAnswer('Anna', 1, 1000);

    expect(saved.at(-1)?.type).toBe('QUIZ');
    expect(saved.at(-1)?.state.answers).toHaveLength(1);
    expect(saved.at(-1)?.state.answeredThisManche).toEqual(['Anna']);
    mode.cleanup();
  });

  it('toglie dal tempo residuo i secondi passati dall\'ultimo checkpoint', () => {
    const { mode } = setupConCheckpoint();

    mode.restore(20, {
      revision: 4,
      state: { mancheIndex: 1, secondsLeft: 9, savedAt: Date.now() - 4000, stage: 'play' },
    });

    expect(mode.getTimerValue()).toBe(5);
    mode.cleanup();
  });

  it('non scala il tempo fermo di una pausa', () => {
    const { mode } = setupConCheckpoint();

    mode.restore(20, {
      revision: 4,
      state: { mancheIndex: 0, secondsLeft: 8, savedAt: Date.now() - 30_000, paused: true, stage: 'play' },
    });

    expect(mode.getTimerValue()).toBe(8);
    mode.cleanup();
  });

  it('mostra la soluzione se il tempo è scaduto mentre la TV era via', async () => {
    vi.useFakeTimers();
    const { mode } = setupConCheckpoint();

    mode.restore(20, {
      revision: 4,
      state: { mancheIndex: 0, secondsLeft: 3, savedAt: Date.now() - 5000, stage: 'play' },
    });

    expect(mode.getDisplayData().revealPending).toBe(true);
    await vi.advanceTimersByTimeAsync(REVEAL_DELAY_MS);
    expect(mode.getDisplayData().mancheReveal?.question).toBe('Q1');

    mode.cleanup();
    vi.useRealTimers();
  });

  it('salva un checkpoint quando il round va in pausa', () => {
    const { mode, saved } = setupConCheckpoint();
    mode.restore(15, { revision: 1, state: { mancheIndex: 0, secondsLeft: 10, stage: 'play' } });

    mode.pause();

    expect(saved.at(-1)?.state).toMatchObject({ paused: true, secondsLeft: 10, stage: 'play' });
    mode.cleanup();
  });

  it('rifiuta un checkpoint senza revisione', () => {
    const { mode } = setupConCheckpoint();
    expect(() => mode.restore(10, { revision: 0, state: { mancheIndex: 0 } }))
      .toThrow('Stato Quiz non ripristinabile');
  });
});
