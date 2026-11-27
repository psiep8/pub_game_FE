import { vi } from 'vitest';
import { ImageBlurMode } from './image-blur.mode';

describe('ImageBlurMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('svela un indizio ogni quindici secondi, con il contatore che avanza', async () => {
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

    await vi.advanceTimersByTimeAsync(15000);
    expect(mode.getDisplayData().clue).toBe('premio Oscar');
    expect(mode.getDisplayData().clueIndex).toBe(2);

    await vi.advanceTimersByTimeAsync(15000);
    expect(mode.getDisplayData().clue).toBe('nata a Roma');
    expect(mode.getDisplayData().clueIndex).toBe(3);

    mode.cleanup();
  });

  it('porta le misure della foto nei dati della TV, zero se mancano', () => {
    const mode = new ImageBlurMode();
    mode.setConfig({ type: 'IMAGE_BLUR', payload: {}, gameId: 1, activePlayers: ['Anna'] });
    mode.initialize({
      imageUrl: 'https://image.example/brando.jpg',
      correctAnswer: 'Marlon Brando',
      imageWidth: 330,
      imageHeight: 455,
    });

    expect(mode.getDisplayData().imageWidth).toBe(330);
    expect(mode.getDisplayData().imageHeight).toBe(455);

    const senzaMisure = new ImageBlurMode();
    senzaMisure.setConfig({ type: 'IMAGE_BLUR', payload: {}, gameId: 1, activePlayers: ['Anna'] });
    senzaMisure.initialize({ imageUrl: 'x', correctAnswer: 'A' });

    expect(senzaMisure.getDisplayData().imageWidth).toBe(0);
    expect(senzaMisure.getDisplayData().imageHeight).toBe(0);
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

  it('dura quarantacinque secondi per manche', () => {
    const mode = new ImageBlurMode();

    expect(mode.timerDuration).toBe(45);
  });

  it('tre manche, una per ambito, con punti diversi e il telefono che si riarma', () => {
    vi.useFakeTimers();
    const manches = [
      { manche: 1, ambto: 1, categoryLabel: 'Storia, Arte, Scienza, Letteratura', points: 333, correctAnswer: 'Einstein', imageUrl: '/a.jpg', clues: ['fisico tedesco'] },
      { manche: 2, ambto: 2, categoryLabel: 'Musica', points: 333, correctAnswer: 'Mina', imageUrl: '/b.jpg', clues: ['cantante italiana'] },
      { manche: 3, ambto: 3, categoryLabel: 'Sport, Cinema, TV, Spettacolo', points: 334, correctAnswer: 'Sophia Loren', imageUrl: '/c.jpg', clues: ['attrice italiana'] },
    ];
    const mode = new ImageBlurMode();
    mode.setConfig({ type: 'IMAGE_BLUR', payload: { manches }, gameId: 1, activePlayers: ['Anna'] });
    mode.initialize({ manches });

    expect(mode.getDisplayData()).toMatchObject({
      manche: 1, mancheTotal: 3, categoryLabel: 'Storia, Arte, Scienza, Letteratura', manchePoints: 333,
    });
    expect(mode.hasNextManche()).toBe(true);
    expect(mode.pointsFor(true, 0)).toBe(333);

    mode.nextManche();
    expect(mode.getDisplayData()).toMatchObject({ manche: 2, categoryLabel: 'Musica', manchePoints: 333 });
    expect(mode.pointsFor(true, 0)).toBe(333);

    mode.nextManche();
    expect(mode.getDisplayData()).toMatchObject({ manche: 3, categoryLabel: 'Sport, Cinema, TV, Spettacolo', manchePoints: 334 });
    expect(mode.hasNextManche()).toBe(false);

    mode.cleanup();
  });

  it('scala i punti della manche sul tempo rimasto', () => {
    const mode = new ImageBlurMode();
    const manches = [{ manche: 1, points: 333, correctAnswer: 'Einstein', clues: ['fisico'] }];
    mode.setConfig({ type: 'IMAGE_BLUR', payload: { manches }, gameId: 1 });
    mode.initialize({ manches });

    expect(mode.pointsFor(true, 22_500)).toBe(167);
    expect(mode.pointsFor(false, 22_500)).toBe(-167);

    mode.cleanup();
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

    await vi.advanceTimersByTimeAsync(15000);
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

    mode.restore(45, { revision: 9, state: { blurElapsedSeconds: 'x', clueIndex: null } });

    const data = mode.getDisplayData();
    expect(data.blurAmount).toBe(40);
    expect(data.clueIndex).toBe(1);

    mode.cleanup();
  });
});

describe('ImageBlurMode — la domanda apre e chiude il sottofondo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('chiude al buzz e riapre se la risposta è sbagliata', async () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const payload = {
      imageUrl: 'https://image.example/sophia.jpg',
      correctAnswer: 'Sophia Loren',
      clues: ['attrice italiana'],
    };
    const mode = new ImageBlurMode();
    mode.setConfig({
      type: 'IMAGE_BLUR',
      payload,
      gameId: 1,
      activePlayers: ['Anna'],
      onQuestionOpenChange: (open) => changes.push(open),
    });
    mode.initialize(payload);

    await mode.start();
    expect(changes).toEqual([true]);

    // Prenotazione: da qui si risponde, la base d'atto torna piena.
    mode.handleBuzz('Anna');
    expect(changes).toEqual([true, false]);

    // Risposta sbagliata: il round riprende e la domanda è di nuovo aperta.
    mode.confirmWrong('Anna');
    expect(changes).toEqual([true, false, true]);

    mode.cleanup();
  });
});
