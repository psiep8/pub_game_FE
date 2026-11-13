import { AirHockeyBattleMode, shotDurationFor, trajectoryFor } from './air-hockey-battle.mode';

describe('AirHockeyBattleMode', () => {
  it('le fasce di difficoltà salgono con i tiri del giocatore', () => {
    const mode = new AirHockeyBattleMode();

    expect(mode.difficultyFor(0)).toBe('EASY');
    expect(mode.difficultyFor(2)).toBe('EASY');
    expect(mode.difficultyFor(3)).toBe('MEDIUM');
    expect(mode.difficultyFor(7)).toBe('MEDIUM');
    expect(mode.difficultyFor(8)).toBe('HARD');
  });

  it('il disco non viaggia sempre dritto: quattro traiettorie diverse', () => {
    const seen = new Set([
      trajectoryFor(1000, 0),
      trajectoryFor(1000, 2),
      trajectoryFor(5000, 0),
      trajectoryFor(8000, 0),
    ]);

    expect(seen.size).toBe(4);
    expect(trajectoryFor(1000, 0)).toBe('dritto');
    expect(trajectoryFor(1000, 2)).toBe('salto');
    expect(trajectoryFor(5000, 0)).toBe('zigzag');
    expect(trajectoryFor(8000, 0)).toBe('curva');
  });

  it('il tempo di risposta decide anche la velocità del disco', () => {
    // Risposta fulminea: fucilata. Risposta lunghissima: disco pesante.
    expect(trajectoryFor(400, 0)).toBe('veloce');
    expect(trajectoryFor(9000, 0)).toBe('frenata');
    expect(trajectoryFor(12000, 0)).toBe('lento');
    expect(trajectoryFor(1000, 3)).toBe('accelerato');

    expect(shotDurationFor(400, 0)).toBeLessThan(shotDurationFor(1000, 0));
    expect(shotDurationFor(12000, 0)).toBeGreaterThan(shotDurationFor(5000, 0));
    expect(shotDurationFor(12000, 0)).toBeGreaterThan(shotDurationFor(1000, 0));
  });
});
