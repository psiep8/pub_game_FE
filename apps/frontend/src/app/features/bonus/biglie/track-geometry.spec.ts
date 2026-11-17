import { describe, expect, it } from 'vitest';

import {
  buildTrack,
  edgePoints,
  frameAtProgress,
  pointAtS,
  projectOnTrack,
  wallSegments,
} from './track-geometry';

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
