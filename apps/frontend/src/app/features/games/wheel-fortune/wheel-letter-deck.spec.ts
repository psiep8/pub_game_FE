import { buildLetterOrder, letterCounts, topLetters, WHEEL_VOWELS } from './wheel-letter-deck';

/** Generatore deterministico: stessi test, stesso mazzo. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const PHRASE = 'TANTO VA LA GATTA AL LARDO CHE CI LASCIA LO ZAMPINO';

describe('buildLetterOrder', () => {
  it('fa uscire ogni lettera della frase una sola volta', () => {
    const order = buildLetterOrder(PHRASE, { random: seeded(7) });
    const expected = [...letterCounts(PHRASE).keys()].sort();

    expect([...order].sort()).toEqual(expected);
    expect(new Set(order).size).toBe(order.length);
  });

  it('nelle prime tre uscite mette una vocale e una lettera ripetuta', () => {
    const order = buildLetterOrder(PHRASE, { random: seeded(11) });
    const counts = letterCounts(PHRASE);
    const firstThree = order.slice(0, 3);

    expect(firstThree.some((letter) => WHEEL_VOWELS.has(letter))).toBe(true);
    expect(firstThree.some((letter) => (counts.get(letter) ?? 0) >= 2)).toBe(true);
  });

  it('dopo le prime tre, una uscita su tre resta tra le piu presenti', () => {
    const order = buildLetterOrder(PHRASE, { random: seeded(3) });
    const important = new Set(topLetters(PHRASE));
    const availableTop = new Set(important);

    // Una uscita riservata (ogni terza dopo le prime tre) non puo saltare una
    // lettera tra le piu presenti se ce n e ancora una da estrarre.
    const violations: string[] = [];
    order.forEach((letter, index) => {
      const afterFirstThree = index - 3;
      const reserved = afterFirstThree >= 0 && (afterFirstThree + 1) % 3 === 0;
      if (reserved && availableTop.size > 0 && !important.has(letter)) {
        violations.push(letter);
      }
      availableTop.delete(letter);
    });

    expect(violations).toEqual([]);
    expect(order.slice(3).length).toBeGreaterThan(3);
  });

  it('con una frase di una sola lettera ripetuta non si blocca', () => {
    expect(buildLetterOrder('AAA', { random: seeded(1) })).toEqual(['A']);
    expect(buildLetterOrder('   ', { random: seeded(1) })).toEqual([]);
  });

  it('funziona anche con accenti e apostrofi', () => {
    const phrase = "L'ABITO NON FA IL MONACO";
    const order = buildLetterOrder(phrase, { random: seeded(5) });

    // Apostrofo escluso, lettere tutte presenti e nessun duplicato.
    expect([...order].sort()).toEqual([...letterCounts(phrase).keys()].sort());
    expect(new Set(order).size).toBe(order.length);
  });
});
