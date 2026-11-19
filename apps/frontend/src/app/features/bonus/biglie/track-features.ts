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
  | 'perni'
  /** Barra: braccio che spazza la corsia da un muro all'altro. */
  | 'barra'
  /** Porta: cancello che si chiude e si apre a tempo. */
  | 'porta'
  /** Altalena: trave che oscilla larga, più lenta della barra. */
  | 'altalena';

/** Gli ostacoli mobili: uno per pista, scelto in modo deterministico. */
export const MOVING_KINDS: readonly FeatureKind[] = ['barra', 'porta', 'altalena'];

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
  /** Sfasamento dell'oscillazione degli ostacoli mobili, in secondi. */
  phase: number;
}

/** Quanto stringe una zona d'attrito: un quinto della velocità, non di più. */
const ATTRITO_SLOW = 0.06;
/** Spinta della corrente, in px per passo di fisica. */
const CORRENTE_PUSH = 0.22;
/** Colpo della rampa: velocità che sale e sobbalzo di lato. */
const RAMPA_BOOST = 1.06;
/** Il perno costa come un ostacolo piccolo. */
export const PERNI_FACTOR = 0.72;
/** Prendere la barra, la porta o l'altalena costa meno di un paracarro. */
export const MOVING_FACTOR = 0.9;

/** Numero stabile dal nome del fondo: decide il tipo di ostacolo mobile. */
function hashId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

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
      phase: 0,
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
      phase: 0,
    });
  }

  // Un ostacolo mobile per pista, sempre allo stesso punto: il tipo lo decide
  // il nome del fondo, lo sfasamento il seme. Niente `Math.random`: la TV e la
  // simulazione lo vedono muoversi allo stesso modo.
  const moving = MOVING_KINDS[hashId(trackId) % MOVING_KINDS.length];
  features.push({
    id: `feature-${trackId}-${moving}`,
    kind: moving,
    progress: 0.52,
    span: 0.012,
    side: 1,
    strength: 1,
    phase: rng() * Math.PI * 2,
  });

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

/** Quel che serve per fare un passo di interazioni, uguale per TV e corsa. */
export interface InteractionState {
  /** Progresso 0–1 sulla pista. */
  progress: number;
  /** Secondi di gara. */
  elapsed: number;
  /** Posizione di lato, in px dal centro. */
  lateral: number;
  /** Semicorsia utile, in px. */
  halfLane: number;
}

/** Effetti di un passo di interazioni, prima di toccare la biglia. */
export interface InteractionResult {
  /** Fattore sul bersaglio di velocità (attrito e rampa). */
  targetFactor: number;
  /** Fattore sulla velocità già in corso (perni e ostacoli mobili). */
  alongFactor: number;
  /** Spinta di lato della corrente, px per passo. */
  lateralPush: number;
  /** Rinculo di lato dell'ostacolo mobile, px per passo. */
  lateralKick: number;
  /** Secondi di blocco, ripresa e spinta da aggiungere ai timer. */
  stun: number;
  recover: number;
  boost: number;
  /** Rampa o perni presi in questo passo (uno al massimo). */
  hit: TrackFeature | null;
  /** Ostacoli mobili presi in questo passo. */
  obstacles: TrackFeature[];
}

/**
 * Un passo di interazioni, in un ordine solo: prima attrito, correnti e rampe
 * (continue), poi le cose che si sentono una volta sola (rampa e perni), poi
 * gli ostacoli mobili. La TV e la simulazione chiamano questa e nient'altro,
 * così perni e barra arrivano sempre nello stesso ordine.
 */
export function stepInteractions(
  features: readonly TrackFeature[],
  state: InteractionState,
  taken: Set<string>,
): InteractionResult {
  const result: InteractionResult = {
    targetFactor: alongFactor(features, state.progress),
    alongFactor: 1,
    lateralPush: lateralPush(features, state.progress),
    lateralKick: 0,
    stun: 0,
    recover: 0,
    boost: 0,
    hit: null,
    obstacles: [],
  };

  // 1. Rampa e perni: uno per volta, e una volta sola per biglia.
  const hit = oneShotAt(features, state.progress, taken);
  if (hit) {
    taken.add(hit.id);
    result.hit = hit;
    if (hit.kind === 'rampa') {
      result.boost = 0.9;
    } else {
      result.alongFactor *= PERNI_FACTOR;
      result.stun = 0.15;
      result.recover = 0.55;
    }
  }

  // 2. Ostacoli mobili: dopo i fissi, con la stessa chiave temporale in TV e
  // in simulazione (un colpo ogni due secondi per ostacolo).
  const lateralFraction = state.lateral / Math.max(1, state.halfLane);
  for (const obstacle of movingAt(features, state.progress)) {
    if (!movingObstacleHit(obstacle, state.elapsed, lateralFraction)) continue;
    const key = `${obstacle.id}@${Math.floor(state.elapsed / 2)}`;
    if (taken.has(key)) continue;
    taken.add(key);
    result.obstacles.push(obstacle);
    result.alongFactor *= MOVING_FACTOR;
    result.lateralKick -= Math.sign(lateralFraction || 1) * 0.5;
    result.stun = Math.max(result.stun, 0.12);
    result.recover = Math.max(result.recover, 0.5);
  }

  return result;
}

/** Il minimo che una biglia deve avere perché le interazioni la tocchino. */
export interface InteractionTarget {
  bumped: Set<string>;
  boostUntil: number;
  stunUntil: number;
  recoverUntil: number;
}

/**
 * Quante volte il passo condiviso è stato applicato davvero. Il gioco non lo
 * legge: serve al test di confronto, che azzera il contatore e fa correre una
 * gara vera. Se una delle due corse smette di passare di qui, il numero non
 * sale e il test fallisce invece di confrontare due funzioni che nessuno usa.
 */
let interactionSteps = 0;

export function interactionStepCount(): number {
  return interactionSteps;
}

export function resetInteractionStepCount(): void {
  interactionSteps = 0;
}

/**
 * Applica il passo di interazioni a una biglia: è l'unico punto in cui la TV e
 * la corsa headless cambiano velocità e timer. Restituisce il bersaglio
 * corretto e la spinta di lato da dare alla velocità della biglia.
 */
export function applyInteractions(
  features: readonly TrackFeature[],
  state: InteractionState,
  target: number,
  marble: InteractionTarget,
): {
  target: number;
  along: number;
  lateral: number;
  lateralKick: number;
  hit: TrackFeature | null;
  obstacles: TrackFeature[];
} {
  const result = stepInteractions(features, state, marble.bumped);
  interactionSteps += 1;
  if (result.boost > 0) {
    marble.boostUntil = Math.max(marble.boostUntil, state.elapsed + result.boost);
  }
  if (result.stun > 0) {
    marble.stunUntil = Math.max(marble.stunUntil, state.elapsed + result.stun);
  }
  if (result.recover > 0) {
    marble.recoverUntil = Math.max(marble.recoverUntil, state.elapsed + result.recover);
  }

  // I colpi sulla velocità li applica chi chiama, subito dopo il proprio passo
  // di accelerazione: lì la penalità non viene riscritta dal bersaglio.
  return {
    target: target * result.targetFactor,
    along: result.alongFactor,
    lateral: result.lateralPush,
    lateralKick: result.lateralKick,
    hit: result.hit,
    obstacles: result.obstacles,
  };
}

/** Posizione di un ostacolo mobile, in frazioni di semicorsia. */
export interface ObstaclePose {
  /** Centro dell'ostacolo: −1 il muro basso, +1 quello alto. */
  center: number;
  /** Mezza larghezza occupata, stessa unità. */
  half: number;
  /** La porta aperta non blocca il passaggio. */
  blocking: boolean;
}

/**
 * Dove sta l'ostacolo mobile al secondo `elapsed` di gara. Tutto periodico e
 * deterministico: stesso istante, stessa posizione in TV e in simulazione.
 */
export function movingObstacle(feature: TrackFeature, elapsed: number): ObstaclePose {
  const t = elapsed + feature.phase;
  switch (feature.kind) {
    case 'barra':
      // Spazza la corsia in poco più di tre secondi per lato.
      return { center: Math.sin(t * 1.05) * 0.82, half: 0.2, blocking: true };
    case 'altalena':
      // Più lenta e più larga: si passa quando è dall'altra parte.
      return { center: Math.sin(t * 0.55) * 0.9, half: 0.26, blocking: true };
    case 'porta':
      // Si chiude al centro per poco più di un secondo, poi si apre.
      return { center: 0, half: 0.4, blocking: Math.sin(t * 0.75) > -0.15 };
    default:
      return { center: 0, half: 0, blocking: false };
  }
}

/** Gli ostacoli mobili in un punto della pista. */
export function movingAt(features: readonly TrackFeature[], progress: number): TrackFeature[] {
  return featuresAt(features, progress).filter(
    (feature) => feature.kind === 'barra' || feature.kind === 'porta' || feature.kind === 'altalena',
  );
}

/**
 * True se la biglia prende l'ostacolo: `lateralFraction` va da −1 (muro basso)
 * a +1 (muro alto), come la posizione dell'ostacolo.
 */
export function movingObstacleHit(
  feature: TrackFeature,
  elapsed: number,
  lateralFraction: number,
): boolean {
  const pose = movingObstacle(feature, elapsed);
  if (!pose.blocking) return false;
  return Math.abs(lateralFraction - pose.center) <= pose.half;
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
