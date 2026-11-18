/**
 * Sottofondi registrati: la mappa dei file di `assets/audio/loop`.
 *
 * <p>I nomi sono quelli del manifesto (`docs/MANIFESTO-AUDIO.md`): sei file sono
 * già arrivati — lobby, gioco-bomba, gioco-tennis, gioco-casino, gioco-cavallo e
 * classifica. Questo file è il registro dei file; <b>chi suona cosa</b> sta in
 * `bed-map.ts`, che sceglie fra loop del gioco, base d'atto e silenzio.</p>
 *
 * <p>Classifiche e podio hanno una fanfara loro, scelta dalla TV con
 * `setBedLoop('classifica')`: non sono giochi e non passano da `bedForGame`.</p>
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
