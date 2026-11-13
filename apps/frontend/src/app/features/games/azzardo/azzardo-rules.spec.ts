import {
  AZZARDO_MAX_CHIPS_PER_MANCHE,
  AZZARDO_MAX_WIN_PER_MANCHE,
  AZZARDO_MIN_BANK,
  bankFor,
  chipCapFor,
  chipsBreakdown,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  maxChipsFor,
  oddsForLevel,
} from './azzardo-rules';

describe('tetto di fiches per manche', () => {
  it('parte da dieci e cresce con le fiches avanzate, fino al massimo dichiarato', () => {
    expect(chipCapFor(10)).toBe(10);
    expect(chipCapFor(17)).toBe(13);
    expect(chipCapFor(20)).toBe(15);
    expect(chipCapFor(30)).toBe(AZZARDO_MAX_CHIPS_PER_MANCHE);
  });

  it('resta dentro il salvadanaio e il credito in punti', () => {
    expect(maxChipsFor(17, 5000)).toBe(13);
    expect(maxChipsFor(3, 5000)).toBe(3);
    expect(maxChipsFor(10, 50)).toBe(2);
    expect(maxChipsFor(0, 5000)).toBe(0);
  });

  it('la manche non paga più del tetto di vincita', () => {
    const top = chipsBreakdown({
      chips: [15, 0, 0, 0],
      answerIndex: 0,
      level: 3,
      manche: 0,
      available: 5000,
    });

    // 15 × 20 × 4 farebbe 1200: il tetto lo taglia a 1000.
    expect(top.win).toBe(AZZARDO_MAX_WIN_PER_MANCHE);
    expect(top.points).toBe(AZZARDO_MAX_WIN_PER_MANCHE);
  });
});

describe('fiches → punti', () => {
  const input = (chips: number[], manche = 0, available = 1000) => ({
    chips,
    answerIndex: 1,
    level: 1 as const,
    manche,
    available,
  });

  it('paga le fiches giuste con la quota e taglia le sbagliate con la manche', () => {
    // Tre fiches sulla B (giusta) e due sulla A: +120, poi −40 al 100%.
    const first = chipsBreakdown(input([2, 3, 0, 0]));
    expect(first).toMatchObject({
      totalChips: 5, stake: 100, correctChips: 3, wrongChips: 2,
      odds: 2, lossPercent: 100, win: 120, loss: 40, points: 80,
    });

    // Stessa distribuzione alla terza manche: la perdita scende al 60%.
    expect(chipsBreakdown(input([2, 3, 0, 0], 2))).toMatchObject({ loss: 24, points: 96 });
  });

  it('la perdita non supera mai i punti posseduti', () => {
    expect(chipsBreakdown(input([10, 0, 0, 0], 0, 60))).toMatchObject({ loss: 60, points: -60 });
    expect(chipsBreakdown(input([10, 0, 0, 0], 0, 0))).toMatchObject({ loss: 0, points: 0 });
  });

  it('chi non mette fiches non muove la classifica', () => {
    expect(chipsBreakdown(input([0, 0, 0, 0]))).toMatchObject({ totalChips: 0, win: 0, loss: 0, points: 0 });
  });

  it('il banco dà un credito di manche a chi ha zero punti', () => {
    expect(bankFor(0)).toBe(AZZARDO_MIN_BANK);
    expect(bankFor(120)).toBe(AZZARDO_MIN_BANK);
    expect(bankFor(900)).toBe(900);
    expect(maxBetFor(bankFor(0))).toBe(300);
  });
});

describe('livelli e quote', () => {
  it('tre passaggi nella serata, difficoltà crescente', () => {
    expect(levelForOccurrence(1)).toBe(1);
    expect(levelForOccurrence(2)).toBe(2);
    expect(levelForOccurrence(3)).toBe(3);
    expect(levelForOccurrence(4)).toBe(3);
  });

  it('la quota è 2, 3 e 4', () => {
    expect(oddsForLevel(1)).toBe(2);
    expect(oddsForLevel(2)).toBe(3);
    expect(oddsForLevel(3)).toBe(4);
  });

  it('la perdita scende dal 100% al 40%', () => {
    expect(lossMultiplierFor(0)).toBe(1);
    expect(lossMultiplierFor(1)).toBe(0.8);
    expect(lossMultiplierFor(2)).toBe(0.6);
    expect(lossMultiplierFor(3)).toBe(0.4);
    expect(lossMultiplierFor(9)).toBe(0.4);
  });
});

describe('credito di puntata', () => {
  it('non supera i punti posseduti né il massimo di 300', () => {
    expect(maxBetFor(80)).toBe(80);
    expect(maxBetFor(999)).toBe(300);
    expect(maxBetFor(-5)).toBe(0);
  });
});
