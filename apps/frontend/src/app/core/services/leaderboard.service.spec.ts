import { TestBed } from '@angular/core/testing';

import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  const metadataNames = (): string[] =>
    service.getLeaderboard().map((player) => player.playerName);

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

  it('toglie la squadra senza punti e dice di averlo fatto', () => {
    service.addPoints('Anna', 0, false);

    expect(service.forgetIfNoPoints('Anna')).toBe(true);
    expect(service.getLeaderboard()).toEqual([]);
  });

  it('lascia in classifica chi ha punti e dice di non averlo tolto', () => {
    service.addPoints('Anna', 120, true);

    expect(service.forgetIfNoPoints('Anna')).toBe(false);
    expect(service.getPlayerStats('Anna')?.totalPoints).toBe(120);
  });

  it('non tocca una squadra mai entrata in classifica', () => {
    expect(service.forgetIfNoPoints('Sconosciuta')).toBe(false);
  });

  it('sposta la squadra sul nuovo nome, con punti e risposte', () => {
    service.addPoints('Anna', 120, true);

    expect(service.renamePlayer('Anna', 'Anna Sofia')).toBe(true);

    expect(service.getPlayerStats('Anna')).toBeNull();
    expect(service.getPlayerStats('Anna Sofia')).toMatchObject({
      totalPoints: 120,
      correctAnswers: 1,
      position: 1,
    });
    expect(metadataNames()).toEqual(['Anna Sofia']);
  });

  it('somma i totali se il nuovo nome esisteva già', () => {
    service.addPoints('Anna', 120, true);
    service.addPoints('Anna Sofia', 30, true);

    service.renamePlayer('Anna', 'Anna Sofia');

    expect(service.getPlayerStats('Anna Sofia')?.totalPoints).toBe(150);
    expect(service.getLeaderboard()).toHaveLength(1);
  });

  it('non rinomina un nome uguale o una squadra mai entrata', () => {
    expect(service.renamePlayer('Anna', 'Anna')).toBe(false);
    expect(service.renamePlayer('Nessuno', 'Nuovo')).toBe(false);
  });

  it('toglie le squadre a zero punti non più collegate', () => {
    service.addPoints('Anna', 0, false);
    service.addPoints('Bruno', 0, false);
    service.addPoints('Carla', 50, true);

    expect(service.forgetAbsent(['Anna'])).toEqual(['Bruno']);

    expect(service.getPlayerStats('Anna')).not.toBeNull();
    expect(service.getPlayerStats('Bruno')).toBeNull();
    // Chi ha giocato resta in classifica anche se il telefono è staccato.
    expect(service.getPlayerStats('Carla')?.totalPoints).toBe(50);
  });

  it('should clear both memory and storage on reset', () => {
    service.addPoints('Anna', 120, true);

    service.reset();

    expect(service.getLeaderboard()).toEqual([]);
    expect(localStorage.getItem('leaderboard')).toBeNull();
  });
});
