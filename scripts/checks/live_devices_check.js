// Prova dal vivo con 4 telefoni simulati + 1 admin, contro il backend avviato.
//
// I telefoni parlano lo stesso protocollo dell'app: STOMP su /ws-pubgame per
// JOIN_GAME e gli eventi dei giochi simultanei, REST per Arena/Timeline/Prezzo.
// L'admin ascolta i topic e conferma la risposta dei giochi a prenotazione.
//
// Uso: node scripts/checks/live_devices_check.js
// Variabili: API (default http://127.0.0.1:8080), WS_URL, GAME_ID.

const API = process.env.API || 'http://127.0.0.1:8080';
const WS_URL = process.env.WS_URL || 'ws://127.0.0.1:8080/ws-pubgame';
const GAME_ID = Number(process.env.GAME_ID || 1);
const TEAMS = ['Rossi', 'Blu', 'Verdi', 'Gialli'];

const t0 = Date.now();
const log = (...args) =>
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`, ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

class Stomp {
  constructor(name) {
    this.name = name;
    this.subId = 0;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
      const timer = setTimeout(() => reject(new Error(`timeout STOMP ${this.name}`)), 10000);

      this.ws.addEventListener('open', () => {
        this.raw('CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n\n\0');
      });
      this.ws.addEventListener('message', (event) => this.onData(String(event.data)));
      this.ws.addEventListener('error', () => log(this.name, 'errore WebSocket'));
      this.ws.addEventListener('close', (event) =>
        log(this.name, 'socket chiusa', event.code, event.reason || ''),
      );
      this.onConnected = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  raw(frame) {
    this.ws.send(frame);
  }

  onData(data) {
    for (const chunk of data.split('\0')) {
      const frame = chunk.replace(/^\n+/, '');
      if (!frame) continue;

      if (frame.startsWith('CONNECTED')) {
        this.connected = true;
        log(this.name, 'STOMP connesso');
        this.onConnected?.();
        continue;
      }
      if (frame.startsWith('ERROR')) {
        log(this.name, 'STOMP ERROR:', frame.replace(/\n/g, ' | ').slice(0, 300));
        continue;
      }
      if (!frame.startsWith('MESSAGE')) continue;

      const split = frame.indexOf('\n\n');
      if (split < 0) continue;
      const headers = frame.slice(0, split).split('\n');
      const body = frame.slice(split + 2);
      let destination = '';
      for (const header of headers) {
        if (header.startsWith('destination:')) destination = header.slice('destination:'.length);
      }
      let message = null;
      try {
        message = JSON.parse(body);
      } catch {
        message = { rawBody: body };
      }
      this.onMessage?.(destination, message);
    }
  }

  subscribe(destination) {
    this.raw(`SUBSCRIBE\nid:sub-${this.subId++}\ndestination:${destination}\nack:auto\n\n\0`);
  }

  send(destination, payload) {
    const body = JSON.stringify(payload);
    this.raw(
      `SEND\ndestination:${destination}\ncontent-type:application/json\n` +
        `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }
}

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function playRound(team, stomp, message) {
  const type = message.type;
  const payload = parsePayload(message.payload);
  log(team, `gioca ${type}`);

  switch (type) {
    case 'QUIZ':
    case 'TRUE_FALSE':
    case 'ROULETTE':
    case 'CHRONO': {
      const index = type === 'CHRONO' ? 1980 : Math.floor(Math.random() * 2);
      stomp.send(`/app/game/${GAME_ID}/answer`, {
        playerName: team,
        answerIndex: index,
        responseTimeMs: 1200 + Math.floor(Math.random() * 900),
      });
      break;
    }

    case 'MUSIC':
    case 'IMAGE_BLUR':
    case 'WHEEL_OF_FORTUNE': {
      // Un solo telefono prenota: gli altri devono restare in attesa.
      if (team !== 'Rossi') break;
      stomp.send(`/app/game/${GAME_ID}/answer`, {
        playerName: team,
        answerIndex: -1,
        responseTimeMs: 900,
      });
      break;
    }

    case 'PRICE': {
      const estimates = { Rossi: 4.5, Blu: 18, Verdi: 120, Gialli: 900 };
      await api(`/games/${GAME_ID}/price-answer`, 'POST', {
        playerName: team,
        estimate: estimates[team],
      });
      break;
    }

    case 'TIMELINE': {
      const items = Array.isArray(payload.items) ? payload.items : [];
      // Ordine volutamente invertito: serve a vedere un punteggio parziale vero.
      const order = items.map((item) => item.id).reverse();
      if (order.length) {
        await api(`/games/${GAME_ID}/timeline-answer`, 'POST', { playerName: team, order });
      }
      break;
    }

    case 'SPEED_RUSH': {
      for (let step = 0; step < 12; step += 1) {
        stomp.send(`/app/game/${GAME_ID}/status`, {
          action: 'SPEED_RUSH_PROGRESS',
          playerName: team,
          correct: true,
        });
        await sleep(120);
      }
      break;
    }

    case 'AIR_HOCKEY_BATTLE': {
      for (let hit = 0; hit < 6; hit += 1) {
        stomp.send(`/app/game/${GAME_ID}/status`, {
          action: 'AIR_HOCKEY_BATTLE_ANSWER',
          playerName: team,
        });
        await sleep(260);
      }
      break;
    }

    case 'ARENA': {
      for (let index = 0; index < 5; index += 1) {
        const question = await api(
          `/games/${GAME_ID}/arena-question?category=Scienza%20e%20Spazio&playerId=${encodeURIComponent(team)}`,
        );
        // Alterna giusto/sbagliato: così il cerchio si muove in entrambi i versi.
        const answer =
          index % 2 === 0
            ? question.correctAnswer
            : question.options.find((option) => option !== question.correctAnswer);
        const result = await api(`/games/${GAME_ID}/arena-answer`, 'POST', {
          playerId: team,
          questionId: question.questionId,
          answer,
        });
        stomp.send(`/app/game/${GAME_ID}/status`, {
          action: 'ARENA_ANSWER',
          playerName: team,
          isCorrect: !!result.correct,
          points: result.points,
        });
        await sleep(250);
      }
      break;
    }

    case 'SCREAM_RACE': {
      for (let sample = 0; sample < 20; sample += 1) {
        stomp.send(`/app/game/${GAME_ID}/status`, {
          action: 'SCREAM',
          playerName: team,
          intensity: 55,
        });
        await sleep(200);
      }
      break;
    }

    default:
      log(team, 'tipo non gestito:', type);
  }
}

async function main() {
  log('prova dispositivi su', API, 'gioco', GAME_ID);

  const admin = new Stomp('admin');
  let lastConfirmed = 0;
  admin.onMessage = (destination, message) => {
    if (!destination.endsWith('/status') || !message?.action) return;

    if (message.action === 'SHOW_QUESTION') {
      const payload = parsePayload(message.payload);
      log('admin', 'vede domanda', message.type, '| chiavi:', Object.keys(payload).join(','));
    }
    if (message.action === 'ROUND_ENDED') log('admin', 'round chiuso', message.winner || '');
    if (message.action === 'PLAYER_PRENOTATO') {
      const now = Date.now();
      if (now - lastConfirmed < 1500) return;
      lastConfirmed = now;
      log('admin', 'prenotato:', message.name, '-> confermo CORRETTO');
      setTimeout(() => {
        admin.send(`/app/game/${GAME_ID}/status`, { action: 'ADMIN_CONFIRM_CORRECT' });
      }, 900);
    }
  };

  await admin.connect();
  admin.subscribe(`/topic/game/${GAME_ID}/status`);

  const phones = [];
  for (const team of TEAMS) {
    const phone = new Stomp(team);
    let busy = false;

    phone.onMessage = (destination, message) => {
      if (!destination.endsWith('/status') || !message?.action) return;

      if (message.action === 'START_VOTING') {
        if (busy) {
          log(team, 'START_VOTING ignorato (già in gioco)');
          return;
        }
        busy = true;
        playRound(team, phone, message)
          .catch((error) => log(team, 'errore giocata:', error.message))
          .finally(() => {
            busy = false;
          });
      }
    };

    await phone.connect();
    phone.subscribe(`/topic/game/${GAME_ID}/status`);
    phone.send(`/app/game/${GAME_ID}/status`, { action: 'JOIN_GAME', playerName: team });
    phones.push(phone);
    log(team, 'entrato in partita');
    await sleep(120);
  }

  log('pronti: 4 telefoni + admin');
}

main().catch((error) => {
  log('ERRORE FATALE:', error.message);
  process.exitCode = 1;
});
