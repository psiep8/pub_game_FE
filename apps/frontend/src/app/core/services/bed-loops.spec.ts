import { describe, expect, it } from 'vitest';

import { BED_LOOPS, type BedLoopId } from './bed-loops';

/**
 * I file dei sottofondi registrati: i quattordici loop che non sono basi
 * d'atto (sei storici e otto arrivati con la consegna), ognuno col nome della
 * tabella del manifesto. Le cinque basi d'atto stanno in `ACT_BEDS`. Qui si
 * controlla il registro; la mappa gioco → sottofondo vive in `bed-map.spec.ts`.
 */
describe('Sottofondi registrati', () => {
  it('ha un file per ogni loop, ognuno con un nome del manifesto', () => {
    const loops = Object.values(BED_LOOPS);
    expect(loops).toHaveLength(14);
    expect(new Set(loops.map((loop) => loop.file)).size).toBe(14);
    for (const loop of loops) {
      expect(loop.label.length, loop.id).toBeGreaterThan(3);
      expect(loop.file, loop.id).toMatch(/^loop\/(lobby|classifica|gioco-[a-z-]+)\.m4a$/);
    }
  });

  it('tiene allineati id della mappa, chiave del registro e nome del file', () => {
    for (const [key, loop] of Object.entries(BED_LOOPS)) {
      expect(loop.id, key).toBe(key as BedLoopId);
      expect(loop.file, key).toContain(`/${key}.m4a`);
    }
  });
});
