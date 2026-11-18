import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AUDIO_EVENTS, type AudioEventId } from './audio-catalog';
import { AUDIO_FILES } from './audio-files';
import { BED_LOOPS } from './bed-loops';
import { ACT_BEDS } from './bed-map';

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

  it('resta sotto i 15 MB di audio', () => {
    const bytes = playedFiles.reduce(
      (total, file) => total + statSync(join(AUDIO_ROOT, file)).size,
      0,
    );
    expect(bytes).toBeLessThan(15 * 1024 * 1024);
  });

  it('i sottofondi restano in cache nel service worker', () => {
    const patterns = cachePatterns();
    expect(patterns.length, 'ngsw-config.json non trovato').toBeGreaterThan(0);

    const beds = [
      ...Object.values(BED_LOOPS).map((bed) => bed.file),
      ...Object.values(ACT_BEDS).map((bed) => bed.file),
    ];
    for (const file of new Set(beds)) {
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
