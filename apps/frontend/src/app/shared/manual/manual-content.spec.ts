import { BONUS_TYPES } from '../enums/bonus-type';
import { scheduledModes } from '../schedule';
import { MANUAL_BONUSES, MANUAL_ENTRIES, MANUAL_GAMES, MANUAL_SECTIONS } from './manual-content';

describe('manual content', () => {
  it('has a card for every mode in the schedule', () => {
    const keys = MANUAL_GAMES.map((entry) => entry.key).sort();
    const expected = scheduledModes().sort();

    expect(keys).toEqual(expected);
  });

  it('has a card for every bonus', () => {
    const keys = MANUAL_BONUSES.map((entry) => entry.key).sort();

    expect(keys).toEqual(BONUS_TYPES.map((type) => `BONUS_${type}`).sort());
  });

  it('does not duplicate entries', () => {
    const keys = MANUAL_ENTRIES.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every score row tied to the real scoring rules', () => {
    for (const entry of MANUAL_ENTRIES) {
      expect(entry.scoring.correct.length).toBeGreaterThan(0);
      expect(entry.scoring.wrong.length).toBeGreaterThan(0);
      expect(entry.scoring.missed.length).toBeGreaterThan(0);
      expect(entry.scoring.note.length).toBeGreaterThan(0);
    }
  });

  it('writes the real numbers in the generated general sections', () => {
    const lines = MANUAL_SECTIONS.flatMap((section) => section.lines).join(' ');

    expect(lines).toContain('40 round');
    expect(lines).toContain('5 atti da 8');
    expect(lines).toContain('Dopo gli atti 1–4');
  });
});
