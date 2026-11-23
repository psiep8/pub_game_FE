#!/usr/bin/env node
/**
 * Persistenza sotto crash: fotografa lo stato a metà round, aspetta che il
 * backend torni su dopo un kill -9 e confronta round, punteggi e classifica.
 *
 *   API=... CONTROL_SECRET=... PLAYERS=4 node scripts/stress/restart-check.mjs start
 *   # kill -9 del backend, poi riavvio
 *   API=... node scripts/stress/restart-check.mjs verify
 *
 * `start` scrive un file di stato con i token di prova (mai usare contro il
 * database della serata). Il confronto ignora presenza, orologi e sessioni:
 * sono volatili per definizione.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API || 'http://127.0.0.1:8091';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8091/ws-pubgame';
const SECRET = process.env.CONTROL_SECRET || '';
const PLAYERS = Math.max(1, Math.min(20, Number(process.env.PLAYERS || 4)));
const STATE_PATH = process.env.STRESS_STATE || join(tmpdir(), 'pubgame-stress-state.json');
const WAIT_MS = Number(process.env.WAIT_MS || 60000);
const KEYS = ['version', 'status', 'roundIndex', 'paused', 'hasState', 'scores', 'leaderboard', 'seq'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  try { json = text ? JSON.parse(text) : null; } catch { /* non JSON */ }
  return { status: response.status, text, json };
}

async function register(gameId, role, playerName, deviceId) {
  const headers = role === 'REMOTE' ? {} : { 'X-Control-Secret': SECRET };
  const result = await api(`/games/${gameId}/session`, 'POST',
    { deviceId, role, playerName: playerName || null, sessionToken: null }, headers);
  if (!result.json?.sessionToken) throw new Error(`sessione ${role}: ${result.status}`);
  return result.json.sessionToken;
}

async function facts(adminToken) {
  const headers = { 'X-Session-Token': adminToken };
  const state = await api(`/games/${STATE.gameId}/state`, 'GET', undefined, headers);
  if (state.status !== 200) throw new Error(`state ${state.status}: ${state.text.slice(0, 160)}`);
  const snapshot = state.json || {};
  const picked = {};
  for (const key of KEYS) if (snapshot[key] !== undefined) picked[key] = snapshot[key];
  const sync = await api(`/games/${STATE.gameId}/sync?sinceSeq=-1`, 'GET', undefined, headers);
  return { facts: picked, toSeq: sync.json?.toSeq ?? null };
}

let STATE = {};

function firstDifference(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const diff = firstDifference(before[key], after[key], `${path}.${key}`);
      if (diff) return diff;
    }
  }
  return `${path || '(radice)'}: prima=${JSON.stringify(before)?.slice(0, 160)} dopo=${JSON.stringify(after)?.slice(0, 160)}`;
}

async function start() {
  if (SECRET.length < 32) throw new Error('CONTROL_SECRET mancante');
  const active = await api('/games/active');
  const bootstrap = await register(Number(active.json?.gameId || 1), 'TV', '', `restart-boot-${Date.now()}`);
  const created = await api('/games', 'POST', {}, { 'X-Session-Token': bootstrap });
  const gameId = Number(created.json?.id);
  if (!gameId) throw new Error(`creazione partita fallita: ${created.status}`);
  const admin = await register(gameId, 'ADMIN', '', `restart-admin-${Date.now()}`);
  await api(`/games/${gameId}/reset`, 'POST', {}, { 'X-Session-Token': admin });
  const names = Array.from({ length: PLAYERS }, (_, i) => `Crash${i + 1}`);
  const phones = [];
  for (const name of names) {
    phones.push({ name, token: await register(gameId, 'REMOTE', name, `restart-${name}-${Date.now()}`) });
  }
  STATE = { gameId, admin };
  // Apre un round e fa rispondere i telefoni via STOMP, come il gioco vero.
  const ws = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout STOMP')), 12000);
    let buffer = '';
    ws.addEventListener('open', () => ws.send(
      `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\nX-Session-Token:${admin}\n\n\0`));
    ws.addEventListener('message', (event) => {
      buffer += String(event.data);
      let end;
      while ((end = buffer.indexOf('\0')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (frame.startsWith('CONNECTED')) { clearTimeout(timer); resolve(); }
      }
    });
  });
  const send = (destination, payload) => {
    const body = JSON.stringify(payload);
    ws.send(`SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${Buffer.byteLength(body)}\n\n${body}\0`);
  };
  const opened = await api(`/games/${gameId}/round`, 'POST', undefined, { 'X-Session-Token': admin });
  if (opened.status >= 400) throw new Error(`apertura round ${opened.status}`);
  await sleep(2500);
  for (const [index, phone] of phones.entries()) {
    send(`/app/game/${gameId}/answer`, { playerName: phone.name, answerIndex: index % 4, responseTimeMs: 800 });
  }
  await sleep(1500);

  const before = await facts(admin);
  STATE = { gameId, admin, phones: phones.map((p) => p.name), before, dumpedAt: new Date().toISOString() };
  writeFileSync(STATE_PATH, JSON.stringify(STATE, null, 2), { mode: 0o600 });
  ws.close();
  console.log(JSON.stringify({ gameId, players: names.length, statePath: STATE_PATH, before }, null, 2));
}

async function waitHealthy() {
  const started = Date.now();
  while (Date.now() - started < WAIT_MS) {
    try {
      const health = await api('/health');
      if (health.status === 200) return Date.now() - started;
    } catch { /* non ancora su */ }
    await sleep(250);
  }
  throw new Error(`backend non tornato su entro ${WAIT_MS} ms`);
}

async function verify() {
  STATE = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  const recoveryMs = await waitHealthy();
  const after = await facts(STATE.admin);
  const diff = firstDifference(STATE.before.facts, after.facts, 'snapshot');
  const report = {
    gameId: STATE.gameId,
    recoveryMs,
    seqBefore: STATE.before.toSeq,
    seqAfter: after.toSeq,
    identical: diff === null,
    difference: diff,
  };
  console.log(JSON.stringify(report, null, 2));
  if (diff) process.exitCode = 1;
}

const mode = process.argv[2];
if (mode === 'start') start().catch((error) => { console.error(error.message); process.exitCode = 1; });
else if (mode === 'verify') verify().catch((error) => { console.error(error.message); process.exitCode = 1; });
else {
  console.error('Uso: restart-check.mjs start|verify');
  process.exitCode = 2;
}
