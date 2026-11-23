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
 *
 * Risposte via STOMP con la socket di ogni telefono, non con quella dell'admin:
 * il server accetta `/answer` solo dal ruolo REMOTE e solo per il proprio
 * giocatore, quindi un token admin non registrerebbe alcun punteggio.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiClient, setupGame, sleep, StompClient } from '../sim/client.mjs';

const API = process.env.API || 'http://127.0.0.1:8091';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8091/ws-pubgame';
const SECRET = process.env.CONTROL_SECRET || '';
const PLAYERS = Math.max(1, Math.min(20, Number(process.env.PLAYERS || 4)));
const STATE_PATH = process.env.STRESS_STATE || join(tmpdir(), 'pubgame-stress-state.json');
const WAIT_MS = Number(process.env.WAIT_MS || 60000);
const SETTLE_MS = Math.max(0, Number(process.env.SETTLE_MS || 1500));
const KEYS = ['version', 'status', 'roundIndex', 'paused', 'hasState', 'scores', 'leaderboard', 'seq'];

const api = apiClient(API);

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
  const names = Array.from({ length: PLAYERS }, (_, i) => `Crash${i + 1}`);
  const { gameId, tv, admin, phones } = await setupGame({
    players: names,
    devicePrefix: 'restart',
    secret: SECRET,
    call: api,
  });
  STATE = { gameId, admin };

  const sockets = [];
  for (const name of names) {
    const socket = new StompClient(phones[name], name, gameId, { url: WS });
    await socket.connect();
    sockets.push(socket);
  }

  const opened = await api(`/games/${gameId}/round`, 'POST', undefined, { 'X-Session-Token': admin });
  if (opened.status >= 400) throw new Error(`apertura round ${opened.status}`);
  await sleep(1500);
  for (const [index, socket] of sockets.entries()) socket.answer(socket.label, index % 4, 800);
  // Le risposte STOMP finiscono su /responses (eco alla TV), non nello stato.
  // I punti veri passano dal voto REST autenticato, come fa il telefono.
  const roundStartId = opened.json?.roundStartId || '';
  // Senza l'annuncio della manche la TV non accetta voti: è il primo passo
  // della sequenza vera (quiz/manche → quiz/answer).
  const manche = await api(`/games/${gameId}/quiz/manche`, 'POST', { manche: 0, roundStartId },
    { 'X-Session-Token': tv });
  let accepted = 0;
  const voteErrors = [];
  for (const [index, name] of names.entries()) {
    const vote = await api(`/games/${gameId}/quiz/answer`, 'POST', {
      optionIndex: index % 2,
      manche: 0,
      roundStartId,
    }, { 'X-Session-Token': phones[name] });
    if (vote.status === 200) accepted++;
    else if (voteErrors.length < 2) voteErrors.push(`${vote.status}: ${vote.text.slice(0, 120)}`);
  }
  // La TV salva l'istantanea della classifica dopo ogni variazione di punti.
  const entries = names.map((name, index) => ({
    playerName: name,
    totalPoints: (names.length - index) * 100,
    correctAnswers: 1,
    wrongAnswers: 0,
    position: index + 1,
  }));
  const saved = await api(`/games/${gameId}/leaderboard`, 'PUT', { entries }, { 'X-Session-Token': tv });
  if (saved.status >= 400) throw new Error(`classifica ${saved.status}: ${saved.text.slice(0, 160)}`);
  await sleep(SETTLE_MS);

  const before = await facts(admin);
  const scored = Object.keys(before.facts.scores || {}).length;
  const ranked = (before.facts.leaderboard || []).length;
  if (!scored && !ranked) {
    throw new Error(`stato di prova vuoto (manche ${manche.status}${voteErrors.length ? `, voto ${voteErrors[0]}` : ''})`);
  }
  STATE = { gameId, admin, phones: names, before, accepted, scored, ranked, dumpedAt: new Date().toISOString() };
  writeFileSync(STATE_PATH, JSON.stringify(STATE, null, 2), { mode: 0o600 });
  sockets.forEach((socket) => socket.close());
  console.log(JSON.stringify({ gameId, players: names.length, accepted, scored, ranked, statePath: STATE_PATH, before }, null, 2));
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
    scoredBeforeCrash: STATE.scored ?? null,
    rankedBeforeCrash: STATE.ranked ?? null,
    acceptedVotes: STATE.accepted ?? null,
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
if (mode === 'start') start().catch((error) => { console.error(error.message); process.exit(1); });
else if (mode === 'verify') verify().catch((error) => { console.error(error.message); process.exit(1); });
else {
  console.error('Uso: restart-check.mjs start|verify');
  process.exitCode = 2;
}
