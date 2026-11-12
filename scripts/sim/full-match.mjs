#!/usr/bin/env node
/**
 * Partita completa a 8 giocatori, tutta pilotata da qui.
 *
 * setup: crea partita, TV, admin e 8 sessioni remote.
 * run:   join di tutti, 13 round con risposte, 4 bonus, fault injection.
 *
 * Non è un test unitario: è una regia che parla con gli stessi canali del
 * telefono (STOMP /app/game/{id}/answer e /status, endpoint HTTP dei giochi).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.API || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8080/ws-pubgame';
const STATE_PATH = process.env.STATE_PATH || fileURLToPath(new URL('./.state8.json', import.meta.url));
const REPORT_DIR = fileURLToPath(new URL('./reports/', import.meta.url));
const TEAMS = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giulia', 'Luca'];
const ROUNDS = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE',
  'TIME_BUZZER', 'BOMBA', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];
const BONUSES = ['CASINO', 'BASKET', 'CAVALLO', 'BIGLIE'];
const ROUND_MS = Number(process.env.ROUND_MS || 38000);
const BONUS_MS = Number(process.env.BONUS_MS || 22000);
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS || 18000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(`[full ${new Date().toISOString().slice(11, 19)}]`, ...args);
let actions = [];

function action(entry) {
  actions.push(entry);
  appendFileSync(`${REPORT_DIR}game-actions.jsonl`, `${JSON.stringify(entry)}\n`);
}

function controlSecret() {
  if (process.env.CONTROL_SECRET) return process.env.CONTROL_SECRET;
  const env = readFileSync(new URL('../../deploy/.env', import.meta.url), 'utf8');
  const line = env.split(/\r?\n/).find((row) => row.startsWith('CONTROL_SECRET='));
  return line ? line.slice('CONTROL_SECRET='.length) : '';
}

async function api(path, method = 'GET', body, headers = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* testo non JSON */ }
  return { status: response.status, text, json };
}

async function register(gameId, role, playerName, deviceId, secret) {
  const headers = role === 'REMOTE' ? {} : { 'X-Control-Secret': secret };
  const published = await api(`/games/${gameId}/session`, 'POST', {
    deviceId,
    role,
    playerName: playerName || null,
    sessionToken: null,
  }, headers);
  if (!published.json?.sessionToken) throw new Error(`sessione ${role}/${playerName} senza token: ${published.status} ${published.text}`);
  return published.json.sessionToken;
}

async function setup() {
  const secret = controlSecret();
  if (secret.length < 32) throw new Error('CONTROL_SECRET assente in deploy/.env');
  const active = await api('/games/active');
  const activeId = Number(active.json?.gameId || 1);
  const bootstrap = await register(activeId, 'TV', '', 'full-bootstrap-tv', secret);
  const created = await api('/games', 'POST', {}, { 'X-Session-Token': bootstrap });
  const gameId = Number(created.json?.id);
  if (!gameId) throw new Error(`creazione partita fallita: ${created.status} ${created.text}`);
  const tv = await register(gameId, 'TV', '', 'full-tv', secret);
  const admin = await register(gameId, 'ADMIN', '', 'full-admin', secret);
  await api(`/games/${gameId}/reset`, 'POST', {}, { 'X-Session-Token': admin });
  const phones = {};
  for (const name of TEAMS) {
    phones[name] = await register(gameId, 'REMOTE', name, `full-${name.toLowerCase()}`, secret);
  }
  const state = { gameId, tv, admin, phones, createdAt: new Date().toISOString() };
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
  log(`setup: partita ${gameId} con ${TEAMS.length} telefoni`);
  console.log(`FULL_GAME=${gameId}`);
}

class StompClient {
  constructor(token, label, gameId) {
    this.token = token;
    this.label = label;
    this.gameId = gameId;
    this.ws = null;
    this.connected = false;
    this.buffer = '';
    this.statuses = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout STOMP ${this.label}`)), 15000);
      this.ws = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
      this.ws.addEventListener('open', () => {
        this.ws.send(
          `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n` +
          `X-Session-Token:${this.token}\n\n\0`,
        );
      });
      this.ws.addEventListener('message', (event) => {
        this.buffer += String(event.data);
        let end;
        while ((end = this.buffer.indexOf('\0')) >= 0) {
          const frame = this.buffer.slice(0, end);
          this.buffer = this.buffer.slice(end + 1);
          this.handleFrame(frame, timer, resolve, reject);
        }
      });
      this.ws.addEventListener('error', () => log(`errore WebSocket ${this.label}`));
      this.ws.addEventListener('close', (event) => {
        this.connected = false;
        if (this.closing) return;
        log(`socket ${this.label} chiusa (${event.code})`);
      });
    });
  }

  handleFrame(frame, timer, resolve, reject) {
    if (frame.startsWith('CONNECTED')) {
      clearTimeout(timer);
      this.connected = true;
      log(`STOMP ${this.label} connesso`);
      resolve();
      return;
    }
    if (frame.startsWith('ERROR')) {
      clearTimeout(timer);
      const message = frame.replace(/\n/g, ' | ').slice(0, 500);
      log(`STOMP ${this.label} ERROR: ${message}`);
      reject(new Error(message));
      return;
    }
    if (!frame.startsWith('MESSAGE')) return;
    const split = frame.indexOf('\n\n');
    if (split < 0) return;
    const body = frame.slice(split + 2);
    try {
      const json = JSON.parse(body);
      if (json?.action) this.statuses[json.action] = json;
      if (json?.action && json.action.endsWith('_STATE')) {
        log(`${this.label} stato ${json.action}`);
      }
    } catch { /* frame non JSON */ }
  }

  subscribeStatus() {
    this.ws.send(
      `SUBSCRIBE\nid:sub-status\ndestination:/topic/game/${this.gameId}/status\n\n\0`,
    );
  }

  send(destination, payload) {
    if (!this.connected) throw new Error(`${this.label} non connesso`);
    const body = JSON.stringify(payload);
    this.ws.send(
      `SEND\ndestination:${destination}\ncontent-type:application/json\n` +
      `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }

  status(payload) {
    this.send(`/app/game/${this.gameId}/status`, payload);
  }

  answer(playerName, index, responseTimeMs = 1000) {
    this.send(`/app/game/${this.gameId}/answer`, { playerName, answerIndex: index, responseTimeMs });
  }

  close() {
    this.closing = true;
    try { this.ws?.close(); } catch { /* già chiusa */ }
  }
}

function parseJson(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

async function currentRound(gameId, token) {
  const result = await api(`/games/${gameId}/current-round`, 'GET', undefined, { 'X-Session-Token': token });
  return { status: result.status, round: result.json, payload: parseJson(result.json?.payload) };
}

async function httpAction(label, path, { method = 'POST', body, token, expect } = {}) {
  const result = await api(path, method, body, token ? { 'X-Session-Token': token } : {});
  action({ at: Date.now(), label, transport: 'http', method, path, body, status: result.status, response: result.json ?? result.text.slice(0, 400), expect: expect ?? null });
  return result;
}

async function stompAction(label, client, payload, expect = null) {
  try {
    client.status(payload);
    action({ at: Date.now(), label, transport: 'stomp', player: client.label, payload, status: 'sent', expect });
    return true;
  } catch (error) {
    action({ at: Date.now(), label, transport: 'stomp', player: client.label, payload, status: 'error', response: error.message, expect });
    return false;
  }
}

async function answerAction(label, client, playerName, index, expect = null) {
  try {
    client.answer(playerName, index, 1200);
    action({ at: Date.now(), label, transport: 'stomp-answer', player: playerName, index, status: 'sent', expect });
    return true;
  } catch (error) {
    action({ at: Date.now(), label, transport: 'stomp-answer', player: playerName, index, status: 'error', response: error.message, expect });
    return false;
  }
}

async function setupScenario(state, clients) {
  const { gameId, admin, phones } = state;
  log('fault injection: heartbeat token non valido / body assente');
  await httpAction('heartbeat-token-invalido', `/games/${gameId}/session/heartbeat`, {
    body: { sessionToken: 'token-che-non-esiste', seq: 0 }, expect: 410,
  });
  await httpAction('heartbeat-body-assente', `/games/${gameId}/session/heartbeat`, { expect: 410 });
  await httpAction('diagnostica-con-token-giocatore', `/games/${gameId}/diagnostics`, {
    method: 'GET', token: phones.Anna, expect: 403,
  });

  log('join iniziale di tutti gli 8 telefoni');
  for (const name of TEAMS) {
    await stompAction('join-iniziale', clients[name], { action: 'JOIN_GAME', playerName: name }, 'ok');
  }
}

async function roundQuiz(state, clients) {
  for (const [index, name] of TEAMS.entries()) {
    await answerAction('quiz-answer', clients[name], name, index % 4);
    await sleep(80);
  }
  // risposta duplicata: deve essere gestita senza doppio punteggio
  await answerAction('quiz-duplicate-Anna', clients.Anna, 'Anna', 0, 'duplicate');
  // giocatore sbagliato sulla sessione di Anna: deve essere rifiutato
  const fault = new StompClient(state.phones.Anna, 'fault-Anna-come-Bruno', state.gameId);
  try {
    await fault.connect();
    await stompAction('quiz-wrong-player', fault, { action: 'JOIN_GAME', playerName: 'Bruno' }, '403');
    await sleep(400);
  } catch (error) {
    action({ at: Date.now(), label: 'quiz-wrong-player', transport: 'stomp', status: 'rejected-as-expected', response: error.message });
  } finally {
    fault.close();
  }
}

async function roundBooking(state, clients, roundType) {
  for (const name of TEAMS) {
    await stompAction(`${roundType}-book`, clients[name], { action: 'JOIN_GAME', playerName: name }, 'booking');
    await sleep(50);
  }
  await sleep(1200);
  for (const [index, name] of TEAMS.entries()) {
    await answerAction(`${roundType}-answer`, clients[name], name, index % 4);
    await sleep(60);
  }
}

async function roundTimeline(state, clients) {
  const current = await currentRound(state.gameId, state.admin);
  const payload = current.payload || {};
  const roundId = String(payload.roundId || '');
  const count = Number(payload.count || (payload.items?.length ?? 0));
  action({ at: Date.now(), label: 'timeline-round', transport: 'http', status: current.status, response: { roundId, count, type: current.round?.type } });
  if (!roundId || count < 2) {
    log('timeline: roundId/items mancanti, salto');
    return;
  }
  const order = Array.from({ length: count }, (_, index) => index);
  for (const [index, name] of TEAMS.entries()) {
    const custom = index === 0 ? [...order].reverse() : order;
    await httpAction('timeline-answer', `/games/${state.gameId}/timeline-answer`, {
      token: state.phones[name],
      body: { playerName: name, roundId, order: custom, idempotencyKey: `full-tl-${Date.now()}-${name}` },
    });
    await sleep(80);
  }
  await httpAction('timeline-duplicate-Anna', `/games/${state.gameId}/timeline-answer`, {
    token: state.phones.Anna,
    body: { playerName: 'Anna', roundId, order, idempotencyKey: `full-tl-${Date.now()}-dup` },
    expect: 'replay/ok',
  });
  return { roundId, order };
}

async function roundTimeBuzzer(state, clients) {
  const MANCHES = 3;
  for (let manche = 1; manche <= MANCHES; manche += 1) {
    const started = await httpAction('time-buzzer-start', `/games/${state.gameId}/time-buzzer/start`, {
      token: state.admin, body: { manche }, expect: 200,
    });
    if (started.status !== 200) return;
    await sleep(1500);
    const startMs = Date.now();
    for (const [index, name] of TEAMS.entries()) {
      // Solo nella prima manche un tavolo manda un tempo impossibile.
      const invalid = manche === 1 && index === TEAMS.length - 1;
      const ms = invalid ? 0 : 1500 + index * 40 + (manche - 1) * 100;
      await httpAction('time-buzzer-stop', `/games/${state.gameId}/time-buzzer/stop`, {
        token: state.phones[name], body: { playerName: name, ms }, expect: invalid ? 422 : 200,
      });
      await sleep(40);
    }
    action({ at: Date.now(), label: 'time-buzzer-elapsed', transport: 'local', status: 'info', response: { manche, elapsed: Date.now() - startMs } });
    // Reveal della manche prima del via successivo, come la TV.
    await sleep(3500);
  }
}

async function roundBomba(state, clients) {
  await httpAction('bomba-start', `/games/${state.gameId}/bomba/start`, {
    token: state.admin, body: { players: TEAMS, act: 1 }, expect: 'ok',
  });
  for (let wave = 0; wave < 3; wave += 1) {
    for (const [index, name] of TEAMS.entries()) {
      await httpAction('bomba-pick', `/games/${state.gameId}/bomba/pick`, {
        token: state.phones[name], body: { playerName: name, cellId: (index + wave) % 10 },
      });
      await sleep(50);
    }
    await sleep(1800);
  }
}

async function roundAirHockey(state, clients) {
  for (let wave = 0; wave < 8; wave += 1) {
    for (const [index, name] of TEAMS.entries()) {
      await stompAction('air-hockey-answer', clients[name], {
        action: 'AIR_HOCKEY_BATTLE_ANSWER',
        playerName: name,
        answerIndex: (index + wave) % 4,
      });
    }
    await sleep(1400);
  }
}

async function roundUltima(state, clients) {
  for (const name of TEAMS) {
    await stompAction('ultima-level', clients[name], {
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: name, kind: 'LEVEL', value: 100,
    });
    await sleep(50);
  }
  await sleep(1200);
  for (const [index, name] of TEAMS.entries()) {
    await stompAction('ultima-answer', clients[name], {
      action: 'ULTIMA_SPIAGGIA_ACTION', playerName: name, kind: 'ANSWER', value: index % 4,
    });
    await sleep(50);
  }
}

async function roundAzzardo(state, clients) {
  for (const name of TEAMS) {
    await stompAction('azzardo-bet', clients[name], {
      action: 'AZZARDO_ACTION', playerName: name, kind: 'BET', value: { chips: [1, 0, 0, 0] },
    });
    await sleep(50);
  }
  await stompAction('azzardo-invalid-chips', clients.Anna, {
    action: 'AZZARDO_ACTION', playerName: 'Anna', kind: 'BET', value: { chips: [6, 6, 6] },
  }, 'rejected');
}

async function roundBlackjack(state, clients) {
  for (let wave = 0; wave < 6; wave += 1) {
    for (const name of TEAMS) {
      await stompAction('blackjack-action', clients[name], {
        action: 'BLACKJACK_ACTION', playerName: name, kind: wave % 2 === 0 ? 'HIT' : 'STAND',
      });
    }
    await sleep(1800);
  }
}

async function roundArena(state, clients) {
  for (const [index, name] of TEAMS.entries()) {
    const question = await httpAction('arena-question', `/games/${state.gameId}/arena-question?category=STORIA&playerId=${encodeURIComponent(name)}`, {
      method: 'GET', token: state.phones[name], expect: 200,
    });
    const questionId = question.json?.questionId;
    if (!questionId) continue;
    await httpAction('arena-answer', `/games/${state.gameId}/arena-answer`, {
      token: state.phones[name],
      body: {
        playerId: name,
        questionId,
        answer: index % 2 === 0 ? 'VERO' : 'FALSO',
        deviceId: name,
        idempotencyKey: `full-arena-${questionId}-${name}`,
      },
      expect: 'ok',
    });
    await sleep(80);
  }
  // token di Anna, playerId Bruno: deve essere rifiutato o non attribuito a Bruno
  await httpAction('arena-cross-player', `/games/${state.gameId}/arena-answer`, {
    token: state.phones.Anna,
    body: { playerId: 'Bruno', questionId: 'inesistente', answer: 'VERO', deviceId: 'Bruno' },
    expect: 400,
  });
}

async function roundSpeedRush(state, clients) {
  const start = await httpAction('speed-rush-start', `/games/${state.gameId}/speed-rush/start`, {
    token: state.admin, body: { players: TEAMS }, expect: 'ok',
  });
  if (start.status !== 200) log(`speed-rush start ${start.status}`);
  await sleep(800);
  await Promise.all(TEAMS.map(async (name) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const task = await httpAction('speed-rush-task', `/games/${state.gameId}/speed-rush/task`, {
        method: 'GET', token: state.phones[name], expect: 200,
      });
      if (task.status !== 200 || !task.json?.taskId) { await sleep(500); continue; }
      const t = task.json;
      let answer = 0;
      const options = t.options ?? t.values ?? t.choices;
      if (Array.isArray(options) && options.length) {
        answer = t.kind === 'colors' ? options.slice(0, 2) : options[0];
      } else if (t.answer !== undefined) {
        answer = t.answer;
      } else if (t.kind === 'math') {
        answer = 0;
      }
      const result = await httpAction('speed-rush-answer', `/games/${state.gameId}/speed-rush/answer`, {
        token: state.phones[name], body: { taskId: t.taskId, answer },
      });
      if (result.status === 409) break;
      await sleep(350);
    }
  }));
  await httpAction('speed-rush-invalid-task', `/games/${state.gameId}/speed-rush/answer`, {
    token: state.phones.Anna, body: { taskId: 'task-inesistente', answer: 0 }, expect: 409,
  });
}

async function bonusCasino(state, clients) {
  const status = clients.admin.statuses.CASINO_STATE;
  const options = status?.options ?? ['ROSSO', 'NERO'];
  for (const name of TEAMS) {
    await stompAction('casino-action', clients[name], {
      action: 'CASINO_ACTION', playerName: name, manche: status?.manche ?? 1, choice: options[0],
    });
    await sleep(60);
  }
}

async function bonusBasket(state, clients) {
  await httpAction('basket-start', `/games/${state.gameId}/basket/start`, {
    token: state.admin, body: { players: TEAMS }, expect: 'ok',
  });
  await sleep(800);
  for (let wave = 0; wave < 3; wave += 1) {
    for (const name of TEAMS) {
      const board = await httpAction('basket-state', `/games/${state.gameId}/basket/state`, {
        method: 'GET', token: state.phones[name], expect: 200,
      });
      const shotId = board.json?.shotId;
      if (!shotId) continue;
      await httpAction('basket-shot', `/games/${state.gameId}/basket/shot`, {
        token: state.phones[name], body: { shotId, pull: 0.5 + wave * 0.1, side: (wave - 1) * 0.2 },
      });
      await sleep(500);
    }
  }
}

async function bonusCavallo(state, clients) {
  const status = clients.admin.statuses.CAVALLO_STATE;
  const category = status?.categories?.[0] ?? 'Cinema';
  for (const name of TEAMS) {
    await stompAction('cavallo-category', clients[name], {
      action: 'CAVALLO_ACTION', playerName: name, kind: 'CATEGORY', value: category,
    });
    await sleep(60);
  }
  await sleep(1200);
  for (const [index, name] of TEAMS.entries()) {
    await stompAction('cavallo-answer', clients[name], {
      action: 'CAVALLO_ACTION', playerName: name, kind: 'ANSWER', value: index % 4,
    });
  }
}

async function bonusBiglie(state, clients) {
  const status = clients.admin.statuses.BIGLIE_STATE;
  const marbles = status?.marbles ?? [];
  for (const [index, name] of TEAMS.entries()) {
    const marble = marbles.find((entry) => !entry.owner) ?? marbles[index];
    if (!marble?.id) continue;
    await stompAction('biglie-pick', clients[name], {
      action: 'BIGLIE_ACTION', playerName: name, kind: 'PICK', value: marble.id,
    });
    await sleep(100);
  }
}

async function run() {
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  const { gameId } = state;
  writeFileSync(`${REPORT_DIR}game-actions.jsonl`, '');
  const admin = new StompClient(state.admin, 'admin', gameId);
  await admin.connect();
  admin.subscribeStatus();
  await sleep(500);

  const clients = { admin };
  for (const name of TEAMS) {
    clients[name] = new StompClient(state.phones[name], name, gameId);
  }

  await sleep(RUN_DELAY_MS);
  for (const name of TEAMS) await clients[name].connect();
  await setupScenario(state, clients);

  const handlers = {
    QUIZ: () => roundQuiz(state, clients),
    MUSIC: () => roundBooking(state, clients, 'MUSIC'),
    IMAGE_BLUR: () => roundBooking(state, clients, 'IMAGE_BLUR'),
    WHEEL_OF_FORTUNE: () => roundBooking(state, clients, 'WHEEL_OF_FORTUNE'),
    TIMELINE: () => roundTimeline(state, clients),
    TIME_BUZZER: () => roundTimeBuzzer(state, clients),
    BOMBA: () => roundBomba(state, clients),
    AIR_HOCKEY_BATTLE: () => roundAirHockey(state, clients),
    ULTIMA_SPIAGGIA: () => roundUltima(state, clients),
    AZZARDO: () => roundAzzardo(state, clients),
    BLACKJACK: () => roundBlackjack(state, clients),
    ARENA: () => roundArena(state, clients),
    SPEED_RUSH: () => roundSpeedRush(state, clients),
  };

  let timeline = null;
  for (let index = 0; index < ROUNDS.length; index += 1) {
    const type = ROUNDS[index];
    log(`round ${index + 1}/${ROUNDS.length}: ${type}`);
    const startedAt = Date.now();
    admin.status({ action: 'ADMIN_START_ROUND' });
    await sleep(3000);
    try {
      const result = await handlers[type]();
      if (type === 'TIMELINE') timeline = result;
    } catch (error) {
      log(`errore handler ${type}: ${error.message}`);
      action({ at: Date.now(), label: `handler-${type}`, transport: 'local', status: 'error', response: error.message });
    }
    // Late answer: una Timeline vecchia inviata nel round successivo deve dare 409.
    if (type === 'TIMELINE' && timeline?.roundId) {
      await httpAction('timeline-late-after-close', `/games/${gameId}/timeline-answer`, {
        token: state.phones.Bruno,
        body: { playerName: 'Bruno', roundId: timeline.roundId, order: timeline.order, idempotencyKey: `late-${Date.now()}` },
        expect: 409,
      });
    }
    // Riconnessione reale di Elena a metà serata.
    if (index === 2) {
      log('fault injection: disconnessione e riconnessione di Elena');
      clients.Elena.close();
      await sleep(1200);
      clients.Elena = new StompClient(state.phones.Elena, 'Elena', gameId);
      await clients.Elena.connect();
      await stompAction('elena-rejoin', clients.Elena, { action: 'JOIN_GAME', playerName: 'Elena' }, 'ok');
    }
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, ROUND_MS - elapsed);
    if (wait) await sleep(wait);
  }

  for (const type of BONUSES) {
    log(`bonus ${type}`);
    admin.status({ action: 'ADMIN_START_BONUS', type });
    await sleep(3000);
    try {
      if (type === 'CASINO') await bonusCasino(state, clients);
      if (type === 'BASKET') await bonusBasket(state, clients);
      if (type === 'CAVALLO') await bonusCavallo(state, clients);
      if (type === 'BIGLIE') await bonusBiglie(state, clients);
    } catch (error) {
      log(`errore bonus ${type}: ${error.message}`);
      action({ at: Date.now(), label: `handler-bonus-${type}`, transport: 'local', status: 'error', response: error.message });
    }
    await sleep(Math.max(2000, BONUS_MS - 3000));
    admin.status({ action: 'ADMIN_STOP_BONUS' });
    await sleep(1500);
  }

  log('FULL_SIMULATION_DONE');
  const summary = {
    gameId,
    players: TEAMS,
    rounds: ROUNDS,
    bonuses: BONUSES,
    actions: actions.length,
    byStatus: actions.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {}),
    byLabel: actions.reduce((acc, entry) => {
      acc[entry.label] = (acc[entry.label] || 0) + 1;
      return acc;
    }, {}),
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(`${REPORT_DIR}game-actions-summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  admin.close();
  for (const name of TEAMS) clients[name]?.close?.();
}

const mode = process.argv[2] || 'run';
if (mode === 'setup') {
  setup().catch((error) => { console.error(error); process.exitCode = 1; });
} else {
  run().catch((error) => { console.error(error); process.exitCode = 1; });
}
