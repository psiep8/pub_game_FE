import { describe, expect, it } from 'vitest';

import {
  buildTrack,
  edgePoints,
  frameAtProgress,
  pointAtS,
  projectOnTrack,
  wallSegments,
} from './track-geometry';
import { TRACK_CATALOG } from './track-plan';

const WIDTH = 300;

function geometry(seed = 2026, width = WIDTH) {
  return buildTrack(seed, { width, length: 3600, startX: 140 });
}

describe('geometria a pezzi delle Biglie', () => {
  it('è deterministica: stesso seme, stessa pista', () => {
    const first = geometry(77);
    const second = geometry(77);

    expect(second.nodes).toEqual(first.nodes);
    expect(second.pieces).toEqual(first.pieces);
    expect(second.totalLength).toBe(first.totalLength);
  });

  it('semi diversi danno pezzi diversi', () => {
    const first = geometry(1);
    const second = geometry(2);

    expect(second.pieces).not.toEqual(first.pieces);
    expect(second.nodes).not.toEqual(first.nodes);
  });

  it('rispetta lunghezza, continuità e limiti della fascia', () => {
    for (const seed of [1, 42, 987654321]) {
      const track = geometry(seed);

      expect(track.totalLength).toBeCloseTo(3600, 0);
      expect(track.pieces[0].from).toBe(0);
      expect(track.pieces.at(-1)?.to).toBeCloseTo(track.totalLength, 5);
      for (let index = 1; index < track.pieces.length; index++) {
        expect(track.pieces[index].from).toBeCloseTo(track.pieces[index - 1].to, 6);
      }

      for (let index = 1; index < track.nodes.length; index++) {
        const previous = track.nodes[index - 1];
        const node = track.nodes[index];
        // La pista cresce solo in avanti: niente incroci né tornanti ciechi.
        expect(node.x).toBeGreaterThan(previous.x);
        expect(Math.abs(node.angle)).toBeLessThanOrEqual(0.96);
        expect(Math.abs(node.y)).toBeLessThanOrEqual(230);
        expect(node.s).toBeGreaterThan(previous.s);
      }
    }
  });

  it('usa i pezzi del catalogo, comprese le strettoie', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const track = geometry(seed);
      track.pieces.forEach((piece) => kinds.add(piece.kind));
      const narrow = track.nodes.some((node) => node.width < track.width - 1);
      if (seed === 1) expect(narrow).toBe(true);
    }
    expect([...kinds].sort()).toEqual(['chicane', 'curva', 'dritto', 'esse', 'strettoia']);
  });

  it('i muri fisici sono i bordi della stessa linea centrale', () => {
    const track = geometry(2026);

    for (const side of [-1, 1] as const) {
      const walls = wallSegments(track, side, 0, 3);
      const edges = edgePoints(track, side);
      expect(walls.length).toBeGreaterThan(100);

      walls.forEach((wall) => {
        // Ogni muro è il segmento tra due bordi consecutivi della stessa linea.
        let nearest = Infinity;
        for (let index = 0; index + 3 < edges.length; index += 3) {
          const mx = (edges[index].x + edges[index + 3].x) / 2;
          const my = (edges[index].y + edges[index + 3].y) / 2;
          nearest = Math.min(nearest, Math.hypot(wall.x - mx, wall.y - my));
        }
        expect(nearest).toBeLessThan(2);

        // E il bordo sta verso l'esterno della corsia. Nei tornanti stretti il
        // punto medio del muro proietta un po' più vicino al centro.
        const projection = projectOnTrack(track, wall.x, wall.y);
        expect(Math.sign(projection.lateral)).toBe(side);
        expect(Math.abs(projection.lateral)).toBeGreaterThan(track.width * 0.2);
      });
    }
  });

  it('i bordi disegnati e i muri nascono dagli stessi punti', () => {
    const track = geometry(555);
    const edges = edgePoints(track, 1);

    expect(edges).toHaveLength(track.nodes.length);
    edges.forEach((edge, index) => {
      const node = track.nodes[index];
      const expected = Math.hypot(edge.x - node.x, edge.y - node.y);
      expect(expected).toBeCloseTo(node.width / 2, 6);
      expect(edge.angle).toBeCloseTo(node.angle, 6);
    });
  });

  it('piega davvero: i tornanti usano quasi tutta la sterzata', () => {
    const track = geometry(2026);
    const sharpest = Math.max(...track.nodes.map((node) => Math.abs(node.angle)));

    // Onde larghe non bastano: la pista deve entrare in curva in modo deciso.
    expect(sharpest).toBeGreaterThan(0.7);
  });

  it('proietta una biglia sulla linea: progresso e lato tornano', () => {
    const track = geometry(2026);

    for (const progress of [0.05, 0.3, 0.5, 0.72, 0.95]) {
      for (const lateral of [-80, 0, 60]) {
        const frame = frameAtProgress(track, progress);
        const x = frame.x + frame.nx * lateral;
        const y = frame.y + frame.ny * lateral;
        const projection = projectOnTrack(track, x, y);

        expect(projection.progress).toBeCloseTo(progress, 2);
        expect(projection.lateral).toBeCloseTo(lateral, 0);
      }
    }
  });

  it('il suggerimento di ricerca non cambia il risultato', () => {
    const track = geometry(2026);
    const frame = pointAtS(track, 1800);
    const x = frame.x + frame.nx * 40;
    const y = frame.y + frame.ny * 40;

    const guided = projectOnTrack(track, x, y, 300);
    const exact = projectOnTrack(track, x, y);
    expect(guided.progress).toBeCloseTo(exact.progress, 4);
    expect(guided.s).toBeCloseTo(exact.s, 3);
  });

  it('non scende sotto la larghezza minima delle biglie', () => {
    for (const seed of [3, 9, 15]) {
      const track = geometry(seed);
      const narrowest = Math.min(...track.nodes.map((node) => node.width));
      // Tre diametri della biglia più larga (15 px di raggio) restano comodi.
      expect(narrowest).toBeGreaterThanOrEqual(96);
    }
  });
});

/**
 * Ogni fondo ha il suo profilo: gli stessi muri, la stessa proiezione, ma
 * pezzi, ampiezze e lunghezze diverse. Se un fondo non avesse carattere
 * proprio, la serata avrebbe otto volte la stessa pista.
 */
describe('geometria per fondo', () => {
  const build = (trackId: (typeof TRACK_CATALOG)[number]['id']) => {
    const track = TRACK_CATALOG.find((entry) => entry.id === trackId)!;
    return buildTrack(2026, {
      width: 220,
      length: 12000,
      startX: 140,
      profile: track.geometry,
    });
  };

  it('dà a ogni fondo un tracciato valido e solo con i suoi pezzi', () => {
    for (const track of TRACK_CATALOG) {
      const geometry = build(track.id);

      expect(geometry.totalLength, track.id).toBeCloseTo(12000, 0);
      for (let index = 1; index < geometry.nodes.length; index++) {
        const previous = geometry.nodes[index - 1];
        const node = geometry.nodes[index];
        // Cresce solo in avanti e resta nella fascia del fondo.
        expect(node.x, track.id).toBeGreaterThan(previous.x);
        expect(Math.abs(node.angle), track.id).toBeLessThanOrEqual(1.03);
        expect(Math.abs(node.y), track.id).toBeLessThanOrEqual(track.geometry.amplitude + 60);
        expect(node.s).toBeGreaterThan(previous.s);
      }

      // Partenza e arrivo sono dritti, il resto è del profilo.
      const body = geometry.pieces.slice(1, -1);
      for (const piece of body) {
        expect(track.geometry.deck, `${track.id}: ${piece.kind}`).toContain(piece.kind);
      }

      const narrowest = Math.min(...geometry.nodes.map((node) => node.width));
      expect(narrowest, track.id).toBeGreaterThanOrEqual(96);
    }
  });

  it('otto profili diversi danno otto piste diverse', () => {
    const signatures = new Set(
      TRACK_CATALOG.map((track) =>
        [track.geometry.deck.join(','), track.geometry.amplitude, track.geometry.narrow].join('|'),
      ),
    );
    expect(signatures.size).toBe(TRACK_CATALOG.length);

    const rally = build('rally');
    const spazio = build('spazio');
    expect(spazio.nodes).not.toEqual(rally.nodes);
    expect(spazio.pieces).not.toEqual(rally.pieces);
  });

  it('lo stesso fondo con lo stesso seme ridà la stessa pista', () => {
    const first = build('magma');
    const second = build('magma');

    expect(second.nodes).toEqual(first.nodes);
    expect(second.pieces).toEqual(first.pieces);
  });

  it('la corsia resta fissa: le strettoie stringono, il resto no', () => {
    const track = build('sabbia');
    const nominal = track.width;
    const widths = track.nodes.map((node) => node.width);

    expect(Math.min(...widths)).toBeLessThan(nominal);
    expect(Math.max(...widths)).toBeCloseTo(nominal, 6);
  });
});
