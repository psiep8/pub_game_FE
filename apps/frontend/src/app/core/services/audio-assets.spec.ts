import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AUDIO_EVENTS, type AudioEventId } from './audio-catalog';
import { AUDIO_FILES } from './audio-files';
import { BED_LOOPS } from './bed-loops';
import { ACT_BEDS, ACT_NUMBERS, bedsForAct } from './bed-map';

/**
 * Controlli del §7 della spec dei suoni veri: ogni evento ha il suo file, ogni
 * file è nei crediti, il peso resta sotto i 15 MB e i formati sono quelli che
 * Safari legge. Girano sui file veri in `public/assets/audio`, non sui doppi.
 */
/** La cartella si cerca dalla radice del progetto: il runner parte da lì. */
const AUDIO_ROOT = [
  join(process.cwd(), 'public/assets/audio'),
  join(process.cwd(), 'apps/frontend/public/assets/audio'),
].find((dir) => existsSync(join(dir, 'FONTI.txt'))) ?? join(process.cwd(), 'public/assets/audio');

/** Il peso si misura sui file che l'app suona davvero, non su `_src`. */
const playedFiles = [
  ...new Set(Object.values(AUDIO_FILES).flatMap((files) => files ?? [])),
  ...new Set(Object.values(BED_LOOPS).map((loop) => loop.file)),
].sort();

/**
 * Regole di cache del service worker: i glob di `ngsw-config.json`. Il file sta
 * nella radice di `apps/frontend`, quindi si cerca da entrambe le cwd.
 */
function cachePatterns(): string[] {
  const configPath = [
    join(process.cwd(), 'ngsw-config.json'),
    join(process.cwd(), 'apps/frontend/ngsw-config.json'),
  ].find((file) => existsSync(file));
  if (!configPath) return [];

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const assetGroups = Array.isArray(config.assetGroups) ? config.assetGroups : [];
  const dataGroups = Array.isArray(config.dataGroups) ? config.dataGroups : [];
  return [
    ...assetGroups.flatMap((group: any) => group?.resources?.urls ?? group?.resources?.files ?? []),
    ...dataGroups.flatMap((group: any) => group?.urls ?? []),
  ].map((pattern: unknown) => String(pattern));
}

/** Glob di ngsw: `**` attraversa le cartelle, `*` no. */
function matchesPattern(pattern: string, url: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${regex}$`).test(url);
}

/**
 * Tetti del §4.4: i venti sottofondi (5 basi d'atto, 14 giochi e bonus, il
 * rotolamento delle Biglie) stanno sotto i 22 MB e nessun atto da solo sfonda i
 * 6 MB fra la sua base e i loop dei giochi che la scaletta gli assegna. Un
 * file che non è ancora in cartella non pesa: il conto è su quelli veri.
 */
const SOTTOFONDI_BUDGET_BYTES = 22 * 1024 * 1024;
const ACT_BUDGET_BYTES = 6 * 1024 * 1024;
/** Gli effetti restano fuori dai conti degli atti ma non senza tetto. */
const EFFECTS_BUDGET_BYTES = 4 * 1024 * 1024;

/**
 * Il catalogo del §4.7 una volta per file: le basi d'atto, i loop dei giochi e
 * il rotolamento delle Biglie, che non passa da `BED_LOOPS` perché lo suona
 * `marble-roll.ts` con `AUDIO_FILES.marbleRoll`.
 */
function bedFiles(): string[] {
  return [
    ...new Set([
      ...Object.values(ACT_BEDS).map((bed) => bed.file),
      ...Object.values(BED_LOOPS).map((bed) => bed.file),
      ...(AUDIO_FILES['marbleRoll'] ?? []),
    ]),
  ];
}

/** Peso dei file che esistono davvero: i sottofondi mancanti non contano. */
function weightOf(files: readonly string[]): number {
  return files.reduce(
    (total, file) => (existsSync(join(AUDIO_ROOT, file))
      ? total + statSync(join(AUDIO_ROOT, file)).size
      : total),
    0,
  );
}

/** Righe di `FONTI.txt`: percorso | titolo | autore | URL | licenza. */
function creditedFiles(): string[] {
  return readFileSync(join(AUDIO_ROOT, 'FONTI.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => line.split('|')[0].trim());
}

describe('File audio della serata', () => {
  it('ogni evento del catalogo ha almeno un file registrato', () => {
    const ids = Object.keys(AUDIO_EVENTS) as AudioEventId[];
    // `ambient` è il sottofondo: i suoi file sono le sei famiglie, non un evento.
    const events = ids.filter((id) => AUDIO_EVENTS[id].source !== 'bed');
    expect(events.length).toBeGreaterThan(30);
    for (const id of events) {
      const files = AUDIO_FILES[id];
      expect(files?.length ?? 0, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('ogni file del catalogo e ogni sottofondo esiste su disco', () => {
    for (const file of playedFiles) {
      expect(existsSync(join(AUDIO_ROOT, file)), file).toBe(true);
    }
  });

  it('ogni file suonato ha la sua riga nei crediti', () => {
    const credits = new Set(creditedFiles());
    for (const file of playedFiles) {
      expect(credits.has(file), file).toBe(true);
    }
    // Anche il contrario: nessun credito punta a un file che non esiste.
    for (const file of credits) {
      expect(existsSync(join(AUDIO_ROOT, file)), file).toBe(true);
    }
  });

  it('gli effetti audio stanno sotto i 4 MB', () => {
    const effects = [...new Set(Object.values(AUDIO_FILES).flatMap((files) => files ?? []))];
    expect(weightOf(effects), 'il vecchio tetto dei 15 MB copriva anche gli effetti')
      .toBeLessThan(EFFECTS_BUDGET_BYTES);
  });

  it('i venti sottofondi stanno sotto i 22 MB', () => {
    expect(weightOf(bedFiles()), 'tetto del §4.4: 22 MB per i venti loop')
      .toBeLessThan(SOTTOFONDI_BUDGET_BYTES);
  });

  it('nessun atto sfonda il budget dei suoi sottofondi', () => {
    for (const act of ACT_NUMBERS) {
      const files = bedsForAct(act).map((bed) => bed.file);
      expect(weightOf(files), `atto ${act}: base più i giochi dell'atto`)
        .toBeLessThanOrEqual(ACT_BUDGET_BYTES);
    }
  });

  it('i sottofondi restano in cache nel service worker', () => {
    const patterns = cachePatterns();
    expect(patterns.length, 'ngsw-config.json non trovato').toBeGreaterThan(0);

    for (const file of bedFiles()) {
      const url = `/assets/audio/${file}`;
      expect(
        patterns.some((pattern) => matchesPattern(pattern, url)),
        `${url} non è in cache: senza la regola il servizio lo riscarica ogni volta`,
      ).toBe(true);
    }
  });

  it('usa solo formati che Safari legge', () => {
    for (const file of playedFiles) {
      expect(file.endsWith('.m4a'), file).toBe(true);
    }
  });
});
