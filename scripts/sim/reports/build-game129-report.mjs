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
const PLAYERS = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giulia', 'Luca'];

const actions = read('game129_actions.jsonl').trim().split('\n').filter(Boolean).map(JSON.parse);
const receipts = parseCsv(read('game129_receipts.csv')).map((row) => ({
  id: Number(row.ID),
  kind: row.KIND,
  deviceId: row.DEVICE_ID,
  commandKey: row.COMMAND_KEY,
  receivedAt: Number(row.CREATED_AT),
  receivedAtIso: iso(row.CREATED_AT),
  response: parseJson(row.RESPONSE),
}));
const events = parseCsv(read('game129_events.csv')).map((row) => ({
  seq: Number(row.SEQ),
  type: row.TYPE,
  roundKey: row.ROUND_KEY || null,
  createdAt: Number(row.CREATED_AT),
  createdAtIso: iso(row.CREATED_AT),
  payload: parseJson(row.PAYLOAD, {}),
}));
const roundRows = parseCsv(read('game129_rounds.csv')).map((row) => {
  const payload = parseJson(row.PAYLOAD, {});
  return {
    roundIndex: Number(row.ROUND_INDEX),
    type: row.TYPE,
    status: row.STATUS,
    question: payload?.question || (payload?.songTitle ? `${payload.songTitle} — ${payload.artist || ''}`.trim() : null) || payload?.proverb || null,
  };
});
const stateRow = parseCsv(read('game129_state.csv'))[0];
const backendLog = read('logs/backend-game129.log');

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
  else if (index >= 13) bonusActions[['CASINO', 'BASKET', 'CAVALLO', 'BIGLIE'][index - 13]].push(entry);
  else preflight.push(entry);
}

const kindRound = { TIMELINE_ANSWER: 4, ARENA_ANSWER: 11, SPEED_RUSH_ANSWER: 12 };
const answerReceipts = receipts.map((receipt) => ({
  ...receipt,
  roundIndex: kindRound[receipt.kind] ?? null,
  bonus: receipt.kind === 'BASKET_SHOT' ? 'BASKET' : null,
}));

const roundReports = ROUNDS.map((type, index) => {
  const roundActionsList = roundActions[index];
  const answers = answerReceipts.filter((receipt) => receipt.roundIndex === index);
  const start = events.find((event) => event.type === 'ROUND_STARTED' && Number(event.payload?.roundIndex) === index);
  const close = events.find((event) => event.type === 'ROUND_CLOSED' && event.createdAt > (start?.createdAt ?? 0)
    && event.createdAt < (events.find((event) => event.type === 'ROUND_STARTED' && Number(event.payload?.roundIndex) === index + 1)?.createdAt ?? Infinity));
  const rejected = roundActionsList.filter((entry) => typeof entry.status === 'number' && entry.status >= 400);
  return {
    roundIndex: index,
    type,
    question: roundRows.find((row) => row.roundIndex === index)?.question ?? null,
    startedAt: start?.createdAt ?? null,
    startedAtIso: start?.createdAtIso ?? null,
    closedAt: close?.createdAt ?? null,
    closeReason: close?.payload?.reason ?? null,
    actions: roundActionsList,
    actionCount: roundActionsList.length,
    acceptedOrSent: roundActionsList.filter((entry) => entry.status === 'sent' || entry.status === 200).length,
    rejectedCount: rejected.length,
    rejected,
    persistedAnswers: answers,
    persistedCount: answers.length,
    verdict: answers.length > 0
      ? `${answers.length} risposte persistite dal server`
      : roundActionsList.length > 0
        ? 'Azione inviata ma nessuna ricevuta persistita'
        : 'Nessuna azione inviata',
  };
});

const bonusReports = Object.entries(bonusActions).map(([type, list]) => {
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
        ? 'Azione STOMP inviata, nessuna ricevuta/ACK'
        : 'Nessuna azione',
  };
});

const statuses = actions.reduce((acc, entry) => {
  const key = String(entry.status);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const serverErrors = {
  gameEventSeqConflicts: (backendLog.match(/WARN .*Unique index or primary key violation: "PUBLIC\.UK_GAME_EVENT_SEQ/g) || []).length,
  stateBlobConflicts: (backendLog.match(/WARN .*Unique index or primary key violation: "PUBLIC\.UK_STATE_BLOB_KEY/g) || []).length,
  hibernateAssertions: (backendLog.match(/HHH000099/g) || []).length,
  http500: (backendLog.match(/Servlet\.service\(\) for servlet/g) || []).length,
  stompSendFailures: (backendLog.match(/Failed to send message to MessageChannel/g) || []).length,
  errorLines: (backendLog.match(/^.* ERROR /gm) || []).length,
};

const summary = {
  gameId: 129,
  players: PLAYERS,
  rounds: ROUNDS.length,
  bonuses: Object.keys(bonusActions).length,
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
  serverErrors,
  roundsWithPersistedAnswers: roundReports.filter((round) => round.persistedCount > 0).map((round) => ({
    roundIndex: round.roundIndex,
    type: round.type,
    persisted: round.persistedCount,
  })),
  verdict: 'Le risposte arrivano e vengono persistite su Speed Rush (48), Basket (21), Timeline (3) e Arena (1). Time Buzzer, Arena (7/8) e alcuni giochi STOMP non hanno prodotto ricevute; dettagli in SIM_ERRORS_8P.md.',
};

const report = {
  gameId: 129,
  generatedAt: new Date().toISOString(),
  scenario: {
    players: PLAYERS,
    rounds: ROUNDS,
    bonuses: Object.keys(bonusActions),
    note: '8 sessioni reali, join STOMP, risposte HTTP/STOMP, fault injection.',
  },
  summary,
  preflight,
  rounds: roundReports,
  bonuses: bonusReports,
  persistedAnswers: answerReceipts,
  events,
  finalState: stateRow ? {
    seq: Number(stateRow.SEQ),
    version: Number(stateRow.VERSION),
    status: stateRow.STATUS,
    roundIndex: Number(stateRow.ROUND_INDEX),
    roundType: stateRow.ROUND_TYPE,
    roundKey: stateRow.ROUND_KEY,
    updatedAt: Number(stateRow.UPDATED_AT),
    updatedAtIso: iso(stateRow.UPDATED_AT),
  } : null,
  serverErrors,
};

writeFileSync(join(here, 'game129_answers.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  actions: summary.totalActions,
  statuses: summary.statuses,
  receipts: summary.receiptsByKind,
  errors: serverErrors,
  rounds: roundReports.map((round) => `${round.type}:${round.persistedCount}`),
  bonuses: bonusReports.map((bonus) => `${bonus.type}:${bonus.persistedCount}`),
}, null, 2));
