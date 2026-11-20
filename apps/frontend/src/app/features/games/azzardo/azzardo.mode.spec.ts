import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { AzzardoMode, AzzardoPhase } from './azzardo.mode';

const PAYLOAD = {
  level: 2,
  questions: [
    { question: 'Quanti abitanti?', category: 'Geografia', unit: 'abitanti', value: 300, options: [100, 200, 300, 400], answerIndex: 2 },
    { question: 'Quanto è alto?', category: 'Monumenti', unit: 'metri', value: 80, options: [40, 60, 80, 100], answerIndex: 2 },
    { question: 'Quanti anni ha?', category: 'Storia', unit: 'anni', value: 50, options: [10, 20, 50, 90], answerIndex: 2 },
    { question: 'Quanto pesa?', category: 'Scienza', unit: 'chili', value: 7, options: [1, 3, 7, 9], answerIndex: 2 },
  ],
};

function setup(players = ['Anna', 'Bruno']) {
  const saved: Array<{ type: string; revision: number; state: any }> = [];
  const points: any[] = [];
  const mode = new AzzardoMode();
  const config: GameModeConfig = {
    type: 'AZZARDO',
    payload: PAYLOAD,
    gameId: 1,
    activePlayers: players,
    playerPoints: () => 1000,
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
    onAnswerReceived: (result) => points.push(result),
  };

  mode.setConfig(config);
  mode.initialize(PAYLOAD);

  return { mode, saved, points };
}

describe('AzzardoMode — ripresa dopo un refresh della TV', () => {
  it('salva la puntata appena una squadra mette le fiches', async () => {
    const { mode, saved } = setup();

    await mode.start();
    mode.handlePartyEvent({ action: 'AZZARDO_ACTION', playerName: 'Anna', value: { chips: [0, 0, 3, 0] } });

    const state = saved.at(-1)?.state;
    expect(state.phase).toBe(AzzardoPhase.BET);
    expect(state.stakes).toEqual([{ playerName: 'Anna', chips: [0, 0, 3, 0] }]);
    expect(state.secondsLeft).toBeGreaterThan(0);

    mode.cleanup();
  });

  it('la pausa respinge la puntata arrivata dal telefono', async () => {
    const { mode, saved } = setup();
    await mode.start();

    mode.pause();
    // La pausa stessa salva il tempo congelato, senza la puntata rifiutata.
    const frozen = saved.at(-1);
    expect(frozen?.state.stakes).toEqual([]);
    expect(frozen?.state.pausedAt).toBeGreaterThan(0);

    mode.handlePartyEvent({ action: 'AZZARDO_ACTION', playerName: 'Anna', value: { chips: [0, 0, 3, 0] } });

    // A sala ferma la puntata non entra nel tavolo né in un nuovo checkpoint.
    expect(saved.at(-1)).toBe(frozen);

    mode.resume();
    // Alla ripresa il tempo torna a scorrere e la stessa puntata vale come sempre.
    expect(saved.at(-1)?.state.pausedAt).toBeNull();
    mode.handlePartyEvent({ action: 'AZZARDO_ACTION', playerName: 'Anna', value: { chips: [0, 0, 3, 0] } });
    expect(saved.at(-1)?.state.stakes).toEqual([{ playerName: 'Anna', chips: [0, 0, 3, 0] }]);

    mode.cleanup();
  });

  it('il refresh durante la pausa non scala il tempo fermo', async () => {
    const first = setup();
    await first.mode.start();
    first.mode.pause();

    const checkpoint = first.saved.at(-1)!;
    const frozen = checkpoint.state.secondsLeft;
    // La TV resta ferma trenta secondi prima del refresh.
    checkpoint.state.savedAt = Date.now() - 30_000;
    checkpoint.state.pausedAt = checkpoint.state.savedAt;
    first.mode.cleanup();

    const second = setup();
    second.mode.restore(15, checkpoint);

    // Il countdown riparte dai secondi congelati, non da quelli trascorsi.
    expect(second.mode.getDisplayData().secondsLeft).toBe(frozen);
    expect(second.mode.getDisplayData().phase).toBe(AzzardoPhase.BET);

    second.mode.cleanup();
  });

  it('riprende il reveal già avvenuto senza ripagare i punti', () => {
    const { mode, points } = setup();
    const stakes = [{ playerName: 'Anna', chips: [0, 0, 3, 0] }];

    mode.restore(7, {
      revision: 3,
      state: {
        manche: 0,
        phase: AzzardoPhase.REVEAL,
        secondsLeft: 7,
        savedAt: Date.now(),
        stakes,
        points: [['Anna', 600]],
        totals: [['Anna', 600]],
        chipBank: [['Anna', 7]],
        breakdowns: [['Anna', { points: 600, win: 600, loss: 0, odds: 3, lossPercent: 100 }]],
      },
    });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(AzzardoPhase.REVEAL);
    expect(data.rows[0]).toMatchObject({ playerName: 'Anna', points: 600, total: 600 });
    expect(data.value).toBe(300);
    // I punti del reveal non vengono ricalcolati al refresh.
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('riprende la puntata in corso con le fiches già sul tavolo', () => {
    const { mode } = setup();

    mode.restore(15, {
      revision: 4,
      state: {
        manche: 0,
        phase: AzzardoPhase.BET,
        secondsLeft: 15,
        savedAt: Date.now() - 6000,
        stakes: [{ playerName: 'Anna', chips: [0, 0, 3, 0] }],
        chipBank: [['Anna', 7], ['Bruno', 10]],
      },
    });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(AzzardoPhase.BET);
    expect(data.secondsLeft).toBe(9);
    expect(data.ready.find((row: any) => row.playerName === 'Anna')).toMatchObject({
      ready: true,
      chips: [0, 0, 3, 0],
      chipsBank: 7,
    });
    expect(data.ready.find((row: any) => row.playerName === 'Bruno')).toMatchObject({ ready: false });

    mode.cleanup();
  });

  it('con la puntata già scaduta va al reveal una volta sola', () => {
    const { mode, points } = setup();

    mode.restore(0, {
      revision: 5,
      state: {
        manche: 0,
        phase: AzzardoPhase.BET,
        secondsLeft: 15,
        savedAt: Date.now() - 60_000,
        stakes: [{ playerName: 'Anna', chips: [0, 0, 3, 0] }],
        chipBank: [['Anna', 7]],
      },
    });

    expect(mode.getDisplayData().phase).toBe(AzzardoPhase.REVEAL);
    expect(points.filter((row) => row.playerName === 'Anna')).toHaveLength(1);

    mode.cleanup();
  });

  it('non si rompe con un checkpoint senza stato utile', () => {
    const { mode } = setup();

    mode.restore(15, { revision: 6, state: { stakes: 'x', points: null, chipBank: 5 } });

    const data = mode.getDisplayData();
    expect(data.phase).toBe(AzzardoPhase.BET);
    expect(data.rows).toEqual([]);

    mode.cleanup();
  });
});
