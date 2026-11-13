import { GameModeType } from './game-mode-type';

/**
 * Punteggi ufficiali della serata.
 *
 * La stessa tabella la usano il pannello admin (anteprima e aiuto al
 * presentatore) e le demo animate: un solo posto da cambiare quando si
 * ritocca un gioco.
 */
/** Pausa fra la scadenza del tempo e il reveal: la TV mostra l'attesa. */
export const REVEAL_DELAY_MS = 1700;

export interface ScoringRule {
  correct: string;
  wrong: string;
  missed: string;
  note: string;
}

export const SCORING_RULES: Record<GameModeType, ScoringRule> = {
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
    correct: 'fino a +1000 in base ai secondi rimasti (minimo 250)',
    wrong: '−1000',
    missed: '0 (nessun malus)',
    note: 'Quattro manche da 30 secondi: la risposta vale 1000 diviso 30 per i secondi che restano, mai sotto 250. Dopo la prenotazione il brano riascolta intero a volume pieno.',
  },
  WHEEL_OF_FORTUNE: {
    correct: '+1000 × tempo rimasto',
    wrong: '−1000 × tempo rimasto',
    missed: '0 (nessun malus)',
    note: 'Le lettere si aprono nel tempo con estrazione guidata: vocale e lettera ripetuta entro le prime tre. Chi prenota prima rischia meno.',
  },
  TIMELINE: {
    correct: 'fino a +1200',
    wrong: 'fino a −400 sotto soglia',
    missed: '0 (nessun malus)',
    note: '1200 × posizioni esatte / n; sotto n/2 − 1 si perde, fino a −400.',
  },
  TIME_BUZZER: {
    correct: '+300…+500 a fascia, manche dopo manche',
    wrong: '−250 / −100 se tagliato',
    missed: 'ultimo: esce per primo',
    note: 'Tre manche da 30 s con bersaglio 5–20 s: dopo la prima esce circa un terzo dei tavoli, dopo la seconda gli ultimi due. I finalisti prendono +150.',
  },
  BOMBA: {
    correct: '0: la casella vera si salva e passa il turno',
    wrong: '−200 e fuori dal round',
    missed: '−200 e fuori dal round: chi non sceglie in tempo è eliminato',
    note: 'Un tabellone, un turno per squadra: quasi tutte le caselle sono vere, una ogni tre squadre e falsa. Le false mai scelte si disarmano a fine round.',
  },
  SPEED_RUSH: {
    correct: '500 al primo, poi a scalare',
    wrong: '0 (la corsia arretra)',
    missed: '0 sotto la metà',
    note: 'Prendono punti solo i primi n/2 arrivati; il distacco in millesimi dal primo riduce il bonus, minimo 100.',
  },
  AIR_HOCKEY_BATTLE: {
    correct: '+1000 al vincitore',
    wrong: 'gol per l’avversario',
    missed: 'gol per l’avversario',
    note: 'Il set si chiude a 7 gol; il perdente riceve +200 di consolazione. Risposte rapide accorciano il tempo dell’avversario.',
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
  BLACKJACK: {
    correct: '+250 a mano, +500 col naturale',
    wrong: '−250 (mai sotto zero)',
    missed: '0 al pari; −250 se si sballa',
    note: 'Tre round: la TV fa il banco una volta per ogni giocatore. Le vittorie si sommano (250 → 500 → 750), le sconfitte restano 250 e non cumulano.',
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
  BONUS_CASINO: {
    correct: '+100 / +150 / +200 / +300 a manche',
    wrong: '0',
    missed: '0',
    note: 'Colore, dozzina, sestina e numero secco: ogni manche si chiude con un giro della roulette in TV. Sullo zero il banco incassa; sul numero secco si rigira finché almeno un tavolo vince. La classifica del bonus non assegna ancora punti in classifica.',
  },
  BONUS_BASKET: {
    correct: '+2 / +3 / +5 a canestro (swish +1)',
    wrong: '0',
    missed: '0',
    note: 'Tre manche da 20 secondi con ferro largo, medio e piccolo; la TV somma i punti e mostra la classifica del bonus. In serata reale il bonus è bloccato finché il punteggio non è verificato dal server: si apre solo in simulazione e anteprima.',
  },
  BONUS_CAVALLO: {
    correct: '+1 per risposta esatta',
    wrong: '0',
    missed: '0',
    note: 'Otto domande flash sulla categoria votata dai telefoni; la classifica del bonus conta le risposte esatte e non assegna ancora punti in classifica.',
  },
  BONUS_BIGLIE: {
    correct: '+150 / +100 / +60 / +30 a gara',
    wrong: '0',
    missed: '0',
    note: 'Quattro gare su fondi diversi, punti cumulativi: una biglia per tavolo scelta una volta sola. La classifica del bonus non assegna ancora punti in classifica.',
  },
};

export function scoringRuleFor(type: string | null | undefined): ScoringRule | null {
  if (!type) return null;
  return (SCORING_RULES as Record<string, ScoringRule>)[type]
    ?? BONUS_SCORING[type]
    ?? null;
}
