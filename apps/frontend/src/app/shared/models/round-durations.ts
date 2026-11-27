import { GameModeType } from './game-mode-type';
import { ACT_DECKS, SCHEDULE } from '../schedule';
import { GAME_TIMINGS } from './game-timings';
import { QUIZ_ROUND_SECONDS } from '../../features/games/quiz/quiz.mode';
import { MUSIC_ROUND_SECONDS } from '../../features/games/song/music.mode';
import { TIME_BUZZER_ROUND_SECONDS } from '../../features/games/time-buzzer/time-buzzer.mode';
import { BOMBA_TURN_SECONDS } from '../../features/games/bomba/bomba.mode';
import { BIGLIE_ROUND_SECONDS } from '../../features/games/biglie/biglie.component';
import { AZZARDO_ROUND_SECONDS } from '../../features/games/azzardo/azzardo.mode';
import { SPEED_RUSH_ROUND_SECONDS } from '../../features/games/speed-rush/speed-rush.mode';
import { TENNIS_ROUND_SECONDS } from '../../features/games/tennis-battle/tennis-battle.mode';
import { ARENA_ROUND_SECONDS } from '../../features/games/arena/arena.mode';
import { ULTIMA_SPIAGGIA_ROUND_SECONDS } from '../../features/games/ultima-spiaggia/ultima-spiaggia.mode';

/**
 * Quanto dura un round, ricavato dai tempi dichiarati dai giochi.
 *
 * <p>I numeri non si scrivono qui: ogni gioco espone la propria durata accanto
 * alle costanti che la compongono, così cambiare un timer aggiorna anche la
 * tabella degli atti. `docs/TEMPI-SERATA.md` è generata da questi valori e
 * `round-durations.spec.ts` fallisce se il documento non combacia più.</p>
 *
 * <p>Conta il tempo di gioco: intro, classifiche e bonus restano fuori, perché
 * non sono tempi di round e dipendono dalla regia.</p>
 */
const ROUND_SECONDS: Record<Exclude<GameModeType, 'BOMBA' | 'BLACKJACK'>, number> = {
  QUIZ: QUIZ_ROUND_SECONDS,
  MUSIC: MUSIC_ROUND_SECONDS,
  IMAGE_BLUR: GAME_TIMINGS.IMAGE_BLUR.manches * GAME_TIMINGS.IMAGE_BLUR.seconds,
  WHEEL_OF_FORTUNE: GAME_TIMINGS.WHEEL_OF_FORTUNE.seconds,
  TIMELINE: GAME_TIMINGS.TIMELINE.seconds,
  TIME_BUZZER: TIME_BUZZER_ROUND_SECONDS,
  AZZARDO: AZZARDO_ROUND_SECONDS,
  SPEED_RUSH: SPEED_RUSH_ROUND_SECONDS,
  TENNIS_BATTLE: TENNIS_ROUND_SECONDS,
  ARENA: ARENA_ROUND_SECONDS,
  ULTIMA_SPIAGGIA: ULTIMA_SPIAGGIA_ROUND_SECONDS,
  BIGLIE: BIGLIE_ROUND_SECONDS,
};

/** Nome del gioco come lo legge il presentatore. */
export const GAME_LABEL: Record<GameModeType, string> = {
  QUIZ: 'Quiz',
  MUSIC: 'Musica',
  IMAGE_BLUR: 'Indovina chi',
  WHEEL_OF_FORTUNE: 'Ruota della fortuna',
  TIMELINE: 'Timeline',
  TIME_BUZZER: 'Time Buzzer',
  BOMBA: 'Bomba',
  TENNIS_BATTLE: 'Tennis Battle',
  ULTIMA_SPIAGGIA: 'Ultima spiaggia',
  AZZARDO: 'Azzardo',
  BLACKJACK: 'Black Jack',
  ARENA: 'Arena Battle Royale',
  SPEED_RUSH: 'Speed Rush',
  BIGLIE: 'Biglie',
};

/**
 * Secondi di gioco di un round. La Bomba è l'unica che dipende dalla sala:
 * ogni squadra gioca il suo turno, quindi il round dura quanto le squadre.
 */
export function roundSeconds(mode: GameModeType, teams: number): number {
  if (mode === 'BOMBA') return Math.max(1, Math.round(teams)) * BOMBA_TURN_SECONDS;
  // Il Black Jack non è nella scaletta: resta solo come bonus.
  return ROUND_SECONDS[mode as keyof typeof ROUND_SECONDS] ?? 0;
}

/** Secondi di gioco di un atto (indice 0-based). */
export function actSeconds(act: number, teams: number): number {
  return (ACT_DECKS[act] ?? []).reduce((total, mode) => total + roundSeconds(mode, teams), 0);
}

/** Secondi di gioco dei quaranta round, senza classifiche né bonus. */
export function serataSeconds(teams: number): number {
  return SCHEDULE.reduce((total, mode) => total + roundSeconds(mode, teams), 0);
}

/** `11'51"` per la tabella. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}'${String(rest).padStart(2, '0')}"`;
}

/** Le righe del documento, in un posto solo: le usa anche il test. */
export interface TimingRow {
  mode: GameModeType;
  label: string;
  seconds: number;
}

export function roundTimingRows(): TimingRow[] {
  return (Object.keys(GAME_LABEL) as GameModeType[])
    .filter((mode) => mode !== 'BLACKJACK')
    .map((mode) => ({
      mode,
      label: GAME_LABEL[mode],
      // La Bomba si mostra a otto squadre: la colonna "come nasce" spiega che
      // in sala cresce di venti secondi per squadra.
      seconds: roundSeconds(mode, 8),
    }));
}
