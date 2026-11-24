#!/usr/bin/env node
/**
 * Rigenera `docs/screenshots/readme/phone-azzardo-390.png` da un round Azzardo
 * vero: TV della serata, regia che avanza fino al round 5, telefono in squadra
 * che mette due fiches sulla prima risposta.
 *
 * Uso: BASE_URL=http://127.0.0.1:4300 node scripts/checks/azzardo-shot.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4300';
const API = process.env.API_URL || 'http://127.0.0.1:8090';
const OUT = process.env.OUT || 'docs/screenshots/readme/phone-azzardo-390.png';
const NAME = process.env.TEAM || 'Anna';
const SECRET = process.env.CONTROL_SECRET || '';
const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Il bonus dell'atto 1 cade dopo il round 6: la scaletta vera lo sorteggia fra
 * i round 2-7, e un bonus a metà strada interromperebbe la corsa all'Azzardo.
 */
const BONUS_SLOTS = [
  { act: 0, type: 'CASINO_COLOR', round: 6 },
  { act: 1, type: 'BLACKJACK', round: 12 },
  { act: 2, type: 'CASINO_DOZEN', round: 20 },
  { act: 3, type: 'CAVALLO', round: 28 },
  { act: 4, type: 'CASINO_NUMBER', round: 36 },
];

const OVERLAYS = '.stage-reading, .stage-countdown, .demo-frame';

/** La TV è un dispositivo di regia: senza il segreto il server le nega la sessione. */
async function openSession(gameId, role = 'TV', deviceId = `shot-${role.toLowerCase()}-${gameId}`) {
  const response = await fetch(`${API}/games/${gameId}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Control-Secret': SECRET },
    body: JSON.stringify({ deviceId, role }),
  });
  if (!response.ok) throw new Error(`sessione ${role}: ${response.status}`);
  return (await response.json()).sessionToken;
}

/**
 * Partita nuova: la più recente diventa quella attiva per TV e telefoni.
 * `POST /games` è una rotta di regia e chiede una sessione, quindi prima si
 * apre quella di una partita qualsiasi e poi quella della partita appena nata.
 */
async function createGame() {
  const bootstrap = await openSession(1);
  const response = await fetch(`${API}/games`, {
    method: 'POST',
    headers: { 'X-Session-Token': bootstrap },
  });
  if (!response.ok) throw new Error(`POST /games: ${response.status}`);
  const id = Number((await response.json()).id);
  return { id, token: await openSession(id) };
}

const browser = await chromium.launch();
const tvContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const shotGame = await createGame();
const shotGameId = shotGame.id;
const shotToken = shotGame.token;
log(`partita ${shotGameId} pronta con la sessione TV`);
await tvContext.addInitScript(([gameId, token, slots]) => {
  localStorage.setItem('activeGameId', String(gameId));
  localStorage.setItem('pubgame.deviceId', `shot-tv-${gameId}`);
  localStorage.setItem(`pubgame.session.${gameId}.TV`, token);
  localStorage.setItem('roundProgress', JSON.stringify({
    totalRounds: 40,
    currentRound: 0,
    completedRounds: [],
    nextRoundType: null,
    bonusSlots: slots,
    bonusSeed: 1,
  }));
}, [shotGameId, shotToken, BONUS_SLOTS]);
const tv = await tvContext.newPage();
tv.on('pageerror', (error) => log('TV pageerror:', error.message.slice(0, 200)));
tv.on('response', (response) => {
  const url = response.url();
  if (!url.includes('/games/')) return;
  if (!/generate-ai-round|\/session|round/.test(url)) return;
  if (response.status() < 400 && !url.includes('generate-ai-round')) return;
  log('rete', response.status(), url.replace(BASE, ''), response.request().method());
});

const readServer = () =>
  tv.evaluate(async () => {
    const game = Number(localStorage.getItem('activeGameId')) || 0;
    const token = game ? localStorage.getItem(`pubgame.session.${game}.TV`) : null;
    if (!game || !token) return { game, snapshot: null };
    const response = await fetch(`/games/${game}/sync?sinceSeq=0`, {
      headers: { 'X-Session-Token': token },
    });
    if (!response.ok) return { game, snapshot: { failed: response.status } };
    return { game, snapshot: (await response.json()).snapshot };
  });

async function skipDemo() {
  const skip = tv.locator('.demo-nav-skip');
  if ((await skip.count()) && (await skip.first().isVisible().catch(() => false))) {
    log('demo di prima apparizione: SALTA');
    await skip.first().click({ force: true }).catch(() => {});
    return true;
  }
  return false;
}

async function waitOverlaysGone(timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const visible = await tv.locator(OVERLAYS).first().isVisible().catch(() => false);
    if (!visible) return true;
    await sleep(250);
  }
  return false;
}

async function passButtonTest(phone) {
  const test = phone.locator('app-button-test');
  try {
    await test.waitFor({ state: 'visible', timeout: 25_000 });
  } catch {
    log('prova pulsanti non mostrata');
    return;
  }
  log('prova pulsanti: passo 1');
  await phone.locator('.bt-target').click({ force: true }).catch(() => {});
  await sleep(800);

  const instruction = (await phone.locator('.bt-instruction').textContent().catch(() => '')) || 'PREMI B';
  const letter = (instruction.match(/([A-D])\s*$/) || [])[1] || 'B';
  const index = Math.max(0, letter.charCodeAt(0) - 65);
  log(`prova pulsanti: passo 2 (${letter})`);
  await phone.locator('.bt-choice').nth(index).click({ force: true }).catch(() => {});
  await sleep(800);

  log('prova pulsanti: passo 3 (trascinamento, si lascia passare da solo)');
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const step = await phone.locator('.bt-counter').textContent().catch(() => '');
    if (!String(step).startsWith('3')) break;
    await sleep(500);
  }

  log('prova pulsanti: passo 4');
  await phone.getByRole('button', { name: 'NON VIBRA' }).click({ force: true }).catch(() => {});

  log('prova pulsanti: passo 5 (collegamento)');
  await test.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});
  log('prova pulsanti superata');
}

async function joinPhone(gameId) {
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const phone = await phoneContext.newPage();
  phone.on('pageerror', (error) => log('telefono pageerror:', error.message.slice(0, 200)));
  await phone.goto(`${BASE}/play?game=${gameId}&nickname=${encodeURIComponent(NAME)}&quad=1`, {
    waitUntil: 'domcontentloaded',
  });
  await sleep(2500);
  await passButtonTest(phone);
  return phone;
}

async function main() {
  await tv.goto(`${BASE}/tv`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const intro = tv.locator('.intro-start');
  if (await intro.count()) {
    await intro.first().click({ force: true }).catch(() => {});
    await sleep(1500);
  }

  // Il telefono entra subito: la TV deve conoscerne la presenza prima che
  // l'Azzardo assegni le fiches alle squadre collegate.
  const phone = await joinPhone(shotGameId);
  const gameId = shotGameId;
  log('telefono in squadra, si avanza fino all’Azzardo');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const before = await readServer();
    const beforeKey = before.snapshot?.roundKey ?? null;
    await waitOverlaysGone();
    await tv.locator('button.dock-btn.advance').click({ force: true });
    log(`AVANTI (roundKey ${beforeKey})`);

    const started = Date.now();
    let lastReport = 0;
    let announced = null;
    while (Date.now() - started < 240_000) {
      await skipDemo();
      const now = await readServer();
      if (now.game) gameId = now.game;
      const snapshot = now.snapshot;
      const index = Number(snapshot?.roundIndex ?? 0);
      if (snapshot?.announced === true && snapshot?.roundKey && snapshot.roundKey !== beforeKey) {
        announced = snapshot;
        break;
      }
      if (Date.now() - started > lastReport + 8000) {
        lastReport = Date.now();
        const text = (await tv.locator('body').innerText().catch(() => ''))
          .replace(/\s+/g, ' ').slice(0, 160);
        log(`… round ${index} ${snapshot?.roundType ?? '-'} status ${snapshot?.status ?? '-'}`
          + ` announced ${snapshot?.announced} paused ${snapshot?.paused} | TV: ${text}`);
      }
      await sleep(400);
    }
    if (!announced) throw new Error('nessun round annunciato entro il tempo');
    log(`round ${announced.roundIndex} ${announced.roundType} annunciato`);
    if (announced.roundType === 'AZZARDO') break;
  }

  log('attesa dello schermo Azzardo sul telefono');
  const stack = phone.locator('.azzardo-chip-stack').first();
  await stack.waitFor({ state: 'visible', timeout: 120_000 });
  await sleep(1200);
  const meta = (await phone.locator('.azzardo-meta').first().innerText().catch(() => ''))
    .replace(/\s+/g, ' ');
  log(`telefono: ${meta} · pulsante disattivato ${await stack.isDisabled().catch(() => '?')}`);

  log('due fiches sulla prima risposta');
  await stack.click({ force: true });
  await sleep(350);
  await stack.click({ force: true });
  await phone.locator('.azzardo-chip-row.filled').first().waitFor({ state: 'visible', timeout: 10_000 });
  await sleep(900);

  await phone.screenshot({ path: OUT });
  log(`scatto salvato: ${OUT}`);

  await browser.close();
}

main().catch(async (error) => {
  log('ERRORE:', error.message);
  await tv.screenshot({ path: 'docs/screenshots/readme/_tv-debug.png' }).catch(() => {});
  await browser.close().catch(() => {});
  process.exitCode = 1;
});
