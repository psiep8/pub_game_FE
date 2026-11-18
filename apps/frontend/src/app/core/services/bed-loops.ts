/**
 * Sottofondi registrati: sei famiglie di loop, non più sedici tappeti generati.
 *
 * <p>Ogni gioco suona uno dei file di `assets/audio/loop`: jazz da pub per i
 * quiz, percussioni in salita per i giochi a tempo, rock dritto per lo sport,
 * lounge da sala giochi per il Casino e la marimba per il Cavallo. Classifiche
 * e podio hanno una fanfara loro, scelta dalla TV con `setBedLoop('classifica')`:
 * non sono giochi e non passano da `bedLoopForGame`. Il file è lo stesso per
 * tutta la famiglia: cambiare gioco cambia disco, non musica suonata al volo.</p>
 *
 * <p>Il manifesto (`docs/MANIFESTO-AUDIO.md`) assegna ogni gioco alla sua
 * famiglia; qui c'è la stessa mappa in codice, con il pub come ripiego per la
 * lobby e per un tipo che non conosciamo.</p>
 */
export type BedLoopId = 'pub' | 'tensione' | 'sport' | 'casino' | 'leggero' | 'classifica';

export interface BedLoop {
  id: BedLoopId;
  /** Nome della famiglia, come lo legge la regia. */
  label: string;
  /** Percorso dentro `assets/audio`. */
  file: string;
}

export const BED_LOOPS: Record<BedLoopId, BedLoop> = {
  pub: { id: 'pub', label: 'Pub allegro', file: 'loop/pub.m4a' },
  tensione: { id: 'tensione', label: 'Tensione', file: 'loop/tensione.m4a' },
  sport: { id: 'sport', label: 'Sport', file: 'loop/sport.m4a' },
  casino: { id: 'casino', label: 'Casino', file: 'loop/casino.m4a' },
  leggero: { id: 'leggero', label: 'Leggero e curioso', file: 'loop/leggero.m4a' },
  classifica: { id: 'classifica', label: 'Classifica e podio', file: 'loop/classifica.m4a' },
};

const GAME_BEDS: Record<string, BedLoopId> = {
  QUIZ: 'pub',
  MUSIC: 'pub',
  IMAGE_BLUR: 'pub',
  TIMELINE: 'pub',
  ULTIMA_SPIAGGIA: 'pub',
  BOMBA: 'tensione',
  ARENA: 'tensione',
  TIME_BUZZER: 'tensione',
  SPEED_RUSH: 'tensione',
  TENNIS_BATTLE: 'sport',
  BIGLIE: 'sport',
  AZZARDO: 'casino',
  WHEEL_OF_FORTUNE: 'casino',
  BLACKJACK: 'casino',
  CASINO_COLOR: 'casino',
  CASINO_DOZEN: 'casino',
  CASINO_NUMBER: 'casino',
  CAVALLO: 'leggero',
};

/** Famiglia del sottofondo per il tipo di gioco in corso. */
export function bedLoopForGame(type?: string | null): BedLoop {
  const key = String(type ?? '').trim();
  const id = key ? GAME_BEDS[key] ?? 'pub' : 'pub';
  return BED_LOOPS[id];
}
