import { vi } from 'vitest';
import { QuotaMode } from './quota.mode';

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

describe('QuotaMode', () => {
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

    const mode = new QuotaMode();
    mode.setConfig({
      type: 'QUOTA',
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
      action: 'QUOTA_ACTION',
      playerName: 'Anna',
      value: { stake: 200, choice: question.answerIndex },
    });
    mode.handlePartyEvent({
      action: 'QUOTA_ACTION',
      playerName: 'Bruno',
      value: { stake: 300, choice: (question.answerIndex + 1) % 4 },
    });

    // Un secondo invio di Anna nella stessa manche non deve cambiare la puntata.
    mode.handlePartyEvent({
      action: 'QUOTA_ACTION',
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

    // Bruno: 300 richiesti ma solo 100 disponibili, quindi perde 100 (100%).
    expect(bruno).toMatchObject({ stake: 100, points: -100, total: -100 });
    expect(wallet['Bruno']).toBe(0);

    // Carla: nessuna puntata, nessun punto.
    expect(carla).toMatchObject({ played: false, points: 0, total: 0 });
    expect(wallet['Carla']).toBe(500);

    expect(awards).toEqual([
      { playerName: 'Anna', points: 400 },
      { playerName: 'Bruno', points: -100 },
    ]);
    expect(Object.values(wallet).every((points) => points >= 0)).toBe(true);

    const lastState = broadcasts.filter((event) => event.action === 'QUOTA_STATE').at(-1)?.state;
    expect(lastState.phase).toBe('REVEAL');
    expect(lastState.rows).toHaveLength(3);

    mode.cleanup();
  });
});
