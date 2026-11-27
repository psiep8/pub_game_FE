import { devices, expect, test, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { BACKEND_PORT } from './ports';

// Stessa porta del webServer: E2E_BACKEND_PORT sposta entrambi.
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
// Deve combaciare con CONTROL_SECRET del backend in playwright.config.ts.
const REGIA_SECRET = 'e2e-control-secret-0000000000000000';

const DEMO_TYPES = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'TIME_BUZZER',
  'BOMBA', 'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA', 'AZZARDO', 'BLACKJACK', 'ARENA',
  'SPEED_RUSH', 'BIGLIE', 'BONUS_CAVALLO', 'BONUS_KARAOKE', 'BONUS_BIGLIE',
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
  const id = Number(body?.id ?? 0);
  expect(id).toBeGreaterThan(0);
  return id;
}

/** Intro e "APRI LOBBY": la TV non mostra il codice finché la lobby non è aperta. */
async function openLobby(page: Page): Promise<void> {
  const intro = page.locator('.intro-screen');
  await intro.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  if (await intro.isVisible().catch(() => false)) {
    await intro.click({ force: true });
    await page.keyboard.press('Enter');
  }
  const lobby = page.getByRole('button', { name: /APRI LOBBY/ });
  await lobby.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (await lobby.isVisible().catch(() => false)) {
    await lobby.click();
  }
}

async function openTv(page: Page, gameId: number): Promise<void> {
  await page.addInitScript(({ id, demos }) => {
    localStorage.setItem('activeGameId', String(id));
    // La prima apparizione di un gioco apre una demo che ferma il round: in
    // E2E la saltiamo, come una serata in cui i giochi sono già stati visti.
    localStorage.setItem(`demoSeen:${id}`, JSON.stringify(demos));
  }, { id: gameId, demos: DEMO_TYPES });
  await page.goto(`/tv?regia=${encodeURIComponent(REGIA_SECRET)}&sim=1&debug=1`);
  await openLobby(page);
  await page.locator('.pairing-code').waitFor({ state: 'visible', timeout: 45_000 });
}

async function pairAdmin(page: Page, gameId: number, code: string): Promise<void> {
  await page.addInitScript((id) => localStorage.setItem('activeGameId', String(id)), gameId);
  await page.goto(`/admin?pair=${code.replace(/\D/g, '')}`);
  await expect(page.getByRole('button', { name: /PARTI/ }).first()).toBeVisible({ timeout: 60_000 });
  // Il comando di bonus parte dalla socket della regia: aspettare il pulsante
  // non basta se la connessione è ancora in apertura.
  await page.waitForFunction(() => {
    const admin = (window as any).ng?.getComponent(document.querySelector('app-admin-component'));
    return admin?.ws?.connected?.() === true;
  }, null, { timeout: 30_000 });
}

async function joinPhone(page: Page, gameId: number, name: string): Promise<void> {
  await page.goto(`/play?game=${gameId}`);
  await page.locator('#team-name').fill(name);
  await page.getByRole('button', { name: 'AVANTI' }).click({ force: true });
  await page.getByRole('button', { name: 'CONFERMA E ENTRA' }).click({ force: true });
  await expect(page.locator('.header-round, app-button-test')).toBeVisible({ timeout: 30_000 });
  // Rientro con la stessa sessione: salta la prova dei pulsanti.
  await page.reload();
  await expect(page.locator('.header-round')).toBeVisible({ timeout: 30_000 });
}

async function setup(
  browser: Browser,
  tvToken: string,
): Promise<{ gameId: number; tv: Page; admin: Page; close: () => Promise<void> }> {
  const gameId = await createGame(tvToken);
  const contexts: BrowserContext[] = [];
  const open = async (mobile = false) => {
    const context = await browser.newContext(mobile ? { ...devices['iPhone 14'] } : {});
    contexts.push(context);
    return context.newPage();
  };
  const tv = await open();
  await openTv(tv, gameId);
  const code = (await tv.locator('.pairing-code').innerText()).replace(/\D/g, '');
  const admin = await open();
  await pairAdmin(admin, gameId, code);
  // Il Blackjack pesca il tavolo dai giocatori presenti: senza un telefono
  // in squadra la mano non arriva sul server.
  await joinPhone(await open(true), gameId, 'BJ-1');
  return {
    gameId,
    tv,
    admin,
    close: async () => {
      for (const context of contexts) await context.close();
    },
  };
}

test.describe('Blackjack: refresh TV a metà mano', () => {
  let bootstrapToken = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openTv(page, 1);
    const id = await activeGameId();
    expect(id, 'nessuna partita attiva dopo APRI LOBBY').not.toBeNull();
    bootstrapToken = (await page.evaluate(
      (gameId) => localStorage.getItem(`pubgame.session.${gameId}.TV`) ?? '',
      id!,
    )) || '';
    expect(bootstrapToken, 'token TV assente nella lobby').not.toBe('');
    await context.close();
  });

  test('N-06: la TV riprende le carte e la fase dopo un refresh', async ({ browser }) => {
    const { gameId, tv, admin, close } = await setup(browser, bootstrapToken);

    try {
      // La dock di debug apre il primo round: la scaletta ha un atto (0) e il
      // server ha un QUIZ da chiudere prima del bonus.
      await tv.locator('.dock-btn.advance').click();
      await expect(tv.locator('.question-area')).toBeVisible({ timeout: 60_000 });

      // Il bonus parte fuori dal round, come a fine serata: chiudiamo il QUIZ
      // sul server, altrimenti al refresh la TV propone il recupero del round.
      const closed = await tv.evaluate(async (id) => {
        const token = localStorage.getItem(`pubgame.session.${id}.TV`) ?? '';
        const response = await fetch(`/games/${id}/round/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          body: JSON.stringify({ reason: 'e2e-bonus' }),
        });
        return response.status;
      }, gameId);
      expect(closed, 'chiusura del round QUIZ').toBe(200);

      // La TV può essere a metà rullo categorie: la guardia rifiuta il comando,
      // come in sala. Si riprova finché la scena è libera.
      const blackjack = tv.locator('app-blackjack .bj-wrap');
      for (let attempt = 0; attempt < 3 && !(await blackjack.isVisible().catch(() => false)); attempt += 1) {
        await admin.getByRole('button', { name: /BONUS BLACKJACK/ }).click();
        await blackjack.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
      }
      await expect(blackjack).toBeVisible({ timeout: 45_000 });
      await expect(tv.locator('.bj-side.table .bj-card')).toHaveCount(2, { timeout: 20_000 });

      const readState = () => tv.evaluate(async (id) => {
        const token = localStorage.getItem(`pubgame.session.${id}.TV`) ?? '';
        const response = await fetch(`/games/${id}/sync`, {
          headers: { 'X-Session-Token': token },
        });
        const body = await response.json();
        return body.snapshot?.blackjackState ?? null;
      }, gameId);

      // Il checkpoint è scritto dalla TV a ogni cambio di fase: aspettiamo la
      // mano vera, non il primo render vuoto del componente.
      await expect.poll(async () => (await readState())?.phase, { timeout: 20_000 }).toBe('DECIDE');
      const before = await readState();
      expect(before.hand).toHaveLength(2);
      expect(before.bank).toHaveLength(2);
      expect(before.choice ?? null).toBeNull();
      expect(before.result ?? null).toBeNull();

      const cards = async (selector: string) =>
        (await tv.locator(`${selector} .bj-card:not(.back)`).allInnerTexts())
          .map((text) => text.replace(/\s+/g, ' ').trim());
      const tableBefore = await cards('.bj-side.table');
      const bankBefore = await cards('.bj-side.bank');
      const progressBefore = (await tv.locator('.bj-progress').innerText()).trim();
      const nameBefore = (await tv.locator('.bj-side.table .bj-label').innerText()).trim();
      expect(tableBefore).toHaveLength(2);
      expect(bankBefore).toHaveLength(1);

      await tv.reload();
      const intro = tv.locator('.intro-screen');
      if (await intro.isVisible().catch(() => false)) {
        await intro.click({ force: true });
        await tv.keyboard.press('Enter');
      }

      // La TV rilegge `blackjackState` da /sync e riapre il bonus con la mano
      // salvata: stesse carte, stesso tavolo, stessa fase.
      await expect(blackjack).toBeVisible({ timeout: 45_000 });
      await expect(tv.locator('.bj-side.table .bj-card')).toHaveCount(2, { timeout: 20_000 });
      expect(await cards('.bj-side.table')).toEqual(tableBefore);
      expect(await cards('.bj-side.bank')).toEqual(bankBefore);
      expect((await tv.locator('.bj-progress').innerText()).trim()).toBe(progressBefore);
      expect((await tv.locator('.bj-side.table .bj-label').innerText()).trim()).toBe(nameBefore);

      const after = await readState();
      expect(after.hand).toEqual(before.hand);
      expect(after.bank).toEqual(before.bank);
      expect(after.index).toBe(before.index);
      expect(after.phase).toBe('DECIDE');
    } finally {
      await close();
    }
  });
});
