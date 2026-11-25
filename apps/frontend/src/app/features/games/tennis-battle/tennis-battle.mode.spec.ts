import { vi } from 'vitest';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { TennisBattleMode, applyPoint, randomServe } from './tennis-battle.mode';

const PLAYERS = ['Anna', 'Bruno', 'Carla', 'Dario'];

function side(playerName: string, extra: any = {}) {
  return { playerName, score: 0, games: 0, isBot: false, shots: 0, ...extra };
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

function setup(extra: Partial<GameModeConfig> = {}) {
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
    ...extra,
  };

  mode.setConfig(config);
  mode.initialize({});

  return { mode, saved, points };
}

describe('TennisBattleMode — regole di sala', () => {
  it('con squadre dispari riposa la prima in classifica, a zero punti', async () => {
    // F-07: prima il giocatore lasciato fuori era casuale e vinceva la sfida
    // a tavolino, con i 500 punti. Ora riposa chi è davanti e non gioca.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { mode, points } = setup({ activePlayers: ['Anna', 'Bruno', 'Carlo'] });

    await mode.start();

    const names = mode.getDisplayData().courts
      .flatMap((court: any) => [court.a.playerName, court.b.playerName]);
    expect(names).not.toContain('RIPOSO');
    expect(names).not.toContain('Anna');
    expect([...names].sort()).toEqual(['Bruno', 'Carlo']);
    expect(points).toEqual([]);

    mode.cleanup();
    vi.restoreAllMocks();
  });
});

describe('TennisBattleMode — game, partita e killer point', () => {
  it('vince chi fa due game: il primo game non chiude la partita', () => {
    // F-07: partita al meglio di tre game, chi ne vince due chiude la sfida.
    const primo = applyPoint(
      court(0, 'Anna', 'Bruno', { a: side('Anna', { score: 40 }), b: side('Bruno', { score: 30 }) }),
      'a',
    );
    expect(primo.a.games).toBe(1);
    expect(primo.winner).toBeNull();

    const secondo = applyPoint(
      court(0, 'Anna', 'Bruno', { a: side('Anna', { score: 40, games: 1 }), b: side('Bruno', { score: 30 }) }),
      'a',
    );
    expect(secondo.a.games).toBe(2);
    expect(secondo.winner).toBe('Anna');
  });

  it('sul 40-40 si va dritti al killer point, senza vantaggi', () => {
    let campo: any = court(0, 'Anna', 'Bruno', {
      a: side('Anna', { score: 40 }),
      b: side('Bruno', { score: 40 }),
    });

    // Il punto sul 40-40 non dà il vantaggio: arma il killer point.
    campo = applyPoint(campo, 'a');
    expect(campo.a.score).toBe(40);
    expect(campo.b.score).toBe(40);
    expect(campo.killerPoint).toBe(true);

    // Il punto dopo decide il game.
    campo = applyPoint(campo, 'a');
    expect(campo.a.games).toBe(1);
    expect(campo.killerPoint).toBe(false);
    // Game chiuso: il game nuovo riparte da 0-0, senza contatori di vantaggi.
    expect(campo.a.score).toBe(0);
    expect(campo.b.score).toBe(0);
  });

  it('i tiri nuovi non sono sempre dritti', () => {
    // F-07: la palla di ogni punto ripartiva sempre dritta e a 450 ms.
    expect(randomServe(() => 0).trajectory).toBe('dritto');
    expect(randomServe(() => 0.5).trajectory).toBe('centrale');
    expect(randomServe(() => 0.9).trajectory).toBe('lento');
    expect(randomServe(() => 0.5).shotMs).not.toBe(randomServe(() => 0).shotMs);
  });

  it('un campo chiuso ignora le risposte successive', async () => {
    const { mode } = setup();
    await mode.start();
    const campo = mode.getDisplayData().courts[0];
    (mode as any).courts.update((courts: any[]) => courts.map((c: any) =>
      c.id === campo.id ? { ...c, winner: c.a.playerName, question: null } : c));

    const prima = JSON.stringify((mode as any).courts());
    mode.handlePartyEvent({ action: 'TENNIS_BATTLE_ANSWER', playerName: campo.a.playerName, answerIndex: 0 });
    expect(JSON.stringify((mode as any).courts())).toBe(prima);

    mode.cleanup();
  });
});

describe('TennisBattleMode — ripresa dopo un refresh della TV', () => {
  it('alza la difficoltà dopo due scambi e arriva al difficile dal quinto', () => {
    // F-07: la curva vecchia teneva EASY fino al terzo scambio e HARD solo
    // dall'ottavo: lo scambio restava facile troppo a lungo.
    const { mode } = setup();

    expect(mode.difficultyFor(0)).toBe('EASY');
    expect(mode.difficultyFor(1)).toBe('EASY');
    expect(mode.difficultyFor(2)).toBe('MEDIUM');
    expect(mode.difficultyFor(4)).toBe('MEDIUM');
    expect(mode.difficultyFor(5)).toBe('HARD');

    mode.cleanup();
  });

  it('salva i campi appena partono le sfide', async () => {
    const { mode, saved } = setup();

    await mode.start();

    const state = saved.at(-1)?.state;
    expect(state.courts).toHaveLength(2);
    expect(state.finished).toBe(false);

    mode.cleanup();
  });

  it('riprende i campi senza ripagare chi ha già chiuso la sfida', async () => {
    const { mode, points } = setup();
    const closed = court(0, 'Anna', 'Bruno', {
      winner: 'Anna',
      awarded: true,
      a: side('Anna', { games: 6 }),
    });

    await mode.restore(200, {
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

  it('il tempo di battuta riparte da quello rimasto', async () => {
    const { mode } = setup();

    await mode.restore(180, {
      revision: 4,
      state: { courts: [court(0, 'Anna', 'Bruno', { serveLeft: 8 })], savedAt: Date.now() - 5000 },
    });

    const data = mode.getDisplayData();
    expect(data.courts[0].serveLeft).toBe(3);
    expect(data.courts[0].question?.text).toBe('Domanda?');

    mode.cleanup();
  });

  it('riprende anche i killer point e le sfide in attesa', async () => {
    const { mode } = setup();

    await mode.restore(120, {
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

  it('non si rompe con un checkpoint senza stato utile', async () => {
    const { mode } = setup();

    await mode.restore(200, { revision: 6, state: { courts: 'x', pendingCourts: null } });

    expect(mode.getDisplayData().courts).toEqual([]);

    mode.cleanup();
  });

  it('ricarica la banca delle domande alla ripresa', async () => {
    const bank = [
      { text: 'Domanda dalla banca', options: ['A', 'B', 'C', 'D'], correctIndex: 0, difficulty: 'EASY' as const },
    ];
    const loader = vi.fn(async () => bank);
    const { mode } = setup({ loadTennisQuestions: loader });

    await mode.restore(200, {
      revision: 7,
      state: { courts: [court(0, 'Anna', 'Bruno')], savedAt: Date.now() },
    });

    expect(loader).toHaveBeenCalledOnce();
    // Le domande dei prossimi tiri arrivano di nuovo dalla banca, non solo dal codice.
    expect((mode as unknown as { questions: any[] }).questions[0].text).toBe('Domanda dalla banca');

    mode.cleanup();
  });

  it('se le sfide erano già decise il round chiude subito', async () => {
    const ended = vi.fn();
    const { mode, points } = setup({ onTimerEnd: ended });
    const won = (id: number, a: string, b: string) => court(id, a, b, {
      winner: a,
      awarded: true,
      a: side(a, { games: 6 }),
    });

    await mode.restore(200, {
      revision: 8,
      state: { courts: [won(0, 'Anna', 'Bruno'), won(1, 'Carla', 'Dario')], savedAt: Date.now() },
    });

    // Non si aspetta il timer generale e non si ripagano le sfide.
    expect(ended).toHaveBeenCalledOnce();
    expect(mode.isRevealed()).toBe(true);
    expect(points).toEqual([]);

    mode.cleanup();
  });

  it('con le sfide decise fa partire quelle in attesa, senza ripagare', async () => {
    const { mode, points } = setup();
    const won = (id: number, a: string, b: string) => court(id, a, b, {
      winner: a,
      awarded: true,
      a: side(a, { games: 6 }),
    });

    await mode.restore(120, {
      revision: 9,
      state: {
        courts: [won(0, 'Anna', 'Bruno'), won(1, 'Carla', 'Dario')],
        pendingCourts: [court(4, 'Elia', 'Franca')],
        savedAt: Date.now(),
      },
    });

    const data = mode.getDisplayData();
    expect(data.courts).toHaveLength(1);
    expect(data.courts[0].a.playerName).toBe('Elia');
    expect(data.courts[0].winner).toBeNull();
    expect(points).toEqual([]);

    mode.cleanup();
  });
});
