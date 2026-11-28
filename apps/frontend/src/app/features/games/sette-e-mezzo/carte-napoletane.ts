/**
 * Mappa delle carte napoletane.
 *
 * <p>I file sono il set CC0 `SONDLecT/woodcut-napoletane`: 40 facce a colori
 * (`colori/`) e il dorso a inchiostro bianco/nero (`dorso.svg`), copiati in
 * `public/assets/carte-napoletane` dallo script
 * `scripts/carte/scarica-napoletane.mjs`. La mappa è l'unico punto che lega un
 * id di regola (`ASSO-DENARI`) al disegno: per cambiare mazzo basta cambiare
 * file e mappa, non il codice del tavolo.</p>
 */

export const CARTE_BASE = 'assets/carte-napoletane/colori/';
export const CARTE_DORSO = 'assets/carte-napoletane/dorso.svg';

const SUITS = [
  { id: 'DENARI', slug: 'denari', label: 'denari' },
  { id: 'COPPE', slug: 'coppe', label: 'coppe' },
  { id: 'SPADE', slug: 'spade', label: 'spade' },
  { id: 'BASTONI', slug: 'bastoni', label: 'bastoni' },
] as const;

const RANKS = [
  { id: 'ASSO', slug: 'asso', label: 'Asso' },
  { id: '2', slug: '02', label: '2' },
  { id: '3', slug: '03', label: '3' },
  { id: '4', slug: '04', label: '4' },
  { id: '5', slug: '05', label: '5' },
  { id: '6', slug: '06', label: '6' },
  { id: '7', slug: '07', label: '7' },
  { id: 'FANTE', slug: 'fante', label: 'Fante' },
  { id: 'CAVALLO', slug: 'cavallo', label: 'Cavallo' },
  { id: 'RE', slug: 're', label: 'Re' },
] as const;

export const CARTE_NAPOLETANE: Readonly<Record<string, string>> = Object.fromEntries(
  SUITS.flatMap((suit) => RANKS.map((rank) => [
    `${rank.id}-${suit.id}`,
    `${CARTE_BASE}${suit.slug}-${rank.slug}.svg`,
  ])),
);

/** Percorso del disegno; il dorso è il ripiego per un id sconosciuto. */
export function cardImage(card: string): string {
  return CARTE_NAPOLETANE[card] ?? CARTE_DORSO;
}

/** Testo alternativo leggibile: «Asso di denari». */
export function cardAlt(card: string): string {
  const [rankId, suitId] = String(card).split('-');
  const rank = RANKS.find((row) => row.id === rankId)?.label ?? rankId ?? 'Carta';
  const suit = SUITS.find((row) => row.id === suitId)?.label ?? suitId ?? '';
  return suit ? `${rank} di ${suit}` : rank;
}

export function allCardImages(): string[] {
  return [...Object.values(CARTE_NAPOLETANE), CARTE_DORSO];
}

/**
 * Precarica i 41 disegni prima che il bonus entri in scena. Il browser li
 * tiene nella cache: la prima mano non aspetta la rete e non cambia layout
 * quando arrivano le carte.
 */
export function preloadSetteCards(cards: readonly string[] = []): void {
  if (typeof Image === 'undefined') return;
  const sources = new Set<string>([CARTE_DORSO]);
  for (const card of cards) sources.add(cardImage(card));
  for (const src of sources) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
  }
}
