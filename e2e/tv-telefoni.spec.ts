import { devices, expect, test, type Browser, type Page } from 'playwright/test';

const BACKEND = 'http://127.0.0.1:8095';

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

const DEMO_TYPES = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'TIME_BUZZER',
  'BOMBA', 'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA', 'AZZARDO', 'BLACKJACK', 'ARENA',
  'SPEED_RUSH', 'BIGLIE', 'BONUS_CAVALLO', 'BONUS_KARAOKE', 'BONUS_BIGLIE',
];

async function openTv(page: Page, gameId: number, options: { sim?: boolean; debug?: boolean } = {}): Promise<void> {
  await page.addInitScript(({ id, demos }) => {
    localStorage.setItem('activeGameId', String(id));
    // La prima apparizione di un gioco apre una demo che ferma il round: in
    // E2E la saltiamo, come una serata in cui i giochi sono già stati visti.
    localStorage.setItem(`demoSeen:${id}`, JSON.stringify(demos));
  }, { id: gameId, demos: DEMO_TYPES });
  const params = new URLSearchParams();
  if (options.sim) params.set('sim', '1');
  if (options.debug) params.set('debug', '1');
  const query = params.toString();
  await page.goto(`/tv${query ? `?${query}` : ''}`);
  const intro = page.locator('.intro-screen');
  await intro.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  if (await intro.isVisible().catch(() => false)) {
    await intro.click({ force: true });
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.pairing-code')).toBeVisible({ timeout: 60_000 });
}

async function pairAdmin(page: Page, gameId: number, code: string): Promise<void> {
  await page.addInitScript((id) => localStorage.setItem('activeGameId', String(id)), gameId);
  await page.goto(`/admin?pair=${code.replace(/\D/g, '')}`);
  await expect(page.getByRole('button', { name: /PARTI/ }).first()).toBeVisible({ timeout: 60_000 });
}

async function joinPhone(page: Page, gameId: number, name: string): Promise<void> {
  await page.goto(`/play?game=${gameId}`);
  await page.locator('#team-name').fill(name);
  // La pagina ha animazioni continue: Playwright non la considera mai
  // "stable", quindi il click deve essere forzato.
  await page.getByRole('button', { name: 'AVANTI' }).click({ force: true });
  await page.getByRole('button', { name: 'CONFERMA E ENTRA' }).click({ force: true });
  // All'ingresso parte la prova dei pulsanti. Un rientro con la stessa
  // sessione (refresh) salta la prova, come un telefono che si riconnette.
  await expect(page.locator('.header-round, app-button-test')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator('.header-round')).toBeVisible({ timeout: 30_000 });
}

async function setup(
  browser: Browser,
  tvToken: string,
  name: string,
  options: { phoneClock?: boolean } = {},
): Promise<{ gameId: number; tv: Page; admin: Page; phones: Page[]; close: () => Promise<void> }> {
  const gameId = await createGame(tvToken);
  const contexts = [];
  const open = async (mobile = false) => {
    const context = await browser.newContext(mobile ? { ...devices['iPhone 14'] } : {});
    contexts.push(context);
    return context.newPage();
  };
  const tv = await open();
  await openTv(tv, gameId, { sim: true, debug: true });
  const code = (await tv.locator('.pairing-code').innerText()).replace(/\D/g, '');
  const admin = await open();
  await pairAdmin(admin, gameId, code);
  const phones = await Promise.all(
    [1, 2, 3].map(async (index) => {
      const phone = await open(true);
      // Prima della navigazione: il watcher della scadenza nasce in ngOnInit e
      // deve usare l'orologio controllato, non quello reale.
      if (options.phoneClock) await phone.clock.install();
      await joinPhone(phone, gameId, `${name}-${index}`);
      return phone;
    }),
  );
  await Promise.all(phones.map((phone) => expect(phone.locator('.header-round')).toBeVisible({ timeout: 30_000 })));
  return {
    gameId,
    tv,
    admin,
    phones,
    close: async () => {
      await Promise.all(contexts.map((context) => context.close()));
    },
  };
}

test.describe.serial('TV + 3 telefoni', () => {
  let bootstrapToken = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/tv');
    const lobby = page.getByRole('button', { name: /APRI LOBBY/ });
    if (await lobby.isVisible().catch(() => false)) {
      await lobby.click();
    }
    await expect(page.locator('.pairing-code')).toBeVisible({ timeout: 90_000 });
    const id = await activeGameId();
    expect(id, 'nessuna partita attiva dopo APRI LOBBY').not.toBeNull();
    bootstrapToken = (await page.evaluate(
      (gameId) => localStorage.getItem(`pubgame.session.${gameId}.TV`) ?? '',
      id!,
    )) || '';
    expect(bootstrapToken, 'token TV assente nella lobby').not.toBe('');
    await context.close();
  });

  test('N-05: dopo ROUND_ENDED i telefoni non votano più', async ({ browser }) => {
    const { admin, phones, close } = await setup(browser, bootstrapToken, 'N05', { phoneClock: true });
    const phone = phones[0];

    // La socket della regia può essere ancora in apertura subito dopo il
    // pairing: il primo PARTI può cadere nel vuoto, come in sala.
    await admin.waitForTimeout(2500);
    const start = admin.getByRole('button', { name: /PARTI/ }).first();
    await start.click();
    await expect(phone.locator('.vote-btn').first()).toBeEnabled({ timeout: 60_000 });

    await phone.clock.fastForward(10 * 60 * 1000);

    await expect(phone.locator('.round-closed-stamp')).toBeVisible({ timeout: 10_000 });
    await expect(phone.locator('.round-closed-stamp')).toContainText('ROUND FINITO');
    for (const button of await phone.locator('.vote-btn').all()) {
      await expect(button).toBeDisabled();
    }

    await close();
  });

  test('N-03: Indovina chi riarma il pulsante in tutte e tre le manche', async ({ browser }) => {
    const { tv, admin, phones, close } = await setup(browser, bootstrapToken, 'N03');

    // Scaletta simulata: QUIZ, MUSIC, IMAGE_BLUR. La dock TV (debug) è il
    // percorso del presentatore e non dipende dalla socket della regia.
    const advance = tv.locator('.dock-btn.advance');
    await expect(advance).toBeVisible();
    await advance.click(); // QUIZ
    await expect(phones[0].locator('.vote-btn').first()).toBeVisible({ timeout: 45_000 });
    await advance.click(); // MUSIC
    await expect(phones[0].locator('.buzz-button.music-theme')).toBeVisible({ timeout: 30_000 });
    await advance.click(); // IMAGE_BLUR

    // Solo il pulsante di Indovina chi: dopo il passaggio da Musica il DOM del
    // telefono tiene per un attimo il pulsante del gioco precedente, ancora
    // abilitato. Cliccarlo prenoterebbe un round già chiuso, che il server
    // scarta: il test aspetta il pulsante giusto.
    const buzz = (index: number) =>
      phones[index].locator('.buzz-container .buzz-button', { hasText: 'PRENOTATI!' });
    await expect(buzz(0)).toBeEnabled({ timeout: 45_000 });

    for (let manche = 1; manche <= 3; manche += 1) {
      await expect(buzz(manche - 1), `pulsante della manche ${manche}`).toBeEnabled({ timeout: 30_000 });
      await buzz(manche - 1).click();
      await expect(admin.locator('.buzzed-player-name')).toContainText(`N03-${manche}`, { timeout: 20_000 });
      await admin.locator('.decision-btn.btn-correct').click();
      await expect(admin.locator('.buzzed-player-name')).toBeHidden({ timeout: 20_000 });
      // Il verdetto resta 3s, poi la TV apre la manche successiva.
      if (manche < 3) {
        await expect(buzz(manche), `pulsante della manche ${manche + 1}`).toBeEnabled({ timeout: 20_000 });
      }
    }

    await close();
  });
});
