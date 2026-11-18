import { describe, expect, it } from 'vitest';

import { GAME_MODE_TYPES } from '../../shared/enums/game-mode-type';
import { BED_LOOPS, GAME_BEDS, SILENT_GAME_TYPES, bedForGame } from './bed-loops';

describe('Sottofondi registrati', () => {
  it('ha un sottofondo per ogni gioco vero, o il silenzio dichiarato', () => {
    const senzaBed = GAME_MODE_TYPES.filter(
      (type) => !GAME_BEDS[type] && !SILENT_GAME_TYPES.includes(type),
    );
    expect(senzaBed, `giochi senza sottofondo né silenzio: ${senzaBed.join(', ')}`).toEqual([]);

    for (const type of GAME_MODE_TYPES) {
      const bed = bedForGame(type);
      const silent = SILENT_GAME_TYPES.includes(type);
      if (silent) {
        expect(bed, `${type} deve suonare nel silenzio`).toBeNull();
      } else {
        expect(bed, `${type} deve avere un loop`).not.toBeNull();
        if (!bed) continue;
        expect(BED_LOOPS[bed.id], `${type} punta a un id inesistente`).toBeTruthy();
      }
    }
  });

  it('non inventa tipi e non dichiara muto un gioco che ha un sottofondo', () => {
    const veri = new Set<string>(GAME_MODE_TYPES);
    const fantasmi = Object.keys(GAME_BEDS).filter((type) => !veri.has(type));
    expect(fantasmi, `tipi nella mappa che il gioco non conosce: ${fantasmi.join(', ')}`).toEqual([]);

    const doppi = SILENT_GAME_TYPES.filter((type) => GAME_BEDS[type]);
    expect(doppi, `dichiarati muti ma con un loop: ${doppi.join(', ')}`).toEqual([]);
  });

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
    expect(bedForGame('QUIZ')?.id).toBe('lobby');
    expect(bedForGame('IMAGE_BLUR')?.id).toBe('lobby');
    expect(bedForGame('WHEEL_OF_FORTUNE')?.id).toBe('lobby');
    expect(bedForGame('TIMELINE')?.id).toBe('lobby');
    expect(bedForGame('ULTIMA_SPIAGGIA')?.id).toBe('lobby');

    expect(bedForGame('BOMBA')?.id).toBe('gioco-bomba');
    expect(bedForGame('ARENA')?.id).toBe('gioco-bomba');
    expect(bedForGame('SPEED_RUSH')?.id).toBe('gioco-bomba');

    expect(bedForGame('TENNIS_BATTLE')?.id).toBe('gioco-tennis');
    expect(bedForGame('BIGLIE')?.id).toBe('gioco-tennis');

    expect(bedForGame('AZZARDO')?.id).toBe('gioco-casino');
    expect(bedForGame('BLACKJACK')?.id).toBe('gioco-casino');
  });

  it('lascia Musica e Time Buzzer in silenzio', () => {
    expect(bedForGame('MUSIC')).toBeNull();
    expect(bedForGame('TIME_BUZZER')).toBeNull();
    expect(GAME_BEDS.MUSIC).toBeNull();
    expect(GAME_BEDS.TIME_BUZZER).toBeNull();
  });

  it('lascia la lobby e i tipi sconosciuti sul file della lobby', () => {
    expect(bedForGame(null)?.id).toBe('lobby');
    expect(bedForGame(undefined)?.id).toBe('lobby');
    expect(bedForGame('')?.id).toBe('lobby');
    expect(bedForGame('LEADERBOARD')?.id).toBe('lobby');
    expect(bedForGame('NON_ESISTE')?.id).toBe('lobby');
  });
});
