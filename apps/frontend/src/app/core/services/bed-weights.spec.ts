import { describe, expect, it, vi } from 'vitest';

import { formatWeight, measureBeds } from './bed-weights';

describe('peso dei sottofondi', () => {
  it('scrive MB e KB come li legge la regia', () => {
    expect(formatWeight(1.6 * 1024 * 1024)).toBe('1,60 MB');
    expect(formatWeight(380 * 1024)).toBe('380 KB');
    expect(formatWeight('missing')).toBe('manca');
    expect(formatWeight('error')).toBe('n/d');
    expect(formatWeight(undefined)).toBe('…');
  });

  it('misura con una HEAD e segna i file che il server non ha', async () => {
    const doFetch = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('atto-1.m4a')
          ? { ok: true, headers: { get: () => String(1024 * 1024) } }
          : { ok: false, headers: { get: () => null } },
      ),
    );

    const weights = await measureBeds(
      ['loop/atto-1.m4a', 'loop/atto-2.m4a'],
      doFetch as unknown as typeof fetch,
    );

    expect(weights['loop/atto-1.m4a']).toBe(1024 * 1024);
    expect(weights['loop/atto-2.m4a']).toBe('missing');
    expect(doFetch).toHaveBeenCalledWith('assets/audio/loop/atto-1.m4a', { method: 'HEAD' });
  });

  it('una rete caduta non vale come file mancante', async () => {
    const weights = await measureBeds(
      ['loop/lobby.m4a'],
      vi.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch,
    );

    expect(weights['loop/lobby.m4a']).toBe('error');
  });
});
