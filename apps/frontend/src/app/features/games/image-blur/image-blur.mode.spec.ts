import { vi } from 'vitest';
import { ImageBlurMode } from './image-blur.mode';

describe('ImageBlurMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('svela un indizio ogni sei secondi', async () => {
    vi.useFakeTimers();

    const mode = new ImageBlurMode();
    mode.setConfig({
      type: 'IMAGE_BLUR',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
    });
    mode.initialize({
      imageUrl: 'https://image.example/sophia.jpg',
      correctAnswer: 'Sophia Loren',
      clues: ['attrice italiana', 'premio Oscar', 'nata a Roma'],
    });

    await mode.start();

    const first = mode.getDisplayData();
    expect(first.clue).toBe('attrice italiana');
    expect(first.clueIndex).toBe(1);
    expect(first.clueTotal).toBe(3);

    await vi.advanceTimersByTimeAsync(6000);
    expect(mode.getDisplayData().clue).toBe('premio Oscar');

    await vi.advanceTimersByTimeAsync(6000);
    expect(mode.getDisplayData().clue).toBe('nata a Roma');

    mode.cleanup();
  });

  it('toglie più sfocatura nei primi secondi, senza svelare subito', async () => {
    vi.useFakeTimers();

    const mode = new ImageBlurMode();
    mode.setConfig({
      type: 'IMAGE_BLUR',
      payload: {},
      gameId: 1,
      activePlayers: ['Anna'],
    });
    mode.initialize({
      imageUrl: 'https://image.example/sophia.jpg',
      correctAnswer: 'Sophia Loren',
      clues: ['attrice italiana'],
    });

    await mode.start();
    expect(mode.getDisplayData().blurAmount).toBe(40);

    await vi.advanceTimersByTimeAsync(10000);
    const early = mode.getDisplayData().blurAmount;
    expect(early).toBeLessThan(30);
    expect(early).toBeGreaterThan(20);

    await vi.advanceTimersByTimeAsync(50000);
    expect(mode.getDisplayData().blurAmount).toBe(0);

    mode.cleanup();
  });

  it('dura sessanta secondi, non trenta', () => {
    const mode = new ImageBlurMode();

    expect(mode.timerDuration).toBe(60);
  });
});

describe('ImageBlurMode — ripresa dopo un refresh della TV', () => {
  const payload = {
    imageUrl: 'https://image.example/sophia.jpg',
    correctAnswer: 'Sophia Loren',
    clues: ['attrice italiana', 'premio Oscar', 'nata a Roma', 'ha fatto coppia con Mastroianni'],
  };

  function setup() {
    const saved: Array<{ type: string; revision: number; state: any }> = [];
    const mode = new ImageBlurMode();
    mode.setConfig({
      type: 'IMAGE_BLUR',
      payload,
      gameId: 1,
      activePlayers: ['Anna'],
      onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
    });
    mode.initialize(payload);
    return { mode, saved };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('salva il punto della sfocatura e l’indizio raggiunto', async () => {
    vi.useFakeTimers();
    const { mode, saved } = setup();

    await mode.start();
    expect(saved.at(-1)?.state).toMatchObject({ blurElapsedSeconds: 0, clueIndex: 0 });

    await vi.advanceTimersByTimeAsync(6000);
    expect(saved.at(-1)?.state).toMatchObject({ clueIndex: 1 });
    expect(saved.at(-1)?.state.blurElapsedSeconds).toBeGreaterThan(0);

    mode.cleanup();
  });

  it('riprende dal punto salvato, non dall’inizio', () => {
    const { mode } = setup();

    mode.restore(40, {
      revision: 7,
      state: { blurElapsedSeconds: 8, clueIndex: 1, savedAt: Date.now() },
    });

    const data = mode.getDisplayData();
    expect(data.blurAmount).toBeLessThan(40);
    expect(data.blurAmount).toBeGreaterThan(0);
    expect(data.clueIndex).toBe(2);
    expect(data.clue).toBe('premio Oscar');
    expect(data.correctAnswer).toBeNull();
    expect(mode.getTimerValue()).toBe(40);
    expect(mode.canBuzz()).toBe(true);

    mode.cleanup();
  });

  it('col tempo passato dal salvataggio la sfocatura va avanti', () => {
    const { mode } = setup();

    mode.restore(30, {
      revision: 8,
      state: { blurElapsedSeconds: 10, clueIndex: 1, savedAt: Date.now() - 20_000 },
    });

    const data = mode.getDisplayData();
    expect(data.blurAmount).toBeLessThan(30);
    expect(data.clueIndex).toBeGreaterThanOrEqual(3);

    mode.cleanup();
  });

  it('senza stato utile riparte dall’inizio, senza errori', () => {
    const { mode } = setup();

    mode.restore(60, { revision: 9, state: { blurElapsedSeconds: 'x', clueIndex: null } });

    const data = mode.getDisplayData();
    expect(data.blurAmount).toBe(40);
    expect(data.clueIndex).toBe(1);

    mode.cleanup();
  });
});
