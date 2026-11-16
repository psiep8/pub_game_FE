import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { TennisBattleMode } from './tennis-battle.mode';

const PLAYERS = ['Anna', 'Bruno', 'Carla', 'Dario'];

function side(playerName: string, extra: any = {}) {
  return { playerName, score: 0, games: 0, deuceLosses: 0, isBot: false, shots: 0, ...extra };
}

function court(id: number, a: string, b: string, extra: any = {}) {
  return {
    id,
    a: side(a),
    b: side(b),
    winner: null,
    turn: 'a',
    serveLeft: 12,
    question: { text: 'Domanda?', options: ['A', 'B'], correctIndex: 0, difficulty: 'EASY' },
    lastEvent: null,
    awarded: false,
    questionAt: Date.now(),
    shotMs: 450,
    trajectory: 'dritto',
    killerPoint: false,
    ...extra,
  };
}

function setup() {
  const saved: Array<{ type: string; revision: number; state: any }> = [];
  const points: any[] = [];
  const mode = new TennisBattleMode();
  const config: GameModeConfig = {
    type: 'TENNIS_BATTLE',
    payload: {},
    gameId: 1,
    activePlayers: PLAYERS,
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
    onAnswerReceived: (result) => points.push(result),
  };

  mode.setConfig(config);
  mode.initialize({});

  return { mode, saved, points };
}

describe('TennisBattleMode — ripresa dopo un refresh della TV', () => {
  it('salva i campi appena partono le sfide', async () => {
    const { mode, saved } = setup();

    await mode.start();

    const state = saved.at(-1)?.state;
    expect(state.courts).toHaveLength(2);
    expect(state.finished).toBe(false);

    mode.cleanup();
  });

  it('riprende i campi senza ripagare chi ha già chiuso la sfida', () => {
    const { mode, points } = setup();
    const closed = court(0, 'Anna', 'Bruno', {
      winner: 'Anna',
      awarded: true,
      a: side('Anna', { games: 6 }),
    });

    mode.restore(200, {
      revision: 3,
      state: { courts: [closed, court(1, 'Carla', 'Dario')], savedAt: Date.now() },
    });

    const data = mode.getDisplayData();
    expect(data.courts).toHaveLength(2);
    expect(data.courts[0].winner).toBe('Anna');
    expect(data.courts[0].a.games).toBe(6);
    expect(data.courts[1].winner).toBeNull();
    // Nessun accredito: i punti delle sfide erano già pagati.
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('il tempo di battuta riparte da quello rimasto', () => {
    const { mode } = setup();

    mode.restore(180, {
      revision: 4,
      state: { courts: [court(0, 'Anna', 'Bruno', { serveLeft: 8 })], savedAt: Date.now() - 5000 },
    });

    const data = mode.getDisplayData();
    expect(data.courts[0].serveLeft).toBe(3);
    expect(data.courts[0].question?.text).toBe('Domanda?');

    mode.cleanup();
  });

  it('riprende anche i killer point e le sfide in attesa', () => {
    const { mode } = setup();

    mode.restore(120, {
      revision: 5,
      state: {
        courts: [court(0, 'Anna', 'Bruno', { killerPoint: true, turn: 'b' })],
        pendingCourts: [court(4, 'Elia', 'Franca')],
        finished: false,
        savedAt: Date.now(),
      },
    });

    expect(mode.getDisplayData().courts[0].killerPoint).toBe(true);
    expect(mode.getDisplayData().courts[0].turn).toBe('b');

    mode.cleanup();
  });

  it('non si rompe con un checkpoint senza stato utile', () => {
    const { mode } = setup();

    mode.restore(200, { revision: 6, state: { courts: 'x', pendingCourts: null } });

    expect(mode.getDisplayData().courts).toEqual([]);

    mode.cleanup();
  });
});
