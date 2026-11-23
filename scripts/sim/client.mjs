#!/usr/bin/env node
/**
 * Pezzi comuni a `scripts/sim` e `scripts/stress`: chiamate HTTP, registrazione
 * delle sessioni, setup di una partita di prova e client STOMP nativo.
 *
 * Non contiene regole di gioco: parla agli stessi canali del telefono
 * (`/app/game/{id}/status` e `/answer`, topic `status` e `responses`).
 */
import { readFileSync } from 'node:fs';

export const DEFAULT_API = 'http://127.0.0.1:8080';
export const DEFAULT_WS = 'ws://127.0.0.1:8080/ws-pubgame';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `fetch` verso `base` con timeout e corpo JSON già sciolto. */
export function apiClient(base) {
  return async function api(path, method = 'GET', body, headers = {}) {
    const response = await fetch(base + path, {
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
  };
}

export const api = apiClient(process.env.API || DEFAULT_API);

/** Segreto di regia da env o da `deploy/.env` (mai stampato). */
export function controlSecret() {
  if (process.env.CONTROL_SECRET) return process.env.CONTROL_SECRET;
  const env = readFileSync(new URL('../../deploy/.env', import.meta.url), 'utf8');
  const line = env.split(/\r?\n/).find((row) => row.startsWith('CONTROL_SECRET='));
  return line ? line.slice('CONTROL_SECRET='.length) : '';
}

/** Registra un dispositivo e restituisce il suo token di sessione. */
export async function register(gameId, role, playerName, deviceId, secret, call = api) {
  const headers = role === 'REMOTE' ? {} : { 'X-Control-Secret': secret };
  const published = await call(`/games/${gameId}/session`, 'POST', {
    deviceId,
    role,
    playerName: playerName || null,
    sessionToken: null,
  }, headers);
  if (!published.json?.sessionToken) {
    throw new Error(`sessione ${role}/${playerName} senza token: ${published.status} ${published.text.slice(0, 200)}`);
  }
  return published.json.sessionToken;
}

/**
 * Crea una partita nuova con TV, admin e un telefono per nome.
 * Restituisce `{ gameId, tv, admin, phones, players }`.
 */
export async function setupGame({
  players,
  devicePrefix = 'sim',
  secret = controlSecret(),
  call = api,
} = {}) {
  if (!secret || secret.length < 32) throw new Error('CONTROL_SECRET assente o troppo corto (minimo 32 caratteri)');
  if (!players?.length) throw new Error('setupGame: serve almeno un giocatore');
  const active = await call('/games/active');
  const activeId = Number(active.json?.gameId || 1);
  const bootstrap = await register(activeId, 'TV', '', `${devicePrefix}-bootstrap-tv`, secret, call);
  const created = await call('/games', 'POST', {}, { 'X-Session-Token': bootstrap });
  const gameId = Number(created.json?.id);
  if (!gameId) throw new Error(`creazione partita fallita: ${created.status} ${created.text.slice(0, 200)}`);
  const tv = await register(gameId, 'TV', '', `${devicePrefix}-tv`, secret, call);
  const admin = await register(gameId, 'ADMIN', '', `${devicePrefix}-admin`, secret, call);
  await call(`/games/${gameId}/reset`, 'POST', {}, { 'X-Session-Token': admin });
  const phones = {};
  for (const name of players) {
    phones[name] = await register(gameId, 'REMOTE', name, `${devicePrefix}-${name.toLowerCase()}`, secret, call);
  }
  return { gameId, tv, admin, phones, players };
}

/** Client STOMP minimo: CONNECT, SUBSCRIBE, SEND e callback sulle consegne. */
export class StompClient {
  /**
   * @param {string} token token di sessione
   * @param {string} label nome leggibile (giocatore, TV, admin)
   * @param {number} gameId partita
   * @param {{url?: string, topics?: string[], onMessage?: Function, logState?: boolean, log?: Function}} options
   *   `topics`: suffissi sottoscritti alla connessione, es. `['status', 'responses']`.
   */
  constructor(token, label, gameId, options = {}) {
    const { url = process.env.WS_URL || DEFAULT_WS, topics = [], onMessage = null, logState = false, log = () => {} } = options;
    this.token = token;
    this.label = label;
    this.gameId = gameId;
    this.url = url;
    this.topics = topics;
    this.onMessage = onMessage;
    this.logState = logState;
    this.log = log;
    this.ws = null;
    this.connected = false;
    this.closing = false;
    this.buffer = '';
    this.statuses = {};
    this.errors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout STOMP ${this.label}`)), 15000);
      this.ws = new WebSocket(this.url, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
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
      this.ws.addEventListener('error', () => {
        this.errors.push('errore WebSocket');
        this.log(`errore WebSocket ${this.label}`);
      });
      this.ws.addEventListener('close', (event) => {
        this.connected = false;
        if (this.closing) return;
        this.log(`socket ${this.label} chiusa (${event.code})`);
      });
    });
  }

  handleFrame(frame, timer, resolve, reject) {
    if (frame.startsWith('CONNECTED')) {
      clearTimeout(timer);
      this.connected = true;
      this.log(`STOMP ${this.label} connesso`);
      for (const topic of this.topics) this.subscribe(`/topic/game/${this.gameId}/${topic}`, topic);
      resolve();
      return;
    }
    if (frame.startsWith('ERROR')) {
      clearTimeout(timer);
      const message = frame.replace(/\n/g, ' | ').slice(0, 500);
      this.errors.push(message);
      this.log(`STOMP ${this.label} ERROR: ${message}`);
      reject(new Error(message));
      return;
    }
    if (!frame.startsWith('MESSAGE')) return;
    const split = frame.indexOf('\n\n');
    if (split < 0) return;
    let json;
    try { json = JSON.parse(frame.slice(split + 2)); } catch { return; }
    if (json?.action) this.statuses[json.action] = json;
    if (this.logState && json?.action?.endsWith('_STATE')) this.log(`${this.label} stato ${json.action}`);
    this.onMessage?.(json, this);
  }

  subscribe(destination, id) {
    this.ws.send(`SUBSCRIBE\nid:${id}-${this.label}\ndestination:${destination}\n\n\0`);
  }

  subscribeStatus() {
    this.subscribe(`/topic/game/${this.gameId}/status`, 'status');
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

export function parseJson(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

/** Apre una socket per ogni telefono e la lascia connessa. */
export async function connectPhones(gameId, phones, options = {}) {
  const clients = [];
  for (const [name, token] of Object.entries(phones)) {
    const client = new StompClient(token, name, gameId, options);
    await client.connect();
    clients.push(client);
  }
  return clients;
}

export { sleep };
