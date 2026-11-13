import { DEMO_SCRIPTS } from '../../features/tv/demo-scripts';
import { BONUS_TYPES } from '../enums/bonus-type';
import { GAME_TIMINGS } from '../models/game-timings';
import { MANUAL_ENTRIES } from './manual-content';

/**
 * Demo e manuale raccontano le stesse regole del gioco.
 *
 * Se una pagina cita un tempo diverso da quello vero (per esempio “200
 * secondi” quando le manche sono da 30) questo test fallisce: è il modo per
 * non lasciare il pubblico con istruzioni sbagliate.
 */
const SECONDS_CITED: Record<string, readonly number[]> = {
  QUIZ: [GAME_TIMINGS.QUIZ.mancheSeconds],
  MUSIC: [GAME_TIMINGS.MUSIC.mancheSeconds],
  IMAGE_BLUR: [GAME_TIMINGS.IMAGE_BLUR.seconds, GAME_TIMINGS.IMAGE_BLUR.clueEverySeconds],
  WHEEL_OF_FORTUNE: [GAME_TIMINGS.WHEEL_OF_FORTUNE.seconds],
  TIMELINE: [GAME_TIMINGS.TIMELINE.seconds],
  TIME_BUZZER: [
    GAME_TIMINGS.TIME_BUZZER.mancheSeconds,
    GAME_TIMINGS.TIME_BUZZER.minTargetSeconds,
    GAME_TIMINGS.TIME_BUZZER.maxTargetSeconds,
  ],
  BOMBA: [20],
  SPEED_RUSH: [60],
  TENNIS_BATTLE: [12],
  ARENA: [],
  AZZARDO: [15],
  BLACKJACK: [15],
  ULTIMA_SPIAGGIA: [15],
  BONUS_CASINO: [],
  BONUS_BASKET: [20],
  BONUS_CAVALLO: [],
  BONUS_BIGLIE: [],
};

const MANCHES_CITED: Record<string, readonly number[]> = {
  QUIZ: [GAME_TIMINGS.QUIZ.manches],
  MUSIC: [GAME_TIMINGS.MUSIC.manches],
  TIME_BUZZER: [GAME_TIMINGS.TIME_BUZZER.manches],
};

function numbers(text: string, unit: RegExp): number[] {
  return [...text.matchAll(unit)].map((match) => Number(match[1]));
}

const SECONDS = /(\d+)\s*(?:secondi|\bs\b)/gi;
const MANCHES = /(\d+)\s*manch/gi;

function expectKnown(key: string, text: string): void {
  const allowedSeconds = SECONDS_CITED[key] ?? [];
  for (const seconds of numbers(text, SECONDS)) {
    expect(
      allowedSeconds,
      `${key}: il testo cita ${seconds} secondi, il gioco non li prevede`,
    ).toContain(seconds);
  }
  const allowedManches = MANCHES_CITED[key] ?? [];
  for (const manche of numbers(text, MANCHES)) {
    expect(allowedManches, `${key}: il testo cita ${manche} manche`).toContain(manche);
  }
}

describe('demo e manuale allineati ai tempi del gioco', () => {
  it('ogni scheda del manuale cita i secondi veri', () => {
    for (const entry of MANUAL_ENTRIES) {
      expectKnown(entry.key, [entry.summary, entry.objective, ...entry.phone, entry.tip].join(' '));
    }
  });

  it('ogni demo cita i secondi veri', () => {
    for (const [key, script] of Object.entries(DEMO_SCRIPTS)) {
      if (key === 'INTRO') continue;
      // Le cinque scene sono obiettivo, telefono, vittoria, sconfitta, esempio.
      const text = [
        ...script.scenes.flatMap((scene) => [scene.title, ...scene.lines]),
        ...script.scoring.map((row) => row.value),
        script.note,
      ].join(' ');
      expectKnown(key, text);
    }
  });

  it('ogni gioco e bonus della serata ha una voce di tempi dichiarata', () => {
    for (const key of [...Object.keys(DEMO_SCRIPTS), ...BONUS_TYPES.map((t) => `BONUS_${t}`)]) {
      if (key === 'INTRO') continue;
      expect(SECONDS_CITED, `tempi non dichiarati per ${key}`).toHaveProperty(key);
    }
  });
});
