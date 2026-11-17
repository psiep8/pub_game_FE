#!/usr/bin/env node
/**
 * Rende il sottofondo del rotolamento delle Biglie: `loop/biglie.m4a`.
 *
 * Il suono è costruito, non registrato: un corpo che scorre (rumore filtrato),
 * il fruscio del fondo (banda media modulata dal rotolamento) e i ticchi delle
 * biglie, con qualche urto sordo. È un loop perfetto: la coda si incrocia con
 * la testa, quindi Web Audio lo ripete senza stacco.
 *
 * Uso:
 *   node scripts/audio/render-marble-roll.mjs            # crea il file
 *   node scripts/audio/render-marble-roll.mjs --keep-wav  # lascia anche il wav
 *
 * Il file finisce in `apps/frontend/public/assets/audio/loop/biglie.m4a`, con
 * la riga in FONTI.txt e la tabella in docs/MANIFESTO-AUDIO.md.
 * ffmpeg si prende da FFMPEG_PATH, poi da PATH.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SECONDS = 24;
const TAIL = 1.5;
const RATE = 44100;
const CHANNELS = 2;

const rng = (() => {
  let state = 0x2f6e2b1 >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
})();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Filtro a un polo: `kind` = 'low' | 'high'. */
function onePole(input, cutoff, kind, state) {
  const dt = 1 / RATE;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);
  state.y = state.y + alpha * (input - state.y);
  return kind === 'low' ? state.y : input - state.y;
}

/** Banda = passa-basso meno passa-basso più aperto. */
function band(input, low, high, states) {
  const wide = onePole(input, high, 'low', states.wide);
  const narrow = onePole(input, low, 'low', states.narrow);
  return wide - narrow;
}

function render() {
  const total = Math.round((SECONDS + TAIL) * RATE);
  const left = new Float32Array(total);
  const right = new Float32Array(total);

  // Corpo del rotolamento: rumore bruno filtrato, modulato piano.
  const bodyL = { y: 0 };
  const bodyR = { y: 0 };
  // Fruscio del fondo: banda media modulata da un tremolo di rotolamento.
  const hissL = { wide: { y: 0 }, narrow: { y: 0 } };
  const hissR = { wide: { y: 0 }, narrow: { y: 0 } };

  let brownL = 0;
  let brownR = 0;
  for (let index = 0; index < total; index++) {
    const t = index / RATE;
    // Modulazioni con un numero intero di cicli: il giro torna al punto di prima.
    const slow = 0.75 + 0.25 * Math.sin((2 * Math.PI * 12 * t) / SECONDS);
    const roll = 0.55 + 0.45 * Math.sin((2 * Math.PI * 72 * t) / SECONDS);
    const grain = 0.7 + 0.3 * Math.sin((2 * Math.PI * 168 * t) / SECONDS + 1.1);

    brownL = clamp(brownL * 0.996 + (rng() * 2 - 1) * 0.06, -1, 1);
    brownR = clamp(brownR * 0.996 + (rng() * 2 - 1) * 0.06, -1, 1);

    const bodyLowL = onePole(brownL, 240, 'low', bodyL);
    const bodyLowR = onePole(brownR, 240, 'low', bodyR);
    const hissBandL = band(rng() * 2 - 1, 1200, 3600, hissL);
    const hissBandR = band(rng() * 2 - 1, 1200, 3600, hissR);

    left[index] = bodyLowL * 0.5 * slow + hissBandL * 0.16 * roll * grain;
    right[index] = bodyLowR * 0.5 * slow + hissBandR * 0.16 * roll * grain;
  }

  // Ticchi delle biglie: cristalli corti, sparsi, mai nello stesso punto.
  const tics = 64;
  for (let n = 0; n < tics; n++) {
    const at = Math.floor(rng() * (SECONDS + TAIL) * RATE);
    const length = Math.floor((0.05 + rng() * 0.1) * RATE);
    const freq = 2600 + rng() * 2600;
    const gain = 0.06 + rng() * 0.07;
    const pan = rng();
    for (let index = 0; index < length; index++) {
      const decay = Math.exp(-index / (length * 0.28));
      const value = Math.sin((2 * Math.PI * freq * index) / RATE) * decay * gain;
      const position = at + index;
      if (position >= left.length) break;
      left[position] += value * (1 - pan);
      right[position] += value * pan;
    }
  }

  // Urti sordi: la biglia che tocca il muro, corpo basso e breve.
  const knocks = 14;
  for (let n = 0; n < knocks; n++) {
    const at = Math.floor(rng() * (SECONDS + TAIL) * RATE);
    const length = Math.floor(0.16 * RATE);
    const freq = 170 + rng() * 220;
    const gain = 0.05 + rng() * 0.05;
    for (let index = 0; index < length; index++) {
      const decay = Math.exp(-index / (length * 0.18));
      const value = Math.sin((2 * Math.PI * freq * index) / RATE) * decay * gain;
      const position = at + index;
      if (position >= left.length) break;
      left[position] += value;
      right[position] += value * 0.92;
    }
  }

  // Cucitura del loop: la coda rientra nella testa con dissolvenza a potenza
  // costante, così il file finisce esattamente dove comincia.
  const size = Math.round(SECONDS * RATE);
  const tail = Math.round(TAIL * RATE);
  for (let index = 0; index < tail; index++) {
    const fade = index / tail;
    const inGain = Math.sin(fade * Math.PI * 0.5);
    const outGain = Math.cos(fade * Math.PI * 0.5);
    left[index] = left[index] * inGain + left[size + index] * outGain;
    right[index] = right[index] * inGain + right[size + index] * outGain;
  }

  // Normalizzazione dolce e limitatore morbido: nessuna saturazione.
  let peak = 1e-6;
  for (let index = 0; index < size; index++) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  const gain = 0.82 / peak;
  for (let index = 0; index < size; index++) {
    left[index] = Math.tanh(left[index] * gain);
    right[index] = Math.tanh(right[index] * gain);
  }

  return { left: left.subarray(0, size), right: right.subarray(0, size) };
}

function toWav(channels) {
  const frames = channels[0].length;
  const data = Buffer.alloc(44 + frames * CHANNELS * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + frames * CHANNELS * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(CHANNELS, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * CHANNELS * 2, 28);
  data.writeUInt16LE(CHANNELS * 2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(frames * CHANNELS * 2, 40);
  let offset = 44;
  for (let index = 0; index < frames; index++) {
    for (const channel of channels) {
      const value = Math.round(clamp(channel[index], -1, 1) * 32767);
      data.writeInt16LE(value, offset);
      offset += 2;
    }
  }
  return data;
}

const { left, right } = render();
const dir = mkdtempSync(join(tmpdir(), 'biglie-roll-'));
const wavPath = join(dir, 'biglie-roll.wav');
writeFileSync(wavPath, toWav([left, right]));

const target = 'apps/frontend/public/assets/audio/loop/biglie.m4a';
const ffmpeg = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
const result = spawnSync(
  ffmpeg,
  [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', wavPath,
    '-af', 'loudnorm=I=-23:TP=-1.5:LRA=11',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '44100',
    target,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error(`✗ ffmpeg ha fallito (${ffmpeg}). Metti FFMPEG_PATH o installa ffmpeg.`);
  process.exit(1);
}

if (!process.argv.includes('--keep-wav')) rmSync(dir, { recursive: true, force: true });
const bytes = readFileSync(target).length;
console.log(`ok ${target} · ${SECONDS} s · ${(bytes / 1024).toFixed(0)} KB`);
