import { BiglieMode } from './biglie.mode';

describe('BiglieMode', () => {
  it('non parte con un timer di round e non usa prenotazioni', async () => {
    const mode = new BiglieMode();
    mode.initialize({ type: 'BIGLIE' });
    await mode.start();

    expect(mode.type).toBe('BIGLIE');
    expect(mode.timerDuration).toBe(0);
    expect(mode.requiresBubbles).toBe(false);
    expect(mode.requiresBuzz).toBe(false);
    expect(mode.canBuzz()).toBe(false);
    expect(mode.getDisplayData()).toEqual({});
    expect(mode.pointsFor(true, 0)).toBe(0);
  });

  it('si chiude solo quando la TV ha finito le quattro gare', () => {
    const mode = new BiglieMode();
    mode.initialize({ type: 'BIGLIE' });

    expect(mode.isRevealed()).toBe(false);
    mode.stop();
    expect(mode.isRevealed()).toBe(true);
  });
});
