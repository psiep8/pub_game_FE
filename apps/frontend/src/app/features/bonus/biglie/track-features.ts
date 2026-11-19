/**
 * Interazioni della pista: attrito, correnti, rampe e perni.
 *
 * <p>I pezzi (`track-geometry.ts`) dicono la forma; qui si dice cosa fa la
 * pista quando la biglia ci passa sopra. Le stesse funzioni le usano la TV
 * (Matter) e la corsa headless, così la pista che si vede è quella che pesa:
 * se una rampa spinge in simulazione, spinge anche in sala.</p>
 *
 * Tutto nasce dal seme e dal profilo del fondo: stessa pista, stesse
 * interazioni, anche dopo un refresh. Nessun `Math.random` qui dentro.
 */

import { frameAtProgress, type TrackGeometry, type TrackPieceKind } from './track-geometry';

export type FeatureKind =
  /** Zona d'attrito: la biglia perde velocità finché ci sta dentro. */
  | 'attrito'
  /** Corrente: spinge di lato verso un muro, sempre dallo stesso lato. */
  | 'corrente'
  /** Rampa: un colpo di velocità e un sobbalzo, una volta per biglia. */
  | 'rampa'
  /** Perni: birilli in mezzo alla corsia, si passa ai lati. */
  | 'perni';

export interface TrackFeature {
  id: string;
  kind: FeatureKind;
  /** Progresso 0–1 del centro dell'interazione. */
  progress: number;
  /** Mezza estensione in progresso: da `progress - span` a `progress + span`. */
  span: number;
  /** Lato della corrente: −1 verso il muro basso, +1 verso quello alto. */
  side: -1 | 1;
  /** Intensità 0–1: le correnti forti piegano, quelle deboli si sentono appena. */
  strength: number;
}

/** Quanto stringe una zona d'attrito: un quinto della velocità, non di più. */
const ATTRITO_SLOW = 0.06;
/** Spinta della corrente, in px per passo di fisica. */
const CORRENTE_PUSH = 0.22;
/** Colpo della rampa: velocità che sale e sobbalzo di lato. */
const RAMPA_BOOST = 1.06;
/** Il perno costa come un ostacolo piccolo. */
export const PERNI_FACTOR = 0.72;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pezzi che portano un'interazione con sé. */
const FEATURE_FOR_PIECE: Partial<Record<TrackPieceKind, FeatureKind>> = {
  rampa: 'rampa',
  perni: 'perni',
  strettoia: 'attrito',
  imbuto: 'attrito',
};

/**
 * Le interazioni di una pista, lette dai suoi pezzi. Le due correnti per gara
 * le mette il seme, su tratti dove non c'è già un ostacolo: non chiudono mai
 * la corsia, spingono e basta.
 */
export function buildFeatures(
  trackId: string,
  seed: number,
  geometry: TrackGeometry,
): TrackFeature[] {
  const features: TrackFeature[] = [];
  const total = Math.max(1, geometry.totalLength);

  for (const piece of geometry.pieces) {
    const kind = FEATURE_FOR_PIECE[piece.kind];
    if (!kind) continue;
    const center = (piece.from + piece.to) / 2;
    features.push({
      id: `feature-${trackId}-${kind}-${Math.round(center)}`,
      kind,
      progress: Math.max(0, Math.min(1, center / total)),
      span: Math.max(0.002, Math.min(0.02, (piece.to - piece.from) / total / 2)),
      side: 1,
      strength: kind === 'attrito' ? 0.7 : 1,
    });
  }

  // Due correnti per gara, in punti diversi da quelli dei pezzi speciali.
  const rng = seededRandom((seed >>> 0) ^ 0x51ed270b);
  for (let index = 0; index < 2; index++) {
    const progress = 0.18 + index * 0.42 + rng() * 0.08;
    features.push({
      id: `feature-${trackId}-corrente-${index}`,
      kind: 'corrente',
      progress: Math.min(0.94, progress),
      span: 0.03,
      side: index % 2 === 0 ? 1 : -1,
      strength: 0.55 + rng() * 0.45,
    });
  }

  return features.sort((a, b) => a.progress - b.progress);
}

/** Le interazioni attive a un dato progresso (0–1). */
export function featuresAt(features: readonly TrackFeature[], progress: number): TrackFeature[] {
  return features.filter(
    (feature) => Math.abs(progress - feature.progress) <= feature.span,
  );
}

/**
 * Fattore sul bersaglio di velocità: l'attrito morde, la rampa spinge. È
 * moltiplicativo perché nel resto della corsa i fattori si compongono così.
 */
export function alongFactor(features: readonly TrackFeature[], progress: number): number {
  let factor = 1;
  for (const feature of featuresAt(features, progress)) {
    if (feature.kind === 'attrito') factor *= 1 - ATTRITO_SLOW * feature.strength;
    if (feature.kind === 'rampa') factor *= RAMPA_BOOST;
  }
  return factor;
}

/**
 * Spinta laterale della corrente, in px per passo. Vale zero fuori dalle
 * correnti: l'attrito e i perni non spingono di lato.
 */
export function lateralPush(features: readonly TrackFeature[], progress: number): number {
  let push = 0;
  for (const feature of featuresAt(features, progress)) {
    if (feature.kind === 'corrente') push += feature.side * CORRENTE_PUSH * feature.strength;
  }
  return push;
}

/**
 * Interazioni che si sentono una volta sola per biglia (rampa e perni): il
 * resto sono forze continue. Restituisce la prima incontrata, così chi chiama
 * sa se far sobbalzare la biglia o frenarla.
 */
export function oneShotAt(
  features: readonly TrackFeature[],
  progress: number,
  already: ReadonlySet<string>,
): TrackFeature | null {
  for (const feature of featuresAt(features, progress)) {
    if (feature.kind !== 'rampa' && feature.kind !== 'perni') continue;
    if (already.has(feature.id)) continue;
    return feature;
  }
  return null;
}

/**
 * Punto della pista dove disegnare un'interazione, con il verso del lato: la
 * TV disegna rampe e correnti esattamente dove la fisica le applica.
 */
export function featureFrame(
  geometry: TrackGeometry,
  feature: TrackFeature,
): { x: number; y: number; angle: number; width: number; nx: number; ny: number } {
  const frame = frameAtProgress(geometry, feature.progress);
  return {
    x: frame.x,
    y: frame.y,
    angle: frame.angle,
    width: frame.width,
    nx: frame.nx,
    ny: frame.ny,
  };
}
