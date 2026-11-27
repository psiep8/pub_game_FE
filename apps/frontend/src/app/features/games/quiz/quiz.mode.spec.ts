import { vi } from 'vitest';
import { REVEAL_DELAY_MS } from '../../../shared/models/scoring-rules';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { GAME_TIMINGS } from '../../../shared/models/game-timings';
import { TV_TIMING } from '../../tv/tv-timing';
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

  it('non calcola punti in TV: il voto lo arbitra il server', () => {
    const { mode, received } = setup(payload);

    mode.handleAnswer('Anna', 1, 2000);

    expect(received).toHaveLength(0);
    expect(mode.getDisplayData().answers).toHaveLength(0);
  });

  it('applica una sola volta l\'esito arrivato dal server', () => {
    const { mode } = setup(payload);

    const applied = mode.applyServerAnswer({ playerName: 'Anna', manche: 0, isCorrect: true, points: 870 });
    const again = mode.applyServerAnswer({ playerName: 'Anna', manche: 0, isCorrect: false, points: -1000 });

    expect(applied).toBe(true);
    expect(again).toBe(false);
    expect(mode.getDisplayData().answers).toEqual([
      { playerName: 'Anna', points: 870, isCorrect: true, manche: 0, optionIndex: null },
    ]);
  });

  it('accende la giusta e le sbagliate solo a manche chiusa', () => {
    const { mode } = setup(payload);

    mode.applyServerAnswer({ playerName: 'Anna', manche: 0, isCorrect: false, points: -400, optionIndex: 2 });
    mode.applyServerAnswer({ playerName: 'Bruno', manche: 0, isCorrect: true, points: 900, optionIndex: 1 });

    // Manche aperta: la TV non deve sapere dove sta la soluzione.
    expect(mode.getDisplayData().answerIndex).toBe(-1);
    expect(mode.getDisplayData().wrongIndexes).toEqual([]);
    expect(mode.getDisplayData().answersLocked).toBe(false);

    mode.stop();

    const data = mode.getDisplayData();
    expect(data.answerIndex).toBe(1);
    expect(data.wrongIndexes).toEqual([2]);
    expect(data.answersLocked).toBe(true);

    mode.cleanup();
  });

  it('ignora un esito di un round precedente anche se arriva dopo la riapertura', () => {
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload, gameId: 1, quizRoundStartId: 'nuovo' });
    mode.initialize(payload);
    expect(mode.applyServerAnswer({ roundStartId: 'vecchio', playerName: 'Anna', manche: 0, points: 300 })).toBe(false);
    expect(mode.applyServerAnswer({ playerName: 'Anna', manche: 0, points: 300 })).toBe(false);
    expect(mode.applyServerAnswer({ roundStartId: 'nuovo', playerName: 'Anna', manche: 0, points: 300 })).toBe(true);
    mode.cleanup();
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
    const { mode, saved } = setupConCheckpoint();

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

    // Le risposte arrivano dal server: una riga per giocatore e manche.
    expect(mode.applyServerAnswer({ playerName: 'Bruno', manche: 1, isCorrect: true, points: 200 })).toBe(true);
    expect(mode.applyServerAnswer({ playerName: 'Bruno', manche: 1, isCorrect: true, points: 200 })).toBe(false);
    expect(mode.getDisplayData().answers).toHaveLength(2);

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

  it('salva un checkpoint quando il server applica una risposta', () => {
    const { mode, saved } = setupConCheckpoint();
    mode.restore(15, { revision: 1, state: { mancheIndex: 0, secondsLeft: 10, stage: 'play' } });

    mode.applyServerAnswer({ playerName: 'Anna', manche: 0, isCorrect: true, points: 900 });

    expect(saved.at(-1)?.type).toBe('QUIZ');
    expect(saved.at(-1)?.state.answers).toHaveLength(1);
    expect(saved.at(-1)?.state.answeredThisManche).toEqual(['Anna']);
    mode.cleanup();
  });

  it('annuncia al server quale manche è aperta', async () => {
    vi.useFakeTimers();
    const startQuizManche = vi.fn().mockResolvedValue({ mancheIndex: 0 });
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche });
    mode.initialize(treManches);

    await mode.start();

    expect(startQuizManche).toHaveBeenCalledWith(0);
    mode.cleanup();
    vi.useRealTimers();
  });

  it('riannuncia la manche con il tempo rimasto dopo il refresh', () => {
    const startQuizManche = vi.fn().mockResolvedValue({ mancheIndex: 1 });
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche });
    mode.initialize(treManches);

    mode.restore(20, { revision: 3, state: { mancheIndex: 1, secondsLeft: 6, stage: 'play' } });

    // Senza il tempo rimasto il server riaprirebbe un cronometro pieno.
    expect(startQuizManche).toHaveBeenCalledWith(1, 6);
    mode.cleanup();
  });

  it('non riapre una manche già in suspense o in soluzione', () => {
    const startQuizManche = vi.fn().mockResolvedValue({});
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche });
    mode.initialize(treManches);

    mode.restore(10, { revision: 3, state: { mancheIndex: 0, secondsLeft: 0, stage: 'suspense' } });

    expect(startQuizManche).not.toHaveBeenCalled();
    mode.cleanup();
  });

  it('rilegge dal server le risposte arrivate durante il refresh', async () => {
    const loadQuizAnswers = vi.fn().mockResolvedValue({
      answers: [{ playerName: 'Anna', manche: 1, isCorrect: true, points: 320 }],
    });
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, loadQuizAnswers });
    mode.initialize(treManches);

    mode.restore(10, { revision: 2, state: { mancheIndex: 1, secondsLeft: 5, stage: 'play' } });

    await vi.waitFor(() => expect(mode.getDisplayData().answers).toHaveLength(1));
    expect(mode.getDisplayData().answers[0]).toMatchObject({ playerName: 'Anna', points: 320, manche: 1 });
    expect(mode.getDisplayData().summary[1].correctTeams).toEqual(['Anna']);
    // Quella risposta è già registrata: un evento ripetuto non conta due volte.
    expect(mode.applyServerAnswer({ playerName: 'Anna', manche: 1, isCorrect: false, points: -1000 })).toBe(false);
    mode.cleanup();
  });

  it('un riepilogo lento non cancella i voti arrivati dopo il refresh', async () => {
    let deliver!: (value: any) => void;
    const loadQuizAnswers = vi.fn().mockReturnValue(new Promise((resolve) => { deliver = resolve; }));
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, loadQuizAnswers });
    mode.initialize(treManches);
    mode.restore(10, { revision: 2, state: { mancheIndex: 1, secondsLeft: 5, stage: 'play' } });
    mode.applyServerAnswer({ playerName: 'Bruno', manche: 1, isCorrect: true, points: 200 });
    deliver({ answers: [{ playerName: 'Anna', manche: 1, isCorrect: true, points: 320 }] });
    await vi.waitFor(() => expect(mode.getDisplayData().answers).toHaveLength(2));
    expect(mode.getDisplayData().answers.map((row: any) => row.playerName)).toEqual(expect.arrayContaining(['Anna', 'Bruno']));
    mode.cleanup();
  });

  it('un riepilogo arrivato dopo la chiusura non ripristina i voti', async () => {
    let deliver!: (value: any) => void;
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1,
      loadQuizAnswers: () => new Promise((resolve) => { deliver = resolve; }) });
    mode.initialize(treManches);
    mode.restore(10, { revision: 2, state: { mancheIndex: 1, secondsLeft: 5, stage: 'play' } });
    mode.cleanup();
    deliver({ answers: [{ playerName: 'Anna', manche: 1, isCorrect: true, points: 320 }] });
    await Promise.resolve();
    expect(mode.getDisplayData().answers).toEqual([]);
  });

  it('ignora un riepilogo di un round Quiz diverso dopo il recupero', async () => {
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, quizRoundStartId: 'round-corrente',
      loadQuizAnswers: async () => ({ roundStartId: 'round-vecchio',
        answers: [{ playerName: 'Anna', manche: 1, isCorrect: true, points: 320 }] }) });
    mode.initialize(treManches);
    mode.restore(10, { revision: 2, state: { mancheIndex: 1, secondsLeft: 5, stage: 'play' } });
    await Promise.resolve();
    expect(mode.getDisplayData().answers).toEqual([]);
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

  /**
   * N-12: fra una manche e l'altra la domanda successiva resta a schermo per
   * il respiro, con il cronometro fermo, e solo dopo la manche si apre.
   */
  it('fra una manche e l’altra la domanda dopo è a schermo con il timer fermo', async () => {
    vi.useFakeTimers();
    const startQuizManche = vi.fn().mockResolvedValue({});
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche });
    mode.initialize(treManches);
    await mode.start();
    expect(startQuizManche).toHaveBeenCalledWith(0);

    // Prima manche: scadenza, suspense, soluzione, poi il respiro.
    await vi.advanceTimersByTimeAsync(GAME_TIMINGS.QUIZ.mancheSeconds * 1000);
    await vi.advanceTimersByTimeAsync(REVEAL_DELAY_MS + 3000);

    const reading = mode.getDisplayData();
    expect(reading.question).toBe('Q2');
    expect(reading.isReading).toBe(true);
    expect(mode.getTimerValue()).toBe(GAME_TIMINGS.QUIZ.mancheSeconds);
    // La manche dopo non è ancora aperta sul server: chi risponde non prende punti.
    expect(startQuizManche).not.toHaveBeenCalledWith(1);

    // Metà respiro: la domanda è ancora in lettura e il tempo non scorre.
    await vi.advanceTimersByTimeAsync(2000);
    expect(mode.getDisplayData().isReading).toBe(true);
    expect(mode.getTimerValue()).toBe(GAME_TIMINGS.QUIZ.mancheSeconds);

    // Fine respiro: si apre la manche nuova e il cronometro parte.
    await vi.advanceTimersByTimeAsync(TV_TIMING.mancheBreathMs - 2000 + 200);
    expect(mode.getDisplayData().isReading).toBe(false);
    expect(startQuizManche).toHaveBeenCalledWith(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mode.getTimerValue()).toBe(GAME_TIMINGS.QUIZ.mancheSeconds - 1);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('durante il respiro il checkpoint dice reading con il tempo che resta', async () => {
    vi.useFakeTimers();
    const { mode, saved } = setupConCheckpoint();
    await mode.start();
    await vi.advanceTimersByTimeAsync(GAME_TIMINGS.QUIZ.mancheSeconds * 1000);
    await vi.advanceTimersByTimeAsync(REVEAL_DELAY_MS + 3000);

    const state = saved.at(-1)?.state;
    expect(state.stage).toBe('reading');
    expect(state.mancheIndex).toBe(1);
    expect(state.readingLeftMs).toBeGreaterThan(0);
    expect(state.readingLeftMs).toBeLessThanOrEqual(TV_TIMING.mancheBreathMs);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('la barra chiude alla scadenza del server, non al timer locale [N-14]', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const startQuizManche = vi.fn().mockResolvedValue({ deadlineAt: 1_020_000 });
      const mode = new QuizMode();
      mode.setConfig({
        type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche,
        serverNow: () => Date.now(),
      });
      mode.initialize(treManches);
      await mode.start();

      expect(startQuizManche).toHaveBeenCalledWith(0);
      expect(mode.getDisplayData().deadlineAt).toBe(1_020_000);

      // 200 ms prima della scadenza del server la barra è ancora aperta.
      await vi.advanceTimersByTimeAsync(19_800);
      expect(mode.getTimerValue()).toBe(1);
      expect(mode.getDisplayData().revealPending).toBe(false);

      // 200 ms dopo la scadenza la barra è chiusa e parte la suspense.
      await vi.advanceTimersByTimeAsync(400);
      expect(mode.getTimerValue()).toBe(0);
      expect(mode.getDisplayData().revealPending).toBe(true);

      mode.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it('un refresh durante il respiro riapre la manche solo a respiro finito', async () => {
    vi.useFakeTimers();
    const startQuizManche = vi.fn().mockResolvedValue({});
    const mode = new QuizMode();
    mode.setConfig({ type: 'QUIZ', payload: treManches, gameId: 1, startQuizManche });
    mode.initialize(treManches);

    mode.restore(20, {
      revision: 3,
      state: {
        mancheIndex: 1, secondsLeft: 20, stage: 'reading',
        readingLeftMs: 3000, savedAt: Date.now(),
      },
    });

    const reading = mode.getDisplayData();
    expect(reading.isReading).toBe(true);
    expect(reading.question).toBe('Q2');
    // La manche non è aperta sul server: chi risponde adesso non prende punti.
    expect(startQuizManche).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    expect(mode.getDisplayData().isReading).toBe(false);
    expect(startQuizManche).toHaveBeenCalledWith(1);

    mode.cleanup();
    vi.useRealTimers();
  });
});
