import { vi } from 'vitest';

import { MusicMode } from './music.mode';

function createMode(ticks: number[] = [], checkpoints: any[] = []): MusicMode {
  const mode = new MusicMode();
  mode.setConfig({
    type: 'MUSIC',
    payload: {},
    gameId: 1,
    activePlayers: ['Anna'],
    onTimerTick: (seconds: number) => ticks.push(seconds),
    onTvCheckpoint: (checkpoint: any) => checkpoints.push(checkpoint),
  });
  mode.initialize({
    songTitle: 'Canzone',
    artist: 'Artista',
    previewUrl: 'https://audio.example/brano.mp3',
  });
  return mode;
}

describe('MusicMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('conta trenta secondi per manche, non un unico conto da duecento', async () => {
    vi.useFakeTimers();
    const ticks: number[] = [];
    const mode = createMode(ticks);

    await mode.start();

    expect(mode.timerDuration).toBe(30);
    expect(mode.getTimerValue()).toBe(30);
    expect(ticks.at(-1)).toBe(30);

    await vi.advanceTimersByTimeAsync(3000);
    expect(mode.getTimerValue()).toBe(27);

    mode.cleanup();
  });

  it('alla conferma corretta fa partire subito il brano pulito, senza intro filtrata', async () => {
    const mode = createMode();
    await mode.start();
    mode.handleBuzz('Anna');

    mode.confirmCorrect('Anna');

    const data = mode.getDisplayData();
    expect(data.revealed).toBe(true);
    expect(data.fullPlayback).toBe(true);
    expect(data.currentPhase).toBe(4);
    expect(data.audioPlaying).toBe(true);

    mode.cleanup();
  });

  it('paga in proporzione ai secondi rimasti e non scende sotto 250', async () => {
    vi.useFakeTimers();
    const mode = createMode();

    await mode.start();
    // Con tutta la manche davanti il brano vale il massimo.
    expect(mode.pointsFor(true, 0)).toBe(1000);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mode.pointsFor(true, 15_000)).toBe(500);

    // All'ultimo secondo resta il minimo garantito.
    await vi.advanceTimersByTimeAsync(14_000);
    expect(mode.pointsFor(true, 29_000)).toBe(250);

    expect(mode.pointsFor(false, 15_000)).toBe(-1000);

    mode.cleanup();
  });

  describe('ripresa dopo un refresh della TV', () => {
    it('salva la manche appena parte con i secondi pieni', async () => {
      const checkpoints: any[] = [];
      const mode = createMode([], checkpoints);

      await mode.start();

      const state = checkpoints.at(-1)?.state;
      expect(state.manche).toBe(1);
      expect(state.secondsLeft).toBe(30);
      expect(state.revealed).toBe(false);
      expect(state.waitingForStart).toBe(false);

      mode.cleanup();
    });

    it('riprende la manche in corso con il tempo che resta', () => {
      vi.useFakeTimers();
      const mode = createMode();

      mode.restore(30, {
        revision: 1,
        state: { manche: 2, secondsLeft: 30, savedAt: Date.now() - 12_000 },
      });

      expect(mode.getTimerValue()).toBe(18);
      expect(mode.getDisplayData().currentPhase).toBe(2);
      expect(mode.getDisplayData().audioPlaying).toBe(true);
      expect(mode.canBuzz()).toBe(true);

      mode.cleanup();
    });

    it('a fine ascolto si ferma in attesa della manche successiva', async () => {
      vi.useFakeTimers();
      const mode = createMode();

      mode.restore(30, {
        revision: 2,
        state: { manche: 1, secondsLeft: 20, savedAt: Date.now() },
      });

      await vi.advanceTimersByTimeAsync(20_000);

      expect(mode.getDisplayData().waitingForStart).toBe(true);
      expect(mode.getDisplayData().audioPlaying).toBe(false);

      mode.cleanup();
    });

    it('riprende la pausa fra due manche e poi passa alla successiva', async () => {
      vi.useFakeTimers();
      const mode = createMode();

      mode.restore(0, {
        revision: 3,
        state: {
          manche: 2,
          secondsLeft: 0,
          savedAt: Date.now(),
          waitingForStart: true,
          waitingSeconds: 4,
        },
      });

      expect(mode.getDisplayData().waitingForStart).toBe(true);

      await vi.advanceTimersByTimeAsync(4000);

      expect(mode.getDisplayData().currentPhase).toBe(3);
      expect(mode.getDisplayData().waitingForStart).toBe(false);

      mode.cleanup();
    });

    it('un brano già rivelato resta pagato e mostra il brano pulito', () => {
      const mode = createMode();

      mode.restore(0, {
        revision: 4,
        state: {
          manche: 4,
          secondsLeft: 0,
          savedAt: Date.now(),
          revealed: true,
          fullPlayback: true,
        },
      });

      const data = mode.getDisplayData();
      expect(data.revealed).toBe(true);
      expect(data.fullPlayback).toBe(true);
      expect(data.audioPlaying).toBe(false);
      expect(mode.getTimerValue()).toBe(0);
      expect(mode.canBuzz()).toBe(false);

      mode.cleanup();
    });

    it('con una prenotazione in corso non riparte il cronometro', async () => {
      vi.useFakeTimers();
      const mode = createMode();

      mode.restore(30, {
        revision: 5,
        state: { manche: 3, secondsLeft: 24, savedAt: Date.now(), buzzedPlayer: 'Anna' },
      });

      expect(mode.getDisplayData().buzzedPlayer).toBe('Anna');
      expect(mode.getTimerValue()).toBe(24);

      await vi.advanceTimersByTimeAsync(5000);

      expect(mode.getTimerValue()).toBe(24);

      mode.cleanup();
    });

    it('senza manche salvata non tocca il round', () => {
      const mode = createMode();

      mode.restore(30, { revision: 6, state: { secondsLeft: 12 } });

      expect(mode.getDisplayData().currentPhase).toBe(0);
      expect(mode.getTimerValue()).toBe(30);

      mode.cleanup();
    });
  });
});
