/**
 * Sottofondi registrati: la mappa dei file di `assets/audio/loop`.
 *
 * <p>I nomi sono quelli del manifesto (`docs/MANIFESTO-AUDIO.md`): sei file sono
 * già arrivati — lobby, gioco-bomba, gioco-tennis, gioco-casino, gioco-cavallo e
 * classifica — e nella prossima tappa la mappa diventerà `bed-map.ts`, con le
 * basi d'atto e un sottofondo per gioco. Fino ad allora ogni gioco suona il
 * file della sua famiglia e la lobby fa da ripiego.</p>
 *
 * <p>Classifiche e podio hanno una fanfara loro, scelta dalla TV con
 * `setBedLoop('classifica')`: non sono giochi e non passano da
 * `bedLoopForGame`.</p>
 */
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

const GAME_BEDS: Record<string, BedLoopId> = {
  QUIZ: 'lobby',
  MUSIC: 'lobby',
  IMAGE_BLUR: 'lobby',
  TIMELINE: 'lobby',
  ULTIMA_SPIAGGIA: 'lobby',
  BOMBA: 'gioco-bomba',
  ARENA: 'gioco-bomba',
  TIME_BUZZER: 'gioco-bomba',
  SPEED_RUSH: 'gioco-bomba',
  TENNIS_BATTLE: 'gioco-tennis',
  BIGLIE: 'gioco-tennis',
  AZZARDO: 'gioco-casino',
  WHEEL_OF_FORTUNE: 'gioco-casino',
  BLACKJACK: 'gioco-casino',
  CASINO_COLOR: 'gioco-casino',
  CASINO_DOZEN: 'gioco-casino',
  CASINO_NUMBER: 'gioco-casino',
  CAVALLO: 'gioco-cavallo',
};

/** Famiglia del sottofondo per il tipo di gioco in corso. */
export function bedLoopForGame(type?: string | null): BedLoop {
  const key = String(type ?? '').trim();
  const id = key ? GAME_BEDS[key] ?? 'lobby' : 'lobby';
  return BED_LOOPS[id];
}
