#!/usr/bin/env node
/**
 * Karaoke — prepara le clip da 30 secondi e la banca.
 *
 * Le anteprime gratuite di Apple partono in un punto qualsiasi del brano e non
 * si riescono ad allineare al testo in modo affidabile (metà delle canzoni
 * finisce su una strofa con troppo poche righe). Per il karaoke serve invece
 * che la prima riga parta a zero, quindi la clip si taglia da un inizio riga
 * del testo sincronizzato: 30 secondi, non il brano intero. Il brano completo
 * si scarica solo per il taglio e viene cancellato subito.
 *
 * Scrive:
 *   - static/media/music/<artista>-<titolo>.m4a     (clip da 30 s)
 *   - questions/karaoke-bank.json                    (banca, senza punti)
 *   - questions/bonus-scelte.json                    (locale, ignorato da git)
 *
 * I testi non si scrivono qui: li genera scripts/bonus/scarica-testi.mjs da
 * bonus-scelte.json, così restano fuori dal repository.
 *
 * Uso:
 *   node scripts/bonus/prepara-clip.mjs             # tutte le canzoni
 *   node scripts/bonus/prepara-clip.mjs --solo Sally
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const musicDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'static', 'media', 'music');
const tmpDir = join(rootDir, 'tmp-karaoke');
const bankPath = join(questionsDir, 'karaoke-bank.json');
const sceltePath = join(questionsDir, 'bonus-scelte.json');

const CLIP_MS = 30_000;
const STOP_MIN_MS = 5_000;
const STOP_MAX_MS = 25_000;
const STOP_TARGET_MS = 14_000;
const MIN_RIGHE = 7;
const MIN_DOPO = 2;

const CANZONI = [
  { titolo: 'La solitudine', artista: 'Laura Pausini', anno: 1993, cerca: 'Laura Pausini La solitudine official audio' },
  { titolo: 'Certe notti', artista: 'Ligabue', anno: 1995, cerca: 'Ligabue Certe notti official audio' },
  { titolo: 'Più bella cosa', artista: 'Eros Ramazzotti', anno: 1996, cerca: 'Eros Ramazzotti Più bella cosa official audio' },
  { titolo: 'Ogni volta', artista: 'Vasco Rossi', anno: 1982, cerca: 'Vasco Rossi Ogni volta official audio' },
  { titolo: 'Sally', artista: 'Vasco Rossi', anno: 1996, cerca: 'Vasco Rossi Sally official audio' },
  { titolo: 'Poetica', artista: 'Cesare Cremonini', anno: 2017, cerca: 'Cesare Cremonini Poetica official audio' },
  { titolo: "L'anno che verrà", artista: 'Lucio Dalla', anno: 1979, cerca: "Lucio Dalla L'anno che verrà official audio" },
  { titolo: 'La canzone del sole', artista: 'Lucio Battisti', anno: 1971, cerca: 'Lucio Battisti La canzone del sole official audio' },
  { titolo: 'Gianna', artista: 'Rino Gaetano', anno: 1978, cerca: 'Rino Gaetano Gianna official audio' },
  { titolo: 'Sinceramente', artista: 'Annalisa', anno: 2024, cerca: 'Annalisa Sinceramente official video' },
  { titolo: 'La noia', artista: 'Angelina Mango', anno: 2024, cerca: 'Angelina Mango La noia official video' },
  { titolo: 'Soldi', artista: 'Mahmood', anno: 2019, cerca: 'Mahmood Soldi official video' },
];

const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--solo');
const only = onlyIndex >= 0 ? String(args[onlyIndex + 1] ?? '').toLowerCase() : '';

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function slug(value) {
  return fold(value).replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function lrc(titolo, artista) {
  const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(titolo)}`;
  const response = await fetch(url).catch(() => null);
  if (!response || !response.ok) return null;
  const body = await response.json();
  if (!body?.syncedLyrics) return null;
  const righe = [];
  let indice = 0;
  for (const raw of String(body.syncedLyrics).split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!match) continue;
    const testo = match[3].trim();
    indice += 1;
    if (!testo) continue;
    righe.push({ indice, inizioMs: Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000), testo });
  }
  return righe;
}

/** Finestra di 30 s che parte su una riga, con stop a fine riga e due righe dopo. */
function finestra(righe) {
  let migliore = null;
  for (const inizio of righe) {
    const dentro = righe
      .filter((riga) => riga.inizioMs >= inizio.inizioMs && riga.inizioMs < inizio.inizioMs + CLIP_MS);
    if (dentro.length < MIN_RIGHE) continue;
    const stop = dentro.filter((riga, index) => index >= 4
      && index <= dentro.length - 1 - MIN_DOPO
      && riga.inizioMs - inizio.inizioMs >= STOP_MIN_MS
      && riga.inizioMs - inizio.inizioMs <= STOP_MAX_MS);
    if (!stop.length) continue;
    const scelto = stop.reduce((a, b) => (
      Math.abs(a.inizioMs - inizio.inizioMs - STOP_TARGET_MS) <= Math.abs(b.inizioMs - inizio.inizioMs - STOP_TARGET_MS) ? a : b
    ));
    const punteggio = dentro.length * 100 - Math.abs(scelto.inizioMs - inizio.inizioMs - STOP_TARGET_MS);
    if (!migliore || punteggio > migliore.punteggio) {
      migliore = { inizioMs: inizio.inizioMs, rigaStop: scelto.indice, dentro, punteggio };
    }
  }
  return migliore;
}

function trovaFile(base) {
  for (const ext of ['mp4', 'm4a', 'webm', 'opus', 'mkv']) {
    if (existsSync(`${base}.${ext}`)) return `${base}.${ext}`;
  }
  return null;
}

async function main() {
  mkdirSync(musicDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  const banca = [];
  const scelte = [];
  const problemi = [];

  for (const canzone of CANZONI) {
    if (only && !fold(`${canzone.artista} ${canzone.titolo}`).includes(only)) continue;
    const etichetta = `${canzone.artista} — ${canzone.titolo}`;
    const righe = await lrc(canzone.titolo, canzone.artista);
    if (!righe) {
      problemi.push(`${etichetta}: nessun testo sincronizzato`);
      console.log(`✗ ${etichetta}: testo assente`);
      continue;
    }
    const scelta = finestra(righe);
    if (!scelta) {
      problemi.push(`${etichetta}: nessuna finestra con 7 righe e stop valido`);
      console.log(`✗ ${etichetta}: finestra non valida`);
      continue;
    }

    const base = join(tmpDir, slug(canzone.artista) + '-' + slug(canzone.titolo));
    let sorgente = trovaFile(base);
    if (!sorgente) {
      try {
        execFileSync('yt-dlp', [
          '--no-warnings', '-q',
          '--extractor-args', 'youtube:player_client=android',
          '-f', 'bestaudio/best',
          '-o', `${base}.%(ext)s`,
          `ytsearch1:${canzone.cerca}`,
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch {
        problemi.push(`${etichetta}: brano non scaricabile`);
        console.log(`✗ ${etichetta}: download fallito`);
        continue;
      }
      sorgente = trovaFile(base);
      if (!sorgente) {
        problemi.push(`${etichetta}: file scaricato non trovato`);
        continue;
      }
    }

    const nome = `${slug(canzone.artista)}-${slug(canzone.titolo)}.m4a`;
    try {
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-ss', String(scelta.inizioMs / 1000),
        '-t', String(CLIP_MS / 1000),
        '-i', sorgente,
        '-vn', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
        join(musicDir, nome),
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      problemi.push(`${etichetta}: taglio fallito`);
      continue;
    }

    const stop = scelta.dentro.find((riga) => riga.indice === scelta.rigaStop);
    console.log(
      `· ${etichetta}: clip da ${(scelta.inizioMs / 1000).toFixed(2)} s, `
      + `${scelta.dentro.length} righe, stop a +${((stop.inizioMs - scelta.inizioMs) / 1000).toFixed(2)} s`,
    );
    banca.push({
      titolo: canzone.titolo,
      artista: canzone.artista,
      anno: canzone.anno,
      file: `/media/music/${nome}`,
      offsetMs: scelta.inizioMs,
    });
    scelte.push({
      titolo: canzone.titolo,
      artista: canzone.artista,
      file: `/media/music/${nome}`,
      offsetMs: scelta.inizioMs,
      rigaStop: scelta.rigaStop,
    });
  }

  // Con --solo si tiene il resto della banca già scritta.
  const bancaPrima = existsSync(bankPath)
    ? (JSON.parse(readFileSync(bankPath, 'utf8')).canzoni ?? [])
    : [];
  const sceltePrima = existsSync(sceltePath)
    ? (JSON.parse(readFileSync(sceltePath, 'utf8')).manche ?? [])
    : [];
  const unione = (elenco, prima) => CANZONI
    .map((canzone) => elenco.find((voce) => voce.titolo === canzone.titolo)
      ?? (only ? prima.find((voce) => voce.titolo === canzone.titolo) : null)
      ?? null)
    .filter(Boolean)
    .map((voce, index) => ({ ...voce, manche: index + 1 }));

  const canzoni = unione(banca, bancaPrima);
  const scelteOrdinate = unione(scelte, sceltePrima);
  writeFileSync(bankPath, `${JSON.stringify({
    version: 2,
    nota: 'Banca del bonus Karaoke: clip di 30 secondi tagliate su un inizio riga del testo, così la prima riga parte a zero. Le cinque manche si pescano senza ripetizioni con il seed della partita e i punti 100/150/200/250/300 dipendono dalla posizione, non dalla canzone. I testi sincronizzati restano fuori dal repository: scripts/bonus/scarica-testi.mjs li scrive in lyrics-bonus-it.json.',
    canzoni,
  }, null, 2)}\n`, 'utf8');
  writeFileSync(sceltePath, `${JSON.stringify({
    version: 2,
    nota: 'File locale (ignorato da git) usato da scripts/bonus/scarica-testi.mjs.',
    manche: scelteOrdinate,
  }, null, 2)}\n`, 'utf8');
  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\nBanca: ${canzoni.length} canzoni.`);
  if (problemi.length) {
    console.log(`${problemi.length} problemi:`);
    for (const problema of problemi) console.log(`  - ${problema}`);
    process.exitCode = 1;
  }
}

await main();
