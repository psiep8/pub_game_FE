import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GAME_MODE_TYPES } from '../../shared/enums/game-mode-type';
import { ACT_DECKS } from '../../shared/schedule';
import { BED_LOOPS } from './bed-loops';
import {
  ACT_BASE,
  ACT_BEDS,
  ACT_NUMBERS,
  GAME_BEDS,
  QUESTION_DUCK_DB,
  QUESTION_DUCK_GAMES,
  READY_ACTS,
  SILENT_GAME_TYPES,
  actBed,
  bedDuckGain,
  bedForGame,
  bedsForAct,
  ducksDuringQuestion,
  type BedTrack,
} from './bed-map';

/** La cartella si cerca dalla radice del progetto: il runner parte da lì. */
const AUDIO_ROOT = [
  join(process.cwd(), 'public/assets/audio'),
  join(process.cwd(), 'apps/frontend/public/assets/audio'),
].find((dir) => existsSync(join(dir, 'FONTI.txt'))) ?? join(process.cwd(), 'public/assets/audio');

/** Tutti i file che la mappa può mettere in onda. */
const knownFiles = new Set([
  ...Object.values(BED_LOOPS).map((loop) => loop.file),
  ...Object.values(ACT_BEDS).map((bed) => bed.file),
]);

describe('Mappa dei sottofondi — base d’atto', () => {
  it('ha una base per ogni atto, con il nome del manifesto', () => {
    expect(ACT_NUMBERS).toHaveLength(5);
    for (const act of ACT_NUMBERS) {
      const bed = ACT_BEDS[act];
      expect(bed.file, `atto ${act}`).toBe(`loop/atto-${act}.m4a`);
      expect(bed.id, `atto ${act}`).toBe(`atto-${act}`);
      expect(bed.label.length, `atto ${act}`).toBeGreaterThan(3);
    }
  });

  it('dichiara pronti solo gli atti che hanno il file in cartella', () => {
    const onDisk = ACT_NUMBERS.filter((act) => existsSync(join(AUDIO_ROOT, ACT_BEDS[act].file)));
    expect(
      [...READY_ACTS].sort(),
      'un atto arrivato va aggiunto a READY_ACTS, altrimenti la sua base resta la lobby',
    ).toEqual([...onDisk].sort());
  });

  it('non lascia mai la serata senza base', () => {
    for (const act of ACT_NUMBERS) {
      const bed = actBed(act);
      expect(bed, `atto ${act}: meglio la lobby di un loop che non parte`).toBeTruthy();
      expect(knownFiles.has(bed.file), `atto ${act}: ${bed.file} non è nella mappa`).toBe(true);
    }
    // Nessun atto aperto, o un numero che non esiste: la lobby.
    expect(actBed(null).id).toBe('lobby');
    expect(actBed(undefined).id).toBe('lobby');
    expect(actBed(0).id).toBe('lobby');
    expect(actBed(99).id).toBe('lobby');
  });

  it('il numero dell’atto si arrotonda, il resto è «nessun atto»', () => {
    expect(actBed(2.4).id).toBe(actBed(2).id);
    expect(actBed(Number.NaN).id).toBe('lobby');
  });
});

describe('Mappa dei sottofondi — giochi', () => {
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
        expect(knownFiles.has(bed.file), `${type} punta a ${bed.file}`).toBe(true);
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

  it('manda ogni gioco nel file che gli spetta', () => {
    // Giochi senza brano proprio: suonano la base d'atto.
    for (const type of ['QUIZ', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE'] as const) {
      expect(GAME_BEDS[type], type).toBe(ACT_BASE);
    }

    expect(bedForGame('BOMBA')?.id).toBe('gioco-bomba');
    expect(bedForGame('ARENA')?.id).toBe('gioco-arena');
    expect(bedForGame('SPEED_RUSH')?.id).toBe('gioco-speed-rush');

    expect(bedForGame('TENNIS_BATTLE')?.id).toBe('gioco-tennis');
    expect(bedForGame('BIGLIE')?.id).toBe('gioco-biglie');

    expect(bedForGame('AZZARDO')?.id).toBe('gioco-azzardo');
    expect(bedForGame('BLACKJACK')?.id).toBe('gioco-blackjack');

    expect(bedForGame('TIMELINE')?.id).toBe('gioco-timeline');
    expect(bedForGame('ULTIMA_SPIAGGIA')?.id).toBe('gioco-ultima-spiaggia');
  });

  it('lascia Musica e Time Buzzer in silenzio', () => {
    expect(bedForGame('MUSIC')).toBeNull();
    expect(bedForGame('TIME_BUZZER')).toBeNull();
    expect(GAME_BEDS.MUSIC).toBeNull();
    expect(GAME_BEDS.TIME_BUZZER).toBeNull();
  });

  it('lascia la lobby e i tipi sconosciuti sulla base d’atto', () => {
    expect(bedForGame(null)?.id).toBe('lobby');
    expect(bedForGame(undefined)?.id).toBe('lobby');
    expect(bedForGame('')?.id).toBe('lobby');
    expect(bedForGame('LEADERBOARD')?.id).toBe('lobby');
    expect(bedForGame('NON_ESISTE')?.id).toBe('lobby');
  });
});

describe('Mappa dei sottofondi — caricamento per atto', () => {
  it('un atto porta la sua base e i loop dei giochi della scaletta', () => {
    for (const act of ACT_NUMBERS) {
      const beds = bedsForAct(act);
      // La base c'è anche se il file non è ancora in cartella: è proprio quello
      // che si vuole mettere in memoria appena l'atto arriva.
      expect(beds[0], `atto ${act}`).toMatchObject({
        id: `atto-${act}`,
        file: `loop/atto-${act}.m4a`,
      });

      const attesi = ACT_DECKS[act - 1]
        .map((type) => GAME_BEDS[type])
        .filter((bed): bed is BedTrack => !!bed && bed !== ACT_BASE)
        .map((bed) => bed.file);
      expect(beds.slice(1).map((bed) => bed.file), `atto ${act}`)
        .toEqual([...new Set(attesi)]);

      // Una volta ciascuno, niente muti e solo file che si possono suonare.
      expect(new Set(beds.map((bed) => bed.id)).size, `atto ${act}`).toBe(beds.length);
      expect(beds.every((bed) => bed.file.endsWith('.m4a')), `atto ${act}`).toBe(true);
    }
  });

  it('senza atto aperto carica la base di ripiego', () => {
    expect(bedsForAct(null).map((bed) => bed.id)).toEqual(['lobby']);
    expect(bedsForAct(undefined).map((bed) => bed.id)).toEqual(['lobby']);
    expect(bedsForAct(0).map((bed) => bed.id)).toEqual(['lobby']);
    expect(bedsForAct(99).map((bed) => bed.id)).toEqual(['lobby']);
  });
});

describe('Mappa dei sottofondi — −6 dB con la domanda aperta', () => {
  it('abbassa la base solo per Quiz e Indovina chi', () => {
    expect(ducksDuringQuestion('QUIZ')).toBe(true);
    expect(ducksDuringQuestion('IMAGE_BLUR')).toBe(true);
    expect(ducksDuringQuestion('BOMBA')).toBe(false);
    expect(ducksDuringQuestion('TIMELINE')).toBe(false);
    expect(ducksDuringQuestion('MUSIC')).toBe(false);
    expect(ducksDuringQuestion(null)).toBe(false);
    expect(ducksDuringQuestion(undefined)).toBe(false);
  });

  it('il guadagno è metà (−6 dB) solo con la domanda aperta', () => {
    const ducked = Math.pow(10, QUESTION_DUCK_DB / 20);
    expect(ducked).toBeCloseTo(0.501, 3);

    expect(bedDuckGain('QUIZ', true)).toBeCloseTo(ducked, 10);
    expect(bedDuckGain('IMAGE_BLUR', true)).toBeCloseTo(ducked, 10);
    expect(bedDuckGain('QUIZ', false)).toBe(1);
    expect(bedDuckGain('BOMBA', true)).toBe(1);
    expect(bedDuckGain('MUSIC', true)).toBe(1);
    expect(bedDuckGain(null, true)).toBe(1);
  });

  it('i giochi che abbassano la base sono tipi veri e non sono muti', () => {
    const veri = new Set<string>(GAME_MODE_TYPES);
    const fantasmi = QUESTION_DUCK_GAMES.filter((type) => !veri.has(type));
    expect(fantasmi, `tipi che il gioco non conosce: ${fantasmi.join(', ')}`).toEqual([]);

    const muti = QUESTION_DUCK_GAMES.filter((type) => SILENT_GAME_TYPES.includes(type));
    expect(muti, `dichiarati muti: non c'è niente da abbassare`).toEqual([]);
  });
});
