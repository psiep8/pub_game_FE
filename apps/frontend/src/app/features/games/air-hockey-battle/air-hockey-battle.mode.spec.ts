import { AirHockeyBattleMode, trajectoryFor } from './air-hockey-battle.mode';

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
});
