import {
  AZZARDO_BETS,
  AZZARDO_MAX_CHIPS_PER_MANCHE,
  AZZARDO_MAX_WIN_PER_MANCHE,
  AZZARDO_MIN_BANK,
  bankFor,
  chipCapFor,
  chipsBreakdown,
  clampAzzardoBet,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  maxChipsFor,
  oddsForLevel,
  settleManche,
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

describe('puntata', () => {
  it('accetta 100, 200 e 300', () => {
    for (const stake of AZZARDO_BETS) {
      expect(clampAzzardoBet(stake, 1000)).toBe(stake);
    }
  });

  it('non punta più dei punti posseduti', () => {
    expect(clampAzzardoBet(300, 250)).toBe(250);
    expect(clampAzzardoBet(200, 0)).toBe(0);
    expect(clampAzzardoBet(100, 40)).toBe(40);
    expect(maxBetFor(80)).toBe(80);
    expect(maxBetFor(999)).toBe(300);
    expect(maxBetFor(-5)).toBe(0);
  });

  it('con una scelta non valida parte dal minimo possibile', () => {
    expect(clampAzzardoBet(Number.NaN, 500)).toBe(100);
    expect(clampAzzardoBet(150, 500)).toBe(100);
    expect(clampAzzardoBet(150, 30)).toBe(30);
  });
});

describe('settleManche', () => {
  it('vincita = puntata × quota', () => {
    expect(settleManche({ stake: 200, correct: true, level: 1, manche: 0, available: 1000 })).toBe(400);
    expect(settleManche({ stake: 200, correct: true, level: 2, manche: 0, available: 1000 })).toBe(600);
    expect(settleManche({ stake: 300, correct: true, level: 3, manche: 0, available: 1000 })).toBe(1200);
  });

  it('perdita in calo lungo le manche', () => {
    const base = { stake: 200, correct: false, level: 2 as const, available: 1000 };
    expect(settleManche({ ...base, manche: 0 })).toBe(-200);
    expect(settleManche({ ...base, manche: 1 })).toBe(-160);
    expect(settleManche({ ...base, manche: 2 })).toBe(-120);
    expect(settleManche({ ...base, manche: 3 })).toBe(-80);
  });

  it('la perdita non porta mai sotto zero', () => {
    expect(settleManche({ stake: 300, correct: false, level: 1, manche: 0, available: 120 })).toBe(-120);
    expect(settleManche({ stake: 300, correct: false, level: 1, manche: 0, available: 0 })).toBe(0);
  });

  it('senza punti la puntata vale zero', () => {
    expect(settleManche({ stake: 100, correct: true, level: 3, manche: 0, available: 0 })).toBe(0);
  });
});
