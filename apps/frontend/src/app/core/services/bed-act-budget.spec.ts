import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GameModeType } from '../../shared/enums/game-mode-type';
import { ACT_DECKS } from '../../shared/schedule';
import { ACT_BASE, ACT_BEDS, ACT_NUMBERS, GAME_BEDS, type ActNumber } from './bed-map';
import { BED_LOOPS } from './bed-loops';

/**
 * Il peso di un atto quando ogni gioco ha il suo loop: il conto che il §4.7
 * racconta a parole, qui rifatto da `ACT_DECKS` e `bed-map.ts`.
 *
 * <p>Serve a non ricadere nell'errore del documento: sommare il loop che un
 * gioco suona <i>oggi</i> (l'alias) e il file che gli spetta <i>domani</i>
 * conta due volte lo stesso gioco e gonfia l'atto di fantasia. Un gioco pesa
 * una volta sola: il suo file, se il manifesto lo prevede, altrimenti l'alias
 * che suona adesso.</p>
 */
/** La cartella si cerca dalla radice del progetto: il runner parte da lì. */
const AUDIO_ROOT = [
  join(process.cwd(), 'public/assets/audio'),
  join(process.cwd(), 'apps/frontend/public/assets/audio'),
].find((dir) => existsSync(join(dir, 'FONTI.txt'))) ?? join(process.cwd(), 'public/assets/audio');

/** Il minimo delle regole dei file: 60 s a 112 kbps. */
const LOOP_BUDGET_BYTES = Math.round(60 * (112_000 / 8));

/** Tetti del manifesto: 22 MB per i venti loop, 6 MB per un atto. */
const SOTTOFONDI_BUDGET_BYTES = 22 * 1024 * 1024;
const ACT_BUDGET_BYTES = 6 * 1024 * 1024;

/**
 * I loop che il manifesto prevede per i giochi che oggi si appoggiano a un
 * altro: il giorno che arrivano, `GAME_BEDS` li punta e l'alias sparisce.
 * Finché il file non è in cartella, nel conto pesa il minimo di 60 s.
 */
const FUTURE_LOOPS: Partial<Record<GameModeType, string>> = {
  ARENA: 'loop/gioco-arena.m4a',
  SPEED_RUSH: 'loop/gioco-speed-rush.m4a',
  BIGLIE: 'loop/gioco-biglie.m4a',
  TIMELINE: 'loop/gioco-timeline.m4a',
  ULTIMA_SPIAGGIA: 'loop/gioco-ultima-spiaggia.m4a',
  AZZARDO: 'loop/gioco-azzardo.m4a',
  BLACKJACK: 'loop/gioco-blackjack.m4a',
};

/** Il rotolamento delle Biglie: il suo file non passa da `BED_LOOPS`. */
const BIGLIE_ROLL = 'loop/biglie.m4a';

/** Il loop del finale di serata: sta fra i venti ma nessun gioco lo chiama. */
const CASINO_FINALE = 'loop/gioco-casino-finale.m4a';

/** Peso vero se il file c'è, altrimenti il minimo che dovrà rispettare. */
function weightOf(file: string): number {
  const path = join(AUDIO_ROOT, file);
  return existsSync(path) ? statSync(path).size : LOOP_BUDGET_BYTES;
}

const mb = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

/** I file che un atto mette in onda quando ogni gioco ha il suo loop. */
function actFiles(act: ActNumber): string[] {
  const files: string[] = [ACT_BEDS[act].file];
  for (const type of ACT_DECKS[act - 1]) {
    const future = FUTURE_LOOPS[type];
    if (future) {
      files.push(future);
      continue;
    }
    const bed = GAME_BEDS[type];
    if (!bed || bed === ACT_BASE) continue;
    files.push(bed.file);
  }
  return [...new Set(files)];
}

/** I venti loop del manifesto, uno per uno: basi, giochi e rotolamento. */
function manifestLoops(): string[] {
  return [
    ...Object.values(ACT_BEDS).map((bed) => bed.file),
    ...Object.values(BED_LOOPS).map((bed) => bed.file),
    BIGLIE_ROLL,
    ...Object.values(FUTURE_LOOPS),
    CASINO_FINALE,
  ];
}

describe('Peso dei sottofondi per atto', () => {
  it('con ogni gioco sul suo loop nessun atto sfonda i 6 MB', () => {
    for (const act of ACT_NUMBERS) {
      const files = actFiles(act);
      const weight = files.reduce((total, file) => total + weightOf(file), 0);
      expect(weight, `atto ${act}: ${files.join(', ')} = ${mb(weight)}`)
        .toBeLessThanOrEqual(ACT_BUDGET_BYTES);
    }
  });

  it('l’atto 1 non conta due volte l’alias e il file che lo sostituisce', () => {
    // Il vecchio conto sommava `gioco-casino` (Azzardo di oggi) e
    // `gioco-speed-rush` (Speed Rush di domani) insieme a `gioco-bomba`, e
    // leggeva 6,64 MB dove ce ne sono 4,00.
    expect(actFiles(1)).toEqual([
      'loop/atto-1.m4a',
      'loop/gioco-azzardo.m4a',
      'loop/gioco-timeline.m4a',
      'loop/gioco-speed-rush.m4a',
      'loop/gioco-ultima-spiaggia.m4a',
    ]);
    expect(actFiles(1)).not.toContain(BED_LOOPS['gioco-casino'].file);
    expect(actFiles(1)).not.toContain(BED_LOOPS['gioco-bomba'].file);
  });

  it('contare ogni gioco una volta dà il peso che il documento racconta', () => {
    const weight = actFiles(1).reduce((total, file) => total + weightOf(file), 0);
    // A 60 s per file sono cinque loop da 0,80 MB: 4,00 MB, non 6,64.
    expect(weight, `atto 1 = ${mb(weight)}`).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it('i venti loop restano sotto i 22 MB, con il margine del §4.7', () => {
    const loops = manifestLoops();
    expect(new Set(loops).size, 'i venti loop sono uno per file').toBe(20);

    const weight = loops.reduce((total, file) => total + weightOf(file), 0);
    expect(weight, `venti loop = ${mb(weight)}`).toBeLessThan(SOTTOFONDI_BUDGET_BYTES);
  });

  it('ogni atto suona solo file che stanno fra i venti del manifesto', () => {
    const loops = new Set(manifestLoops());
    for (const act of ACT_NUMBERS) {
      for (const file of actFiles(act)) {
        expect(loops.has(file), `atto ${act}: ${file} non è uno dei venti loop`).toBe(true);
      }
    }
  });
});
