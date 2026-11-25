#!/usr/bin/env node
/**
 * «Canta la canzone» — scarica i testi sincronizzati per le clip da 30 secondi.
 *
 * I testi delle canzoni sono protetti dal diritto d'autore e il repository è
 * pubblico: qui non si committa nulla. Lo script legge le canzoni scelte da un
 * file locale (`questions/bonus-scelte.json`, ignorato da git), chiede i testi
 * sincronizzati a LRCLIB (formato LRC, licenza aperta per i dati) e scrive solo
 * le righe che servono — quelle della clip più le due successive — in
 * `questions/lyrics-bonus-it.json`, anch'esso ignorato da git.
 *
 * Nel repository resta solo la struttura: id della canzone, indici di riga,
 * tempi. L'esempio tracciato `lyrics-bonus-it.example.json` ha testi finti.
 *
 * Regole (specifica §2.4):
 *   - niente testo nel repo, mai;
 *   - se il testo non c'è o non è sincronizzato, la canzone non entra;
 *   - la punta della clip deve contenere almeno 4 righe prima dello stop e 2
 *     dopo, e lo stop deve cadere a fine riga fra 5 e 25 secondi.
 *
 * Uso:
 *   node scripts/bonus/scarica-testi.mjs            # scarica e scrive il file locale
 *   node scripts/bonus/scarica-testi.mjs --check    # non scrive: controlla e stampa
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const sceltePath = join(questionsDir, 'bonus-scelte.json');
const outputPath = join(questionsDir, 'lyrics-bonus-it.json');

const CLIP_MS = 30_000;
const STOP_MIN_MS = 5_000;
const STOP_MAX_MS = 25_000;
const MIN_RIGHE_PRIMA = 4;
const MIN_RIGHE_DOPO = 2;

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

const LRCLIB_GET = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Righe dell'LRC: [mm:ss.xx] testo. Le righe vuote diventano intervalli. */
function parseLrc(lrc) {
  const righe = [];
  let indice = 0;
  for (const raw of String(lrc ?? '').split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!match) continue;
    const testo = match[3].trim();
    indice += 1;
    righe.push({
      indice,
      inizioMs: Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000),
      testo,
    });
  }
  return righe;
}

async function findByGet(titolo, artista) {
  const url = `${LRCLIB_GET}?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(titolo)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

async function findBySearch(titolo, artista) {
  const response = await fetch(`${LRCLIB_SEARCH}?q=${encodeURIComponent(`${titolo} ${artista}`)}`);
  if (!response.ok) return [];
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

/** Il testo sincronizzato della canzone, o null se non c'è. */
async function lyricsFor(titolo, artista) {
  const direct = await findByGet(titolo, artista).catch(() => null);
  const candidates = direct ? [direct] : await findBySearch(titolo, artista).catch(() => []);
  const exact = candidates.find((row) => fold(row.artistName) === fold(artista))
    ?? candidates.find((row) => fold(row.artistName).includes(fold(artista)))
    ?? null;
  if (!exact || !exact.syncedLyrics) return null;
  return {
    righe: parseLrc(exact.syncedLyrics),
    durataMs: Math.round(Number(exact.duration) * 1000),
    album: exact.albumName ?? '',
    parolaSync: exact.hasWordSync === true,
  };
}

/**
 * Righe della clip: si portano i tempi del brano sul tempo della clip togliendo
 * l'offset. `offsetMs` è dove comincia la clip dentro il brano e va tarato a
 * mano per ogni canzone (le anteprime iTunes partono a metà brano).
 */
function clipLines(righe, offsetMs) {
  return righe
    .map((riga) => ({ indice: riga.indice, inizioMs: riga.inizioMs - offsetMs, testo: riga.testo }))
    .filter((riga) => riga.inizioMs >= 0 && riga.inizioMs < CLIP_MS && riga.testo.length > 0);
}

/** Lo stop cade subito dopo l'ultima parola di una riga, mai a metà. */
function chooseStop(lines, wantedIndex) {
  const candidates = lines.filter((riga, index) => {
    if (index < MIN_RIGHE_PRIMA) return false;
    if (index > lines.length - 1 - MIN_RIGHE_DOPO) return false;
    return riga.inizioMs >= STOP_MIN_MS && riga.inizioMs <= STOP_MAX_MS;
  });
  if (!candidates.length) return null;
  const wanted = candidates.find((riga) => riga.indice === wantedIndex);
  return wanted ?? candidates[Math.floor(candidates.length / 2)];
}

async function main() {
  if (!existsSync(sceltePath)) {
    console.error(`Manca ${sceltePath}: è il file locale con le canzoni scelte (ignorato da git).`);
    console.error('Copia la struttura da lyrics-bonus-it.example.json e metti i brani veri.');
    process.exitCode = 1;
    return;
  }
  const scelte = JSON.parse(readFileSync(sceltePath, 'utf8'));
  const manche = Array.isArray(scelte.manche) ? scelte.manche : [];
  if (manche.length === 0) {
    console.error('Nessuna manche in bonus-scelte.json.');
    process.exitCode = 1;
    return;
  }

  const output = { version: 1, generatoDa: 'scripts/bonus/scarica-testi.mjs', fonte: 'LRCLIB (LRC)', manche: [] };
  const problemi = [];
  let msPeggiore = 0;

  for (const voce of manche) {
    const titolo = String(voce.titolo ?? '').trim();
    const artista = String(voce.artista ?? '').trim();
    const offsetMs = Math.max(0, Number(voce.offsetMs) || 0);
    const label = `manche ${voce.manche ?? '?'} — ${artista} «${titolo}»`;

    if (!titolo || !artista) {
      problemi.push(`${label}: titolo o artista mancante`);
      console.log(`✗ ${label}: titolo o artista mancante`);
      continue;
    }

    const lyrics = await lyricsFor(titolo, artista);
    if (!lyrics) {
      problemi.push(`${label}: testo sincronizzato assente in LRCLIB`);
      console.log(`✗ ${label}: nessun testo sincronizzato → la canzone non entra`);
      continue;
    }

    const lines = clipLines(lyrics.righe, offsetMs);
    if (lines.length < MIN_RIGHE_PRIMA + MIN_RIGHE_DOPO + 1) {
      problemi.push(`${label}: solo ${lines.length} righe nella clip`);
      console.log(`✗ ${label}: solo ${lines.length} righe nella clip`);
      continue;
    }

    const stop = chooseStop(lines, Number(voce.rigaStop) || null);
    if (!stop) {
      problemi.push(`${label}: nessuna riga dove fermare la clip fra ${STOP_MIN_MS / 1000} e ${STOP_MAX_MS / 1000} s`);
      console.log(`✗ ${label}: nessuna riga valida per lo stop`);
      continue;
    }

    const stopIndex = lines.findIndex((riga) => riga.indice === stop.indice);
    const before = lines.slice(0, stopIndex);
    const after = lines.slice(stopIndex, stopIndex + 1 + Number(voce.righeSuccessive ?? MIN_RIGHE_DOPO));
    const successive = after.slice(1);

    // Scarto dello stop dal battito della riga: lo stop deve essere a fine
    // riga, quindi il tempo utile è la distanza dalla riga successiva.
    const next = lines[stopIndex + 1];
    const finestraMs = next ? next.inizioMs - stop.inizioMs : CLIP_MS - stop.inizioMs;
    msPeggiore = Math.max(msPeggiore, finestraMs);

    output.manche.push({
      manche: Number(voce.manche) || 0,
      punti: Number(voce.punti) || 0,
      titolo,
      artista,
      file: String(voce.file ?? ''),
      offsetMs,
      righe: lines.map((riga) => ({ indice: riga.indice, inizioMs: riga.inizioMs, testo: riga.testo })),
      stop: { indice: stop.indice, tempoMs: stop.inizioMs },
      righeCorrette: successive.map((riga) => ({ indice: riga.indice, testo: riga.testo })),
    });

    console.log(
      `✓ ${label}: ${lines.length} righe nella clip, ${before.length} prima dello stop, `
      + `${successive.length} da cantare, stop a ${(stop.inizioMs / 1000).toFixed(2)} s `
      + `(finestra ${finestraMs} ms, ${lyrics.parolaSync ? 'sync a parola' : 'sync a riga'})`,
    );
    await new Promise((done) => setTimeout(done, 400));
  }

  console.log(`\nScarto massimo fra due righe: ${msPeggiore} ms (l'LRC è al centesimo: 10 ms).`);
  if (problemi.length) {
    console.log(`\n${problemi.length} problemi:`);
    for (const problema of problemi) console.log(`  - ${problema}`);
  }

  if (checkOnly) return;
  if (!output.manche.length) {
    console.error('Nessuna manche valida: il file locale non viene scritto.');
    process.exitCode = 1;
    return;
  }
  if (resolve(outputPath).endsWith('.example.json')) {
    console.error('Il file d’uscita non può essere quello di esempio.');
    process.exitCode = 1;
    return;
  }
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nScritto ${outputPath} (locale, ignorato da git).`);
  if (problemi.length) process.exitCode = 1;
}

await main();
