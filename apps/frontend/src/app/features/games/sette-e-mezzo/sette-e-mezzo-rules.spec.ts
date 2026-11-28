import {
  BANCO_SOGLIA,
  MATTA_ATTIVA,
  SETTE_E_MEZZO_LOSS,
  SETTE_E_MEZZO_NATURAL_WIN,
  SETTE_E_MEZZO_WIN,
  bankShouldDraw,
  cardValue,
  handTotal,
  isNatural,
  settleHand,
} from './sette-e-mezzo-rules';
import {
  buildNeapolitanDeck,
  cardName,
  cardShort,
  seededRandom,
  shuffleDeck,
} from './neapolitan-deck';

describe('Sette e Mezzo — valori e naturale', () => {
  it('Asso 1, numeri il loro valore, figure mezzo punto', () => {
    expect(cardValue('ASSO-DENARI')).toBe(1);
    expect(cardValue('7-COPPE')).toBe(7);
    expect(cardValue('FANTE-SPADE')).toBe(0.5);
    expect(cardValue('CAVALLO-BASTONI')).toBe(0.5);
    expect(cardValue('RE-DENARI')).toBe(0.5);
  });

  it('somma le carte senza perdere i mezzi punti', () => {
    expect(handTotal(['7-COPPE', 'FANTE-SPADE'])).toBe(7.5);
    expect(handTotal(['ASSO-DENARI', '2-COPPE', '3-SPADE'])).toBe(6);
    expect(handTotal(['6-COPPE', 'RE-SPADE'])).toBe(6.5);
  });

  it('la matta sceglie da sola il valore che avvicina a 7,5', () => {
    // 6 + matta: 1 ci sta (7), 0,5 sarebbe 6,5. Sceglie 1.
    expect(handTotal(['6-COPPE', 'RE-DENARI'])).toBe(7);
    // 7 + matta: 1 sballerebbe, quindi 0,5.
    expect(handTotal(['7-COPPE', 'RE-DENARI'])).toBe(7.5);
    // Con l'Asso in più nessuno dei due valori salva la mano.
    expect(handTotal(['7-COPPE', 'RE-DENARI', 'ASSO-SPADE'])).toBe(8.5);
  });

  it('senza matta il Re di denari vale mezzo punto come le altre figure', () => {
    expect(MATTA_ATTIVA).toBe(true);
    expect(handTotal(['6-COPPE', 'RE-DENARI'], false)).toBe(6.5);
    expect(handTotal(['7-COPPE', 'RE-DENARI'], false)).toBe(7.5);
  });

  it('il naturale è 7 + figura, matta compresa', () => {
    expect(isNatural(['7-COPPE', 'FANTE-SPADE'])).toBe(true);
    expect(isNatural(['7-COPPE', 'RE-DENARI'])).toBe(true);
    expect(isNatural(['6-COPPE', 'ASSO-SPADE'])).toBe(false);
    expect(isNatural(['7-COPPE', 'ASSO-SPADE'])).toBe(false);
  });
});

describe('Sette e Mezzo — esiti', () => {
  it('chi supera 7,5 perde subito, senza punti guadagnati', () => {
    expect(settleHand(['7-COPPE', 'ASSO-SPADE', '2-DENARI'], ['5-COPPE'])).toEqual({
      outcome: 'BUST',
      points: -SETTE_E_MEZZO_LOSS,
    });
  });

  it('il naturale vince il doppio, salvo il naturale del banco', () => {
    expect(settleHand(['7-COPPE', 'FANTE-SPADE'], ['6-COPPE', '2-DENARI'])).toEqual({
      outcome: 'NATURAL',
      points: SETTE_E_MEZZO_NATURAL_WIN,
    });
    expect(settleHand(['7-COPPE', 'FANTE-SPADE'], ['7-SPADE', 'CAVALLO-DENARI'])).toEqual({
      outcome: 'LOSE',
      points: -SETTE_E_MEZZO_LOSS,
    });
  });

  it('il banco vince i pareggi', () => {
    expect(settleHand(['6-COPPE', 'ASSO-SPADE'], ['5-DENARI', '2-COPPE'])).toEqual({
      outcome: 'LOSE',
      points: -SETTE_E_MEZZO_LOSS,
    });
  });

  it('il banco sballato regala la mano', () => {
    expect(settleHand(['5-COPPE'], ['7-SPADE', 'ASSO-DENARI', '2-COPPE'])).toEqual({
      outcome: 'WIN',
      points: SETTE_E_MEZZO_WIN,
    });
  });

  it('la sconfitta non porta mai la classifica sotto zero', () => {
    expect(settleHand(['2-COPPE'], ['7-SPADE'], 100).points).toBe(-100);
    expect(settleHand(['2-COPPE'], ['7-SPADE'], 0).points).toBe(0);
  });
});

describe('Sette e Mezzo — banco automatico', () => {
  it('pesca sotto la soglia e sta quando la raggiunge', () => {
    expect(bankShouldDraw(5, BANCO_SOGLIA)).toBe(true);
    expect(bankShouldDraw(6, BANCO_SOGLIA)).toBe(true);
    expect(bankShouldDraw(6.25, BANCO_SOGLIA)).toBe(false);
    expect(bankShouldDraw(8, BANCO_SOGLIA)).toBe(false);
  });
});

describe('mazzo napoletano', () => {
  it('ha 40 carte tutte diverse: quattro semi per dieci valori', () => {
    const deck = buildNeapolitanDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck).size).toBe(40);
    for (const suit of ['DENARI', 'COPPE', 'SPADE', 'BASTONI']) {
      expect(deck.filter((card) => card.endsWith(`-${suit}`))).toHaveLength(10);
    }
  });

  it('mescola senza perdere né duplicare carte, con un seme riproducibile', () => {
    const deck = buildNeapolitanDeck();
    const first = shuffleDeck(deck, seededRandom(2026));
    const second = shuffleDeck(deck, seededRandom(2026));
    expect(first).toEqual(second);
    expect(first).not.toEqual(deck);
    expect([...first].sort()).toEqual([...deck].sort());
  });

  it('scrive i nomi per la TV e le sigle per il telefono', () => {
    expect(cardName('RE-DENARI')).toBe('Re di denari');
    expect(cardName('7-COPPE')).toBe('7 di coppe');
    expect(cardShort('RE-DENARI')).toBe('R♦');
    expect(cardShort('7-COPPE')).toBe('7♥');
  });
});
