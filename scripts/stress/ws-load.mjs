#!/usr/bin/env node
/**
 * Carico WebSocket: N telefoni simulati + TV + admin sulla stessa partita.
 *
 * Riusa il protocollo di `scripts/sim` (STOMP nativo, stesse destinazioni e
 * stesso setup delle sessioni) ma misura ciò che la simulazione non misura:
 * latenza risposta → eco del server, risposte perse e doppioni, con fan-out
 * reale su ogni socket.
 *
 *   API=http://127.0.0.1:8091 WS_URL=ws://127.0.0.1:8091/ws-pubgame \
 *   CONTROL_SECRET=... PLAYERS=20 ROUNDS=3 node scripts/stress/ws-load.mjs
 *
 * Non usa mai il database della serata: crea una partita nuova sul backend a
 * cui punta `API`. Non stampa il segreto.
 */
const API = process.env.API || 'http://127.0.0.1:8091';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8091/ws-pubgame';
const SECRET = process.env.CONTROL_SECRET || '';
const PLAYERS = Math.max(1, Math.min(48, Number(process.env.PLAYERS || 20)));
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 3));
const TIMEOUT_MS = Number(process.env.RESPONSE_TIMEOUT_MS || 5000);

if (SECRET.length < 32) {
  console.error('CONTROL_SECRET mancante o troppo corto (minimo 32 caratteri).');
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const names = Array.from({ length: PLAYERS }, (_, i) => `Phone${String(i + 1).padStart(2, '0')}`);

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
  const result = await api(`/games/${gameId}/session`, 'POST', {
    deviceId, role, playerName: playerName || null, sessionToken: null,
  }, headers);
  if (!result.json?.sessionToken) {
    throw new Error(`sessione ${role}/${playerName}: ${result.status} ${result.text.slice(0, 200)}`);
  }
  return result.json.sessionToken;
}

/** Socket STOMP minima: CONNECT, SUBSCRIBE, SEND e callback sulle consegne. */
class Socket {
  constructor(token, label, gameId, onMessage) {
    this.token = token;
    this.label = label;
    this.gameId = gameId;
    this.onMessage = onMessage;
    this.buffer = '';
    this.connected = false;
    this.errors = [];
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
          if (frame.startsWith('CONNECTED')) {
            clearTimeout(timer);
            this.connected = true;
            this.subscribe('/topic/game/' + this.gameId + '/responses', 'responses');
            this.subscribe('/topic/game/' + this.gameId + '/status', 'status');
            resolve();
            continue;
          }
          if (frame.startsWith('ERROR')) {
            this.errors.push(frame.replace(/\n/g, ' | ').slice(0, 300));
            if (!this.connected) { clearTimeout(timer); reject(new Error(this.errors.at(-1))); }
            continue;
          }
          if (!frame.startsWith('MESSAGE')) continue;
          const split = frame.indexOf('\n\n');
          if (split < 0) continue;
          try { this.onMessage(JSON.parse(frame.slice(split + 2)), this); } catch { /* non JSON */ }
        }
      });
      this.ws.addEventListener('error', () => this.errors.push('errore WebSocket'));
    });
  }

  subscribe(destination, id) {
    this.ws.send(`SUBSCRIBE\nid:${id}-${this.label}\ndestination:${destination}\n\n\0`);
  }

  send(destination, payload) {
    const body = JSON.stringify(payload);
    this.ws.send(
      `SEND\ndestination:${destination}\ncontent-type:application/json\n` +
      `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }

  status(payload) { this.send(`/app/game/${this.gameId}/status`, payload); }
  answer(playerName, index) {
    this.send(`/app/game/${this.gameId}/answer`, { playerName, answerIndex: index, responseTimeMs: 900 });
  }
  close() { try { this.ws?.close(); } catch { /* già chiusa */ } }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

async function main() {
  const startedAt = new Date().toISOString();
  const active = await api('/games/active');
  const bootstrap = await register(Number(active.json?.gameId || 1), 'TV', '', `stress-boot-${Date.now()}`);
  const created = await api('/games', 'POST', {}, { 'X-Session-Token': bootstrap });
  const gameId = Number(created.json?.id);
  if (!gameId) throw new Error(`creazione partita fallita: ${created.status} ${created.text.slice(0, 200)}`);

  const tv = await register(gameId, 'TV', '', `stress-tv-${Date.now()}`);
  const admin = await register(gameId, 'ADMIN', '', `stress-admin-${Date.now()}`);
  await api(`/games/${gameId}/reset`, 'POST', {}, { 'X-Session-Token': admin });
  const tokens = new Map();
  for (const name of names) tokens.set(name, await register(gameId, 'REMOTE', name, `stress-${name}-${Date.now()}`));

  // Attese dell'eco: nome -> istante della prima consegna.
  const arrivals = new Map();
  const duplicates = new Map();
  let errorFrames = 0;
  // Solo la raffica conta: gli invii doppi di prova arrivano dopo e non sono
  // doppioni del server. Il fan-out (ogni socket riceve tutte le risposte) è
  // voluto e non viene contato come duplicato.
  let measuring = false;
  const onMessage = (message, socket) => {
    if (message?.action === 'ERROR') errorFrames++;
    if (!measuring) return;
    const name = message?.playerName;
    if (!name || !tokens.has(name)) return;
    const now = performance.now();
    if (!arrivals.has(name)) arrivals.set(name, now);
    // Un doppione vero è lo stesso messaggio (stesso receivedAt del server)
    // consegnato due volte sulla stessa socket. Il fan-out su socket diverse
    // è il comportamento atteso e non conta.
    const id = `${socket.label}|${name}|${message.receivedAt ?? 'x'}`;
    duplicates.set(id, (duplicates.get(id) || 0) + 1);
  };

  const tvSocket = new Socket(tv, 'TV', gameId, onMessage);
  const adminSocket = new Socket(admin, 'ADMIN', gameId, onMessage);
  await Promise.all([tvSocket.connect(), adminSocket.connect()]);
  const phones = await Promise.all(names.map(async (name) => {
    const socket = new Socket(tokens.get(name), name, gameId, onMessage);
    await socket.connect();
    return socket;
  }));
  await Promise.all(phones.map((socket) => Promise.resolve(socket.status({ action: 'JOIN_GAME', playerName: socket.label }))));
  await sleep(1200);

  const rounds = [];
  for (let round = 0; round < ROUNDS; round++) {
    arrivals.clear();
    duplicates.clear();
    // La regia vera apre il round via HTTP: la TV chiama questo endpoint e poi
    // annuncia lo stato. Senza, il round resta CREATED.
    const opened = await api(`/games/${gameId}/round`, 'POST', undefined,
      { 'X-Session-Token': admin });
    if (opened.status >= 400) throw new Error(`apertura round ${opened.status}: ${opened.text.slice(0, 160)}`);
    await sleep(2500);
    const t0 = performance.now();
    measuring = true;
    for (const [index, socket] of phones.entries()) socket.answer(socket.label, index % 4);
    const deadline = t0 + TIMEOUT_MS;
    while (arrivals.size < names.length && performance.now() < deadline) await sleep(10);
    measuring = false;
    const latencies = names.filter((n) => arrivals.has(n)).map((n) => arrivals.get(n) - t0).sort((a, b) => a - b);
    rounds.push({
      round: round + 1,
      players: names.length,
      delivered: latencies.length,
      lost: names.length - latencies.length,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.round(latencies.at(-1) * 100) / 100 : null,
      duplicates: [...duplicates.values()].filter((count) => count > 1).reduce((sum, n) => sum + n - 1, 0),
    });
    // Doppio invio dello stesso giocatore: il server deve gestirlo senza errori.
    phones[0].answer(phones[0].label, 0);
    phones[0].answer(phones[0].label, 0);
    await sleep(400);
    adminSocket.status({ action: 'ROUND_ENDED' });
    await sleep(600);
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    api: API,
    gameId,
    players: names.length,
    rounds,
    errorFrames,
    serverErrors: [...tvSocket.errors, ...adminSocket.errors, ...phones.flatMap((p) => p.errors)].slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));
  phones.forEach((p) => p.close());
  tvSocket.close();
  adminSocket.close();
}

main().catch((error) => {
  console.error(`stress:ws fallito: ${error.message}`);
  process.exitCode = 1;
});
