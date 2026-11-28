import { describe, expect, it } from 'vitest';

import {
  SETTE_E_MEZZO_HANDS,
  SetteEMezzoGame,
  buildSetteEMezzoDeck,
  shortRank,
  suitShort,
} from './sette-e-mezzo-game';
import { handTotal, isNatural } from './sette-e-mezzo-rules';

const fixedRandom = () => 0.5;

describe('Sette e Mezzo — motore', () => {
  it('costruisce il mazzo napoletano da 40 carte, con la matta', () => {
    const deck = buildSetteEMezzoDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck).size).toBe(40);
    expect(deck).toContain('RE-DENARI');
  });

  it('la matta sceglie il valore che avvicina a 7,5', () => {
    expect(handTotal(['7-DENARI', 'RE-DENARI'])).toBe(7.5);
    expect(handTotal(['6-DENARI', 'RE-DENARI'])).toBe(7);
    expect(handTotal(['ASSO-DENARI', 'RE-DENARI'])).toBe(2);
    expect(isNatural(['7-DENARI', 'RE-DENARI'])).toBe(true);
    expect(isNatural(['7-DENARI', 'FANTE-COPPE'])).toBe(true);
  });

  it('parte con due carte per lato e il banco coperto', () => {
    const game = new SetteEMezzoGame(fixedRandom);
    const state = game.snapshot();
    expect(state.player).toHaveLength(2);
    expect(state.bank).toHaveLength(2);
    expect(state.handNumber).toBe(1);
    expect(state.hands).toBe(SETTE_E_MEZZO_HANDS);
  });

  it('stand rivela il banco, regola la mano e apre la successiva', () => {
    const game = new SetteEMezzoGame(fixedRandom);
    game.player = ['2-DENARI', '3-COPPE'];
    game.bank = ['2-COPPE', '3-DENARI'];
    game.phase = 'PLAY';
    game.result = null;
    game.bankHidden = true;
    game.stand();

    const state = game.snapshot();
    expect(state.phase).toBe('REVEAL');
    expect(state.bankHidden).toBe(false);
    expect(state.result).not.toBeNull();
    expect(state.score).toBeGreaterThanOrEqual(0);

    game.next();
    expect(game.snapshot().handNumber).toBe(2);
    expect(game.snapshot().phase).toBe('PLAY');
  });

  it('chiude la partita dopo cinque mani', () => {
    const game = new SetteEMezzoGame(fixedRandom);
    for (let hand = 0; hand < SETTE_E_MEZZO_HANDS; hand += 1) {
      game.stand();
      game.next();
    }
    expect(game.snapshot().phase).toBe('FINALE');
    expect(game.snapshot().handNumber).toBe(SETTE_E_MEZZO_HANDS);
  });

  it('sballare chiude subito la mano', () => {
    const game = new SetteEMezzoGame(fixedRandom);
    game.player = ['7-DENARI', '7-COPPE'];
    game.deck = ['RE-SPADE'];
    game.phase = 'PLAY';
    game.result = null;
    game.bankHidden = true;
    game.hit();

    expect(game.snapshot().phase).toBe('REVEAL');
    expect(game.snapshot().result?.outcome).toBe('BUST');
  });

  it('il naturale paga 500 salvo naturale del banco', () => {
    const game = new SetteEMezzoGame(fixedRandom);
    game.player = ['7-DENARI', 'RE-SPADE'];
    game.bank = ['7-DENARI', '7-COPPE'];
    game.phase = 'PLAY';
    game.result = null;
    game.bankHidden = true;
    game.stand();

    expect(game.snapshot().result?.outcome).toBe('NATURAL');
    expect(game.snapshot().result?.points).toBe(500);
    expect(game.snapshot().score).toBe(500);
  });

  it('etichette corte per il tavolo', () => {
    expect(shortRank('ASSO-DENARI')).toBe('A');
    expect(shortRank('RE-COPPE')).toBe('R');
    expect(suitShort('RE-DENARI')).toBe('DEN');
    expect(suitShort('FANTE-BASTONI')).toBe('BAS');
  });
});
