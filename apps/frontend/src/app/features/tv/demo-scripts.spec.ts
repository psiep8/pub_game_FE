import { BONUS_TYPES } from '../../shared/enums/bonus-type';
import { scoringRuleFor } from '../../shared/models/scoring-rules';
import { scheduledModes } from '../../shared/schedule';
import { DEMO_ORDER, DEMO_SCRIPTS, demoScriptFor } from './demo-scripts';

describe('demo scripts', () => {
  it('covers the intro, every scheduled mode and every bonus', () => {
    const expected = ['INTRO', ...scheduledModes(), ...BONUS_TYPES.map((type) => `BONUS_${type}`)];

    expect([...DEMO_ORDER].sort()).toEqual([...expected].sort());
    for (const key of expected) {
      expect(demoScriptFor(key), `demo mancante: ${key}`).not.toBeNull();
    }
  });

  it('does not repeat a demo in the recommended order', () => {
    expect(new Set(DEMO_ORDER).size).toBe(DEMO_ORDER.length);
  });

  it('shows between four and six scenes for every demo', () => {
    for (const [key, script] of Object.entries(DEMO_SCRIPTS)) {
      expect(script.scenes.length, key).toBeGreaterThanOrEqual(4);
      expect(script.scenes.length, key).toBeLessThanOrEqual(6);
    }
  });

  it('reads every score row from SCORING_RULES', () => {
    for (const [key, script] of Object.entries(DEMO_SCRIPTS)) {
      if (script.kind === 'INTRO') {
        expect(script.scoring).toEqual([]);
        continue;
      }

      const rule = scoringRuleFor(key);
      expect(rule, `regola mancante: ${key}`).not.toBeNull();
      expect(script.scoring, key).toEqual([
        { label: 'Corretto', value: rule!.correct, tone: 'good' },
        { label: 'Sbagliato', value: rule!.wrong, tone: 'bad' },
        { label: 'Non risposta', value: rule!.missed, tone: 'neutral' },
      ]);
    }
  });

  it('has a real example scene in every game and bonus demo', () => {
    for (const script of Object.values(DEMO_SCRIPTS)) {
      if (script.kind === 'INTRO') continue;

      expect(script.scenes[4].kicker).toBe('ESEMPIO');
      expect(script.scenes[4].lines.length).toBeGreaterThan(0);
    }
  });
});
