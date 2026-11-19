import { describe, expect, it } from 'vitest';

import {
  alongFactor,
  buildFeatures,
  featuresAt,
  lateralPush,
  oneShotAt,
  PERNI_FACTOR,
} from './track-features';
import { buildTrack } from './track-geometry';
import { TRACK_CATALOG } from './track-plan';

const SEED = 2026;

function geometryFor(trackId: (typeof TRACK_CATALOG)[number]['id']) {
  const track = TRACK_CATALOG.find((entry) => entry.id === trackId)!;
  return {
    track,
    geometry: buildTrack(SEED, {
      width: 220,
      length: 12000,
      startX: 140,
      profile: track.geometry,
    }),
  };
}

describe('interazioni della pista', () => {
  it('sono deterministiche: stesso fondo e stesso seme, stesse interazioni', () => {
    for (const track of TRACK_CATALOG) {
      const { geometry } = geometryFor(track.id);
      expect(buildFeatures(track.id, SEED, geometry)).toEqual(
        buildFeatures(track.id, SEED, geometry),
      );
    }
  });

  it('nascono dai pezzi: rampe e perni solo dove il fondo li ha', () => {
    for (const track of TRACK_CATALOG) {
      const { geometry } = geometryFor(track.id);
      const features = buildFeatures(track.id, SEED, geometry);
      const kinds = new Set(features.map((feature) => feature.kind));

      expect(kinds.has('rampa')).toBe(track.geometry.deck.includes('rampa'));
      expect(kinds.has('perni')).toBe(track.geometry.deck.includes('perni'));

      const attrito = features.filter((feature) => feature.kind === 'attrito').length;
      const narrowing = geometry.pieces.filter(
        (piece) => piece.kind === 'strettoia' || piece.kind === 'imbuto',
      ).length;
      expect(attrito).toBe(narrowing);
    }
  });

  it('mette due correnti per gara, dentro la pista e una per lato', () => {
    for (const track of TRACK_CATALOG) {
      const { geometry } = geometryFor(track.id);
      const currents = buildFeatures(track.id, SEED, geometry).filter(
        (feature) => feature.kind === 'corrente',
      );

      expect(currents).toHaveLength(2);
      expect(currents.map((feature) => feature.side).sort()).toEqual([-1, 1]);
      for (const current of currents) {
        expect(current.progress).toBeGreaterThan(0.1);
        expect(current.progress).toBeLessThan(0.95);
        expect(current.strength).toBeGreaterThan(0);
        expect(current.strength).toBeLessThanOrEqual(1);
      }
    }
  });

  it('l\u2019attrito frena, la rampa spinge, altrove non cambia nulla', () => {
    const { geometry } = geometryFor('sabbia');
    const features = buildFeatures('sabbia', SEED, geometry);
    const attrito = features.find((feature) => feature.kind === 'attrito')!;

    expect(alongFactor(features, attrito.progress)).toBeLessThan(1);
    expect(alongFactor(features, 0.5)).toBeGreaterThan(0);

    const { geometry: f1 } = geometryFor('f1');
    const ramp = buildFeatures('f1', SEED, f1).find((feature) => feature.kind === 'rampa')!;
    expect(alongFactor(ramp ? buildFeatures('f1', SEED, f1) : [], ramp.progress)).toBeGreaterThan(1);
  });

  it('la corrente spinge di lato solo dentro la corrente', () => {
    const { geometry } = geometryFor('acqua');
    const features = buildFeatures('acqua', SEED, geometry);
    const current = features.find((feature) => feature.kind === 'corrente')!;

    expect(lateralPush(features, 0)).toBe(0);
    const push = lateralPush(features, current.progress);
    expect(Math.sign(push)).toBe(current.side);
    expect(Math.abs(push)).toBeLessThanOrEqual(0.42);
  });

  it('rampe e perni si sentono una volta sola per biglia', () => {
    const { geometry } = geometryFor('f1');
    const features = buildFeatures('f1', SEED, geometry);
    const ramp = features.find((feature) => feature.kind === 'rampa');
    if (!ramp) return;

    const seen = new Set<string>();
    const first = oneShotAt(features, ramp.progress, seen);
    expect(first?.id).toBe(ramp.id);

    seen.add(ramp.id);
    expect(oneShotAt(features, ramp.progress, seen)).toBeNull();

    // I perni costano come un ostacolo piccolo, non come un muro.
    expect(PERNI_FACTOR).toBeLessThan(1);
    expect(featuresAt(features, ramp.progress).length).toBeGreaterThan(0);
  });
});
