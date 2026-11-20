#!/usr/bin/env node
/**
 * Rende i sottofondi che mancano al manifesto: tredici loop strumentali
 * originali, 62 s, 44,1 kHz stereo, scritti come wav in
 * apps/frontend/public/assets/audio/_src/loop/.
 *
 * Non pubblica niente: il wav è il grezzo, e `process-audio.mjs` fa il resto
 * (incrocio di 1,5 s, −23 LUFS, AAC 112 kbps, 60 s esatti).
 *
 * I BPM sono multipli di 16 di proposito: in 60 s cadono un numero intero di
 * battute e di giri di accordi, quindi l'incrocio coda/testa trova la stessa
 * musica e il giro non salta.
 *
 * Uso:
 *   node scripts/audio/generate-loops.mjs            # tutti e tredici
 *   node scripts/audio/generate-loops.mjs --only atto-1
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_ROOT = join(ROOT, 'apps/frontend/public/assets/audio/_src/loop');

const SR = 44100;
/** Il grezzo deve superare i 61,5 s che servono al giro da 60 s. */
const RAW_SECONDS = 62;

const TAU = Math.PI * 2;
const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);

/** Rumore riproducibile: due render dello stesso loop danno lo stesso file. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function waveAt(kind, phase) {
  switch (kind) {
    case 'saw': return 2 * (phase - Math.floor(phase + 0.5));
    case 'square': return phase % 1 < 0.5 ? 1 : -1;
    case 'pulse': return phase % 1 < 0.25 ? 1 : -1;
    case 'tri': {
      const p = phase % 1;
      return 4 * Math.abs(p - 0.5) - 1;
    }
    default: return Math.sin(TAU * phase);
  }
}

/** Una voce con inviluppo, filtro a due poli e pan equal-power. */
function addVoice(track, options) {
  const {
    start, freq,
    dur = 0.3,
    gain = 0.12,
    pan = 0,
    wave = 'sine',
    attack = 0.005,
    decay = 0.1,
    sustain = 0.6,
    release = 0.12,
    cutoff = 0,
    cutoffEnd = 0,
    detune = 0,
    pitchEnd = 0,
    pitchTime = 0.08,
    vibrato = 0,
    vibratoRate = 5.2,
  } = options;

  const total = Math.floor((dur + release) * SR);
  const offset = Math.floor(start * SR);
  if (total <= 0 || offset >= track.L.length) return;

  const theta = ((pan + 1) * Math.PI) / 4;
  const gainL = Math.cos(theta) * gain;
  const gainR = Math.sin(theta) * gain;

  const openA = 1 - Math.exp((-TAU * Math.max(40, cutoff || 18000)) / SR);
  const closeA = cutoffEnd ? 1 - Math.exp((-TAU * Math.max(40, cutoffEnd)) / SR) : openA;
  const pitches = detune ? [1 - detune, 1, 1 + detune] : [1];
  const phases = pitches.map(() => 0);

  let lowL = 0;
  let lowR = 0;
  let low2L = 0;
  let low2R = 0;

  for (let i = 0; i < total; i += 1) {
    const index = offset + i;
    if (index >= track.L.length) break;
    const t = i / SR;

    let env;
    if (t < attack) env = attack > 0 ? t / attack : 1;
    else if (t < attack + decay) env = 1 - (1 - sustain) * ((t - attack) / Math.max(1e-6, decay));
    else if (t < attack + decay + dur) env = sustain;
    else env = sustain * Math.max(0, 1 - (t - attack - decay - dur) / Math.max(1e-6, release));
    if (env <= 0) continue;

    const glide = pitchEnd && pitchTime > 0
      ? freq + (pitchEnd - freq) * Math.min(1, t / pitchTime)
      : freq;
    const wobble = vibrato ? 1 + vibrato * Math.sin(TAU * vibratoRate * t) : 1;

    let sample = 0;
    for (let p = 0; p < pitches.length; p += 1) {
      phases[p] += (glide * wobble * pitches[p]) / SR;
      sample += waveAt(wave, phases[p]);
    }
    sample /= pitches.length;

    const mix = Math.min(1, (i / total) * 4);
    const open = openA + (closeA - openA) * mix;
    lowL += open * (sample - lowL);
    lowR += open * (sample - lowR);
    low2L += open * (lowL - low2L);
    low2R += open * (lowR - low2R);

    track.L[index] += low2L * gainL * env;
    track.R[index] += low2R * gainR * env;
  }
}

/** Rumore filtrato: piatti, rullante, shaker, spazzole. */
function addNoise(track, options) {
  const {
    start, dur = 0.05, gain = 0.1, pan = 0, highpass = 4000, decay = 0.08, lowpass = 0,
  } = options;
  const total = Math.floor((dur + decay) * SR);
  const offset = Math.floor(start * SR);
  if (total <= 0 || offset >= track.L.length) return;

  const random = track.rand;
  const theta = ((pan + 1) * Math.PI) / 4;
  const gainL = Math.cos(theta) * gain;
  const gainR = Math.sin(theta) * gain;
  const lowA = 1 - Math.exp((-TAU * highpass) / SR);
  const softA = lowpass ? 1 - Math.exp((-TAU * lowpass) / SR) : 0;
  let lowL = 0;
  let lowR = 0;
  let softL = 0;
  let softR = 0;

  for (let i = 0; i < total; i += 1) {
    const index = offset + i;
    if (index >= track.L.length) break;
    const t = i / SR;
    const env = t < dur ? 1 : Math.max(0, 1 - (t - dur) / Math.max(1e-6, decay));
    if (env <= 0) continue;
    const nL = random() * 2 - 1;
    const nR = random() * 2 - 1;
    lowL += lowA * (nL - lowL);
    lowR += lowA * (nR - lowR);
    let outL = nL - lowL;
    let outR = nR - lowR;
    if (softA) {
      softL += softA * (outL - softL);
      softR += softA * (outR - softR);
      outL = softL;
      outR = softR;
    }
    track.L[index] += outL * gainL * env;
    track.R[index] += outR * gainR * env;
  }
}

// — Kit di percussioni: gli stessi colpi per tutti, cambia il disegno. —

function kick(track, at, gain = 0.6) {
  addVoice(track, {
    start: at, freq: 128, pitchEnd: 44, pitchTime: 0.09, dur: 0.03,
    gain, wave: 'sine', attack: 0.002, decay: 0.02, sustain: 0, release: 0.3,
    cutoff: 1600,
  });
  addNoise(track, { start: at, dur: 0.004, gain: gain * 0.2, highpass: 1800, decay: 0.01 });
}

function snare(track, at, gain = 0.3) {
  addNoise(track, { start: at, dur: 0.02, gain, highpass: 1600, decay: 0.16, lowpass: 7000 });
  addVoice(track, {
    start: at, freq: 187, dur: 0.02, gain: gain * 0.5, wave: 'tri',
    attack: 0.001, decay: 0.03, sustain: 0, release: 0.07,
  });
}

function brush(track, at, gain = 0.12) {
  addNoise(track, { start: at, dur: 0.05, gain, highpass: 2600, decay: 0.2, lowpass: 9000 });
}

function hat(track, at, gain = 0.12, open = false) {
  addNoise(track, {
    start: at, dur: open ? 0.06 : 0.012, gain,
    highpass: 7200, decay: open ? 0.3 : 0.05,
  });
}

function ride(track, at, gain = 0.08) {
  addNoise(track, { start: at, dur: 0.02, gain, highpass: 5200, decay: 0.5, lowpass: 12000 });
  addVoice(track, {
    start: at, freq: 3100, dur: 0.01, gain: gain * 0.35, wave: 'sine',
    attack: 0.001, decay: 0.02, sustain: 0, release: 0.25,
  });
}

function clap(track, at, gain = 0.2) {
  for (let i = 0; i < 3; i += 1) {
    addNoise(track, {
      start: at + i * 0.011, dur: 0.01, gain: gain * (1 - i * 0.18),
      highpass: 1400, decay: 0.09, lowpass: 5200,
    });
  }
}

function tom(track, at, note = 45, gain = 0.35) {
  addVoice(track, {
    start: at, freq: midi(note), pitchEnd: midi(note) * 0.72, pitchTime: 0.12,
    dur: 0.02, gain, wave: 'sine', attack: 0.002, decay: 0.03, sustain: 0, release: 0.28,
    cutoff: 900,
  });
}

function woodblock(track, at, gain = 0.16) {
  addVoice(track, {
    start: at, freq: 860, pitchEnd: 760, pitchTime: 0.01, dur: 0.004,
    gain, wave: 'tri', attack: 0.001, decay: 0.008, sustain: 0, release: 0.05,
  });
}

function shaker(track, at, gain = 0.05) {
  addNoise(track, { start: at, dur: 0.01, gain, highpass: 6000, decay: 0.05 });
}

// — Strumenti melodici. —

function bass(track, at, note, dur, gain = 0.22, pan = 0) {
  addVoice(track, {
    start: at, freq: midi(note), dur, gain, pan, wave: 'saw',
    attack: 0.006, decay: 0.09, sustain: 0.55, release: 0.09,
    cutoff: 420, cutoffEnd: 240,
  });
}

function subBass(track, at, note, dur, gain = 0.26) {
  addVoice(track, {
    start: at, freq: midi(note), dur, gain, wave: 'sine',
    attack: 0.01, decay: 0.08, sustain: 0.8, release: 0.12, cutoff: 160,
  });
}

function pad(track, at, notes, dur, gain = 0.06, cutoff = 1500) {
  notes.forEach((note, index) => {
    addVoice(track, {
      start: at, freq: midi(note), dur, gain, pan: (index / Math.max(1, notes.length - 1)) * 1.2 - 0.6,
      wave: 'saw', detune: 0.004, attack: Math.min(0.5, dur * 0.35), decay: 0.3,
      sustain: 0.75, release: 0.5, cutoff, cutoffEnd: cutoff * 0.8,
    });
  });
}

function strings(track, at, notes, dur, gain = 0.05, cutoff = 2400) {
  notes.forEach((note, index) => {
    addVoice(track, {
      start: at, freq: midi(note), dur, gain, pan: (index / Math.max(1, notes.length - 1)) * 1.4 - 0.7,
      wave: 'saw', detune: 0.006, attack: 0.12, decay: 0.2, sustain: 0.8,
      release: 0.35, cutoff, vibrato: 0.004, vibratoRate: 5.5,
    });
  });
}

function pluck(track, at, note, dur, gain = 0.1, pan = 0, wave = 'tri') {
  addVoice(track, {
    start: at, freq: midi(note), dur, gain, pan, wave,
    attack: 0.003, decay: 0.12, sustain: 0.25, release: 0.15, cutoff: 3200,
  });
}

function keys(track, at, notes, dur, gain = 0.08, pan = 0) {
  notes.forEach((note, index) => {
    addVoice(track, {
      start: at, freq: midi(note), dur, gain, pan: pan + index * 0.08,
      wave: 'sine', attack: 0.01, decay: 0.18, sustain: 0.32, release: 0.22, cutoff: 3600,
    });
    addVoice(track, {
      start: at, freq: midi(note + 12), dur, gain: gain * 0.25, pan,
      wave: 'sine', attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.18,
    });
  });
}

function brass(track, at, notes, dur, gain = 0.07) {
  notes.forEach((note, index) => {
    addVoice(track, {
      start: at, freq: midi(note), dur, gain, pan: index * 0.2 - 0.3,
      wave: 'saw', detune: 0.003, attack: 0.03, decay: 0.12, sustain: 0.7,
      release: 0.15, cutoff: 2600, cutoffEnd: 1600,
    });
  });
}

function lead(track, at, note, dur, gain = 0.08, pan = 0) {
  addVoice(track, {
    start: at, freq: midi(note), dur, gain, pan, wave: 'saw',
    attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.12,
    cutoff: 1800, cutoffEnd: 1200, vibrato: 0.006,
  });
}

// — I tredici loop. —

/** Cm7 F7 Bbmaj7 Eb7: il giro di quattro battute che regge quasi tutto. */
const FUNK = [
  [48, 51, 55, 58],
  [41, 45, 48, 51],
  [46, 50, 53, 57],
  [39, 43, 46, 50],
];

const TRACKS = [
  {
    file: 'atto-1',
    bpm: 96,
    title: 'Atto 1 — Aperitivo',
    compose(s) {
      const chords = [
        [48, 52, 55, 59],
        [45, 48, 52, 55],
        [50, 53, 57, 60],
        [43, 47, 50, 53],
      ];
      const roots = [36, 33, 38, 31];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        const root = roots[b % 4];
        // Bossa: basso su 1 e 3, accordi in levare, shaker continuo.
        bass(s.tr, t, root, 0.7, 0.2);
        bass(s.tr, t + s.beat * 2, root + 7, 0.6, 0.16);
        bass(s.tr, t + s.beat * 3.5, root + 4, 0.35, 0.12);
        for (const offset of [0.5, 1.5, 2.5, 3.25]) {
          keys(s.tr, t + s.beat * offset, chord, 0.18, 0.055, 0.2);
        }
        kick(s.tr, t, 0.32);
        kick(s.tr, t + s.beat * 2, 0.28);
        for (let i = 0; i < 8; i += 1) shaker(s.tr, t + s.beat * i * 0.5, i % 2 ? 0.035 : 0.05);
      }
      // Vibrafono: poche note, sempre in chiusura di giro.
      for (let b = 3; b < s.bars; b += 4) {
        const t = b * s.bar;
        for (const [offset, note] of [[2.5, 72], [3, 74], [3.5, 76]]) {
          pluck(s.tr, t + s.beat * offset, note, 0.5, 0.07, 0.45, 'sine');
        }
      }
    },
  },
  {
    file: 'atto-2',
    bpm: 112,
    title: 'Atto 2 — Si scalda',
    compose(s) {
      const roots = [36, 29, 34, 27];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = FUNK[b % 4];
        const root = roots[b % 4];
        // Funk: cassa sincopata, rullante 2 e 4, basso a sedicesimi.
        kick(s.tr, t, 0.55);
        kick(s.tr, t + s.beat * 1.75, 0.4);
        kick(s.tr, t + s.beat * 3, 0.45);
        snare(s.tr, t + s.beat, 0.26);
        snare(s.tr, t + s.beat * 3, 0.26);
        for (let i = 0; i < 16; i += 1) hat(s.tr, t + (s.beat / 4) * i, i % 4 === 2 ? 0.1 : 0.06);
        const pattern = [0, 0.75, 1.5, 2, 2.5, 3.25];
        pattern.forEach((offset, i) => bass(s.tr, t + s.beat * offset, i % 3 === 2 ? root + 12 : root, 0.22, 0.16));
        keys(s.tr, t + s.beat * 1.5, chord, 0.12, 0.05, 0.15);
        keys(s.tr, t + s.beat * 3.5, chord, 0.1, 0.04, -0.2);
      }
    },
  },
  {
    file: 'atto-3',
    bpm: 112,
    title: 'Atto 3 — Notte di sala',
    compose(s) {
      const chords = [
        [45, 48, 52, 55],
        [41, 45, 48, 52],
        [36, 40, 43, 47],
        [43, 47, 50, 53],
      ];
      const roots = [33, 29, 24, 31];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        pad(s.tr, t, chords[b % 4], s.bar * 1.1, 0.05, 1100);
        for (let i = 0; i < 4; i += 1) {
          kick(s.tr, t + s.beat * i, 0.42);
          hat(s.tr, t + s.beat * (i + 0.5), 0.1, true);
          subBass(s.tr, t + s.beat * (i + 0.5), roots[b % 4], 0.3, 0.22);
        }
        // Arpeggio in levare, morbido: dà movimento senza rubare la scena.
        chords[b % 4].forEach((note, index) => {
          pluck(s.tr, t + s.beat * (1.5 + index * 0.5), note + 12, 0.2, 0.045, index % 2 ? 0.3 : -0.3, 'tri');
        });
      }
    },
  },
  {
    file: 'atto-4',
    bpm: 128,
    title: 'Atto 4 — Sale l’energia',
    compose(s) {
      const chords = [
        [48, 52, 55, 59],
        [45, 48, 52, 55],
        [50, 53, 57, 60],
        [43, 47, 50, 53],
      ];
      const roots = [36, 33, 38, 31];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        const root = roots[b % 4];
        // Disco: quattro quarti, charleston in levare, archi sulle battute.
        for (let i = 0; i < 4; i += 1) {
          kick(s.tr, t + s.beat * i, 0.5);
          hat(s.tr, t + s.beat * (i + 0.5), 0.12, true);
          bass(s.tr, t + s.beat * (i + 0.5), i % 2 ? root + 12 : root, 0.28, 0.18);
        }
        clap(s.tr, t + s.beat, 0.18);
        clap(s.tr, t + s.beat * 3, 0.18);
        strings(s.tr, t, chord, s.beat * 1.6, 0.04, 2200);
        for (let i = 0; i < 16; i += 2) hat(s.tr, t + (s.beat / 4) * i, 0.05);
        pluck(s.tr, t + s.beat * 2.5, chord[2] + 12, 0.2, 0.05, -0.35);
        pluck(s.tr, t + s.beat * 3.5, chord[1] + 12, 0.2, 0.05, 0.35);
      }
    },
  },
  {
    file: 'atto-5',
    bpm: 128,
    title: 'Atto 5 — Finale',
    compose(s) {
      const chords = [
        [48, 52, 55, 59],
        [41, 45, 48, 52],
        [43, 47, 50, 53],
        [36, 40, 43, 47],
      ];
      const roots = [36, 29, 31, 24];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        const root = roots[b % 4];
        kick(s.tr, t, 0.55);
        kick(s.tr, t + s.beat * 2, 0.5);
        snare(s.tr, t + s.beat, 0.28);
        snare(s.tr, t + s.beat * 3, 0.28);
        if (b % 4 === 3) snare(s.tr, t + s.beat * 3.5, 0.16);
        brass(s.tr, t, chord.slice(1), 0.45, 0.07);
        brass(s.tr, t + s.beat * 2, chord.slice(1), 0.35, 0.05);
        bass(s.tr, t, root, 0.35, 0.2);
        bass(s.tr, t + s.beat * 1.5, root + 7, 0.3, 0.16);
        bass(s.tr, t + s.beat * 2.5, root + 12, 0.3, 0.14);
        strings(s.tr, t, chord, s.bar * 1.05, 0.035, 2600);
        for (let i = 0; i < 8; i += 1) shaker(s.tr, t + s.beat * i * 0.5, i % 2 ? 0.05 : 0.07);
        tom(s.tr, t + s.beat * 4, 45, 0.12);
      }
    },
  },
  {
    file: 'gioco-arena',
    bpm: 144,
    title: 'Arena — Scontro',
    compose(s) {
      const chords = [[45, 48, 52], [43, 46, 50], [41, 44, 48], [43, 46, 50]];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        // Tamburi di guerra: tom gravi, archi corti, drone sotto.
        for (const [offset, note, gain] of [
          [0, 40, 0.4], [0.75, 45, 0.28], [1.5, 40, 0.34],
          [2, 47, 0.3], [2.75, 43, 0.26], [3.25, 40, 0.32], [3.75, 45, 0.22],
        ]) {
          tom(s.tr, t + s.beat * offset, note, gain);
        }
        if (b % 4 === 3) {
          for (let i = 0; i < 8; i += 1) tom(s.tr, t + s.beat * (2 + i * 0.25), 45 + (i % 2) * 3, 0.12);
        }
        strings(s.tr, t, chords[b % 4], 0.18, 0.055, 1800);
        strings(s.tr, t + s.beat * 2, chords[b % 4], 0.18, 0.045, 1600);
        addVoice(s.tr, {
          start: t, freq: midi(28), dur: s.bar * 1.02, gain: 0.06, wave: 'saw',
          attack: 0.2, decay: 0.3, sustain: 0.8, release: 0.3, cutoff: 160,
        });
      }
    },
  },
  {
    file: 'gioco-speed-rush',
    bpm: 144,
    title: 'Speed Rush — Corsa',
    compose(s) {
      const chords = [[48, 52, 55], [45, 48, 52], [43, 47, 50], [41, 45, 48]];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        for (let i = 0; i < 4; i += 1) {
          kick(s.tr, t + s.beat * i, 0.42);
          snare(s.tr, t + s.beat * (i + 0.5), 0.12);
        }
        for (let i = 0; i < 16; i += 1) {
          hat(s.tr, t + (s.beat / 4) * i, 0.045);
          const note = chord[i % 3] + (i >= 8 ? 12 : 0);
          addVoice(s.tr, {
            start: t + (s.beat / 4) * i, freq: midi(note), dur: 0.05, gain: 0.05,
            wave: 'square', attack: 0.002, decay: 0.03, sustain: 0.1, release: 0.04, cutoff: 5200, pan: 0.15,
          });
        }
        for (let i = 0; i < 8; i += 1) {
          addVoice(s.tr, {
            start: t + s.beat * i * 0.5, freq: midi(chord[0] - 12 + (i % 2 ? 12 : 0)),
            dur: 0.09, gain: 0.14, wave: 'pulse', attack: 0.002, decay: 0.05,
            sustain: 0.4, release: 0.05, cutoff: 900,
          });
        }
      }
    },
  },
  {
    file: 'gioco-biglie',
    bpm: 128,
    title: 'Biglie — Corsa allegra',
    compose(s) {
      const chords = [[48, 52, 55], [50, 53, 57], [43, 47, 50], [45, 48, 52]];
      const melody = [72, 76, 79, 76, 74, 77, 81, 77];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        kick(s.tr, t, 0.4);
        kick(s.tr, t + s.beat * 2, 0.34);
        clap(s.tr, t + s.beat, 0.14);
        clap(s.tr, t + s.beat * 3, 0.14);
        for (let i = 0; i < 8; i += 1) {
          hat(s.tr, t + s.beat * i * 0.5, i % 2 ? 0.05 : 0.08);
          bass(s.tr, t + s.beat * i * 0.5, chord[0] - 12 + (i % 2 ? 12 : 0), 0.18, 0.16);
        }
        for (let i = 0; i < 8; i += 1) {
          pluck(s.tr, t + s.beat * i * 0.5, melody[i] + (b % 2 ? 2 : 0), 0.12, 0.06, i % 2 ? 0.4 : -0.4, 'tri');
        }
        woodblock(s.tr, t + s.beat * 2.5, 0.1);
        woodblock(s.tr, t + s.beat * 4, 0.08);
      }
    },
  },
  {
    file: 'gioco-timeline',
    bpm: 96,
    title: 'Timeline — Orologeria',
    compose(s) {
      const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        pad(s.tr, t, chord, s.bar, 0.035, 900);
        // Pizzicato in ottavi e ticchettio di orologio.
        chord.forEach((note, index) => {
          for (let i = 0; i < 8; i += 1) {
            if ((i + index) % 3 === 0) continue;
            pluck(s.tr, t + s.beat * i * 0.5, note + 12, 0.14, 0.045, index % 2 ? 0.35 : -0.35, 'saw');
          }
        });
        for (let i = 0; i < 8; i += 1) hat(s.tr, t + s.beat * i * 0.5, i % 2 ? 0.04 : 0.07);
        kick(s.tr, t, 0.28);
        kick(s.tr, t + s.beat * 2, 0.22);
        if (b % 4 === 2) pluck(s.tr, t + s.beat * 2, chord[3] + 12, 0.5, 0.06, 0, 'sine');
      }
    },
  },
  {
    file: 'gioco-ultima-spiaggia',
    bpm: 112,
    title: 'Ultima spiaggia — Tensione',
    compose(s) {
      const chords = [[45, 48, 52, 55], [43, 46, 50, 53], [41, 45, 48, 52], [40, 43, 47, 50]];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        // Ostinato in ottavi, ticchettio, fiati corti in levare. Il sub
        // resta a 55 Hz: a 27 Hz non si sente sui diffusori della TV e alza
        // solo l'RMS, lasciando il brano più denso degli altri a parità di LUFS.
        for (let i = 0; i < 8; i += 1) {
          subBass(s.tr, t + s.beat * i * 0.5, chord[0] - 12, 0.22, 0.12);
          if (i % 2 === 0) bass(s.tr, t + s.beat * i * 0.5, chord[0] + 12, 0.16, 0.06);
          hat(s.tr, t + s.beat * i * 0.5, 0.03);
        }
        kick(s.tr, t, 0.32);
        snare(s.tr, t + s.beat * 2, 0.1);
        brass(s.tr, t + s.beat * 1.5, chord.slice(1), 0.35, 0.05);
        brass(s.tr, t + s.beat * 3.5, chord.slice(1, 3), 0.3, 0.04);
        strings(s.tr, t, chord, s.bar * 1.05, 0.03, 2000);
      }
    },
  },
  {
    file: 'gioco-azzardo',
    bpm: 112,
    title: 'Azzardo — Lounge da tavolo',
    compose(s) {
      const chords = [[48, 51, 55, 58], [41, 45, 48, 51], [46, 50, 53, 57], [39, 43, 46, 50]];
      const roots = [36, 29, 34, 27];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        const root = roots[b % 4];
        for (const offset of [0, 1, 2, 3]) {
          ride(s.tr, t + s.beat * offset, 0.055);
          ride(s.tr, t + s.beat * (offset + 0.66), 0.035);
        }
        brush(s.tr, t + s.beat, 0.07);
        brush(s.tr, t + s.beat * 3, 0.07);
        kick(s.tr, t, 0.2);
        // Walking bass.
        for (const [offset, note] of [[0, root], [1, root + 4], [2, root + 7], [3, root + 11]]) {
          bass(s.tr, t + s.beat * offset, note, 0.62, 0.16);
        }
        keys(s.tr, t + s.beat * 0.66, chord, 0.16, 0.05, 0.2);
        keys(s.tr, t + s.beat * 2.66, chord, 0.14, 0.045, -0.2);
        if (b % 2 === 1) lead(s.tr, t + s.beat * 2.5, chord[2] + 12, 0.6, 0.05, 0.25);
      }
    },
  },
  {
    file: 'gioco-blackjack',
    bpm: 80,
    title: 'Blackjack — Jazz lento',
    compose(s) {
      const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]];
      const roots = [36, 33, 38, 31];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        const root = roots[b % 4];
        for (const offset of [0, 1, 2, 3]) {
          ride(s.tr, t + s.beat * offset, 0.05);
          ride(s.tr, t + s.beat * (offset + 0.66), 0.03);
        }
        brush(s.tr, t + s.beat, 0.06);
        brush(s.tr, t + s.beat * 3, 0.06);
        for (const [offset, note] of [[0, root], [1, root + 7], [2, root + 4], [3, root + 11]]) {
          bass(s.tr, t + s.beat * offset, note, 0.75, 0.15);
        }
        keys(s.tr, t + s.beat * 1.66, chord, 0.5, 0.045, 0.15);
        keys(s.tr, t + s.beat * 3.66, chord, 0.4, 0.04, -0.15);
        pad(s.tr, t, chord, s.bar * 1.05, 0.02, 800);
      }
    },
  },
  {
    file: 'gioco-casino-finale',
    bpm: 80,
    title: 'Casino — Finale',
    compose(s) {
      const chords = [[45, 48, 52, 55], [43, 46, 50, 53], [41, 44, 48, 51], [43, 46, 50, 53]];
      for (let b = 0; b < s.bars; b += 1) {
        const t = b * s.bar;
        const chord = chords[b % 4];
        // Archi lunghi, timpani, ottoni che salgono verso la battuta 4.
        strings(s.tr, t, chord, s.bar * 1.05, 0.045, 2000);
        addVoice(s.tr, {
          start: t, freq: midi(chord[0] - 24), dur: s.bar * 1.02, gain: 0.07, wave: 'saw',
          attack: 0.15, decay: 0.3, sustain: 0.85, release: 0.3, cutoff: 220,
        });
        if (b % 2 === 0) {
          tom(s.tr, t, 36, 0.3);
          tom(s.tr, t + s.beat * 2.5, 43, 0.16);
        }
        if (b % 4 === 3) {
          strings(s.tr, t + s.beat * 2, chord, s.beat * 1.6, 0.05, 2800);
          tom(s.tr, t + s.beat * 3, 36, 0.26);
        }
        if (b % 4 === 2) brass(s.tr, t + s.beat * 2, chord.slice(1), 0.7, 0.05);
        for (let i = 0; i < 4; i += 1) hat(s.tr, t + s.beat * i, 0.03);
      }
    },
  },
];

/**
 * Il punto di taglio del giro. Il materiale è periodico a 60 s, quindi basta
 * ruotare il buffer: il confine cade su una battuta dove l'onda passa vicino
 * allo zero, e il controllo del salto (un campione) resta basso. Senza questa
 * scelta il taglio può cadere su una cresta e il file viene scartato anche se
 * il giro è continuo.
 */
function loopPhase(left, right, barSeconds, periodFrames) {
  const barFrames = Math.round(barSeconds * SR);
  const reach = Math.round(0.02 * SR);
  let best = 0;
  let bestScore = Infinity;
  for (let bar = 0; bar < Math.floor(periodFrames / barFrames); bar += 1) {
    const center = bar * barFrames;
    for (let i = Math.max(1, center - reach); i <= Math.min(periodFrames - 1, center + reach); i += 1) {
      const slope = Math.max(
        Math.abs(left[i] - left[i - 1]),
        Math.abs(right[i] - right[i - 1]),
      );
      const energy = (Math.abs(left[i]) + Math.abs(right[i])) * 0.5;
      const score = slope + energy;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
  }
  return best;
}

/** Wav PCM 16 bit stereo: il formato che la pipeline legge senza sorprese. */
function writeWav(file, left, right) {
  const frames = left.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buffer);
  return buffer.length;
}

const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const selected = only ? TRACKS.filter((track) => track.file === only) : TRACKS;
if (selected.length === 0) {
  console.error(`\n✗ Nessun loop si chiama "${only}".\n`);
  process.exit(1);
}

mkdirSync(OUT_ROOT, { recursive: true });

for (const [index, track] of selected.entries()) {
  const frames = Math.ceil(RAW_SECONDS * SR);
  const scratch = {
    L: new Float32Array(frames),
    R: new Float32Array(frames),
    rand: seeded(0x51 + index * 977),
  };
  const beat = 60 / track.bpm;
  const bar = beat * 4;
  track.compose({
    tr: scratch,
    beat,
    bar,
    bars: Math.floor(RAW_SECONDS / bar),
    at: (barIndex, beats = 0) => barIndex * bar + beats * beat,
  });

  // Ruota il giro sul punto migliore: il grezzo diventa periodico a 60 s.
  const period = Math.round(60 * SR);
  const phase = loopPhase(scratch.L, scratch.R, bar, period);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    const source = (phase + i) % period;
    left[i] = scratch.L[source];
    right[i] = scratch.R[source];
  }

  // Il codificatore AAC ritarda di una ventina di ms: senza uno smorzo il
  // confine del giro misura la fase dell'onda invece del silenzio. Venti ms
  // per lato, a −23 LUFS, non si sentono.
  const dip = Math.round(0.02 * SR);
  for (let i = 0; i < dip; i += 1) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / dip);
    left[i] *= gain;
    right[i] *= gain;
    const tail = period - 1 - i;
    left[tail] *= gain;
    right[tail] *= gain;
  }

  // Picco a −4 dBFS: la normalizzazione a −23 LUFS la fa la pipeline.
  let peak = 0;
  for (let i = 0; i < frames; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const scale = peak > 0 ? 0.63 / peak : 1;
  for (let i = 0; i < frames; i += 1) {
    left[i] *= scale;
    right[i] *= scale;
  }

  const file = join(OUT_ROOT, `${track.file}.wav`);
  const bytes = writeWav(file, left, right);
  console.log(`• ${track.file}.wav — ${track.bpm} BPM, ${RAW_SECONDS} s, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

console.log(`\n${selected.length} grezzi in apps/frontend/public/assets/audio/_src/loop/.`);
console.log('Ora: node scripts/audio/process-audio.mjs');
