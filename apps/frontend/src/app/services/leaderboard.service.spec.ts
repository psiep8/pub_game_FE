import { TestBed } from '@angular/core/testing';

import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    localStorage.clear();
    service = new LeaderboardService();
  });

  it('should start empty', () => {
    expect(service.getLeaderboard()).toEqual([]);
    expect(service.getTop3()).toEqual([]);
    expect(service.getStats()).toEqual({
      totalPlayers: 0,
      totalPoints: 0,
      averagePoints: 0,
      leader: null,
    });
  });

  it('should rank players by points', () => {
    service.addPoints('Anna', 100, true);
    service.addPoints('Bruno', 300, false);

    const board = service.getLeaderboard();

    expect(board.map((player) => player.playerName)).toEqual(['Bruno', 'Anna']);
    expect(board[0].position).toBe(1);
    expect(service.getPlayerPosition('Anna')).toBe(2);
    expect(service.getTop3()).toHaveLength(2);
    expect(service.getStats().leader?.playerName).toBe('Bruno');
  });

  it('should accumulate points and answer counters', () => {
    service.addPoints('Anna', 100, true);
    service.addPoints('Anna', 50, false);

    expect(service.getPlayerStats('Anna')).toMatchObject({
      totalPoints: 150,
      correctAnswers: 1,
      wrongAnswers: 1,
    });
  });

  it('should survive a reload from storage', () => {
    service.addPoints('Anna', 120, true);

    const reloaded = new LeaderboardService();

    expect(reloaded.getPlayerStats('Anna')?.totalPoints).toBe(120);
    expect(reloaded.getPlayerStats('Anna')?.position).toBe(1);
  });

  it('should clear both memory and storage on reset', () => {
    service.addPoints('Anna', 120, true);

    service.reset();

    expect(service.getLeaderboard()).toEqual([]);
    expect(localStorage.getItem('leaderboard')).toBeNull();
  });
});
