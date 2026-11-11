import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

/** Parser CSV minimo: gestisce virgolette, virgole e righe multilinea. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() || [];
  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
}

const parseJson = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const iso = (ms) => (ms ? new Date(Number(ms)).toISOString() : null);
const local = (ms) => (ms ? new Date(Number(ms)).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : null);

const roundsCsv = parseCsv(read('game97_rounds.csv'));
const eventsCsv = parseCsv(read('game97_events.csv'));
const receiptsCsv = parseCsv(read('game97_receipts.csv'));
const stateCsv = parseCsv(read('game97_state.csv'));
const simLog = read('logs/sim-game97.log');
const backendLog = read('logs/backend-game97.log');

const events = eventsCsv
  .map((row) => ({
    seq: Number(row.SEQ),
    type: row.TYPE,
    roundKey: row.ROUND_KEY || null,
    deviceId: row.DEVICE_ID || null,
    createdAt: Number(row.CREATED_AT),
    createdAtIso: iso(row.CREATED_AT),
    createdAtLocal: local(row.CREATED_AT),
    payload: parseJson(row.PAYLOAD),
  }))
  .sort((a, b) => a.seq - b.seq);

const rounds = roundsCsv
  .map((row) => {
    const payload = parseJson(row.PAYLOAD);
    return {
      roundIndex: Number(row.ROUND_INDEX),
      type: row.TYPE,
      status: row.STATUS,
      question:
        payload.question ||
        (payload.songTitle ? `${payload.songTitle} — ${payload.artist || ''}`.trim() : null) ||
        payload.proverb ||
        null,
      payloadType: payload.type || row.TYPE,
      payload,
    };
  })
  .sort((a, b) => a.roundIndex - b.roundIndex);

const starts = new Map(
  events
    .filter((event) => event.type === 'ROUND_STARTED')
    .map((event) => [Number(event.payload.roundIndex), event]),
);
const closes = events.filter((event) => event.type === 'ROUND_CLOSED').sort((a, b) => a.createdAt - b.createdAt);

function closeFor(roundIndex) {
  const start = starts.get(roundIndex);
  if (!start) return null;
  const next = starts.get(roundIndex + 1);
  const upperBound = next ? next.createdAt : Number.POSITIVE_INFINITY;
  return closes.find((close) => close.createdAt > start.createdAt && close.createdAt < upperBound) || null;
}

function intervalFor(roundIndex) {
  const start = starts.get(roundIndex);
  if (!start) return null;
  const close = closeFor(roundIndex);
  const next = starts.get(roundIndex + 1);
  return {
    start: start.createdAt,
    end: close ? close.createdAt : next ? next.createdAt : Number.POSITIVE_INFINITY,
  };
}

const receipts = receiptsCsv
  .map((row) => {
    const response = parseJson(row.RESPONSE);
    return {
      kind: row.KIND,
      playerName: response.playerName || row.DEVICE_ID || null,
      deviceId: row.DEVICE_ID || null,
      receivedAt: Number(row.CREATED_AT),
      receivedAtIso: iso(row.CREATED_AT),
      receivedAtLocal: local(row.CREATED_AT),
      score: response.score ?? null,
      correctPairs: response.correctPairs ?? null,
      totalPairs: response.totalPairs ?? null,
      ackedAt: response.ackedAt ?? null,
      replayed: response.replayed ?? false,
    };
  })
  .sort((a, b) => a.receivedAt - b.receivedAt);

function answersFor(roundIndex) {
  const interval = intervalFor(roundIndex);
  if (!interval) return [];
  return receipts.filter((answer) => answer.receivedAt >= interval.start && answer.receivedAt < interval.end);
}

function eventsFor(roundIndex) {
  const interval = intervalFor(roundIndex);
  if (!interval) return [];
  return events.filter((event) => event.createdAt >= interval.start && event.createdAt <= interval.end);
}

const roundReports = rounds.map((round) => {
  const start = starts.get(round.roundIndex) || null;
  const close = closeFor(round.roundIndex);
  const answers = answersFor(round.roundIndex);
  return {
    roundIndex: round.roundIndex,
    type: round.type,
    question: round.question,
    startedAt: start ? start.createdAt : null,
    startedAtIso: start ? start.createdAtIso : null,
    startedAtLocal: start ? start.createdAtLocal : null,
    closedAt: close ? close.createdAt : null,
    closedAtIso: close ? close.createdAtIso : null,
    closedAtLocal: close ? close.createdAtLocal : null,
    closeReason: close?.payload?.reason ?? null,
    answers,
    answerCount: answers.length,
    remoteAnswerArrived: answers.length > 0,
    events: eventsFor(round.roundIndex).map((event) => ({
      seq: event.seq,
      type: event.type,
      createdAt: event.createdAt,
      createdAtIso: event.createdAtIso,
      payload: event.payload,
    })),
  };
});

const bonuses = [...simLog.matchAll(/\[sim (\d{2}:\d{2}:\d{2})\] bonus: ([A-Z_]+)/g)].map((match) => ({
  type: match[2],
  startedAtLocal: match[1],
  answers: [],
  note: 'Il bonus non produce eventi/risposte nel log della partita.',
}));

const answersByType = receipts.reduce((acc, answer) => {
  acc[answer.kind] = (acc[answer.kind] || 0) + 1;
  return acc;
}, {});

const players = ['Anna', 'Bruno', 'Carla', 'Dario'];
const answersByPlayer = Object.fromEntries(players.map((player) => [player, 0]));
for (const answer of receipts) {
  if (answer.playerName in answersByPlayer) answersByPlayer[answer.playerName] += 1;
}

const roundsWithAnswers = roundReports.filter((round) => round.answerCount > 0).map((round) => ({
  roundIndex: round.roundIndex,
  type: round.type,
  answerCount: round.answerCount,
}));
const roundsWithoutAnswers = roundReports.filter((round) => round.answerCount === 0).map((round) => ({
  roundIndex: round.roundIndex,
  type: round.type,
}));

const report = {
  gameId: 97,
  generatedAt: new Date().toISOString(),
  sources: {
    events: 'game97_events.csv',
    rounds: 'game97_rounds.csv',
    receipts: 'game97_receipts.csv',
    state: 'game97_state.csv',
    simLog: 'logs/sim-game97.log',
    backendLog: 'logs/backend-game97.log',
  },
  summary: {
    roundsPlayed: roundReports.length,
    bonuses: bonuses.length,
    totalEvents: events.length,
    totalAnswers: receipts.length,
    remoteAnswersArrived: receipts.length > 0,
    answersByType,
    answersByPlayer,
    roundsWithAnswers,
    roundsWithoutAnswers,
    verdict:
      receipts.length === 0
        ? 'Nessuna risposta dai remoti.'
        : `Risposte remote arrivate solo in ${roundsWithAnswers.length} round (${receipts.length} totali); gli altri ${roundsWithoutAnswers.length} round sono chiusi senza risposte.`,
  },
  rounds: roundReports,
  bonuses,
  finalState: stateCsv[0]
    ? {
        seq: Number(stateCsv[0].SEQ),
        version: Number(stateCsv[0].VERSION),
        status: stateCsv[0].STATUS,
        roundIndex: Number(stateCsv[0].ROUND_INDEX),
        roundType: stateCsv[0].ROUND_TYPE,
        roundKey: stateCsv[0].ROUND_KEY,
        updatedAt: Number(stateCsv[0].UPDATED_AT),
        updatedAtIso: iso(stateCsv[0].UPDATED_AT),
      }
    : null,
  errors: {
    gameEventSeqConflictRequests: (
      backendLog.match(/WARN .*Unique index or primary key violation: "PUBLIC\.UK_GAME_EVENT_SEQ/g) || []
    ).length,
    stateBlobConflictRequests: (
      backendLog.match(/WARN .*Unique index or primary key violation: "PUBLIC\.UK_STATE_BLOB_KEY/g) || []
    ).length,
    hibernateAssertionFailures: (backendLog.match(/HHH000099/g) || []).length,
    stompSendFailures: (backendLog.match(/Failed to send message to MessageChannel/g) || []).length,
    http500Responses: (backendLog.match(/Servlet\.service\(\) for servlet/g) || []).length,
    detailsFile: 'SIM_ERRORS.md',
  },
};

writeFileSync(join(here, 'game97_answers.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      rounds: report.summary.roundsPlayed,
      answers: report.summary.totalAnswers,
      withAnswers: report.summary.roundsWithAnswers,
      withoutAnswers: report.summary.roundsWithoutAnswers.length,
      errors: report.errors,
      finalState: report.finalState,
    },
    null,
    2,
  ),
);
