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
];

describe('RoundManagerService', () => {
  let service: RoundManagerService;

  beforeEach(() => {
    localStorage.clear();
    service = new RoundManagerService();
  });

  it('should start from round zero', () => {
    expect(service.getCurrentRound()).toBe(0);
    expect(service.getTotalRounds()).toBe(30);
    expect(service.getProgress()).toEqual({ percentage: 0, text: '0/30' });
    expect(service.shouldShowLeaderboard()).toBeNull();
    expect(service.isGameOver()).toBe(false);
  });

  it('should always draw a playable game type', () => {
    for (let i = 0; i < 200; i++) {
      expect(PLAYABLE_TYPES).toContain(service.extractGameType());
    }
  });

  it('should advance the round counter', () => {
    const type = service.startNewRound();

    expect(PLAYABLE_TYPES).toContain(type);
    expect(service.getCurrentRound()).toBe(1);
  });

  it('should show a quick leaderboard every three rounds and a detailed one every six', () => {
    for (let i = 0; i < 3; i++) service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('QUICK');

    service.startNewRound();
    service.startNewRound();
    service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('DETAILED');
  });

  it('should track how many times each mode has been played', () => {
    service.completeRound('QUIZ');
    service.completeRound('QUIZ');
    service.completeRound('ARENA');

    expect(service.getRoundStats().distribution).toEqual({ QUIZ: 2, ARENA: 1 });
  });

  it('should refuse to start a round once the game is over', () => {
    for (let i = 0; i < 30; i++) service.startNewRound();

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
