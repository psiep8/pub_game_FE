import { rouletteColorLabel } from './casino-bonus.component';

describe('rouletteColorLabel', () => {
  it('assegna lo zero al banco', () => {
    expect(rouletteColorLabel(0)).toBe('BANCO');
  });

  it('riconosce i numeri rossi della roulette europea', () => {
    for (const number of [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]) {
      expect(rouletteColorLabel(number), `numero ${number}`).toBe('ROSSO');
    }
  });

  it('chiama neri tutti gli altri numeri', () => {
    for (const number of [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]) {
      expect(rouletteColorLabel(number), `numero ${number}`).toBe('NERO');
    }
  });
});
