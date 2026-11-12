import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter((cells) => cells.some((cell) => cell !== '')).map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])),
  );
}

const parseJson = (value, fallback = null) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString() : null);

const ROUNDS = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE',
  'TIME_BUZZER', 'BOMBA', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];
const BONUSES = ['CASINO', 'BASKET', 'CAVALLO', 'BIGLIE'];

const summaryFile = JSON.parse(read('game16_actions_summary.json'));
const PLAYERS = summaryFile.players;
const actions = read('game16_actions.jsonl').trim().split('\n').filter(Boolean).map(JSON.parse);
const receipts = parseCsv(read('game161_answer_receipt.csv')).map((row) => ({
  id: Number(row.ID),
  kind: row.KIND,
  deviceId: row.DEVICE_ID,
  commandKey: row.COMMAND_KEY,
  receivedAt: Number(row.CREATED_AT),
  receivedAtIso: iso(row.CREATED_AT),
  response: parseJson(row.RESPONSE),
}));
const events = parseCsv(read('game161_game_event.csv')).map((row) => ({
  seq: Number(row.SEQ),
  type: row.TYPE,
  roundKey: row.ROUND_KEY || null,
  createdAt: Number(row.CREATED_AT),
  createdAtIso: iso(row.CREATED_AT),
  payload: parseJson(row.PAYLOAD, {}),
}));
const roundRows = parseCsv(read('game161_game_round.csv')).map((row) => {
  const payload = parseJson(row.PAYLOAD, {});
  return {
    roundIndex: Number(row.ROUND_INDEX),
    type: row.TYPE,
    status: row.STATUS,
    question: payload?.question || (payload?.songTitle ? `${payload.songTitle} — ${payload.artist || ''}`.trim() : null) || payload?.proverb || null,
  };
});
const stateRow = parseCsv(read('game161_game_state.csv'))[0];
const blobs = parseCsv(read('game161_state_blob.csv')).map((row) => ({
  key: row.BLOB_KEY,
  updatedAt: Number(row.UPDATED_AT),
  updatedAtIso: iso(row.UPDATED_AT),
  payload: parseJson(row.PAYLOAD),
}));
const backendLog = read('logs/backend-game161.log');
const tvLog = read('logs/tv-game161.log');

function roundFor(label) {
  const key = label.toLowerCase();
  if (key.includes('quiz')) return 0;
  if (key.includes('music')) return 1;
  if (key.includes('image_blur')) return 2;
  if (key.includes('wheel')) return 3;
  if (key.includes('timeline')) return 4;
  if (key.includes('time-buzzer')) return 5;
  if (key.includes('bomba')) return 6;
  if (key.includes('air-hockey')) return 7;
  if (key.includes('ultima')) return 8;
  if (key.includes('azzardo')) return 9;
  if (key.includes('blackjack')) return 10;
  if (key.includes('arena')) return 11;
  if (key.includes('speed-rush')) return 12;
  if (key.includes('casino')) return 13;
  if (key.includes('basket')) return 14;
  if (key.includes('cavallo')) return 15;
  if (key.includes('biglie')) return 16;
  return -1;
}

const roundActions = ROUNDS.map(() => []);
const bonusActions = { CASINO: [], BASKET: [], CAVALLO: [], BIGLIE: [] };
const preflight = [];
for (const entry of actions) {
  const index = roundFor(entry.label);
  if (index >= 0 && index < 13) roundActions[index].push(entry);
  else if (index >= 13) bonusActions[BONUSES[index - 13]].push(entry);
  else preflight.push(entry);
}

const kindRound = { TIMELINE_ANSWER: 4, ARENA_ANSWER: 11, SPEED_RUSH_ANSWER: 12 };
const answerReceipts = receipts.map((receipt) => ({
  ...receipt,
  roundIndex: kindRound[receipt.kind] ?? null,
  bonus: receipt.kind === 'BASKET_SHOT' ? 'BASKET' : null,
}));

const enrichedActions = actions.map((entry) => ({
  ...entry,
  delivery: entry.status === 'sent'
    ? 'STOMP inviato (nessun ACK applicativo)'
    : typeof entry.status === 'number' && entry.status < 400
      ? 'HTTP 2xx/3xx ricevuto'
      : 'rifiutato o errore',
  received: entry.status === 'sent' || (typeof entry.status === 'number' && entry.status < 400),
}));

const roundReports = ROUNDS.map((type, index) => {
  const list = roundActions[index];
  const answers = answerReceipts.filter((receipt) => receipt.roundIndex === index);
  const start = events.find((event) => event.type === 'ROUND_STARTED' && Number(event.payload?.roundIndex) === index);
  const nextStart = events.find((event) => event.type === 'ROUND_STARTED' && Number(event.payload?.roundIndex) === index + 1);
  const close = events.find((event) => event.type === 'ROUND_CLOSED'
    && event.createdAt > (start?.createdAt ?? 0)
    && event.createdAt < (nextStart?.createdAt ?? Infinity));
  const rejected = list.filter((entry) => typeof entry.status === 'number' && entry.status >= 400);
  const sentOrAcked = list.filter((entry) => entry.status === 'sent' || (typeof entry.status === 'number' && entry.status < 400));
  const persistedPlayers = [...new Set(answers.map((receipt) => receipt.deviceId))];
  // Solo Timeline, Arena e Speed Rush usano una ricevuta DB per ogni giocatore.
  const expectsReceiptPerPlayer = [4, 11, 12].includes(index);
  const missingPersisted = expectsReceiptPerPlayer
    ? PLAYERS.filter((name) => !persistedPlayers.includes(name))
    : [];
  let verdict;
  if (answers.length > 0 && rejected.length > 0) {
    verdict = `${answers.length} risposte persistite; ${rejected.length} azioni rifiutate/in errore`;
  } else if (answers.length > 0) {
    verdict = `${answers.length} risposte persistite dal server`;
  } else if (list.length > 0) {
    verdict = 'Azioni inviate ma nessuna ricevuta persistita';
  } else {
    verdict = 'Nessuna azione inviata';
  }
  return {
    roundIndex: index,
    type,
    question: roundRows.find((row) => row.roundIndex === index)?.question ?? null,
    startedAt: start?.createdAt ?? null,
    startedAtIso: start?.createdAtIso ?? null,
    closedAt: close?.createdAt ?? null,
    closeReason: close?.payload?.reason ?? null,
    actions: list,
    actionCount: list.length,
    sentOrAcked: sentOrAcked.length,
    rejectedCount: rejected.length,
    rejected,
    persistedAnswers: answers,
    persistedCount: answers.length,
    persistedPlayers,
    missingPersisted,
    verdict,
  };
});

const bonusReports = BONUSES.map((type) => {
  const list = bonusActions[type];
  const answers = answerReceipts.filter((receipt) => receipt.bonus === type);
  return {
    type,
    actions: list,
    actionCount: list.length,
    persistedAnswers: answers,
    persistedCount: answers.length,
    verdict: answers.length > 0
      ? `${answers.length} risposte persistite`
      : list.length > 0
        ? 'Azione STOMP inviata, nessuna ricevuta/ACK applicativo'
        : 'Nessuna azione: bonus non eseguito',
  };
});

const statuses = actions.reduce((acc, entry) => {
  const key = String(entry.status);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const timeBuzzerStops = actions.filter((entry) => entry.label === 'time-buzzer-stop');
const timeBuzzerStarts = actions
  .filter((entry) => entry.label === 'time-buzzer-start')
  .sort((a, b) => a.at - b.at);
const timeBuzzerByManche = {};
for (const entry of timeBuzzerStops) {
  // Il body dello stop non contiene la manche: la ricavo dallo start precedente.
  const start = [...timeBuzzerStarts].reverse().find((candidate) => candidate.at <= entry.at);
  const manche = String(start?.body?.manche ?? start?.response?.manche ?? '?');
  if (!timeBuzzerByManche[manche]) timeBuzzerByManche[manche] = { total: 0, ok: 0, rejected: 0 };
  timeBuzzerByManche[manche].total += 1;
  if (entry.status === 200) timeBuzzerByManche[manche].ok += 1;
  else timeBuzzerByManche[manche].rejected += 1;
}
const bombaPicks = actions.filter((entry) => entry.label === 'bomba-pick');
const arenaAnswers = actions.filter((entry) => entry.label === 'arena-answer');
const speedTasks = actions.filter((entry) => entry.label === 'speed-rush-task');
const speedAnswers = actions.filter((entry) => entry.label === 'speed-rush-answer');
const timelineAnswers = actions.filter((entry) => entry.label === 'timeline-answer');

const serverErrors = {
  stateBlobLockTimeouts: (backendLog.match(/Timeout trying to lock table "STATE_BLOB"/g) || []).length,
  hikariPoolTimeouts: (backendLog.match(/Connection is not available/g) || []).length,
  http500: (backendLog.match(/Servlet\.service\(\)/g) || []).length,
  errorLines: (backendLog.match(/^.* ERROR /gm) || []).length,
  seqConflicts: (backendLog.match(/UK_GAME_EVENT_SEQ/g) || []).length,
  stateBlobUniqueConflicts: (backendLog.match(/UK_STATE_BLOB_KEY/g) || []).length,
  stompSendFailures: (backendLog.match(/Failed to send message to MessageChannel/g) || []).length,
};

const tvClosed = /socket pilota chiusa \(1002\)/.test(tvLog);
const missingBiglie = bonusReports.find((bonus) => bonus.type === 'BIGLIE').actionCount === 0;

const errors = [
  {
    id: 'E1',
    severity: 'P0',
    area: 'STATE_BLOB / Hikari / Timeline-Arena-Speed',
    symptom: 'Timeout HTTP e 500 con 16 richieste concorrenti; Hikari saturo (10/10 connessioni).',
    evidence: [
      `${serverErrors.stateBlobLockTimeouts} × "Timeout trying to lock table \\"STATE_BLOB\\""`,
      `${serverErrors.hikariPoolTimeouts} × "HikariPool-1 - Connection is not available ... total=10, active=10, idle=0, waiting=1"`,
      `${serverErrors.http500} × 500 Servlet; ${timelineAnswers.filter((entry) => entry.status === 500).length} timeline-answer 500 lato client`,
      `Timeline: 9/16 ricevute persistite; Arena: 14/16; Speed Rush: 18/96 risposte previste (18 task, 18 answer)`,
    ],
    cause: 'IdempotencyService.executeOnce apre una transazione e trattiene una connessione JDBC mentre l’azione chiama StateBlobService.save. Le scritture concorrenti sullo stesso STATE_BLOB si serializzano/aspettano il lock, il pool da 10 si esaurisce e il client va in timeout a 8 s.',
    impact: 'Timeline e Arena perdono parte delle risposte HTTP; Speed Rush si ferma dopo 18 task invece di 96; il server però persiste alcune risposte che il client non riceve.',
    next: 'Non tenere la connessione/transazione aperta durante l’azione; serializzare le scritture per partita prima di aprire la transazione, oppure usare una coda single-writer e un pool dimensionato per 20 giocatori.',
  },
  {
    id: 'E2',
    severity: 'P1',
    area: 'TV pilot / BIGLIE',
    symptom: 'Il pilota TV chiude il socket 1002 durante Basket; BIGLIE non viene mai aperto e non parte nessuna azione.',
    evidence: [
      tvClosed ? 'tv-game161.log: "socket pilota chiusa (1002)" alle 12:53:58' : 'nessuna chiusura TV trovata',
      'tv-game161.log si ferma a "bonus: BASKET"; non compare "bonus: BIGLIE"',
      'summary byLabel non contiene biglie-pick; bonusReports.BIGLIE.actionCount = 0',
      'CAVALLO: 16 category + 16 answer inviate, ma il TV non ha loggato il bonus',
    ],
    cause: 'Da verificare lato server/handshake: la TV viene disconnessa durante il bonus Basket; il pilota non riconnette e quindi non riceve ADMIN_START_BONUS BIGLIE.',
    impact: 'Il bonus BIGLIE non è stato esercitato; CAVALLO è stato inviato senza una TV attiva.',
    next: 'Riconnessione automatica del pilota TV e log del frame ERROR/closeReason; verificare se il token TV viene invalidato dal flusso Basket.',
  },
  {
    id: 'E3',
    severity: 'P1',
    area: 'Time Buzzer (harness)',
    symptom: '33 stop su 48 rifiutati con 422 "tempo-non-plausibile"; solo 15 accettati.',
    evidence: [
      `Per manche: ${JSON.stringify(timeBuzzerByManche)}`,
      'Esempi: clientMs=1820/1860/2020/2060 contro serverElapsedMs≈1539-1543',
      'Il client usa 1500 + indice*40 ms, quindi i telefoni con indice alto dichiarano un tempo superiore al tempo reale del server e oltre la tolleranza.',
    ],
    cause: 'Bug dell’harness: i 16 stop partono in parallelo ma il tempo dichiarato viene incrementato artificialmente per indice. Non è una race del server: gli start sono atomici e i 3 start hanno risposto 200 con replayed=false.',
    impact: 'Time Buzzer non ha 16 risposte valide per manche; i dati non sono utilizzabili per la validazione del gioco.',
    next: 'Usare un clientMs reale (misurato dallo start locale) o limitare tutti i valori a <= serverElapsed - tolleranza; poi rifare le 3 manche.',
  },
  {
    id: 'E4',
    severity: 'P1',
    area: 'Bomba (harness)',
    symptom: '39 pick su 48 rifiutati con 400 "Non è il tuo turno"; 9 accettati.',
    evidence: [
      `${bombaPicks.filter((entry) => entry.status === 400).length} × 400 "Non è il tuo turno"`,
      `${bombaPicks.filter((entry) => entry.status === 200).length} × 200`,
      'I 16 pick della stessa ondata sono inviati in Promise.all; il server accetta solo il turno corrente.',
    ],
    cause: 'L’harness viola la regola a turni di Bomba. Il server si comporta correttamente rifiutando i pick fuori turno.',
    impact: 'Solo 9 pick validi su 48; il gioco non è stato esercitato da tutti i 16 giocatori in ogni ondata.',
    next: 'Serializzare i pick aspettando il turno (o leggere lo stato Bomba e inviare solo al giocatore corrente).',
  },
  {
    id: 'E5',
    severity: 'P1',
    area: 'Arena / Speed Rush / Timeline (risposte perse)',
    symptom: 'Il server persiste più risposte di quante ne restituisce al client; alcune mancano del tutto.',
    evidence: [
      `Timeline: ${timelineAnswers.length} azioni answer nel log, ${timelineAnswers.filter((entry) => entry.status === 500).length} × 500, 9 ricevute persistite, ${16 - 9} giocatori senza ricevuta`,
      `Arena: 16 domande 200, ${arenaAnswers.filter((entry) => entry.status === 200).length} answer 200 lato client, 14 ricevute persistite, 2 giocatori senza ricevuta`,
      `Speed Rush: ${speedTasks.length} task e ${speedAnswers.length} answer, 18 ricevute; attese 96 answer (6 per 16 giocatori)`,
    ],
    cause: 'Conseguenza di E1: il timeout del client scade mentre il server è ancora in coda sul lock; il client registra 500/timeout ma il server può aver già scritto la ricevuta.',
    impact: 'Risposte valide ma non confermate al telefono; per Arena mancano 2 giocatori, per Timeline 7, per Speed Rush 78.',
    next: 'Correggere E1 e ripetere il run; non interpretare i 500 come “risposta non ricevuta dal server” senza leggere answer_receipt.',
  },
];

const finalState = stateRow ? {
  seq: Number(stateRow.SEQ),
  version: Number(stateRow.VERSION),
  status: stateRow.STATUS,
  roundIndex: Number(stateRow.ROUND_INDEX),
  roundType: stateRow.ROUND_TYPE,
  roundKey: stateRow.ROUND_KEY,
  updatedAt: Number(stateRow.UPDATED_AT),
  updatedAtIso: iso(stateRow.UPDATED_AT),
} : null;

const report = {
  gameId: 161,
  generatedAt: new Date().toISOString(),
  scenario: {
    players: PLAYERS,
    playerCount: PLAYERS.length,
    rounds: ROUNDS,
    bonuses: BONUSES,
    note: '16 sessioni reali, join STOMP, 13 round, 4 bonus, fault injection; nessuna verifica visiva.',
  },
  summary: {
    gameId: 161,
    players: PLAYERS,
    playerCount: PLAYERS.length,
    rounds: ROUNDS.length,
    bonuses: BONUSES.length,
    totalActions: actions.length,
    statuses,
    persistedReceipts: receipts.length,
    receiptsByKind: receipts.reduce((acc, receipt) => {
      acc[receipt.kind] = (acc[receipt.kind] || 0) + 1;
      return acc;
    }, {}),
    receiptsByPlayer: receipts.reduce((acc, receipt) => {
      acc[receipt.deviceId] = (acc[receipt.deviceId] || 0) + 1;
      return acc;
    }, {}),
    events: events.length,
    roundsPersisted: roundRows.length,
    blobs: blobs.length,
    serverErrors,
    timeBuzzerByManche,
    arena: {
      questions: actions.filter((entry) => entry.label === 'arena-question').length,
      answers200: arenaAnswers.filter((entry) => entry.status === 200).length,
      persisted: receipts.filter((receipt) => receipt.kind === 'ARENA_ANSWER').length,
    },
    speedRush: {
      tasks: speedTasks.length,
      answers: speedAnswers.length,
      persisted: receipts.filter((receipt) => receipt.kind === 'SPEED_RUSH_ANSWER').length,
      expectedAnswers: 96,
    },
    timeline: {
      answers500: timelineAnswers.filter((entry) => entry.status === 500).length,
      persisted: receipts.filter((receipt) => receipt.kind === 'TIMELINE_ANSWER').length,
      expectedAnswers: 16,
    },
    biglie: {
      actions: bonusReports.find((bonus) => bonus.type === 'BIGLIE').actionCount,
      tvClosed,
    },
    verdict: 'Il setup a 16 giocatori funziona (16 join, 13 round, 4 bonus); la concorrenza sulle scritture STATE_BLOB non regge 16 risposte simultanee. Dettagli e priorità in SIM_ERRORS_16P.md.',
  },
  errors,
  preflight,
  rounds: roundReports,
  bonuses: bonusReports,
  persistedAnswers: answerReceipts,
  actions: enrichedActions,
  events,
  blobs,
  finalState,
  serverErrors,
};

writeFileSync(join(here, 'game161_answers.json'), `${JSON.stringify(report, null, 2)}\n`);

const md = [];
md.push('# Partita #161 — 16 giocatori: risposte ed errori');
md.push('');
md.push(`Generato: ${new Date().toISOString()}`);
md.push('');
md.push('## Esito in una riga');
md.push('');
md.push(`**${PLAYERS.length} giocatori, 13 round, 4 bonus, ${actions.length} azioni, ${receipts.length} ricevute persistite.**`);
md.push('Il setup e i round sono partiti tutti; la concorrenza DB ha però fatto perdere risposte HTTP su Timeline, Arena e Speed Rush, e il pilota TV è caduto prima di BIGLIE.');
md.push('');
md.push('## Cosa è arrivato');
md.push('');
md.push('| Gioco | Azioni log | Stato/risposte | Persistite | Note |');
md.push('|---|---:|---|---:|---|');
for (const round of roundReports) {
  const note = round.type === 'TIMELINE'
    ? `${round.actions.filter((entry) => entry.label === 'timeline-answer' && entry.status === 500).length} × 500; handler timeout`
    : round.type === 'ARENA'
      ? '16 domande; 5 answer 200 lato client; handler timeout'
      : round.type === 'SPEED_RUSH'
        ? '18 task/18 answer su 96 attese; handler timeout'
        : round.type === 'BOMBA'
          ? '39 × 400 "Non è il tuo turno" (harness)'
          : round.type === 'TIME_BUZZER'
            ? '15/48 stop accettati; 33 × 422 (clientMs harness)'
            : round.rejectedCount > 0
              ? `${round.rejectedCount} rifiuti`
              : '';
  md.push(`| ${round.type} | ${round.actionCount} | ${round.sentOrAcked} inviate/ok, ${round.rejectedCount} rifiutate | ${round.persistedCount} | ${note} |`);
}
for (const bonus of bonusReports) {
  md.push(`| BONUS ${bonus.type} | ${bonus.actionCount} | ${bonus.actionCount - bonus.persistedCount} inviate/da confermare | ${bonus.persistedCount} | ${bonus.verdict} |`);
}
md.push('');
md.push('### Dettaglio per round');
md.push('');
for (const round of roundReports) {
  md.push(`#### ${round.roundIndex + 1}. ${round.type}`);
  md.push('');
  md.push(`- Domanda: ${round.question ?? 'n/a'}`);
  md.push(`- Azioni: ${round.actionCount}; inviate/ok: ${round.sentOrAcked}; rifiutate: ${round.rejectedCount}`);
  md.push(`- Ricevute persistite: **${round.persistedCount}**${round.persistedPlayers.length ? ` (${round.persistedPlayers.join(', ')})` : ''}`);
  if (round.missingPersisted.length) md.push(`- Giocatori senza ricevuta: ${round.missingPersisted.join(', ')}`);
  md.push(`- Verdetto: ${round.verdict}`);
  md.push('');
}
md.push('### Bonus');
md.push('');
for (const bonus of bonusReports) {
  md.push(`- **${bonus.type}**: ${bonus.actionCount} azioni, ${bonus.persistedCount} ricevute. ${bonus.verdict}`);
}
md.push('');
md.push('## Errori e priorità');
md.push('');
for (const error of errors) {
  md.push(`### ${error.id} — ${error.severity} — ${error.area}`);
  md.push('');
  md.push(`**Sintomo:** ${error.symptom}`);
  md.push('');
  md.push('**Prove:**');
  for (const evidence of error.evidence) md.push(`- ${evidence}`);
  md.push('');
  md.push(`**Causa:** ${error.cause}`);
  md.push('');
  md.push(`**Impatto:** ${error.impact}`);
  md.push('');
  md.push(`**Prossimo passo:** ${error.next}`);
  md.push('');
}
md.push('## Risposte mancanti / non confermate');
md.push('');
md.push(`- **Timeline:** 9 ricevute su 16; 7 giocatori senza ricevuta. Il client ha visto 2 × 500 e un timeout dell’handler.`);
md.push(`- **Arena:** 14 ricevute su 16; 2 giocatori senza ricevuta. Il client ha visto solo 5 answer 200.`);
md.push(`- **Speed Rush:** 18 risposte su 96 attese; il round si è fermato dopo 18 task/answer per timeout.`);
md.push(`- **BIGLIE:** 0 azioni; il pilota TV si è chiuso con codice 1002 durante Basket.`);
md.push(`- **Time Buzzer:** 15 stop accettati e 33 rifiutati 422 per il timing artificiale dell’harness, non per il server.`);
md.push(`- **Bomba:** 9 pick accettati e 39 rifiutati “Non è il tuo turno”: l’harness manda i 16 pick in parallelo invece di rispettare il turno.`);
md.push('');
md.push('## File e prove');
md.push('');
md.push('- `game161_answers.json`: tutte le azioni e le 89 ricevute, con risposte HTTP e stato per giocatore.');
md.push('- `game161_answer_receipt.csv`: 89 ricevute dal DB.');
md.push('- `game161_game_event.csv`: 51 eventi (13 ROUND_STARTED, 15 ROUND_CLOSED, 9 TIMELINE_ANSWER, 14 ARENA_ANSWER).');
md.push('- `game161_game_round.csv`: 13 round.');
md.push('- `game161_game_state.csv`, `game161_state_blob.csv`: stato finale e 7 blob.');
md.push('- `logs/backend-game161.log`: lock `STATE_BLOB`, Hikari saturo e 500.');
md.push('- `logs/tv-game161.log`: chiusura TV 1002 durante Basket e assenza di BIGLIE.');
md.push('- `logs/full-game161.log`: sequenza dei 13 round e dei 4 bonus.');
md.push('');
md.push('## Verdetto');
md.push('');
md.push('Il progetto **accetta 16 giocatori** e li fa giocare tutti i 13 round; non è più vincolato a 8. Non è però ancora affidabile al 100% con 16 risposte simultanee: il collo di bottiglia è la transazione di idempotenza che tiene una connessione mentre serializza `STATE_BLOB`. Prima di considerare chiusa la prova a 16/20, va corretto E1 e rifatta la run; E3/E4 sono difetti dell’harness, non del server.');
md.push('');

writeFileSync(join(here, 'SIM_ERRORS_16P.md'), `${md.join('\n')}\n`);
console.log(JSON.stringify({
  actions: actions.length,
  receipts: receipts.length,
  receiptsByKind: report.summary.receiptsByKind,
  errors: serverErrors,
  rounds: roundReports.map((round) => `${round.type}:${round.persistedCount}/${round.actionCount}`),
  bonuses: bonusReports.map((bonus) => `${bonus.type}:${bonus.persistedCount}/${bonus.actionCount}`),
  timeBuzzerByManche,
  arena: report.summary.arena,
  speedRush: report.summary.speedRush,
  timeline: report.summary.timeline,
  biglie: report.summary.biglie,
}, null, 2));
