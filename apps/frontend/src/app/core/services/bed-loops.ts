/**
 * Sottofondi registrati: la mappa dei file di `assets/audio/loop`.
 *
 * <p>I nomi sono quelli del manifesto (`docs/MANIFESTO-AUDIO.md`): sei file sono
 * già arrivati — lobby, gioco-bomba, gioco-tennis, gioco-casino, gioco-cavallo e
 * classifica — e nella prossima tappa la mappa diventerà `bed-map.ts`, con le
 * basi d'atto. Fino ad allora ogni gioco suona il file della sua famiglia e la
 * lobby fa da ripiego.</p>
 *
 * <p>La mappa è tipata su `GameModeType`: un gioco nuovo non compila finché non
 * gli si assegna un sottofondo o non lo si dichiara muto. Musica e Time Buzzer
 * suonano nel silenzio (`null`): il gong e le canzoni non vogliono un tappeto
 * sotto.</p>
 *
 * <p>Classifiche e podio hanno una fanfara loro, scelta dalla TV con
 * `setBedLoop('classifica')`: non sono giochi e non passano da `bedForGame`.</p>
 */
import type { GameModeType } from '../../shared/enums/game-mode-type';

export type BedLoopId =
  | 'lobby'
  | 'gioco-bomba'
  | 'gioco-tennis'
  | 'gioco-casino'
  | 'gioco-cavallo'
  | 'classifica';

export interface BedLoop {
  id: BedLoopId;
  /** Nome della famiglia, come lo legge la regia. */
  label: string;
  /** Percorso dentro `assets/audio`. */
  file: string;
}

export const BED_LOOPS: Record<BedLoopId, BedLoop> = {
  lobby: { id: 'lobby', label: 'Lobby', file: 'loop/lobby.m4a' },
  'gioco-bomba': { id: 'gioco-bomba', label: 'Bomba', file: 'loop/gioco-bomba.m4a' },
  'gioco-tennis': { id: 'gioco-tennis', label: 'Tennis', file: 'loop/gioco-tennis.m4a' },
  'gioco-casino': { id: 'gioco-casino', label: 'Casino', file: 'loop/gioco-casino.m4a' },
  'gioco-cavallo': { id: 'gioco-cavallo', label: 'Cavallo', file: 'loop/gioco-cavallo.m4a' },
  classifica: { id: 'classifica', label: 'Classifica e podio', file: 'loop/classifica.m4a' },
};

/**
 * Un gioco per ogni modalità vera, `null` dove il sottofondo non ci va.
 * Il tipo `Record<GameModeType, …>` è il guardiano: aggiungere un gioco a
 * `GameModeType` senza una riga qui è un errore di compilazione.
 */
export const GAME_BEDS: Record<GameModeType, BedLoop | null> = {
  QUIZ: BED_LOOPS.lobby,
  MUSIC: null,
  IMAGE_BLUR: BED_LOOPS.lobby,
  WHEEL_OF_FORTUNE: BED_LOOPS.lobby,
  TIMELINE: BED_LOOPS.lobby,
  ULTIMA_SPIAGGIA: BED_LOOPS.lobby,
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
 * Lobby e tipi sconosciuti (nessun round aperto) riprendono il file della lobby.
 */
export function bedForGame(type?: string | null): BedLoop | null {
  const key = String(type ?? '').trim();
  if (!key) return BED_LOOPS.lobby;
  if (!(key in GAME_BEDS)) return BED_LOOPS.lobby;
  return GAME_BEDS[key as GameModeType];
}
