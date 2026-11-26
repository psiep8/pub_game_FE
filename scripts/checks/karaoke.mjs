#!/usr/bin/env node
/**
 * Controllo del bonus Karaoke: banca, testi sincronizzati e clip.
 *
 * La banca contiene tutte le canzoni disponibili; il server ne pesca cinque
 * senza ripetizioni. Il file lyrics contiene le righe sincronizzate. Senza
 * questo controllo una manche senza testo arriva in TV come "TESTO NON
 * DISPONIBILE" solo davanti al pubblico.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const resources = join(root, 'apps/backend/src/main/resources');
const bankPath = join(resources, 'questions/karaoke-bank.json');
const lyricsPath = join(resources, 'questions/lyrics-bonus-it.json');
const staticDir = join(resources, 'static');
const MIN_MANCHE = 5;
const MIN_LINES = 3;

const problems = [];

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    problems.push(`${label}: ${error.message}`);
    return null;
  }
}

const bank = readJson(bankPath, 'karaoke-bank.json');
const lyrics = readJson(lyricsPath, 'lyrics-bonus-it.json');

const songs = Array.isArray(bank?.canzoni) ? bank.canzoni : [];
if (songs.length < MIN_MANCHE) problems.push(`banca: meno di ${MIN_MANCHE} canzoni (${songs.length})`);

const manche = new Set();
const titles = new Set();
for (const [index, song] of songs.entries()) {
  const label = `banca #${song?.manche ?? index + 1}`;
  if (!song?.titolo || !song?.artista) problems.push(`${label}: titolo o artista mancante`);
  if (!Number.isInteger(song?.manche) || song.manche < 1) {
    problems.push(`${label}: numero manche non valido`);
  } else if (manche.has(song.manche)) {
    problems.push(`${label}: manche duplicata`);
  } else {
    manche.add(song.manche);
  }
  if (song?.titolo) titles.add(String(song.titolo).trim().toLowerCase());
  const clip = String(song?.file ?? '').replace(/^\//, '');
  if (!clip || !existsSync(join(staticDir, clip))) problems.push(`${label}: clip mancante (${song?.file ?? '—'})`);
}

const lyricManches = Array.isArray(lyrics?.manche) ? lyrics.manche : [];
const ready = new Set();
for (const row of lyricManches) {
  const label = `testi "${row?.titolo ?? '?'}"`;
  if (!Array.isArray(row?.righe) || row.righe.length < MIN_LINES) {
    problems.push(`${label}: meno di ${MIN_LINES} righe sincronizzate`);
    continue;
  }
  const times = row.righe.map((line) => Number(line?.inizioMs));
  if (times.some((time) => !Number.isFinite(time) || time < 0)) {
    problems.push(`${label}: inizioMs non valido`);
    continue;
  }
  if (times.some((time, i) => i > 0 && time <= times[i - 1])) {
    problems.push(`${label}: tempi non crescenti`);
    continue;
  }
  if (row?.titolo) ready.add(String(row.titolo).trim().toLowerCase());
}

const playable = [...titles].filter((title) => ready.has(title));
if (playable.length < MIN_MANCHE) {
  problems.push(`solo ${playable.length} canzoni hanno testi completi (servono ${MIN_MANCHE})`);
}

if (problems.length) {
  console.error('Karaoke NON pronto:');
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`Karaoke OK: ${songs.length} brani in banca, ${playable.length} con testi completi, almeno ${MIN_MANCHE} manche.`);
