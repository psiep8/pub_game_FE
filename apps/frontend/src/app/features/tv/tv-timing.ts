/**
 * Tempi della regia scenica TV.
 *
 * <p>Le durate della serata stanno qui, non sparse nei componenti: cambiare il
 * ritmo di una domanda significa cambiare un numero in questo file. Le fasi
 * sono quelle del copione: uscita del gioco precedente, titolo, domanda letta
 * senza timer, opzioni una alla volta, respiro, 3-2-1, via.</p>
 *
 * <p>Il timer del round e i telefoni partono solo alla fine della sequenza: la
 * pausa di lettura è tempo del presentatore, non tempo di gioco.</p>
 */

export const TV_TIMING = {
  /** Uscita del gioco precedente (600–900 ms). */
  exitMs: 700,
  /** Scorrimento dell'uscita: 200–300 px, mai di più. */
  exitShiftPx: 240,
  /** Entrata della scena nuova. */
  entranceMs: 700,
  /** Titolo del gioco a schermo (la demo, se c'è, si mette davanti). */
  titleMs: 2400,
  /** Pausa di lettura minima, prima che le opzioni compaiano. */
  readingBaseMs: 3000,
  /** Un secondo in più ogni otto parole. */
  readingPerWordsMs: 1000,
  readingWordsPerBeat: 8,
  /** Distanza fra un'opzione e la successiva (250–350 ms). */
  optionStaggerMs: 300,
  /** Movimento della singola opzione. */
  optionMoveMs: 320,
  /** Respiro con tutto visibile e timer fermo (1–2 s). */
  breathMs: 1500,
  /** 3-2-1: un secondo per numero, poi il via. */
  countdownStepMs: 1000,
  countdownFrom: 3,
  /** «TEMPO», pausa e rivelazione. */
  timeUpPauseMs: 1000,
  revealPauseMs: 2000,
  /**
   * Respiro fra una manche e l'altra (N-12): la domanda successiva è già a
   * schermo, leggibile, con il cronometro fermo. Niente 3-2-1: quello resta
   * solo all'inizio del round.
   */
  mancheBreathMs: 4500,
} as const;

/** Fasi della scena TV, nell'ordine in cui il pubblico le vede. */
export type StagePhase =
  | 'idle'
  | 'entrance'
  | 'title'
  | 'reading'
  | 'options'
  | 'breath'
  | 'countdown'
  | 'live'
  | 'reveal'
  | 'exit';

export interface StageStep {
  phase: StagePhase;
  ms: number;
}

/** Quante parole ha una domanda: decide la pausa di lettura. */
export function wordCount(text: string | null | undefined): number {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Pausa di lettura: almeno tre secondi, più un secondo ogni otto parole. La
 * domanda resta a schermo senza opzioni e senza timer.
 */
export function readingPauseMs(question: string | null | undefined): number {
  const beats = Math.floor(wordCount(question) / TV_TIMING.readingWordsPerBeat);
  return TV_TIMING.readingBaseMs + beats * TV_TIMING.readingPerWordsMs;
}

/** Ritardo della singola opzione, una alla volta. */
export function optionDelays(count: number): number[] {
  const total = Math.max(0, Math.trunc(count));
  return Array.from({ length: total }, (_, index) => index * TV_TIMING.optionStaggerMs);
}

/** Durata complessiva del comparire delle opzioni. */
export function optionsRevealMs(count: number): number {
  return Math.max(TV_TIMING.optionMoveMs, optionDelays(count).at(-1) ?? 0) + TV_TIMING.optionMoveMs;
}

/** Il 3-2-1: i numeri che il pubblico vede, dal primo all'ultimo. */
export function countdownNumbers(): number[] {
  return Array.from(
    { length: TV_TIMING.countdownFrom },
    (_, index) => TV_TIMING.countdownFrom - index,
  );
}

/**
 * Sequenza di un round a domanda: titolo, lettura, opzioni sfalsate, respiro,
 * 3-2-1, via. Il timer parte dopo l'ultimo gradino.
 */
export function questionStage(question: string, optionCount: number): StageStep[] {
  return [
    { phase: 'entrance', ms: TV_TIMING.entranceMs },
    { phase: 'title', ms: TV_TIMING.titleMs },
    { phase: 'reading', ms: readingPauseMs(question) },
    { phase: 'options', ms: optionsRevealMs(optionCount) },
    { phase: 'breath', ms: TV_TIMING.breathMs },
    {
      phase: 'countdown',
      ms: TV_TIMING.countdownStepMs * countdownNumbers().length,
    },
    { phase: 'live', ms: 0 },
  ];
}

/**
 * Sequenza dei giochi senza domanda (Bomba, Biglie, Speed Rush, Tennis, Ruota,
 * Time Buzzer…): entrata, titolo, respiro prima del via, 3-2-1, via.
 */
export function actionStage(): StageStep[] {
  return [
    { phase: 'entrance', ms: TV_TIMING.entranceMs },
    { phase: 'title', ms: TV_TIMING.titleMs },
    { phase: 'breath', ms: TV_TIMING.breathMs },
    {
      phase: 'countdown',
      ms: TV_TIMING.countdownStepMs * countdownNumbers().length,
    },
    { phase: 'live', ms: 0 },
  ];
}

/**
 * Giochi con una domanda a schermo: hanno la pausa di lettura prima delle
 * opzioni. Gli altri usano `actionStage`.
 */
export const QUESTION_GAMES = [
  'QUIZ',
  'IMAGE_BLUR',
  'WHEEL_OF_FORTUNE',
  'TIMELINE',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BLACKJACK',
] as const;

export function stageFor(type: string, question: string, optionCount: number): StageStep[] {
  return (QUESTION_GAMES as readonly string[]).includes(type)
    ? questionStage(question, optionCount)
    : actionStage();
}
