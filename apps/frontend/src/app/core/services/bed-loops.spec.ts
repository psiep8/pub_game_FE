import { describe, expect, it } from 'vitest';

import { BED_LOOPS, type BedLoopId } from './bed-loops';

/**
 * I file dei sottofondi registrati: sei in casa, i cinque d'atto e gli otto
 * giochi nuovi arrivano con la prossima consegna (vedi il manifesto). Qui si
 * controlla il registro, cioè che ogni file abbia il nome della tabella; la
 * mappa gioco → sottofondo vive in `bed-map.spec.ts`.
 */
describe('Sottofondi registrati', () => {
  it('ha sei file per intanto, ognuno con un nome del manifesto', () => {
    const loops = Object.values(BED_LOOPS);
    expect(loops).toHaveLength(6);
    expect(new Set(loops.map((loop) => loop.file)).size).toBe(6);
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
