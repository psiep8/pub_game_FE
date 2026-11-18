import { describe, expect, it } from 'vitest';

import { BED_LOOPS, bedLoopForGame } from './bed-loops';

describe('Sottofondi registrati', () => {
  it('ha sei file per intanto, ognuno con un nome del manifesto', () => {
    const loops = Object.values(BED_LOOPS);
    expect(loops).toHaveLength(6);
    expect(new Set(loops.map((loop) => loop.file)).size).toBe(6);
    for (const loop of loops) {
      expect(loop.label.length, loop.id).toBeGreaterThan(3);
      expect(loop.file, loop.id).toMatch(/^loop\/(lobby|classifica|gioco-[a-z-]+)\.m4a$/);
    }
  });

  it('manda ogni gioco nel file che gli spetta', () => {
    expect(bedLoopForGame('QUIZ').id).toBe('lobby');
    expect(bedLoopForGame('MUSIC').id).toBe('lobby');
    expect(bedLoopForGame('IMAGE_BLUR').id).toBe('lobby');
    expect(bedLoopForGame('TIMELINE').id).toBe('lobby');
    expect(bedLoopForGame('ULTIMA_SPIAGGIA').id).toBe('lobby');

    expect(bedLoopForGame('BOMBA').id).toBe('gioco-bomba');
    expect(bedLoopForGame('ARENA').id).toBe('gioco-bomba');
    expect(bedLoopForGame('TIME_BUZZER').id).toBe('gioco-bomba');
    expect(bedLoopForGame('SPEED_RUSH').id).toBe('gioco-bomba');

    expect(bedLoopForGame('TENNIS_BATTLE').id).toBe('gioco-tennis');
    expect(bedLoopForGame('BIGLIE').id).toBe('gioco-tennis');

    expect(bedLoopForGame('AZZARDO').id).toBe('gioco-casino');
    expect(bedLoopForGame('WHEEL_OF_FORTUNE').id).toBe('gioco-casino');
    expect(bedLoopForGame('BLACKJACK').id).toBe('gioco-casino');
    expect(bedLoopForGame('CASINO_COLOR').id).toBe('gioco-casino');
    expect(bedLoopForGame('CASINO_DOZEN').id).toBe('gioco-casino');
    expect(bedLoopForGame('CASINO_NUMBER').id).toBe('gioco-casino');

    expect(bedLoopForGame('CAVALLO').id).toBe('gioco-cavallo');
  });

  it('lascia la lobby e i tipi sconosciuti sul file della lobby', () => {
    expect(bedLoopForGame(null).id).toBe('lobby');
    expect(bedLoopForGame(undefined).id).toBe('lobby');
    expect(bedLoopForGame('').id).toBe('lobby');
    expect(bedLoopForGame('LEADERBOARD').id).toBe('lobby');
    expect(bedLoopForGame('NON_ESISTE').id).toBe('lobby');
  });
});
