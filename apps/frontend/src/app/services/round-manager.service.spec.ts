import { GameModeType } from '../components/game-component/interfaces/game-mode-type';
import { RoundManagerService } from './round-manager.service';

const PLAYABLE_TYPES: GameModeType[] = [
  'QUIZ',
  'TRUE_FALSE',
  'WHEEL_OF_FORTUNE',
  'MUSIC',
  'IMAGE_BLUR',
  'CHRONO',
  'ROULETTE',
  'SCREAM_RACE',
  'ARENA',
  'TIMELINE',
  'PRICE',
  'SPEED_RUSH',
  'PING_PONG',
];

const REALTIME_TYPES: GameModeType[] = ['ARENA', 'SPEED_RUSH', 'PING_PONG'];

describe('RoundManagerService', () => {
  let service: RoundManagerService;

  beforeEach(() => {
    localStorage.clear();
    service = new RoundManagerService();
  });

  it('should start from round zero', () => {
    expect(service.getCurrentRound()).toBe(0);
    expect(service.getTotalRounds()).toBe(24);
    expect(service.getProgress()).toEqual({ percentage: 0, text: '0/24' });
    expect(service.shouldShowLeaderboard()).toBeNull();
    expect(service.isGameOver()).toBe(false);
  });

  it('should always draw a playable game type', () => {
    for (let i = 0; i < 24; i++) {
      expect(PLAYABLE_TYPES).toContain(service.extractGameType());
      service.startNewRound();
    }
  });

  it('should open every act with a quiz', () => {
    [0, 8, 16].forEach((round) => {
      const fresh = new RoundManagerService();
      localStorage.setItem(
        'roundProgress',
        JSON.stringify({ totalRounds: 24, currentRound: round, completedRounds: [], nextRoundType: null })
      );
      const restarted = new RoundManagerService();
      expect(restarted.extractGameType()).toBe('QUIZ');
      fresh.resetGame();
    });
  });

  it('should never schedule two realtime games back to back', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 24; i++) {
      types.push(service.startNewRound());
    }

    for (let i = 1; i < types.length; i++) {
      const bothRealtime = REALTIME_TYPES.includes(types[i]) && REALTIME_TYPES.includes(types[i - 1]);
      expect(bothRealtime).toBe(false);
    }
  });

  it('should show a quick leaderboard mid-act and a detailed one at the end of the act', () => {
    for (let i = 0; i < 4; i++) service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('QUICK');

    for (let i = 0; i < 4; i++) service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('DETAILED');
    expect(service.isActEnd()).toBe(true);
  });

  it('should not consume a round for the bonus roulette', () => {
    const before = service.getCurrentRound();

    expect(service.startBonusRound()).toBe('ROULETTE');
    expect(service.getCurrentRound()).toBe(before);
  });

  it('should track how many times each mode has been played', () => {
    service.completeRound('QUIZ');
    service.completeRound('QUIZ');
    service.completeRound('ARENA');

    expect(service.getRoundStats().distribution).toEqual({ QUIZ: 2, ARENA: 1 });
  });

  it('should refuse to start a round once the game is over', () => {
    for (let i = 0; i < 24; i++) service.startNewRound();

    expect(service.isGameOver()).toBe(true);
    expect(() => service.startNewRound()).toThrowError('Tutti i round completati!');
  });

  it('should reset the progress', () => {
    service.startNewRound();

    service.resetGame();

    expect(service.getCurrentRound()).toBe(0);
    expect(localStorage.getItem('roundProgress')).toBeNull();
  });
});
