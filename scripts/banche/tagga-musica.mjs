#!/usr/bin/env node
/**
 * Genera questions/music-themes.json dai tag curati di scripts/banche/musica-catalogo.json.
 *
 * Non si scrive a mano sull'indice media (media-it.json è generato da
 * generate_media.py): qui si uniscono i tag al file locale già scaricato.
 *
 * Regole:
 *  - theme è una sola famiglia per brano (Italiano, Rock, Dance & disco, Pop,
 *    Latino & tormentoni, Rap & trap, Colonne sonore);
 *  - era si deriva dall'anno REALE di uscita, non dall'anno del file:
 *      '70-80 = 1970-1989, '90-2000 = 1990-2009, 2010-oggi = 2010+;
 *    i brani anni '60 restano raggiungibili solo dalle famiglie (era null).
 *  - decade è l'anno d'inizio del decennio reale.
 *
 * Il generatore FALLISCE se un brano non ha tema o anno, o se uno dei 10 temi
 * non regge 5 brani con il mix 2 hit + 2 medi + 1 difficile e artisti distinti.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG_PATH = path.join(ROOT, 'scripts/banche/musica-catalogo.json');
const MEDIA_PATH = path.join(ROOT, 'apps/backend/src/main/resources/questions/media-it.json');
const OUT_PATH = path.join(ROOT, 'apps/backend/src/main/resources/questions/music-themes.json');

const ERA_THEMES = ["Anni '70-'80", "Anni '90-2000", 'Anni 2010-oggi'];
const FAMILY_THEMES = [
  'Italiano',
  'Rock',
  'Dance & disco',
  'Pop',
  'Latino & tormentoni',
  'Rap & trap',
  'Colonne sonore',
];
const THEMES = [...ERA_THEMES, ...FAMILY_THEMES];
const DIFFICULTIES = ['hit', 'medium', 'hard'];

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function eraFor(year) {
  if (year >= 2010) return 'Anni 2010-oggi';
  if (year >= 1990) return "Anni '90-2000";
  if (year >= 1970) return "Anni '70-'80";
  return null;
}

function decadeFor(year) {
  return Math.floor(year / 10) * 10;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function matchMedia(entry, music) {
  const title = normalize(entry.title);
  const artist = normalize(entry.artist);
  const sameTitle = (item) => normalize(item.title) === title;
  const artistMatches = (item) => {
    const candidate = normalize(item.artist);
    if (!artist || !candidate) return false;
    return artist.includes(candidate) || candidate.includes(artist);
  };
  const exact = music.find((item) => sameTitle(item) && artistMatches(item));
  if (exact) return exact;
  const loose = music.find(
    (item) =>
      (normalize(item.title).includes(title) || title.includes(normalize(item.title))) &&
      artistMatches(item),
  );
  return loose ?? null;
}

/** 2 hit + 2 medium + 1 hard, tutti di artisti diversi. */
function canField(pool) {
  const byDifficulty = (level) => pool.filter((track) => track.difficulty === level);
  const hits = byDifficulty('hit');
  const mediums = byDifficulty('medium');
  const hards = byDifficulty('hard');
  if (hits.length < 2 || mediums.length < 2 || hards.length < 1) return false;

  for (let h1 = 0; h1 < hits.length; h1++) {
    for (let h2 = h1 + 1; h2 < hits.length; h2++) {
      if (normalize(hits[h1].artist) === normalize(hits[h2].artist)) continue;
      for (let m1 = 0; m1 < mediums.length; m1++) {
        for (let m2 = 0; m2 < mediums.length; m2++) {
          if (m1 === m2) continue;
          const used = new Set([hits[h1].artist, hits[h2].artist, mediums[m1].artist, mediums[m2].artist].map(normalize));
          if (used.size < 4) continue;
          const hard = hards.find((track) => !used.has(normalize(track.artist)));
          if (hard) return true;
        }
      }
    }
  }
  return false;
}

function fail(message) {
  console.error(`ERRORE: ${message}`);
  process.exit(1);
}

const catalog = loadJson(CATALOG_PATH);
const media = loadJson(MEDIA_PATH);
const music = media.music ?? [];

if (!Array.isArray(catalog.tracks) || catalog.tracks.length === 0) {
  fail('catalogo Musica vuoto');
}

const tracks = [];
const unmatched = [];
const seenFiles = new Set();

for (const entry of catalog.tracks) {
  const theme = String(entry.theme ?? '').trim();
  if (!theme) fail(`brano senza tema: ${entry.artist} - ${entry.title}`);
  if (!THEMES.includes(theme)) fail(`tema sconosciuto "${theme}" per ${entry.artist} - ${entry.title}`);
  const year = Number(entry.year);
  if (!Number.isInteger(year) || year < 1900) {
    fail(`brano senza anno valido: ${entry.artist} - ${entry.title}`);
  }
  const difficulty = String(entry.difficulty ?? '').trim();
  if (!DIFFICULTIES.includes(difficulty)) {
    fail(`difficoltà non valida per ${entry.artist} - ${entry.title}: ${entry.difficulty}`);
  }

  const item = matchMedia(entry, music);
  if (!item || !item.file) {
    unmatched.push(`${entry.artist} - ${entry.title}`);
    continue;
  }
  if (seenFiles.has(item.file)) {
    fail(`file duplicato nel catalogo: ${item.file}`);
  }
  seenFiles.add(item.file);

  tracks.push({
    file: item.file,
    title: entry.title,
    artist: entry.artist,
    year,
    decade: decadeFor(year),
    era: eraFor(year),
    theme,
    difficulty,
  });
}

if (unmatched.length > 0) {
  console.warn(`⚠️  ${unmatched.length} brani del catalogo senza anteprima locale (scartati):`);
  for (const row of unmatched) console.warn(`   - ${row}`);
}

for (const theme of THEMES) {
  const pool = tracks.filter((track) => (ERA_THEMES.includes(theme) ? track.era === theme : track.theme === theme));
  if (pool.length < 5) fail(`tema "${theme}": ${pool.length} brani, servono almeno 5`);
  if (!canField(pool)) {
    fail(`tema "${theme}": non regge il mix 2 hit + 2 medi + 1 difficile con artisti distinti`);
  }
}

tracks.sort((a, b) => a.theme.localeCompare(b.theme) || a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

const out = {
  version: 1,
  generatedAt: new Date().toISOString().slice(0, 19),
  source: 'scripts/banche/tagga-musica.mjs',
  themes: THEMES,
  eraThemes: ERA_THEMES,
  familyThemes: FAMILY_THEMES,
  tracks,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

const counts = Object.fromEntries(
  THEMES.map((theme) => [
    theme,
    tracks.filter((track) => (ERA_THEMES.includes(theme) ? track.era === theme : track.theme === theme)).length,
  ]),
);

console.log(`music-themes.json: ${tracks.length} brani, ${THEMES.length} temi`);
console.table(counts);
console.log(`scritto in ${path.relative(ROOT, OUT_PATH)}`);
