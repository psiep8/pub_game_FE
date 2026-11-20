import { GameModeType } from './game-mode-type';

/**
 * Punteggi ufficiali della serata: fonte unica per manuale, demo, README, PDF e
 * pannello admin. I numeri stanno qui come costanti e i motori di gioco le
 * importano: un test controlla che la tabella e i motori non divergano.
 */
/** Pausa fra la scadenza del tempo e il reveal: la TV mostra l'attesa. */
export const REVEAL_DELAY_MS = 1700;

export interface ScoringRule {
  correct: string;
  wrong: string;
  missed: string;
  note: string;
}

/** Numero con il segno tipografico: −500, +300, 0. */
export function signedPoints(value: number): string {
  if (value === 0) return '0';
  return `${value < 0 ? '−' : '+'}${Math.abs(value)}`;
}

/** Punti del brano secondo la manche in cui si risponde (1-based). */
export const MUSIC_MANCHE_POINTS = [1000, 750, 500, 250] as const;

/** Timeline: indice = posti giusti su otto. */
export const TIMELINE_POSITION_POINTS = [
  -200, -200, -100, -50, 0, 100, 200, 300, 400,
] as const;

export const TIME_BUZZER_FIRST = 300;
export const TIME_BUZZER_LAST = -200;
export const TIME_BUZZER_PERFECT = 600;
/** "Tempo perfetto": errore entro 50 ms. */
export const TIME_BUZZER_PERFECT_MS = 50;

export const BOMBA_PEAK = -500;
export const BOMBA_ROUND_STEP = 10;

export const SPEED_RUSH_FIRST = 800;
export const SPEED_RUSH_LAST = -400;

export const TENNIS_WIN = 500;

export const BIGLIE_FIRST = 500;
export const BIGLIE_LAST = -400;

export const CASINO_SPINS = 3;
export const BONUS_CASINO_COLOR_POINTS = 100;
export const BONUS_CASINO_DOZEN_POINTS = 200;
export const BONUS_CASINO_NUMBER_POINTS = 500;
/** Finestra di scelta dei bonus, in secondi. */
export const BONUS_CHOICE_SECONDS = 10;
export const BLACKJACK_VOUCHER_LABEL = '3 consumazioni al tavolo';
export const CAVALLO_VOUCHER_LABEL = '1 consumazione di cibo';
export const BLACKJACK_MAX_VOUCHERS = 3;

export const SCORING_RULES: Record<Exclude<GameModeType, 'BLACKJACK'>, ScoringRule> = {
  QUIZ: {
    correct: 'fino a +1000 in 3 manches',
    wrong: '−quota della domanda, in base al tempo',
    missed: '0 (nessun malus)',
    note: 'Facile ×1, media ×2, difficile ×3: tre esatte a tempo zero valgono 1000.',
  },
  IMAGE_BLUR: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'L’immagine si schiarisce con il tempo: prima si prenota, più punti vale.',
  },
  MUSIC: {
    correct: `${signedPoints(MUSIC_MANCHE_POINTS[0])} alla prima manche, poi ${MUSIC_MANCHE_POINTS.slice(1).map(signedPoints).join(' / ')}`,
    wrong: `${signedPoints(-MUSIC_MANCHE_POINTS[0])} alla prima manche, poi ${MUSIC_MANCHE_POINTS.slice(1).map((value) => signedPoints(-value)).join(' / ')}`,
    missed: '0 (nessun malus)',
    note: `Quattro manche sulla stessa canzone, sempre più riconoscibile: ${MUSIC_MANCHE_POINTS.map(signedPoints).join(' / ')} punti. Quattro round, quattro canzoni; massimo ${signedPoints(MUSIC_MANCHE_POINTS[0])}, minimo ${signedPoints(-MUSIC_MANCHE_POINTS[0])}.`,
  },
  WHEEL_OF_FORTUNE: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'Le lettere si aprono nel tempo con estrazione guidata: vocale e lettera ripetuta entro le prime tre. Chi prenota prima rischia meno.',
  },
  TIMELINE: {
    correct: `${signedPoints(TIMELINE_POSITION_POINTS[8])} con 8 posti giusti`,
    wrong: `${signedPoints(TIMELINE_POSITION_POINTS[1])} con 1 o 0 posti giusti`,
    missed: '0 (nessun malus)',
    note: `Otto eventi da ordinare ogni round: 8 posti giusti ${signedPoints(TIMELINE_POSITION_POINTS[8])}, 7 → ${signedPoints(TIMELINE_POSITION_POINTS[7])}, 6 → ${signedPoints(TIMELINE_POSITION_POINTS[6])}, 5 → ${signedPoints(TIMELINE_POSITION_POINTS[5])}, 4 → 0, 3 → ${signedPoints(TIMELINE_POSITION_POINTS[3])}, 2 → ${signedPoints(TIMELINE_POSITION_POINTS[2])}, 1 o 0 → ${signedPoints(TIMELINE_POSITION_POINTS[1])}.`,
  },
  TIME_BUZZER: {
    correct: `${signedPoints(TIME_BUZZER_FIRST)} al primo di manche, ${signedPoints(TIME_BUZZER_PERFECT)} col tempo perfetto`,
    wrong: `${signedPoints(TIME_BUZZER_LAST)} all'ultimo di manche`,
    missed: `${signedPoints(TIME_BUZZER_LAST)}: chi non preme è ultimo della manche`,
    note: `Tre round da tre manche, senza tagli e con tutte le squadre in gioco: punti per distanza dal bersaglio (${signedPoints(TIME_BUZZER_FIRST)} al primo, ${signedPoints(TIME_BUZZER_LAST)} all'ultimo) e ${signedPoints(TIME_BUZZER_PERFECT)} a chi centra il tempo con errore ≤ ${TIME_BUZZER_PERFECT_MS} ms. I punti si sommano fra le manche.`,
  },
  BOMBA: {
    correct: '0: l’affermazione vera ti tiene in vita',
    wrong: `${signedPoints(BOMBA_PEAK)} alla prima bomba, poi a scalare`,
    missed: 'fuori dal round: malus del suo ordine di uscita',
    note: `Solo malus: la prima squadra fuori paga ${signedPoints(BOMBA_PEAK)}, poi ${signedPoints(BOMBA_PEAK)} × bombe rimaste / bombe iniziali, arrotondato alla decina. Chi non sceglie in tempo è fuori.`,
  },
  SPEED_RUSH: {
    correct: `${signedPoints(SPEED_RUSH_FIRST)} al primo`,
    wrong: '0: la corsia arretra',
    missed: `${signedPoints(SPEED_RUSH_LAST)}: chi non arriva è ultimo`,
    note: `Piazzamento puro: ${signedPoints(SPEED_RUSH_FIRST)} al primo, ${signedPoints(SPEED_RUSH_LAST)} all'ultimo, zero a metà se N è dispari. Il punteggio lo calcola il server.`,
  },
  TENNIS_BATTLE: {
    correct: `${signedPoints(TENNIS_WIN)} a chi vince la partita`,
    wrong: '0',
    missed: '0',
    note: 'Chi vince la partita prende 500, chi perde zero: niente punti per il set e nessun premio di rincalzo.',
  },
  AZZARDO: {
    correct: '+20 × quota per fiche giusta (×2 facile, ×3 media, ×4 difficile)',
    wrong: '−20 × fiche sbagliate × 100/80/60/40%',
    missed: '0: chi non distribuisce fiches non punta',
    note: 'Quattro manche numeriche (celebrità, canzoni, paesi, storia) con dieci fiches da 20 punti da distribuire sulle quattro risposte. Le avanzate si sommano alle nuove e alzano il tetto di una fiche ogni due risparmiate, fino a 15 a manche; una manche paga al massimo 1000. La perdita scende dal 100% al 40%; mai sotto zero.',
  },
  ULTIMA_SPIAGGIA: {
    correct: '+100 / +200 / +300 / +400 / +500',
    wrong: '−50 / −100 / −150 / −200 / −250',
    missed: '−metà del livello scelto',
    note: 'Ultima spiaggia: una categoria per occorrenza, ogni livello 100-500 si consuma una volta per squadra in tutta la partita; la sbagliata costa metà.',
  },
  BIGLIE: {
    correct: `${signedPoints(BIGLIE_FIRST)} al primo di gara, poi a scalare`,
    wrong: `${signedPoints(BIGLIE_LAST)} all'ultimo di gara`,
    missed: '0 (nessuna penalità)',
    note: `Quattro round, due gare per round, tutti corrono: ${signedPoints(BIGLIE_FIRST)} al primo, ${signedPoints(BIGLIE_LAST)} all'ultimo, 0 a metà se N è dispari. I punti si sommano fra le due gare e fra i round.`,
  },
  ARENA: {
    correct: '+10 a risposta; +1000/+500 piazzamento',
    wrong: '−10 a risposta; −300 metà bassa',
    missed: '0 durante il gioco; −300 fuori dal podio',
    note: 'Le risposte rapide valgono +10/−10; il piazzamento finale assegna 1000/500/−300.',
  },
};

/** I bonus non sono modalità della scaletta: hanno regole proprie. */
export const BONUS_SCORING: Record<string, ScoringRule> = {
  BONUS_CASINO_COLOR: {
    correct: `${signedPoints(BONUS_CASINO_COLOR_POINTS)} a girata indovinata (massimo ${CASINO_SPINS * BONUS_CASINO_COLOR_POINTS})`,
    wrong: '0',
    missed: '0',
    note: `Tre girate: rosso o nero scelto a inizio manche in ${BONUS_CHOICE_SECONDS} secondi. Sullo zero nessuno prende punti.`,
  },
  BONUS_BLACKJACK: {
    correct: `${BLACKJACK_VOUCHER_LABEL} a chi batte il banco`,
    wrong: '0: la sconfitta non toglie nulla',
    missed: '0; il pari non vale',
    note: `Una sola manche, un turno per squadra: chi batte il banco riceve un buono, non punti. Massimo ${BLACKJACK_MAX_VOUCHERS} buoni a serata.`,
  },
  BONUS_CASINO_DOZEN: {
    correct: `${signedPoints(BONUS_CASINO_DOZEN_POINTS)} a girata indovinata (massimo ${CASINO_SPINS * BONUS_CASINO_DOZEN_POINTS})`,
    wrong: '0',
    missed: '0',
    note: `Tre girate: 1-12, 13-24 o 25-36 scelta a inizio manche in ${BONUS_CHOICE_SECONDS} secondi. Sullo zero il banco incassa.`,
  },
  BONUS_CAVALLO: {
    correct: `${CAVALLO_VOUCHER_LABEL} al vincitore`,
    wrong: '0',
    missed: '0',
    note: 'Otto domande flash sulla categoria votata: vince chi ha più risposte giuste, a pari merito chi ha finito prima. Premio: un buono per una consumazione di cibo.',
  },
  BONUS_CASINO_NUMBER: {
    correct: `${signedPoints(BONUS_CASINO_NUMBER_POINTS)} al numero secco`,
    wrong: '0',
    missed: '0',
    note: `Una sola girata: ogni squadra sceglie un numero da 0 a 36 in ${BONUS_CHOICE_SECONDS} secondi. Chi lo becca prende ${BONUS_CASINO_NUMBER_POINTS}; se nessuno lo becca, nessuno prende punti.`,
  },
};

export function scoringRuleFor(type: string | null | undefined): ScoringRule | null {
  if (!type) return null;
  return (SCORING_RULES as Record<string, ScoringRule>)[type]
    ?? BONUS_SCORING[type]
    ?? null;
}
