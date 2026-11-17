import { BONUS_LABELS, BONUS_TYPES, BonusType } from '../enums/bonus-type';
import { GameModeType } from '../enums/game-mode-type';
import { ScoringRule, scoringRuleFor } from '../models/scoring-rules';
import {
  ACT_DECKS,
  BONUS_AFTER_ACT,
  DETAILED_LEADERBOARD_ROUNDS,
  QUICK_LEADERBOARD_ROUNDS,
  ROUNDS_PER_ACT,
  TOTAL_ROUNDS,
  occurrencesOf,
  scheduledModes,
} from '../schedule';

/**
 * Contenuti del manuale sul telefono.
 *
 * I testi dei singoli giochi sono scrittura editoriale, ma tutti i numeri
 * vengono da `SCORING_RULES` e dalla scaletta condivisa: nessun punteggio o
 * conteggio di round è copiato a mano. Il test `manual-content.spec.ts`
 * fallisce se una modalità della scaletta resta senza scheda o se un numero
 * non corrisponde più alle regole.
 */

export interface ManualEntry {
  kind: 'GAME' | 'BONUS';
  /** Chiave della regola: GameModeType oppure BONUS_* per `scoringRuleFor`. */
  key: string;
  name: string;
  icon: string;
  summary: string;
  objective: string;
  phone: string[];
  tip: string;
  scoring: ScoringRule;
}

export interface ManualGame extends ManualEntry {
  kind: 'GAME';
  occurrences: number;
}

export interface ManualBonus extends ManualEntry {
  kind: 'BONUS';
  /** Atto dopo il quale arriva il bonus (1-based), se automatico. */
  afterAct: number | null;
}

interface EntryCopy {
  name: string;
  icon: string;
  summary: string;
  objective: string;
  phone: string[];
  tip: string;
}

const GAME_COPY: Record<GameModeType, EntryCopy> = {
  QUIZ: {
    name: 'QUIZ',
    icon: '🧠',
    summary: 'Tre manche a scelta multipla: il tempo decide quanto vale la risposta.',
    objective: 'Rispondere correttamente a tre domande con quattro opzioni; la TV mostra domanda e countdown.',
    phone: [
      'Tocca A, B, C o D: un solo invio per manche.',
      'Non c’è una prenotazione: rispondi e attendi la TV.',
      'Il telefono si blocca dopo la scelta.',
    ],
    tip: 'Rispondi subito: il valore della risposta scende con i secondi che passano.',
  },
  IMAGE_BLUR: {
    name: 'INDOVINA CHI',
    icon: '🕵️',
    summary: 'La foto si schiarisce per 60 secondi: prenota presto e rispondi a voce.',
    objective: 'Riconoscere il personaggio nella foto sfocata; prima prenoti, più punti vale la risposta.',
    phone: [
      'Tocca PRENOTATI quando riconosci il personaggio.',
      'Un indizio ogni 6 secondi: vita, film, carriera, curiosità.',
      'Dì la risposta al presentatore: la conferma arriva dalla regia.',
      'Il telefono si blocca dopo la prenotazione.',
    ],
    tip: 'Non aspettare che la foto sia nitida: il tempo rimasto moltiplica i punti.',
  },
  MUSIC: {
    name: 'INDOVINA LA CANZONE',
    icon: '🎵',
    summary: 'Quattro ascolti da 30 secondi: prenota e indovina titolo o artista.',
    objective: 'Riconoscere il brano ascoltato in TV; si può prenotare in qualsiasi momento della manche.',
    phone: [
      'Tocca PRENOTA E RISPONDI durante l’ascolto.',
      'Dì titolo e artista al presentatore.',
      'Dopo la prenotazione il brano riparte intero a volume pieno.',
    ],
    tip: 'Più prenoti presto, più vale: 1000 con tutta la manche davanti, minimo 250 anche all’ultimo secondo.',
  },
  WHEEL_OF_FORTUNE: {
    name: 'RUOTA DELLA FORTUNA',
    icon: '🎡',
    summary: 'Una frase a lettere coperte e un timer lungo: prenota e risolvi.',
    objective: 'Indovinare il proverbio o la frase mentre le lettere si aprono in TV.',
    phone: [
      'Tocca PRENOTA E RISPONDI quando pensi di averla.',
      'Dì la soluzione al presentatore.',
      'La TV continua ad aprire le lettere durante il round.',
    ],
    tip: 'Il timer è lungo: prenota quando la frase è abbastanza scoperta, non all’ultimo secondo.',
  },
  TIMELINE: {
    name: 'TIMELINE',
    icon: '🕰️',
    summary: 'Sei date da ordinare dal passato al presente, tutti sulla stessa scala.',
    objective: 'Ordinare le carte in TV dal più antico al più recente; l’ordine iniziale è già una risposta valida.',
    phone: [
      'Trascina le carte per correggere l’ordine.',
      'L’ordine viene inviato da solo: puoi sistemarlo fino allo scadere.',
      'La soluzione e i punti arrivano al reveal.',
    ],
    tip: 'Conta la posizione esatta: ogni carta nel posto giusto vale; sotto metà classifica si perde.',
  },
  TIME_BUZZER: {
    name: 'TIME BUZZER',
    icon: '⏱️',
    summary: 'Ferma il cronometro al momento giusto: tre manche con tagli progressivi.',
    objective: 'Fermare il tempo il più vicino possibile al bersaglio segreto, tra 5 e 20 secondi.',
    phone: [
      'Il cronometro parte da solo al segnale: tocca STOP quando pensi sia giusto.',
      'Non c’è un cronometro sul telefono: vai a sensazione.',
      'Dopo la prima manche esce circa un terzo dei tavoli; dopo la seconda gli ultimi due.',
    ],
    tip: 'Non restare fermo: chi non preme è ultimo ed esce. Chi arriva alla terza manche prende +150.',
  },
  BOMBA: {
    name: 'BOMBA',
    icon: '💣',
    summary: 'Un tabellone, un turno a testa e una bomba ogni tre tavoli.',
    objective: 'Scegliere caselle vere ed evitare le bombe; il tabellone è sul server e la TV lo mostra.',
    phone: [
      'Tocca una casella solo quando la TV indica il tuo turno.',
      'Casella vera: 0 punti e il turno passa.',
      'Bomba: −200 e fuori dal round.',
      'Se scade il tempo senza scegliere sei eliminato: −200 e non giochi le ondate successive.',
      'Durante l’ondata le caselle restano coperte: bombe, eliminati e penalità si scoprono solo alla fine.',
    ],
    tip: 'Il turno passa anche con una casella vera: non rallentare, ma guarda quante bombe restano.',
  },
  SPEED_RUSH: {
    name: 'SPEED RUSH',
    icon: '⚡',
    summary: '90 secondi di risposte lampo: la corsia avanza a ogni risposta giusta.',
    objective: 'Rispondere al maggior numero di prove (matematica, colori, bandiere, parole, traduzioni) e arrivare tra i primi.',
    phone: [
      'Tocca la risposta giusta il prima possibile.',
      'Ogni errore fa arretrare la corsia.',
      'La corsia avanza di poco: servono circa 25 risposte giuste per il traguardo.',
      'Le prove non si ripetono e diventano più difficili man mano che avanzi.',
      'La TV mostra solo le corsie: le domande sono sul telefono.',
    ],
    tip: 'Meglio tante risposte giuste di una sola velocissima: contano la costanza e la posizione.',
  },
  TENNIS_BATTLE: {
    name: 'TENNIS BATTLE',
    icon: '🎾',
    summary: 'Duello a coppie: rispondi per rimandare la pallina, primo a 6 game.',
    objective: 'Vincere la sfida di tennis rispondendo alle domande quando la pallina è dalla tua parte.',
    phone: [
      'Rispondi quando la TV ti passa la pallina.',
      'Risposta giusta: rimandi la pallina; sbagliata o scaduta: punto per l’avversario (15, 30, 40, vantaggio).',
      'Sul 40 pari si va ai vantaggi; dopo tre ritorni dal vantaggio arriva il killer point che decide il game.',
      'Hai 12 secondi per rispondere a ogni servizio.',
      'Le domande passano da facili a difficili con i tiri; la pallina arriva dritta, in diagonale, stretta, corta o a pallonetto.',
    ],
    tip: 'Rispondere in fretta accorcia il tempo dell’avversario. Anche il perdente prende +200.',
  },
  ARENA: {
    name: 'ARENA BATTLE ROYALE',
    icon: '🏟️',
    summary: 'Battle royale a domande rapide dentro un cerchio che si chiude.',
    objective: 'Restare dentro il cerchio e rispondere correttamente alle domande rapide.',
    phone: [
      'Rispondi il prima possibile: vero/falso oppure quattro opzioni.',
      'Risposta giusta +10, risposta sbagliata −10.',
      'Se il cerchio ti supera sei eliminato.',
    ],
    tip: 'Il piazzamento finale vale più delle singole risposte: 1000 al primo, 500 alla metà alta, −300 alla metà bassa.',
  },
  ULTIMA_SPIAGGIA: {
    name: 'ULTIMA SPIAGGIA',
    icon: '🏝️',
    summary: 'Cinque livelli da 100 a 500, una volta per squadra in tutta la serata.',
    objective: 'Scegliere un livello e rispondere alla categoria estratta; ogni livello si consuma per sempre.',
    phone: [
      'Scegli un livello non ancora usato, da 100 a 500.',
      'Rispondi alla domanda del tuo livello.',
      'Giusta +livello; sbagliata o scaduta −metà del livello.',
    ],
    tip: 'Conserva i livelli alti per quando sei sicuro: non tornano disponibili.',
  },
  AZZARDO: {
    name: 'AZZARDO',
    icon: '📊',
    summary: 'Quattro manche di scommesse: distribuisci dieci fiches da 20 punti.',
    objective: 'Puntare sulle risposte numeriche più vicine al valore vero, manche dopo manche.',
    phone: [
      'Distribuisci le 10 fiches da 20 punti sulle quattro opzioni.',
      'Le fiches si spostano liberamente, ma la puntata parte solo con CONFERMA PUNTATA: senza almeno una fiche non si conferma.',
      'Fiches giuste: 20 × quota (×2, ×3, ×4). Fiches sbagliate: perdono il 100/80/60/40%.',
      'Le fiches avanzate restano nel salvadanaio: ogni manche ne arrivano dieci nuove, che si sommano.',
      'Il tetto cresce con il salvadanaio: una fiche in più da giocare ogni due avanzate, fino a 15. Massimo 1000 punti incassati in una manche.',
    ],
    tip: 'La perdita scende manche dopo manche: nella prima si rischia più che nella quarta. Mai sotto zero.',
  },
  BLACKJACK: {
    name: 'BLACKJACK',
    icon: '🃏',
    summary: 'Tre mani contro il banco della TV: carta o stai.',
    objective: 'Battere il banco senza sballare; la TV fa il banco una volta per ogni tavolo.',
    phone: [
      'Quando la TV chiama il tuo tavolo scegli CARTA o STAI.',
      'Il banco si ferma a 17.',
      'Vittoria +250, naturale +500, sconfitta −250 (mai sotto zero).',
    ],
    tip: 'Con 17 o più conviene spesso stare; il naturale paga il doppio.',
  },
  BIGLIE: {
    name: 'BIGLIE',
    icon: '🎱',
    summary: 'Quattro round separati, due gare per round: una biglia per tavolo e punti in classifica.',
    objective: 'Scegliere una biglia e portarla al traguardo su due delle otto piste — rally, F1, neve, acqua, vetro, sabbia, spazio, magma — scelte dal seme; ogni gara assegna 150/100/60/30.',
    phone: [
      'Quando la TV chiama il tuo tavolo scegli la biglia.',
      'La biglia resta la stessa per le due gare del round.',
      'Segui le piste in TV: i punti arrivano all’ordine d’arrivo.',
    ],
    tip: 'I punti di ogni gara entrano subito in classifica; il round si chiude dopo la seconda gara.',
  },
};

const BONUS_COPY: Record<BonusType, EntryCopy> = {
  CASINO_COLOR: {
    name: 'CASINO BIANCO/ROSSO',
    icon: '🔴',
    summary: 'Una sola puntata sul colore: bianco o rosso, poi la ruota decide.',
    objective: 'Scegliere il colore e sperare che la pallina si fermi sulla stessa famiglia; lo zero è del banco.',
    phone: [
      'Tocca BIANCO o ROSSO quando la TV apre le puntate.',
      'La pallina esce una volta sola: niente recuperi.',
      'La TV mostra il numero, il colore e i punti.',
    ],
    tip: 'Il colore giusto vale +100 in classifica; lo zero non paga nessuno.',
  },
  BLACKJACK: {
    name: 'BLACKJACK',
    icon: '🃏',
    summary: 'Un turno per tavolo contro il banco della TV: carta o stai.',
    objective: 'Battere il banco senza sballare; il banco si ferma a 17 e il naturale batte tutto.',
    phone: [
      'Quando la TV chiama il tuo tavolo scegli CARTA o STAI.',
      'La TV apre il banco alla fine della mano.',
      'Vittoria +150, pari +75, sconfitta 0: il bonus non toglie punti.',
    ],
    tip: 'Con 17 o più conviene spesso stare; il naturale paga come una vittoria piena.',
  },
  CASINO_DOZEN: {
    name: 'CASINO DOZZINA',
    icon: '🎰',
    summary: 'Una sola puntata sulla dozzina: 1-12, 13-24 o 25-36.',
    objective: 'Indovinare in quale dozzina cade il numero; lo zero è del banco.',
    phone: [
      'Tocca la dozzina quando la TV apre le puntate.',
      'La ruota gira una volta sola.',
      'La dozzina giusta vale +120 in classifica.',
    ],
    tip: 'Tre caselle, una sola vincita: meglio scegliere subito che aspettare l’ultimo secondo.',
  },
  CAVALLO: {
    name: 'CAVALLO DI BATTAGLIA',
    icon: '🐎',
    summary: 'Otto domande flash sulla categoria scelta dai tavoli, podio a punti.',
    objective: 'Votare la categoria e rispondere a otto domande rapide; il podio delle risposte esatte prende i punti.',
    phone: [
      'Vota la categoria della sfida.',
      'Tocca la risposta giusta: ogni esatta sale nel tabellone.',
      'La TV mostra tabellone e podio del bonus.',
    ],
    tip: 'Primo +200, secondo +100, terzo +50 in classifica. Gli altri restano a zero.',
  },
  CASINO_NUMBER: {
    name: 'CASINO NUMERO SECCO',
    icon: '🎯',
    summary: 'La finale: una sola puntata su un numero da 0 a 36.',
    objective: 'Indovinare il numero esatto dell’ultimo giro; la ruota rigira finché almeno un tavolo vince.',
    phone: [
      'Scegli un numero quando la TV apre le puntate.',
      'La pallina esce una volta sola, con un ultimo giro di suspense.',
      'Il numero esatto vale +300 in classifica.',
    ],
    tip: 'Trentasette caselle, una sola paga: è il bonus più alto della serata.',
  },
};

function ruleFor(key: string): ScoringRule {
  const rule = scoringRuleFor(key);
  if (!rule) throw new Error(`Manuale: regola mancante per ${key}`);
  return rule;
}

export const MANUAL_GAMES: readonly ManualGame[] = scheduledModes().map((type) => ({
  kind: 'GAME' as const,
  key: type,
  occurrences: occurrencesOf(type),
  scoring: ruleFor(type),
  ...GAME_COPY[type],
}));

export const MANUAL_BONUSES: readonly ManualBonus[] = BONUS_TYPES.map((type) => {
  const act = BONUS_AFTER_ACT.indexOf(type);
  return {
    kind: 'BONUS' as const,
    key: `BONUS_${type}`,
    afterAct: act >= 0 ? act + 1 : null,
    scoring: ruleFor(`BONUS_${type}`),
    ...BONUS_COPY[type],
  };
});

export const MANUAL_ENTRIES: readonly ManualEntry[] = [...MANUAL_GAMES, ...MANUAL_BONUSES];

const bonusActs = BONUS_AFTER_ACT
  .map((type, index) => (type ? `atto ${index + 1} ${BONUS_LABELS[type]}` : null))
  .filter((value): value is string => !!value);

export interface ManualSection {
  title: string;
  lines: string[];
}

export const MANUAL_SECTIONS: readonly ManualSection[] = [
  {
    title: 'LA SERATA',
    lines: [
      `${TOTAL_ROUNDS} round divisi in ${ACT_DECKS.length} atti da ${ROUNDS_PER_ACT}.`,
      `Classifica rapida dopo i round ${QUICK_LEADERBOARD_ROUNDS.join(', ')}; dettagliata dopo ${DETAILED_LEADERBOARD_ROUNDS.join(', ')}.`,
      `Bonus previsti: ${bonusActs.join(', ')}. Dopo l’atto 5 si chiude con la classifica finale.`,
    ],
  },
  {
    title: 'TELEFONO SPENTO O PAGINA CHIUSA',
    lines: [
      'Riapri /play sullo stesso browser e sulla stessa rete: la squadra riprende dal token salvato.',
      'Non cancellare i dati del sito e non cambiare browser: senza token il nome non si può riprendere da soli.',
      'Se lo schermo si blocca o esci dal browser, al ritorno il telefono resta bloccato finché il server non dice se il round è ancora aperto.',
      'Prenotazioni e risposte chiudono alla scadenza: dopo la fine del round il telefono non manda più nulla.',
    ],
  },
  {
    title: 'PAUSA E REGIA',
    lines: [
      'La regia può mettere in pausa la serata: il telefono mostra IN PAUSA e gli input sono bloccati.',
      'Durante un round il manuale non è disponibile e si chiude da solo se il round parte mentre è aperto.',
      'Nelle classifiche e tra un round e l’altro il manuale torna disponibile.',
    ],
  },
];
