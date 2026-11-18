#!/usr/bin/env node
/**
 * Elabora i suoni registrati della serata: taglia il silenzio, normalizza e
 * converte in m4a. I file grezzi li sceglie l'umano; questo script fa il
 * lavoro meccanico e dice cosa manca.
 *
 * Uso:
 *   node scripts/audio/process-audio.mjs            # elabora quello che trova
 *   node scripts/audio/process-audio.mjs --check    # solo verifica (esce 1 se manca un file)
 *   node scripts/audio/process-audio.mjs --credits  # rigenera docs/CREDITI-AUDIO.md
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
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIO_ROOT = join(ROOT, 'apps/frontend/public/assets/audio');
const MANIFEST = join(ROOT, 'docs/MANIFESTO-AUDIO.md');
const CREDITS_PATH = join(ROOT, 'docs/CREDITI-AUDIO.md');

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
const CREDITS = option('credits');
const FADE_OUT_SECONDS = 0.18;
const LOOP_CROSSFADE_SECONDS = 1.5;
// Compressione leggera: solo per i suoni che, dopo la normalizzazione, restano
// lontani dal bersaglio perché la cresta è troppo alta.
// Sotto 1,2 s la misura integrata non è affidabile e si normalizza sul picco.
// Questi file fanno eccezione: sono corti ma hanno corpo abbastanza da stare
// sul LUFS come gli altri effetti.
const LOUDNESS_ON_SHORT = new Set(['interface/whoosh.m4a']);
const LIGHT_COMPRESSION = 'acompressor=threshold=-30dB:ratio=6:attack=5:release=250';
// Secondo gradino: transienti che la compressione leggera non porta a
// bersaglio (battito, colpi secchi) chiusi da un compressore più deciso.
const STRONG_COMPRESSION = 'acompressor=threshold=-20dB:ratio=12:attack=2:release=150';
const LIGHT_COMPRESSION_LIMITER = 'alimiter=limit=0.6:level=false:attack=5:release=50';

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
  if (effects.length !== 41) fail(`Il manifesto elenca ${effects.length} effetti, attesi 41.`);
  if (loops.length !== 20) fail(`Il manifesto elenca ${loops.length} loop, attesi 20.`);
  const duplicates = entries.filter((entry, index) => entries.findIndex((other) => other.path === entry.path) !== index);
  if (duplicates.length > 0) fail(`File ripetuti nel manifesto: ${duplicates.map((entry) => entry.path).join(', ')}`);
  return entries;
}

/**
 * FONTI.txt: una riga per file, `percorso | titolo | autore | URL | licenza`.
 * Senza questi dati un file non può entrare nei crediti, quindi il controllo
 * tratta la riga mancante come un errore, non come un avviso.
 */
function readFonti(manifestPaths) {
  const file = join(AUDIO_ROOT, 'FONTI.txt');
  const result = { byPath: new Map(), errors: [], dangling: [], unexpected: [] };
  if (!existsSync(file)) {
    result.errors.push('Manca apps/frontend/public/assets/audio/FONTI.txt.');
    return result;
  }

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) return;
    const number = index + 1;
    const parts = text.split('|').map((part) => part.trim());
    if (parts.length !== 5) {
      result.errors.push(`FONTI.txt riga ${number}: servono 5 campi (percorso | titolo | autore | URL | licenza).`);
      return;
    }
    const [rawPath, title, author, url, licence] = parts;
    const path = rawPath.replace(/^\.\//, '').replace(/\\/g, '/');
    if (!/^(interface|gioco|casino|sala|bonus|attesa|loop)\/[^/]+\.m4a$/.test(path)) {
      result.errors.push(`FONTI.txt riga ${number}: percorso non valido "${rawPath}".`);
      return;
    }
    if (!title || !author || !licence) {
      result.errors.push(`FONTI.txt riga ${number}: titolo, autore e licenza sono obbligatori (${path}).`);
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      result.errors.push(`FONTI.txt riga ${number}: URL non valido per ${path}.`);
      return;
    }
    if (result.byPath.has(path)) {
      result.errors.push(`FONTI.txt riga ${number}: ${path} è già citato sopra.`);
      return;
    }
    result.byPath.set(path, { title, author, url, licence, line: number });
    if (!existsSync(join(AUDIO_ROOT, path))) result.dangling.push({ path, line: number });
    if (!manifestPaths.has(path)) result.unexpected.push({ path, line: number });
  });
  return result;
}

function findTool(name) {
  const candidates = [
    process.env[`${name.toUpperCase()}_PATH`],
    join(ROOT, '.tools/ffmpeg', name),
    join(ROOT, '.tools/ffmpeg', `${name}.exe`),
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

/** Come `run`, ma restituisce i byte: serve per leggere il PCM dei loop. */
function runBinary(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(String(result.stderr ?? '').slice(-1200));
    fail(`Comando fallito: ${basename(command)} ${commandArgs.join(' ')}`);
  }
  return result.stdout;
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

/**
 * Punto di loop: con l'incrocio di 1,5 s il confine è continuo per
 * costruzione, quindi l'unico difetto misurabile è un salto di campione fra
 * ultimo e primo frame (si sentirebbe come un click a ogni giro).
 */
function checkLoopSeam(file) {
  const pcm = runBinary(FFMPEG, [
    '-hide_banner', '-nostats', '-v', 'error',
    '-i', file,
    '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '2', '-ar', '44100', '-',
  ]);
  const frames = Math.floor(pcm.length / 4);
  if (frames < 4410) return { jumpPercent: null, problems: ['file troppo corto per il controllo'] };

  const sample = (frame, channel) => pcm.readInt16LE(frame * 4 + channel * 2) / 32768;
  const jump = Math.max(
    Math.abs(sample(0, 0) - sample(frames - 1, 0)),
    Math.abs(sample(0, 1) - sample(frames - 1, 1)),
  );
  return {
    jumpPercent: Number((jump * 100).toFixed(1)),
    problems: jump > 0.08 ? [`salto del ${Math.round(jump * 100)}% sul confine`] : [],
  };
}

/** Picco di campione in dBFS: per i suoni troppo corti per il loudness. */
function measureMaxVolume(file) {
  const result = run(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', 'volumedetect',
    '-f', 'null', '-',
  ], { allowFailure: true });
  const match = (result.stderr ?? '').match(/max_volume:\s*(-?[0-9.]+|-inf) dB/);
  if (!match || match[1] === '-inf') return null;
  return Number(match[1]);
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

/** Se il grezzo era finito nella cartella di destinazione, va in _src/. */
function archiveSource(entry, source, candidate) {
  if (!candidate.raw) return;
  const archive = join(AUDIO_ROOT, '_src', entry.folder);
  if (dirname(source) === archive) return;
  mkdirSync(archive, { recursive: true });
  const destination = join(archive, basename(source));
  if (!existsSync(destination)) renameSync(source, destination);
}

/** Chiude il file: archivia il grezzo, poi misura durata, peso e loudness. */
function finish(entry, source, candidate, output) {
  archiveSource(entry, source, candidate);
  return {
    seconds: probeSeconds(output),
    bytes: statSync(output).size,
    ...measureLoudness(output),
  };
}

function processEffect(entry, source, candidate, output, target, sourceSeconds) {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(dirname(output), { recursive: true });
  const encoded = `${output}.part.m4a`;
  const limiter = LIGHT_COMPRESSION_LIMITER;

  const tooShortForLoudness = sourceSeconds < 1.2 && !LOUDNESS_ON_SHORT.has(entry.path);
  const willCut = sourceSeconds > entry.maxSeconds + 0.05;

  /** Catena base: normalizza, poi taglia e sfuma la coda vera. */
  const buildChain = (correctionDb, compression) => {
    const chain = [];
    if (compression && !tooShortForLoudness) chain.push(compression);
    if (tooShortForLoudness) {
      const peakDb = measureMaxVolume(source);
      if (peakDb === null) fail(`${entry.path} è muto: nessun campione da normalizzare.`);
      // Alza anche i suoni troppo bassi: il tetto a 0 dB bloccherebbe ogni
      // correzione verso l'alto e lascerebbe il file sotto bersaglio.
      chain.push(`volume=${Math.max(-24, Math.min(20, -3 - peakDb)).toFixed(2)}dB`);
    } else {
      // Il loudnorm lavora sul file intero: se il silenzio viene tagliato
      // prima, su molti campioni il filtro rinuncia al guadagno.
      chain.push(`loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}`);
    }
    if (Math.abs(correctionDb) > 0.05) chain.push(`volume=${correctionDb.toFixed(2)}dB`);
    chain.push('aresample=44100');
    chain.push(compression ? limiter : 'alimiter=limit=0.75:level=false:attack=5:release=50');
    if (sourceSeconds >= 0.4) chain.push(TRIM_BOTH_ENDS);
    chain.push(`atrim=start=0:end=${entry.maxSeconds}`);
    if (willCut) chain.push('areverse', `afade=t=in:st=0:d=${FADE_OUT_SECONDS}`, 'areverse');
    return chain.join(',');
  };

  const encode = (correctionDb, compression, destination) => {
    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', source,
      '-af', buildChain(correctionDb, compression),
      '-c:a', 'aac',
      '-b:a', target.bitrate,
      '-ac', String(target.channels),
      '-ar', '44100',
      '-movflags', '+faststart',
      '-t', String(entry.maxSeconds),
      destination,
    ]);
  };

  try {
    // Bersaglio: LUFS degli effetti, picco dei file troppo corti per la misura
    // integrata. Il loudnorm da solo non arriva sempre: si misura il file
    // finito e si corregge il guadagno. Se lo scarto resta, si sale di un
    // gradino di compressione e si tiene solo ciò che avvicina al bersaglio.
    const goal = tooShortForLoudness ? -3 : target.i;
    const valueOf = (measure) => (tooShortForLoudness ? measure.peak : measure.lufs) ?? goal;
    const distance = (measure) => Math.abs(goal - valueOf(measure));
    const attempt = (gain, compression) => {
      encode(gain, compression, encoded);
      return { gain, compression, ...measureLoudness(encoded) };
    };

    // Gradini di compressione: pulito, leggero, deciso. Ogni gradino corregge
    // il guadagno sulla propria misura e si tiene solo se avvicina al
    // bersaglio; se un gradino non aiuta si passa al successivo.
    const ladder = [null, LIGHT_COMPRESSION, STRONG_COMPRESSION];
    let best = attempt(0, ladder[0]);
    for (let round = 1; round < ladder.length && distance(best) > 0.6; round += 1) {
      const gain = Math.max(-12, Math.min(20, best.gain + goal - valueOf(best)));
      const candidate = attempt(gain, ladder[round]);
      if (distance(candidate) < distance(best)) best = candidate;
    }
    encode(best.gain, best.compression, encoded);

    renameSync(encoded, output);
    return {
      status: 'done',
      source: relative(ROOT, source),
      target: tooShortForLoudness ? 'picco -3 dBFS' : target.i,
      ...finish(entry, source, candidate, output),
    };
  } finally {
    rmSync(encoded, { force: true });
  }
}

function processLoop(entry, source, candidate, output, target) {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(dirname(output), { recursive: true });
  const cleaned = join(TMP, `${entry.folder}-${entry.name}-clean.wav`);
  const trimmedFile = join(TMP, `${entry.folder}-${entry.name}-trim.wav`);
  const loopFile = join(TMP, `${entry.folder}-${entry.name}-loop.wav`);
  const encoded = `${output}.part.m4a`;

  try {
    // 1. Stereo, 44,1 kHz: la musica si misura e si taglia così com'è.
    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', source,
      '-ac', '2',
      '-ar', '44100',
      '-c:a', 'pcm_s16le',
      cleaned,
    ]);

    const cleanedSeconds = probeSeconds(cleaned);
    if (cleanedSeconds < LOOP_MIN_SECONDS) {
      console.warn(`  ! ${entry.path}: ${cleanedSeconds.toFixed(1)} s, sotto il minimo di ${LOOP_MIN_SECONDS} s; va bene ma il giro è corto.`);
    }

    // 2. Taglio al massimo, poi incrocio coda/testa di 1,5 s: il giro non ha
    //    il salto e non si sente il buco della dissolvenza.
    let base = cleaned;
    if (cleanedSeconds > LOOP_MAX_SECONDS) {
      run(FFMPEG, ['-hide_banner', '-nostats', '-y', '-i', cleaned, '-t', String(LOOP_MAX_SECONDS), '-c:a', 'pcm_s16le', trimmedFile]);
      base = trimmedFile;
    }
    const baseSeconds = probeSeconds(base);
    const fadeSeconds = Math.min(LOOP_CROSSFADE_SECONDS, baseSeconds / 4);
    const bodyEnd = (baseSeconds - fadeSeconds).toFixed(3);
    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', base,
      '-filter_complex',
      `[0:a]atrim=start=0:end=${fadeSeconds.toFixed(3)},asetpts=PTS-STARTPTS[head];` +
        `[0:a]atrim=start=${fadeSeconds.toFixed(3)}:end=${bodyEnd},asetpts=PTS-STARTPTS[body];` +
        `[0:a]atrim=start=${bodyEnd},asetpts=PTS-STARTPTS[tail];` +
        `[tail][head]acrossfade=d=${fadeSeconds.toFixed(3)}:c1=tri:c2=tri[blend];` +
        `[blend][body]concat=n=2:v=0:a=1[out]`,
      '-map', '[out]',
      '-c:a', 'pcm_s16le', loopFile,
    ]);

    // 3. Musica densa: due passate lineari, il guadagno unico non pompa.
    const measured = measureNormalization(loopFile, target);
    const filter = [
      `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}` +
        `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
        `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
        `:offset=${measured.target_offset}:linear=true`,
      'aresample=44100',
      'alimiter=limit=0.75:level=false:attack=5:release=50',
    ].join(',');

    run(FFMPEG, [
      '-hide_banner', '-nostats', '-y',
      '-i', loopFile,
      '-af', filter,
      '-c:a', 'aac',
      '-b:a', target.bitrate,
      '-ac', '2',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-t', String(LOOP_MAX_SECONDS),
      encoded,
    ]);

    renameSync(encoded, output);
    const seam = checkLoopSeam(output);
    if (seam.problems.length > 0) {
      console.warn(`  ! ${entry.path}: punto di loop da rivedere — ${seam.problems.join('; ')}.`);
    }
    return {
      status: 'done',
      source: relative(ROOT, source),
      target: target.i,
      seam,
      ...finish(entry, source, candidate, output),
    };
  } finally {
    rmSync(cleaned, { force: true });
    rmSync(trimmedFile, { force: true });
    rmSync(loopFile, { force: true });
    rmSync(encoded, { force: true });
  }
}

function processEntry(entry) {
  const output = join(AUDIO_ROOT, entry.path);
  if (existsSync(output) && !FORCE) {
    return { status: 'skip', reason: 'già elaborato' };
  }

  const candidate = sourceCandidates(entry).find((item) => existsSync(item.file));
  if (!candidate) return { status: 'missing' };
  const source = candidate.file;
  const sourceSeconds = probeSeconds(source);
  if (sourceSeconds <= 0) fail(`${relative(ROOT, source)} non è un file audio leggibile.`);

  const target = entry.isLoop ? LOOP_LOUDNESS : EFFECT_LOUDNESS;
  return entry.isLoop
    ? processLoop(entry, source, candidate, output, target)
    : processEffect(entry, source, candidate, output, target, sourceSeconds);
}

function formatDuration(seconds) {
  return `${seconds.toFixed(1)} s`;
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Compila docs/CREDITI-AUDIO.md dai metadati di FONTI.txt e dalle misure
 * reali dei file: durata, peso, LUFS, picco e — per i loop — il punto di
 * giunzione. Rigenerabile: non si modifica a mano.
 */
function writeCredits(entries) {
  const fonti = readFonti(new Set(entries.map((entry) => entry.path)));
  const missing = entries.filter((entry) => !existsSync(join(AUDIO_ROOT, entry.path)));
  if (missing.length > 0) {
    // I file non ancora consegnati restano fuori dai crediti: il manifesto li
    // elenca lo stesso, così --check dice sempre quanti ne mancano.
    console.log(`In arrivo, fuori dai crediti: ${missing.length}`);
    for (const entry of missing) console.log(`  - ${entry.path}`);
  }

  const cell = (text) => String(text).replace(/\|/g, '\\|');
  const rows = [];
  let total = 0;
  for (const entry of entries) {
    const file = join(AUDIO_ROOT, entry.path);
    if (!existsSync(file)) continue;
    const meta = fonti.byPath.get(entry.path);
    if (!meta) fail(`Manca la riga in FONTI.txt per ${entry.path}.`);
    const seconds = probeSeconds(file);
    const bytes = statSync(file).size;
    const loudness = measureLoudness(file);
    total += bytes;
    rows.push({
      entry,
      meta,
      seconds,
      bytes,
      lufs: loudness.lufs,
      peak: loudness.peak,
      seam: entry.isLoop ? checkLoopSeam(file) : null,
    });
  }

  const effects = rows.filter((row) => !row.entry.isLoop);
  const loops = rows.filter((row) => row.entry.isLoop);
  const licences = new Map();
  for (const row of rows) {
    licences.set(row.meta.licence, (licences.get(row.meta.licence) ?? 0) + 1);
  }

  const lines = [
    '# Crediti audio',
    '',
    'Generato da `node scripts/audio/process-audio.mjs --credits` il ' + new Date().toISOString().slice(0, 10) + '.',
    'Non si modifica a mano: i dati vengono da `apps/frontend/public/assets/audio/FONTI.txt`',
    'e le misure dai file elaborati (ffmpeg, EBU R128).',
    '',
    'Quasi tutti i suoni sono registrazioni scelte da librerie con licenza',
    'compatibile con un\'app pubblica. Fanno eccezione gli effetti marcati',
    '«Nostra» (gong del via, bong del countdown, transizione, gettoni,',
    'racchetta, scoppio e miccia della bomba, quattro urti delle Biglie): sono',
    'la nostra sintesi renderizzata in file con lo stesso script, quindi',
    'compaiono con licenza «Nostra».',
    '',
    '## Licenze usate',
    '',
    ...Array.from(licences.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([licence, count]) => `- **${licence}** — ${count} file`),
    '',
    '## Effetti (' + effects.length + ')',
    '',
    '| File | Titolo | Autore | Licenza | Durata | Peso | LUFS | Picco |',
    '|---|---|---|---|---|---|---|---|',
    ...effects.map((row) =>
      `| \`${row.entry.path}\` | ${cell(row.meta.title)} | ${cell(row.meta.author)} | ${cell(row.meta.licence)} | ` +
        `${formatDuration(row.seconds)} | ${formatSize(row.bytes)} | ` +
        `${row.lufs !== null && row.lufs > -60 ? row.lufs : '— (vedi picco)'} | ${row.peak ?? '?'} dBFS |`,
    ),
    '',
    '## Sottofondi (' + loops.length + ')',
    '',
    '| File | Brano | Autore | Licenza | Durata | Peso | LUFS | Salto di loop |',
    '|---|---|---|---|---|---|---|---|',
    ...loops.map((row) =>
      `| \`${row.entry.path}\` | ${cell(row.meta.title)} | ${cell(row.meta.author)} | ${cell(row.meta.licence)} | ` +
        `${formatDuration(row.seconds)} | ${formatSize(row.bytes)} | ${row.lufs ?? '?'} | ` +
        `${row.seam?.jumpPercent ?? '?'}%${row.seam && row.seam.problems.length > 0 ? ' ⚠' : ''} |`,
    ),
    '',
    'Il salto di loop è la differenza fra l\'ultimo e il primo campione sul confine:',
    'sotto il 8% non si sente; sopra, il giro va rifilato a orecchio.',
    '',
    '## Provenienza',
    '',
    ...rows.map((row) => `- \`${row.entry.path}\` — ${cell(row.meta.title)}: <${row.meta.url}>`),
    '',
    '## Totale',
    '',
    `${rows.length} file, ${formatSize(total)}. Effetti: bersaglio ` +
      `${EFFECT_LOUDNESS.i} LUFS con picco ≤ ${EFFECT_LOUDNESS.tp} dBTP; sottofondi a ` +
      `${LOOP_LOUDNESS.i} LUFS con picco ≤ ${LOOP_LOUDNESS.tp} dBTP.`,
    '',
    'I suoni sotto 1,2 s sono normalizzati sul picco a −3 dBFS, non sul LUFS:',
    'sono troppo corti perché la misura integrata abbia senso, quindi in tabella',
    'mostrano «—» e vale il picco. Sui suoni con molta cresta (un riser, un galoppo)',
    'entra una compressione leggera; dove anche quella non basta, il valore in',
    'tabella è quello misurato davvero, non quello richiesto.',
    '',
    'Sostituire un suono = sostituire il file con lo stesso nome e rigenerare i crediti.',
    '',
  ];

  writeFileSync(CREDITS_PATH, lines.join('\n'), 'utf8');
  console.log(`Scritto ${relative(ROOT, CREDITS_PATH)}: ${rows.length} file, ${formatSize(total)}.`);
  const toCheck = rows.filter((row) => row.seam && row.seam.problems.length > 0);
  if (toCheck.length > 0) {
    console.log(`\nLoop da rivedere (${toCheck.length}):`);
    for (const row of toCheck) console.log(`  - ${row.entry.path}: ${row.seam.problems.join('; ')}`);
  }
}

const entries = readManifest();
const selected = ONLY ? entries.filter((entry) => entry.name === ONLY || entry.path === ONLY) : entries;
if (selected.length === 0) fail(`Nessun file nel manifesto corrisponde a "${ONLY}".`);

if (CREDITS) {
  writeCredits(entries);
  process.exit(0);
}

if (CHECK) {
  const missing = selected.filter((entry) => {
    const output = join(AUDIO_ROOT, entry.path);
    if (existsSync(output) && !FORCE) return false;
    return !sourceCandidates(entry).some((item) => existsSync(item.file));
  });
  const fonti = readFonti(new Set(entries.map((entry) => entry.path)));
  const present = selected.filter((entry) => existsSync(join(AUDIO_ROOT, entry.path)));
  const presentWithoutFonti = present.filter((entry) => !fonti.byPath.has(entry.path));

  const effectsCount = entries.filter((entry) => !entry.isLoop).length;
  const loopsCount = entries.length - effectsCount;
  console.log(`Manifesto: ${entries.length} file (${effectsCount} effetti, ${loopsCount} loop).`);
  console.log(`ffmpeg: ${FFMPEG}`);
  console.log(`FONTI.txt: ${fonti.byPath.size} righe valide.`);

  let problems = false;
  if (missing.length > 0) {
    problems = true;
    console.log(`\nMancano ${missing.length} file:`);
    for (const entry of missing) console.log(`  - ${entry.path}`);
  }
  if (presentWithoutFonti.length > 0) {
    problems = true;
    console.log(`\nFile presenti senza riga in FONTI.txt (${presentWithoutFonti.length}), i crediti sarebbero incompleti:`);
    for (const entry of presentWithoutFonti) console.log(`  - ${entry.path}`);
  }
  if (fonti.dangling.length > 0) {
    problems = true;
    console.log(`\nRighe di FONTI.txt che citano file inesistenti (${fonti.dangling.length}):`);
    for (const item of fonti.dangling) console.log(`  - ${item.path} (riga ${item.line})`);
  }
  if (fonti.unexpected.length > 0) {
    problems = true;
    console.log(`\nRighe di FONTI.txt fuori dal manifesto (${fonti.unexpected.length}):`);
    for (const item of fonti.unexpected) console.log(`  - ${item.path} (riga ${item.line})`);
  }
  if (fonti.errors.length > 0) {
    problems = true;
    console.log(`\nRighe di FONTI.txt non valide (${fonti.errors.length}):`);
    for (const message of fonti.errors) console.log(`  - ${message}`);
  }
  if (problems) process.exit(1);
  console.log('\nTutti i file attesi ci sono e ogni file ha la sua riga in FONTI.txt.');
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
rmSync(TMP, { recursive: true, force: true });

// Anche fuori da --check: un file elaborato senza metadati non entra nei crediti.
const fonti = readFonti(new Set(entries.map((entry) => entry.path)));
const uncredited = entries.filter((entry) => existsSync(join(AUDIO_ROOT, entry.path)) && !fonti.byPath.has(entry.path));
if (uncredited.length > 0) {
  console.log(`\nSenza riga in FONTI.txt (${uncredited.length}), resteranno fuori dai crediti:`);
  for (const entry of uncredited) console.log(`  - ${entry.path}`);
}
if (failures > 0) {
  console.log(`\n${failures} file non elaborati per errore: vedi sopra.`);
  process.exit(1);
}
console.log('\nFatto.' + (uncredited.length === 0 ? ' Tutti i file hanno i loro metadati.' : ' Aggiungi le righe mancanti in FONTI.txt.'));
