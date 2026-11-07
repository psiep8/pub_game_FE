import { vi } from 'vitest';
import { ScommessaMode } from './scommessa.mode';

const QUESTIONS = [100, 200, 300, 400, 500].map((level) => ({
  level,
  question: `Domanda da ${level} punti`,
  category: 'Storia',
  options: ['Roma', 'Milano', 'Napoli', 'Torino'],
  correctAnswer: 'Roma',
}));

describe('ScommessaMode (Tutto o metà)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gioca cinque round usando ogni livello una volta e paga il livello o metà', async () => {
    vi.useFakeTimers();

    const wallet: Record<string, number> = { Anna: 1000, Bruno: 1000 };
    const mode = new ScommessaMode();
    mode.setConfig({
      type: 'SCOMMESSA',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna', 'Bruno'],
      playerPoints: (playerName) => wallet[playerName] ?? 0,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
    });
    mode.initialize({ category: 'Storia', questions: QUESTIONS });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    const rounds = [
      { picks: { Anna: { level: 100, correct: true }, Bruno: { level: 500, correct: false } }, points: { Anna: 100, Bruno: -250 } },
      { picks: { Anna: { level: 200, correct: true }, Bruno: { level: 400, correct: true } }, points: { Anna: 200, Bruno: 400 } },
      { picks: { Anna: { level: 300, correct: false }, Bruno: { level: 300, correct: false } }, points: { Anna: -150, Bruno: -150 } },
      { picks: { Anna: { level: 400, correct: false }, Bruno: { level: 200, correct: false } }, points: { Anna: -200, Bruno: -100 } },
      { picks: { Anna: { level: 500, correct: true }, Bruno: { level: 100, correct: true } }, points: { Anna: 500, Bruno: 100 } },
    ];

    for (const [index, round] of rounds.entries()) {
      const levelPhase = mode.getDisplayData();
      expect(levelPhase.phase).toBe('LEVEL');
      expect(levelPhase.round).toBe(index + 1);

      // Anna non può riusare il livello 100 del primo round.
      if (index === 1) {
        mode.handlePartyEvent({
          action: 'SCOMMESSA_ACTION', playerName: 'Anna', kind: 'LEVEL', value: 100,
        });
        const row = mode.getDisplayData().rows.find((entry: any) => entry.playerName === 'Anna');
        expect(row).toMatchObject({ level: null });
      }

      for (const [playerName, pick] of Object.entries(round.picks)) {
        mode.handlePartyEvent({
          action: 'SCOMMESSA_ACTION', playerName, kind: 'LEVEL', value: pick.level,
        });
      }

      const questionPhase = mode.getDisplayData();
      expect(questionPhase.phase).toBe('QUESTION');

      for (const [playerName, pick] of Object.entries(round.picks)) {
        const question = questionPhase.questions.find((entry: any) => entry.level === pick.level);
        expect(question).toMatchObject({
          question: QUESTIONS.find((entry) => entry.level === pick.level)?.question,
        });

        const correctIndex = ['Roma', 'Milano', 'Napoli', 'Torino'].indexOf('Roma');
        const answer = pick.correct ? correctIndex : (correctIndex + 1) % 4;
        mode.handlePartyEvent({
          action: 'SCOMMESSA_ACTION', playerName, kind: 'ANSWER', value: answer,
        });
      }

      const reveal = mode.getDisplayData();
      expect(reveal.phase).toBe('REVEAL');
      // Chi ha scelto lo stesso livello riceve la stessa domanda.
      if (index === 2) {
        const anna = reveal.rows.find((row: any) => row.playerName === 'Anna');
        const bruno = reveal.rows.find((row: any) => row.playerName === 'Bruno');
        expect(anna).toMatchObject({ level: 300 });
        expect(bruno).toMatchObject({ level: 300 });
      }

      for (const [playerName, expected] of Object.entries(round.points)) {
        const row = reveal.rows.find((entry: any) => entry.playerName === playerName);
        expect(row).toMatchObject({ points: expected });
      }

      await vi.advanceTimersByTimeAsync(5000);
    }

    const finale = mode.getDisplayData();
    expect(finale.phase).toBe('FINALE');

    const rows = finale.rows as any[];
    for (const row of rows) {
      expect(row.used).toHaveLength(5);
      expect(new Set(row.used).size).toBe(5);
    }
    expect(rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({ total: 450 });
    expect(rows.find((row: any) => row.playerName === 'Bruno')).toMatchObject({ total: 0 });
    expect(wallet).toEqual({ Anna: 1450, Bruno: 1000 });

    mode.cleanup();
  });

  it('auto-assegna il livello rimasto e toglie metà se la risposta scade', async () => {
    vi.useFakeTimers();

    const wallet: Record<string, number> = { Anna: 1000 };
    const mode = new ScommessaMode();
    mode.setConfig({
      type: 'SCOMMESSA',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
      playerPoints: () => 1000,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
    });
    mode.initialize({ category: 'Storia', questions: QUESTIONS });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    // Nessuna scelta: dopo i secondi del livello parte la domanda del livello più basso.
    await vi.advanceTimersByTimeAsync(12000);
    const questionPhase = mode.getDisplayData();
    expect(questionPhase.phase).toBe('QUESTION');
    expect((questionPhase.rows[0] as any).level).toBe(100);

    // Nessuna risposta: scaduta, quindi −metà del livello.
    await vi.advanceTimersByTimeAsync(15000);
    const reveal = mode.getDisplayData();
    expect(reveal.phase).toBe('REVEAL');
    expect((reveal.rows[0] as any).points).toBe(-50);
    expect(wallet['Anna']).toBe(950);

    mode.cleanup();
  });
});
