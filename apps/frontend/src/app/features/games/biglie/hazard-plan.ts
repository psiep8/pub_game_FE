/**
 * Ostacoli delle piste delle Biglie.
 *
 * Sta qui e non nel componente perché la stessa lista deve valere per la TV e
 * per la simulazione headless: se cambia un ostacolo, cambiano tutti e due.
 */
export type HazardKind =
  | 'fango'
  | 'pozzanghera'
  | 'sasso'
  | 'cordolo'
  | 'cumulo'
  | 'ghiaccio'
  | 'onda'
  | 'boa'
  | 'scoglio'
  | 'sabbia'
  | 'meteorite'
  | 'magma'
  | 'paracarro'

export interface Hazard {
  id: string;
  kind: HazardKind;
  progress: number;
  offset: number;
  radius: number;
  patch: boolean;
}

export const HAZARD_PLANS: Record<string, HazardKind[]> = {
  rally: ['fango', 'sasso', 'pozzanghera', 'paracarro', 'fango', 'sasso', 'pozzanghera', 'paracarro', 'fango', 'sasso', 'pozzanghera', 'paracarro', 'fango', 'sasso', 'pozzanghera', 'paracarro', 'fango', 'sasso', 'pozzanghera', 'paracarro', 'fango', 'sasso', 'pozzanghera', 'paracarro'],
  // Asfalto: più chiazze di ghiaccio che paracarri. Sul dritto lisciava troppo
  // e chi era davanti restava davanti: il ghiaccio dà il guizzo che rimescola.
  f1: ['cordolo', 'ghiaccio', 'paracarro', 'sasso', 'ghiaccio', 'cordolo', 'cordolo', 'ghiaccio', 'paracarro', 'sasso', 'ghiaccio', 'cordolo', 'cordolo', 'ghiaccio', 'paracarro', 'sasso', 'ghiaccio', 'cordolo', 'cordolo', 'ghiaccio', 'paracarro', 'sasso', 'ghiaccio', 'cordolo'],
  neve: ['cumulo', 'ghiaccio', 'paracarro', 'cumulo', 'sasso', 'ghiaccio', 'cumulo', 'ghiaccio', 'paracarro', 'cumulo', 'sasso', 'ghiaccio', 'cumulo', 'ghiaccio', 'paracarro', 'cumulo', 'sasso', 'ghiaccio', 'cumulo', 'ghiaccio', 'paracarro', 'cumulo', 'sasso', 'ghiaccio'],
  acqua: ['onda', 'boa', 'scoglio', 'paracarro', 'onda', 'boa', 'scoglio', 'onda', 'boa', 'paracarro', 'onda', 'boa', 'scoglio', 'onda', 'boa', 'paracarro', 'onda', 'boa', 'scoglio', 'onda', 'boa', 'paracarro', 'onda', 'boa'],
  // I quattro fondi nuovi hanno ostacoli propri, non solo un colore diverso.
  vetro: ['ghiaccio', 'sasso', 'paracarro', 'ghiaccio', 'ghiaccio', 'sasso', 'ghiaccio', 'sasso', 'paracarro', 'ghiaccio', 'ghiaccio', 'sasso', 'ghiaccio', 'sasso', 'paracarro', 'ghiaccio', 'ghiaccio', 'sasso', 'ghiaccio', 'sasso', 'paracarro', 'ghiaccio', 'ghiaccio', 'sasso'],
  sabbia: ['sabbia', 'sasso', 'paracarro', 'sabbia', 'sasso', 'sasso', 'paracarro', 'sasso', 'sabbia', 'sasso', 'paracarro', 'sasso', 'sabbia', 'sasso', 'sasso', 'paracarro', 'sabbia', 'sasso', 'paracarro', 'sasso', 'sasso', 'paracarro', 'sasso', 'paracarro'],
  spazio: ['meteorite', 'paracarro', 'meteorite', 'sasso', 'paracarro', 'meteorite', 'meteorite', 'paracarro', 'meteorite', 'sasso', 'paracarro', 'meteorite', 'meteorite', 'paracarro', 'meteorite', 'sasso', 'paracarro', 'meteorite', 'meteorite', 'paracarro', 'meteorite', 'sasso', 'paracarro', 'meteorite'],
  magma: ['magma', 'sasso', 'paracarro', 'magma', 'magma', 'sasso', 'magma', 'sasso', 'paracarro', 'magma', 'magma', 'sasso', 'magma', 'sasso', 'paracarro', 'magma', 'magma', 'sasso', 'magma', 'sasso', 'paracarro', 'magma', 'magma', 'sasso'],
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ostacoli della gara: 52 sulla pista intera, uno ogni ~300 px, distanziati con
 * un po' di jitter dal seme. Stesso seme, stessi ostacoli in TV e in prova.
 */
export function buildHazards(trackId: string, seed: number): Hazard[] {
  const rng = seededRandom((seed >>> 0) ^ 0x7f4a7c15);
  const base = HAZARD_PLANS[trackId] ?? HAZARD_PLANS['rally'];
  const deck: HazardKind[] = [];
  for (let index = 0; index < 52; index++) {
    deck.push(base[Math.floor(rng() * base.length)]);
  }
  const hazards: Hazard[] = [];
  const slot = 0.9 / deck.length;

  deck.forEach((kind, index) => {
    const progress = 0.05 + slot * (index + 0.15 + rng() * 0.7);

    const patch =
      kind === 'fango'
      || kind === 'pozzanghera'
      || kind === 'ghiaccio'
      || kind === 'sabbia'
      || kind === 'magma';
    const solid =
      kind === 'sasso'
      || kind === 'scoglio'
      || kind === 'paracarro';
    hazards.push({
      id: `hazard-${trackId}-${index}`,
      kind,
      progress,
      // I corpi solidi stanno a ridosso del muro: non chiudono mai la corsia,
      // nemmeno nelle strettoie. I meteoriti sono l'eccezione: cadono dove
      // capita, anche in mezzo alla pista, altrimenti nello spazio non succede
      // mai niente e nessuno rimonta.
      offset: solid
        ? (index % 2 === 0 ? 0.78 : -0.78) + (rng() - 0.5) * 0.08
        : kind === 'cordolo'
          ? index % 2 === 0
            ? 0.84
            : -0.84
          : (rng() * 2 - 1) * 0.72,
      // Piccoli: si vede la pista, non un monolito. Ma si sentono eccome.
      radius: patch
        ? kind === 'magma'
          ? 13
          : kind === 'ghiaccio'
            ? 12
            : kind === 'sabbia'
              ? 11
              : 12
        : kind === 'scoglio' || kind === 'meteorite'
          ? 9
          : kind === 'boa'
            ? 9
            : kind === 'sasso'
              ? 8
              : kind === 'paracarro'
                ? 6
                : 8,
      patch,
    });
  });

  return hazards;
}
