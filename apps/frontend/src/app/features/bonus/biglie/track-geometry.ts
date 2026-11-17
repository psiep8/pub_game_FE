/**
 * Geometria delle piste delle Biglie, a pezzi e con una sola linea centrale.
 *
 * La pista è una sequenza di pezzi del catalogo (dritto, curva, esse, chicane,
 * strettoia). Ogni pezzo dà la forma desiderata e la larghezza; a trasformarla
 * in una linea continua ci pensa un controllore di sterzata: punta al centro
 * della fascia, limita la curvatura e quindi non incrocia mai se stesso né esce
 * dallo schermo. Il seme decide i pezzi, le ampiezze e il verso.
 *
 * La stessa linea produce:
 * - i bordi disegnati (`edgePoints`),
 * - i muri fisici di Matter (`wallSegments`),
 * - le isole dei bivi (`islandSegments`),
 * - la proiezione della biglia sulla pista (`projectOnTrack`), da cui
 *   arrivano progresso, lato e ordine di corsa.
 *
 * Disegno e fisica leggono quindi gli stessi numeri: la pista che si vede è
 * quella su cui rotolano le biglie.
 */

/** Passo dei campioni della linea centrale, in unità di mondo. */
const NODE_STEP = 6;
/** Lunghezza dell'ultimo rettilineo, per un traguardo pulito. */
const FINAL_STRAIGHT = 240;
/** Massima sterzata: la pista cresce solo in avanti, ma accetta tornanti. */
const MAX_HEADING = 0.95;

export type TrackPieceKind = 'dritto' | 'curva' | 'esse' | 'chicane' | 'strettoia';

export interface TrackPiece {
  kind: TrackPieceKind;
  /** Ascissa curvilinea di inizio e fine del pezzo. */
  from: number;
  to: number;
}

export interface TrackNode {
  x: number;
  y: number;
  /** Ascissa curvilinea dall'inizio della pista. */
  s: number;
  /** Larghezza della corsia in quel punto (le strettoie la riducono). */
  width: number;
  /** Direzione della linea, in radianti. */
  angle: number;
}

export interface TrackGeometry {
  nodes: TrackNode[];
  pieces: TrackPiece[];
  totalLength: number;
  /** Larghezza nominale della corsia. */
  width: number;
  seed: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface TrackProjection {
  index: number;
  s: number;
  /** 0–1 lungo la pista. */
  progress: number;
  /** Scostamento dal centro: positivo verso il basso sullo schermo. */
  lateral: number;
}

export interface TrackFrame {
  x: number;
  y: number;
  angle: number;
  width: number;
  /** Normale unitaria (lato positivo, cioè il basso dello schermo). */
  nx: number;
  ny: number;
  /** Tangente unitaria. */
  tx: number;
  ty: number;
}

export interface WallSegment {
  x: number;
  y: number;
  angle: number;
  length: number;
}

export interface IslandGeometry {
  segments: WallSegment[];
  caps: Array<{ x: number; y: number; radius: number }>;
}

export interface BuildTrackOptions {
  width: number;
  length?: number;
  startX?: number;
  maxLateral?: number;
  seed?: number;
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

function shuffle<T>(values: T[], rng: () => number): T[] {
  for (let index = values.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

interface PieceProfile {
  /** Scostamento desiderato dal centro, in funzione dell'avanzamento 0–1. */
  target: (t: number) => number;
  /** Larghezza della corsia nella stesso tratto. */
  width: (t: number) => number;
}

/**
 * Costruisce la linea centrale a pezzi. Stesso seme, stessa pista: il piano
 * non cambia con il ridimensionamento della TV.
 */
export function buildTrack(seed: number, options: BuildTrackOptions): TrackGeometry {
  const rng = seededRandom((seed >>> 0) || 1);
  const width = Math.max(160, Number(options.width) || 240);
  const totalLength = Math.max(600, Number(options.length) || 3600);
  const startX = Number(options.startX ?? 140);
  // Fascia verticale: la corsia può usare quasi tutta l'altezza utile, così le
  // curve hanno ampiezza e non solo un'onda accennata.
  const maxLateral = Math.max(
    40,
    Math.min(112, options.maxLateral ?? 150 - width * 0.22),
  );
  const amplitude = maxLateral * 0.9;
  // Raggio minimo maggiore di mezza corsia: il bordo interno non si ripiega.
  const minRadius = Math.max(150, (width / 2) + 45);
  const curvatureLimit = 1 / minRadius;

  const nodes: TrackNode[] = [{ x: startX, y: 0, s: 0, width, angle: 0 }];
  const pieces: TrackPiece[] = [];
  const deck = shuffle(
    ['curva', 'esse', 'chicane', 'strettoia', 'curva', 'dritto'] as TrackPieceKind[],
    rng,
  );
  let cursor = 0;
  let x = startX;
  let y = 0;
  let heading = 0;
  let s = 0;

  /** Il pezzo decide bersaglio e larghezza; il controllore ci arriva senza sbandare. */
  const profileFor = (kind: TrackPieceKind, startY: number, direction: number): PieceProfile => {
    switch (kind) {
      case 'curva':
        // Curva ampia: mezzo giro di sinusoide, con verso sorteggiato.
        return {
          target: (t) => amplitude * direction * Math.sin(Math.PI * t),
          width: () => width,
        };
      case 'esse':
        return {
          target: (t) => amplitude * Math.sin(Math.PI * 2 * t),
          width: () => width,
        };
      case 'chicane':
        // Doppia esse stretta: due cambi di verso in poco spazio.
        return {
          target: (t) => amplitude * 0.75 * Math.sin(Math.PI * 4 * t),
          width: () => width,
        };
      case 'strettoia':
        return {
          target: () => 0,
          width: (t) => width * (1 - 0.34 * Math.sin(Math.PI * t)),
        };
      default:
        // Rettilineo vero: mantiene lo scostamento raggiunto, senza piegare.
        return {
          target: () => startY,
          width: () => width,
        };
    }
  };

  const integrate = (length: number, profile: PieceProfile, commitPiece?: TrackPieceKind): void => {
    const steps = Math.max(1, Math.ceil(length / NODE_STEP));
    const ds = length / Math.max(1, Math.ceil(length / NODE_STEP));
    const from = s;
    for (let index = 0; index < steps; index++) {
      const t = (index + 1) / steps;
      const target = profile.target(t);
      // Punta al bersaglio con un anticipo di 90 px, poi limita la sterzata.
      const desired = Math.max(-MAX_HEADING, Math.min(MAX_HEADING, Math.atan2(target - y, 70)));
      const curvature = Math.max(
        -curvatureLimit,
        Math.min(curvatureLimit, (desired - heading) / 35),
      );
      const mid = heading + (curvature * ds) / 2;
      x += Math.cos(mid) * ds;
      y += Math.sin(mid) * ds;
      heading += curvature * ds;
      s += ds;
      nodes.push({ x, y, s, width: profile.width(t), angle: heading });
    }
    if (commitPiece) pieces.push({ kind: commitPiece, from, to: s });
  };

  // Partenza dritta, con le biglie allineate sulla griglia.
  integrate(Math.min(240, totalLength * 0.1), profileFor('dritto', 0, 1), 'dritto');

  while (s < totalLength - FINAL_STRAIGHT - 80) {
    if (cursor >= deck.length) {
      shuffle(deck, rng);
      cursor = 0;
    }
    const kind = deck[cursor];
    cursor += 1;
    const remaining = totalLength - FINAL_STRAIGHT - s;
    // Pezzi corti: più curve e cambi di verso nello stesso tracciato.
    const base = kind === 'dritto'
      ? 100 + rng() * 90
      : kind === 'strettoia'
        ? 140 + rng() * 70
        : kind === 'curva'
          ? 130 + rng() * 70
          : kind === 'esse'
            ? 160 + rng() * 90
            : 120 + rng() * 70;
    const length = Math.max(80, Math.min(remaining, base));
    const direction = rng() < 0.5 ? -1 : 1;
    integrate(length, profileFor(kind, y, direction), kind);
  }

  // Traguardo: la pista torna sull'asse e punta dritta.
  const tail = totalLength - s;
  if (tail > 0.5) {
    integrate(
      tail,
      { target: () => 0, width: () => width },
      'dritto',
    );
  }

  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  return {
    nodes,
    pieces,
    totalLength: nodes[nodes.length - 1]?.s ?? 0,
    width,
    seed: seed >>> 0,
    bounds,
  };
}

/** Interpola la linea all'ascissa curvilinea `s`. */
export function pointAtS(geometry: TrackGeometry, s: number): TrackFrame {
  const nodes = geometry.nodes;
  const clamped = Math.max(0, Math.min(geometry.totalLength, s));
  const approx = (clamped / Math.max(1, geometry.totalLength)) * (nodes.length - 1);
  let index = Math.max(0, Math.min(nodes.length - 1, Math.round(approx)));
  while (index > 0 && nodes[index].s > clamped) index -= 1;
  while (index < nodes.length - 1 && nodes[index + 1].s < clamped) index += 1;

  const start = nodes[index];
  const end = Math.min(nodes.length - 1, index + 1);
  const span = nodes[end].s - start.s;
  const local = span > 0 ? Math.max(0, Math.min(1, (clamped - start.s) / span)) : 0;
  const angle = start.angle + (nodes[end].angle - start.angle) * local;
  return {
    x: start.x + (nodes[end].x - start.x) * local,
    y: start.y + (nodes[end].y - start.y) * local,
    angle,
    width: start.width + (nodes[end].width - start.width) * local,
    nx: -Math.sin(angle),
    ny: Math.cos(angle),
    tx: Math.cos(angle),
    ty: Math.sin(angle),
  };
}

/** Interpola la linea al progresso 0–1. */
export function frameAtProgress(geometry: TrackGeometry, progress: number): TrackFrame {
  return pointAtS(geometry, progress * geometry.totalLength);
}

/**
 * Proietta un punto sulla linea centrale: progresso, lato e indice del
 * campione più vicino (da passare come `hint` al passo successivo).
 */
export function projectOnTrack(
  geometry: TrackGeometry,
  x: number,
  y: number,
  hint = 0,
): TrackProjection {
  const nodes = geometry.nodes;
  const distance = (index: number): number => {
    const node = nodes[index];
    return (node.x - x) * (node.x - x) + (node.y - y) * (node.y - y);
  };

  let best = 0;
  let bestDistance = Infinity;
  const scan = (from: number, to: number): void => {
    const start = Math.max(0, from);
    const end = Math.min(nodes.length - 1, to);
    for (let index = start; index <= end; index++) {
      const value = distance(index);
      if (value < bestDistance) {
        bestDistance = value;
        best = index;
      }
    }
  };

  if (hint > 0 && hint < nodes.length) {
    scan(hint - 110, hint + 110);
    // Un salto grosso (spinta, rimbalzo, rigenerazione) merita una ricerca piena.
    if (bestDistance > 120 * 120) scan(0, nodes.length - 1);
  } else {
    scan(0, nodes.length - 1);
  }

  let bestS = nodes[best].s;
  let bestLateral = 0;
  let bestGap = bestDistance;
  for (const pair of [[Math.max(0, best - 1), best], [best, Math.min(nodes.length - 1, best + 1)]]) {
    const a = nodes[pair[0]];
    const b = nodes[pair[1]];
    if (a === b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0) continue;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const gap = (x - px) * (x - px) + (y - py) * (y - py);
    if (gap > bestGap) continue;
    const angle = Math.atan2(dy, dx);
    bestGap = gap;
    bestS = a.s + (b.s - a.s) * t;
    bestLateral = (x - px) * -Math.sin(angle) + (y - py) * Math.cos(angle);
  }

  const clampedS = Math.max(0, Math.min(geometry.totalLength, bestS));
  return {
    index: best,
    s: clampedS,
    progress: geometry.totalLength > 0 ? clampedS / geometry.totalLength : 0,
    lateral: bestLateral,
  };
}

/** Bordo della pista a `side` (-1 sinistra, +1 destra), arretrato di `inset`. */
export function edgePoints(
  geometry: TrackGeometry,
  side: -1 | 1,
  inset = 0,
): Array<{ x: number; y: number; angle: number; width: number; s: number }> {
  return geometry.nodes.map((node) => {
    const nx = -Math.sin(node.angle);
    const ny = Math.cos(node.angle);
    const offset = side * (node.width / 2 - inset);
    return {
      x: node.x + nx * offset,
      y: node.y + ny * offset,
      angle: node.angle,
      width: node.width,
      s: node.s,
    };
  });
}

/**
 * Muri fisici ricavati dalla linea centrale: segmenti ruotati lungo il bordo,
 * con lo stesso scostamento dei bordi disegnati (`inset` negativo = fuori).
 */
export function wallSegments(
  geometry: TrackGeometry,
  side: -1 | 1,
  inset = 0,
  stride = 3,
): WallSegment[] {
  const nodes = geometry.nodes;
  const segments: WallSegment[] = [];
  const step = Math.max(1, Math.floor(stride));

  const point = (index: number): { x: number; y: number; angle: number } => {
    const node = nodes[Math.max(0, Math.min(nodes.length - 1, index))];
    const nx = -Math.sin(node.angle);
    const ny = Math.cos(node.angle);
    const offset = side * (node.width / 2 - inset);
    return { x: node.x + nx * offset, y: node.y + ny * offset, angle: node.angle };
  };

  for (let index = 0; index + step < nodes.length; index += step) {
    const a = point(index);
    const b = point(index + step);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) continue;
    segments.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      angle: Math.atan2(dy, dx),
      length: length + 4,
    });
  }

  return segments;
}

/**
 * Isola di un bivio: striscia che segue la linea tra due progressi, alla
 * distanza laterale richiesta, più due tappi arrotondati.
 */
export function islandSegments(
  geometry: TrackGeometry,
  fromProgress: number,
  toProgress: number,
  lateral: number,
  thickness: number,
  stride = 3,
): IslandGeometry {
  const from = Math.max(0, Math.min(1, fromProgress)) * geometry.totalLength;
  const to = Math.max(0, Math.min(1, toProgress)) * geometry.totalLength;
  const nodes = geometry.nodes.filter((node) => node.s >= from && node.s <= to);
  const segments: WallSegment[] = [];
  const step = Math.max(1, Math.floor(stride));

  for (let index = 0; index + step < nodes.length; index += step) {
    const a = nodes[index];
    const b = nodes[index + step];
    const ax = a.x - Math.sin(a.angle) * lateral;
    const ay = a.y + Math.cos(a.angle) * lateral;
    const bx = b.x - Math.sin(b.angle) * lateral;
    const by = b.y + Math.cos(b.angle) * lateral;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) continue;
    segments.push({
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      angle: Math.atan2(dy, dx),
      length: length + 4,
    });
  }

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const caps = first && last
    ? [
      {
        x: first.x - Math.sin(first.angle) * lateral,
        y: first.y + Math.cos(first.angle) * lateral,
        radius: thickness / 2,
      },
      {
        x: last.x - Math.sin(last.angle) * lateral,
        y: last.y + Math.cos(last.angle) * lateral,
        radius: thickness / 2,
      },
    ]
    : [];

  return { segments, caps };
}
