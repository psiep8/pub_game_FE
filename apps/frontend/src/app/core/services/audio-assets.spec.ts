import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AUDIO_EVENTS, type AudioEventId } from './audio-catalog';
import { AUDIO_FILES } from './audio-files';
import { BED_LOOPS } from './bed-loops';

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

function sizeOf(relative: string): number {
  const absolute = join(AUDIO_ROOT, relative);
  if (!existsSync(absolute)) return 0;
  return statSync(absolute).size;
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
    const bytes = playedFiles.reduce((total, file) => total + sizeOf(file), 0);
    expect(bytes).toBeLessThan(15 * 1024 * 1024);
  });

  it('usa solo formati che Safari legge', () => {
    for (const file of playedFiles) {
      expect(file.endsWith('.m4a'), file).toBe(true);
    }
  });
});
