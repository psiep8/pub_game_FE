import { BONUS_LABELS, BONUS_TYPES, BonusType } from '../../shared/enums/bonus-type';
import { GameModeType } from '../../shared/enums/game-mode-type';
import { ScoringRule, scoringRuleFor } from '../../shared/models/scoring-rules';
import {
  ACT_DECKS,
  BONUS_AFTER_ACT,
  ROUNDS_PER_ACT,
  TOTAL_ROUNDS,
  occurrencesOf,
  scheduledModes,
} from '../../shared/schedule';

/**
 * Copioni delle demo TV.
 *
 * Non sono video preregistrati: sono cinque scene animate (obiettivo, telefono,
 * come si vince, come si perde, esempio) che il presentatore commenta dal vivo.
 * I punteggi delle scene e la tabella finale arrivano da `SCORING_RULES`; la
 * copertura di giochi e bonus viene dalla scaletta condivisa. Il test
 * `demo-scripts.spec.ts` fallisce se manca una demo o se un numero non
 * corrisponde più alle regole.
 */
export interface DemoScoreRow {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface DemoScene {
  kicker: string;
  title: string;
  lines: string[];
}

export interface DemoScript {
  key: string;
  title: string;
  icon: string;
  kind: 'INTRO' | 'GAME' | 'BONUS';
  scenes: DemoScene[];
  scoring: DemoScoreRow[];
  note: string;
}

interface DemoCopy {
  title: string;
  icon: string;
  objective: string[];
  phone: string[];
  win: string[];
  lose: string[];
  example: string;
}

function ruleFor(key: string): ScoringRule {
  const rule = scoringRuleFor(key);
  if (!rule) throw new Error(`Demo: regola mancante per ${key}`);
  return rule;
}

/** La tabella della demo non è mai scritta a mano: è la regola ufficiale. */
function scoringRows(rule: ScoringRule): DemoScoreRow[] {
  return [
    { label: 'Corretto', value: rule.correct, tone: 'good' },
    { label: 'Sbagliato', value: rule.wrong, tone: 'bad' },
    { label: 'Non risposta', value: rule.missed, tone: 'neutral' },
  ];
}

function scenesFor(copy: DemoCopy, rule: ScoringRule): DemoScene[] {
  return [
    {
      kicker: 'OBIETTIVO',
      title: copy.title,
      lines: copy.objective,
    },
    {
      kicker: 'SUL TELEFONO',
      title: 'COSA FA IL TAVOLO',
      lines: copy.phone,
    },
    {
      kicker: 'COME SI VINCE',
      title: 'PUNTI CHE CONTANO',
      lines: [rule.correct, ...copy.win],
    },
    {
      kicker: 'COME SI PERDE',
      title: 'ERRORI E MALUS',
      lines: [rule.wrong, rule.missed, ...copy.lose],
    },
    {
      kicker: 'ESEMPIO',
      title: 'NUMERI VERI',
      lines: [copy.example],
    },
  ];
}

const GAME_COPY: Record<GameModeType, DemoCopy> = {
  QUIZ: {
    title: 'QUIZ',
    icon: '🧠',
    objective: [
      'Tre domande a scelta multipla, una per manche.',
      'La TV mostra la domanda e il countdown: contano la risposta esatta e il tempo.',
    ],
    phone: [
      'Tocca A, B, C o D: un solo invio per manche.',
      'Il telefono si blocca dopo la scelta.',
      'La soluzione arriva in TV al reveal.',
    ],
    win: [
      'Risposta esatta: il valore pieno della domanda, ridotto dal tempo.',
      'Il massimo complessivo delle tre manches è 1000.',
    ],
    lose: [
      'Risposta sbagliata: perdi la stessa quota, sempre scalata dal tempo.',
      'Chi non risponde resta a 0.',
    ],
    example: 'Tre risposte esatte a tempo zero valgono 1000 in totale; a metà tempo valgono circa la metà.',
  },
  IMAGE_BLUR: {
    title: 'INDOVINA CHI',
    icon: '🕵️',
    objective: [
      'La foto parte sfocata e si schiarisce con il tempo: il round dura 60 secondi.',
      'Un indizio ogni 15 secondi: vita, film, carriera, curiosità.',
      'Prenota quando riconosci il personaggio: la risposta si dice a voce.',
    ],
    phone: [
      'Tocca PRENOTATI; il telefono si blocca.',
      'Dì il nome al presentatore: la regia conferma giusto o sbagliato.',
    ],
    win: ['Risposta corretta: fino a +1000, in proporzione al tempo rimasto.'],
    lose: [
      'Risposta sbagliata: fino a −1000, sempre in proporzione al tempo rimasto.',
      'Se nessuno prenota, il round resta a 0.',
    ],
    example: 'Prenoti quando resta un terzo del tempo: la risposta vale circa ±333.',
  },
  MUSIC: {
    title: 'INDOVINA LA CANZONE',
    icon: '🎵',
    objective: [
      'Quattro manches da 30 secondi, una canzone per manche.',
      'Si può prenotare in qualsiasi momento dell’ascolto.',
    ],
    phone: [
      'Tocca PRENOTA E RISPONDI.',
      'Dì titolo e artista al presentatore.',
      'Dopo la prenotazione il brano riparte intero.',
    ],
    win: ['Risposta corretta: fino a +1000 con tutta la manche davanti, minimo 250.'],
    lose: ['Risposta sbagliata: −1000.', 'Chi non prenota resta a 0.'],
    example: 'Prenoti a metà della manche da 30 secondi: restano 15, quindi la risposta vale circa +500.',
  },
  WHEEL_OF_FORTUNE: {
    title: 'RUOTA DELLA FORTUNA',
    icon: '🎡',
    objective: [
      'Una frase a lettere coperte; le lettere si aprono durante il round.',
      'Prenota e pronuncia la soluzione.',
    ],
    phone: [
      'Tocca PRENOTA E RISPONDI.',
      'Dì la frase al presentatore.',
      'La regia conferma la soluzione.',
    ],
    win: ['Risposta corretta: fino a +1000 in base al tempo rimasto.'],
    lose: ['Risposta sbagliata: fino a −1000 in base al tempo rimasto.', 'Chi non prenota resta a 0.'],
    example: 'Prenoti a metà dei 75 secondi: il tempo rimasto è metà, quindi la risposta vale circa ±500.',
  },
  TIMELINE: {
    title: 'TIMELINE',
    icon: '🕰️',
    objective: [
      'Ordina le stesse carte in TV dal passato al presente.',
      'L’ordine iniziale è già una risposta: si trascina per correggerlo.',
    ],
    phone: [
      'Trascina le carte per cambiare l’ordine.',
      'L’invio è automatico; puoi correggere fino allo scadere.',
    ],
    win: [
      'Ogni carta nella posizione esatta vale 1200 / numero di carte.',
      'Un ordine perfetto vale +1200.',
    ],
    lose: [
      'Sotto la soglia di n/2 − 1 posizioni esatte si perde, fino a −400.',
      'Chi non invia resta all’ordine iniziale.',
    ],
    example: 'Con 6 carte ogni posizione esatta vale 200: 6 esatte +1200, 3 esatte +600, 1 esatta −200.',
  },
  TIME_BUZZER: {
    title: 'TIME BUZZER',
    icon: '⏱️',
    objective: [
      'Ferma il cronometro il più vicino possibile al bersaglio segreto (5–20 s).',
      'Tre manche con tagli progressivi.',
    ],
    phone: [
      'Il cronometro parte da solo al segnale: tocca STOP.',
      'Non c’è un cronometro sul telefono: vai a sensazione.',
      'Chi non preme è ultimo ed esce.',
    ],
    win: [
      'Il più vicino prende il bonus più alto della manche: 300, poi 400, poi 500.',
      'Chi arriva alla terza manche prende altri +150.',
    ],
    lose: [
      'Chi esce dopo la prima manche paga −250; dopo la seconda −100.',
      'Gli altri piazzamenti prendono comunque i bonus della fascia.',
    ],
    example: 'Manche 1: 300 al più vicino, 220 al secondo, 150 al terzo, 90 al quarto, 50 al quinto. Chi esce paga −250.',
  },
  BOMBA: {
    title: 'BOMBA',
    icon: '💣',
    objective: [
      'Un tabellone con caselle vere e bombe nascoste.',
      'Un turno alla volta: la TV indica quale tavolo sceglie.',
    ],
    phone: [
      'Tocca una casella solo quando è il tuo turno.',
      'Casella vera: 0 punti e il turno passa.',
      'Bomba: −200 e fuori dal round.',
      'Le caselle restano coperte per tutta l’ondata: gli esiti arrivano alla fine.',
    ],
    win: [
      'Non ci sono punti da guadagnare: si salvano le caselle vere.',
      'Le bombe mai scelte si disarmano a fine round.',
    ],
    lose: [
      'Una bomba costa −200 e l’uscita dal round.',
      'Chi non sceglie in tempo è eliminato: −200 e fuori dal round.',
    ],
    example: 'Con 6 tavoli il tabellone ha 15 caselle (2n + n/2) e due bombe: una ogni tre tavoli.',
  },
  SPEED_RUSH: {
    title: 'SPEED RUSH',
    icon: '⚡',
    objective: [
      'Sessanta secondi di prove lampo: matematica, colori, bandiere, parole e traduzioni.',
      'Ogni risposta giusta fa avanzare la corsia; la TV mostra solo le piste.',
    ],
    phone: [
      'Tocca la risposta giusta il prima possibile.',
      'Un errore fa arretrare la corsia.',
      'Le prove non si ripetono e salgono di difficoltà con l’avanzamento.',
      'Le domande arrivano solo sul telefono.',
    ],
    win: [
      'Prendono punti i primi n/2 arrivati.',
      'Il primo vale 500; gli altri 500 × tempo del primo / proprio tempo, minimo 100.',
    ],
    lose: [
      'Chi resta sotto la metà non prende punti.',
      'Le risposte sbagliate non danno punti e rallentano.',
    ],
    example: 'Se il primo arriva a metà del tuo tempo, prendi 250 (500 × 1/2). Il minimo è 100.',
  },
  AIR_HOCKEY_BATTLE: {
    title: 'AIR HOCKEY BATTLE',
    icon: '🏒',
    objective: [
      'Duello a coppie: il disco è sempre da un lato.',
      'Chi lo riceve risponde alla domanda per rimandarlo.',
    ],
    phone: [
      'Rispondi quando la TV ti passa il disco.',
      'Risposta giusta: rimandi; sbagliata o scaduta: gol per l’avversario.',
      'Hai 12 secondi per ogni servizio.',
      'Le domande passano da facili a difficili con i tiri; il disco arriva dritto, a zig-zag, a giro o a salto.',
    ],
    win: ['Il primo a 7 gol vince il set: +1000.'],
    lose: [
      'Il perdente prende +200 di consolazione.',
      'Ogni risposta sbagliata o non data è un gol subito.',
    ],
    example: 'Set finito 7–4: +1000 a chi ha segnato 7, +200 all’altro. Le domande sulla TV non compaiono.',
  },
  ARENA: {
    title: 'ARENA BATTLE ROYALE',
    icon: '🏟️',
    objective: [
      'Tutti nello stesso cerchio: si chiude con il tempo.',
      'Domande rapide per restare dentro.',
    ],
    phone: [
      'Rispondi il prima possibile: vero/falso o quattro opzioni.',
      'Giusta +10, sbagliata −10.',
      'Fuori dal cerchio sei eliminato.',
    ],
    win: ['Primo posto +1000.', 'Chi resta nella metà alta prende +500.'],
    lose: ['La metà bassa perde −300.', 'Le risposte sbagliate tolgono 10 punti ciascuna.'],
    example: 'Con 4 tavoli: primo +1000, secondo +500, terzo e quarto −300; ogni risposta rapida vale ±10.',
  },
  ULTIMA_SPIAGGIA: {
    title: 'ULTIMA SPIAGGIA',
    icon: '🏝️',
    objective: [
      'Una categoria per occorrenza, cinque livelli per squadra.',
      'Ogni livello 100–500 si consuma una volta in tutta la partita.',
    ],
    phone: [
      'Scegli un livello non ancora usato.',
      'Rispondi alla domanda del tuo livello.',
      'Giusta +livello; sbagliata o scaduta −metà.',
    ],
    win: ['Ogni livello pagato intero: +100, +200, +300, +400 o +500.'],
    lose: [
      'La risposta sbagliata costa metà: −50, −100, −150, −200 o −250.',
      'Il livello resta consumato anche se sbagli.',
    ],
    example: 'Livello 500 giusto: +500; sbagliato: −250. Livello 100 sbagliato: −50.',
  },
  AZZARDO: {
    title: 'AZZARDO',
    icon: '📊',
    objective: [
      'Quattro manche: celebrità, canzoni, paesi, storia.',
      'Quattro risposte numeriche vicine; si punta con dieci fiches da 20.',
    ],
    phone: [
      'Distribuisci le fiches sulle quattro opzioni: si spostano finché non confermi.',
      'Serve almeno una fiche e il tocco su CONFERMA PUNTATA: niente puntate automatiche.',
      'Fiches giuste: 20 × quota; sbagliate: perdono 100/80/60/40%.',
      'Le fiches avanzate si sommano alle dieci nuove della manche dopo.',
    ],
    win: ['Quota ×2 (facile), ×3 (media), ×4 (difficile).', 'Tutte e dieci le fiches sulla risposta giusta a ×3: +600.'],
    lose: ['La perdita scende manche dopo manche: 100%, 80%, 60%, 40%.', 'Mai sotto zero.'],
    example: '10 fiches = 200 punti. Tutte giuste a ×4: +800. Tutte sbagliate alla prima manche: −200; alla quarta: −80.',
  },
  BLACKJACK: {
    title: 'BLACKJACK',
    icon: '🃏',
    objective: [
      'Tre mani contro il banco della TV, un tavolo alla volta.',
      'Il banco si ferma a 17.',
    ],
    phone: [
      'Quando la TV chiama il tuo tavolo scegli CARTA o STAI.',
      'Il telefono mostra la tua mano e il totale.',
      'La TV mostra il banco alla fine.',
    ],
    win: ['Mano vinta +250; blackjack naturale +500.'],
    lose: ['Mano persa −250, senza cumulare le perdite.', 'Pareggio 0; mai sotto zero.'],
    example: 'Due mani vinte: 250 + 250 = +500. Un naturale: +500. Una sconfitta: −250.',
  },
};

const BONUS_COPY: Record<BonusType, DemoCopy> = {
  CASINO: {
    title: 'BONUS CASINO',
    icon: '🎰',
    objective: [
      'Quattro manche di roulette europea (37 caselle).',
      'Colore, dozzina, sestina e numero secco.',
    ],
    phone: [
      'Tocca la casella della manche.',
      'Sullo zero il banco incassa.',
      'Sul numero secco si rigira finché un tavolo vince.',
    ],
    win: [
      'Le manche valgono 100, 150, 200 e 300 nella classifica del bonus.',
      'Indovinarle tutte: 750 punti bonus.',
    ],
    lose: ['Nessuna penalità: chi sbaglia resta a 0 nella manche.', 'La classifica del bonus non entra ancora in classifica.'],
    example: 'Colore +100, dozzina +150, sestina +200, numero +300: tutte e quattro = +750.',
  },
  BASKET: {
    title: 'BONUS BASKET',
    icon: '🏀',
    objective: [
      'Tre manche da 20 secondi al canestro.',
      'Il ferro si stringe: largo, medio, piccolo.',
    ],
    phone: [
      'Apri /basket dal telefono e tira trascinando.',
      'Ferro largo +2, medio +3, piccolo +5; swish +1.',
      'In serata reale il bonus è bloccato finché il punteggio non è verificato dal server.',
    ],
    win: [
      'La TV somma i punti delle tre manche nella classifica del bonus.',
      'Non ci sono punti in classifica finché la verifica server non sarà pronta.',
    ],
    lose: ['Nessuna penalità: i tiri sbagliati valgono 0.', 'Il bonus si apre solo in simulazione e anteprima.'],
    example: 'Tre canestri nel ferro piccolo: 15 punti bonus; con tre swish: 18.',
  },
  CAVALLO: {
    title: 'BONUS CAVALLO',
    icon: '🐎',
    objective: [
      'Otto domande flash sulla categoria votata dai tavoli.',
      'Vince chi indovina più risposte.',
    ],
    phone: [
      'Vota la categoria.',
      'Tocca la risposta giusta: +1 per ogni esatta.',
      'La TV mostra tabellone e classifica.',
    ],
    win: ['Classifica del bonus per numero di risposte esatte.', '8 su 8 valgono 8 punti bonus.'],
    lose: ['Risposta sbagliata o non data: 0.', 'Non ci sono punti in classifica.'],
    example: '6 risposte esatte su 8: 6 punti nella classifica del bonus.',
  },
  BIGLIE: {
    title: 'BONUS BIGLIE',
    icon: '🎱',
    objective: ['Quattro gare su quattro fondi.', 'Ogni tavolo sceglie una biglia una volta sola.'],
    phone: [
      'Scegli la biglia quando la TV chiama il tuo tavolo.',
      'La biglia resta la stessa per tutte le gare.',
      'Guarda le piste in TV.',
    ],
    win: ['Primo 150, secondo 100, terzo 60, quarto 30 a ogni gara.', 'I punti si sommano su quattro gare.'],
    lose: ['Chi arriva dopo il quarto non prende punti nella gara.', 'Nessuna penalità negativa.'],
    example: 'Vincere tutte e quattro le gare: 150 × 4 = 600 punti bonus.',
  },
};

const introScenes: DemoScene[] = [
  {
    kicker: 'COS’È',
    title: 'LA SERATA',
    lines: [
      'Un gioco da pub per squadre: una TV, una regia e un telefono per tavolo.',
      `La TV mostra tutto; i telefoni rispondono, prenotano e trascinano.`,
    ],
  },
  {
    kicker: 'COME FUNZIONA',
    title: 'ROUND, ATTI E CLASSIFICHE',
    lines: [
      `${TOTAL_ROUNDS} round divisi in ${ACT_DECKS.length} atti da ${ROUNDS_PER_ACT}.`,
      'Classifica rapida a metà atto, dettagliata a fine atto.',
      `Dopo gli atti 1–4 c’è un bonus: ${BONUS_AFTER_ACT.filter(Boolean).map((type) => BONUS_LABELS[type!]).join(', ')}. Dopo l’atto 5 si chiude con la classifica finale.`,
    ],
  },
  {
    kicker: 'SUL TELEFONO',
    title: 'UN TAVOLO, UN TELEFONO',
    lines: [
      'Ogni squadra entra con nickname e, se vuole, una foto.',
      'Il telefono cambia schermata da solo: voto, prenotazione, trascinamento o tasti.',
      'Se si spegne o si ricarica, riprende dal token salvato.',
    ],
  },
  {
    kicker: 'PUNTI',
    title: 'COME SI VINCE',
    lines: [
      'I punti dei giochi entrano nella classifica della serata.',
      'I bonus mostrano una classifica separata: i loro punti non entrano ancora in classifica.',
      'Vince la squadra con più punti dopo la classifica finale dell’atto 5.',
    ],
  },
  {
    kicker: 'CONSIGLIO',
    title: 'PRIMA DI INIZIARE',
    lines: [
      'Non cancellare i dati del browser: senza token il nome non si può riprendere da soli.',
      'Tieni il telefono sulla stessa Wi-Fi del PC e non bloccare lo schermo.',
    ],
  },
];

const introScript: DemoScript = {
  key: 'INTRO',
  title: 'LA SERATA',
  icon: '🎬',
  kind: 'INTRO',
  scenes: introScenes,
  scoring: [],
  note: 'Quaranta round, cinque atti, quattro bonus. Il presentatore avvia ogni round dalla regia o dalla TV.',
};

function makeGameScript(type: GameModeType, copy: DemoCopy): DemoScript {
  const rule = ruleFor(type);
  return {
    key: type,
    title: copy.title,
    icon: copy.icon,
    kind: 'GAME',
    scenes: scenesFor(copy, rule),
    scoring: scoringRows(rule),
    note: rule.note,
  };
}

function makeBonusScript(type: BonusType, copy: DemoCopy): DemoScript {
  const key = `BONUS_${type}`;
  const rule = ruleFor(key);
  return {
    key,
    title: copy.title,
    icon: copy.icon,
    kind: 'BONUS',
    scenes: scenesFor(copy, rule),
    scoring: scoringRows(rule),
    note: rule.note,
  };
}

const scripts: Record<string, DemoScript> = {
  INTRO: introScript,
};

for (const type of scheduledModes()) {
  scripts[type] = makeGameScript(type, GAME_COPY[type]);
}

for (const type of BONUS_TYPES) {
  const key = `BONUS_${type}`;
  scripts[key] = makeBonusScript(type, BONUS_COPY[type]);
}

export const DEMO_SCRIPTS: Readonly<Record<string, DemoScript>> = scripts;

/** Ordine consigliato: introduzione, giochi della scaletta, bonus degli atti. */
export const DEMO_ORDER: readonly string[] = [
  'INTRO',
  ...scheduledModes(),
  ...BONUS_TYPES.map((type) => `BONUS_${type}`),
];

export function demoScriptFor(key: string | null | undefined): DemoScript | null {
  if (!key) return null;
  return DEMO_SCRIPTS[key] ?? null;
}

/** Quante volte una modalità compare nella serata (per la scheda demo). */
export function demoOccurrences(type: string): number {
  return (scheduledModes() as string[]).includes(type)
    ? occurrencesOf(type as GameModeType)
    : 0;
}
