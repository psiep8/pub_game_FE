import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GameModeType } from '../../shared/enums/game-mode-type';
import { ACT_DECKS } from '../../shared/schedule';
import {
  ACT_BASE,
  ACT_BEDS,
  ACT_NUMBERS,
  GAME_BEDS,
  allBedFiles,
  bedForGame,
  type ActNumber,
} from './bed-map';

/**
 * La proiezione del §4.7: quanto pesa ogni atto il giorno che ogni gioco ha il
 * suo loop, rifatta da `ACT_DECKS` e `bed-map.ts`.
 *
 * <p>Un file in cartella pesa i suoi byte, uno che deve ancora arrivare pesa il
 * minimo delle regole: 60 s a 112 kbps, 0,80 MB. Così il conto non invecchia —
 * il giorno che il file arriva, il suo peso vero prende il posto del minimo
 * senza toccare una riga qui.</p>
 *
 * <p>Il doppio conteggio da cui è nato questo test — sommare l'alias che un
 * gioco suona oggi e il file che gli spetta domani — qui non è esprimibile:
 * ogni gioco occupa un solo slot, quindi non può pesare due volte. Gli alias
 * non si nominano: si contano i giochi.</p>
 *
 * <p>Il peso dei file veri, senza proiezioni, lo controlla già
 * `audio-assets.spec.ts`; qui interessa cosa succede quando i tredici mancanti
 * arrivano.</p>
 */
/** La cartella si cerca dalla radice del progetto: il runner parte da lì. */
const AUDIO_ROOT = [
  join(process.cwd(), 'public/assets/audio'),
  join(process.cwd(), 'apps/frontend/public/assets/audio'),
].find((dir) => existsSync(join(dir, 'FONTI.txt'))) ?? join(process.cwd(), 'public/assets/audio');

/** Il minimo delle regole dei file: 60 s a 112 kbps. */
const LOOP_FLOOR_BYTES = Math.round(60 * (112_000 / 8));

/** Tetti del manifesto: 22 MB per i venti loop, 6 MB per un atto. */
const TOTAL_BUDGET_BYTES = 22 * 1024 * 1024;
const ACT_BUDGET_BYTES = 6 * 1024 * 1024;

/** Quanti loop promette il manifesto. Se cambia, cambia anche il §4.7. */
const MANIFEST_LOOPS = 20;

/**
 * Il loop che spetta a ogni gioco quando arriva. Finché il file non c'è,
 * `GAME_BEDS` manda il gioco sul loop di un altro: la mappa resta quella che
 * suona oggi, questo è quello che suonerà. Appena il file entra in cartella, il
 * test qui sotto vuole la mappa allineata al piano.
 */
const PLANNED: Partial<Record<GameModeType, string>> = {
  ARENA: 'loop/gioco-arena.m4a',
  SPEED_RUSH: 'loop/gioco-speed-rush.m4a',
  BIGLIE: 'loop/gioco-biglie.m4a',
  TIMELINE: 'loop/gioco-timeline.m4a',
  ULTIMA_SPIAGGIA: 'loop/gioco-ultima-spiaggia.m4a',
  AZZARDO: 'loop/gioco-azzardo.m4a',
  BLACKJACK: 'loop/gioco-blackjack.m4a',
};

/** Fra i venti ma fuori dalla scaletta: il rotolamento e il finale di serata. */
const OFF_SCHEDULE = ['loop/biglie.m4a', 'loop/gioco-casino-finale.m4a'];

/** Peso vero se il file c'è, altrimenti il minimo che dovrà rispettare. */
function sizeOf(file: string): number {
  const path = join(AUDIO_ROOT, file);
  return existsSync(path) ? statSync(path).size : LOOP_FLOOR_BYTES;
}

/** Il file che il gioco suonerà: il suo, oppure quello che suona adesso. */
function slotOf(type: GameModeType): string | null {
  const planned = PLANNED[type];
  if (planned) return planned;
  const bed = GAME_BEDS[type];
  if (!bed || bed === ACT_BASE) return null;
  return bed.file;
}

/**
 * Gli slot di un atto: la base e un file per gioco, non per round. Un gioco che
 * esce due volte nell'atto (come il Quiz nell'atto 1) occupa un solo slot: il
 * suo loop è lo stesso file, e contarlo due volte non è un alias.
 */
function slotsOf(act: ActNumber): string[] {
  const games = [...new Set(ACT_DECKS[act - 1])]
    .map(slotOf)
    .filter((file): file is string => file !== null);
  return [ACT_BEDS[act].file, ...games];
}

/** Peso di un elenco di file, ognuno contato una volta. */
function weightOf(files: readonly string[]): number {
  return [...new Set(files)].reduce((total, file) => total + sizeOf(file), 0);
}

/** I venti loop del manifesto: quelli della mappa, il piano e i due fuori orario. */
function catalogue(): string[] {
  return [...new Set([...allBedFiles(), ...Object.values(PLANNED), ...OFF_SCHEDULE])];
}

/** I loop già in cartella, chiunque li suoni. */
function onDisk(): string[] {
  return readdirSync(join(AUDIO_ROOT, 'loop'))
    .filter((name) => name.endsWith('.m4a'))
    .map((name) => `loop/${name}`);
}

const mb = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

describe('Peso dei sottofondi per atto', () => {
  it('un gioco, un file: la base più i giochi della scaletta', () => {
    for (const act of ACT_NUMBERS) {
      const files = slotsOf(act);
      expect(
        new Set(files).size,
        `atto ${act}: due giochi sullo stesso file, uno dei due è ancora l'alias`,
      ).toBe(files.length);
    }

    // L'atto 1, con i conti giusti: base e quattro giochi sul loro loop. Il
    // vecchio conto ci sommava anche `gioco-casino` e `gioco-bomba`, gli alias
    // di Azzardo e Speed Rush, e leggeva 6,64 MB dove ce ne sono 4,00.
    expect(new Set(slotsOf(1))).toEqual(new Set([
      'loop/atto-1.m4a',
      'loop/gioco-azzardo.m4a',
      'loop/gioco-timeline.m4a',
      'loop/gioco-speed-rush.m4a',
      'loop/gioco-ultima-spiaggia.m4a',
    ]));
  });

  it('con ogni gioco sul suo loop nessun atto sfonda i 6 MB', () => {
    for (const act of ACT_NUMBERS) {
      const files = slotsOf(act);
      const weight = weightOf(files);
      expect(weight, `atto ${act}: ${[...new Set(files)].join(', ')} = ${mb(weight)}`)
        .toBeLessThanOrEqual(ACT_BUDGET_BYTES);
    }
  });

  it('i venti loop del manifesto stanno sotto i 22 MB', () => {
    const loops = catalogue();
    expect(
      loops.length,
      'il manifesto promette venti loop: se l’elenco è cambiato, cambia anche §4.7',
    ).toBe(MANIFEST_LOOPS);

    const weight = weightOf(loops);
    expect(weight, `venti loop = ${mb(weight)}`).toBeLessThanOrEqual(TOTAL_BUDGET_BYTES);
  });

  it('nessun loop in cartella resta fuori dal conto', () => {
    const known = new Set(catalogue());
    const orfani = onDisk().filter((file) => !known.has(file));
    expect(orfani, 'in cartella ma in nessun conto: il tetto non li vede').toEqual([]);
  });

  it('un loop arrivato è quello che la mappa fa suonare', () => {
    for (const type of Object.keys(PLANNED) as GameModeType[]) {
      const file = PLANNED[type];
      // Il piano vale finché il file manca: appena c'è, tocca alla mappa.
      if (!file || !existsSync(join(AUDIO_ROOT, file))) continue;
      expect(bedForGame(type)?.file, `${file} è in cartella ma ${type} suona ancora l’alias`)
        .toBe(file);
    }
  });
});
