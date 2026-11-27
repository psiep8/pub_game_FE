import { writeFileSync } from 'node:fs';
import { devices, expect, test, type Browser, type Page } from 'playwright/test';
import { BACKEND_PORT } from './ports';

/**
 * N-10 — misura dell'ingresso di ogni gioco.
 *
 * Un gioco per caricamento: prima di aprire la TV si semina il progresso del
 * round manager (`localStorage.roundProgress`) sull'indice di quel gioco, così
 * il primo AVANTI apre esattamente la scena da misurare. Niente chiusure di
 * round in mezzo: ogni misura parte da una pagina fresca.
 *
 * Condizioni del criterio N-10: 1280×720, CPU rallentata 4×.
 *
 * Per ogni ingresso si sommano i `layout-shift` (CLS) e si contano i `longtask`
 * oltre 50 ms; dei primi si registrano anche i nodi che li causano.
 *
 * Uscita: `.tools/ingressi.jsonl`, una riga per gioco, più la tabella in console.
 */

const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
const REGIA_SECRET = 'e2e-control-secret-0000000000000000';
const VIEWPORT = { width: 1280, height: 720 };
const MEASURE_MS = 6_500;
const PHONES = 3;
const OUT = '.tools/ingressi.jsonl';

const DEMO_TYPES = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'TIME_BUZZER',
  'BOMBA', 'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA', 'AZZARDO', 'BLACKJACK', 'ARENA',
  'SPEED_RUSH', 'BIGLIE', 'BONUS_CAVALLO', 'BONUS_KARAOKE', 'BONUS_BIGLIE',
];

/**
 * Round 0-based della scaletta vera che apre ogni gioco (ACT_DECKS): si semina
 * l'indice e il primo AVANTI apre quella scena.
 */
const GAMES: Array<{ game: string; round: number }> = [
  { game: 'QUIZ', round: 1 },
  { game: 'WHEEL_OF_FORTUNE', round: 2 },
  { game: 'TIME_BUZZER', round: 3 },
  { game: 'IMAGE_BLUR', round: 4 },
  { game: 'TIMELINE', round: 5 },
  { game: 'SPEED_RUSH', round: 6 },
  { game: 'ULTIMA_SPIAGGIA', round: 7 },
  { game: 'AZZARDO', round: 8 },
  { game: 'BIGLIE', round: 10 },
  { game: 'BOMBA', round: 25 },
];

async function activeGameId(): Promise<number | null> {
  const response = await fetch(`${BACKEND}/games/active`);
  if (!response.ok) return null;
  const body: any = await response.json().catch(() => null);
  const id = Number(body?.id ?? body?.gameId ?? 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function createGame(tvToken: string): Promise<number> {
  const response = await fetch(`${BACKEND}/games`, {
    method: 'POST',
    headers: { 'X-Session-Token': tvToken },
  });
  expect(response.ok, `POST /games ha risposto ${response.status}`).toBeTruthy();
  const body: any = await response.json();
  return Number(body?.id ?? 0);
}

async function openLobby(page: Page): Promise<void> {
  const intro = page.locator('.intro-screen');
  await intro.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  if (await intro.isVisible().catch(() => false)) {
    await intro.click({ force: true });
    await page.keyboard.press('Enter');
  }
  const lobby = page.getByRole('button', { name: /APRI LOBBY/ });
  await lobby.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (await lobby.isVisible().catch(() => false)) await lobby.click();
}

/**
 * Osservatori accesi per tutta la pagina. Per ogni shift si salva anche il nodo
 * che si è spostato (`entry.sources`): è quello che dice la causa, non il numero.
 */
function instrumentObservers(page: Page) {
  return page.addInitScript(() => {
    const w = window as any;
    w.__shift = [];
    w.__long = [];
    const name = (node: any): string => {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (!element) return '?';
      const cls = typeof element.className === 'string' && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
      return `${String(element.tagName ?? '?').toLowerCase()}${cls}`;
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        w.__shift.push({
          value: entry.value,
          t: entry.startTime,
          input: entry.hadRecentInput,
          nodes: (entry.sources ?? []).map((source: any) => name(source.node)),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true } as any);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        w.__long.push({ duration: entry.duration, t: entry.startTime });
      }
    }).observe({ type: 'longtask', buffered: true } as any);
  });
}

/**
 * Il progresso del round manager vive in `localStorage.roundProgress`, ma dopo
 * il caricamento la TV lo riallinea allo stato autorevole del server (partita
 * nuova, nessun round): per la misura si riporta il cursore sul round del gioco
 * appena prima di AVANTI.
 */
function seedRound(page: Page, round: number) {
  return page.addInitScript((index) => {
    localStorage.setItem('roundProgress', JSON.stringify({
      totalRounds: 40,
      currentRound: index,
      completedRounds: [],
      nextRoundType: null,
      bonusSlots: [],
      bonusSeed: 20261127,
    }));
  }, round);
}

function seekRound(tv: Page, round: number): Promise<void> {
  return tv.evaluate((index) => {
    const component: any = (window as any).ng?.getComponent(
      document.querySelector('app-game-component'),
    );
    component?.roundManager?.restoreRound?.(index);
  }, round);
}

async function openTv(page: Page, gameId: number): Promise<void> {
  await page.addInitScript(({ id, demos }) => {
    localStorage.setItem('activeGameId', String(id));
    localStorage.setItem(`demoSeen:${id}`, JSON.stringify(demos));
  }, { id: gameId, demos: DEMO_TYPES });
  await page.goto(`/tv?regia=${REGIA_SECRET}&debug=1`);
  await openLobby(page);
  await page.locator('.pairing-code').waitFor({ state: 'visible', timeout: 45_000 });
}

async function joinPhone(page: Page, gameId: number, name: string): Promise<void> {
  await page.goto(`/play?game=${gameId}`);
  await page.locator('#team-name').fill(name);
  await page.getByRole('button', { name: 'AVANTI' }).click({ force: true });
  await page.getByRole('button', { name: 'CONFERMA E ENTRA' }).click({ force: true });
  await expect(page.locator('.header-round, app-button-test')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator('.header-round')).toBeVisible({ timeout: 30_000 });
}

function typeOf(tv: Page): Promise<string | null> {
  return tv.evaluate(() => {
    const component: any = (window as any).ng?.getComponent(
      document.querySelector('app-game-component'),
    );
    return (component?.currentMode?.()?.type as string) ?? null;
  });
}

const reset = (tv: Page) => tv.evaluate(() => {
  const w = window as any;
  w.__shift.length = 0;
  w.__long.length = 0;
});

const readMetrics = (tv: Page) => tv.evaluate(() => {
  const w = window as any;
  const shift = (w.__shift ?? []) as Array<{ value: number; t: number; nodes: string[] }>;
  const long = (w.__long ?? []) as Array<{ duration: number }>;
  const byNode = new Map<string, { value: number; count: number }>();
  for (const entry of shift) {
    for (const node of new Set(entry.nodes)) {
      const row = byNode.get(node) ?? { value: 0, count: 0 };
      row.value += entry.value;
      row.count += 1;
      byNode.set(node, row);
    }
  }
  return {
    cls: Number(shift.reduce((sum, entry) => sum + entry.value, 0).toFixed(3)),
    shifts: shift.filter((entry) => entry.value > 0.0005).length,
    longtasks: long.length,
    maxLongMs: long.length ? Math.round(Math.max(...long.map((entry) => entry.duration))) : 0,
    // Quando è successo: un salto solo a metà scena non è la stessa cosa di
    // trenta salti sparsi, e la correzione è diversa.
    raw: shift
      .filter((entry) => entry.value > 0.0005)
      .slice(0, 40)
      .map((entry) => ({ t: Math.round(entry.t), value: Number(entry.value.toFixed(3)), nodes: entry.nodes })),
    nodes: [...byNode]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5)
      .map(([node, row]) => ({ node, value: Number(row.value.toFixed(3)), count: row.count })),
  };
});

/** AVANTI senza coordinate: la dock entra con un'animazione e il mouse sbaglia. */
async function pressAdvance(tv: Page): Promise<boolean> {
  const button = tv.locator('.dock-btn.advance');
  const ready = await button.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false);
  if (!ready) return false;
  await button.evaluate((el) => (el as HTMLButtonElement).click());
  return true;
}

async function bootstrapToken(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openTv(page, 1);
  const id = await activeGameId();
  expect(id, 'nessuna partita attiva dopo APRI LOBBY').not.toBeNull();
  const token = (await page.evaluate(
    (gameId) => localStorage.getItem(`pubgame.session.${gameId}.TV`) ?? '',
    id!,
  )) || '';
  expect(token, 'token TV assente nella lobby').not.toBe('');
  await context.close();
  return token;
}

interface Metrics {
  cls: number;
  shifts: number;
  longtasks: number;
  maxLongMs: number;
  raw: Array<{ t: number; value: number; nodes: string[] }>;
  nodes: Array<{ node: string; value: number; count: number }>;
}

interface FrameBox {
  frame: { w: number; h: number };
  natural: { w: number; h: number };
}

interface Row extends Metrics {
  game: string;
  round: number;
  pressed: boolean;
  scene: string | null;
  frame: FrameBox | null;
}

/** Apre un gioco su una pagina fresca e ne misura l'ingresso. */
async function measureGame(
  browser: Browser,
  token: string,
  target: { game: string; round: number },
): Promise<Row> {
  const gameId = await createGame(token);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const tv = await context.newPage();
  await instrumentObservers(tv);
  await seedRound(tv, target.round);
  await openTv(tv, gameId);

  const phoneContexts = [];
  for (let index = 1; index <= PHONES; index += 1) {
    const phoneContext = await browser.newContext({ ...devices['iPhone 14'] });
    phoneContexts.push(phoneContext);
    const phone = await phoneContext.newPage();
    await joinPhone(phone, gameId, `N10-${target.game.slice(0, 3)}${index}`);
  }

  // CPU 4× sulla TV, dopo il caricamento e prima dell'ingresso.
  const session = await context.newCDPSession(tv);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await seekRound(tv, target.round);
  await reset(tv);
  const pressed = await pressAdvance(tv);
  let type: string | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await tv.waitForTimeout(500);
    type = await typeOf(tv);
    if (type) break;
  }
  await tv.waitForTimeout(MEASURE_MS);

  const metrics = await readMetrics(tv);
  // Cornice della foto contro proporzione reale: serve a verificare che la
  // scena riservi la misura giusta e non lasci bande nere.
  const frame = await tv.evaluate(() => {
    const box = document.querySelector('app-image-blur .blur-main-container');
    const img = document.querySelector('app-image-blur .blur-img') as HTMLImageElement | null;
    if (!box || !img || !img.naturalWidth) return null;
    const rect = box.getBoundingClientRect();
    return {
      frame: { w: Math.round(rect.width), h: Math.round(rect.height) },
      natural: { w: img.naturalWidth, h: img.naturalHeight },
    };
  }).catch(() => null);
  await Promise.all([...phoneContexts.map((each) => each.close()), context.close()]);
  return { game: target.game, round: target.round, pressed, scene: type, frame, ...metrics };
}

const ONLY = (process.env['N10_GAMES'] ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const deck = ONLY.length ? GAMES.filter((target) => ONLY.includes(target.game)) : GAMES;

test.describe('N-10: ingressi', () => {
  test('layout shift e long task per i giochi della scaletta', async ({ browser }) => {
    test.setTimeout(900_000);
    const token = await bootstrapToken(browser);
    const rows: Row[] = [];
    writeFileSync(OUT, '');

    for (const target of deck) {
      const row = await measureGame(browser, token, target);
      rows.push(row);
      writeFileSync(OUT, `${rows.map((value) => JSON.stringify(value)).join('\n')}\n`);
      console.log(
        `N-10 ${row.game.padEnd(18)} scena=${String(row.scene).padEnd(18)} cls=${String(row.cls).padEnd(7)} `
        + `shift=${row.shifts} long=${row.longtasks} max=${row.maxLongMs}ms `
        + `nodi=${row.nodes.slice(0, 3).map((node) => `${node.node}(${node.value})`).join(' ')}`,
      );
    }

    const missing = rows.filter((row) => !row.scene);
    if (missing.length) console.log(`N-10 scene non aperte: ${missing.map((row) => row.game).join(', ')}`);
  });
});

/**
 * La cornice della foto riserva la sua area: l'immagine che arriva non deve
 * allargare la colonna e far saltare titolo e indizio insieme.
 */
test.describe('N-10: foto e card', () => {
  test('la cornice di Indovina chi non si allarga', async ({ browser }) => {
    test.setTimeout(300_000);
    const token = await bootstrapToken(browser);
    const row = await measureGame(browser, token, { game: 'IMAGE_BLUR', round: 4 });
    console.log(`N-10 cornice cls=${row.cls} shift=${row.shifts} nodi=${JSON.stringify(row.nodes)}`);
    expect(row.scene).toBe('IMAGE_BLUR');
    const frame = row.nodes.filter((node) => node.node.includes('blur-main-container'));
    expect(frame.map((node) => `${node.node}=${node.value}`).join(' ')).toBe('');
    expect(row.cls).toBeLessThan(0.01);

    // La cornice segue la foto: niente striscia centrale con 270 px di nero.
    expect(row.frame, 'cornice non trovata').not.toBeNull();
    const frameRatio = row.frame!.frame.w / row.frame!.frame.h;
    const photoRatio = row.frame!.natural.w / row.frame!.natural.h;
    expect(Math.abs(frameRatio - photoRatio)).toBeLessThan(0.12);
  });

  test('la badge di connessione non sposta la scena', async ({ browser }) => {
    test.setTimeout(300_000);
    const token = await bootstrapToken(browser);
    const row = await measureGame(browser, token, { game: 'QUIZ', round: 1 });
    console.log(`N-10 badge cls=${row.cls} shift=${row.shifts} nodi=${JSON.stringify(row.nodes)}`);
    expect(row.scene).toBe('QUIZ');
    const shell = row.nodes.filter((node) => node.node.includes('conn-shell'));
    expect(shell.map((node) => `${node.node}=${node.value}`).join(' ')).toBe('');
  });

  test('la card di Biglie non cambia altezza', async ({ browser }) => {
    test.setTimeout(300_000);
    const token = await bootstrapToken(browser);
    const row = await measureGame(browser, token, { game: 'BIGLIE', round: 10 });
    console.log(`N-10 card cls=${row.cls} shift=${row.shifts} nodi=${JSON.stringify(row.nodes)}`);
    expect(row.scene).toBe('BIGLIE');
    const card = row.nodes.filter((node) => node.node.includes('bg-card'));
    expect(card.map((node) => `${node.node}=${node.value}`).join(' ')).toBe('');
    expect(row.cls).toBeLessThan(0.01);
  });
});

/**
 * Il rullo delle categorie cambia nome ogni 90 ms: la sua scatola non deve
 * cambiare misura, altrimenti ogni tick sposta il rullo (l'ingresso più
 * rumoroso di Quiz, Timeline e Ultima spiaggia).
 */
test.describe('N-10: rullo categorie', () => {
  test('il rullo non sposta la scena', async ({ browser }) => {
    test.setTimeout(300_000);
    const token = await bootstrapToken(browser);
    const gameId = await createGame(token);
    const context = await browser.newContext({ viewport: VIEWPORT });
    const tv = await context.newPage();
    await instrumentObservers(tv);
    await seedRound(tv, 1);
    await openTv(tv, gameId);

    const phoneContexts = [];
    for (let index = 1; index <= PHONES; index += 1) {
      const phoneContext = await browser.newContext({ ...devices['iPhone 14'] });
      phoneContexts.push(phoneContext);
      const phone = await phoneContext.newPage();
      await joinPhone(phone, gameId, `ROLL${index}`);
    }
    const session = await context.newCDPSession(tv);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await seekRound(tv, 1);
    expect(await pressAdvance(tv)).toBe(true);

    const reelState = () => tv.evaluate(() => {
      const component: any = (window as any).ng?.getComponent(
        document.querySelector('app-game-component'),
      );
      return {
        rolling: Boolean(component?.slotRolling?.()),
        name: String(component?.slotRollName?.() ?? ''),
      };
    });
    let sawRoll = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if ((await reelState()).rolling) {
        sawRoll = true;
        break;
      }
      await tv.waitForTimeout(250);
    }
    await reset(tv);
    // Il nastro deve girare davvero: si contano i nomi diversi visti.
    const names = new Set<string>();
    for (let tick = 0; tick < 22; tick += 1) {
      names.add((await reelState()).name);
      await tv.waitForTimeout(250);
    }

    const metrics = await readMetrics(tv);
    await Promise.all([...phoneContexts.map((each) => each.close()), context.close()]);

    const reel = metrics.nodes.filter((node) => node.node.includes('slot-row'));
    console.log(
      `N-10 rullo cls=${metrics.cls} shift=${metrics.shifts} nomi=${names.size} `
      + `nodi=${JSON.stringify(metrics.nodes)}`,
    );
    expect(sawRoll, 'il rullo non è mai partito: misura vuota').toBe(true);
    expect(names.size, 'il nastro non ha cambiato nome').toBeGreaterThan(4);
    expect(reel.map((node) => `${node.node}=${node.value}`).join(' ')).toBe('');
    expect(metrics.cls).toBeLessThan(0.005);
  });
});
