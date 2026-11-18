/**
 * Mappa dei sottofondi: la base d'atto e il brano di ogni gioco.
 *
 * <p>È l'unico posto dove si decide cosa suona. `audio.service` legge solo da
 * qui (`bedForGame`, `bedDuckGain`) e non conosce né gli atti né i tipi di
 * gioco: aggiungere un gioco a `GameModeType` senza una riga in `GAME_BEDS`
 * non compila.</p>
 *
 * <p>I cinque file d'atto (`loop/atto-1…5.m4a`) sono nel manifesto ma non
 * ancora consegnati: `READY_ACTS` dice quali sono in cartella, e finché è vuoto
 * la base resta la lobby — meglio il jazz della lobby di un loop che non parte.
 * Un test confronta `READY_ACTS` con i file su disco: appena un atto arriva,
 * scordarselo qui fa fallire la suite.</p>
 */
import { BED_LOOPS } from './bed-loops';
import { ACT_DECKS } from '../../shared/schedule';
import type { GameModeType } from '../../shared/enums/game-mode-type';

/** Un sottofondo in onda: id stabile per i confronti, etichetta e file. */
export interface BedTrack {
  readonly id: string;
  readonly label: string;
  readonly file: string;
}

export type ActNumber = 1 | 2 | 3 | 4 | 5;

/** Gli atti della serata, in ordine. */
export const ACT_NUMBERS: readonly ActNumber[] = [1, 2, 3, 4, 5];

/** Base d'atto: file e carattere sono quelli della tabella del manifesto. */
export const ACT_BEDS: Record<ActNumber, BedTrack> = {
  1: { id: 'atto-1', label: 'Atto 1 — Aperitivo', file: 'loop/atto-1.m4a' },
  2: { id: 'atto-2', label: 'Atto 2 — Si scalda', file: 'loop/atto-2.m4a' },
  3: { id: 'atto-3', label: 'Atto 3 — Notte di sala', file: 'loop/atto-3.m4a' },
  4: { id: 'atto-4', label: 'Atto 4 — Sale l’energia', file: 'loop/atto-4.m4a' },
  5: { id: 'atto-5', label: 'Atto 5 — Finale', file: 'loop/atto-5.m4a' },
};

/**
 * Gli atti con il file già elaborato in `assets/audio/loop`: oggi nessuno.
 * Si allunga di un numero appena il file arriva, e la base dell'atto prende il
 * posto della lobby.
 */
export const READY_ACTS: readonly ActNumber[] = [];

/** Atto valido, `null` per «nessun atto aperto» o un numero fuori scala. */
export function actNumber(value?: number | null): ActNumber | null {
  const rounded = Math.round(Number(value));
  return ACT_NUMBERS.includes(rounded as ActNumber) ? (rounded as ActNumber) : null;
}

/**
 * Base d'atto. Senza atto aperto, fuori scala o con il file non ancora in
 * cartella si torna alla lobby: la serata non resta mai muta, e nessuno deve
 * controllare se il file esiste prima di chiedere la base.
 */
export function actBed(act?: number | null): BedTrack {
  const number = actNumber(act);
  if (number === null || !READY_ACTS.includes(number)) return BED_LOOPS.lobby;
  return ACT_BEDS[number];
}

/** Il gioco non ha un brano suo: suona la base d'atto. */
export const ACT_BASE = 'ACT_BASE';

export type GameBed = BedTrack | typeof ACT_BASE | null;

/**
 * Un gioco per ogni modalità vera: il suo loop, la base d'atto o `null` dove il
 * sottofondo non ci va. Il tipo `Record<GameModeType, …>` è il guardiano.
 */
export const GAME_BEDS: Record<GameModeType, GameBed> = {
  QUIZ: ACT_BASE,
  MUSIC: null,
  IMAGE_BLUR: ACT_BASE,
  WHEEL_OF_FORTUNE: ACT_BASE,
  TIMELINE: ACT_BASE,
  ULTIMA_SPIAGGIA: ACT_BASE,
  ARENA: BED_LOOPS['gioco-bomba'],
  TIME_BUZZER: null,
  BOMBA: BED_LOOPS['gioco-bomba'],
  SPEED_RUSH: BED_LOOPS['gioco-bomba'],
  TENNIS_BATTLE: BED_LOOPS['gioco-tennis'],
  BIGLIE: BED_LOOPS['gioco-tennis'],
  AZZARDO: BED_LOOPS['gioco-casino'],
  BLACKJACK: BED_LOOPS['gioco-casino'],
};

/** Giochi che suonano senza sottofondo: gong, canzoni e silenzio voluto. */
export const SILENT_GAME_TYPES: readonly GameModeType[] = ['MUSIC', 'TIME_BUZZER'];

/**
 * Sottofondo del gioco in corso, `null` quando il gioco vuole silenzio.
 * Lobby e tipi sconosciuti (nessun round aperto) prendono la base d'atto.
 */
export function bedForGame(type?: string | null, act?: number | null): BedTrack | null {
  const key = String(type ?? '').trim();
  const bed = key && key in GAME_BEDS ? GAME_BEDS[key as GameModeType] : ACT_BASE;
  if (bed === null) return null;
  if (bed === ACT_BASE) return actBed(act);
  return bed;
}

/**
 * Cosa si tiene in memoria quando un atto si apre: la sua base e i loop dei
 * giochi che la scaletta mette in quell'atto, una volta ciascuno. Musica e Time
 * Buzzer non compaiono perché il loro silenzio non è un file. Senza atto (o con
 * un numero fuori scala) si carica la lobby, che è la base di ripiego.
 */
export function bedsForAct(act?: number | null): BedTrack[] {
  const number = actNumber(act);
  if (number === null) return [BED_LOOPS.lobby];

  const beds: BedTrack[] = [ACT_BEDS[number]];
  for (const type of ACT_DECKS[number - 1]) {
    const bed = GAME_BEDS[type];
    if (!bed || bed === ACT_BASE) continue;
    if (!beds.some((row) => row.id === bed.id)) beds.push(bed);
  }
  return beds;
}

/**
 * I giochi che, con la domanda aperta, tengono la base d'atto molto bassa per
 * lasciar leggere le risposte: 6 dB sotto il livello normale, non il silenzio.
 */
export const QUESTION_DUCK_GAMES: readonly GameModeType[] = ['QUIZ', 'IMAGE_BLUR'];

/** Quanto scende la base d'atto mentre la domanda è aperta. */
export const QUESTION_DUCK_DB = -6;

export function ducksDuringQuestion(type?: string | null): boolean {
  const key = String(type ?? '').trim() as GameModeType;
  return QUESTION_DUCK_GAMES.includes(key);
}

/**
 * Guadagno da dare al sottofondo: pieno, oppure 0,501 (−6 dB) con la domanda
 * aperta di Quiz o Indovina chi. Musica e Time Buzzer restano a 1: sono già
 * muti, non c'è niente da abbassare.
 */
export function bedDuckGain(type: string | null | undefined, questionOpen: boolean): number {
  if (!questionOpen || !ducksDuringQuestion(type)) return 1;
  return Math.pow(10, QUESTION_DUCK_DB / 20);
}
