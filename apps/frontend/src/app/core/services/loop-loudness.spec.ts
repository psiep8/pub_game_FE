import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Il manifesto chiede −23 LUFS per i sottofondi. Il LUFS dice quanto un brano
 * «pesa» all'orecchio; il RMS dei campioni dice quanto è denso, e i due non
 * coincidono: un sub a 27 Hz non si sente ma riempie la forma d'onda. È così
 * che `gioco-ultima-spiaggia` era arrivato a −16,6 dB di RMS contro i −23…−25
 * degli altri, restando formalmente a −23 LUFS. Questo test misura i venti
 * file veri con ffmpeg e ferma un caso del genere.
 *
 * `ffmpeg` è quello statico di `.tools/`; dove non c'è (o con `FFMPEG_PATH`)
 * il controllo si salta: la suite non deve dipendere dal binario.
 */
const AUDIO_ROOT = [
  join(process.cwd(), 'public/assets/audio'),
  join(process.cwd(), 'apps/frontend/public/assets/audio'),
].find((dir) => existsSync(join(dir, 'FONTI.txt'))) ?? join(process.cwd(), 'public/assets/audio');

/** Il binario statico vive in `.tools/` alla radice: si cerca risalendo. */
function findFfmpeg(): string | undefined {
  const fromEnv = process.env['FFMPEG_PATH'];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (let up = 0; up <= 3; up += 1) {
    const root = join(process.cwd(), ...Array.from({ length: up }, () => '..'));
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const candidate = join(root, '.tools', 'ffmpeg', name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const FFMPEG = findFfmpeg();

/** Bersaglio del manifesto e tolleranza del codificatore. */
const LUFS_TARGET = -23;
const LUFS_TOLERANCE = 0.5;
/**
 * Tetto del RMS dei campioni: sopra −19 dB il brano è troppo denso per un
 * tappeto sotto la voce, anche se il LUFS è giusto. I venti file stanno fra
 * −19,7 e −25,5 dB.
 */
const RMS_CEILING = -19;
/** Picco vero massimo: il manifesto chiede ≤ −1,5 dBTP. */
const TRUE_PEAK_CEILING = -1.5;
/** I loop del manifesto: cinque basi d'atto, quattordici giochi, il rotolamento. */
const MANIFEST_LOOPS = 20;

function measure(file: string): { lufs: number | null; truePeak: number | null; rms: number | null } {
  const ffmpeg = FFMPEG;
  if (!ffmpeg) return { lufs: null, truePeak: null, rms: null };
  const run = (args: string[]) => spawnSync(ffmpeg, args, { encoding: 'utf8' }).stderr ?? '';

  const loudness = run([
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', 'ebur128=peak=true',
    '-f', 'null', '-',
  ]);
  const summary = loudness.slice(loudness.lastIndexOf('Summary:'));
  const lufs = Number(summary.match(/I:\s*(-?[0-9.]+) LUFS/)?.[1]);
  const truePeak = Number(summary.match(/Peak:\s*(-?[0-9.]+) dBFS/)?.[1]);

  const volume = run([
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', 'volumedetect',
    '-f', 'null', '-',
  ]);
  const rms = Number(volume.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1]);

  return {
    lufs: Number.isFinite(lufs) ? lufs : null,
    truePeak: Number.isFinite(truePeak) ? truePeak : null,
    rms: Number.isFinite(rms) ? rms : null,
  };
}

describe.skipIf(!FFMPEG)('Loudness dei venti sottofondi', () => {
  const loops = existsSync(join(AUDIO_ROOT, 'loop'))
    ? readdirSync(join(AUDIO_ROOT, 'loop')).filter((name) => name.endsWith('.m4a')).sort()
    : [];

  it('misura tutti e venti i loop', () => {
    expect(loops, 'il manifesto promette venti sottofondi').toHaveLength(MANIFEST_LOOPS);
  });

  it('ogni loop sta a −23 LUFS, con un RMS e un picco da tappeto', () => {
    const misure = loops.map((name) => ({
      name,
      ...measure(join(AUDIO_ROOT, 'loop', name)),
    }));

    for (const row of misure) {
      expect(row.lufs, `${row.name}: loudness non misurabile`).not.toBeNull();
      expect(
        Math.abs((row.lufs ?? -99) - LUFS_TARGET),
        `${row.name}: ${row.lufs} LUFS, fuori dal bersaglio ${LUFS_TARGET} ± ${LUFS_TOLERANCE}`,
      ).toBeLessThanOrEqual(LUFS_TOLERANCE);

      expect(row.rms, `${row.name}: RMS non misurabile`).not.toBeNull();
      expect(
        row.rms ?? 0,
        `${row.name}: RMS ${row.rms} dB, sopra il tetto di ${RMS_CEILING} dB — il brano è ` +
          'più denso degli altri a parità di LUFS (sub troppo basso o troppa energia continua)',
      ).toBeLessThanOrEqual(RMS_CEILING);

      expect(row.truePeak, `${row.name}: picco vero non misurabile`).not.toBeNull();
      expect(
        row.truePeak ?? 0,
        `${row.name}: picco ${row.truePeak} dBTP, sopra il tetto di ${TRUE_PEAK_CEILING} dBTP`,
      ).toBeLessThanOrEqual(TRUE_PEAK_CEILING);
    }
  }, 180_000);
});
