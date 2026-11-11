#!/usr/bin/env node
/**
 * Regia della simulazione: crea partita + sessioni e comanda la TV via STOMP.
 *
 * Uso:
 *   node scripts/sim/match.mjs setup   # crea partita/sessioni e stampa l'URL
 *   node scripts/sim/match.mjs run     # 13 round + 4 bonus
 *
 * Non stampa mai CONTROL_SECRET. I token di sessione finiscono nell'URL della
 * pagina di prova: è una simulazione locale, non una configurazione da pub.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.API || 'http://127.0.0.1:18080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:18080/ws-pubgame';
const STATE_PATH = process.env.STATE_PATH || fileURLToPath(new URL('./.state.json', import.meta.url));
const TEAMS = ['Anna', 'Bruno', 'Carla', 'Dario'];
const ROUNDS = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE',
  'TIME_BUZZER', 'BOMBA', 'AIR_HOCKEY_BATTLE', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH',
];
const ROUND_MS = Number(process.env.ROUND_MS || 10500);
const BONUS_MS = Number(process.env.BONUS_MS || 9000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(`[sim ${new Date().toISOString().slice(11, 19)}]`, ...args);

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
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function register(gameId, role, playerName, deviceId, secret) {
  const headers = role === 'REMOTE' ? {} : { 'X-Control-Secret': secret };
  const published = await api(`/games/${gameId}/session`, 'POST', {
    deviceId,
    role,
    playerName: playerName || null,
    sessionToken: null,
  }, headers);
  if (!published?.sessionToken) throw new Error(`sessione ${role} senza token`);
  return published.sessionToken;
}

async function setup() {
  const secret = controlSecret();
  if (secret.length < 32) throw new Error('CONTROL_SECRET assente o troppo corto in deploy/.env');

  // Ogni run parte da una partita nuova: le sessioni delle prove precedenti
  // non possono occupare i nomi delle squadre. La creazione richiede una
  // sessione TV, che apriamo sulla partita attiva solo per firmare la richiesta.
  const active = await api('/games/active');
  const activeId = Number(active?.gameId || 1);
  if (!Number.isFinite(activeId) || activeId < 1) throw new Error('partita attiva non disponibile');

  const forced = Number(process.env.GAME_ID || 0);
  let gameId = forced;
  if (!(gameId > 0)) {
    const bootstrap = await register(activeId, 'TV', '', 'sim-bootstrap-tv', secret);
    const created = await api('/games', 'POST', {}, { 'X-Session-Token': bootstrap });
    gameId = Number(created?.id);
    if (!Number.isFinite(gameId) || gameId < 1) throw new Error('creazione partita non riuscita');
  }

  const tv = await register(gameId, 'TV', '', 'sim-tv', secret);
  const admin = await register(gameId, 'ADMIN', '', 'sim-admin', secret);
  await api(`/games/${gameId}/reset`, 'POST', {}, { 'X-Session-Token': admin });
  const phones = {};
  for (const name of TEAMS) {
    phones[name] = await register(gameId, 'REMOTE', name, `sim-${name.toLowerCase()}`, secret);
  }

  const params = new URLSearchParams({ game: String(gameId), watch: TEAMS[0] });
  params.set('tv', tv);
  params.set('admin', admin);
  for (const name of TEAMS) params.set(name.toLowerCase(), phones[name]);
  const url = `http://localhost:18080/sim-duo.html?${params.toString()}`;

  writeFileSync(STATE_PATH, JSON.stringify({
    gameId,
    admin,
    phones,
    url,
    createdAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });

  log(`setup completato: partita ${gameId}, ${TEAMS.length} telefoni + TV + admin`);
  log(`url: ${url}`);
  console.log(`SIM_URL=${url}`);
}

class AdminStomp {
  constructor(token) {
    this.token = token;
    this.ws = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout STOMP admin')), 12000);
      this.ws = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
      this.ws.addEventListener('open', () => {
        this.ws.send(
          `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n` +
          `X-Session-Token:${this.token}\n\n\0`,
        );
      });
      this.ws.addEventListener('message', (event) => {
        const frame = String(event.data);
        if (frame.startsWith('CONNECTED')) {
          clearTimeout(timer);
          this.connected = true;
          log('STOMP admin connesso');
          resolve();
        } else if (frame.startsWith('ERROR')) {
          clearTimeout(timer);
          reject(new Error(frame.replace(/\n/g, ' | ').slice(0, 500)));
        }
      });
      this.ws.addEventListener('error', () => log('errore WebSocket admin'));
      this.ws.addEventListener('close', (event) => {
        if (!this.connected) {
          clearTimeout(timer);
          reject(new Error(`socket admin chiusa (${event.code})`));
        } else {
          log('socket admin chiusa', event.code);
        }
      });
    });
  }

  send(payload) {
    if (!this.connected) throw new Error('STOMP admin non connesso');
    const body = JSON.stringify(payload);
    this.ws.send(
      `SEND\ndestination:/app/game/${this.state.gameId}/status\ncontent-type:application/json\n` +
      `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }
}

class PlayerStomp extends AdminStomp {
  constructor(token, name) {
    super(token);
    this.name = name;
  }

  async join() {
    await this.connect();
    this.send({ action: 'JOIN_GAME', playerName: this.name });
    log(`telefono ${this.name} entrato in partita`);
  }
}

async function run() {
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  const admin = new AdminStomp(state.admin);
  admin.state = state;
  await admin.connect();

  // La pagina è già aperta: diamo alla TV il tempo di fare sync e alle
  // sessioni dei telefoni di comparire nella diagnostica.
  await sleep(Number(process.env.RUN_DELAY_MS || 6000));

  // Senza un telefono fisico per squadra, ogni giocatore entra via STOMP con
  // il proprio token: è lo stesso JOIN_GAME che manda il pulsante "PRENOTATI".
  const players = Object.entries(state.phones || {}).map(([name, token]) => {
    const player = new PlayerStomp(token, name);
    player.state = state;
    return player;
  });
  for (const player of players) {
    try {
      await player.join();
    } catch (error) {
      log(`join ${player.name} fallita: ${error.message}`);
    }
  }
  await sleep(2000);

  for (let index = 0; index < ROUNDS.length; index += 1) {
    log(`round ${index + 1}/${ROUNDS.length}: ${ROUNDS[index]} — PARTI`);
    admin.send({ action: 'ADMIN_START_ROUND' });
    await sleep(ROUND_MS);
  }

  for (const type of ['CASINO', 'BASKET', 'CAVALLO', 'BIGLIE']) {
    log(`bonus: ${type}`);
    admin.send({ action: 'ADMIN_START_BONUS', type });
    await sleep(BONUS_MS);
    admin.send({ action: 'ADMIN_STOP_BONUS' });
    await sleep(2200);
  }

  log('SIMULATION_DONE');
  await sleep(1500);
  admin.ws.close();
  for (const player of players) player.ws?.close();
}

const mode = process.argv[2] || 'run';
if (mode === 'setup') {
  setup().catch((error) => { console.error(error); process.exitCode = 1; });
} else {
  run().catch((error) => { console.error(error); process.exitCode = 1; });
}
