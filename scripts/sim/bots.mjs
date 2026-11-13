#!/usr/bin/env node
/**
 * Giocatori finti per le prove dal vivo.
 *
 * Entrano in partita con la sessione REMOTE già creata da `match.mjs setup`
 * (stesso JOIN_GAME del pulsante PRENOTATI) e rispondono alle manche dei giochi
 * a quattro opzioni via STOMP, come farebbe un telefono vero. Non tocca il
 * backend: usa solo le API dei client.
 *
 * Uso:
 *   node scripts/sim/bots.mjs            # tutti i telefoni dello stato
 *   BOTS=Anna,Bruno node scripts/sim/bots.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.API || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8080/ws-pubgame';
const STATE_PATH = process.env.STATE_PATH || fileURLToPath(new URL('./.state.json', import.meta.url));

/** Giochi in cui si vota un indice 0..3: gli altri li lasciamo ai giocatori veri. */
const ANSWER_TYPES = new Set(['QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE']);
/** Giochi in cui si prenota (answerIndex -1) e poi decide il presentatore. */
const BUZZ_TYPES = new Set(['MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE']);

const log = (...args) => console.log(`[bot ${new Date().toISOString().slice(11, 19)}]`, ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const gameId = Number(state.gameId);
const phones = state.phones || {};
const wanted = (process.env.BOTS || Object.keys(phones).join(',')).split(',').map((n) => n.trim()).filter(Boolean);
/** Chi prenota nei giochi a prenotazione: uno solo, come in una squadra sola. */
const BUZZER_NAME = process.env.BUZZER || wanted[0] || '';

class Bot {
  constructor(name, token) {
    this.name = name;
    this.token = token;
    this.answered = new Set();
    this.buffer = '';
    this.round = 0;
  }

  /** Il telefono tiene viva la sessione con un battito HTTP: senza, la TV lo segna offline. */
  startHeartbeat() {
    const beat = async () => {
      try {
        const response = await fetch(`${API}/games/${gameId}/session/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': this.token },
          // Il server legge il token dal corpo, non dall'header.
          body: JSON.stringify({ sessionToken: this.token }),
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) log(`${this.name}: battito ${response.status}`);
      } catch { /* rete locale: riprova al giro dopo */ }
    };
    void beat();
    this.heartbeat = setInterval(beat, 8000);
  }

  send(destination, payload) {
    const body = JSON.stringify(payload);
    this.ws.send(
      `SEND\ndestination:${destination}\ncontent-type:application/json\n` +
      `content-length:${Buffer.byteLength(body, 'utf8')}\n\n${body}\0`,
    );
  }

  async join() {
    this.ws = new WebSocket(WS, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout STOMP ${this.name}`)), 12000);
      this.ws.addEventListener('open', () => {
        this.ws.send(
          `CONNECT\naccept-version:1.2\nheart-beat:0,0\nhost:localhost\n` +
          `X-Session-Token:${this.token}\n\n\0`,
        );
      });
      this.ws.addEventListener('message', (event) => this.onFrame(String(event.data), timer, resolve, reject));
      this.ws.addEventListener('close', (event) => {
        log(`${this.name}: socket chiusa (${event.code})`);
        if (!stopping.value) {
          setTimeout(() => {
            this.buffer = '';
            this.join().catch((error) => log(`${this.name}: rientro fallito (${String(error.message).slice(0, 90)})`));
          }, 1500);
        }
      });
    });
    this.send(`/app/game/${gameId}/status`, { action: 'JOIN_GAME', playerName: this.name });
    this.startHeartbeat();
    log(`${this.name} entrato in partita`);
    // Se la Bomba è già in corso (bot riavviato a round aperto) lo stato non
    // arriva a comando: si legge dal server per un po'.
    this.startBombaPolling();
  }

  onFrame(chunk, timer, resolve, reject) {
    this.buffer += chunk;
    let end;
    while ((end = this.buffer.indexOf('\0')) >= 0) {
      const frame = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      if (frame.startsWith('CONNECTED')) {
        clearTimeout(timer);
        this.ws.send(`SUBSCRIBE\nid:bot-${this.name}\ndestination:/topic/game/${gameId}/status\n\n\0`);
        resolve();
        continue;
      }
      if (frame.startsWith('ERROR')) {
        const text = frame.replace(/\n/g, ' | ').slice(0, 240);
        clearTimeout(timer);
        reject(new Error(text));
        continue;
      }
      if (!frame.startsWith('MESSAGE')) continue;
      const split = frame.indexOf('\n\n');
      if (split < 0) continue;
      try {
        this.onStatus(JSON.parse(frame.slice(split + 2)));
      } catch { /* frame non JSON */ }
    }
  }

  onStatus(message) {
    if (!message || typeof message !== 'object') return;

    // Ogni round riapre le risposte: le chiavi vanno legate al round, non solo
    // alla manche, altrimenti dal secondo round il bot si crede già a posto.
    // Time Buzzer: il via lo dà il server, si ferma il cronometro col proprio ms.
    if (message.action === 'TIME_BUZZER_START') {
      const manche = message.state?.manche ?? message.manche ?? '';
      this.buzzerStopOnce(`tb-${this.round}-${manche}`);
      return;
    }

    if (message.action === 'SHOW_QUESTION' || message.action === 'START_VOTING') {
      const round = Number(message.round) || 0;
      if (round && round !== this.round) {
        this.round = round;
        this.answered.clear();
      }
    }

    // Bomba: si scopre una casella solo quando il turno è del bot, e lo stato
    // arriva a ogni pick. La TV lo ripubblica anche dopo i timeout.
    if (message.action === 'BOMBA_STATE') {
      this.bombaTurn(message.state || {});
      return;
    }

    // Tennis: ogni campo ha un turno; se è del bot, risponde alla domanda.
    if (message.action === 'TENNIS_BATTLE_STATE') {
      this.tennisTurn(message);
      return;
    }

    // Ultima spiaggia: prima il livello (puntata), poi la risposta.
    if (message.action === 'ULTIMA_SPIAGGIA_STATE') {
      this.ultimaSpiaggiaTurn(message.state || {});
      return;
    }

    // Azzardo: puntata su un'opzione a caso, entro il massimo consentito.
    if (message.action === 'AZZARDO_STATE') {
      this.azzardoBet(message.state || {});
      return;
    }

    if (message.action === 'QUIZ_STATE') {
      const data = message.state || {};
      const manche = Number(data.manche) || 0;
      if (manche > 0 && !data.mancheReveal && !data.revealed) {
        this.answerOnce(`quiz-${this.round}-${manche}`);
      }
      return;
    }

    if (message.action === 'SHOW_QUESTION' || message.action === 'START_VOTING') {
      const type = String(message.type);
      const key = `round-${type}-${message.round ?? ''}-${message.action}`;
      // Nei giochi a prenotazione si prenota uno solo: gli altri restano a
      // guardare, altrimenti la TV si riempie di richieste identiche.
      if (BUZZ_TYPES.has(type)) {
        if (this.name === BUZZER_NAME) this.buzzOnce(`${key}-buzz`);
        return;
      }
      // Timeline non si vota: ogni squadra manda il proprio ordine al server.
      if (type === 'TIMELINE' && message.action === 'START_VOTING') {
        this.timelineOnce(`${key}-order`, message.payload);
        return;
      }
      if (type === 'BOMBA') {
        this.startBombaPolling();
        return;
      }
      // Speed Rush: si gioca in autonomia contro il server (task → answer).
      if (type === 'SPEED_RUSH') {
        if (message.action === 'START_VOTING') this.startSpeedRush(key);
        return;
      }
      if (!ANSWER_TYPES.has(type)) return;
      this.answerOnce(key);
    }
  }

  /** Stop del cronometro: un bersaglio a caso, con un po' di errore umano. */
  buzzerStopOnce(key) {
    if (this.answered.has(key)) return;
    this.answered.add(key);
    const target = 4000 + Math.floor(Math.random() * 3200);
    setTimeout(async () => {
      try {
        const response = await fetch(`${API}/games/${gameId}/time-buzzer/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': this.token },
          body: JSON.stringify({ playerName: this.name, ms: target }),
          signal: AbortSignal.timeout(8000),
        });
        log(`${this.name}: stop a ${target}ms (${response.status})`);
      } catch (error) {
        log(`${this.name}: stop non inviato (${String(error.message).slice(0, 80)})`);
      }
    }, target);
  }

  /**
   * Bomba: se il turno è suo, aspetta un attimo da persona vera e scopre una
   * casella ancora libera. Rilegge lo stato prima di colpire, così un pick
   * arrivato nel frattempo non fa saltare la mossa.
   */
  bombaTurn(state) {
    const turn = String(state?.turn || '');
    if (!turn || turn.toLowerCase() !== this.name.toLowerCase()) return;
    if (state.paused || state.active === false) return;
    const used = (state.cells || []).filter((cell) => cell.used).length;
    const key = `bomba-${this.round}-${state.phase ?? ''}-${used}-${turn}`;
    if (this.answered.has(key)) return;
    this.answered.add(key);
    const delay = 900 + Math.floor(Math.random() * 1600);
    setTimeout(async () => {
      try {
        const fresh = await fetch(
          `${API}/games/${gameId}/bomba/state?player=${encodeURIComponent(this.name)}`,
          { headers: { 'X-Session-Token': this.token }, signal: AbortSignal.timeout(6000) },
        ).then((response) => response.json());
        if (String(fresh?.turn || '').toLowerCase() !== this.name.toLowerCase()) return;
        if (fresh?.paused || fresh?.active === false) return;
        const free = (fresh.cells || []).filter((cell) => !cell.used).map((cell) => cell.id);
        if (!free.length) return;
        const cellId = free[Math.floor(Math.random() * free.length)];
        const response = await fetch(`${API}/games/${gameId}/bomba/pick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': this.token },
          body: JSON.stringify({ playerName: this.name, cellId }),
          signal: AbortSignal.timeout(8000),
        });
        log(`${this.name}: scopre la casella ${cellId} (${response.status})`);
      } catch (error) {
        log(`${this.name}: pick bomba non inviato (${String(error.message).slice(0, 80)})`);
      }
    }, delay);
  }

  /**
   * Bomba: rete di sicurezza. Se lo stato del turno non arriva (telefono appena
   * entrato, broadcast perso) si legge dal server per un minuto e mezzo.
   */
  startBombaPolling() {
    if (this.bombaPoll) return;
    // Il turno che scade non manda broadcast: senza questa lettura i bot
    // resterebbero fermi e la Bomba si bloccherebbe sui loro turni.
    let idle = 0;
    this.bombaPoll = setInterval(async () => {
      try {
        const state = await fetch(
          `${API}/games/${gameId}/bomba/state?player=${encodeURIComponent(this.name)}`,
          { headers: { 'X-Session-Token': this.token }, signal: AbortSignal.timeout(5000) },
        ).then((response) => response.json());
        if (state?.active === false) {
          idle += 1;
          if (idle >= 3) {
            clearInterval(this.bombaPoll);
            this.bombaPoll = undefined;
          }
          return;
        }
        idle = 0;
        this.bombaTurn(state);
      } catch { /* rete locale: riprova al giro dopo */ }
    }, 2500);
  }

  /**
   * Azzardo: una puntata per manche. Sceglie un'opzione a caso e punta una
   * fetta del massimo consentito, come farebbe una squadra prudente.
   */
  azzardoBet(state) {
    if (String(state?.phase || '') !== 'BET') return;
    const me = this.name.toLowerCase();
    const entry = (state?.ready || []).find((r) => String(r?.playerName || '').toLowerCase() === me);
    if (!entry || entry.ready) return;
    const options = Array.isArray(state?.options) ? state.options.length : 0;
    if (!options) return;
    const key = `azzardo-${state.manche ?? ''}-${state.phase}`;
    if (this.answered.has(key)) return;
    this.answered.add(key);

    // I bot giocano a fiches come i telefoni: una pila su un'opzione.
    const maxBet = Math.max(0, Number(entry.maxBet) || 0);
    const maxChips = Math.min(10, Math.floor(maxBet / 20));
    if (maxChips < 1) return;
    const count = Math.max(1, Math.round(maxChips * (0.3 + Math.random() * 0.5)));
    const choice = Math.floor(Math.random() * options);
    const chips = Array.from({ length: options }, (_, i) => (i === choice ? count : 0));
    const delay = 1200 + Math.floor(Math.random() * 2600);
    setTimeout(() => {
      try {
        this.send(`/app/game/${gameId}/status`, {
          action: 'AZZARDO_ACTION',
          playerName: this.name,
          kind: 'BET',
          value: { chips },
        });
        log(`${this.name}: azzardo, ${count} fiche su ${'ABCD'[choice] ?? choice}`);
      } catch (error) {
        log(`${this.name}: puntata non inviata (${String(error.message).slice(0, 80)})`);
      }
    }, delay);
  }

  /**
   * Ultima spiaggia: sceglie un livello ancora libero, poi risponde alla
   * domanda di quel livello. Una mossa per fase, legata all'occorrenza.
   */
  ultimaSpiaggiaTurn(state) {
    const phase = String(state?.phase || '');
    const me = this.name.toLowerCase();
    const row = (state?.rows || []).find((r) => String(r?.playerName || '').toLowerCase() === me);
    const occurrence = state?.occurrenceId ?? '';

    if (phase === 'LEVEL') {
      if (row?.level) return;
      const used = new Set(row?.used || []);
      const free = (state.levels || []).filter((level) => !used.has(Number(level)));
      if (!free.length) return;
      const key = `us-level-${occurrence}-${free.length}`;
      if (this.answered.has(key)) return;
      this.answered.add(key);
      const level = free[Math.floor(Math.random() * free.length)];
      const delay = 900 + Math.floor(Math.random() * 1500);
      setTimeout(() => {
        try {
          this.send(`/app/game/${gameId}/status`, {
            action: 'ULTIMA_SPIAGGIA_ACTION',
            playerName: this.name,
            kind: 'LEVEL',
            value: Number(level),
          });
          log(`${this.name}: ultima spiaggia, livello ${level}`);
        } catch (error) {
          log(`${this.name}: livello non inviato (${String(error.message).slice(0, 80)})`);
        }
      }, delay);
      return;
    }

    if (phase === 'QUESTION') {
      if (!row?.level || row?.answered) return;
      const question = (state.questions || []).find((q) => Number(q?.level) === Number(row.level));
      const options = Array.isArray(question?.options) ? question.options.length : 4;
      if (!options) return;
      const key = `us-answer-${occurrence}-${row.level}`;
      if (this.answered.has(key)) return;
      this.answered.add(key);
      const index = Math.floor(Math.random() * options);
      const delay = 1200 + Math.floor(Math.random() * 2200);
      setTimeout(() => {
        try {
          this.send(`/app/game/${gameId}/status`, {
            action: 'ULTIMA_SPIAGGIA_ACTION',
            playerName: this.name,
            kind: 'ANSWER',
            value: index,
          });
          log(`${this.name}: ultima spiaggia, risposta ${'ABCD'[index] ?? index}`);
        } catch (error) {
          log(`${this.name}: risposta non inviata (${String(error.message).slice(0, 80)})`);
        }
      }, delay);
    }
  }

  /**
   * Tennis: il campo di cui il bot ha il turno riceve una risposta a caso
   * (il telefono non conosce quella giusta). Una risposta per domanda, così il
   * bot non spara due volte sullo stesso tiro.
   */
  tennisTurn(message) {
    const courts = Array.isArray(message?.courts) ? message.courts : [];
    for (const court of courts) {
      const side = court?.turn;
      if (side !== 'a' && side !== 'b') continue;
      if (court.winner || !court.question) continue;
      const player = String(court?.[side]?.playerName || '');
      if (player.toLowerCase() !== this.name.toLowerCase()) continue;
      const key = `tennis-${court.id}-${side}-${court.question.text ?? court.question.prompt ?? ''}`;
      if (this.answered.has(key)) continue;
      this.answered.add(key);
      const delay = 700 + Math.floor(Math.random() * 1400);
      setTimeout(() => {
        try {
          this.send(`/app/game/${gameId}/status`, {
            action: 'TENNIS_BATTLE_ANSWER',
            playerName: this.name,
            answerIndex: Math.floor(Math.random() * 4),
          });
          log(`${this.name}: risposta tennis (campo ${court.id}, lato ${side})`);
        } catch (error) {
          log(`${this.name}: tennis non inviato (${String(error.message).slice(0, 80)})`);
        }
      }, delay);
    }
  }

  /**
   * Speed Rush: il telefono prende un task, risponde e ricomincia finché il
   * round è aperto. Senza questo i bot restavano fermi sulla linea di partenza.
   */
  startSpeedRush(key) {
    if (this.speedRushKey === key) return;
    this.speedRushKey = key;
    const loop = async (attempt = 0) => {
      if (attempt > 400) return;
      try {
        const response = await fetch(`${API}/games/${gameId}/speed-rush/task`, {
          headers: { 'X-Session-Token': this.token },
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return;
        const task = await response.json();
        const answer = this.speedRushAnswer(task);
        if (answer == null) return;
        await sleep(700 + Math.floor(Math.random() * 900));
        const sent = await fetch(`${API}/games/${gameId}/speed-rush/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': this.token },
          body: JSON.stringify({ taskId: task.taskId, answer }),
          signal: AbortSignal.timeout(6000),
        });
        if (!sent.ok) return;
        const progress = await sent.json();
        log(`${this.name}: Speed Rush ${progress.correct ? 'giusto' : 'sbagliato'} · ${progress.progress}%`);
        if (progress.finished || !progress.nextTask) return;
        void loop(attempt + 1);
      } catch { /* rete locale: il round chiude da solo */ }
    };
    void loop();
  }

  /** Risposta Speed Rush: le somme le calcola, il resto è a caso. */
  speedRushAnswer(task) {
    const options = Array.isArray(task?.options) ? task.options : [];
    if (!options.length) return null;
    const asText = (option) => (typeof option === 'string' ? option : String(option?.name ?? ''));
    if (task.kind === 'math') {
      const match = String(task.text || '').match(/(-?\d+)\s*([+\-x×*÷/])\s*(-?\d+)/);
      if (match) {
        const a = Number(match[1]);
        const b = Number(match[3]);
        const op = match[2];
        const value = op === '+' ? a + b
          : op === '-' ? a - b
            : (op === 'x' || op === '×' || op === '*') ? a * b
              : (b === 0 ? NaN : a / b);
        const wanted = String(value).replace(/\s/g, '');
        const found = options.map(asText).find((option) => option.replace(/\s/g, '') === wanted);
        if (found) return found;
      }
    }
    return asText(options[Math.floor(Math.random() * options.length)]);
  }

  /** Ordine Timeline: mescolato, come una squadra che tira a caso. */
  timelineOnce(key, payload) {
    if (this.answered.has(key)) return;
    this.answered.add(key);
    const delay = 4000 + Math.floor(Math.random() * 5000);
    setTimeout(async () => {
      try {
        const data = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
        const cards = data.cards || data.items || data.events || [];
        const roundId = data.roundId || data.timelineRoundId || '';
        const order = cards.map((card) => Number(card.id)).filter((id) => Number.isFinite(id));
        if (!order.length || !roundId) {
          log(`${this.name}: Timeline senza roundId o carte`);
          return;
        }
        for (let i = order.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        const response = await fetch(`${API}/games/${gameId}/timeline-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': this.token },
          body: JSON.stringify({
            playerName: this.name,
            roundId,
            order,
            idempotencyKey: `${this.name}-${roundId}`,
          }),
          signal: AbortSignal.timeout(8000),
        });
        log(`${this.name}: ordine Timeline inviato (${response.status})`);
      } catch (error) {
        log(`${this.name}: Timeline non inviata (${String(error.message).slice(0, 80)})`);
      }
    }, delay);
  }

  /** Prenotazione (answerIndex -1): il presentatore decide giusto o sbagliato. */
  buzzOnce(key) {
    if (this.answered.has(key)) return;
    this.answered.add(key);
    const delay = 2600 + Math.floor(Math.random() * 2600);
    setTimeout(() => {
      try {
        this.send(`/app/game/${gameId}/answer`, {
          playerName: this.name,
          answerIndex: -1,
          responseTimeMs: delay,
        });
        log(`${this.name} si prenota (${key})`);
      } catch (error) {
        log(`${this.name}: prenotazione non inviata (${String(error.message).slice(0, 80)})`);
      }
    }, delay);
  }

  /** Una risposta per manche, con un ritardo da persona vera. */
  answerOnce(key) {
    if (this.answered.has(key)) return;
    this.answered.add(key);
    const delay = 1800 + Math.floor(Math.random() * 4200);
    const index = Math.floor(Math.random() * 4);
    setTimeout(() => {
      try {
        this.send(`/app/game/${gameId}/answer`, {
          playerName: this.name,
          answerIndex: index,
          responseTimeMs: delay,
        });
        log(`${this.name} risponde ${'ABCD'[index]} (${key})`);
      } catch (error) {
        log(`${this.name}: risposta non inviata (${String(error.message).slice(0, 80)})`);
      }
    }, delay);
  }
}

const stopping = { value: false };
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping.value = true;
    log('stop richiesto');
    process.exit(0);
  });
}

(async () => {
  if (!gameId || Number.isNaN(gameId)) throw new Error('partita non valida in ' + STATE_PATH);
  const bots = wanted.filter((name) => phones[name]).map((name) => new Bot(name, phones[name]));
  if (!bots.length) throw new Error('nessun telefono da far giocare');
  for (const bot of bots) {
    try {
      await bot.join();
    } catch (error) {
      log(`${bot.name}: ingresso fallito (${String(error.message).slice(0, 120)})`);
    }
    await sleep(400);
  }
  log(`partita ${gameId}: ${bots.length} giocatori finti collegati`);
  while (!stopping.value) await sleep(60000);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
