/**
 * Estrazione guidata delle lettere della Ruota della Fortuna.
 *
 * Il mazzo non è più un ordine fisso "dalla lettera più rara": alterna lettere
 * comuni della frase a lettere pescate a caso, così una frase non resta bloccata
 * sulle lettere che compaiono una volta sola.
 *
 * Regole:
 * - nelle prime 3 uscite c'è sempre una vocale e una lettera che compare almeno
 *   due volte nella frase (se esistono);
 * - dopo le prime tre, una uscita su tre resta tra le lettere più presenti;
 * - ogni lettera della frase esce una sola volta, quindi il mazzo non si blocca.
 *
 * Il generatore casuale è iniettabile: nei test si usa un seme fisso.
 */

export const WHEEL_VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'À', 'È', 'É', 'Ì', 'Ò', 'Ù']);

/** Lettere giocabili: apostrofi e punteggiatura restano sempre visibili. */
export function isPlayableLetter(ch: string): boolean {
  return /[A-ZÀÈÉÌÒÙ]/.test(ch);
}

/** Quante volte ogni lettera giocabile compare nella frase. */
export function letterCounts(phrase: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of (phrase ?? '').toUpperCase().split('')) {
    if (!isPlayableLetter(ch)) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

/** Le lettere più presenti: il terzo più alto della classifica della frase. */
export function topLetters(phrase: string): string[] {
  const counts = letterCounts(phrase);
  const ranked = [...counts.keys()].sort(
    (a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b, 'it'),
  );
  if (ranked.length === 0) return [];
  const size = Math.max(1, Math.ceil(ranked.length / 3));
  return ranked.slice(0, size);
}

export interface LetterDeckOptions {
  /** Generatore casuale in [0, 1): nei test si passa un seme fisso. */
  random?: () => number;
}

/** Ordine di uscita delle lettere della frase secondo il mazzo guidato. */
export function buildLetterOrder(phrase: string, options: LetterDeckOptions = {}): string[] {
  const random = options.random ?? Math.random;
  const counts = letterCounts(phrase);
  const allLetters = [...counts.keys()];
  if (allLetters.length === 0) return [];

  const remaining = new Set(allLetters);
  const order: string[] = [];

  const available = (pool: Iterable<string>): string[] =>
    [...pool].filter((letter) => remaining.has(letter));

  const uniform = (pool: Iterable<string>): string | null => {
    const pool_ = available(pool);
    if (pool_.length === 0) return null;
    return pool_[Math.min(pool_.length - 1, Math.floor(random() * pool_.length))];
  };

  /** Pescata pesata sulla presenza: le lettere comuni escono prima. */
  const weighted = (pool: Iterable<string>): string | null => {
    const pool_ = available(pool);
    if (pool_.length === 0) return null;
    const total = pool_.reduce((sum, letter) => sum + Math.max(1, counts.get(letter) ?? 1), 0);
    let target = random() * total;
    for (const letter of pool_) {
      target -= Math.max(1, counts.get(letter) ?? 1);
      if (target <= 0) return letter;
    }
    return pool_[pool_.length - 1];
  };

  const commit = (letter: string | null): boolean => {
    if (!letter) return false;
    remaining.delete(letter);
    order.push(letter);
    return true;
  };

  // Prime tre uscite: vocale e lettera ripetuta garantite.
  const vowelLetters = allLetters.filter((letter) => WHEEL_VOWELS.has(letter));
  const repeatedLetters = allLetters.filter((letter) => (counts.get(letter) ?? 0) >= 2);
  let vowelDone = false;
  let repeatedDone = false;

  for (let draw = 0; draw < 3 && remaining.size > 0; draw++) {
    const candidates = new Set<string>();
    if (!vowelDone) available(vowelLetters).forEach((letter) => candidates.add(letter));
    if (!repeatedDone) available(repeatedLetters).forEach((letter) => candidates.add(letter));

    const letter = weighted(candidates.size > 0 ? candidates : allLetters);
    if (!commit(letter)) break;
    if (WHEEL_VOWELS.has(letter!)) vowelDone = true;
    if ((counts.get(letter!) ?? 0) >= 2) repeatedDone = true;
  }

  // Poi il mazzo alterna lettere comuni e lettere a caso, con una uscita su
  // tre riservata alle più presenti.
  const important = topLetters(phrase);
  let step = 0;
  while (remaining.size > 0) {
    step++;
    let letter: string | null;
    if (step % 3 === 0) {
      letter = weighted(important);
    } else if (step % 2 === 1) {
      letter = weighted(allLetters);
    } else {
      letter = uniform(allLetters);
    }
    if (!letter) letter = uniform(allLetters);
    if (!commit(letter)) break;
  }

  return order;
}
