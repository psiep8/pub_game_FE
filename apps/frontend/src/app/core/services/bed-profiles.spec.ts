import {
  BED_PROFILES,
  bedBar,
  bedChord,
  bedForGame,
  bedLoopBars,
  bedSection,
  bedSecondsPerBar,
  bedSecondsPerBeat,
  midiToFrequency,
  type BedProfile,
} from './bed-profiles';

const GAMES = [
  'QUIZ',
  'MUSIC',
  'IMAGE_BLUR',
  'TIMELINE',
  'WHEEL_OF_FORTUNE',
  'TIME_BUZZER',
  'BOMBA',
  'SPEED_RUSH',
  'TENNIS_BATTLE',
  'ARENA',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BLACKJACK',
  'BIGLIE',
  'CAVALLO',
];

const profiles = Object.values(BED_PROFILES);

describe('tappeti musicali', () => {
  it('dà a ogni gioco un tappeto proprio, riconoscibile', () => {
    const ids = GAMES.map((game) => bedForGame(game).id);
    expect(ids).toHaveLength(GAMES.length);
    // Nessun gioco condivide il tappeto con un altro.
    expect(new Set(ids).size).toBe(GAMES.length);

    // I tappeti differiscono almeno per tempo o per giro armonico.
    const fingerprints = new Set(
      GAMES.map((game) => {
        const profile = bedForGame(game);
        return `${profile.bpm}-${profile.chords.map((c) => c.name).join('|')}`;
      }),
    );
    expect(fingerprints.size).toBeGreaterThanOrEqual(GAMES.length - 1);
  });

  it('tiene la lobby e i tipi sconosciuti sul tappeto del pub', () => {
    expect(bedForGame(null).id).toBe('lobby');
    expect(bedForGame(undefined).id).toBe('lobby');
    expect(bedForGame('').id).toBe('lobby');
    expect(bedForGame('GIOCO_INVENTATO').id).toBe('lobby');
    expect(bedForGame('lobby').id).toBe('lobby');
  });

  it('conta le battute dal tempo del tappeto', () => {
    for (const profile of profiles) {
      expect(bedSecondsPerBeat(profile), profile.id).toBeCloseTo(60 / profile.bpm, 8);
      expect(bedSecondsPerBar(profile), profile.id).toBeCloseTo((60 / profile.bpm) * 4, 8);
      expect(bedLoopBars(profile), profile.id).toBe(profile.chords.length * 2);
    }
    const tempi = new Set(profiles.map((profile) => profile.bpm));
    expect(tempi.size).toBeGreaterThanOrEqual(8);
  });

  it('genera battute deterministiche con note dentro la battuta', () => {
    for (const profile of profiles) {
      for (const bar of [0, 1, 7, 8, 33, 97]) {
        const first = bedBar(profile, bar);
        const second = bedBar(profile, bar);
        expect(second, `${profile.id}/${bar}`).toEqual(first);
        expect(first.notes.length, `${profile.id}/${bar}`).toBeGreaterThan(0);
        for (const note of first.notes) {
          expect(note.beat, profile.id).toBeGreaterThanOrEqual(0);
          expect(note.beat, profile.id).toBeLessThan(4);
          expect(note.duration, profile.id).toBeGreaterThan(0);
          expect(note.gain, profile.id).toBeGreaterThan(0);
          expect(note.gain, profile.id).toBeLessThanOrEqual(0.011);
          expect(note.midi, profile.id).toBeGreaterThanOrEqual(0);
          expect(note.midi, profile.id).toBeLessThanOrEqual(96);
        }
      }
    }
  });

  it('alterna gli accordi ogni due battute e chiude il giro', () => {
    const profile: BedProfile = BED_PROFILES['quiz'];
    expect(bedBar(profile, 0).chord).toBe('Dmaj7');
    expect(bedBar(profile, 1).chord).toBe('Dmaj7');
    expect(bedBar(profile, 2).chord).toBe('Bm7');
    const loop = bedLoopBars(profile);
    expect(bedChord(profile, loop + 2).name).toBe(bedChord(profile, 2).name);
    expect(bedChord(profile, 0)).toEqual(profile.chords[0]);
  });

  it('fa entrare la voce melodica solo dopo la prima sezione', () => {
    for (const profile of profiles) {
      if (profile.colour === 'none') continue;
      const opening = bedBar(profile, 0).notes.filter((note) =>
        ['vibes', 'marimba', 'glass', 'epiano'].includes(note.voice),
      );
      const later = bedBar(profile, 32 * 1).notes.filter((note) =>
        ['vibes', 'marimba', 'glass'].includes(note.voice),
      );
      expect(bedSection(32), profile.id).toBe(1);
      if (profile.colour !== 'epiano') {
        expect(later.length, profile.id).toBeGreaterThan(0);
      }
      // L'apertura non ha note più acute della melodia del profilo.
      const topOpening = Math.max(...opening.map((note) => note.midi), 0);
      if (profile.colour !== 'epiano') {
        expect(topOpening, profile.id).toBeLessThan(Math.max(...profile.melody));
      }
    }
  });

  it('converte il MIDI in frequenza', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(81)).toBeCloseTo(880, 5);
    expect(midiToFrequency(0)).toBeGreaterThan(0);
  });
});
