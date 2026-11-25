import { BonusType } from './enums/bonus-type';

/**
 * Entrate a sorpresa dei bonus.
 *
 * <p>Dodici ingressi scenografici per i cinque bonus: ogni partita ne usa uno
 * per tipo, sempre diverso dagli altri e scelto da un seme che arriva dal
 * server. Il seme è stabile per la partita, quindi un refresh della TV non
 * cambia l'ingresso e non lo rigioca.</p>
 *
 * <p>Non c'è nessun elenco in regia né nei manuali: qui vivono solo i dati che
 * la TV usa nel momento in cui il bonus parte.</p>
 */
export interface BonusEntranceEntry {
  id: string;
  type: BonusType;
  /** Riga sopra il titolo: è la sorpresa, non il nome del bonus. */
  kicker: string;
  icon: string;
  /** Movimento dell'overlay: uno dei cinque già previsti dal componente. */
  motion: 'sweep' | 'alarm' | 'drop' | 'slam' | 'spin';
  /** Evento del catalogo audio: nessun file nuovo, si usa ciò che c'è. */
  sound: string;
  /** Variante del suono quando l'evento ne ha più di una. */
  variant?: number;
}

export const BONUS_ENTRANCE_POOL: readonly BonusEntranceEntry[] = [
  // KARAOKE
  {
    id: 'karaoke-spot',
    type: 'KARAOKE',
    kicker: 'SI ACCENDE IL PALCO',
    icon: '🎤',
    motion: 'sweep',
    sound: 'bonusEntrance',
    variant: 3,
  },
  {
    id: 'karaoke-microfono',
    type: 'KARAOKE',
    kicker: 'MICROFONO LIBERO',
    icon: '🎶',
    motion: 'drop',
    sound: 'uuuh',
  },
  {
    id: 'karaoke-sipario',
    type: 'KARAOKE',
    kicker: 'SIPARIO APERTO',
    icon: '🎭',
    motion: 'slam',
    sound: 'applause',
  },
  // BLACKJACK
  {
    id: 'blackjack-banco',
    type: 'BLACKJACK',
    kicker: 'IL BANCO SI APRE',
    icon: '🃏',
    motion: 'slam',
    sound: 'bonusEntrance',
    variant: 1,
  },
  {
    id: 'blackjack-carte',
    type: 'BLACKJACK',
    kicker: 'CARTE IN ARIA',
    icon: '🎴',
    motion: 'drop',
    sound: 'whoosh',
  },
  // CASINO 5 MANCHE
  {
    id: 'five-tavolo',
    type: 'CASINO_FIVE',
    kicker: 'CINQUE GIRI, UN TAVOLO',
    icon: '🎰',
    motion: 'spin',
    sound: 'bonusEntrance',
    variant: 0,
  },
  {
    id: 'five-campanelli',
    type: 'CASINO_FIVE',
    kicker: 'CINQUE CAMPANELLI',
    icon: '🔔',
    motion: 'alarm',
    sound: 'bell',
  },
  {
    id: 'five-pallina',
    type: 'CASINO_FIVE',
    kicker: 'LA PALLINA NON SI FERMA',
    icon: '⚪',
    motion: 'sweep',
    sound: 'rouletteTicks',
  },
  // CAVALLO
  {
    id: 'cavallo-cancelli',
    type: 'CAVALLO',
    kicker: 'AI CANCELLI',
    icon: '🐎',
    motion: 'slam',
    sound: 'bonusEntrance',
    variant: 3,
  },
  {
    id: 'cavallo-tamburi',
    type: 'CAVALLO',
    kicker: 'TAMBURI DI PARTENZA',
    icon: '🥁',
    motion: 'drop',
    sound: 'drumroll',
  },
  // CASINO NUMERO
  {
    id: 'numero-ultimo-giro',
    type: 'CASINO_NUMBER',
    kicker: 'ULTIMO GIRO',
    icon: '🎯',
    motion: 'spin',
    sound: 'bonusEntrance',
    variant: 4,
  },
  {
    id: 'numero-silenzio',
    type: 'CASINO_NUMBER',
    kicker: 'SILENZIO IN SALA',
    icon: '🤫',
    motion: 'drop',
    sound: 'explosion',
  },
];

const TYPES: readonly BonusType[] = [
  'KARAOKE',
  'BLACKJACK',
  'CASINO_FIVE',
  'CAVALLO',
  'CASINO_NUMBER',
];

/** PRNG del seme: stesso seme, stessa serata. */
function seeded(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ingressi della partita: uno per bonus, stabile rispetto al seme. */
export function planBonusEntrances(seed: number): Record<BonusType, BonusEntranceEntry> {
  const next = seeded(seed);
  const plan = {} as Record<BonusType, BonusEntranceEntry>;
  for (const type of TYPES) {
    const variants = BONUS_ENTRANCE_POOL.filter((entry) => entry.type === type);
    plan[type] = variants[Math.floor(next() * variants.length)];
  }
  return plan;
}

/** L'ingresso del bonus che sta partendo. */
export function bonusEntranceFor(type: BonusType, seed: number): BonusEntranceEntry {
  return planBonusEntrances(seed)[type];
}
