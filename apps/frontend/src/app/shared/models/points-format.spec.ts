import { formatPoints } from './points-format';

describe('formatPoints', () => {
  it('mette il segno solo davanti ai numeri diversi da zero', () => {
    expect(formatPoints(200)).toBe('+200');
    expect(formatPoints(-200)).toBe('-200');
    expect(formatPoints(0)).toBe('0');
  });

  it('non produce mai il segno doppio', () => {
    for (const value of [-400, -200, 0, 200, 1200]) {
      expect(formatPoints(value)).not.toContain('+-');
      expect(formatPoints(value)).not.toContain('-+');
    }
  });

  it('tratta i valori mancanti come zero', () => {
    expect(formatPoints(null)).toBe('0');
    expect(formatPoints(undefined)).toBe('0');
  });
});
