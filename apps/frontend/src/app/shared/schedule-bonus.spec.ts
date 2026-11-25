import {
  BONUS_AFTER_ACT,
  BONUS_ROUND_SLOTS,
  bonusForRound,
  planBonusSlots,
  ROUNDS_PER_ACT,
} from './schedule';
import { BONUS_LABELS, BONUS_TYPES } from './enums/bonus-type';
import { scoringRuleFor } from './models/scoring-rules';

describe('scaletta dei cinque bonus', () => {
  it('mette un bonus diverso dopo ognuno dei cinque atti', () => {
    expect(BONUS_TYPES).toEqual([
      'KARAOKE',
      'BLACKJACK',
      'CASINO_FIVE',
      'CAVALLO',
      'CASINO_NUMBER',
    ]);
    expect(BONUS_AFTER_ACT).toEqual(BONUS_TYPES);
  });

  it('ha un’etichetta per ogni bonus', () => {
    for (const type of BONUS_TYPES) {
      expect(BONUS_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('ha una regola di punteggio per ogni bonus', () => {
    for (const type of BONUS_TYPES) {
      const rule = scoringRuleFor(`BONUS_${type}`);
      expect(rule, `regola mancante per ${type}`).not.toBeNull();
      expect(rule?.correct.length).toBeGreaterThan(0);
    }
  });

  it('sparge i bonus nei round degli atti, mai in apertura né a fine atto', () => {
    for (const seed of [1, 42, 123456789, 0xffffffff]) {
      const slots = planBonusSlots(seed);
      expect(slots.map((slot) => slot.type)).toEqual(BONUS_TYPES);
      expect(slots.map((slot) => slot.act)).toEqual([0, 1, 2, 3, 4]);

      for (const slot of slots) {
        const local = slot.round - slot.act * ROUNDS_PER_ACT;
        expect(BONUS_ROUND_SLOTS).toContain(local);
        expect(local).toBeGreaterThan(1);
        expect(local).toBeLessThan(ROUNDS_PER_ACT);
      }
    }
  });

  it('lo stesso seme ridà la stessa serata, semi diversi spostano i bonus', () => {
    const plan = planBonusSlots(7);
    expect(planBonusSlots(7)).toEqual(plan);

    const rounds = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(planBonusSlots(seed).map((slot) => slot.round))),
    );
    expect(rounds.size).toBeGreaterThan(1);
  });

  it('trova il bonus solo dopo il round che lo ospita', () => {
    const slots = planBonusSlots(99);
    for (const slot of slots) {
      expect(bonusForRound(slots, slot.round)?.type).toBe(slot.type);
      expect(bonusForRound(slots, slot.round + 1)).toBeNull();
    }
  });
});
