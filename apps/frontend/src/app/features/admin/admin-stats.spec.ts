import { buildAdminStats } from './admin-stats';

const HISTORY = {
  rounds: [
    {
      roundIndex: 0,
      entries: [
        { playerName: 'Anna', points: 100, totalPoints: 100 },
        { playerName: 'Bruno', points: 20, totalPoints: 20 },
      ],
    },
    {
      roundIndex: 1,
      entries: [
        { playerName: 'Anna', points: 0, totalPoints: 100 },
        { playerName: 'Bruno', points: 80, totalPoints: 100 },
      ],
    },
    {
      roundIndex: 2,
      entries: [
        { playerName: 'Anna', points: 40, totalPoints: 140 },
        { playerName: 'Bruno', points: 10, totalPoints: 110 },
      ],
    },
  ],
};

describe('Statistiche della regia', () => {
  it('conta round, squadre, punti e media', () => {
    const stats = buildAdminStats(HISTORY);
    expect(stats.rounds).toBe(3);
    expect(stats.teams).toBe(2);
    expect(stats.totalPoints).toBe(250);
    expect(stats.averageRound).toBe(83.3);
  });

  it('racconta il round più ricco e la mano migliore', () => {
    const stats = buildAdminStats(HISTORY);
    expect(stats.curiosities).toContain('Round più ricco: round 1 con 120 punti.');
    expect(stats.curiosities).toContain('Miglior mano: Anna (+100) al round 1.');
  });

  it('trova la rimonta più grande e la squadra più costante', () => {
    const stats = buildAdminStats(HISTORY);
    // Bruno parte da 20 e arriva a 110: +90 dal minimo.
    expect(stats.curiosities).toContain('Rimonta più grande: Bruno (+90 punti dal minimo).');
    // Anna fa 100, 0, 40: scarto 100. Bruno 20, 80, 10: scarto 70.
    expect(stats.curiosities).toContain('Squadra più costante: Bruno (scarto 70 punti fra round).');
  });

  it('senza storico non inventa numeri', () => {
    expect(buildAdminStats(null)).toEqual({
      rounds: 0,
      teams: 0,
      totalPoints: 0,
      averageRound: 0,
      curiosities: [],
    });
    expect(buildAdminStats({ rounds: [{ roundIndex: 0, entries: [] }] }).rounds).toBe(0);
  });
});
