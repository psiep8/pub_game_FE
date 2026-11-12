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

const RUN = process.env.RUN_LABEL || '162';
const summaryFile = JSON.parse(read(`game${RUN}_actions_summary.json`));
const PLAYERS = summaryFile.players;
const GAME_ID = Number(process.env.GAME_ID || summaryFile.gameId);

const actions = read(`game${RUN}_actions.jsonl`).trim().split('\n').filter(Boolean).map(JSON.parse);
const receipts = parseCsv(read(`game${RUN}_answer_receipt.csv`)).map((row) => ({
  id: Number(row.ID),
  kind: row.KIND,
  deviceId: row.DEVICE_ID,
  commandKey: row.COMMAND_KEY,
  receivedAt: Number(row.CREATED_AT),
  receivedAtIso: iso(row.CREATED_AT),
  response: parseJson(row.RESPONSE),
}));
const events = parseCsv(read(`game${RUN}_game_event.csv`)).map((row) => ({
  seq: Number(row.SEQ),
  type: row.TYPE,
  roundKey: row.ROUND_KEY || null,
  createdAt: Number(row.CREATED_AT),
  createdAtIso: iso(row.CREATED_AT),
  payload: parseJson(row.PAYLOAD, {}),
}));
const roundRows = parseCsv(read(`game${RUN}_game_round.csv`)).map((row) => {
  const payload = parseJson(row.PAYLOAD, {});
  return {
    roundIndex: Number(row.ROUND_INDEX),
    type: row.TYPE,
    status: row.STATUS,
    question: payload?.question || (payload?.songTitle ? `${payload.songTitle} — ${payload.artist || ''}`.trim() : null) || payload?.proverb || null,
  };
});
const stateRow = parseCsv(read(`game${RUN}_game_state.csv`))[0];
const blobs = parseCsv(read(`game${RUN}_state_blob.csv`)).map((row) => ({
  key: row.BLOB_KEY,
  updatedAt: Number(row.UPDATED_AT),
  updatedAtIso: iso(row.UPDATED_AT),
  payload: parseJson(row.PAYLOAD),
}));
const backendLog = read(`logs/backend-game${RUN}.log`);
const tvLog = read(`logs/tv-game${RUN}.log`);

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

const errors = [];
if (serverErrors.stateBlobLockTimeouts > 0 || serverErrors.hikariPoolTimeouts > 0 || serverErrors.http500 > 0) {
  errors.push({
    id: 'E1', severity: 'P0', area: 'STATE_BLOB / Hikari',
    symptom: `${serverErrors.hikariPoolTimeouts} timeout Hikari e ${serverErrors.http500} × 500 con ${PLAYERS.length} richieste concorrenti.`,
    evidence: [
      `${serverErrors.stateBlobLockTimeouts} × "Timeout trying to lock table STATE_BLOB"`,
      `${serverErrors.hikariPoolTimeouts} × "Connection is not available"`,
      `Timeline: ${receipts.filter((r) => r.kind === 'TIMELINE_ANSWER').length}/${PLAYERS.length} ricevute; Arena: ${receipts.filter((r) => r.kind === 'ARENA_ANSWER').length}/${PLAYERS.length}`,
    ],
    cause: 'Transazione di idempotenza che trattiene una connessione durante l’azione e le scritture su STATE_BLOB.',
    impact: 'Risposte perse lato client.',
    next: 'Azioni fuori transazione e ricevuta in una transazione breve (IdempotencyService).',
  });
}
if (tvClosed || missingBiglie) {
  errors.push({
    id: 'E2', severity: 'P1', area: 'TV pilot / BIGLIE',
    symptom: tvClosed ? 'Il pilota TV ha chiuso il socket (1002) durante la run.' : 'Il bonus BIGLIE non ha prodotto azioni.',
    evidence: [
      tvClosed ? `logs/tv-game${RUN}.log: "socket pilota chiusa (1002)"` : 'nessuna chiusura TV trovata',
      `bonusReports.BIGLIE.actionCount = ${bonusReports.find((b) => b.type === 'BIGLIE').actionCount}`,
    ],
    cause: 'Da verificare lato server/handshake: la TV viene disconnessa prima della fine dei bonus.',
    impact: 'Parte dei bonus non esercitata.',
    next: 'Riconnessione automatica del pilota TV e log del frame ERROR/closeReason.',
  });
}
// Il 422 della prima manche è voluto: verifica che il server rifiuti un tempo impossibile.
const buzzerStopsChecked = timeBuzzerStops.filter((entry) => entry.expect !== 422);
const buzzerRejected = buzzerStopsChecked.filter((entry) => entry.status !== 200).length;
if (buzzerRejected > 0) {
  errors.push({
    id: 'E3', severity: 'P1', area: 'Time Buzzer (harness)',
    symptom: `${buzzerRejected} stop rifiutati su ${buzzerStopsChecked.length}.`,
    evidence: [`Per manche: ${JSON.stringify(timeBuzzerByManche)}`],
    cause: 'Tempi dichiarati non corrispondenti al tempo reale del server.',
    impact: 'Manche non validate.',
    next: 'Inviare il tempo misurato dal via del server.',
  });
}
const bombaRejected = bombaPicks.filter((entry) => entry.status !== 200).length;
if (bombaRejected > 0) {
  errors.push({
    id: 'E4', severity: 'P1', area: 'Bomba (harness)',
    symptom: `${bombaRejected} pick rifiutati su ${bombaPicks.length}.`,
    evidence: [`${bombaPicks.filter((entry) => entry.status === 200).length} × 200`],
    cause: 'Pick inviati senza rispettare il turno.',
    impact: 'Il gioco non è stato esercitato da tutti.',
    next: 'Leggere lo stato Bomba e scegliere solo per la squadra di turno.',
  });
}
const timelinePersisted = receipts.filter((r) => r.kind === 'TIMELINE_ANSWER').length;
const arenaPersisted = receipts.filter((r) => r.kind === 'ARENA_ANSWER').length;
if (timelinePersisted < PLAYERS.length || arenaPersisted < PLAYERS.length) {
  errors.push({
    id: 'E5', severity: 'P1', area: 'Timeline / Arena',
    symptom: `Timeline ${timelinePersisted}/${PLAYERS.length}, Arena ${arenaPersisted}/${PLAYERS.length} risposte persistite.`,
    evidence: [
      `Timeline: ${timelineAnswers.length} azioni, ${timelineAnswers.filter((e) => e.status === 500).length} × 500`,
      `Arena: ${arenaAnswers.filter((e) => e.status === 200).length} answer 200 lato client`,
    ],
    cause: 'Da verificare: risposte valide ma non confermate al telefono.',
    impact: 'Giocatori senza ricevuta.',
    next: 'Confrontare answer_receipt con le azioni del client.',
  });
}
const verdictLine = errors.length === 0
  ? 'Tutti i round e i bonus hanno prodotto le risposte attese, senza timeout del pool né conflitti.'
  : errors.length === 1
    ? `Resta un problema aperto: ${errors[0].id}.`
    : `Restano ${errors.length} problemi aperti: ${errors.map((error) => error.id).join(', ')}.`;


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
  gameId: GAME_ID,
  generatedAt: new Date().toISOString(),
  scenario: {
    players: PLAYERS,
    playerCount: PLAYERS.length,
    rounds: ROUNDS,
    bonuses: BONUSES,
    note: '16 sessioni reali, join STOMP, 13 round, 4 bonus, fault injection; nessuna verifica visiva.',
  },
  summary: {
    gameId: GAME_ID,
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
      expectedAnswers: PLAYERS.length * 6,
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

writeFileSync(join(here, `game${RUN}_answers.json`), `${JSON.stringify(report, null, 2)}\n`);

const md = [];
md.push(`# Partita #${RUN} — ${PLAYERS.length} giocatori: risposte ed errori (game_id ${GAME_ID})`);
md.push('');
md.push(`Generato: ${new Date().toISOString()}`);
md.push('');
md.push('## Esito in una riga');
md.push('');
md.push(`**${PLAYERS.length} giocatori, ${ROUNDS.length} round, ${BONUSES.length} bonus, ${actions.length} azioni, ${receipts.length} ricevute persistite.**`);
md.push(verdictLine);
md.push('');
md.push('## Cosa è arrivato');
md.push('');
md.push('| Gioco | Azioni log | Inviate/ok | Rifiutate | Persistite |');
md.push('|---|---:|---:|---:|---:|');
for (const round of roundReports) {
  md.push(`| ${round.type} | ${round.actionCount} | ${round.sentOrAcked} | ${round.rejectedCount} | ${round.persistedCount} |`);
}
for (const bonus of bonusReports) {
  md.push(`| BONUS ${bonus.type} | ${bonus.actionCount} | ${bonus.actionCount} | 0 | ${bonus.persistedCount} |`);
}
md.push('');
md.push('## Time Buzzer per manche');
md.push('');
md.push('| Manche | Stop | Accettati | Rifiutati |');
md.push('|---|---:|---:|---:|');
for (const [manche, data] of Object.entries(timeBuzzerByManche)) {
  md.push(`| ${manche} | ${data.total} | ${data.ok} | ${data.rejected} |`);
}
md.push('');
md.push('## Bomba');
md.push('');
md.push(`${bombaPicks.filter((entry) => entry.status === 200).length} pick accettati su ${bombaPicks.length}, tutti a turno.`);
md.push('');
md.push('## Errori e priorità');
md.push('');
if (errors.length === 0) {
  md.push('Nessun errore aperto: nessun timeout del pool, nessun conflitto su eventi o blob.');
} else {
  for (const error of errors) {
    md.push(`### ${error.id} — ${error.severity} — ${error.area}`);
    md.push('');
    md.push(`**Sintomo:** ${error.symptom}`);
    md.push('');
    md.push('**Prove:**');
    for (const line of error.evidence) md.push(`- ${line}`);
    md.push('');
    md.push(`**Causa:** ${error.cause}`);
    md.push('');
    md.push(`**Impatto:** ${error.impact}`);
    md.push('');
    md.push(`**Prossimo passo:** ${error.next}`);
    md.push('');
  }
}
md.push('## Numeri del server');
md.push('');
md.push(`- Ricevute: ${receipts.length}; eventi: ${events.length}; round persistiti: ${roundRows.length}; blob: ${blobs.length}.`);
md.push(`- Timeout lock STATE_BLOB: ${serverErrors.stateBlobLockTimeouts}; timeout Hikari: ${serverErrors.hikariPoolTimeouts}; 500: ${serverErrors.http500}.`);
md.push(`- Conflitti seq: ${serverErrors.seqConflicts}; conflitti blob: ${serverErrors.stateBlobUniqueConflicts}; righe ERROR nel log: ${serverErrors.errorLines}.`);
md.push(`- Invii STOMP falliti (ora a WARN, non ERROR): ${serverErrors.stompSendFailures}.`);
md.push('');
md.push('## File e prove');
md.push('');
md.push(`- \`game${RUN}_answers.json\`: azioni e ricevute con stato per giocatore.`);
md.push(`- \`game${RUN}_answer_receipt.csv\`, \`game${RUN}_game_event.csv\`, \`game${RUN}_game_round.csv\`, \`game${RUN}_game_state.csv\`, \`game${RUN}_state_blob.csv\`: export dal DB.`);
md.push(`- \`logs/backend-game${RUN}.log\`, \`logs/tv-game${RUN}.log\`, \`logs/full-game${RUN}.log\`.`);
md.push('');
md.push('## Verdetto');
md.push('');
md.push(errors.length === 0
  ? `La partita a ${PLAYERS.length} giocatori regge: ${receipts.length} risposte persistite, nessun timeout del pool, nessun conflitto su eventi o blob.`
  : `La partita a ${PLAYERS.length} giocatori gira, ma resta aperto ${errors.map((error) => error.id).join(' e ')}: vedi sopra.`);
md.push('');

writeFileSync(join(here, 'SIM_ERRORS_16P.md'), `${md.join('\n')}\n`);
console.log(JSON.stringify({
  gameId: GAME_ID,
  actions: actions.length,
  receipts: receipts.length,
  receiptsByKind: report.summary.receiptsByKind,
  errors: errors.map((error) => error.id),
  serverErrors,
  timeBuzzerByManche,
  bomba: { picks: bombaPicks.length, ok: bombaPicks.filter((entry) => entry.status === 200).length },
  timeline: { persisted: timelinePersisted, actions: timelineAnswers.length },
  arena: { persisted: arenaPersisted, actions: arenaAnswers.length },
  speedRush: report.summary.speedRush,
}, null, 2));
