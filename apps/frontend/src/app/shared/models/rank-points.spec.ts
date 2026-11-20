import { describe, expect, it } from 'vitest';
import { rankPoints, roundToTen } from './rank-points';

describe('rankPoints', () => {
  it('riproduce gli esempi della specifica per Speed Rush (800 / −400)', () => {
    expect([4, 5, 6, 8, 9, 10].map((n) => Array.from({ length: n }, (_, i) => rankPoints(i + 1, n, 800, -400))))
      .toEqual([
        [800, 400, -200, -400],
        [800, 400, 0, -200, -400],
        [800, 530, 270, -130, -270, -400],
        [800, 600, 400, 200, -100, -200, -300, -400],
        [800, 600, 400, 200, 0, -100, -200, -300, -400],
        [800, 640, 480, 320, 160, -80, -160, -240, -320, -400],
      ]);
  });

  it('funziona con i punti delle Biglie (500 / −400)', () => {
    expect([4, 8, 9].map((n) => Array.from({ length: n }, (_, i) => rankPoints(i + 1, n, 500, -400))))
      .toEqual([
        [500, 250, -200, -400],
        [500, 380, 250, 130, -100, -200, -300, -400],
        [500, 380, 250, 130, 0, -100, -200, -300, -400],
      ]);
  });

  it('con N dispari il posto di mezzo prende zero, con N pari nessuno', () => {
    for (let n = 2; n <= 12; n++) {
      const points = Array.from({ length: n }, (_, i) => rankPoints(i + 1, n, 300, -200));
      if (n % 2 === 1) {
        expect(points[Math.floor(n / 2)]).toBe(0);
      } else {
        expect(points).not.toContain(0);
      }
    }
  });

  it('non assegna punti fuori dalla classifica', () => {
    expect(rankPoints(0, 6, 800, -400)).toBe(0);
    expect(rankPoints(7, 6, 800, -400)).toBe(0);
    expect(rankPoints(1, 1, 800, -400)).toBe(0);
  });

  it('arrotonda alla decina, anche verso il basso negativo', () => {
    expect(roundToTen(533.33)).toBe(530);
    expect(roundToTen(-133.33)).toBe(-130);
    expect(roundToTen(-136)).toBe(-140);
    expect(roundToTen(0)).toBe(0);
  });
});
