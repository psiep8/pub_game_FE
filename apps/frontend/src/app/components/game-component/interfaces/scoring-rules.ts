import { GameModeType } from './game-mode-type';

/**
 * Punteggi ufficiali della serata.
 *
 * La stessa tabella la usano il pannello admin (anteprima e aiuto al
 * presentatore) e le demo animate: un solo posto da cambiare quando si
 * ritocca un gioco.
 */
export interface ScoringRule {
  correct: string;
  wrong: string;
  missed: string;
  note: string;
}

export const SCORING_RULES: Record<GameModeType, ScoringRule> = {
  QUIZ: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'Rispondere presto vale di più; sbagliare costa in proporzione al tempo.',
  },
  IMAGE_BLUR: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'L’immagine si schiarisce con il tempo: prima si prenota, più punti vale.',
  },
  MUSIC: {
    correct: '+2000 / +1500 / +1000 / +500',
    wrong: '−1000',
    missed: '0 (nessun malus)',
    note: 'Il valore scende a ogni manche: la prima è quella che pesa di più.',
  },
  WHEEL_OF_FORTUNE: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'Le lettere si aprono nel tempo: chi prenota prima rischia meno.',
  },
  TIMELINE: {
    correct: 'fino a +1200',
    wrong: '0',
    missed: '0',
    note: '1000 × coppie corrette, +200 se l’ordine è perfetto.',
  },
  TIME_BUZZER: {
    correct: '+300 / +200 / +100 / +50',
    wrong: '0',
    missed: '0, ma sei eliminato per primo',
    note: 'Vince chi si avvicina di più al tempo bersaglio; chi non preme esce.',
  },
  BOMBA: {
    correct: '+50 per passaggio (max +500)',
    wrong: 'miccia −3s',
    missed: 'miccia −3s',
    note: 'Ogni squadra parte da 1000: lo scoppio costa −300, il delta entra in classifica.',
  },
  SPEED_RUSH: {
    correct: '+1000 / +900 / +800 …',
    wrong: '0 (la corsia arretra)',
    missed: 'punti per posizione',
    note: 'Il piazzamento decide i punti, anche per chi non taglia il traguardo; ogni errore fa perdere terreno.',
  },
  AIR_HOCKEY_BATTLE: {
    correct: '+1000 al vincitore',
    wrong: 'gol per l’avversario',
    missed: 'gol per l’avversario',
    note: 'Il set si chiude a 7 gol; il perdente riceve +200 di consolazione. Risposte rapide accorciano il tempo dell’avversario.',
  },
  CAVALLO: {
    correct: '+100 a risposta; +50 alla prima esatta della manche',
    wrong: '0',
    missed: '0',
    note: 'Otto domande flash sulla categoria scelta dalla squadra: conta rispondere, non correre.',
  },
  SCOMMESSA: {
    correct: '+banca incassata (100 → 400 → 800)',
    wrong: '0: la banca si brucia',
    missed: '0: la banca si brucia',
    note: 'Tre domande: ogni esatta raddoppia la banca, tra una e l’altra si sceglie se incassare o rischiare.',
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
  BONUS_ROULETTE: {
    correct: '+300 / +150 / +75 ai primi tre',
    wrong: '0',
    missed: '0',
    note: 'Il colore vincente resta in TV; il telefono sceglie solo il colore.',
  },
  BONUS_BASKET: {
    correct: '+300 / +150 / +75 ai primi tre',
    wrong: '0',
    missed: '0',
    note: '30 secondi di tiri; il punteggio del canestro decide il podio bonus.',
  },
};

export function scoringRuleFor(type: string | null | undefined): ScoringRule | null {
  if (!type) return null;
  return (SCORING_RULES as Record<string, ScoringRule>)[type]
    ?? BONUS_SCORING[type]
    ?? null;
}
