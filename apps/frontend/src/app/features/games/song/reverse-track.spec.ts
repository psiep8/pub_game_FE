import { describe, expect, it } from 'vitest';

import { REVERSE_RATE, reverseChannels } from './reverse-track';

describe('brano al contrario', () => {
  it('rovescia ogni canale in place', () => {
    const left = Float32Array.from([1, 2, 3]);
    const right = Float32Array.from([4, 5, 6]);
    const buffer = {
      numberOfChannels: 2,
      getChannelData: (channel: number) => (channel === 0 ? left : right),
    };

    reverseChannels(buffer);

    expect([...left]).toEqual([3, 2, 1]);
    expect([...right]).toEqual([6, 5, 4]);
  });

  it('gira appena sotto la velocità naturale', () => {
    expect(REVERSE_RATE).toBeLessThan(1);
    expect(REVERSE_RATE).toBeGreaterThan(0.9);
  });
});
