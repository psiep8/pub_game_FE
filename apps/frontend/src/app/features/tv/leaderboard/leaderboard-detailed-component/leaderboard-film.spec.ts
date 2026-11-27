import {
  buildFilmStories,
  gameMomentLabel,
  roundMomentLabel,
  signedPoints,
  type RoundScoreHistory,
} from './leaderboard-film';

const history: RoundScoreHistory = {
  rounds: [
    {
      roundIndex: 0,
      type: 'MUSIC',
      entries: [
        { playerName: 'Anna', points: 100, totalPoints: 1000 },
        { playerName: 'Bruno', points: 0, totalPoints: 600 },
        { playerName: 'Carla', points: 50, totalPoints: 700 },
      ],
    },
    {
      roundIndex: 1,
      type: 'QUIZ',
      entries: [
        { playerName: 'Anna', points: 0, totalPoints: 1000 },
        { playerName: 'Bruno', points: 300, totalPoints: 900 },
        { playerName: 'Carla', points: -100, totalPoints: 600 },
      ],
    },
    {
      roundIndex: 2,
      type: 'MUSIC',
      entries: [
        { playerName: 'Anna', points: 200, totalPoints: 1200 },
        { playerName: 'Bruno', points: -50, totalPoints: 850 },
        { playerName: 'Carla', points: 400, totalPoints: 1000 },
      ],
    },
  ],
};

describe('buildFilmStories', () => {
  it('calcola miglior round, peggior round e giochi forti/deboli', () => {
    const anna = buildFilmStories(history.rounds).get('Anna');

    expect(anna?.best).toEqual({ roundIndex: 2, type: 'MUSIC', points: 200 });
    expect(anna?.worst).toEqual({ roundIndex: 1, type: 'QUIZ', points: 0 });
    expect(anna?.strongestGame).toEqual({ type: 'MUSIC', points: 300, rounds: 2 });
    expect(anna?.weakestGame).toEqual({ type: 'QUIZ', points: 0, rounds: 1 });
  });

  it('misura la rimonta dalla posizione peggiore a quella finale', () => {
    const stories = buildFilmStories(history.rounds);

    // Carla: 2ª, poi 3ª, poi 2ª. Recupera una posizione.
    expect(stories.get('Carla')?.comeback).toBe(1);
    // Anna resta prima; Bruno chiude terzo come il suo punto più basso.
    expect(stories.get('Anna')?.comeback).toBe(0);
    expect(stories.get('Bruno')?.comeback).toBe(0);
  });

  it('ignora round vuoti, righe senza nome e valori non numerici', () => {
    const stories = buildFilmStories([
      { roundIndex: 4, type: null, entries: [] },
      {
        roundIndex: 5,
        type: 'QUIZ',
        entries: [
          { playerName: '  ', points: 10, totalPoints: 10 },
          { playerName: 'Dino', points: Number.NaN, totalPoints: 0 },
        ],
      },
    ]);

    expect(stories.size).toBe(1);
    expect(stories.get('Dino')?.best).toEqual({ roundIndex: 5, type: 'QUIZ', points: 0 });
    expect(stories.get('Dino')?.comeback).toBe(0);
  });

  it('non produce storie senza storico', () => {
    expect(buildFilmStories(null).size).toBe(0);
    expect(buildFilmStories([]).size).toBe(0);
  });

  it('formatta punti e momenti per la scena', () => {
    expect(signedPoints(120)).toBe('+120');
    expect(signedPoints(-40)).toBe('-40');
    expect(signedPoints(0)).toBe('0');
    expect(roundMomentLabel({ roundIndex: 2, type: 'MUSIC', points: 400 }))
      .toBe('R3 · MUSIC · +400');
    expect(gameMomentLabel({ type: 'QUIZ', points: -100, rounds: 2 }))
      .toBe('QUIZ · -100');
    expect(roundMomentLabel(null)).toBe('—');
    expect(gameMomentLabel(null)).toBe('—');
  });
});