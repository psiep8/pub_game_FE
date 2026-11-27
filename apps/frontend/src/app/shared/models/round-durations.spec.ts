import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACT_DECKS, SCHEDULE } from '../schedule';
import { GAME_TIMINGS } from './game-timings';
import {
  actSeconds,
  formatDuration,
  GAME_LABEL,
  roundSeconds,
  roundTimingRows,
  serataSeconds,
} from './round-durations';

// I test girano dalla radice del workspace frontend: il documento sta due
// cartelle sopra, nella radice del repository.
const DOC = '../../docs/TEMPI-SERATA.md';
const TEAM_SIZES = [4, 8, 10, 14, 20];

function docText(): string {
  return readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n');
}

describe('M-04: tempi per atto', () => {
  it('ogni gioco della scaletta dichiara la sua durata', () => {
    for (const mode of SCHEDULE) {
      expect(roundSeconds(mode, 8), `durata mancante per ${mode}`).toBeGreaterThan(0);
    }
  });

  it('Quiz, Musica e Indovina chi seguono i tempi ufficiali', () => {
    expect(roundSeconds('QUIZ', 8)).toBe(
      GAME_TIMINGS.QUIZ.manches * (GAME_TIMINGS.QUIZ.mancheSeconds + 3),
    );
    expect(roundSeconds('MUSIC', 8)).toBe(
      GAME_TIMINGS.MUSIC.manches * (
        GAME_TIMINGS.MUSIC.listenSeconds[0]
        + GAME_TIMINGS.MUSIC.buzzSeconds
        + GAME_TIMINGS.MUSIC.listenSeconds[1]
        + GAME_TIMINGS.MUSIC.buzzSeconds
        + GAME_TIMINGS.MUSIC.revealSeconds
      ),
    );
    expect(roundSeconds('IMAGE_BLUR', 8)).toBe(
      GAME_TIMINGS.IMAGE_BLUR.manches * GAME_TIMINGS.IMAGE_BLUR.seconds,
    );
  });

  it('la Bomba cresce con la sala, gli altri no', () => {
    expect(roundSeconds('BOMBA', 4)).toBe(80);
    expect(roundSeconds('BOMBA', 20)).toBe(400);
    expect(roundSeconds('QUIZ', 4)).toBe(roundSeconds('QUIZ', 20));
  });

  it('gli atti sommano i loro otto round', () => {
    for (let act = 0; act < ACT_DECKS.length; act += 1) {
      const manual = ACT_DECKS[act].reduce((total, mode) => total + roundSeconds(mode, 10), 0);
      expect(actSeconds(act, 10)).toBe(manual);
    }
    expect(serataSeconds(10)).toBe(
      ACT_DECKS.reduce((total, _deck, act) => total + actSeconds(act, 10), 0),
    );
  });

  it('la tabella del documento combacia con il codice', () => {
    const doc = docText();

    for (const row of roundTimingRows()) {
      expect(doc, `riga mancante per ${row.mode}`).toContain(
        `| ${row.label} | ${formatDuration(row.seconds)} |`,
      );
    }

    for (let act = 0; act < ACT_DECKS.length; act += 1) {
      expect(doc, `atto ${act + 1} mancante`).toContain(
        `| ${act + 1} | ${formatDuration(actSeconds(act, 8))} | ${formatDuration(actSeconds(act, 20))} |`,
      );
    }

    for (const teams of TEAM_SIZES) {
      expect(doc, `serata con ${teams} squadre`).toContain(
        `| ${teams} | ${formatDuration(serataSeconds(teams))} |`,
      );
    }
  });

  it('in sala servono cinque atti e la Bomba due volte', () => {
    expect(ACT_DECKS).toHaveLength(5);
    expect(SCHEDULE).toHaveLength(40);
    expect(SCHEDULE.filter((mode) => mode === 'BOMBA')).toHaveLength(2);
    // Le etichette del documento non devono contenere codici interni.
    for (const label of Object.values(GAME_LABEL)) {
      expect(label).not.toMatch(/[A-Z]{3,}_/);
    }
  });
});
