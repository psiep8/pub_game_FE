import { vi } from 'vitest';
import { ImageBlurMode } from './image-blur.mode';

describe('ImageBlurMode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('svela un indizio ogni dieci secondi', async () => {
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

    await vi.advanceTimersByTimeAsync(10000);
    expect(mode.getDisplayData().clue).toBe('premio Oscar');

    await vi.advanceTimersByTimeAsync(10000);
    expect(mode.getDisplayData().clue).toBe('nata a Roma');

    mode.cleanup();
  });
});
