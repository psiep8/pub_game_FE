#!/usr/bin/env node
/**
 * Carico WebSocket: N telefoni simulati + TV + admin sulla stessa partita.
 *
 * Riusa il protocollo e il setup di `scripts/sim` (modulo `sim/client.mjs`:
 * STOMP nativo, stesse destinazioni, stessa creazione delle sessioni) e misura
 * ciò che la simulazione non misura: latenza risposta → eco del server,
 * risposte perse e doppioni, con fan-out reale su ogni socket.
 *
 *   API=http://127.0.0.1:8091 WS_URL=ws://127.0.0.1:8091/ws-pubgame \
 *   CONTROL_SECRET=... PLAYERS=20 ROUNDS=3 node scripts/stress/ws-load.mjs
 *
 * Non usa mai il database della serata: crea una partita nuova sul backend a
 * cui punta `API`. Non stampa il segreto.
 */
import { apiClient, setupGame, sleep, StompClient } from '../sim/client.mjs';

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

const api = apiClient(API);
const names = Array.from({ length: PLAYERS }, (_, i) => `Phone${String(i + 1).padStart(2, '0')}`);

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

async function main() {
  const startedAt = new Date().toISOString();
  const { gameId, tv, admin, phones: tokens } = await setupGame({
    players: names,
    devicePrefix: 'stress',
    secret: SECRET,
    call: api,
  });

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
    if (!name || !tokens[name]) return;
    const now = performance.now();
    if (!arrivals.has(name)) arrivals.set(name, now);
    // Un doppione vero è lo stesso messaggio (stesso receivedAt del server)
    // consegnato due volte sulla stessa socket. Il fan-out su socket diverse
    // è il comportamento atteso e non conta.
    const id = `${socket.label}|${name}|${message.receivedAt ?? 'x'}`;
    duplicates.set(id, (duplicates.get(id) || 0) + 1);
  };

  const socketOptions = { url: WS, topics: ['responses', 'status'], onMessage };
  const tvSocket = new StompClient(tv, 'TV', gameId, socketOptions);
  const adminSocket = new StompClient(admin, 'ADMIN', gameId, socketOptions);
  await Promise.all([tvSocket.connect(), adminSocket.connect()]);
  const phones = await Promise.all(names.map(async (name) => {
    const socket = new StompClient(tokens[name], name, gameId, socketOptions);
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
    // ROUND_ENDED è un'azione TV (ADMIN_ACTIONS non la contiene): la manda la TV.
    tvSocket.status({ action: 'ROUND_ENDED' });
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
