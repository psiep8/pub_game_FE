import {
  buildSpeedDeck,
  createSpeedTask,
  SPEED_TASK_KINDS,
  SpeedColorsTask,
  SpeedFlagTask,
  SpeedTranslateTask,
  SpeedWordsTask,
} from './speed-rush-deck';

/** Generatore deterministico: stessi test, stesso mazzo. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('buildSpeedDeck', () => {
  it('non ripete mai lo stesso tipo due volte di fila', () => {
    const deck = buildSpeedDeck(40, { random: seeded(7) });

    expect(deck).toHaveLength(40);
    deck.forEach((kind, index) => {
      if (index > 0) expect(kind).not.toBe(deck[index - 1]);
    });
  });

  it('mescola tutti i cinque tipi in ogni blocco', () => {
    const deck = buildSpeedDeck(10, { random: seeded(11) });

    expect([...new Set(deck.slice(0, 5))].sort()).toEqual([...SPEED_TASK_KINDS].sort());
    expect([...new Set(deck.slice(5, 10))].sort()).toEqual([...SPEED_TASK_KINDS].sort());
  });

  it('rispetta la dimensione richiesta e i tipi passati', () => {
    expect(buildSpeedDeck(0, { random: seeded(3) })).toEqual([]);
    const deck = buildSpeedDeck(7, { random: seeded(3), kinds: ['flag', 'translate'] });
    expect(deck).toHaveLength(7);
    expect(deck.every((kind) => kind === 'flag' || kind === 'translate')).toBe(true);
  });
});

describe('createSpeedTask', () => {
  it('matematica: tre risultati distinti, uno giusto', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const task = createSpeedTask('math', { random: seeded(seed) });
      if (task.kind !== 'math') throw new Error('tipo inatteso');

      expect(task.options).toHaveLength(3);
      expect(new Set(task.options).size).toBe(3);
      expect(task.options).toContain(task.answer);
      expect(task.text).toMatch(/^\d+ [×+] \d+$/);
      expect(task.answer).toBeGreaterThan(0);
    }
  });

  it('colori: due primari da scegliere e il campione del bersaglio', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const task = createSpeedTask('colors', { random: seeded(seed) }) as SpeedColorsTask;

      expect(task.kind).toBe('colors');
      expect(task.options.map((option) => option.name).sort()).toEqual(['BLU', 'GIALLO', 'ROSSO']);
      expect(task.answer).toHaveLength(2);
      expect(new Set(task.answer).size).toBe(2);
      expect(task.answer.every((name) => task.options.some((option) => option.name === name))).toBe(true);
      expect(task.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('bandiera: due nomi distinti, uno giusto e la bandiera del paese', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const task = createSpeedTask('flag', { random: seeded(seed) }) as SpeedFlagTask;

      expect(task.kind).toBe('flag');
      expect(task.options).toHaveLength(2);
      expect(new Set(task.options).size).toBe(2);
      expect(task.options).toContain(task.answer);
      expect(task.emoji.length).toBeGreaterThan(0);
    }
  });

  it('sinonimi e contrari: due parole, una giusta, mai la stessa', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const task = createSpeedTask('words', { random: seeded(seed) }) as SpeedWordsTask;

      expect(task.kind).toBe('words');
      expect(['SINONIMO', 'CONTRARIO']).toContain(task.relation);
      expect(task.options).toHaveLength(2);
      expect(new Set(task.options).size).toBe(2);
      expect(task.options).toContain(task.answer);
      expect(task.options).not.toContain(task.prompt);
      expect(task.answer).not.toBe(task.prompt);
    }
  });

  it('traduzione: parola inglese e due traduzioni, una giusta', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const task = createSpeedTask('translate', { random: seeded(seed) }) as SpeedTranslateTask;

      expect(task.kind).toBe('translate');
      expect(task.options).toHaveLength(2);
      expect(new Set(task.options).size).toBe(2);
      expect(task.options).toContain(task.answer);
      expect(task.prompt).toMatch(/^[A-Z ]+$/);
    }
  });

  it('ogni tipo del mazzo genera una prova valida', () => {
    const random = seeded(5);
    const deck = buildSpeedDeck(25, { random });

    for (const kind of deck) {
      const task = createSpeedTask(kind, { random });
      expect(task.kind).toBe(kind);
    }
  });
});
