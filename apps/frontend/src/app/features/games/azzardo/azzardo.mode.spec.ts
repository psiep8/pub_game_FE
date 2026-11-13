import { vi } from 'vitest';
import { AzzardoMode } from './azzardo.mode';

const QUESTIONS = [
  {
    question: 'Qual è l\'anno di nascita di Albert Einstein?',
    category: 'CELEBRITÀ',
    unit: 'anno',
    value: 1879,
    options: [1875, 1877, 1879, 1881],
    answerIndex: 2,
  },
  {
    question: 'In che anno è uscita Imagine di John Lennon?',
    category: 'CANZONI',
    unit: 'anno',
    value: 1971,
    options: [1969, 1971, 1973, 1975],
    answerIndex: 1,
  },
  {
    question: 'Quanti paesi confinano con l\'Italia?',
    category: 'PAESI',
    unit: 'paesi confinanti',
    value: 6,
    options: [5, 6, 7, 8],
    answerIndex: 1,
  },
  {
    question: 'In che anno è caduto il Muro di Berlino?',
    category: 'STORIA',
    unit: 'anno',
    value: 1989,
    options: [1985, 1987, 1989, 1991],
    answerIndex: 2,
  },
];

describe('AzzardoMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gioca una manche intera dalla puntata al reveal senza scendere sotto zero', async () => {
    vi.useFakeTimers();

    // Bruno ha solo 100 punti: la puntata da 300 viene tagliata e la perdita
    // non può portarlo sotto zero. Carla non risponde e resta a zero.
    const wallet: Record<string, number> = { Anna: 1000, Bruno: 100, Carla: 500 };
    const awards: Array<{ playerName: string; points: number }> = [];
    const broadcasts: any[] = [];

    const mode = new AzzardoMode();
    mode.setConfig({
      type: 'AZZARDO',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna', 'Bruno', 'Carla'],
      playerPoints: (playerName) => wallet[playerName] ?? 0,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
        awards.push({ playerName: data.playerName, points: data.points });
      },
      onBroadcast: (event) => broadcasts.push(event),
    });

    mode.initialize({ level: 1, questions: QUESTIONS });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    const bet = mode.getDisplayData();
    expect(bet.phase).toBe('BET');
    expect(bet.level).toBe(1);
    expect(bet.odds).toBe(2);
    expect(bet.manche).toBe(1);
    expect(bet.total).toBe(4);

    const question = QUESTIONS[0];
    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Anna',
      value: { stake: 200, choice: question.answerIndex },
    });
    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Bruno',
      value: { stake: 300, choice: (question.answerIndex + 1) % 4 },
    });

    // Un secondo invio di Anna nella stessa manche non deve cambiare la puntata.
    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Anna',
      value: { stake: 300, choice: 0 },
    });

    // Carla non risponde: la manche si chiude allo scadere del tempo di puntata.
    await vi.advanceTimersByTimeAsync(15000);

    const reveal = mode.getDisplayData();
    expect(reveal.phase).toBe('REVEAL');
    expect(reveal.value).toBe(1879);
    expect(reveal.answerIndex).toBe(question.answerIndex);

    const anna = reveal.rows.find((row: any) => row.playerName === 'Anna');
    const bruno = reveal.rows.find((row: any) => row.playerName === 'Bruno');
    const carla = reveal.rows.find((row: any) => row.playerName === 'Carla');

    // Anna: 200 punti puntati, risposta giusta, quota ×2.
    expect(anna).toMatchObject({ stake: 200, points: 400, total: 400 });
    expect(wallet['Anna']).toBe(1400);

    // Bruno: punta 300 col credito di manche, ma in classifica ha 100 punti:
    // la perdita si taglia sui punti veri, 100 (100%).
    expect(bruno).toMatchObject({ stake: 300, points: -100, total: -100 });
    expect(wallet['Bruno']).toBe(0);

    // Carla: nessuna puntata, nessun punto.
    expect(carla).toMatchObject({ played: false, points: 0, total: 0 });
    expect(wallet['Carla']).toBe(500);

    expect(awards).toEqual([
      { playerName: 'Anna', points: 400 },
      { playerName: 'Bruno', points: -100 },
    ]);
    expect(Object.values(wallet).every((points) => points >= 0)).toBe(true);

    const lastState = broadcasts.filter((event) => event.action === 'AZZARDO_STATE').at(-1)?.state;
    expect(lastState.phase).toBe('REVEAL');
    expect(lastState.rows).toHaveLength(3);

    mode.cleanup();
  });

  it('le fiches avanzate si sommano alle dieci nuove della manche dopo', async () => {
    vi.useFakeTimers();

    const wallet: Record<string, number> = { Anna: 1000 };
    const mode = new AzzardoMode();
    mode.setConfig({
      type: 'AZZARDO',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
      playerPoints: (playerName) => wallet[playerName] ?? 0,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
    });
    mode.initialize({ level: 1, questions: QUESTIONS });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    expect(mode.getDisplayData().ready[0].chipsBank).toBe(10);

    // Manche 1: tre fiches su un'opzione, le altre sette restano.
    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Anna',
      value: { chips: [3, 0, 0, 0] },
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(mode.getDisplayData().phase).toBe('REVEAL');

    await vi.advanceTimersByTimeAsync(7000);
    const second = mode.getDisplayData();
    expect(second.manche).toBe(2);
    // Sette avanzate + dieci nuove.
    expect(second.ready[0].chipsBank).toBe(17);

    // Non si può puntare più di quanto c'è nel salvadanaio.
    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Anna',
      value: { chips: [18, 0, 0, 0] },
    });
    expect(mode.getDisplayData().ready[0].chips).toEqual([]);

    mode.handlePartyEvent({
      action: 'AZZARDO_ACTION',
      playerName: 'Anna',
      value: { chips: [17, 0, 0, 0] },
    });
    expect(mode.getDisplayData().ready[0].chips).toEqual([17, 0, 0, 0]);

    mode.cleanup();
  });

  it('gioca le quattro manche con la perdita che scende dal 100% al 40%', async () => {
    vi.useFakeTimers();

    type Bet = { stake: number; correct: boolean };
    type Manche = {
      multiplier: number;
      bets: Record<string, Bet>;
      points: Record<string, number>;
      totals: Record<string, number>;
    };

    // Anna vince sempre 100 × 2, Bruno sbaglia sempre 200, Carla alterna.
    const plan: Manche[] = [
      {
        multiplier: 1,
        bets: { Anna: { stake: 100, correct: true }, Bruno: { stake: 200, correct: false }, Carla: { stake: 300, correct: true } },
        points: { Anna: 200, Bruno: -200, Carla: 600 },
        totals: { Anna: 200, Bruno: -200, Carla: 600 },
      },
      {
        multiplier: 0.8,
        bets: { Anna: { stake: 100, correct: true }, Bruno: { stake: 200, correct: false }, Carla: { stake: 300, correct: false } },
        points: { Anna: 200, Bruno: -160, Carla: -240 },
        totals: { Anna: 400, Bruno: -360, Carla: 360 },
      },
      {
        multiplier: 0.6,
        bets: { Anna: { stake: 100, correct: true }, Bruno: { stake: 200, correct: false }, Carla: { stake: 300, correct: true } },
        points: { Anna: 200, Bruno: -120, Carla: 600 },
        totals: { Anna: 600, Bruno: -480, Carla: 960 },
      },
      {
        multiplier: 0.4,
        bets: { Anna: { stake: 100, correct: true }, Bruno: { stake: 200, correct: false }, Carla: { stake: 300, correct: false } },
        points: { Anna: 200, Bruno: -80, Carla: -120 },
        totals: { Anna: 800, Bruno: -560, Carla: 840 },
      },
    ];

    const wallet: Record<string, number> = { Anna: 1000, Bruno: 1000, Carla: 1000 };
    const mode = new AzzardoMode();
    mode.setConfig({
      type: 'AZZARDO',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna', 'Bruno', 'Carla'],
      playerPoints: (playerName) => wallet[playerName] ?? 0,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
    });
    mode.initialize({ level: 1, questions: QUESTIONS });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    for (const [index, step] of plan.entries()) {
      const bet = mode.getDisplayData();
      expect(bet.phase).toBe('BET');
      expect(bet.manche).toBe(index + 1);
      expect(bet.lossMultiplier).toBe(step.multiplier);

      // Chi gioca dal telefono ha dieci secondi di lettura prima che la
      // manche chiuda in anticipo: si aspetta quel tempo, poi si punta.
      await vi.advanceTimersByTimeAsync(10000);

      const question = QUESTIONS[index];
      for (const [playerName, choice] of Object.entries(step.bets)) {
        mode.handlePartyEvent({
          action: 'AZZARDO_ACTION',
          playerName,
          value: {
            stake: choice.stake,
            choice: choice.correct ? question.answerIndex : (question.answerIndex + 1) % 4,
          },
        });
      }

      const reveal = mode.getDisplayData();
      expect(reveal.phase).toBe('REVEAL');
      expect(reveal.value).toBe(question.value);
      for (const [playerName, points] of Object.entries(step.points)) {
        expect(reveal.rows.find((row: any) => row.playerName === playerName))
          .toMatchObject({ points, total: step.totals[playerName] });
      }

      // La classifica resta sempre sopra zero, manche dopo manche.
      expect(Object.values(wallet).every((points) => points >= 0)).toBe(true);

      await vi.advanceTimersByTimeAsync(7000);
    }

    const finale = mode.getDisplayData();
    expect(finale.phase).toBe('FINALE');

    const finalTotals = plan[plan.length - 1].totals;
    for (const playerName of ['Anna', 'Bruno', 'Carla']) {
      expect(finale.rows.find((row: any) => row.playerName === playerName))
        .toMatchObject({ total: finalTotals[playerName] });
    }

    // Il totale di fine round somma esattamente le quattro manche.
    expect(finale.rows.reduce((sum: number, row: any) => sum + row.total, 0)).toBe(1080);
    expect(wallet).toEqual({ Anna: 1800, Bruno: 440, Carla: 1840 });
    expect(Object.values(wallet).reduce((sum, points) => sum + points, 0)).toBe(4080);

    mode.cleanup();
  });

  it('mostra gli indizi della celebrità ogni cinque secondi senza svelare l\'anno', async () => {
    vi.useFakeTimers();

    const questions = [
      {
        ...QUESTIONS[0],
        media: {
          kind: 'celebrity',
          imageUrl: 'https://image.example/einstein.jpg',
          clues: ['fisico tedesco', 'Premio Nobel per la fisica', 'teoria della relatività'],
        },
      },
      ...QUESTIONS.slice(1),
    ];

    const mode = new AzzardoMode();
    mode.setConfig({
      type: 'AZZARDO',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
    });
    mode.initialize({ level: 1, questions });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    const first = mode.getDisplayData();
    expect(first.media).toMatchObject({ kind: 'celebrity' });
    expect(first.clue).toBe('fisico tedesco');
    expect(first.clueIndex).toBe(1);
    expect(first.clueTotal).toBe(3);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mode.getDisplayData().clue).toBe('Premio Nobel per la fisica');

    mode.cleanup();
  });

  it('usa la quota del livello ricevuto e ricade sul medio senza livello', async () => {
    vi.useFakeTimers();

    const cases: Array<{ payload: any; level: number; odds: number }> = [
      { payload: { level: 2, questions: QUESTIONS }, level: 2, odds: 3 },
      { payload: { level: 3, questions: QUESTIONS }, level: 3, odds: 4 },
      // Payload senza livello: la modalità riparte dal medio, ×3.
      { payload: { questions: QUESTIONS }, level: 2, odds: 3 },
    ];

    for (const testCase of cases) {
      const wallet: Record<string, number> = { Anna: 1000, Bruno: 1000 };
      const mode = new AzzardoMode();
      mode.setConfig({
        type: 'AZZARDO',
        payload: {},
        gameId: 1,
        activePlayers: ['Anna', 'Bruno'],
        playerPoints: (playerName) => wallet[playerName] ?? 0,
        onAnswerReceived: (data) => {
          wallet[data.playerName] += data.points;
        },
      });
      mode.initialize(testCase.payload);

      const started = mode.start();
      await vi.advanceTimersByTimeAsync(3000);
      await started;

      const bet = mode.getDisplayData();
      expect(bet.level).toBe(testCase.level);
      expect(bet.odds).toBe(testCase.odds);
      expect(bet.lossMultiplier).toBe(1);

      // La manche con tutti pronti non chiude prima dei dieci secondi.
      await vi.advanceTimersByTimeAsync(10000);

      const question = QUESTIONS[0];
      mode.handlePartyEvent({
        action: 'AZZARDO_ACTION',
        playerName: 'Anna',
        value: { stake: 100, choice: question.answerIndex },
      });
      mode.handlePartyEvent({
        action: 'AZZARDO_ACTION',
        playerName: 'Bruno',
        value: { stake: 100, choice: (question.answerIndex + 1) % 4 },
      });

      const reveal = mode.getDisplayData();
      expect(reveal.rows.find((row: any) => row.playerName === 'Anna'))
        .toMatchObject({ points: 100 * testCase.odds, total: 100 * testCase.odds });
      // La perdita non dipende dalla quota: alla prima manche è il 100%.
      expect(reveal.rows.find((row: any) => row.playerName === 'Bruno'))
        .toMatchObject({ points: -100, total: -100 });

      expect(wallet).toEqual({ Anna: 1000 + 100 * testCase.odds, Bruno: 900 });

      mode.cleanup();
      vi.clearAllTimers();
    }
  });
});
