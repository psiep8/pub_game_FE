// Prova prenotazione e risposta simultanea con telefoni simulati via STOMP.
// Nessun token viene stampato: lo script legge .state.json e logga solo esiti.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(here, '.state.json');
const WS = process.env.WS_URL || 'ws://127.0.0.1:8080/ws-pubgame';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

class Stomp {
  constructor(token, label) {
    this.token = token;
    this.label = label;
    this.connected = false;
    this.frames = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout STOMP ${this.label}`)), 12000);
      this.ws = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
      this.ws.addEventListener('open', () => {
        this.ws.send(
          `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n` +
            `X-Session-Token:${this.token}\n\n\0`,
        );
      });
      this.ws.addEventListener('message', (event) => {
        const frame = String(event.data);
        this.frames.push(frame);
        if (frame.startsWith('CONNECTED')) {
          clearTimeout(timer);
          this.connected = true;
          resolve();
        } else if (frame.startsWith('ERROR')) {
          clearTimeout(timer);
          reject(new Error(frame.replace(/\n/g, ' | ').slice(0, 300)));
        }
      });
      this.ws.addEventListener('close', (e) => {
        if (!this.connected) {
          clearTimeout(timer);
          reject(new Error(`socket ${this.label} chiusa (${e.code})`));
        }
      });
    });
  }

  send(gameId, payload) {
    if (!this.connected) throw new Error(`${this.label} non connesso`);
    const body = JSON.stringify(payload);
    this.ws.send(
      `SEND\ndestination:/app/game/${gameId}/status\ncontent-type:application/json\n` +
        `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }

  close() {
    this.ws?.close();
  }
}

async function main() {
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  const gameId = state.gameId;
  const phones = Object.entries(state.phones || {});
  if (phones.length < 2) throw new Error('servono almeno 2 telefoni nello stato');

  const admin = new Stomp(state.admin, 'admin');
  await admin.connect();
  log(`admin connesso alla partita ${gameId}`);

  // 1) Prenotazione: ogni telefono entra con il proprio token (come il pulsante PRENOTATI).
  const players = phones.map(([name, token]) => new Stomp(token, name));
  for (const p of players) {
    try {
      await p.connect();
      p.send(gameId, { action: 'JOIN_GAME', playerName: p.label });
      log(`prenotazione: ${p.label} OK`);
    } catch (e) {
      log(`prenotazione: ${p.label} FALLITA: ${e.message}`);
    }
  }
  await sleep(1500);

  // 2) Round aperto dall'admin.
  admin.send(gameId, { action: 'ADMIN_START_ROUND' });
  log('round avviato');
  await sleep(1000);

  // 3) Risposta simultanea: tutti i telefoni (prenotati) premono nello stesso istante.
  const connected = players.filter((p) => p.connected);
  const answerAction = process.env.ANSWER_ACTION || 'JOIN_GAME';
  await Promise.all(connected.map((p) => {
    p.send(gameId, { action: answerAction, playerName: p.label });
    return Promise.resolve();
  }));
  log(`risposta simultanea inviata da ${connected.length} telefoni`);
  await sleep(1500);

  // 4) Esito dall'admin: prima CORRETTO, poi SBAGLIATO su un nuovo round.
  admin.send(gameId, { action: 'ADMIN_CONFIRM_CORRECT' });
  log('admin: CORRETTO inviato');
  await sleep(1500);
  admin.send(gameId, { action: 'ADMIN_START_ROUND' });
  await sleep(1000);
  admin.send(gameId, { action: 'ADMIN_CONFIRM_WRONG' });
  log('admin: SBAGLIATO inviato');
  await sleep(1500);

  for (const p of players) p.close();
  admin.close();
  log('PROVA COMPLETATA');
}

main().catch((e) => {
  console.error('ERRORE:', e.message);
  process.exitCode = 1;
});
