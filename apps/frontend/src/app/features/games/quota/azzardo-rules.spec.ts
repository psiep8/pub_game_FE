import {
  AZZARDO_BETS,
  clampAzzardoBet,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  oddsForLevel,
  settleManche,
} from './azzardo-rules';

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
