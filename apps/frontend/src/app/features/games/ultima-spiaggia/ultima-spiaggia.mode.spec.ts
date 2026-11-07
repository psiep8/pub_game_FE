import { vi } from 'vitest';
import { UltimaSpiaggiaMode } from './ultima-spiaggia.mode';

const QUESTIONS = [100, 200, 300, 400, 500].map((level) => ({
  level,
  question: `Domanda da ${level} punti`,
  category: 'Storia',
  options: ['Roma', 'Milano', 'Napoli', 'Torino'],
  correctAnswer: 'Roma',
}));

describe('UltimaSpiaggiaMode (Ultima spiaggia)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gioca una sola manche e non ripropone i livelli consumati', async () => {
    vi.useFakeTimers();

    const wallet: Record<string, number> = { Anna: 1000, Bruno: 1000 };
    const recorded: Array<{ playerName: string; level: number }> = [];
    let ended = false;
    const mode = new UltimaSpiaggiaMode();
    mode.setConfig({
      type: 'ULTIMA_SPIAGGIA',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna', 'Bruno'],
      playerPoints: (playerName) => wallet[playerName] ?? 0,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
      onUltimaSpiaggiaLevel: (playerName, level) => recorded.push({ playerName, level }),
      onTimerEnd: () => {
        ended = true;
      },
    });
    expect(mode.requiresBubbles).toBe(true);
    mode.initialize({
      category: 'Storia',
      questions: QUESTIONS,
      // Anna ha già usato il 100 in un Ultima spiaggia precedente.
      usedLevels: { Anna: [100] },
    });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    let levelPhase = mode.getDisplayData();
    expect(levelPhase.phase).toBe('LEVEL');
    expect(levelPhase.category).toBe('Storia');
    expect(levelPhase.round).toBe(1);
    expect(levelPhase.total).toBe(1);
    expect(levelPhase.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      used: [100],
      level: null,
    });

    // Il 100 è già consumato: il tocco viene ignorato.
    mode.handlePartyEvent({
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Anna', kind: 'LEVEL', value: 100,
    });
    expect((mode.getDisplayData().rows.find((row: any) => row.playerName === 'Anna') as any).level).toBeNull();

    mode.handlePartyEvent({
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Anna', kind: 'LEVEL', value: 200,
    });
    mode.handlePartyEvent({
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Bruno', kind: 'LEVEL', value: 500,
    });

    const questionPhase = mode.getDisplayData();
    expect(questionPhase.phase).toBe('QUESTION');
    expect(questionPhase.questions.every((question: any) => question.correctAnswer === null)).toBe(true);
    expect(questionPhase.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      level: 200,
      used: [100, 200],
    });
    expect(questionPhase.rows.find((row: any) => row.playerName === 'Bruno')).toMatchObject({
      level: 500,
      used: [500],
    });

    mode.handlePartyEvent({
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Anna', kind: 'ANSWER', value: 0,
    });
    mode.handlePartyEvent({
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Bruno', kind: 'ANSWER', value: 1,
    });

    const reveal = mode.getDisplayData();
    expect(reveal.phase).toBe('REVEAL');
    expect(reveal.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      level: 200,
      status: 'CORRECT',
      points: 200,
    });
    expect(reveal.rows.find((row: any) => row.playerName === 'Bruno')).toMatchObject({
      level: 500,
      status: 'WRONG',
      points: -250,
    });
    // I livelli vengono registrati subito, per la prossima occorrenza.
    expect(recorded).toEqual(expect.arrayContaining([
      { playerName: 'Anna', level: 200 },
      { playerName: 'Bruno', level: 500 },
    ]));
    expect(recorded.some((entry) => entry.playerName === 'Anna' && entry.level === 100)).toBe(false);
    expect(wallet).toEqual({ Anna: 1200, Bruno: 750 });

    // La manche si chiude senza avviare altri round interni.
    await vi.advanceTimersByTimeAsync(5000);
    expect(ended).toBe(true);
    expect(mode.getDisplayData().phase).toBe('REVEAL');
    expect(mode.isRevealed()).toBe(true);

    mode.cleanup();
  });

  it('auto-assegna solo un livello ancora disponibile e toglie metà se scade', async () => {
    vi.useFakeTimers();

    const wallet: Record<string, number> = { Anna: 1000 };
    const recorded: number[] = [];
    const mode = new UltimaSpiaggiaMode();
    mode.setConfig({
      type: 'ULTIMA_SPIAGGIA',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
      playerPoints: () => 1000,
      onAnswerReceived: (data) => {
        wallet[data.playerName] += data.points;
      },
      onUltimaSpiaggiaLevel: (_playerName, level) => recorded.push(level),
    });
    mode.initialize({
      category: 'Storia',
      questions: QUESTIONS,
      usedLevels: { Anna: [100, 200] },
    });

    const started = mode.start();
    await vi.advanceTimersByTimeAsync(3000);
    await started;

    // Nessuna scelta: il livello più basso ancora libero è il 300.
    await vi.advanceTimersByTimeAsync(12000);
    const questionPhase = mode.getDisplayData();
    expect(questionPhase.phase).toBe('QUESTION');
    expect((questionPhase.rows[0] as any).level).toBe(300);
    expect(recorded).toEqual([300]);

    // Nessuna risposta: scaduta, quindi −metà del livello.
    await vi.advanceTimersByTimeAsync(15000);
    const reveal = mode.getDisplayData();
    expect(reveal.phase).toBe('REVEAL');
    expect((reveal.rows[0] as any).points).toBe(-150);
    expect(wallet['Anna']).toBe(850);

    mode.cleanup();
  });
});
