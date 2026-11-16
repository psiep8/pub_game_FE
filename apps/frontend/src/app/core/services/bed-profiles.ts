/**
 * Tappeti musicali della serata: uno per gioco, generati a ogni battuta.
 *
 * <p>Nessun file audio: ogni tappeto è un piccolo trio con il suo tempo, il suo
 * giro e i suoi strumenti. Cambiando gioco cambia l'aria in sala — il quiz ha
 * il marimba, la Bomba il basso che pulsa, il Casino lo shuffle con le carte —
 * senza mai staccare la musica fra un round e l'altro.</p>
 *
 * <p>Il generatore è deterministico: la battuta numero N di un tappeto suona
 * sempre uguale, quindi il ciclo si può provare in regia e ritrovare uguale
 * in sala.</p>
 */

export type BedVoice =
  | 'bass'
  | 'epiano'
  | 'vibes'
  | 'glass'
  | 'brush'
  | 'rim'
  | 'marimba'
  | 'shaker'
  | 'pad'
  | 'wood';

export interface BedChord {
  name: string;
  /** Fondamentale del basso, in MIDI. */
  bassMidi: number;
  /** Voicing del pianoforte. */
  keys: number[];
  /** Nona o settima che dà colore. */
  color: number;
}

export interface BedNote {
  /** Battito nella battuta, da 0 a 4 (i levari swing stanno dopo la metà). */
  beat: number;
  midi: number;
  duration: number;
  gain: number;
  voice: BedVoice;
  pan?: number;
}

export interface BedBar {
  chord: string;
  notes: BedNote[];
}

/** Come suona il basso: camminata jazz, pulsazione, ottave, bordone. */
export type BedBass = 'walk' | 'pulse' | 'octave' | 'drone';
/** Come suona il pianoforte: accordi in levare, tappeto lungo, arpeggio. */
export type BedKeys = 'stabs' | 'pad' | 'arpeggio' | 'none';
/** Percussione: spazzole, shaker, cerchio, legno, orologio. */
export type BedPerc = 'none' | 'brushes' | 'shaker' | 'rim' | 'wood' | 'tick';
/** Voce melodica che compare dopo un po'. */
export type BedColour = 'none' | 'vibes' | 'marimba' | 'glass' | 'bell' | 'epiano';

export interface BedProfile {
  id: string;
  label: string;
  bpm: number;
  /** Gli ottavi in levare arrivano dopo il battito: è lo swing. */
  swing: number;
  chords: BedChord[];
  melody: number[];
  bass: BedBass;
  keys: BedKeys;
  perc: BedPerc;
  colour: BedColour;
}

/** Una sezione sono 32 battute: dopo due minuti entra qualcosa di nuovo. */
export const BED_BARS_PER_SECTION = 32;
export const BED_SECTIONS = 10;

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function bedSecondsPerBeat(profile: BedProfile): number {
  return 60 / profile.bpm;
}

export function bedSecondsPerBar(profile: BedProfile): number {
  return bedSecondsPerBeat(profile) * 4;
}

/** Quante battute dura un giro completo di accordi (due battute per accordo). */
export function bedLoopBars(profile: BedProfile): number {
  return profile.chords.length * 2;
}

export function bedSection(bar: number): number {
  return Math.floor(bar / BED_BARS_PER_SECTION) % BED_SECTIONS;
}

export function bedChord(profile: BedProfile, bar: number): BedChord {
  const index = Math.floor((bar % bedLoopBars(profile)) / 2) % profile.chords.length;
  return profile.chords[index];
}

const chord = (name: string, bassMidi: number, keys: number[], color: number): BedChord => ({
  name,
  bassMidi,
  keys,
  color,
});

/**
 * Un tappeto per gioco. Tempi e giri sono scelti per il carattere del gioco:
 * il quiz corre, la Bomba stringe, il Casino dondola, le Biglie rotolano.
 */
export const BED_PROFILES: Record<string, BedProfile> = {
  lobby: {
    id: 'lobby',
    label: 'Lobby — trio da pub',
    bpm: 64,
    swing: 0.08,
    chords: [
      chord('Cmaj7', 36, [55, 59, 64, 71], 71),
      chord('Am7', 33, [52, 55, 60, 67], 67),
      chord('Dm7', 38, [57, 60, 65, 72], 72),
      chord('G7', 31, [55, 59, 62, 65], 65),
    ],
    melody: [79, 76, 77, 74],
    bass: 'walk',
    keys: 'stabs',
    perc: 'brushes',
    colour: 'vibes',
  },
  quiz: {
    id: 'quiz',
    label: 'Quiz — marimba e ottoni leggeri',
    bpm: 96,
    swing: 0,
    chords: [
      chord('Dmaj7', 38, [57, 62, 66, 73], 73),
      chord('Bm7', 35, [54, 57, 62, 69], 69),
      chord('Em7', 40, [59, 62, 67, 74], 74),
      chord('A7', 33, [57, 61, 64, 67], 67),
    ],
    melody: [81, 78, 79, 76],
    bass: 'walk',
    keys: 'stabs',
    perc: 'shaker',
    colour: 'marimba',
  },
  imageBlur: {
    id: 'imageBlur',
    label: 'Immagine sfocata — vetro e bruma',
    bpm: 72,
    swing: 0,
    chords: [
      chord('Am7', 33, [52, 55, 60, 67], 67),
      chord('Fmaj7', 29, [48, 53, 57, 64], 64),
      chord('Dm7', 38, [53, 57, 60, 65], 65),
      chord('E7', 28, [52, 56, 59, 62], 62),
    ],
    melody: [76, 74, 72, 71],
    bass: 'drone',
    keys: 'pad',
    perc: 'none',
    colour: 'glass',
  },
  music: {
    id: 'music',
    label: 'Canzone — pianoforte caldo',
    bpm: 76,
    swing: 0.04,
    chords: [
      chord('Fmaj7', 29, [53, 57, 60, 64], 67),
      chord('Dm7', 38, [53, 57, 60, 65], 65),
      chord('Gm7', 31, [55, 58, 62, 69], 69),
      chord('C7', 36, [52, 55, 58, 64], 64),
    ],
    melody: [77, 81, 79, 76],
    bass: 'walk',
    keys: 'arpeggio',
    perc: 'brushes',
    colour: 'epiano',
  },
  timeline: {
    id: 'timeline',
    label: 'Timeline — orologio e bordone',
    bpm: 88,
    swing: 0,
    chords: [
      chord('Gm7', 31, [55, 58, 62, 65], 69),
      chord('C7', 36, [55, 60, 64, 70], 70),
      chord('Gm7', 31, [55, 58, 62, 65], 69),
      chord('Dm7', 38, [57, 60, 65, 72], 72),
    ],
    melody: [74, 77, 79, 82],
    bass: 'drone',
    keys: 'none',
    perc: 'tick',
    colour: 'bell',
  },
  wheel: {
    id: 'wheel',
    label: 'Ruota — shuffle da studio',
    bpm: 84,
    swing: 0.1,
    chords: [
      chord('Bbmaj7', 34, [53, 57, 62, 69], 69),
      chord('Gm7', 31, [53, 58, 62, 65], 65),
      chord('Cm7', 36, [55, 58, 63, 70], 70),
      chord('F7', 29, [52, 57, 60, 63], 63),
    ],
    melody: [74, 77, 81, 79],
    bass: 'walk',
    keys: 'stabs',
    perc: 'rim',
    colour: 'vibes',
  },
  timeBuzzer: {
    id: 'timeBuzzer',
    label: 'Time Buzzer — cronometro',
    bpm: 104,
    swing: 0,
    chords: [
      chord('Emaj7', 40, [59, 63, 68, 75], 75),
      chord('C#m7', 37, [56, 59, 64, 71], 71),
      chord('F#m7', 30, [54, 57, 61, 66], 66),
      chord('B7', 35, [59, 63, 66, 69], 69),
    ],
    melody: [83, 80, 81, 78],
    bass: 'pulse',
    keys: 'stabs',
    perc: 'wood',
    colour: 'marimba',
  },
  bomba: {
    id: 'bomba',
    label: 'Bomba — pulsazione che stringe',
    bpm: 112,
    swing: 0,
    chords: [
      chord('Cm7', 36, [55, 58, 63, 70], 70),
      chord('Abmaj7', 32, [51, 55, 60, 67], 67),
      chord('Fm7', 29, [53, 56, 60, 65], 65),
      chord('G7', 31, [55, 59, 62, 65], 65),
    ],
    melody: [70, 73, 75, 68],
    bass: 'pulse',
    keys: 'pad',
    perc: 'rim',
    colour: 'none',
  },
  speed: {
    id: 'speed',
    label: 'Speed Rush — ottave in corsa',
    bpm: 132,
    swing: 0,
    chords: [
      chord('Am7', 33, [57, 60, 64, 67], 67),
      chord('Am7', 33, [57, 60, 64, 67], 67),
      chord('Fmaj7', 29, [57, 60, 64, 69], 69),
      chord('G7', 31, [59, 62, 65, 71], 71),
    ],
    melody: [81, 79, 77, 76],
    bass: 'octave',
    keys: 'arpeggio',
    perc: 'shaker',
    colour: 'marimba',
  },
  tennis: {
    id: 'tennis',
    label: 'Tennis — rimbalzi',
    bpm: 108,
    swing: 0,
    chords: [
      chord('Gmaj7', 31, [55, 59, 62, 66], 69),
      chord('Em7', 28, [52, 55, 59, 66], 66),
      chord('Am7', 33, [57, 60, 64, 69], 69),
      chord('D7', 26, [54, 57, 60, 66], 66),
    ],
    melody: [78, 76, 74, 79],
    bass: 'pulse',
    keys: 'stabs',
    perc: 'wood',
    colour: 'marimba',
  },
  arena: {
    id: 'arena',
    label: 'Arena — suspense',
    bpm: 100,
    swing: 0,
    chords: [
      chord('Dm7', 38, [57, 60, 65, 72], 72),
      chord('Bbmaj7', 34, [53, 58, 62, 65], 69),
      chord('Gm7', 31, [55, 58, 62, 67], 67),
      chord('A7', 33, [57, 61, 64, 67], 71),
    ],
    melody: [74, 77, 72, 69],
    bass: 'pulse',
    keys: 'pad',
    perc: 'tick',
    colour: 'bell',
  },
  spiaggia: {
    id: 'spiaggia',
    label: 'Ultima Spiaggia — tropicale',
    bpm: 112,
    swing: 0,
    chords: [
      chord('Emaj7', 40, [59, 63, 68, 75], 75),
      chord('C#m7', 37, [56, 59, 64, 71], 71),
      chord('Amaj7', 33, [57, 61, 64, 69], 68),
      chord('B7', 35, [59, 63, 66, 69], 73),
    ],
    melody: [80, 83, 78, 85],
    bass: 'octave',
    keys: 'arpeggio',
    perc: 'shaker',
    colour: 'marimba',
  },
  azzardo: {
    id: 'azzardo',
    label: 'Azzardo — roulette e gettoni',
    bpm: 92,
    swing: 0.12,
    chords: [
      chord('Bbmaj7', 34, [53, 57, 62, 69], 69),
      chord('Gm7', 31, [53, 58, 62, 65], 65),
      chord('Cm7', 36, [55, 58, 63, 70], 70),
      chord('F7', 29, [57, 60, 65, 69], 63),
    ],
    melody: [77, 79, 74, 81],
    bass: 'walk',
    keys: 'stabs',
    perc: 'rim',
    colour: 'glass',
  },
  blackjack: {
    id: 'blackjack',
    label: 'Blackjack — tavolo tranquillo',
    bpm: 80,
    swing: 0.1,
    chords: [
      chord('Ebmaj7', 39, [58, 62, 67, 74], 74),
      chord('Cm7', 36, [55, 58, 63, 70], 70),
      chord('Fm7', 29, [53, 56, 60, 67], 67),
      chord('Bb7', 34, [58, 62, 65, 68], 68),
    ],
    melody: [75, 74, 70, 72],
    bass: 'walk',
    keys: 'stabs',
    perc: 'brushes',
    colour: 'vibes',
  },
  biglie: {
    id: 'biglie',
    label: 'Biglie — arpeggi che rotolano',
    bpm: 124,
    swing: 0,
    chords: [
      chord('Amaj7', 33, [57, 61, 64, 68], 73),
      chord('F#m7', 30, [54, 57, 61, 64], 68),
      chord('Dmaj7', 38, [57, 62, 66, 69], 73),
      chord('E7', 28, [56, 59, 62, 68], 68),
    ],
    melody: [85, 81, 78, 76],
    bass: 'octave',
    keys: 'arpeggio',
    perc: 'shaker',
    colour: 'marimba',
  },
  cavallo: {
    id: 'cavallo',
    label: 'Cavallo — galoppo',
    bpm: 116,
    swing: 0,
    chords: [
      chord('Gmaj7', 31, [55, 59, 62, 67], 69),
      chord('Cmaj7', 36, [55, 60, 64, 71], 71),
      chord('D7', 38, [57, 60, 66, 69], 66),
      chord('D7', 38, [57, 60, 62, 66], 62),
    ],
    melody: [79, 74, 76, 81],
    bass: 'octave',
    keys: 'stabs',
    perc: 'wood',
    colour: 'marimba',
  },
};

/** Nome del tappeto da usare per un gioco, un bonus o la lobby. */
export function bedForGame(type?: string | null): BedProfile {
  const key = String(type ?? '').trim();
  if (!key) return BED_PROFILES['lobby'];
  if (BED_PROFILES[key]) return BED_PROFILES[key];
  const map: Record<string, string> = {
    QUIZ: 'quiz',
    MUSIC: 'music',
    IMAGE_BLUR: 'imageBlur',
    TIMELINE: 'timeline',
    WHEEL_OF_FORTUNE: 'wheel',
    TIME_BUZZER: 'timeBuzzer',
    BOMBA: 'bomba',
    SPEED_RUSH: 'speed',
    TENNIS_BATTLE: 'tennis',
    ARENA: 'arena',
    ULTIMA_SPIAGGIA: 'spiaggia',
    AZZARDO: 'azzardo',
    BLACKJACK: 'blackjack',
    BIGLIE: 'biglie',
    CASINO_COLOR: 'azzardo',
    CASINO_DOZEN: 'azzardo',
    CASINO_NUMBER: 'azzardo',
    CAVALLO: 'cavallo',
  };
  return BED_PROFILES[map[key] ?? 'lobby'];
}

/**
 * Battuta del tappeto. Ritorni note con tempi e strumenti già decisi: chi
 * suona non deve sapere quale gioco è in corso.
 */
export function bedBar(profile: BedProfile, bar: number): BedBar {
  const chord = bedChord(profile, bar);
  const section = bedSection(bar);
  const barSeconds = bedSecondsPerBar(profile);
  const swing = profile.swing;
  const notes: BedNote[] = [];

  // Basso.
  if (profile.bass === 'walk') {
    const steps = [chord.bassMidi, chord.bassMidi + 7, chord.bassMidi + 10, chord.bassMidi + 5];
    notes.push(
      { beat: 0, midi: steps[0], duration: 1.1, gain: 0.011, voice: 'bass' },
      { beat: 1.5, midi: steps[1], duration: 0.7, gain: 0.009, voice: 'bass' },
      { beat: 2, midi: steps[2], duration: 0.9, gain: 0.0095, voice: 'bass' },
      { beat: 3.5, midi: steps[3], duration: 0.6, gain: 0.008, voice: 'bass' },
    );
  } else if (profile.bass === 'pulse') {
    for (let beat = 0; beat < 4; beat += 0.5) {
      notes.push({
        beat,
        midi: beat % 1 === 0 ? chord.bassMidi : chord.bassMidi + 7,
        duration: 0.42,
        gain: beat % 1 === 0 ? 0.011 : 0.007,
        voice: 'bass',
      });
    }
  } else if (profile.bass === 'octave') {
    for (let beat = 0; beat < 4; beat += 0.5) {
      notes.push({
        beat,
        midi: beat % 1 === 0 ? chord.bassMidi : chord.bassMidi + 12,
        duration: 0.4,
        gain: beat % 1 === 0 ? 0.011 : 0.0075,
        voice: 'bass',
      });
    }
  } else {
    notes.push(
      { beat: 0, midi: chord.bassMidi, duration: barSeconds * 0.96, gain: 0.01, voice: 'bass' },
      { beat: 2, midi: chord.bassMidi + 7, duration: barSeconds * 0.46, gain: 0.007, voice: 'bass' },
    );
  }

  // Pianoforte.
  if (profile.keys === 'stabs') {
    chord.keys.forEach((midi, index) => {
      notes.push({
        beat: 1.5 + swing,
        midi,
        duration: barSeconds * 0.3,
        gain: index === 0 ? 0.006 : 0.0045,
        voice: 'epiano',
        pan: (index - 1.5) * 0.18,
      });
    });
    notes.push({
      beat: 3.5 + swing,
      midi: chord.color,
      duration: barSeconds * 0.2,
      gain: 0.0045,
      voice: 'epiano',
      pan: 0.25,
    });
  } else if (profile.keys === 'pad') {
    chord.keys.forEach((midi, index) => {
      notes.push({
        beat: 0,
        midi,
        duration: barSeconds * 0.98,
        gain: 0.0042,
        voice: 'pad',
        pan: (index - 1.5) * 0.22,
      });
    });
  } else if (profile.keys === 'arpeggio') {
    const shape = [...chord.keys, chord.keys[0] + 12];
    shape.forEach((midi, index) => {
      notes.push({
        beat: index * 0.5,
        midi,
        duration: 0.42,
        gain: 0.0048,
        voice: 'epiano',
        pan: (index - 1.5) * 0.2,
      });
    });
  }

  // Percussione: una battuta su due, per non essere invadente.
  if (profile.perc === 'shaker' || profile.perc === 'tick') {
    const step = profile.perc === 'shaker' ? 0.5 : 1;
    for (let beat = 0; beat < 4; beat += step) {
      notes.push({
        beat,
        midi: 0,
        duration: 0.06,
        gain: beat % 1 === 0 ? 0.0045 : 0.0028,
        voice: profile.perc === 'shaker' ? 'shaker' : 'wood',
        pan: 0.2,
      });
    }
  } else if (profile.perc === 'rim' || profile.perc === 'wood') {
    for (const beat of [1, 3]) {
      notes.push({
        beat: beat + swing,
        midi: 38,
        duration: 0.1,
        gain: 0.005,
        voice: profile.perc === 'rim' ? 'rim' : 'wood',
        pan: -0.15,
      });
    }
  } else if (profile.perc === 'brushes') {
    for (const beat of [1, 3]) {
      notes.push({
        beat: beat + swing,
        midi: 38,
        duration: 0.11,
        gain: 0.0045,
        voice: 'brush',
        pan: 0.15,
      });
    }
  }

  // Voce melodica: entra dopo il primo minuto, una nota ogni due battute.
  if (profile.colour !== 'none' && section >= 1 && bar % 2 === 0) {
    const melody = profile.melody;
    const midi = melody[Math.floor(bar / 2) % melody.length];
    const voice: BedVoice =
      profile.colour === 'vibes'
        ? 'vibes'
        : profile.colour === 'marimba'
          ? 'marimba'
          : profile.colour === 'glass'
            ? 'glass'
            : profile.colour === 'bell'
              ? 'vibes'
              : 'epiano';
    notes.push({
      beat: 2.5 + swing,
      midi,
      duration: 1.6,
      gain: 0.005,
      voice,
      pan: -0.3,
    });
  }

  return { chord: chord.name, notes };
}
