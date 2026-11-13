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
      'Un indizio ogni 15 secondi: vita, film, carriera, curiosità.',
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
    objective: 'Fermare il tempo il più vicino possibile al bersaglio segreto, tra 5 e 29 secondi.',
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
    ],
    tip: 'Il turno passa anche con una casella vera: non rallentare, ma guarda quante bombe restano.',
  },
  SPEED_RUSH: {
    name: 'SPEED RUSH',
    icon: '⚡',
    summary: 'Sessanta secondi di risposte lampo: la corsia avanza a ogni risposta giusta.',
    objective: 'Rispondere al maggior numero di prove (matematica, colori, bandiere, parole, traduzioni) e arrivare tra i primi.',
    phone: [
      'Tocca la risposta giusta il prima possibile.',
      'Ogni errore fa arretrare la corsia.',
      'La TV mostra solo le corsie: le domande sono sul telefono.',
    ],
    tip: 'Meglio tante risposte giuste di una sola velocissima: contano la costanza e la posizione.',
  },
  AIR_HOCKEY_BATTLE: {
    name: 'AIR HOCKEY BATTLE',
    icon: '🏒',
    summary: 'Duello a coppie: rispondi per rimandare il disco, primo a 7 gol.',
    objective: 'Vincere il set di air hockey rispondendo alle domande quando il disco è dalla tua parte.',
    phone: [
      'Rispondi quando la TV ti passa il disco.',
      'Risposta giusta: rimandi il disco; sbagliata o scaduta: gol per l’avversario.',
      'Hai 12 secondi per rispondere a ogni servizio.',
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
      'Puoi spostarle fino allo scadere.',
      'Fiches giuste: 20 × quota (×2, ×3, ×4). Fiches sbagliate: perdono il 100/80/60/40%.',
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
};

const BONUS_COPY: Record<BonusType, EntryCopy> = {
  CASINO: {
    name: 'BONUS CASINO',
    icon: '🎰',
    summary: 'Quattro manche di roulette: colore, dozzina, sestina, numero secco.',
    objective: 'Indovinare l’esito del giro di roulette in TV; ogni manche vale più della precedente.',
    phone: [
      'Tocca la casella della manche: colore, dozzina, sestina o numero.',
      'Sullo zero il banco incassa; sul numero secco si rigira finché un tavolo vince.',
      'La TV mostra ruota e classifica del bonus.',
    ],
    tip: 'Le manche valgono 100, 150, 200 e 300. La classifica del bonus non assegna ancora punti in classifica.',
  },
  BASKET: {
    name: 'BONUS BASKET',
    icon: '🏀',
    summary: 'Tre manche al canestro dal telefono, ferro sempre più piccolo.',
    objective: 'Fare più canestri possibile in tre manche da 20 secondi; la TV somma i punti.',
    phone: [
      'Apri /basket dal telefono e tira trascinando.',
      'Ferro largo +2, medio +3, piccolo +5; lo swish vale +1.',
      'In serata reale il bonus è bloccato finché il punteggio non è verificato dal server: si apre solo in simulazione e anteprima.',
    ],
    tip: 'La classifica del bonus non assegna ancora punti in classifica.',
  },
  CAVALLO: {
    name: 'CAVALLO DI BATTAGLIA',
    icon: '🐎',
    summary: 'Otto domande flash sulla categoria scelta dai tavoli.',
    objective: 'Votare la categoria e rispondere a otto domande rapide; vince chi ne indovina di più.',
    phone: [
      'Vota la categoria della sfida.',
      'Tocca la risposta giusta: +1 per ogni esatta.',
      'La TV mostra tabellone e classifica del bonus.',
    ],
    tip: 'La classifica del bonus non assegna ancora punti in classifica.',
  },
  BIGLIE: {
    name: 'BONUS BIGLIE',
    icon: '🎱',
    summary: 'Quattro gare su quattro fondi con una biglia scelta una volta sola.',
    objective: 'Scegliere una biglia e portarla al traguardo nelle quattro gare; i punti si sommano.',
    phone: [
      'Scegli la tua biglia quando la TV chiama il tuo tavolo.',
      'La biglia resta la stessa per tutte e quattro le gare.',
      'La TV mostra le piste e la classifica cumulativa.',
    ],
    tip: '150/100/60/30 a gara: la costanza conta più della singola vittoria. Nessun punto in classifica per ora.',
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
      `Dopo gli atti 1–4 c’è un bonus: ${bonusActs.join(', ')}. Dopo l’atto 5 si chiude con la classifica finale.`,
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
