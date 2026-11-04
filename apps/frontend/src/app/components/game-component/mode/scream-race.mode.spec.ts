import { GameModeConfig } from '../interfaces/game-mode-type';
import { ScreamRaceMode } from './scream-race.mode';

function setup(activePlayers: string[] = ['Anna', 'Bruno']) {
  const mode = new ScreamRaceMode();
  const config: GameModeConfig = {
    type: 'SCREAM_RACE',
    payload: {},
    gameId: 1,
    activePlayers,
  };

  mode.setConfig(config);
  mode.initialize({});

  return mode;
}

describe('ScreamRaceMode', () => {
  it('should ignore noise under the gate', () => {
    const mode = setup();

    mode.applyScreamIntensity('Anna', 4);

    expect(mode.getDisplayData().teams[0].progress).toBe(0);
  });

  it('should move a player forward with a loud scream', () => {
    const mode = setup();

    mode.applyScreamIntensity('Anna', 80);

    const team = mode.getDisplayData().teams[0];
    expect(team.playerName).toBe('Anna');
    expect(team.progress).toBeGreaterThan(0);
    expect(team.progress).toBeLessThan(100);
  });

  it('should finish a player that reaches the goal', () => {
    const mode = setup();

    for (let i = 0; i < 200; i++) mode.applyScreamIntensity('Anna', 100);

    const data = mode.getDisplayData();
    const anna = data.teams.find((team) => team.playerName === 'Anna');

    expect(anna?.finished).toBe(true);
    expect(anna?.progress).toBe(100);
    expect(data.winners).toContain('Anna');
  });

  it('should keep the finishing order', () => {
    const mode = setup();

    mode.markTeamFinished('Bruno', 1);
    mode.markTeamFinished('Anna', 2);

    expect(mode.getDisplayData().winners).toEqual(['Bruno', 'Anna']);
  });

  it('should sort the standings by progress', () => {
    const mode = setup();

    mode.applyScreamIntensity('Bruno', 90);
    mode.markTeamFinished('Bruno', 1);
    for (let i = 0; i < 5; i++) mode.applyScreamIntensity('Anna', 90);

    expect(mode.getDisplayData().teams[0].playerName).toBe('Bruno');
  });

  it('should not report the race as ended while someone is still running', () => {
    const mode = setup();

    mode.markTeamFinished('Bruno', 1);

    expect(mode.getDisplayData().raceEnded).toBe(false);
  });
});
