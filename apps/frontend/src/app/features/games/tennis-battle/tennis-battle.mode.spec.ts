import { TennisBattleMode, nextPoint, shotDurationFor, trajectoryFor } from './tennis-battle.mode';

describe('nextPoint: punteggio tennis', () => {
  const base = (over: Partial<{ score: 0 | 15 | 30 | 40 | 'adv'; games: number; deuceLosses: number }>) => ({
    playerName: 'x', score: 0 as 0 | 15 | 30 | 40 | 'adv', games: 0, deuceLosses: 0, isBot: false, shots: 0, ...over,
  });
  const court = (a: ReturnType<typeof base>, b: ReturnType<typeof base>, killerPoint = false) =>
    ({ id: 1, a, b, killerPoint } as any);

  it('sale 0 -> 15 -> 30 -> 40', () => {
    expect(nextPoint(court(base({ score: 0 }), base({ score: 0 })), 'a').scorerScore).toBe(15);
    expect(nextPoint(court(base({ score: 15 }), base({ score: 0 })), 'a').scorerScore).toBe(30);
    expect(nextPoint(court(base({ score: 30 }), base({ score: 0 })), 'a').scorerScore).toBe(40);
  });

  it('40 pari va al vantaggio, 40 contro meno vince il game', () => {
    expect(nextPoint(court(base({ score: 40 }), base({ score: 40 })), 'a').scorerScore).toBe('adv');
    expect(nextPoint(court(base({ score: 40 }), base({ score: 30 })), 'a').scorerGames).toBe(1);
  });

  it('dal vantaggio sbagliato si torna sul 40-40 e dopo 3 ritorni cè il killer point', () => {
    let state = court(base({ score: 40 }), base({ score: 'adv' }));
    const r1 = nextPoint(state, 'a');
    expect(r1.scorerScore).toBe(40);
    expect(r1.loserScore).toBe(40);
    expect(r1.deuceLosses).toBe(1);
    expect(r1.killerPoint).toBe(false);
    state = court(base({ score: 40, deuceLosses: 2 }), base({ score: 'adv', deuceLosses: 2 }));
    expect(nextPoint(state, 'a').killerPoint).toBe(true);
  });

  it('il killer point assegna il game senza altri vantaggi', () => {
    const r = nextPoint(court(base({ score: 40 }), base({ score: 40 }), true), 'a');
    expect(r.scorerGames).toBe(1);
    expect(r.killerPoint).toBe(false);
  });
});

describe('TennisBattleMode', () => {
  it('le fasce di difficoltà salgono con i tiri del giocatore', () => {
    const mode = new TennisBattleMode();

    expect(mode.difficultyFor(0)).toBe('EASY');
    expect(mode.difficultyFor(2)).toBe('EASY');
    expect(mode.difficultyFor(3)).toBe('MEDIUM');
    expect(mode.difficultyFor(7)).toBe('MEDIUM');
    expect(mode.difficultyFor(8)).toBe('HARD');
  });

  it('la pallina cambia direzione a ogni colpo, senza zig-zag', () => {
    expect(trajectoryFor(2000, 0)).toBe('dritto');
    expect(trajectoryFor(2000, 1)).toBe('diagonale');
    expect(trajectoryFor(2000, 2)).toBe('centrale');
    expect(trajectoryFor(2000, 3)).toBe('stretto');
    expect(trajectoryFor(2000, 4)).toBe('linea');
    expect(trajectoryFor(2000, 5)).toBe('corto');
    expect(trajectoryFor(2000, 6)).toBe('dritto');
    expect(trajectoryFor(9000, 1)).toBe('lob');
  });

  it('il tempo di risposta decide la velocità del disco', () => {
    // Risposta fulminea: fucilata. Risposta lunghissima: pallina lenta.
    expect(trajectoryFor(400, 0)).toBe('veloce');
    expect(trajectoryFor(12000, 0)).toBe('lento');

    expect(shotDurationFor(400, 0)).toBeLessThan(shotDurationFor(1000, 0));
    expect(shotDurationFor(12000, 0)).toBeGreaterThan(shotDurationFor(5000, 0));
    expect(shotDurationFor(12000, 0)).toBeGreaterThan(shotDurationFor(1000, 0));
  });
});
