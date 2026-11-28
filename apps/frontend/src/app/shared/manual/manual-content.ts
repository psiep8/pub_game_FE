import { BONUS_LABELS, BONUS_TYPES, BonusType } from '../enums/bonus-type';
import { GameModeType } from '../enums/game-mode-type';
import {
  BIGLIE_FIRST,
  BIGLIE_LAST,
  BONUS_CASINO_FIVE_POINTS,
  BONUS_CASINO_NUMBER_POINTS,
  BONUS_KARAOKE_BUZZ_SECONDS,
  BONUS_KARAOKE_MANCHE_POINTS,
  BONUS_KARAOKE_SECONDS,
  BOMBA_PEAK,
  CASINO_SPINS,
  IMAGE_BLUR_MANCHE_CATEGORIES,
  IMAGE_BLUR_MANCHE_POINTS,
  MUSIC_FIRST_LISTEN_POINTS,
  MUSIC_GAME_MAX,
  MUSIC_SECOND_LISTEN_PENALTY,
  MUSIC_SECOND_LISTEN_POINTS,
  ScoringRule,
  SPEED_RUSH_FIRST,
  SPEED_RUSH_LAST,
  TENNIS_WIN,
  TIMELINE_POSITION_POINTS,
  TIME_BUZZER_LAST,
  TIME_BUZZER_PERFECT,
  TIME_BUZZER_PERFECT_MS,
  scoringRuleFor,
} from '../models/scoring-rules';
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

const GAME_COPY: Record<Exclude<GameModeType, 'BLACKJACK'>, EntryCopy> = {
  QUIZ: {
    name: 'QUIZ',
    icon: '🧠',
    summary: 'Tre manche da quindici secondi a scelta multipla: il tempo decide quanto vale la risposta.',
    objective: 'Rispondere correttamente a tre domande con quattro opzioni; la TV mostra domanda e countdown.',
    phone: [
      'Tocca A, B, C o D: un solo invio per manche.',
      'Non c’è una prenotazione: rispondi e attendi la TV.',
      'Il telefono si blocca dopo la scelta.',
    ],
    tip: 'Rispondi subito: la risposta esatta vale meno con i secondi che passano, e la sbagliata costa la stessa quota, sempre meno con il tempo. Il round va da −1000 a +1000.',
  },
  IMAGE_BLUR: {
    name: 'INDOVINA CHI',
    icon: '🕵️',
    summary: `Tre manche da 45 secondi, una per ambito: ${IMAGE_BLUR_MANCHE_CATEGORIES.join(', ')}.`,
    objective: 'Riconoscere il personaggio nella foto sfocata di ogni manche; prima prenoti, più punti vale la risposta.',
    phone: [
      'Tocca PRENOTATI quando riconosci il personaggio.',
      'Un indizio ogni 15 secondi: vita, film, carriera, curiosità.',
      'Dì la risposta al presentatore: la conferma arriva dalla regia.',
      'Il telefono si blocca dopo la prenotazione e si riarma alla manche successiva.',
    ],
    tip: `Il vecchio round da 1000 punti è diviso tre manche: ${IMAGE_BLUR_MANCHE_POINTS[0]}, ${IMAGE_BLUR_MANCHE_POINTS[1]} e ${IMAGE_BLUR_MANCHE_POINTS[2]}, sempre in proporzione al tempo rimasto. In tutto il round il massimo resta 1000. Non aspettare che la foto sia nitida: il tempo rimasto moltiplica i punti.`,
  },
  MUSIC: {
    name: 'INDOVINA LA CANZONE',
    icon: '🎵',
    summary: 'Quattro round da cinque manche: un tema, cinque brani. Primo ascolto 4 secondi, secondo 12.',
    objective: 'Riconoscere cinque brani dello stesso tema, uno per manca. Si prenota solo nella finestra di 5 secondi ad audio fermo, subito dopo ogni ascolto.',
    phone: [
      'Ascolta il brano: prima 4 secondi, poi 12 dall’inizio.',
      'Tocca PRENOTA E RISPONDI nella finestra di 5 secondi, ad audio fermo.',
      'Dì titolo o artista al presentatore: la TV svela brano, anno e copertina.',
    ],
    tip: `Primo ascolto +${MUSIC_FIRST_LISTEN_POINTS}, secondo +${MUSIC_SECOND_LISTEN_POINTS}, zero se nessuno prenota. Sbagliare al secondo costa ${Math.abs(MUSIC_SECOND_LISTEN_PENALTY)}, al primo non toglie punti. Il round vale 1000, la partita ${MUSIC_GAME_MAX}: è la più pesante della serata.`,
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
    summary: 'Otto date da ordinare dal passato al presente, tutti sulla stessa scala.',
    objective: 'Ordinare le carte in TV dal più antico al più recente; l’ordine iniziale è già una risposta valida.',
    phone: [
      'Trascina le carte per correggere l’ordine.',
      'L’ordine viene inviato da solo: puoi sistemarlo fino allo scadere.',
      'La soluzione e i punti arrivano al reveal.',
    ],
    tip: `Conta la posizione esatta: 8 posti giusti valgono ${TIMELINE_POSITION_POINTS[8]}, 4 valgono 0, con 1 o 0 si paga ${TIMELINE_POSITION_POINTS[1]}.`,
  },
  TIME_BUZZER: {
    name: 'TIME BUZZER',
    icon: '⏱️',
    summary: 'Ferma il cronometro al momento giusto: tre manche da venti secondi, tutte le squadre in gioco.',
    objective: 'Fermare il tempo il più vicino possibile al bersaglio segreto, tra 5 e 20 secondi.',
    phone: [
      'Il cronometro parte da solo al segnale: tocca STOP quando pensi sia giusto.',
      'Non c’è un cronometro sul telefono: vai a sensazione.',
      'Tutti giocano tutte e tre le manche: non si esce mai.',
      'Chi non preme è ultimo della manche e prende il malus dell’ultimo posto.',
    ],
    tip: `Il primo prende +300, l’ultimo ${TIME_BUZZER_LAST}, il posto di mezzo 0. Chi centra il bersaglio entro ${TIME_BUZZER_PERFECT_MS} ms prende +${TIME_BUZZER_PERFECT} al posto dei 300.`,
  },
  BOMBA: {
    name: 'BOMBA',
    icon: '💣',
    summary: 'Un tabellone, un turno a testa e circa due bombe ogni cinque tavoli.',
    objective: 'Scegliere caselle vere ed evitare le bombe; il tabellone è sul server e la TV lo mostra.',
    phone: [
      'Prima del primo turno hai 30 secondi per leggere l’argomento: le caselle si aprono al via.',
      'Tocca una casella solo quando la TV indica il tuo turno.',
      'Casella vera: 0 punti e il turno passa.',
      `Bomba: fuori dal round, con un malus che parte da ${BOMBA_PEAK} e scende con le bombe rimaste: si scala dal totale anche sotto zero.`,
      'Se scade il tempo senza scegliere sei fuori come se avessi preso una bomba.',
      'Durante l’ondata le caselle restano coperte: la bomba esplode subito, il resto degli esiti si scopre alla fine.',
    ],
    tip: 'Le caselle vere non danno punti: servono solo a restare in vita. La prima bomba costa più delle ultime e chi si salva prende 0.',
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
    tip: `Conta il piazzamento: ${SPEED_RUSH_FIRST} al primo, ${SPEED_RUSH_LAST} all’ultimo, zero a metà se le squadre sono dispari.`,
  },
  TENNIS_BATTLE: {
    name: 'TENNIS BATTLE',
    icon: '🎾',
    summary: 'Duello a coppie su un campo con le linee regolamentari: rispondi per rimandare la pallina. Partita al meglio di tre game (vince chi ne fa due); sul 40-40 si va dritti al killer point, senza vantaggi.',
    objective: 'Vincere la sfida di tennis rispondendo alle domande quando la pallina è dalla tua parte.',
    phone: [
      'Rispondi quando la TV ti passa la pallina.',
      'Risposta giusta: rimandi la pallina; sbagliata o scaduta: punto per l’avversario (15, 30, 40).',
      'Sul 40-40 niente vantaggi: il punto dopo è il killer point e decide il game.',
      'La partita è al meglio di tre game: chi ne vince due chiude la sfida.',
      'Hai 12 secondi per rispondere a ogni servizio.',
      'Le domande passano da facili a difficili con i tiri; la pallina arriva dritta, in diagonale, stretta, corta o a pallonetto.',
    ],
    tip: `Rispondere in fretta accorcia il tempo dell’avversario. Chi vince la partita prende +${TENNIS_WIN}, chi perde zero.`,
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
    summary: 'Quattro manche di scommesse: distribuisci dieci fiche da poker da 20 punti.',
    objective: 'Puntare sulle risposte numeriche più vicine al valore vero, manche dopo manche.',
    phone: [
      'Distribuisci le 10 fiches da 20 punti sulle quattro opzioni.',
      'Le fiches si spostano liberamente, ma la puntata parte solo con CONFERMA PUNTATA: senza almeno una fiche non si conferma.',
      'Fiches giuste: 20 × quota (×2, ×3, ×4). Fiches sbagliate: perdono il 100/80/60/40%.',
      'Le fiches avanzate restano nel salvadanaio: ogni manche ne arrivano dieci nuove, che si sommano.',
      'Il tetto cresce con il salvadanaio: una fiche in più da giocare ogni due avanzate, fino a 15. Massimo 500 punti incassati in una manche, 1500 nel round.',
    ],
    tip: 'La perdita scende manche dopo manche: nella prima si rischia più che nella quarta, con un tetto di 250 a manche e 1000 nel round. Mai sotto zero.',
  },
  BIGLIE: {
    name: 'BIGLIE',
    icon: '🎱',
    summary: 'Quattro round separati, due gare per round: una biglia per tavolo e punti in classifica.',
    objective: `Scegliere una biglia e portarla al traguardo su due delle otto piste — rally, F1, neve, acqua, vetro, sabbia, spazio, magma — scelte dal seme; ogni gara assegna ${BIGLIE_FIRST} al primo e ${BIGLIE_LAST} all’ultimo, con zero a metà se le squadre sono dispari.`,
    phone: [
      'Quando la TV chiama il tuo tavolo scegli la biglia.',
      'La biglia resta la stessa per le due gare del round.',
      'Segui le piste in TV: i punti arrivano all’ordine d’arrivo.',
    ],
    tip: 'I punti delle due gare si sommano fra loro e fra i quattro round: vincere paga, arrivare in fondo costa.',
  },
};

const BONUS_COPY: Record<BonusType, EntryCopy> = {
  KARAOKE: {
    name: 'KARAOKE',
    icon: '🎤',
    summary: 'Cinque canzoni italiane, clip da 30 secondi e microfono conteso: la musica si ferma senza preavviso.',
    objective: `Leggere il testo karaoke in TV e ascoltare la clip. A fine riga la musica si ferma: il primo tavolo che prenota prende il microfono fisico e canta le frasi successive. La regia dice CORRETTO o SBAGLIATO; sbagliare non toglie punti e riapre le prenotazioni.`,
    phone: [
      'Ascolta e leggi il testo: la clip dura 30 secondi.',
      'Al silenzio tocca PRENOTA IL MICROFONO: vale il primo tocco.',
      `Canta le frasi successive al microfono del presentatore. La regia ha ${BONUS_KARAOKE_BUZZ_SECONDS} secondi per il verdetto.`,
      'Se sbagli resti fuori da quella manche; nessun malus.',
    ],
    tip: `Punti: ${BONUS_KARAOKE_MANCHE_POINTS.map((value) => `+${value}`).join(' / ')}. Massimo +${BONUS_KARAOKE_MANCHE_POINTS.reduce((a, b) => a + b, 0)}. La clip è di ${BONUS_KARAOKE_SECONDS} secondi.`,
  },
  SETTE_E_MEZZO: {
    name: 'SETTE E MEZZO',
    icon: '🃏',
    summary: 'Un turno per tavolo contro il banco della TV: carta o stai, il più vicino a 7,5 vince.',
    objective: 'Fermarsi il più vicino possibile a 7,5 senza sballare. Il banco pesca fino a 7,25 e vince i pareggi; il naturale (7 + figura) batte tutto salvo il naturale del banco.',
    phone: [
      'Quando la TV chiama il tuo tavolo scegli CARTA o STAI.',
      'Il Re di denari è la matta: vale 1 o 0,5 nel modo migliore, senza sballare.',
      'La TV apre il banco alla fine della mano.',
      'Chi batte il banco riceve il premio concordato con il bar, non punti. Sconfitte e pareggi non tolgono nulla.',
    ],
    tip: 'Con 6 o più conviene spesso stare: il banco pesca sul 7. Il premio lo consegnano barista e presentatore.',
  },
  CASINO_FIVE: {
    name: 'CASINO 5 MANCHE',
    icon: '🎰',
    summary: 'Cinque manche, una girata ciascuna: colore, dozzina, parità, alto/basso, numero secco.',
    objective: `Scegliere la casella giusta a ogni manche. La ruota gira una volta per manche; lo zero è del banco.`,
    phone: [
      'Scegli una casella a ogni manche, entro dieci secondi.',
      'La TV mostra numero, casella vincente e punti.',
      `Punti per manche: ${BONUS_CASINO_FIVE_POINTS.map((value) => `+${value}`).join(' / ')}.`,
    ],
    tip: `Massimo +${BONUS_CASINO_FIVE_POINTS.reduce((a, b) => a + b, 0)} se azzecchi tutte e cinque le manche; lo zero non paga nessuno.`,
  },
  CAVALLO: {
    name: 'CAVALLO DI BATTAGLIA',
    icon: '🐎',
    summary: 'Otto domande flash sulla categoria scelta dai tavoli: il vincitore riceve il premio del bar.',
    objective: 'Votare la categoria e rispondere a otto domande rapide; vince chi ha più risposte giuste, a pari merito chi ha finito prima.',
    phone: [
      'Vota la categoria della sfida.',
      'Tocca la risposta giusta: ogni esatta sale nel tabellone.',
      'La TV mostra tabellone e vincitore del bonus.',
    ],
    tip: 'Il vincitore riceve il premio concordato con il bar, non punti: lo consegnano barista e presentatore. A pari merito vince chi ha finito prima.',
  },
  CASINO_NUMBER: {
    name: 'CASINO NUMERO SECCO',
    icon: '🎯',
    summary: `Un numero da 0 a 36 scelto una volta, poi tre girate.`,
    objective: 'Scegliere un numero prima delle tre girate: chi lo becca prende 1000 punti una volta sola.',
    phone: [
      'Scegli un numero, una volta sola, entro dieci secondi: resta quello per tutte e tre le girate.',
      `La pallina esce ${CASINO_SPINS} volte, con un ultimo giro di suspense.`,
      `Il numero scelto vale ${BONUS_CASINO_NUMBER_POINTS} punti, una volta sola: se esce di nuovo non paga il doppio.`,
    ],
    tip: `Trentasette caselle: massimo ${BONUS_CASINO_NUMBER_POINTS} punti, è il bonus più alto della serata.`,
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
  ...GAME_COPY[type as Exclude<GameModeType, 'BLACKJACK'>],
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
      `Un bonus per atto, in un round interno scelto all’inizio della serata: ${bonusActs.join(', ')}. Dopo l’atto 5 si chiude con la classifica finale.`,
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
