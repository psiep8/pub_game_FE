import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlackjackMode, BlackjackPhase, BlackjackSnapshot } from './blackjack.mode';

const savedHand: BlackjackSnapshot = {
  players: ['Ada', 'Bruno'],
  deck: ['2♠', '3♥', '4♦'],
  bankCards: ['10♣', '9♠'],
  handIndex: 0,
  round: 1,
  tableIndex: 0,
  phase: BlackjackPhase.DECIDE,
  cards: ['K♠', '7♥'],
  choice: null,
  rows: [
    { playerName: 'Ada', status: 'ACTIVE', points: 0 },
    { playerName: 'Bruno', status: 'WAITING', points: 0 },
  ],
  result: null,
};

function newMode(): BlackjackMode {
  const mode = new BlackjackMode();
  mode.setConfig({ type: 'BLACKJACK', payload: {}, gameId: 226 } as any);
  return mode;
}

describe('BlackjackMode.restore', () => {
  afterEach(() => vi.useRealTimers());

  it('riprende la mano nella stessa fase con il tempo rimasto', () => {
    vi.useFakeTimers();
    const mode = newMode();

    mode.restore(9, savedHand);

    const display = mode.getDisplayData();
    expect(display.phase).toBe(BlackjackPhase.DECIDE);
    expect(display.cards).toEqual(['K♠', '7♥']);
    expect(display.secondsLeft).toBe(9);
    mode.stop();
  });

  it('durante la decisione mostra solo la prima carta del banco', () => {
    vi.useFakeTimers();
    const mode = newMode();

    mode.restore(9, savedHand);

    const bank = mode.getDisplayData().bank;
    expect(bank.hidden).toBe(true);
    expect(bank.cards).toEqual(['10♣']);
    mode.stop();
  });

  it('il snapshot riletto dopo il restore coincide con quello salvato', () => {
    vi.useFakeTimers();
    const mode = newMode();

    mode.restore(9, savedHand);

    const again = mode.snapshot();
    expect(again.players).toEqual(savedHand.players);
    expect(again.bankCards).toEqual(savedHand.bankCards);
    expect(again.rows).toEqual(savedHand.rows);
    expect(again.phase).toBe(BlackjackPhase.DECIDE);
    mode.stop();
  });

  it('senza snapshot non cambia nulla', () => {
    const mode = newMode();

    mode.restore(9, undefined);

    expect(mode.getDisplayData().phase).toBe(BlackjackPhase.DECIDE);
    mode.stop();
  });
});
