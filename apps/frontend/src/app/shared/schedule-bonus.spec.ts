import { BONUS_AFTER_ACT } from './schedule';
import { BONUS_LABELS, BONUS_TYPES } from './enums/bonus-type';
import { scoringRuleFor } from './models/scoring-rules';

describe('scaletta dei cinque bonus', () => {
  it('mette un bonus diverso dopo ognuno dei cinque atti', () => {
    expect(BONUS_TYPES).toEqual([
      'CASINO_COLOR',
      'BLACKJACK',
      'CASINO_DOZEN',
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
});
