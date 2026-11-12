#!/usr/bin/env node
/**
 * Pilota TV per il run a 8 giocatori.
 *
 * La regia vera (features/tv/game.component.ts) ascolta ADMIN_START_ROUND e
 * apre il round con `generate-ai-round`, poi manda SHOW_QUESTION / START_VOTING
 * ai telefoni. Qui si fa lo stesso senza browser, così il run può girare
 * headless: i telefoni restano quelli veri (STOMP + HTTP dell'harness).
 *
 * Non è un test unitario e non tocca il backend: parla solo con le API che usa
 * già la TV.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.API || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8080/ws-pubgame';
const STATE_PATH = process.env.STATE_PATH || fileURLToPath(new URL('./.state8.json', import.meta.url));

const ROUNDS = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE',
  'TIME_BUZZER', 'BOMBA', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];

const log = (...args) => console.log(`[tv ${new Date().toISOString().slice(11, 19)}]`, ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const gameId = state.gameId;
const token = state.tv;
const PLAYER_COUNT = state.players?.length || Object.keys(state.phones || {}).length || 8;

let categories = [];
let roundIndex = 0;

async function api(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    headers: {
      'X-Session-Token': token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* testo */ }
  return { status: response.status, json, text };
}

function categoryFor(index) {
  if (!categories.length) return 'Storia';
  return categories[index % categories.length];
}

async function loadCategories() {
  const result = await api('/categories');
  const rows = Array.isArray(result.json) ? result.json : [];
  categories = rows.map((row) => String(row?.name ?? '').trim()).filter(Boolean);
  log(`categorie disponibili: ${categories.length}`);
}

async function closeRound() {
  const result = await api(`/games/${gameId}/round/close`, 'POST', { reason: 'skipped' });
  if (result.status !== 200) log(`chiusura round: ${result.status}`);
}

async function openRound(type) {
  const category = encodeURIComponent(categoryFor(roundIndex));
  const result = await api(
    `/games/${gameId}/generate-ai-round?category=${category}&type=${encodeURIComponent(type)}&difficulty=medio`,
  );
  if (result.status !== 200) {
    log(`apertura ${type} fallita: ${result.status} ${String(result.text).slice(0, 160)}`);
    return null;
  }
  return result.json;
}

function bonusState(type) {
  if (type === 'CASINO') return { manche: 1, phase: 'BET', options: ['ROSSO', 'NERO'] };
  if (type === 'CAVALLO') return { phase: 'CATEGORY', categories: ['Cinema'], question: null };
  if (type === 'BIGLIE') {
    return { marbles: Array.from({ length: PLAYER_COUNT }, (_, index) => ({ id: `m${index + 1}` })) };
  }
  return {};
}

let socket;
let buffer = '';

function send(destination, payload) {
  const body = JSON.stringify(payload);
  socket.send(
    `SEND\ndestination:${destination}\ncontent-type:application/json\n` +
    `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
  );
}

function broadcast(payload) {
  send(`/app/game/${gameId}/status`, payload);
}

async function onStatus(message) {
  if (message.action === 'ADMIN_START_ROUND') {
    const type = ROUNDS[roundIndex] ?? 'QUIZ';
    await closeRound();
    const round = await openRound(type);
    if (!round) return;
    roundIndex += 1;
    const payload = typeof round.payload === 'string' ? round.payload : JSON.stringify(round.payload ?? {});
    log(`round ${roundIndex}/${ROUNDS.length}: ${type}`);
    broadcast({
      action: 'SHOW_QUESTION',
      type,
      payload,
      round: roundIndex,
      roundTotal: 13,
    });
    broadcast({
      action: 'START_VOTING',
      type,
      payload,
      round: roundIndex,
      roundTotal: 13,
    });
  } else if (message.action === 'ADMIN_START_BONUS') {
    const type = String(message.type || 'BASKET');
    await closeRound();
    log(`bonus: ${type}`);
    broadcast({ action: `${type}_STATE`, state: bonusState(type) });
  }
}

function connect() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout STOMP pilot')), 15000);
    socket = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
    socket.addEventListener('open', () => {
      socket.send(
        `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n` +
        `X-Session-Token:${token}\n\n\0`,
      );
    });
    socket.addEventListener('message', (event) => {
      buffer += String(event.data);
      let end;
      while ((end = buffer.indexOf('\0')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (frame.startsWith('CONNECTED')) {
          clearTimeout(timer);
          socket.send(`SUBSCRIBE\nid:pilot-status\ndestination:/topic/game/${gameId}/status\n\n\0`);
          log('pilota TV connesso');
          resolve();
          continue;
        }
        if (frame.startsWith('ERROR')) {
          clearTimeout(timer);
          reject(new Error(frame.replace(/\n/g, ' | ').slice(0, 300)));
          continue;
        }
        if (!frame.startsWith('MESSAGE')) continue;
        const split = frame.indexOf('\n\n');
        if (split < 0) continue;
        try {
          const message = JSON.parse(frame.slice(split + 2));
          void onStatus(message);
        } catch { /* frame non JSON */ }
      }
    });
    socket.addEventListener('close', (event) => log(`socket pilota chiusa (${event.code})`));
    socket.addEventListener('error', () => log('errore WebSocket pilota'));
  });
}

(async () => {
  await loadCategories();
  await connect();
  await sleep(1000);
  log(`pronto per la partita ${gameId}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
