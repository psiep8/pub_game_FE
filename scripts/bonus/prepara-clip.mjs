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
  { titolo: 'Vita spericolata', artista: 'Vasco Rossi', anno: 1983, cerca: 'Vasco Rossi Vita spericolata official audio' },
  { titolo: 'Senza parole', artista: 'Vasco Rossi', anno: 1990, cerca: 'Vasco Rossi Senza parole official audio' },
  { titolo: 'Come nelle favole', artista: 'Vasco Rossi', anno: 2011, cerca: 'Vasco Rossi Come nelle favole official audio' },
  { titolo: 'Balliamo sul mondo', artista: 'Ligabue', anno: 1990, cerca: 'Ligabue Balliamo sul mondo official audio' },
  { titolo: 'Ho messo via', artista: 'Ligabue', anno: 1993, cerca: 'Ligabue Ho messo via official audio' },
  { titolo: 'Eri bellissima', artista: 'Ligabue', anno: 1995, cerca: 'Ligabue Eri bellissima official audio' },
  { titolo: 'Non è tempo per noi', artista: 'Ligabue', anno: 1999, cerca: 'Ligabue Non è tempo per noi official audio' },
  { titolo: 'Marmellata #25', artista: 'Cesare Cremonini', anno: 2003, cerca: 'Cesare Cremonini Marmellata 25 official audio' },
  { titolo: 'Un giorno migliore', artista: 'Cesare Cremonini', anno: 2003, cerca: 'Cesare Cremonini Un giorno migliore official audio' },
  { titolo: 'Vieni a vivere con me', artista: 'Cesare Cremonini', anno: 2008, cerca: 'Cesare Cremonini Vieni a vivere con me official audio' },
  { titolo: '4 marzo 1943', artista: 'Lucio Dalla', anno: 1971, cerca: 'Lucio Dalla 4 marzo 1943 official audio' },
  { titolo: 'Caruso', artista: 'Lucio Dalla', anno: 1986, cerca: 'Lucio Dalla Caruso official audio' },
  { titolo: 'Attenti al lupo', artista: 'Lucio Dalla', anno: 1990, cerca: 'Lucio Dalla Attenti al lupo official audio' },
  { titolo: 'Piazza Grande', artista: 'Lucio Dalla', anno: 1972, cerca: 'Lucio Dalla Piazza Grande official audio' },
  { titolo: 'Emozioni', artista: 'Lucio Battisti', anno: 1970, cerca: 'Lucio Battisti Emozioni official audio' },
  { titolo: 'I giardini di marzo', artista: 'Lucio Battisti', anno: 1972, cerca: 'Lucio Battisti I giardini di marzo official audio' },
  { titolo: 'Il mio canto libero', artista: 'Lucio Battisti', anno: 1972, cerca: 'Lucio Battisti Il mio canto libero official audio' },
  { titolo: 'Acqua azzurra acqua chiara', artista: 'Lucio Battisti', anno: 1969, cerca: 'Lucio Battisti Acqua azzurra acqua chiara official audio' },
  { titolo: 'Con il nastro rosa', artista: 'Lucio Battisti', anno: 1980, cerca: 'Lucio Battisti Con il nastro rosa official audio' },
  { titolo: 'A mano a mano', artista: 'Rino Gaetano', anno: 1978, cerca: 'Rino Gaetano A mano a mano official audio' },
  { titolo: 'Ma il cielo è sempre più blu', artista: 'Rino Gaetano', anno: 1975, cerca: 'Rino Gaetano Ma il cielo è sempre più blu official audio' },
  { titolo: 'Nuntereggae più', artista: 'Rino Gaetano', anno: 1978, cerca: 'Rino Gaetano Nuntereggae più official audio' },
  { titolo: 'E ritorno da te', artista: 'Laura Pausini', anno: 2001, cerca: 'Laura Pausini E ritorno da te official audio' },
  { titolo: 'Simili', artista: 'Laura Pausini', anno: 2015, cerca: 'Laura Pausini Simili official audio' },
  { titolo: 'Terra promessa', artista: 'Eros Ramazzotti', anno: 1984, cerca: 'Eros Ramazzotti Terra promessa official audio' },
  { titolo: "Un'emozione per sempre", artista: 'Eros Ramazzotti', anno: 2003, cerca: 'Eros Ramazzotti Un emozione per sempre official audio' },
  { titolo: 'Ti sposerò perché', artista: 'Eros Ramazzotti', anno: 1986, cerca: 'Eros Ramazzotti Ti sposerò perché official audio' },
  { titolo: 'Bellissima', artista: 'Annalisa', anno: 2022, cerca: 'Annalisa Bellissima official video' },
  { titolo: 'Mon amour', artista: 'Annalisa', anno: 2023, cerca: 'Annalisa Mon amour official video' },
  { titolo: 'Maschio', artista: 'Annalisa', anno: 2023, cerca: 'Annalisa Maschio official video' },
  { titolo: "L'essenziale", artista: 'Marco Mengoni', anno: 2013, cerca: 'Marco Mengoni L essenziale official video' },
  { titolo: 'Due vite', artista: 'Marco Mengoni', anno: 2023, cerca: 'Marco Mengoni Due vite official video' },
  { titolo: 'Cambia un uomo', artista: 'Marco Mengoni', anno: 2015, cerca: 'Marco Mengoni Cambia un uomo official video' },
  { titolo: 'Giornate perse', artista: 'Marco Mengoni', anno: 2015, cerca: 'Marco Mengoni Giornate perse official video' },
  { titolo: 'Luce (tramonti a nord est)', artista: 'Elisa', anno: 2001, cerca: 'Elisa Luce tramonti a nord est official audio' },
  { titolo: 'Eppure sentire (un senso di te)', artista: 'Elisa', anno: 2006, cerca: 'Elisa Eppure sentire official audio' },
  { titolo: 'Gli ostacoli del cuore', artista: 'Elisa', anno: 2006, cerca: 'Elisa Gli ostacoli del cuore official audio' },
  { titolo: 'Sere nere', artista: 'Tiziano Ferro', anno: 2003, cerca: 'Tiziano Ferro Sere nere official audio' },
  { titolo: 'Ti scatterò una foto', artista: 'Tiziano Ferro', anno: 2006, cerca: 'Tiziano Ferro Ti scatterò una foto official audio' },
  { titolo: 'Il regalo più grande', artista: 'Tiziano Ferro', anno: 2008, cerca: 'Tiziano Ferro Il regalo più grande official audio' },
  { titolo: 'Alla mia età', artista: 'Tiziano Ferro', anno: 2008, cerca: 'Tiziano Ferro Alla mia età official audio' },
  { titolo: 'Non me lo so spiegare', artista: 'Tiziano Ferro', anno: 2003, cerca: 'Tiziano Ferro Non me lo so spiegare official audio' },
  { titolo: 'Estate', artista: 'Negramaro', anno: 2007, cerca: 'Negramaro Estate official audio' },
  { titolo: "Parlami d'amore", artista: 'Negramaro', anno: 2005, cerca: 'Negramaro Parlami d amore official audio' },
  { titolo: 'Mentre tutto scorre', artista: 'Negramaro', anno: 2005, cerca: 'Negramaro Mentre tutto scorre official audio' },
  { titolo: "Fino all'imbrunire", artista: 'Negramaro', anno: 2020, cerca: 'Negramaro Fino all imbrunire official video' },
  { titolo: 'Diamante', artista: 'Zucchero', anno: 1990, cerca: 'Zucchero Diamante official audio' },
  { titolo: 'Occhi', artista: 'Zucchero', anno: 1989, cerca: 'Zucchero Occhi official audio' },
  { titolo: "Come il sole all'improvviso", artista: 'Zucchero', anno: 1987, cerca: 'Zucchero Come il sole all improvviso official audio' },
  { titolo: 'Baila (sexy thing)', artista: 'Zucchero', anno: 1990, cerca: 'Zucchero Baila sexy thing official audio' },
  { titolo: 'Vedo nero', artista: 'Zucchero', anno: 1987, cerca: 'Zucchero Vedo nero official audio' },
  { titolo: 'Rolling Stones', artista: 'Achille Lauro', anno: 2019, cerca: 'Achille Lauro Rolling Stones official video' },
  { titolo: "Canto d'amore", artista: 'Angelina Mango', anno: 2023, cerca: 'Angelina Mango Canto d amore official video' },
  { titolo: 'Blu celeste', artista: 'Blanco', anno: 2021, cerca: 'Blanco Blu celeste official video' },
  { titolo: 'Brividi', artista: 'Blanco', anno: 2022, cerca: 'Blanco Mahmood Brividi official video' },
  { titolo: 'Un briciolo di allegria', artista: 'Blanco', anno: 2023, cerca: 'Blanco Un briciolo di allegria official video' },
  { titolo: 'Cenere', artista: 'Lazza', anno: 2023, cerca: 'Lazza Cenere official video' },
  { titolo: 'Tango', artista: 'Tananai', anno: 2023, cerca: 'Tananai Tango official video' },
  { titolo: 'Mille', artista: 'Fedez', anno: 2021, cerca: 'Fedez Achille Lauro Orietta Berti Mille official video' },
  { titolo: 'La dolce vita', artista: 'Fedez', anno: 2022, cerca: 'Fedez Tananai Mara Sattei La dolce vita official video' },
  { titolo: 'Italodisco', artista: 'The Kolors', anno: 2023, cerca: 'The Kolors Italodisco official video' },
  { titolo: 'Ciao ciao', artista: 'La Rappresentante di Lista', anno: 2022, cerca: 'La Rappresentante di Lista Ciao ciao official video' },
  { titolo: 'Chiamami per nome', artista: 'Francesca Michielin', anno: 2021, cerca: 'Francesca Michielin Fedez Chiamami per nome official video' },
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
