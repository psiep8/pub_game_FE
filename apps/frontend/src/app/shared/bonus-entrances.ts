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
  // NERO O ROSSO
  {
    id: 'color-luci',
    type: 'CASINO_COLOR',
    kicker: 'LUCI SUL TAVOLO',
    icon: '🔴',
    motion: 'sweep',
    sound: 'bonusEntrance',
    variant: 0,
  },
  {
    id: 'color-sirena',
    type: 'CASINO_COLOR',
    kicker: 'SIRENA ROSSA',
    icon: '🚨',
    motion: 'alarm',
    sound: 'bombSiren',
  },
  {
    id: 'color-monete',
    type: 'CASINO_COLOR',
    kicker: 'PUNTATE SUL VERDE',
    icon: '🪙',
    motion: 'spin',
    sound: 'coins',
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
  // DODICI PER VOLTA
  {
    id: 'dozzina-allarme',
    type: 'CASINO_DOZEN',
    kicker: 'ALLARME DOZZINA',
    icon: '🎰',
    motion: 'alarm',
    sound: 'bonusEntrance',
    variant: 2,
  },
  {
    id: 'dozzina-campanelli',
    type: 'CASINO_DOZEN',
    kicker: 'TRE CAMPANELLI',
    icon: '🔔',
    motion: 'spin',
    sound: 'bell',
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
  // UN NUMERO, TUTTO
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
    id: 'numero-pallina',
    type: 'CASINO_NUMBER',
    kicker: 'LA PALLINA IMPAZZISCE',
    icon: '🎲',
    motion: 'sweep',
    sound: 'rouletteTicks',
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
  'CASINO_COLOR',
  'BLACKJACK',
  'CASINO_DOZEN',
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
