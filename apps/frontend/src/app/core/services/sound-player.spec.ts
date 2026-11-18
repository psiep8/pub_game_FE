import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AudioEngine } from './audio-engine';
import { SoundPlayer } from './sound-player';

/**
 * Il precaricamento dei sottofondi è best-effort: il file dell'atto che non è
 * ancora in cartella prende un 404, e quel 404 si ricorda. Senza la memoria il
 * file tornava a bussare a ogni round di tutta la serata.
 */
function player(): SoundPlayer {
  const engine = {
    context: () => ({ decodeAudioData: vi.fn() }),
    room: () => undefined,
    out: () => undefined,
  } as unknown as AudioEngine;
  return new SoundPlayer(engine, () => true);
}

/** Lascia girare la catena di promise del precaricamento. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('SoundPlayer — precaricamento dei sottofondi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('un 404 non si ripete a ogni richiesta di precaricamento', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const audio = player();

    audio.warmBed('loop/atto-3.m4a');
    await flush();
    audio.warmBed('loop/atto-3.m4a');
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('assets/audio/loop/atto-3.m4a');
  });

  it('un file già in memoria non viene richiesto di nuovo', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const audio = player();

    audio.warmBed('loop/gioco-bomba.m4a');
    await flush();
    audio.warmBed('loop/gioco-bomba.m4a');
    audio.warmBed('loop/gioco-bomba.m4a');
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
