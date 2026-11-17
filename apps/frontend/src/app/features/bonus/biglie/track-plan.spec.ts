import { describe, expect, it } from 'vitest';

import {
  BIGLIE_RACES,
  BIGLIE_ROUNDS,
  TRACK_CATALOG,
  TRACKS_PER_ROUND,
  biglieRaceNumber,
  biglieRoundSlot,
  planRoundTracks,
  trackById,
} from './track-plan';

describe('piano delle piste delle Biglie', () => {
  it('ha otto piste, ognuna con fisica propria', () => {
    expect(TRACK_CATALOG).toHaveLength(8);
    const ids = new Set(TRACK_CATALOG.map((track) => track.id));
    expect(ids.size).toBe(8);
    for (const track of TRACK_CATALOG) {
      expect(track.physics.friction).toBeGreaterThan(0);
      expect(track.physics.gravity).toBeGreaterThan(0);
      expect(track.physics.bounce).toBeGreaterThan(0);
    }
  });

  it('distingue davvero i fondi nuovi', () => {
    expect(trackById('ghiaccio').physics.friction).toBeLessThan(trackById('rally').physics.friction);
    expect(trackById('sabbia').physics.friction).toBeGreaterThan(trackById('f1').physics.friction);
    expect(trackById('spazio').physics.gravity).toBeLessThan(0.6);
    expect(trackById('magma').physics.gravity).toBeGreaterThan(1);
  });

  it('dà due piste per round e tutte e otto sui quattro round', () => {
    for (const seed of [1, 42, 987654321]) {
      const rounds = Array.from({ length: BIGLIE_ROUNDS }, (_, index) => planRoundTracks(seed, index));
      expect(rounds.map((pair) => pair.length)).toEqual([2, 2, 2, 2]);
      const all = rounds.flat();
      expect(all).toHaveLength(TRACKS_PER_ROUND * BIGLIE_ROUNDS);
      expect(new Set(all).size).toBe(8);
    }
  });

  it('è deterministico: stesso seme, stesse coppie', () => {
    const first = Array.from({ length: BIGLIE_ROUNDS }, (_, index) => planRoundTracks(77, index));
    const second = Array.from({ length: BIGLIE_ROUNDS }, (_, index) => planRoundTracks(77, index));
    expect(second).toEqual(first);
  });

  it('riconosce i quattro round Biglie della scaletta', () => {
    // Round 11, 22, 28 e 37 (1-based) sono gli indici 10, 21, 27, 36.
    expect([10, 21, 27, 36].map((round) => biglieRoundSlot(round))).toEqual([0, 1, 2, 3]);
  });

  it('numera le gare da 1 a 8, due per ogni round', () => {
    expect(BIGLIE_RACES).toBe(8);
    expect(biglieRaceNumber(10, 0)).toBe(1);
    expect(biglieRaceNumber(10, 1)).toBe(2);
    expect(biglieRaceNumber(21, 0)).toBe(3);
    expect(biglieRaceNumber(27, 1)).toBe(6);
    expect(biglieRaceNumber(36, 1)).toBe(8);
  });

  it('assegna a ogni round di serata la sua coppia, senza ripetizioni', () => {
    const pairs = [10, 21, 27, 36].map((round) =>
      planRoundTracks(2026, biglieRoundSlot(round)),
    );
    expect(pairs.flat()).toHaveLength(BIGLIE_RACES);
    expect(new Set(pairs.flat()).size).toBe(BIGLIE_RACES);
  });
});
