/**
 * Tappeto musicale della serata: un trio da pub, non un giro di pad.
 *
 * <p>Basso pizzicato che cammina, pianoforte elettrico in levare, spazzole sul
 * rullante e, quando la serata si scalda, vibrafono e bicchieri. Le note sono
 * generate a ogni battuta (nessun file audio), il ciclo dura venti minuti e
 * ogni sezione cambia arrangiamento senza cuciture. I guadagni restano sotto
 * quelli degli effetti: la voce del presentatore sta davanti.</p>
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

/**
 * Strumento della battuta. Il servizio audio sa come farlo suonare: corda
 * pizzicata per il basso, campana FM per il piano elettrico, rumore filtrato
 * per le spazzole, risonatori per vetro e vibrafono.
 */
export type PubBedVoice = 'bass' | 'epiano' | 'vibes' | 'glass' | 'brush' | 'rim';

export interface PubBedNote {
  /** Battito della battuta, da 0 a 4. I levari swing stanno a metà più un pelo. */
  beat: number;
  midi: number;
  /** Durata in secondi. */
  duration: number;
  gain: number;
  voice: PubBedVoice;
  attack?: number;
  /** Posizione stereo, da -1 a 1. */
  pan?: number;
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
  /** Fondamentale del basso, in MIDI. */
  bassMidi: number;
  /** Nona o settima che dà colore al pianoforte. */
  color: number;
  /** Voicing chiuso del piano elettrico. */
  keys: number[];
  /** Nota del vibrafono per la melodia. */
  vibes: number;
}

/** Due battute per accordo: I — VI7 — ii — V, il giro che tiene su la sala. */
const CHORDS: Chord[] = [
  { name: 'Cmaj7', bassMidi: 36, color: 71, keys: [55, 59, 64, 71], vibes: 79 },
  { name: 'Am7', bassMidi: 33, color: 67, keys: [52, 55, 60, 67], vibes: 76 },
  { name: 'Dm7', bassMidi: 38, color: 72, keys: [57, 60, 65, 72], vibes: 77 },
  { name: 'G7', bassMidi: 31, color: 65, keys: [55, 59, 62, 65], vibes: 74 },
];

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function pubBedSection(bar: number): number {
  return Math.floor(bar / PUB_BED_BARS_PER_SECTION) % PUB_BED_SECTIONS;
}

export function pubBedChord(bar: number): Chord {
  return CHORDS[Math.floor((bar % 8) / 2)];
}

/** Le note in levare arrivano dopo il battito: è lo swing, non un errore. */
const SWING = 0.08;

/**
 * Battuta completa: basso che cammina, accordi in levare, spazzole e colore.
 * Tutto deterministico: la stessa battuta suona uguale a ogni giro, ma il
 * ciclo è lungo abbastanza da non far percepire il ritorno.
 */
export function pubBedBar(bar: number): PubBedBar {
  const chord = pubBedChord(bar);
  const section = pubBedSection(bar);
  const barSeconds = PUB_BED_SECONDS_PER_BAR;
  const notes: PubBedNote[] = [];

  // Basso: fondamentale sul battere, quinta o settima sul «due», passeggiata
  // verso l'accordo dopo sul «tre e mezzo».
  const walking = [chord.bassMidi, chord.bassMidi + 7, chord.bassMidi + 10, chord.bassMidi + 5];
  notes.push(
    { beat: 0, midi: walking[0], duration: 1.1, gain: 0.011, voice: 'bass' },
    { beat: 1.5, midi: walking[1], duration: 0.7, gain: 0.009, voice: 'bass' },
    { beat: 2, midi: walking[2], duration: 0.9, gain: 0.0095, voice: 'bass' },
    { beat: 3.5, midi: walking[3], duration: 0.6, gain: 0.008, voice: 'bass' },
  );

  // Piano elettrico: accordo pieno sul «due e mezzo», colore sul «quattro».
  const keysBeat = 1.5 + SWING;
  chord.keys.forEach((midi, index) => {
    notes.push({
      beat: keysBeat,
      midi,
      duration: barSeconds * 0.34,
      gain: index === 0 ? 0.006 : 0.0045,
      voice: 'epiano',
      pan: (index - 1.5) * 0.18,
    });
  });
  notes.push({
    beat: 3.5 + SWING,
    midi: chord.color,
    duration: barSeconds * 0.22,
    gain: 0.0045,
    voice: 'epiano',
    pan: 0.25,
  });

  // Spazzole: dalla seconda sezione in poi, sul due e sul quattro.
  const brushes = section >= 1 ? [1, 3] : [];

  // Il vibrafono entra dopo sei minuti e suona una nota ogni due battute.
  if (section >= 3 && bar % 2 === 0) {
    notes.push({
      beat: 2.5 + SWING,
      midi: chord.vibes,
      duration: 1.9,
      gain: 0.005,
      voice: 'vibes',
      pan: -0.3,
    });
  }

  // Dalla settima sezione il bicchiere sfiorato, come un brindisi lontano.
  if (section >= 6 && bar % 4 === 2) {
    notes.push({
      beat: 3.25,
      midi: chord.keys[chord.keys.length - 1] + 24,
      duration: 1.4,
      gain: 0.0035,
      voice: 'glass',
      pan: 0.45,
    });
  }

  // Il rullante risponde una volta ogni tanto, appena prima del quarto.
  if (section >= 2 && bar % 8 === 5) {
    notes.push({ beat: 3.75, midi: 38, duration: 0.12, gain: 0.005, voice: 'rim', pan: -0.15 });
  }

  return {
    chord: chord.name,
    notes,
    brushes,
    clink: bar % 23 === 7,
  };
}
