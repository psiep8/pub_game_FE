import { describe, expect, it } from 'vitest';

import {
  RECAP_MIN_MS,
  RECAP_PAGE_MS,
  recapDurationMs,
  recapPages,
  recapRows,
  shouldRecap,
  type RecapRow,
} from './round-recap-model';

function entry(playerName: string, totalPoints: number) {
  return { playerName, totalPoints };
}

function row(playerName: string, delta: number, total: number, position: number): RecapRow {
  return { playerName, delta, total, position };
}

describe('round recap model (N-11)', () => {
  it('ordina dal peggiore al migliore e conta i punti fatti nel round', () => {
    const start = new Map([
      ['Anna', 100],
      ['Bea', 50],
      ['Carla', 70],
    ]);

    const rows = recapRows([entry('Anna', 130), entry('Bea', 40), entry('Carla', 160)], start);

    expect(rows.map((r) => [r.playerName, r.delta, r.total, r.position])).toEqual([
      ['Bea', -10, 40, 3],
      ['Anna', 30, 130, 2],
      ['Carla', 90, 160, 1],
    ]);
  });

  it('a pari punti del round chi ha il totale più alto sta più avanti', () => {
    const rows = recapRows(
      [entry('Anna', 130), entry('Bea', 80)],
      new Map([
        ['Anna', 100],
        ['Bea', 50],
      ]),
    );

    expect(rows.map((r) => [r.playerName, r.delta, r.total])).toEqual([
      ['Bea', 30, 80],
      ['Anna', 30, 130],
    ]);
  });

  it('dà la stessa posizione alle squadre con lo stesso totale', () => {
    const rows = recapRows(
      [entry('Anna', 200), entry('Bea', 200), entry('Carla', 50)],
      new Map([
        ['Anna', 0],
        ['Bea', 0],
        ['Carla', 0],
      ]),
    );

    expect(rows.map((r) => [r.playerName, r.position])).toEqual([
      ['Carla', 3],
      ['Anna', 1],
      ['Bea', 1],
    ]);
  });

  it('tiene una pagina sola fino a dieci squadre', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`Squadra ${i}`, i, i, 10 - i));

    expect(recapPages(rows)).toHaveLength(1);
    expect(recapPages(rows)[0]).toHaveLength(10);
  });

  it('regge 4, 8, 10, 14 e 20 squadre', () => {
    const rowsFor = (count: number) =>
      Array.from({ length: count }, (_, i) => row(`Squadra ${i}`, i, i, count - i));
    const sizes = [4, 8, 10, 14, 20];

    expect(sizes.map((size) => recapPages(rowsFor(size)).length)).toEqual([1, 1, 1, 2, 3]);
    expect(sizes.map((size) => recapDurationMs(rowsFor(size)))).toEqual([
      8000, 8000, 8000, 8000, 9000,
    ]);
  });

  it('oltre dieci squadre pagina a sette righe', () => {
    const fourteen = Array.from({ length: 14 }, (_, i) => row(`Squadra ${i}`, i, i, 14 - i));
    const twenty = Array.from({ length: 20 }, (_, i) => row(`Squadra ${i}`, i, i, 20 - i));

    expect(recapPages(fourteen).map((page) => page.length)).toEqual([7, 7]);
    expect(recapPages(twenty).map((page) => page.length)).toEqual([7, 7, 6]);
  });

  it('dura almeno otto secondi e cresce di una pagina alla volta', () => {
    expect(recapDurationMs([])).toBe(0);
    expect(recapDurationMs([row('Anna', 10, 10, 1), row('Bea', 0, 0, 2)])).toBe(RECAP_MIN_MS);

    const fourteen = Array.from({ length: 14 }, (_, i) => row(`Squadra ${i}`, i, i, 14 - i));
    expect(recapDurationMs(fourteen)).toBe(RECAP_MIN_MS);

    const twenty = Array.from({ length: 20 }, (_, i) => row(`Squadra ${i}`, i, i, 20 - i));
    expect(recapDurationMs(twenty)).toBe(3 * RECAP_PAGE_MS);
    expect(recapDurationMs(twenty)).toBe(9000);
  });

  it('nessun riepilogo senza punti mossi, con una squadra sola o fuori scaletta', () => {
    const moved = [row('Anna', 10, 10, 1), row('Bea', -5, 5, 2)];
    const still = [row('Anna', 0, 10, 1), row('Bea', 0, 5, 2)];

    expect(shouldRecap('QUIZ', moved)).toBe(true);
    expect(shouldRecap('QUIZ', still)).toBe(false);
    expect(shouldRecap('QUIZ', [row('Anna', 10, 10, 1)])).toBe(false);
    expect(shouldRecap('BONUS', moved)).toBe(false);
  });
});