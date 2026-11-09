/**
 * Tappeto musicale della serata: giro ii-V-I-vi in Do maggiore a 64 BPM.
 *
 * Non è un file da caricare: le note vengono generate a ogni battuta, quindi
 * il loop non ha cuciture e il ciclo lungo (venti minuti) cambia strumenti
 * senza mai ripartire da zero. I guadagni restano sotto quelli degli effetti,
 * così la voce del presentatore e i suoni di gioco restano davanti.
 */
export const PUB_BED_BPM = 64;
export const PUB_BED_BEATS_PER_BAR = 4;
export const PUB_BED_SECONDS_PER_BEAT = 60 / PUB_BED_BPM;
export const PUB_BED_SECONDS_PER_BAR = PUB_BED_SECONDS_PER_BEAT * PUB_BED_BEATS_PER_BAR;

/** Una sezione sono 32 battute (due minuti): cambia l'arrangiamento. */
export const PUB_BED_BARS_PER_SECTION = 32;
export const PUB_BED_SECTIONS = 10;
export const PUB_BED_TOTAL_BARS = PUB_BED_BARS_PER_SECTION * PUB_BED_SECTIONS;
/** 320 battute a 64 BPM: venti minuti esatti prima di ricominciare. */
export const PUB_BED_CYCLE_SECONDS = PUB_BED_TOTAL_BARS * PUB_BED_SECONDS_PER_BAR;

export interface PubBedNote {
  /** Battito della battuta, da 0 a 4. */
  beat: number;
  midi: number;
  /** Durata in secondi. */
  duration: number;
  gain: number;
  type: OscillatorType;
  attack?: number;
  detune?: number;
}

export interface PubBedBar {
  chord: string;
  notes: PubBedNote[];
  /** Battiti con la spazzola sul rullante. */
  brushes: number[];
  /** Tintinnio di bicchieri, ogni tanto. */
  clink: boolean;
}

interface Chord {
  name: string;
  bassMidi: number;
  pad: number[];
}

/** Due battute per accordo: otto battute per l'intero giro. */
const CHORDS: Chord[] = [
  { name: 'Cmaj7', bassMidi: 48, pad: [60, 64, 67, 71] },
  { name: 'Am7', bassMidi: 45, pad: [57, 60, 64, 67] },
  { name: 'Dm7', bassMidi: 50, pad: [62, 65, 69, 72] },
  { name: 'G7', bassMidi: 43, pad: [55, 59, 62, 65] },
];

/** Pentatonica di Do: qualunque nota cada bene sul giro. */
const MELODY = [72, 74, 76, 79, 81];

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function pubBedSection(bar: number): number {
  return Math.floor(bar / PUB_BED_BARS_PER_SECTION) % PUB_BED_SECTIONS;
}

export function pubBedChord(bar: number): Chord {
  return CHORDS[Math.floor((bar % 8) / 2)];
}

/**
 * Battuta completa: accordo, basso, melodia e spazzole. Tutto deterministico:
 * la stessa battuta suona uguale a ogni giro, ma il ciclo è lungo abbastanza
 * da non far percepire il ritorno.
 */
export function pubBedBar(bar: number): PubBedBar {
  const chord = pubBedChord(bar);
  const section = pubBedSection(bar);
  const barSeconds = PUB_BED_SECONDS_PER_BAR;

  const notes: PubBedNote[] = chord.pad.map((midi, index) => ({
    beat: 0,
    midi,
    duration: barSeconds * 0.98,
    gain: 0.005,
    type: 'triangle',
    attack: 0.7,
    detune: index % 2 === 0 ? -4 : 4,
  }));

  notes.push(
    { beat: 0, midi: chord.bassMidi, duration: 1.15, gain: 0.011, type: 'sine', attack: 0.02 },
    { beat: 2.5, midi: chord.bassMidi, duration: 0.9, gain: 0.009, type: 'sine', attack: 0.02 },
  );

  // La melodia entra dopo sei minuti e non suona a ogni battuta.
  if (section >= 3 && bar % 4 !== 3) {
    notes.push({
      beat: 2.5,
      midi: MELODY[(bar * 3) % MELODY.length],
      duration: 1.5,
      gain: 0.004,
      type: 'sine',
      attack: 0.08,
    });
  }

  // Dalla seconda sezione in poi: spazzole leggere sul due e sul quattro.
  const brushes = section >= 1 ? [1, 3] : [];

  // Dalla settima sezione un tocco acuto, come un bicchiere sfiorato.
  if (section >= 6 && bar % 4 === 2) {
    notes.push({
      beat: 3.25,
      midi: chord.pad[chord.pad.length - 1] + 24,
      duration: 1.8,
      gain: 0.0025,
      type: 'sine',
      attack: 0.05,
    });
  }

  return {
    chord: chord.name,
    notes,
    brushes,
    clink: bar % 23 === 7,
  };
}
