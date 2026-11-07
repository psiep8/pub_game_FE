/**
 * Microprove di Speed Rush.
 *
 * Il brief le vuole in un mazzo mescolato, senza due tipi uguali di fila:
 * matematica a tre pulsanti, miscuglio di colori, bandiera, sinonimi/contrari
 * e traduzione. Il mazzo si costruisce a blocchi mescolati, così ogni tipo esce
 * con regolarità; il generatore casuale è iniettabile per i test.
 */

export type SpeedTaskKind = 'math' | 'colors' | 'flag' | 'words' | 'translate';

export interface SpeedMathTask {
  kind: 'math';
  text: string;
  options: number[];
  answer: number;
}

export interface SpeedColorOption {
  name: string;
  swatch: string;
}

export interface SpeedColorsTask {
  kind: 'colors';
  target: string;
  /** Campione del colore da ottenere, mostrato in cima al telefono. */
  swatch: string;
  options: SpeedColorOption[];
  /** I due primari che, mescolati, danno il bersaglio. */
  answer: string[];
}

export interface SpeedFlagTask {
  kind: 'flag';
  emoji: string;
  options: string[];
  answer: string;
}

export interface SpeedWordsTask {
  kind: 'words';
  prompt: string;
  relation: 'SINONIMO' | 'CONTRARIO';
  options: string[];
  answer: string;
}

export interface SpeedTranslateTask {
  kind: 'translate';
  prompt: string;
  options: string[];
  answer: string;
}

export type SpeedTask =
  | SpeedMathTask
  | SpeedColorsTask
  | SpeedFlagTask
  | SpeedWordsTask
  | SpeedTranslateTask;

export const SPEED_TASK_KINDS: readonly SpeedTaskKind[] = ['math', 'colors', 'flag', 'words', 'translate'];

export interface SpeedDeckOptions {
  /** Generatore casuale in [0, 1): nei test si passa un seme fisso. */
  random?: () => number;
  /** Tipi da mescolare; di default sono tutti e cinque. */
  kinds?: readonly SpeedTaskKind[];
}

const PRIMARIES: readonly SpeedColorOption[] = [
  { name: 'ROSSO', swatch: '#c0392b' },
  { name: 'GIALLO', swatch: '#dfa100' },
  { name: 'BLU', swatch: '#1f4e9c' },
];

const MIXES: ReadonlyArray<{ target: string; swatch: string; answer: string[] }> = [
  { target: 'VERDE', swatch: '#2f7d4f', answer: ['GIALLO', 'BLU'] },
  { target: 'ARANCIONE', swatch: '#d4691e', answer: ['ROSSO', 'GIALLO'] },
  { target: 'VIOLA', swatch: '#6b3fa0', answer: ['ROSSO', 'BLU'] },
];

const FLAGS: ReadonlyArray<{ emoji: string; name: string }> = [
  { emoji: '🇨🇲', name: 'CAMERUN' },
  { emoji: '🇸🇳', name: 'SENEGAL' },
  { emoji: '🇮🇹', name: 'ITALIA' },
  { emoji: '🇫🇷', name: 'FRANCIA' },
  { emoji: '🇩🇪', name: 'GERMANIA' },
  { emoji: '🇪🇸', name: 'SPAGNA' },
  { emoji: '🇵🇹', name: 'PORTOGALLO' },
  { emoji: '🇧🇷', name: 'BRASILE' },
  { emoji: '🇦🇷', name: 'ARGENTINA' },
  { emoji: '🇯🇵', name: 'GIAPPONE' },
  { emoji: '🇨🇦', name: 'CANADA' },
  { emoji: '🇲🇽', name: 'MESSICO' },
  { emoji: '🇳🇬', name: 'NIGERIA' },
  { emoji: '🇬🇭', name: 'GHANA' },
  { emoji: '🇧🇪', name: 'BELGIO' },
  { emoji: '🇳🇱', name: 'OLANDA' },
  { emoji: '🇸🇪', name: 'SVEZIA' },
  { emoji: '🇳🇴', name: 'NORVEGIA' },
  { emoji: '🇩🇰', name: 'DANIMARCA' },
  { emoji: '🇬🇷', name: 'GRECIA' },
  { emoji: '🇹🇷', name: 'TURCHIA' },
  { emoji: '🇪🇬', name: 'EGITTO' },
  { emoji: '🇲🇦', name: 'MAROCCO' },
  { emoji: '🇿🇦', name: 'SUDAFRICA' },
  { emoji: '🇦🇺', name: 'AUSTRALIA' },
  { emoji: '🇮🇳', name: 'INDIA' },
  { emoji: '🇨🇳', name: 'CINA' },
  { emoji: '🇰🇷', name: 'COREA DEL SUD' },
  { emoji: '🇨🇭', name: 'SVIZZERA' },
  { emoji: '🇦🇹', name: 'AUSTRIA' },
  { emoji: '🇵🇱', name: 'POLONIA' },
  { emoji: '🇺🇦', name: 'UCRAINA' },
  { emoji: '🇮🇪', name: 'IRLANDA' },
  { emoji: '🇺🇾', name: 'URUGUAY' },
  { emoji: '🇨🇱', name: 'CILE' },
  { emoji: '🇨🇴', name: 'COLOMBIA' },
  { emoji: '🇵🇪', name: 'PERÙ' },
  { emoji: '🇰🇪', name: 'KENIA' },
  { emoji: '🇪🇹', name: 'ETIOPIA' },
  { emoji: '🇹🇳', name: 'TUNISIA' },
  { emoji: '🇩🇿', name: 'ALGERIA' },
  { emoji: '🇮🇸', name: 'ISLANDA' },
  { emoji: '🇫🇮', name: 'FINLANDIA' },
];

const WORDS: ReadonlyArray<{ prompt: string; synonym: string; antonym: string }> = [
  { prompt: 'BELLO', synonym: 'CARINO', antonym: 'BRUTTO' },
  { prompt: 'VELOCE', synonym: 'RAPIDO', antonym: 'LENTO' },
  { prompt: 'GRANDE', synonym: 'ENORME', antonym: 'PICCOLO' },
  { prompt: 'FACILE', synonym: 'SEMPLICE', antonym: 'DIFFICILE' },
  { prompt: 'CALDO', synonym: 'BOLLENTE', antonym: 'FREDDO' },
  { prompt: 'INIZIARE', synonym: 'COMINCIARE', antonym: 'FINIRE' },
  { prompt: 'PULITO', synonym: 'LINDO', antonym: 'SPORCO' },
  { prompt: 'CORAGGIOSO', synonym: 'AUDACE', antonym: 'CODARDO' },
  { prompt: 'RICCO', synonym: 'BENESTANTE', antonym: 'POVERO' },
  { prompt: 'ANTICO', synonym: 'VECCHIO', antonym: 'MODERNO' },
  { prompt: 'FELICE', synonym: 'CONTENTO', antonym: 'TRISTE' },
  { prompt: 'BUIO', synonym: 'SCURO', antonym: 'LUMINOSO' },
  { prompt: 'FORTE', synonym: 'ROBUSTO', antonym: 'DEBOLE' },
];

/** Parole che non sono sinonimi né contrari di nessuna voce della banca. */
const DISTRACTORS: readonly string[] = [
  'AMARO',
  'SALATO',
  'QUADRATO',
  'APPUNTITO',
  'RUGOSO',
  'PESANTE',
  'STRETTO',
  'LUCIDO',
];

const ENGLISH: ReadonlyArray<{ en: string; it: string }> = [
  { en: 'DOG', it: 'CANE' },
  { en: 'CAT', it: 'GATTO' },
  { en: 'HOUSE', it: 'CASA' },
  { en: 'BOOK', it: 'LIBRO' },
  { en: 'WATER', it: 'ACQUA' },
  { en: 'BREAD', it: 'PANE' },
  { en: 'SUN', it: 'SOLE' },
  { en: 'MOON', it: 'LUNA' },
  { en: 'SEA', it: 'MARE' },
  { en: 'MOUNTAIN', it: 'MONTAGNA' },
  { en: 'CITY', it: 'CITTÀ' },
  { en: 'FRIEND', it: 'AMICO' },
  { en: 'SCHOOL', it: 'SCUOLA' },
  { en: 'NIGHT', it: 'NOTTE' },
  { en: 'STREET', it: 'STRADA' },
  { en: 'FLOWER', it: 'FIORE' },
  { en: 'HORSE', it: 'CAVALLO' },
  { en: 'FISH', it: 'PESCE' },
  { en: 'FIRE', it: 'FUOCO' },
  { en: 'SNOW', it: 'NEVE' },
];

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randInt(random: () => number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
}

/**
 * Mazzo di `size` microprove: ogni blocco mescola tutti i tipi richiesti e il
 * primo di un blocco non ripete mai l'ultimo del blocco precedente.
 */
export function buildSpeedDeck(size: number, options: SpeedDeckOptions = {}): SpeedTaskKind[] {
  const random = options.random ?? Math.random;
  const kinds = [...new Set(options.kinds?.length ? options.kinds : SPEED_TASK_KINDS)];
  const deck: SpeedTaskKind[] = [];
  const total = Math.max(0, Math.floor(size));
  if (kinds.length === 0) return deck;

  while (deck.length < total) {
    const bag = shuffled(kinds, random);
    const last = deck[deck.length - 1];
    if (last && bag[0] === last && bag.length > 1) {
      const swapWith = bag.findIndex((kind) => kind !== last);
      [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
    }
    for (const kind of bag) {
      if (deck.length >= total) break;
      deck.push(kind);
    }
  }

  return deck;
}

/** Costruisce la prova completa (testo, opzioni e risposta) per un tipo. */
export function createSpeedTask(kind: SpeedTaskKind, options: SpeedDeckOptions = {}): SpeedTask {
  const random = options.random ?? Math.random;
  switch (kind) {
    case 'math':
      return mathTask(random);
    case 'colors':
      return colorsTask(random);
    case 'flag':
      return flagTask(random);
    case 'words':
      return wordsTask(random);
    case 'translate':
      return translateTask(random);
  }
}

function mathTask(random: () => number): SpeedMathTask {
  const multiply = random() < 0.45;
  const a = multiply ? randInt(random, 2, 6) : randInt(random, 3, 12);
  const b = multiply ? randInt(random, 2, 7) : randInt(random, 2, 9);
  const answer = multiply ? a * b : a + b;

  const options = new Set<number>([answer]);
  while (options.size < 3) {
    const candidate = answer + pick([-3, -2, -1, 1, 2, 3], random);
    if (candidate > 0) options.add(candidate);
  }

  return {
    kind: 'math',
    text: `${a} ${multiply ? '×' : '+'} ${b}`,
    answer,
    options: shuffled([...options], random),
  };
}

function colorsTask(random: () => number): SpeedColorsTask {
  const mix = pick(MIXES, random);
  return {
    kind: 'colors',
    target: mix.target,
    swatch: mix.swatch,
    options: shuffled(PRIMARIES, random),
    answer: [...mix.answer],
  };
}

function flagTask(random: () => number): SpeedFlagTask {
  const correct = pick(FLAGS, random);
  const distractor = pick(
    FLAGS.filter((flag) => flag.name !== correct.name),
    random,
  ).name;

  return {
    kind: 'flag',
    emoji: correct.emoji,
    answer: correct.name,
    options: shuffled([correct.name, distractor], random),
  };
}

function wordsTask(random: () => number): SpeedWordsTask {
  const entry = pick(WORDS, random);
  const relation: 'SINONIMO' | 'CONTRARIO' = random() < 0.5 ? 'SINONIMO' : 'CONTRARIO';
  const answer = relation === 'SINONIMO' ? entry.synonym : entry.antonym;

  let distractor = pick(DISTRACTORS, random);
  if (distractor === answer) distractor = DISTRACTORS[0] === answer ? DISTRACTORS[1] : DISTRACTORS[0];

  return {
    kind: 'words',
    prompt: entry.prompt,
    relation,
    answer,
    options: shuffled([answer, distractor], random),
  };
}

function translateTask(random: () => number): SpeedTranslateTask {
  const entry = pick(ENGLISH, random);
  const distractor = pick(
    ENGLISH.filter((word) => word.it !== entry.it),
    random,
  ).it;

  return {
    kind: 'translate',
    prompt: entry.en,
    answer: entry.it,
    options: shuffled([entry.it, distractor], random),
  };
}
