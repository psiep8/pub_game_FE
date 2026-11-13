import { GameModeType } from '../../shared/models/game-mode-type';
import { RoundManagerService } from './round-manager.service';

const PLAYABLE_TYPES: GameModeType[] = [
  'QUIZ',
  'WHEEL_OF_FORTUNE',
  'MUSIC',
  'IMAGE_BLUR',
  'ARENA',
  'TIMELINE',
  'BOMBA',
  'SPEED_RUSH',
  'TENNIS_BATTLE',
  'TIME_BUZZER',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BLACKJACK',
];

const REALTIME_TYPES: GameModeType[] = ['BOMBA', 'ARENA', 'SPEED_RUSH', 'TENNIS_BATTLE', 'BLACKJACK'];

describe('RoundManagerService', () => {
  let service: RoundManagerService;

  beforeEach(() => {
    localStorage.clear();
    service = new RoundManagerService();
  });

  it('should start from round zero', () => {
    expect(service.getCurrentRound()).toBe(0);
    expect(service.getTotalRounds()).toBe(40);
    expect(service.getProgress()).toEqual({ percentage: 0, text: '0/40' });
    expect(service.shouldShowLeaderboard()).toBeNull();
    expect(service.isGameOver()).toBe(false);
  });

  it('should always draw a playable game type', () => {
    for (let i = 0; i < 40; i++) {
      expect(PLAYABLE_TYPES).toContain(service.extractGameType());
      service.startNewRound();
    }
  });

  it('should never replay a whole act and should vary the act openers', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    const acts = [0, 1, 2, 3, 4].map((act) => types.slice(act * 8, act * 8 + 8));

    expect(acts[0][0]).toBe('QUIZ');
    for (let i = 1; i < acts.length; i++) {
      expect(acts[i]).not.toEqual(acts[i - 1]);
    }
    expect(acts.every((act) => act[0] === 'QUIZ')).toBe(false);
  });

  it('should never schedule two realtime games back to back', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) {
      types.push(service.startNewRound());
    }

    for (let i = 1; i < types.length; i++) {
      const bothRealtime = REALTIME_TYPES.includes(types[i]) && REALTIME_TYPES.includes(types[i - 1]);
      expect(bothRealtime).toBe(false);
    }
  });

  it('should never schedule two booking games back to back', () => {
    const booking: GameModeType[] = ['MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE'];
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    for (let i = 1; i < types.length; i++) {
      expect(booking.includes(types[i]) && booking.includes(types[i - 1])).toBe(false);
    }
  });

  it('should play the wheel twice and close with the arena', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    expect(types.filter((type) => type === 'WHEEL_OF_FORTUNE')).toHaveLength(2);
    expect(types[39]).toBe('ARENA');
  });

  it('should close acts 1, 2 and 4 with Ultima spiaggia and acts 3 and 5 with Arena', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    expect(types[7]).toBe('ULTIMA_SPIAGGIA');
    expect(types[15]).toBe('ULTIMA_SPIAGGIA');
    expect(types[22]).toBe('ULTIMA_SPIAGGIA');
    expect(types[23]).toBe('ARENA');
    expect(types[31]).toBe('ULTIMA_SPIAGGIA');
    expect(types[38]).toBe('ULTIMA_SPIAGGIA');
    expect(types[39]).toBe('ARENA');
    expect(types.filter((type) => type === 'ULTIMA_SPIAGGIA')).toHaveLength(5);
  });

  it('should show a quick leaderboard mid-act and a detailed one at the end of the act', () => {
    for (let i = 0; i < 4; i++) service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('QUICK');

    for (let i = 0; i < 4; i++) service.startNewRound();
    expect(service.shouldShowLeaderboard()).toBe('DETAILED');
    expect(service.isActEnd()).toBe(true);
  });

  it('should spread the casino variants across the acts', () => {
    const expected: Array<string | null> = [
      'CASINO',
      'BASKET',
      'CAVALLO',
      'BIGLIE',
      null,
    ];

    expected.forEach((bonus, act) => {
      localStorage.setItem(
        'roundProgress',
        JSON.stringify({
          totalRounds: 40,
          currentRound: (act + 1) * 8,
          completedRounds: [],
          nextRoundType: null,
        })
      );
      const restarted = new RoundManagerService();
      expect(restarted.bonusAfterAct()).toBe(bonus);
    });
  });

  it('should keep the horse out of the round deck and play it as a bonus', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    expect(types.filter((type) => (type as string) === 'CAVALLO')).toHaveLength(0);
    expect(types.filter((type) => type === 'QUIZ')).toHaveLength(5);
    expect(types.filter((type) => type === 'TIME_BUZZER')).toHaveLength(3);
    expect(types.filter((type) => type === 'ULTIMA_SPIAGGIA')).toHaveLength(5);
    expect(types.filter((type) => type === 'AZZARDO')).toHaveLength(2);
    expect(types.filter((type) => type === 'BOMBA')).toHaveLength(3);
  });

  it('should respect the agreed mix of games across the 40 rounds', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    expect(types.filter((type) => type === 'QUIZ')).toHaveLength(5);
    expect(types.filter((type) => type === 'MUSIC')).toHaveLength(4);
    expect(types.filter((type) => type === 'AZZARDO')).toHaveLength(2);
    expect(types.filter((type) => type === 'ARENA')).toHaveLength(2);
    expect(types.filter((type) => type === 'BOMBA')).toHaveLength(3);
    expect(types.filter((type) => type === 'IMAGE_BLUR')).toHaveLength(3);
    expect(types.filter((type) => type === 'BLACKJACK')).toHaveLength(3);
    expect(types.filter((type) => type === 'TIMELINE')).toHaveLength(3);
    expect(types.filter((type) => type === 'WHEEL_OF_FORTUNE')).toHaveLength(2);
    expect(types.filter((type) => type === 'SPEED_RUSH')).toHaveLength(2);
    expect(types.filter((type) => type === 'TIME_BUZZER')).toHaveLength(3);
    expect(types.filter((type) => type === 'TENNIS_BATTLE')).toHaveLength(3);
    expect(types.filter((type) => type === 'ULTIMA_SPIAGGIA')).toHaveLength(5);
  });

  it('should play the black jack three times, only in the first three acts', () => {
    const types: GameModeType[] = [];
    for (let i = 0; i < 40; i++) types.push(service.startNewRound());

    const acts = [0, 1, 2, 3, 4].map((act) => types.slice(act * 8, act * 8 + 8));

    expect(types.filter((type) => type === 'BLACKJACK')).toHaveLength(3);
    expect(acts[0]).toContain('BLACKJACK');
    expect(acts[1]).toContain('BLACKJACK');
    expect(acts[2]).toContain('BLACKJACK');
    expect(acts[3]).not.toContain('BLACKJACK');
    expect(acts[4]).not.toContain('BLACKJACK');
  });

  it('should track how many times each mode has been played', () => {
    service.completeRound('QUIZ');
    service.completeRound('QUIZ');
    service.completeRound('ARENA');

    expect(service.getRoundStats().distribution).toEqual({ QUIZ: 2, ARENA: 1 });
  });

  it('should refuse to start a round once the game is over', () => {
    for (let i = 0; i < 40; i++) service.startNewRound();

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
