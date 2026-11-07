import {
  BLACKJACK_LOSS,
  BLACKJACK_NATURAL_WIN,
  BLACKJACK_ROUNDS,
  BLACKJACK_WIN,
  handTotal,
  settleHand,
} from './blackjack-rules';

describe('handTotal', () => {
  it('conta figure e assi senza sballare', () => {
    expect(handTotal(['K♠', '9♥'])).toBe(19);
    expect(handTotal(['A♠', '9♥'])).toBe(20);
    expect(handTotal(['A♠', 'A♥', '9♦'])).toBe(21);
    expect(handTotal(['A♠', 'A♥', 'A♦', 'A♣'])).toBe(14);
    expect(handTotal(['10♠', 'J♥', 'Q♦'])).toBe(30);
  });
});

describe('settleHand', () => {
  it('tre round da 250, naturale a 500', () => {
    expect(BLACKJACK_ROUNDS).toBe(3);
    expect(BLACKJACK_WIN).toBe(250);
    expect(BLACKJACK_NATURAL_WIN).toBe(500);
    expect(BLACKJACK_LOSS).toBe(250);
  });

  it('sballare costa 250', () => {
    expect(settleHand(['K♠', 'Q♥', '5♦'], ['9♠', '7♥'])).toEqual({
      outcome: 'BUST',
      points: -250,
    });
  });

  it('il naturale paga il doppio', () => {
    expect(settleHand(['A♠', 'K♥'], ['9♠', '8♥'])).toEqual({
      outcome: 'BLACKJACK',
      points: 500,
    });
  });

  it('naturale contro naturale è pari', () => {
    expect(settleHand(['A♠', 'K♥'], ['A♦', 'Q♣'])).toEqual({
      outcome: 'PUSH',
      points: 0,
    });
  });

  it('mano migliore del banco paga 250, banco sballato compreso', () => {
    expect(settleHand(['10♠', '9♥'], ['9♠', '8♥'])).toEqual({
      outcome: 'WIN',
      points: 250,
    });
    expect(settleHand(['10♠', '7♥'], ['9♠', '8♥', '5♦'])).toEqual({
      outcome: 'WIN',
      points: 250,
    });
  });

  it('pari non muove nulla, mano peggiore perde 250', () => {
    expect(settleHand(['10♠', '8♥'], ['9♠', '9♥'])).toEqual({
      outcome: 'PUSH',
      points: 0,
    });
    expect(settleHand(['10♠', '7♥'], ['9♠', '9♥'])).toEqual({
      outcome: 'LOSE',
      points: -250,
    });
  });

  it('due sconfitte di fila costano sempre 250, non cumulano', () => {
    const first = settleHand(['10♠', '7♥'], ['9♠', '9♥'], 1000);
    const second = settleHand(['10♠', '6♥'], ['9♠', '9♥'], 750);
    expect(first.points).toBe(-250);
    expect(second.points).toBe(-250);
  });

  it('la perdita non porta mai la classifica sotto zero', () => {
    expect(settleHand(['10♠', '7♥'], ['9♠', '9♥'], 120)).toEqual({
      outcome: 'LOSE',
      points: -120,
    });
    expect(settleHand(['10♠', '7♥'], ['9♠', '9♥'], 0).points).toBe(0);
  });
});
