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
 * - la proiezione della biglia sulla pista (`projectOnTrack`), da cui
 *   arrivano progresso, lato e ordine di corsa.
 *
 * Disegno e fisica leggono quindi gli stessi numeri: la pista che si vede è
 * quella su cui rotolano le biglie.
 */

/** Passo dei campioni della linea centrale, in unità di mondo. */
const NODE_STEP = 6;
/** Pezzi di una pista senza profilo proprio: il serpente di sempre. */
const DEFAULT_DECK: readonly TrackPieceKind[] = [
  'curva',
  'esse',
  'chicane',
  'strettoia',
  'curva',
  'dritto',
  'strettoia',
  'esse',
  'curva',
];
/** Larghezza minima della corsia: tre diametri della biglia più larga. */
const MIN_LANE = 96;
/** Lunghezza dell'ultimo rettilineo, per un traguardo pulito. */
const FINAL_STRAIGHT = 360;
/** Massima sterzata: la pista cresce solo in avanti, ma accetta tornanti. */
const MAX_HEADING = 1.02;

export type TrackPieceKind =
  | 'dritto'
  | 'curva'
  | 'esse'
  | 'chicane'
  | 'strettoia'
  /** Imbuto: la corsia si chiude a una gola e si riapre. */
  | 'imbuto'
  /** Rampa: pezzo dritto che lancia la biglia, segnato per le interazioni. */
  | 'rampa'
  /** Perni: dritto con i birilli in mezzo alla corsia. */
  | 'perni';

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

/**
 * Carattere di un fondo, letto dal generatore: quali pezzi escono, quanto sono
 * lunghi e quanto stringe la corsia. Le otto piste hanno profili diversi e
 * quindi tracciati diversi a parità di seme; senza profilo la linea è quella
 * di sempre, così il comportamento resta verificabile a parte.
 */
export interface TrackProfile {
  /** Pezzi della pista, mescolati col seme. */
  deck: readonly TrackPieceKind[];
  /** Quanto stringe la corsia nelle strettoie, da 0 a 1. */
  narrow: number;
}

export interface BuildTrackOptions {
  width: number;
  length?: number;
  startX?: number;
  maxLateral?: number;
  seed?: number;
  /** Profilo del fondo: senza, vale la pista di sempre. */
  profile?: TrackProfile;
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
  /** Direzione voluta, in radianti, in funzione dell'avanzamento 0–1. */
  heading: (t: number) => number;
  /** Larghezza della corsia nella stesso tratto. */
  width: (t: number) => number;
}

/**
 * Costruisce la linea centrale a pezzi. Stesso seme, stessa pista: il piano
 * non cambia con il ridimensionamento della TV.
 */
export function buildTrack(seed: number, options: BuildTrackOptions): TrackGeometry {
  const rng = seededRandom((seed >>> 0) || 1);
  const profile = options.profile;
  const width = Math.max(120, Number(options.width) || 240);
  const totalLength = Math.max(600, Number(options.length) || 3600);
  const startX = Number(options.startX ?? 140);
  // Fascia verticale: il nastro sale e scende di un'ampiezza paragonabile alla
  // corsia, come un tracciato da rally disegnato a zig-zag.
  const maxLateral = Math.max(
    40,
    Math.min(260, options.maxLateral ?? 250),
  );
  const amplitude = maxLateral;
  // Nelle strettoie la corsia non scende mai sotto i tre diametri della biglia.
  const narrow = profile ? Math.max(0, Math.min(profile.narrow, 1 - MIN_LANE / width)) : 0.26;
  // Tornanti vivi: raggio piccolo, ma sempre più largo di mezza corsia più il
  // muro, così l'interno della curva non si ripiega né intrappola la biglia.
  const minRadius = Math.max(70, (width / 2) + 8);
  const curvatureLimit = 1 / minRadius;

  const nodes: TrackNode[] = [{ x: startX, y: 0, s: 0, width, angle: 0 }];
  const pieces: TrackPiece[] = [];
  const deck = shuffle(
    [...(profile?.deck?.length ? profile.deck : DEFAULT_DECK)] as TrackPieceKind[],
    rng,
  );
  let cursor = 0;
  let x = startX;
  let y = 0;
  let heading = 0;
  let s = 0;
  let lastDirection = 1;

  /**
   * Il pezzo decide bersaglio e larghezza; il controllore lo segue con la
   * sterzata massima. Bersagli a rampa e a V danno gambe dritte e tornanti ad
   * angolo vivo, come un tracciato vero, invece di onde morbide.
   */
  const profileFor = (
    kind: TrackPieceKind,
    direction: number,
    length: number,
  ): PieceProfile => {
    // Gamba inclinata al massimo consentito: più corta è la gamba, più il
    // tornante è aguzzo.
    const leg = Math.max(0.5, Math.min(MAX_HEADING, Math.atan2(amplitude, length)));
    switch (kind) {
      case 'curva':
        // Diagonale dritta verso l'alto o il basso.
        return { heading: () => direction * leg, width: () => width };
      case 'esse':
        // Tornante a V: dentro fino all'apice, poi fuori.
        return {
          heading: (t) => (t < 0.5 ? direction * leg : -direction * leg),
          width: () => width,
        };
      case 'chicane':
        // Zig-zag doppio: due cambi di verso in poche decine di pixel.
        return {
          heading: (t) => {
            const wave = t < 0.25 ? 1 : t < 0.75 ? -1 : 1;
            return direction * leg * wave;
          },
          width: () => width,
        };
      case 'strettoia':
        return {
          heading: () => direction * leg * 0.45,
          width: (t) => width * (1 - narrow * Math.sin(Math.PI * t)),
        };
      case 'imbuto':
        // Gola vera: la corsia si chiude in fretta e si riapre in fretta. La
        // profondità resta dentro il limite che tiene tre diametri di corsia.
        return {
          heading: () => direction * leg * 0.3,
          width: (t) => width * (1 - Math.min(0.6, narrow * 1.6) * Math.sin(Math.PI * t)),
        };
      case 'rampa':
        // Dritto pieno: il salto lo danno le interazioni, non la larghezza.
        return { heading: () => direction * leg * 0.12, width: () => width };
      case 'perni':
        // Corsia larga: i birilli stanno in mezzo e si passa ai lati.
        return { heading: () => direction * leg * 0.25, width: () => width };
      default:
        return { heading: () => 0, width: () => width };
    }
  };

  const integrate = (length: number, profile: PieceProfile, commitPiece?: TrackPieceKind): void => {
    const steps = Math.max(1, Math.ceil(length / NODE_STEP));
    const ds = length / Math.max(1, Math.ceil(length / NODE_STEP));
    const from = s;
    for (let index = 0; index < steps; index++) {
      const t = (index + 1) / steps;
      // La direzione del pezzo è un vincolo: gambe dritte e apici veri, con la
      // sterzata limitata solo nel raccordo tra una gamba e l'altra. Quando il
      // nastro si allontana troppo dal centro, la direzione lo riporta dentro.
      const raw = profile.heading(t);
      const inner = amplitude * 0.6;
      const over = Math.max(0, Math.abs(y) - inner);
      const weight = Math.min(1, over / Math.max(1, amplitude * 0.25));
      const steer = Math.atan2(-y, 90) * 2.2;
      const desired = Math.max(
        -MAX_HEADING,
        Math.min(MAX_HEADING, raw * (1 - weight) + steer * weight),
      );
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
  integrate(Math.min(200, totalLength * 0.1), profileFor('dritto', 1, 200), 'dritto');

  while (s < totalLength - FINAL_STRAIGHT - 80) {
    if (cursor >= deck.length) {
      shuffle(deck, rng);
      cursor = 0;
    }
    const kind = deck[cursor];
    cursor += 1;
    const remaining = totalLength - FINAL_STRAIGHT - s;
    // Gambe corte: tante curve e tanti cambi di verso nello stesso tracciato.
    // La lunghezza resta quella del pezzo: il fondo cambia la ricetta dei
    // pezzi e quanto stringe la corsia, non il passo del tracciato.
    const base = kind === 'dritto'
        ? 60 + rng() * 50
        : kind === 'strettoia'
          ? 140 + rng() * 50
          : kind === 'curva'
            ? 240 + rng() * 60
            : kind === 'esse'
              ? 260 + rng() * 60
              : 250 + rng() * 60;
    const length = Math.max(70, Math.min(remaining, base));
    // Il verso riporta il nastro verso il centro quando è già lontano: il
    // tracciato serpeggia su tutta l'altezza senza scappare via.
    // Il verso alterna a ogni pezzo: il nastro attraversa la corsia e torna,
    // come un vero zig-zag, senza scappare via in una direzione sola.
    const edge = amplitude * 0.75;
    const direction = y > edge ? -1 : y < -edge ? 1 : -lastDirection;
    lastDirection = direction;
    integrate(length, profileFor(kind, direction, length), kind);
  }

  // Traguardo: la pista torna sull'asse e punta dritta.
  const tail = totalLength - s;
  if (tail > 0.5) {
    integrate(
      tail,
      { heading: () => 0, width: () => width },
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


