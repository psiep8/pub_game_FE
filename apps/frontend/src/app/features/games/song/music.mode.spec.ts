import { vi } from 'vitest';

import { MusicMode } from './music.mode';
import { GAME_TIMINGS } from '../../../shared/models/game-timings';

const SONGS = [
  { title: 'Prima', artist: 'Artista A', year: '1990', previewUrl: '/a.m4a', albumCover: '/a.jpg' },
  { title: 'Seconda', artist: 'Artista B', year: '1995', previewUrl: '/b.m4a', albumCover: '/b.jpg' },
  { title: 'Terza', artist: 'Artista C', year: '2001', previewUrl: '/c.m4a', albumCover: '/c.jpg' },
  { title: 'Quarta', artist: 'Artista D', year: '2010', previewUrl: '/d.m4a', albumCover: '/d.jpg' },
  { title: 'Quinta', artist: 'Artista E', year: '2020', previewUrl: '/e.m4a', albumCover: '/e.jpg' },
];

const LISTEN_1 = GAME_TIMINGS.MUSIC.listenSeconds[0];
const LISTEN_2 = GAME_TIMINGS.MUSIC.listenSeconds[1];
const BUZZ = GAME_TIMINGS.MUSIC.buzzSeconds;
const REVEAL = GAME_TIMINGS.MUSIC.revealSeconds;

function createMode(checkpoints: any[] = [], ticks: number[] = []): MusicMode {
  let timerEnds = 0;
  const mode = new MusicMode();
  mode.setConfig({
    type: 'MUSIC',
    payload: {},
    gameId: 1,
    activePlayers: ['Anna', 'Bruno'],
    onTimerTick: (seconds: number) => ticks.push(seconds),
    onTvCheckpoint: (checkpoint: any) => checkpoints.push(checkpoint),
    onTimerEnd: () => { timerEnds++; },
  });
  mode.initialize({
    type: 'MUSIC',
    round: 2,
    theme: 'Rock',
    themes: ["Anni '70-'80", 'Rock', 'Pop'],
    songs: SONGS,
  });
  (mode as any).timerEnds = () => timerEnds;
  return mode;
}

/** Porta una manca fino al reveal, un pezzo di fase per volta. */
async function runToReveal(mode: MusicMode): Promise<void> {
  await vi.advanceTimersByTimeAsync(LISTEN_1 * 1000);
  await vi.advanceTimersByTimeAsync(BUZZ * 1000);
  await vi.advanceTimersByTimeAsync(LISTEN_2 * 1000);
  await vi.advanceTimersByTimeAsync(BUZZ * 1000);
}

describe('MusicMode — un round da cinque manche', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('primo ascolto da 4 secondi, poi la finestra di prenotazione a audio fermo', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    expect(mode.timerDuration).toBe(BUZZ);
    expect(mode.getDisplayData()).toMatchObject({
      manche: 1,
      mancheTotal: 5,
      listen: 1,
      phase: 'LISTEN',
      phaseSeconds: 4,
      audioPlaying: true,
      points: 200,
      round: 2,
      theme: 'Rock',
    });
    expect(mode.getTimerValue()).toBe(4);

    await vi.advanceTimersByTimeAsync(4000);
    expect(mode.getDisplayData()).toMatchObject({ phase: 'BUZZ', audioPlaying: false });
    expect(mode.getTimerValue()).toBe(5);
    expect(mode.canBuzz()).toBe(true);

    mode.cleanup();
  });

  it('il secondo ascolto riparte da zero e arriva a 12 secondi', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(5000);

    const second = mode.getDisplayData();
    expect(second).toMatchObject({ listen: 2, phase: 'LISTEN', phaseSeconds: 12, audioPlaying: true });
    expect(second.audioOffset).toBe(0);
    expect(mode.getTimerValue()).toBe(12);

    await vi.advanceTimersByTimeAsync(11_000);
    expect(mode.getTimerValue()).toBe(1);
    expect(mode.getDisplayData().phase).toBe('LISTEN');

    await vi.advanceTimersByTimeAsync(1000);
    expect(mode.getDisplayData()).toMatchObject({ phase: 'BUZZ', listen: 2 });
    expect(mode.canBuzz()).toBe(true);

    mode.cleanup();
  });

  it('dopo il reveal di 8 secondi parte la manca successiva', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    await runToReveal(mode);

    expect(mode.getDisplayData()).toMatchObject({ manche: 1, phase: 'REVEAL', revealed: true });
    expect(mode.getDisplayData().songTitle).toBe('Prima');
    expect(mode.getDisplayData().artist).toBe('Artista A');

    await vi.advanceTimersByTimeAsync(REVEAL * 1000);

    expect(mode.getDisplayData()).toMatchObject({ manche: 2, phase: 'LISTEN', listen: 1, revealed: false });
    expect(mode.getDisplayData().previewUrl).toBe('/b.m4a');
    expect(mode.getDisplayData().songTitle).toBe('');

    mode.cleanup();
  });

  it('alla fine della quinta manca il round si chiude: non parte un sesto brano', async () => {
    vi.useFakeTimers();
    const mode = createMode();
    const timerEnds = (mode as any).timerEnds as () => number;
    const seen: string[] = [];

    await mode.start();
    for (let manche = 1; manche <= 5; manche++) {
      expect(mode.getDisplayData().manche).toBe(manche);
      await runToReveal(mode);
      seen.push(String(mode.getDisplayData().songTitle));
      await vi.advanceTimersByTimeAsync(REVEAL * 1000);
    }

    expect(timerEnds()).toBe(1);
    expect(mode.getDisplayData()).toMatchObject({ manche: 5, phase: 'IDLE', revealed: true });

    // Nessuna sesta manca, nemmeno lasciando passare altro tempo.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mode.getDisplayData().manche).toBe(5);
    expect(timerEnds()).toBe(1);

    // Cinque soluzioni, cinque artisti diversi.
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual(['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta']);

    mode.cleanup();
  });

  it('sbagliare al primo ascolto non toglie punti e porta al secondo', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    await vi.advanceTimersByTimeAsync(4000);

    expect(mode.pointsFor(false, 0)).toBe(0);
    expect(mode.pointsFor(true, 0)).toBe(200);

    mode.handleBuzz('Anna');
    mode.confirmWrong('Anna');

    expect(mode.getDisplayData()).toMatchObject({ listen: 2, phase: 'LISTEN', buzzedPlayer: null });
    // Chi ha sbagliato non può riprenotarsi nella stessa manca.
    await vi.advanceTimersByTimeAsync(12_000);
    mode.handleBuzz('Anna');
    expect(mode.getDisplayData().buzzedPlayer).toBeNull();
    expect(mode.pointsFor(false, 0)).toBe(-50);

    mode.cleanup();
  });

  it('la conferma corretta apre subito il reveal pulito', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    await vi.advanceTimersByTimeAsync(4000);
    mode.handleBuzz('Bruno');
    mode.confirmCorrect('Bruno');

    expect(mode.getDisplayData()).toMatchObject({
      phase: 'REVEAL',
      revealed: true,
      audioPlaying: true,
      songTitle: 'Prima',
      phaseSeconds: 8,
    });

    mode.cleanup();
  });

  it('il checkpoint riprende round, manca e ascolto giusti', async () => {
    vi.useFakeTimers();
    const checkpoints: any[] = [];
    const mode = createMode(checkpoints);

    await mode.start();
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(3000);

    const saved = checkpoints.at(-1);
    expect(saved.state).toMatchObject({ round: 2, theme: 'Rock', manche: 1, listen: 2, phase: 'LISTEN' });

    vi.useRealTimers();
    const restored = createMode();
    restored.restore(0, {
      revision: 1,
      state: {
        round: 2,
        theme: 'Rock',
        manche: 3,
        listen: 2,
        phase: 'LISTEN',
        secondsLeft: 12,
        savedAt: Date.now() - 4000,
        wrongPlayers: ['Anna'],
        revealed: false,
      },
    });

    expect(restored.getDisplayData()).toMatchObject({
      round: 2,
      theme: 'Rock',
      manche: 3,
      listen: 2,
      phase: 'LISTEN',
      previewUrl: '/c.m4a',
    });
    expect(restored.getTimerValue()).toBe(8);

    restored.cleanup();
    mode.cleanup();
  });
});
