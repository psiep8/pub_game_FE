import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { UltimaSpiaggiaMode, UltimaSpiaggiaPhase } from './ultima-spiaggia.mode';

const PAYLOAD = {
  category: 'Storia',
  questions: [
    { level: 100, question: 'In che anno?', options: ['1900', '1910'], correctAnswer: '1900', category: 'Storia' },
    { level: 200, question: 'Chi era?', options: ['Anna', 'Bruno'], correctAnswer: 'Anna', category: 'Storia' },
  ],
};

function setup(players = ['Anna', 'Bruno']) {
  const saved: Array<{ type: string; revision: number; state: any }> = [];
  const points: any[] = [];
  const broadcasts: any[] = [];
  const mode = new UltimaSpiaggiaMode();
  const config: GameModeConfig = {
    type: 'ULTIMA_SPIAGGIA',
    payload: PAYLOAD,
    gameId: 1,
    activePlayers: players,
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
    onAnswerReceived: (result) => points.push(result),
    onBroadcast: (event) => broadcasts.push(event),
  };

  mode.setConfig(config);
  mode.initialize(PAYLOAD);

  return { mode, saved, points, broadcasts };
}

describe('UltimaSpiaggiaMode — ripresa dopo un refresh della TV', () => {
  it('salva la scelta del livello appena arriva', async () => {
    const { mode, saved } = setup();

    await mode.start();
    mode.handlePartyEvent({ action: 'ULTIMA_SPIAGGIA_ACTION', playerName: 'Anna', kind: 'LEVEL', value: 200 });

    const state = saved.at(-1)?.state;
    expect(state.phase).toBe(UltimaSpiaggiaPhase.LEVEL);
    expect(state.picks).toEqual([['Anna', 200]]);
    expect(state.used).toContainEqual(['Anna', [200]]);

    mode.cleanup();
  });

  it('riprende la scelta del livello con il tempo rimasto e lo stesso id', () => {
    const { mode } = setup();

    mode.restore(12, {
      revision: 3,
      state: {
        occurrenceId: 'occ-1',
        phase: UltimaSpiaggiaPhase.LEVEL,
        secondsLeft: 12,
        savedAt: Date.now() - 4000,
        picks: [['Anna', 200]],
        used: [['Anna', [200]]],
      },
    });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(UltimaSpiaggiaPhase.LEVEL);
    expect(data.secondsLeft).toBe(8);
    // Stesso id: i telefoni non azzerano la scelta appena fatta.
    expect(data.occurrenceId).toBe('occ-1');
    expect(data.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      level: 200,
      used: [200],
    });
    // Bruno non ha ancora scelto: il livello resta libero.
    expect(data.rows.find((row: any) => row.playerName === 'Bruno')).toMatchObject({ level: null });

    mode.cleanup();
  });

  it('riprende la domanda con le risposte già date, senza pagare nulla', () => {
    const { mode, points } = setup();

    mode.restore(15, {
      revision: 4,
      state: {
        occurrenceId: 'occ-2',
        phase: UltimaSpiaggiaPhase.QUESTION,
        secondsLeft: 15,
        savedAt: Date.now(),
        picks: [['Anna', 200], ['Bruno', 100]],
        answers: [['Anna', 0]],
        used: [['Anna', [200]], ['Bruno', [100]]],
      },
    });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(UltimaSpiaggiaPhase.QUESTION);
    expect(data.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({ answered: true });
    expect(data.rows.find((row: any) => row.playerName === 'Bruno')).toMatchObject({ answered: false });
    // Nessun esito è ancora stato calcolato.
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('il reveal già avvenuto non ripaga i punti', () => {
    const { mode, points, broadcasts } = setup();

    mode.restore(5, {
      revision: 5,
      state: {
        occurrenceId: 'occ-3',
        phase: UltimaSpiaggiaPhase.REVEAL,
        secondsLeft: 5,
        savedAt: Date.now(),
        picks: [['Anna', 200], ['Bruno', 100]],
        answers: [['Anna', 0]],
        points: [['Anna', 200], ['Bruno', -50]],
        totals: [['Anna', 200], ['Bruno', -50]],
        statuses: [['Anna', 'CORRECT'], ['Bruno', 'WRONG']],
      },
    });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(UltimaSpiaggiaPhase.REVEAL);
    expect(data.rows.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      points: 200,
      status: 'CORRECT',
    });
    expect(points).toEqual([]);
    // Lo stato torna ai telefoni: senza, dopo il refresh resterebbero vuoti.
    expect(broadcasts.at(-1)?.action).toBe('ULTIMA_SPIAGGIA_STATE');
    expect(broadcasts.at(-1)?.state.phase).toBe(UltimaSpiaggiaPhase.REVEAL);

    mode.cleanup();
  });

  it('con la domanda già scaduta va al reveal una volta sola', () => {
    const { mode, points } = setup();

    mode.restore(0, {
      revision: 6,
      state: {
        occurrenceId: 'occ-4',
        phase: UltimaSpiaggiaPhase.QUESTION,
        secondsLeft: 15,
        savedAt: Date.now() - 60_000,
        picks: [['Anna', 200], ['Bruno', 100]],
        answers: [['Anna', 0]],
      },
    });

    expect(mode.getDisplayData().phase).toBe(UltimaSpiaggiaPhase.REVEAL);
    expect(points).toHaveLength(2);

    mode.cleanup();
  });

  it('se tutti avevano risposto il reveal parte alla ripresa', () => {
    const { mode, points } = setup();

    mode.restore(10, {
      revision: 7,
      state: {
        occurrenceId: 'occ-5',
        phase: UltimaSpiaggiaPhase.QUESTION,
        secondsLeft: 10,
        savedAt: Date.now(),
        picks: [['Anna', 200], ['Bruno', 100]],
        answers: [['Anna', 0], ['Bruno', 1]],
      },
    });

    expect(mode.getDisplayData().phase).toBe(UltimaSpiaggiaPhase.REVEAL);
    expect(points).toHaveLength(2);

    mode.cleanup();
  });

  it('non si rompe con un checkpoint senza stato utile', () => {
    const { mode } = setup();

    mode.restore(12, { revision: 8, state: { picks: 'x', answers: null, statuses: 4 } });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(UltimaSpiaggiaPhase.LEVEL);
    expect(data.rows.every((row: any) => row.level === null)).toBe(true);

    mode.cleanup();
  });
});
