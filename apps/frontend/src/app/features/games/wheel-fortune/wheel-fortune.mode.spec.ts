import { vi } from 'vitest';
import { GameModeConfig } from '../../../shared/models/game-mode-type';
import { WheelOfFortuneMode } from './wheel-fortune.mode';
import { buildLetterOrder } from './wheel-letter-deck';

const PAYLOAD = { proverb: 'Chi va piano va sano e va lontano', hint: 'Un modo di dire' };

function setup() {
  const saved: Array<{ type: string; revision: number; state: any }> = [];
  const mode = new WheelOfFortuneMode();
  const config: GameModeConfig = {
    type: 'WHEEL_OF_FORTUNE',
    payload: PAYLOAD,
    gameId: 1,
    onTvCheckpoint: (checkpoint) => saved.push(checkpoint as any),
  };

  mode.setConfig(config);
  mode.initialize(PAYLOAD);

  return { mode, saved };
}

describe('WheelOfFortuneMode — ripresa dopo un refresh della TV', () => {
  it('salva lettere uscite e punto del mazzo nel checkpoint', async () => {
    vi.useFakeTimers();
    const { mode, saved } = setup();

    await mode.start();
    expect(saved.at(-1)?.state).toMatchObject({ letters: [], letterIndex: 0 });

    vi.advanceTimersByTime(1000);
    const afterFirst = saved.at(-1)!;
    expect(afterFirst.state.letters).toHaveLength(1);
    expect(afterFirst.state.letterIndex).toBe(1);
    expect(afterFirst.state.order).toHaveLength(buildLetterOrder(PAYLOAD.proverb).length);

    mode.cleanup();
    vi.useRealTimers();
  });

  it('riapre lo stesso mazzo e le stesse lettere al refresh', () => {
    const { mode } = setup();
    const order = ['C', 'H', 'I', 'A'];

    mode.restore(30, { revision: 4, state: { order, letterIndex: 2, letters: ['C', 'H'] } });

    const data = mode.getDisplayData();
    expect(data.revealedCount).toBe(2);
    expect(data.displayWords[0]).toEqual(['C', 'h', '_']);
    expect(mode.getTimerValue()).toBe(30);
    expect(mode.canBuzz()).toBe(true);

    mode.cleanup();
  });

  it('scarta lettere che non sono nella frase', () => {
    const { mode } = setup();

    mode.restore(20, { revision: 5, state: { order: ['Z', 'A'], letterIndex: 9, letters: ['Z', 'A'] } });

    const data = mode.getDisplayData();
    expect(data.revealedCount).toBe(1);
    expect(data.displayWords[0]).toEqual(['_', '_', '_']);

    mode.cleanup();
  });

  it('non si rompe con un checkpoint senza stato utile', () => {
    const { mode } = setup();

    mode.restore(10, { revision: 6, state: { order: 'nope', letters: null, letterIndex: 'x' } });

    expect(mode.getDisplayData().revealedCount).toBe(0);
    expect(mode.isRevealed()).toBe(false);

    mode.cleanup();
  });
});
