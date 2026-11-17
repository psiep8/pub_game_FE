/**
 * Catalogo delle otto piste delle Biglie e piano dei round.
 *
 * Le quattro piste storiche (terra, asfalto, neve, acqua) restano; le quattro
 * nuove aggiungono una fisica propria, non solo un colore:
 * - ghiaccio: attrito quasi nullo, la biglia scivola e frena poco;
 * - sabbia: attrito alto e dossi che fanno sobbalzare;
 * - spazio: gravità ridotta, salti lunghi e atterraggi delicati;
 * - magma: calore ai bordi e getti che spingono verso l'alto.
 *
 * `planRoundTracks` distribuisce le otto piste sui quattro round delle
 * Biglie: due per round, tutte diverse, con l'ordine deciso dal seme della
 * serata. Il piano è deterministico: lo stesso seme ricostruisce gli stessi
 * accoppiamenti dopo un refresh. Il componente salva seme e piano nel
 * checkpoint, così la TV che rientra rigioca le stesse due piste.
 */

import { SCHEDULE } from '../../../shared/schedule';

export type TrackId =
  | 'rally'
  | 'f1'
  | 'neve'
  | 'acqua'
  | 'ghiaccio'
  | 'sabbia'
  | 'spazio'
  | 'magma';

export interface SurfacePhysics {
  /** Moltiplicatore dell'attrito: 0 = ghiaccio, 1.6 = sabbia. */
  friction: number;
  /** Moltiplicatore della gravità: 0.45 nello spazio, 1 altrove. */
  gravity: number;
  /** Rimbalzo sui muri: il ghiaccio restituisce più energia. */
  bounce: number;
  /** Aderenza in curva: più bassa sul ghiaccio, più alta sulla sabbia. */
  grip: number;
  /** Forza dei dossi/increspature: 0 dove il fondo è liscio. */
  bumps: number;
}

export interface BiglieTrack {
  id: TrackId;
  name: string;
  surface: string;
  emoji: string;
  tint: string;
  /** Pesi della scelta biglia: velocità, accelerazione, tenuta. */
  weights: { speed: number; accel: number; grip: number };
  physics: SurfacePhysics;
}

export const TRACK_CATALOG: readonly BiglieTrack[] = [
  {
    id: 'rally',
    name: 'RALLY',
    surface: 'TERRA',
    emoji: '🏁',
    tint: '#b45309',
    weights: { speed: 0.2, accel: 0.6, grip: 0.2 },
    physics: { friction: 0.55, gravity: 1, bounce: 0.42, grip: 0.85, bumps: 0.5 },
  },
  {
    id: 'f1',
    name: 'F1',
    surface: 'ASFALTO',
    emoji: '🏎️',
    tint: '#334155',
    weights: { speed: 0.8, accel: 0.15, grip: 0.05 },
    physics: { friction: 0.25, gravity: 1, bounce: 0.5, grip: 1, bumps: 0.05 },
  },
  {
    id: 'neve',
    name: 'NEVE',
    surface: 'NEVE',
    emoji: '❄️',
    tint: '#0ea5e9',
    weights: { speed: 0.1, accel: 0.25, grip: 0.65 },
    physics: { friction: 0.35, gravity: 1, bounce: 0.4, grip: 0.6, bumps: 0.2 },
  },
  {
    id: 'acqua',
    name: 'ACQUA',
    surface: 'ACQUA',
    emoji: '🌊',
    tint: '#0369a1',
    weights: { speed: 0.3, accel: 0.55, grip: 0.15 },
    physics: { friction: 0.45, gravity: 1, bounce: 0.35, grip: 0.75, bumps: 0.7 },
  },
  {
    id: 'ghiaccio',
    name: 'GHIACCIO',
    surface: 'GHIACCIO',
    emoji: '🧊',
    tint: '#67e8f9',
    weights: { speed: 0.55, accel: 0.15, grip: 0.3 },
    physics: { friction: 0.04, gravity: 1, bounce: 0.58, grip: 0.25, bumps: 0.05 },
  },
  {
    id: 'sabbia',
    name: 'SABBIA',
    surface: 'DESERTO',
    emoji: '🏜️',
    tint: '#d97706',
    weights: { speed: 0.15, accel: 0.7, grip: 0.15 },
    physics: { friction: 1.6, gravity: 1, bounce: 0.28, grip: 1.15, bumps: 0.9 },
  },
  {
    id: 'spazio',
    name: 'SPAZIO',
    surface: 'ORBITA',
    emoji: '🚀',
    tint: '#a78bfa',
    weights: { speed: 0.45, accel: 0.2, grip: 0.35 },
    physics: { friction: 0.18, gravity: 0.45, bounce: 0.62, grip: 0.45, bumps: 0.3 },
  },
  {
    id: 'magma',
    name: 'MAGMA',
    surface: 'FUCINA',
    emoji: '🌋',
    tint: '#dc2626',
    weights: { speed: 0.35, accel: 0.45, grip: 0.2 },
    physics: { friction: 0.6, gravity: 1.1, bounce: 0.45, grip: 0.8, bumps: 0.6 },
  },
];

export const TRACK_IDS: readonly TrackId[] = TRACK_CATALOG.map((track) => track.id);

/** Quante piste (e quante gare) per ogni round Biglie. */
export const TRACKS_PER_ROUND = 2;
/** Quanti round Biglie ci sono in serata: uno per atto dal secondo al quinto. */
export const BIGLIE_ROUNDS = 4;
/** Le gare della serata: due per round, numerate da 1 a 8. */
export const BIGLIE_RACES = TRACKS_PER_ROUND * BIGLIE_ROUNDS;

/** Generatore deterministico identico a quello del componente. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/**
 * Le due piste di un round: mescola le otto col seme della serata e prende la
 * coppia del round. Con lo stesso seme i quattro round coprono tutte e otto
 * le piste, due alla volta, senza ripetizioni.
 */
export function planRoundTracks(seed: number, roundIndex: number): TrackId[] {
  const deck = [...TRACK_IDS];
  const rng = seededRandom(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const start = Math.max(0, Math.min(BIGLIE_ROUNDS - 1, Math.floor(roundIndex))) * TRACKS_PER_ROUND;
  return deck.slice(start, start + TRACKS_PER_ROUND);
}

export function trackById(id: TrackId): BiglieTrack {
  return TRACK_CATALOG.find((track) => track.id === id) ?? TRACK_CATALOG[0];
}

/**
 * Slot del round Biglie (0–3) a partire dal round di serata (0-based).
 * Le quattro Biglie escono ai round 11, 22, 28 e 37: il seme sceglie la coppia
 * dello slot, non del numero di round, così il piano resta di quattro coppie.
 */
export function biglieRoundSlot(roundIndex: number): number {
  const index = Math.max(0, Math.floor(Number(roundIndex) || 0));
  const slot = SCHEDULE.slice(0, index).filter((mode) => mode === 'BIGLIE').length;
  return Math.min(BIGLIE_ROUNDS - 1, slot);
}

/** Numero della gara nella serata (1-based): 1–2, 3–4, 5–6, 7–8. */
export function biglieRaceNumber(roundIndex: number, raceIndex: number): number {
  const race = Math.max(0, Math.floor(Number(raceIndex) || 0));
  return biglieRoundSlot(roundIndex) * TRACKS_PER_ROUND + race + 1;
}
