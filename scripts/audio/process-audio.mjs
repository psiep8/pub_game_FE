#!/usr/bin/env node
/**
 * Elabora i suoni registrati della serata: taglia il silenzio, normalizza e
 * converte in m4a. I file grezzi li sceglie l'umano; questo script fa il
 * lavoro meccanico e dice cosa manca.
 *
 * Uso:
 *   node scripts/audio/process-audio.mjs            # elabora quello che trova
 *   node scripts/audio/process-audio.mjs --check    # solo verifica (esce 1 se manca un file)
 *   node scripts/audio/process-audio.mjs --only gong
 *   node scripts/audio/process-audio.mjs --force    # rielabora anche gli m4a già pronti
 *
 * Le fonti si cercano in quest'ordine:
 *   1. apps/frontend/public/assets/audio/_src/<cartella>/<nome>.<ext>
 *   2. apps/frontend/public/assets/audio/<cartella>/<nome>.<ext>   (ext ≠ m4a)
 *   3. apps/frontend/public/assets/audio/<cartella>/<nome>.m4a     (solo con --force)
 *
 * Il risultato va sempre in <cartella>/<nome>.m4a, con il nome della tabella
 * in docs/MANIFESTO-AUDIO.md. La tabella è l'unica fonte dei nomi: se il
 * manifesto cambia, cambia lo script.
 *
 * ffmpeg non si installa di sistema: si usa quello statico locale in
 * .tools/ffmpeg/ffmpeg (vedi docs/MANIFESTO-AUDIO.md). FFMPEG_PATH lo scavalca.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIO_ROOT = join(ROOT, 'apps/frontend/public/assets/audio');
const MANIFEST = join(ROOT, 'docs/MANIFESTO-AUDIO.md');

const EFFECT_LOUDNESS = { i: -16, tp: -1, lra: 11, bitrate: '96k', channels: 1 };
const LOOP_LOUDNESS = { i: -23, tp: -1.5, lra: 11, bitrate: '128k', channels: 2 };
const LOOP_MAX_SECONDS = 120;
const LOOP_MIN_SECONDS = 60;
const SILENCE = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.02';
const TRIM_BOTH_ENDS = `${SILENCE},areverse,${SILENCE},areverse`;
const RAW_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.oga', '.flac', '.aif', '.aiff', '.m4a', '.aac', '.opus', '.webm', '.wma'];

const args = process.argv.slice(2);
const option = (name) => args.includes(`--${name}`);
const valueOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const ONLY = valueOf('only');
const FORCE = option('force');
const CHECK = option('check');

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** Tabella del manifesto → elenco dei file attesi. */
function readManifest() {
  if (!existsSync(MANIFEST)) fail(`Manca ${relative(ROOT, MANIFEST)}`);
  const lines = readFileSync(MANIFEST, 'utf8').split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const pathCell = cells.find((cell) => /^`(interface|gioco|casino|sala|bonus|attesa|loop)\/[^`]+\.m4a`$/.test(cell));
    if (!pathCell) continue;
    const path = pathCell.replace(/`/g, '');
    const [folder, filename] = path.split('/');
    const name = basename(filename, '.m4a');
    const isLoop = folder === 'loop';
    let maxSeconds = LOOP_MAX_SECONDS;
    if (!isLoop) {
      const durationCell = cells[3] ?? '';
      const match = durationCell.match(/([0-9]+(?:[.,][0-9]+)?)\s*s/);
      if (!match) fail(`Nel manifesto la riga di ${path} non ha la durata massima in secondi.`);
      maxSeconds = Number(match[1].replace(',', '.'));
    }
    entries.push({
      path,
      folder,
      name,
      isLoop,
      maxSeconds,
      bus: cells[2] ?? '',
      source: cells[cells.length - 1] ?? '',
    });
  }

  const effects = entries.filter((entry) => !entry.isLoop);
  const loops = entries.filter((entry) => entry.isLoop);
  if (effects.length !== 35) fail(`Il manifesto elenca ${effects.length} effetti, attesi 35.`);
  if (loops.length !== 6) fail(`Il manifesto elenca ${loops.length} loop, attesi 6.`);
  const duplicates = entries.filter((entry, index) => entries.findIndex((other) => other.path === entry.path) !== index);
  if (duplicates.length > 0) fail(`File ripetuti nel manifesto: ${duplicates.map((entry) => entry.path).join(', ')}`);
  return entries;
}

function findTool(name) {
  const candidates = [
    process.env[`${name.toUpperCase()}_PATH`],
    join(ROOT, '.tools/ffmpeg', name),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const which = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  fail(
    `ffmpeg non trovato. Serve il build statico locale: scarica ffmpeg e ffprobe in .tools/ffmpeg/ ` +
      `(niente sudo), oppure indica FFMPEG_PATH/FFPROBE_PATH.`,
  );
}

const FFMPEG = findTool('ffmpeg');
const FFPROBE = findTool('ffprobe');
const TMP = join(ROOT, '.tools/audio-tmp');

function run(command, commandArgs, { allowFailure = false } = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0 && !allowFailure) {
    console.error(result.stderr?.trim().slice(-1200) ?? '');
    fail(`Comando fallito: ${basename(command)} ${commandArgs.join(' ')}`);
  }
  return result;
}

function probeSeconds(file) {
  const result = run(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const seconds = Number.parseFloat(result.stdout.trim());
  return Number.isFinite(seconds) ? seconds : 0;
}

/** Misura loudness EBU R128 del file finito: è il numero che va nei documenti. */
function measureLoudness(file) {
  const result = run(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', 'ebur128=peak=true',
    '-f', 'null', '-',
  ], { allowFailure: true });
  const text = result.stderr ?? '';
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const integrated = summary.match(/I:\s*(-?[0-9.]+)\s*LUFS/);
  const peak = summary.match(/Peak:\s*(-?[0-9.]+)\s*dBFS/);
  return {
    lufs: integrated ? Number(integrated[1]) : null,
    peak: peak ? Number(peak[1]) : null,
  };
}

/** Prima passata loudnorm: misura il file già ripulito. */
function measureNormalization(file, target) {
  const result = run(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}:print_format=json`,
    '-f', 'null', '-',
  ]);
  const text = result.stderr ?? '';
  const start = text.lastIndexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) fail(`loudnorm non ha restituito le misure per ${basename(file)}.`);
  const data = JSON.parse(text.slice(start, end + 1));
  const required = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
  for (const key of required) {
    if (data[key] === undefined) fail(`loudnorm non ha restituito ${key} per ${basename(file)}.`);
  }
  return data;
}

function sourceCandidates(entry) {
  const output = join(AUDIO_ROOT, entry.path);
  const list = [];
  for (const extension of RAW_EXTENSIONS) {
    list.push({ file: join(AUDIO_ROOT, '_src', entry.folder, `${entry.name}${extension}`), raw: true });
  }
  for (const extension of RAW_EXTENSIONS) {
    if (extension === '.m4a') continue;
    list.push({ file: join(AUDIO_ROOT, entry.folder, `${entry.name}${extension}`), raw: true });
  }
  if (FORCE) list.push({ file: output, raw: false });
  return list;
}

function processEntry(entry) {
  const output = join(AUDIO_ROOT, entry.path);
  if (existsSync(output) && !FORCE) {
    return { status: 'skip', reason: 'già elaborato' };
  }

  const candidate = sourceCandidates(entry).find((item) => existsSync(item.file));
  if (!candidate) return { status: 'missing' };
  const source = candidate.file;

  mkdirSync(TMP, { recursive: true });
  mkdirSync(dirname(output), { recursive: true });
  const cleaned = join(TMP, `${entry.folder}-${entry.name}-clean.wav`);
  const encoded = `${output}.part.m4a`;
  const target = entry.isLoop ? LOOP_LOUDNESS : EFFECT_LOUDNESS;

  try {
    const sourceSeconds = probeSeconds(source);
    if (sourceSeconds <= 0) fail(`${relative(ROOT, source)} non è un file audio leggibile.`);

    // 1. Pulizia: solo gli effetti perdono il silenzio ai due estremi; i loop
    //    devono restare intatti, altrimenti si sente il buco a ogni giro.
    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', source,
      ...(entry.isLoop ? [] : ['-af', TRIM_BOTH_ENDS]),
      '-ac', String(target.channels),
      '-ar', '44100',
      '-c:a', 'pcm_s16le',
      cleaned,
    ]);

    const cleanedSeconds = probeSeconds(cleaned);
    if (entry.isLoop && cleanedSeconds < LOOP_MIN_SECONDS) {
      console.warn(`  ! ${entry.path}: ${cleanedSeconds.toFixed(1)} s, sotto il minimo di ${LOOP_MIN_SECONDS} s; va bene ma il giro è corto.`);
    }
    if (!entry.isLoop && cleanedSeconds > entry.maxSeconds + 0.05) {
      console.warn(`  ! ${entry.path}: ${cleanedSeconds.toFixed(1)} s, oltre il massimo di ${entry.maxSeconds} s; verrà tagliato.`);
    }

    // 2. Misura e seconda passata: loudnorm lineare, poi AAC.
    const measured = measureNormalization(cleaned, target);
    const filter = [
      `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}` +
        `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
        `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
        `:offset=${measured.target_offset}:linear=true`,
      'aresample=44100',
    ].join(',');

    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', cleaned,
      '-af', filter,
      '-c:a', 'aac',
      '-b:a', target.bitrate,
      '-ac', String(target.channels),
      '-ar', '44100',
      '-movflags', '+faststart',
      '-t', String(entry.isLoop ? LOOP_MAX_SECONDS : entry.maxSeconds),
      encoded,
    ]);

    renameSync(encoded, output);

    // 3. La fonte grezza non resta in una cartella pubblica.
    if (candidate.raw && dirname(source) !== join(AUDIO_ROOT, '_src', entry.folder)) {
      const archive = join(AUDIO_ROOT, '_src', entry.folder);
      mkdirSync(archive, { recursive: true });
      const destination = join(archive, basename(source));
      if (!existsSync(destination)) renameSync(source, destination);
    }

    const finalSeconds = probeSeconds(output);
    const loudness = measureLoudness(output);
    return {
      status: 'done',
      source: relative(ROOT, source),
      sourceSeconds,
      seconds: finalSeconds,
      bytes: statSync(output).size,
      lufs: loudness.lufs,
      peak: loudness.peak,
      target: target.i,
    };
  } finally {
    rmSync(cleaned, { force: true });
    rmSync(encoded, { force: true });
  }
}

function formatDuration(seconds) {
  return `${seconds.toFixed(1)} s`;
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const entries = readManifest();
const selected = ONLY ? entries.filter((entry) => entry.name === ONLY || entry.path === ONLY) : entries;
if (selected.length === 0) fail(`Nessun file nel manifesto corrisponde a "${ONLY}".`);

if (CHECK) {
  const missing = selected.filter((entry) => {
    const output = join(AUDIO_ROOT, entry.path);
    if (existsSync(output) && !FORCE) return false;
    return !sourceCandidates(entry).some((item) => existsSync(item.file));
  });
  console.log(`Manifesto: ${entries.length} file (35 effetti, 6 loop).`);
  console.log(`ffmpeg: ${FFMPEG}`);
  if (missing.length > 0) {
    console.log(`\nMancano ${missing.length} file:`);
    for (const entry of missing) console.log(`  - ${entry.path}`);
    process.exit(1);
  }
  console.log('\nTutti i file attesi ci sono.');
  process.exit(0);
}

console.log(`Elaboro ${selected.length} file con ${FFMPEG}\n`);
const results = [];
let failures = 0;
for (const entry of selected) {
  process.stdout.write(`• ${entry.path} ... `);
  try {
    const result = processEntry(entry);
    results.push({ entry, ...result });
    if (result.status === 'done') {
      console.log(
        `ok (${formatDuration(result.seconds)}, ${formatSize(result.bytes)}, ` +
          `${result.lufs ?? '?'} LUFS, picco ${result.peak ?? '?'} dBFS)`,
      );
    } else if (result.status === 'skip') {
      console.log(result.reason);
    } else {
      console.log('MANCA');
    }
  } catch (error) {
    failures += 1;
    console.log(`ERRORE: ${error.message}`);
  }
}

const done = results.filter((result) => result.status === 'done');
const missing = results.filter((result) => result.status === 'missing');
const skipped = results.filter((result) => result.status === 'skip');

console.log('\n— Riepilogo —');
if (done.length > 0) {
  console.log(`Elaborati: ${done.length}`);
  for (const result of done) {
    console.log(
      `  ${result.entry.path.padEnd(34)} ${String(result.source).padEnd(44)} ` +
        `${formatDuration(result.seconds).padStart(7)}  ${formatSize(result.bytes).padStart(8)}  ` +
        `${result.lufs ?? '?'} LUFS (obiettivo ${result.target})`,
    );
  }
}
if (skipped.length > 0) console.log(`Già pronti: ${skipped.length} (usa --force per rifarli)`);
if (missing.length > 0) {
  console.log(`\nMancano ${missing.length} file:`);
  for (const result of missing) console.log(`  - ${result.entry.path}`);
}
if (failures > 0) {
  console.log(`\n${failures} file non elaborati per errore: vedi sopra.`);
  process.exit(1);
}
rmSync(TMP, { recursive: true, force: true });
console.log('\nFatto. Ricordati di riempire FONTI.txt per i file nuovi: senza metadati non entrano nei crediti.');
