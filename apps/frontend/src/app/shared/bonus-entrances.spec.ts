import { describe, expect, it } from 'vitest';
import { AUDIO_EVENTS } from '../core/services/audio-catalog';
import { BONUS_TYPES } from './enums/bonus-type';
import {
  BONUS_ENTRANCE_POOL,
  bonusEntranceFor,
  planBonusEntrances,
} from './bonus-entrances';

describe('bonus a sorpresa', () => {
  it('il pool ha almeno dieci ingressi e ogni bonus ne ha più di uno', () => {
    expect(BONUS_ENTRANCE_POOL.length).toBeGreaterThanOrEqual(10);
    for (const type of BONUS_TYPES) {
      const variants = BONUS_ENTRANCE_POOL.filter((entry) => entry.type === type);
      expect(variants.length, `${type} senza sorprese`).toBeGreaterThanOrEqual(2);
    }
  });

  it('gli id sono unici e ogni ingresso usa un suono del catalogo', () => {
    const ids = BONUS_ENTRANCE_POOL.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of BONUS_ENTRANCE_POOL) {
      const sound = AUDIO_EVENTS[entry.sound as keyof typeof AUDIO_EVENTS];
      expect(sound, `${entry.id} usa un suono inesistente`).toBeTruthy();
      if (entry.variant !== undefined) {
        expect(sound.variants ?? 1).toBeGreaterThan(entry.variant);
      }
    }
  });

  it('il piano è stabile e copre tutti e cinque i bonus', () => {
    const plan = planBonusEntrances(4321);
    expect(Object.keys(plan).sort()).toEqual([...BONUS_TYPES].sort());
    for (const type of BONUS_TYPES) {
      expect(plan[type].type).toBe(type);
      expect(bonusEntranceFor(type, 4321).id).toBe(plan[type].id);
    }
    expect(planBonusEntrances(4321)).toEqual(plan);
  });

  it('nella stessa partita i cinque ingressi sono tutti diversi', () => {
    const ids = BONUS_TYPES.map((type) => bonusEntranceFor(type, 99).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('semi diversi cambiano almeno qualche ingresso', () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, seed) =>
        BONUS_TYPES.map((type) => bonusEntranceFor(type, seed).id).join('|'))
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
