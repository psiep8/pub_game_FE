#!/usr/bin/env node
/**
 * M-05 — i 4 secondi del primo ascolto non si buttano in un'intro muta.
 *
 * Le anteprime da 30 s partono da `currentTime = 0`. Un brano con più di un
 * secondo di silenzio iniziale (o un'intro strumentale lunghissima) consuma la
 * finestra da 4 s senza far sentire niente. Questo script misura il silenzio
 * iniziale con `ffmpeg silencedetect` (lo stesso strumento dei test di volume),
 * propone un `startAt` e mette i brani in una lista da ascoltare a mano in
 * `docs/DOMANDE-DA-REVISIONARE.md`. Non modifica mai l'audio: cambia solo il
 * punto di partenza, e solo dopo una revisione umana.
 *
 * Uso:
 *   node scripts/banche/start-at-musica.mjs            # elenca e propone
 *   node scripts/banche/start-at-musica.mjs --write    # aggiunge la sezione al file di revisione
 *
 * I file audio non sono versionati: senza la cartella statica lo script lo dice
 * e non inventa misure.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bankPath = join(root, 'apps/backend/src/main/resources/questions/music-themes.json');
const staticDir = join(root, 'apps/backend/src/main/resources/static');
const reviewPath = join(root, 'docs/DOMANDE-DA-REVISIONARE.md');
const write = process.argv.includes('--write');
/** Sotto questa soglia il silenzio iniziale non si sente nella finestra da 4 s. */
const MIN_SILENCE_SECONDS = 1;
const HEADING = '## Musica — brani da ascoltare a mano (M-05)';

function ffmpegPath() {
  const candidates = [
    process.env.FFMPEG,
    join(root, '.tools/ffmpeg/bin/ffmpeg.exe'),
    join(root, '.tools/ffmpeg/ffmpeg.exe'),
    join(root, '.tools/ffmpeg/bin/ffmpeg'),
    join(root, '.tools/ffmpeg/ffmpeg'),
    'ffmpeg',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Candidato assente: si prova il successivo.
    }
  }
  return null;
}

const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
const tracks = Array.isArray(bank.tracks) ? bank.tracks : [];

if (!existsSync(join(staticDir, 'media'))) {
  console.error('Cartella statica assente: i file audio non sono versionati.');
  console.error('Copiala sulla macchina della serata e rilancia lo script.');
  process.exit(2);
}

const ffmpeg = ffmpegPath();
if (!ffmpeg) {
  console.error('ffmpeg non trovato: mettilo in .tools/ffmpeg o nella PATH.');
  process.exit(2);
}

/** Silenzio iniziale e fine del silenzio, dal log di ffmpeg. */
function leadingSilence(file) {
  let log = '';
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-40dB:d=1',
      '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    log = String(error.stderr ?? '');
  }
  const starts = [...log.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  if (!starts.length || starts[0] > 0.25 || !ends.length) return 0;
  return Math.max(0, ends[0] - Math.max(0, starts[0]));
}

const rows = [];
for (const track of tracks) {
  const relative = String(track.file ?? '').replace(/^\//, '');
  const file = join(staticDir, relative);
  if (!file || !existsSync(file)) {
    rows.push({ track, state: 'file assente', startAt: 0 });
    continue;
  }
  const silence = leadingSilence(file);
  const startAt = silence >= MIN_SILENCE_SECONDS ? Math.min(15, Math.ceil((silence + 0.2) * 10) / 10) : 0;
  rows.push({ track, state: silence >= MIN_SILENCE_SECONDS ? `${silence.toFixed(1)} s di silenzio` : 'ok', startAt });
}

const toReview = rows.filter((row) => row.startAt > 0 || row.state === 'file assente');
console.log(`Brani: ${rows.length}. Da ascoltare a mano: ${toReview.length}.`);
for (const row of toReview) {
  console.log(`  ${row.track.artist} - ${row.track.title}: ${row.state} → startAt ${row.startAt}`);
}

if (write) {
  const lines = [
    '',
    HEADING,
    '',
    '_Generato da `node scripts/banche/start-at-musica.mjs --write`. Il `startAt`',
    'proposto è solo un punto di partenza da ascoltare: nessun effetto sull\'audio._',
    '',
    '| Brano | Artista | Misura | startAt proposto |',
    '| --- | --- | --- | --- |',
    ...toReview.map((row) => `| ${row.track.title} | ${row.track.artist} | ${row.state} | ${row.startAt} |`),
    '',
  ];
  const current = existsSync(reviewPath) ? readFileSync(reviewPath, 'utf8') : '';
  if (current.includes(HEADING)) {
    console.error(`La sezione «${HEADING}» esiste già: aggiornala a mano.`);
    process.exit(1);
  }
  writeFileSync(reviewPath, `${current.trimEnd()}\n${lines.join('\n')}`, 'utf8');
  console.log(`Sezione aggiunta a ${reviewPath}`);
}
