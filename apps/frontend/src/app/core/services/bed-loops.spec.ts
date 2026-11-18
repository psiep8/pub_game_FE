import { describe, expect, it } from 'vitest';

import { BED_LOOPS, bedLoopForGame } from './bed-loops';

describe('Sottofondi registrati', () => {
  it('ha sei famiglie, ognuna con un file diverso', () => {
    const loops = Object.values(BED_LOOPS);
    expect(loops).toHaveLength(6);
    expect(new Set(loops.map((loop) => loop.file)).size).toBe(6);
    for (const loop of loops) {
      expect(loop.label.length, loop.id).toBeGreaterThan(3);
      expect(loop.file, loop.id).toMatch(/^loop\/[a-z]+\.m4a$/);
      expect(loop.games.length, loop.id).toBeGreaterThan(0);
    }
  });

  it('manda ogni gioco nella famiglia del manifesto', () => {
    expect(bedLoopForGame('QUIZ').id).toBe('pub');
    expect(bedLoopForGame('MUSIC').id).toBe('pub');
    expect(bedLoopForGame('IMAGE_BLUR').id).toBe('pub');
    expect(bedLoopForGame('TIMELINE').id).toBe('pub');
    expect(bedLoopForGame('ULTIMA_SPIAGGIA').id).toBe('pub');

    expect(bedLoopForGame('BOMBA').id).toBe('tensione');
    expect(bedLoopForGame('ARENA').id).toBe('tensione');
    expect(bedLoopForGame('TIME_BUZZER').id).toBe('tensione');
    expect(bedLoopForGame('SPEED_RUSH').id).toBe('tensione');

    expect(bedLoopForGame('TENNIS_BATTLE').id).toBe('sport');
    expect(bedLoopForGame('BIGLIE').id).toBe('sport');

    expect(bedLoopForGame('AZZARDO').id).toBe('casino');
    expect(bedLoopForGame('WHEEL_OF_FORTUNE').id).toBe('casino');
    expect(bedLoopForGame('BLACKJACK').id).toBe('casino');
    expect(bedLoopForGame('CASINO_COLOR').id).toBe('casino');
    expect(bedLoopForGame('CASINO_DOZEN').id).toBe('casino');
    expect(bedLoopForGame('CASINO_NUMBER').id).toBe('casino');

    expect(bedLoopForGame('CAVALLO').id).toBe('leggero');

    expect(bedLoopForGame('LEADERBOARD').id).toBe('classifica');
    expect(bedLoopForGame('LEADERBOARD_DETAILED').id).toBe('classifica');
    expect(bedLoopForGame('PODIUM').id).toBe('classifica');
  });

  it('lascia la lobby e i tipi sconosciuti sul pub', () => {
    expect(bedLoopForGame(null).id).toBe('pub');
    expect(bedLoopForGame(undefined).id).toBe('pub');
    expect(bedLoopForGame('').id).toBe('pub');
    expect(bedLoopForGame('NON_ESISTE').id).toBe('pub');
  });
});
