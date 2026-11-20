import { BONUS_LABELS, BONUS_TYPES, BonusType } from '../../shared/enums/bonus-type';
import { GameModeType } from '../../shared/enums/game-mode-type';
import {
  BIGLIE_FIRST,
  BIGLIE_LAST,
  BONUS_CASINO_COLOR_POINTS,
  BONUS_CASINO_DOZEN_POINTS,
  BONUS_CASINO_NUMBER_POINTS,
  BOMBA_PEAK,
  CASINO_SPINS,
  MUSIC_MANCHE_POINTS,
  ScoringRule,
  SPEED_RUSH_FIRST,
  SPEED_RUSH_LAST,
  TENNIS_WIN,
  TIMELINE_POSITION_POINTS,
  TIME_BUZZER_FIRST,
  TIME_BUZZER_LAST,
  TIME_BUZZER_PERFECT,
  TIME_BUZZER_PERFECT_MS,
  scoringRuleFor,
} from '../../shared/models/scoring-rules';
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

const GAME_COPY: Record<Exclude<GameModeType, 'BLACKJACK'>, DemoCopy> = {
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
      'Un indizio ogni 6 secondi: vita, film, carriera, curiosità.',
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
    win: [`Prima manche +${MUSIC_MANCHE_POINTS[0]}, seconda +${MUSIC_MANCHE_POINTS[1]}, terza +${MUSIC_MANCHE_POINTS[2]}, quarta +${MUSIC_MANCHE_POINTS[3]}.`],
    lose: [`Risposta sbagliata: lo stesso valore, in negativo.`, 'Chi non prenota resta a 0.'],
    example: `Indovini alla prima manche: +${MUSIC_MANCHE_POINTS[0]}. Alla quarta: +${MUSIC_MANCHE_POINTS[3]}.`,
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
    win: [`8 posti giusti: +${TIMELINE_POSITION_POINTS[8]}; 7: +${TIMELINE_POSITION_POINTS[7]}; 6: +${TIMELINE_POSITION_POINTS[6]}; 5: +${TIMELINE_POSITION_POINTS[5]}.`],
    lose: [`4 posti giusti: 0; 3: ${TIMELINE_POSITION_POINTS[3]}; 2: ${TIMELINE_POSITION_POINTS[2]}; 1 o 0: ${TIMELINE_POSITION_POINTS[1]}.`, 'Chi non invia resta all’ordine iniziale.'],
    example: 'Otto eventi ogni round: conta la posizione esatta, non l’ordine approssimativo.',
  },
  TIME_BUZZER: {
    title: 'TIME BUZZER',
    icon: '⏱️',
    objective: [
      'Ferma il cronometro il più vicino possibile al bersaglio segreto (5–20 s).',
      'Tre manche, tutte le squadre in gioco.',
    ],
    phone: [
      'Il cronometro parte da solo al segnale: tocca STOP.',
      'Non c’è un cronometro sul telefono: vai a sensazione.',
      'Chi non preme è ultimo della manche.',
    ],
    win: [
      `Il piazzamento paga +${TIME_BUZZER_FIRST} al primo e ${TIME_BUZZER_LAST} all’ultimo, 0 a metà se N è dispari.`,
      `Chi centra il bersaglio entro ${TIME_BUZZER_PERFECT_MS} ms prende +${TIME_BUZZER_PERFECT} al posto dei ${TIME_BUZZER_FIRST}.`,
    ],
    lose: [
      'Non ci sono tagli: nessuno esce.',
      'I punti si sommano fra le tre manche e fra i round.',
    ],
    example: `Con 4 squadre: +${TIME_BUZZER_FIRST}, +150, −100, ${TIME_BUZZER_LAST}. Tutti giocano anche la manche dopo.`,
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
      `Bomba: fuori dal round con un malus da ${BOMBA_PEAK} che scende con le bombe rimaste.`,
      'Le caselle restano coperte per tutta l’ondata: gli esiti arrivano alla fine.',
    ],
    win: [
      'Non ci sono punti da guadagnare: si salvano le caselle vere.',
      'Le bombe mai scelte si disarmano a fine round.',
    ],
    lose: [
      `La prima bomba costa ${BOMBA_PEAK}, poi il malus scende: −500, −400, −300, −200, −100.`,
      'Chi non sceglie in tempo è fuori come se avesse preso una bomba.',
    ],
    example: 'Con 6 tavoli il tabellone ha 15 caselle (2n + n/2) e due bombe: una ogni tre tavoli.',
  },
  SPEED_RUSH: {
    title: 'SPEED RUSH',
    icon: '⚡',
    objective: [
      '90 secondi di prove lampo: matematica, colori, bandiere, parole e traduzioni.',
      'Ogni risposta giusta fa avanzare la corsia; la TV mostra solo le piste.',
    ],
    phone: [
      'Tocca la risposta giusta il prima possibile.',
      'Un errore fa arretrare la corsia.',
      'Le prove non si ripetono e salgono di difficoltà con l’avanzamento.',
      'Le domande arrivano solo sul telefono.',
    ],
    win: [`Piazzamento puro: +${SPEED_RUSH_FIRST} al primo, poi a scalare fino a 0 a metà.`],
    lose: [
      `Gli ultimi pagano fino a ${SPEED_RUSH_LAST}; chi non arriva è ultimo a pari merito.`,
      'Le risposte sbagliate non danno punti e rallentano.',
    ],
    example: `Con 8 squadre: +${SPEED_RUSH_FIRST}, +600, +400, +200, −100, −200, −300, ${SPEED_RUSH_LAST}.`,
  },
  TENNIS_BATTLE: {
    title: 'TENNIS BATTLE',
    icon: '🎾',
    objective: [
      'Duello a coppie: la pallina passa da una squadra all’altra.',
      'Chi riceve risponde alla domanda per rimandarla.',
    ],
    phone: [
      'Rispondi quando la TV ti passa la palla.',
      'Risposta giusta: rimandi; sbagliata o scaduta: punto per l’avversario.',
      'Il punteggio è da tennis: 15, 30, 40, poi vantaggio.',
      'Dal vantaggio sul 40 pari, dopo tre ritorni arriva il killer point: il punto decide il game.',
      'Più veloce è la tua risposta, più rapido è il colpo che torna.',
    ],
    win: [`Chi vince la partita prende +${TENNIS_WIN}.`],
    lose: [
      'Chi perde prende 0.',
      'Ogni risposta sbagliata o non data è un punto subito.',
    ],
    example: 'Game vinto dal 40 con vantaggio: il punto è tuo. Le domande sulla TV non compaiono.',
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
      'Le fiches avanzate si sommano alle dieci nuove e alzano il tetto: una in più ogni due risparmiate, fino a 15. Massimo 1000 punti a manche.',
    ],
    win: ['Quota ×2 (facile), ×3 (media), ×4 (difficile).', 'Tutte e dieci le fiches sulla risposta giusta a ×3: +600.'],
    lose: ['La perdita scende manche dopo manche: 100%, 80%, 60%, 40%.', 'Mai sotto zero.'],
    example: '10 fiches = 200 punti. Tutte giuste a ×4: +800. Tutte sbagliate alla prima manche: −200; alla quarta: −80.',
  },
  BIGLIE: {
    title: 'BIGLIE',
    icon: '🎱',
    objective: [
      'Quattro round separati, due gare per round su due delle otto piste: rally, F1, neve, acqua, vetro, sabbia, spazio, magma.',
      'Ogni tavolo sceglie una biglia una volta sola per round.',
    ],
    phone: [
      'Scegli la biglia quando la TV chiama il tuo tavolo.',
      'La biglia resta la stessa per le due gare del round.',
      'Segui le piste in TV.',
    ],
    win: [
      `Primo +${BIGLIE_FIRST}, ultimo ${BIGLIE_LAST}, zero a metà se N è dispari.`,
      'I punti delle due gare si sommano fra loro e fra i quattro round.',
    ],
    lose: ['Anche gli ultimi piazzamenti entrano in classifica, in negativo.'],
    example: `Con 8 squadre: +${BIGLIE_FIRST}, +380, +250, +130, −100, −200, −300, ${BIGLIE_LAST}.`,
  },
};

const BONUS_COPY: Record<BonusType, DemoCopy> = {
  CASINO_COLOR: {
    title: 'CASINO NERO/ROSSO',
    icon: '🔴',
    objective: [
      `Tre girate sul colore: nero o rosso.`,
      `La ruota europea gira ${CASINO_SPINS} volte.`,
    ],
    phone: ['Tocca NERO o ROSSO a ogni girata, entro dieci secondi.', `La pallina esce ${CASINO_SPINS} volte.`, 'Sullo zero il banco incassa.'],
    win: [`Colore giusto: +${BONUS_CASINO_COLOR_POINTS} a girata, massimo +${CASINO_SPINS * BONUS_CASINO_COLOR_POINTS}.`],
    lose: ['Colore sbagliato o zero: 0 punti.', 'Nessuna penalità.'],
    example: `Tre rossi azzeccati: +${CASINO_SPINS * BONUS_CASINO_COLOR_POINTS}.`,
  },
  BLACKJACK: {
    title: 'BLACKJACK',
    icon: '🃏',
    objective: [
      'Un turno per tavolo contro il banco della TV.',
      'Il banco si ferma a 17; il naturale batte tutto.',
    ],
    phone: ['Quando la TV chiama il tuo tavolo scegli CARTA o STAI.', 'La TV apre il banco alla fine.'],
    win: ['Chi batte il banco riceve un buono per 3 consumazioni al tavolo, non punti.', 'Massimo tre buoni a serata.'],
    lose: ['Pari e sconfitte non tolgono nulla.', 'Sballare non costa nulla in classifica.'],
    example: 'Due tavoli battono il banco: due buoni da tre consumazioni.',
  },
  CASINO_DOZEN: {
    title: 'CASINO DOZZINA',
    icon: '🎰',
    objective: [
      'Tre girate sulla dozzina: 1-12, 13-24 o 25-36.',
      `La ruota gira ${CASINO_SPINS} volte.`,
    ],
    phone: ['Tocca la dozzina a ogni girata, entro dieci secondi.', `La pallina esce ${CASINO_SPINS} volte.`],
    win: [`Dozzina giusta: +${BONUS_CASINO_DOZEN_POINTS} a girata, massimo +${CASINO_SPINS * BONUS_CASINO_DOZEN_POINTS}.`],
    lose: ['Dozzina sbagliata o zero: 0 punti.', 'Nessuna penalità.'],
    example: `Tre dozzine azzeccate: +${CASINO_SPINS * BONUS_CASINO_DOZEN_POINTS}.`,
  },
  CAVALLO: {
    title: 'CAVALLO DI BATTAGLIA',
    icon: '🐎',
    objective: [
      'Otto domande flash sulla categoria votata dai tavoli.',
      'Vince chi ha più risposte giuste; a pari merito chi ha finito prima.',
    ],
    phone: ['Vota la categoria.', 'Tocca la risposta giusta: ogni esatta sale nel tabellone.'],
    win: ['Il vincitore riceve un buono per una consumazione di cibo, non punti.'],
    lose: ['Gli altri tavoli non ricevono nulla.', 'Risposta sbagliata o non data: nessun punto.'],
    example: 'Il tavolo con più esatte vince il buono cibo.',
  },
  CASINO_NUMBER: {
    title: 'CASINO NUMERO SECCO',
    icon: '🎯',
    objective: [
      'Una sola puntata su un numero da 0 a 36.',
      'Se nessuno becca il numero, nessuno prende punti.',
    ],
    phone: ['Scegli un numero entro dieci secondi.', 'La pallina esce con un ultimo giro di suspense.'],
    win: [`Numero esatto: +${BONUS_CASINO_NUMBER_POINTS} punti.`],
    lose: ['Numero sbagliato: 0 punti.', 'Nessuna penalità.'],
    example: `Punti sul 17 ed esce 17: +${BONUS_CASINO_NUMBER_POINTS}. Esce 18: 0.`,
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
      `Un bonus per atto, in un round interno scelto dal seme: ${BONUS_AFTER_ACT.map((type, index) => type ? `atto ${index + 1} ${BONUS_LABELS[type]}` : null).filter(Boolean).join(', ')}. Dopo l’atto 5 si chiude con la classifica finale.`,
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
      'I bonus pagano solo punti positivi; Blackjack e Cavallo danno buoni, non punti.',
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
  note: 'Quaranta round, cinque atti, cinque bonus sparsi nei round degli atti. Il presentatore avvia ogni round dalla regia o dalla TV.',
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
  scripts[type] = makeGameScript(type, GAME_COPY[type as Exclude<GameModeType, 'BLACKJACK'>]);
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
