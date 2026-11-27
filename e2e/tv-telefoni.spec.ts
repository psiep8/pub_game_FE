import { devices, expect, test, type Browser, type Page } from 'playwright/test';
import { BACKEND_PORT } from './ports';

// Stessa porta del webServer: E2E_BACKEND_PORT sposta entrambi.
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
// Deve combaciare con CONTROL_SECRET del backend in playwright.config.ts.
const REGIA_SECRET = 'e2e-control-secret-0000000000000000';

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

async function openTv(page: Page, gameId: number, options: { sim?: boolean; debug?: boolean } = {}): Promise<void> {
  await page.addInitScript(({ id, demos }) => {
    localStorage.setItem('activeGameId', String(id));
    // La prima apparizione di un gioco apre una demo che ferma il round: in
    // E2E la saltiamo, come una serata in cui i giochi sono già stati visti.
    localStorage.setItem(`demoSeen:${id}`, JSON.stringify(demos));
  }, { id: gameId, demos: DEMO_TYPES });
  const params = new URLSearchParams();
  // La TV di sala si apre col segreto: senza, N-01 la lascia una lobby senza
  // codice di abbinamento e senza permessi di lettura.
  params.set('regia', REGIA_SECRET);
  if (options.sim) params.set('sim', '1');
  if (options.debug) params.set('debug', '1');
  const query = params.toString();
  const url = `/tv${query ? `?${query}` : ''}`;
  // La sessione iniziale la riprova la TV da sola: nessun reload di soccorso.
  await page.goto(url);
  await openLobby(page);
  await page.locator('.pairing-code').waitFor({ state: 'visible', timeout: 45_000 });
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

  test('N-04: Cavallo con una domanda per squadra e un tabellone unico', async ({ browser }) => {
    const { tv, admin, phones, close } = await setup(browser, bootstrapToken, 'N04');

    try {
      // La socket della regia può essere ancora in apertura subito dopo il
      // pairing: il primo comando può cadere nel vuoto, come in sala.
      await admin.waitForTimeout(2500);
      await admin.getByRole('button', { name: /BONUS CAVALLO/ }).click();

      // Categoria: le tre squadre scelgono la stessa voce e la sfida parte
      // senza aspettare i quindici secondi.
      const firstCategory = phones[0].locator('.cavallo-category').first();
      await expect(firstCategory).toBeVisible({ timeout: 45_000 });
      const category = (await firstCategory.innerText()).trim();
      for (const phone of phones) {
        const choice = phone.locator('.cavallo-category', { hasText: category }).first();
        await expect(choice).toBeEnabled({ timeout: 20_000 });
        // Anche qui la pagina ha animazioni continue: senza force il click
        // aspetta la stabilità e non parte mai.
        await choice.click({ force: true });
      }

      // La TV mostra la categoria scelta e un solo tabellone con tutte le
      // squadre: il totale delle giuste è sempre su otto domande.
      await expect(tv.locator('.cav-cat')).toHaveText(category, { timeout: 30_000 });
      const board = tv.locator('app-cavallo-bonus .cav-board');
      await expect(board).toHaveCount(1);
      await expect(board.locator('.cav-row')).toHaveCount(3);
      const names = (await board.locator('.cav-name').allInnerTexts())
        .map((name) => name.trim()).sort();
      expect(names).toEqual(['N04-1', 'N04-2', 'N04-3']);

      // Otto passi condivisi: ogni telefono legge la domanda della propria
      // squadra, mai quella degli altri.
      for (let step = 1; step <= 8; step += 1) {
        const questions = await Promise.all(phones.map(async (phone) => {
          const question = phone.locator('.cavallo-question');
          await expect(question, `domanda ${step} sul telefono`).toBeVisible({ timeout: 30_000 });
          return (await question.innerText()).trim();
        }));
        expect(new Set(questions).size, `domande uguali al passo ${step}`).toBe(3);

        for (const phone of phones) {
          const option = phone.locator('.cavallo-option').first();
          await expect(option).toBeEnabled({ timeout: 10_000 });
          await option.click({ force: true });
        }

        // Tutte le squadre hanno risposto: la TV mostra l'esito e il tabellone
        // resta lo stesso. Il passo successivo riapre la domanda.
        await Promise.all(phones.map((phone) =>
          expect(phone.locator('.cavallo-question')).toBeHidden({ timeout: 15_000 })));
        await expect(board.locator('.cav-row')).toHaveCount(3);
      }

      // Dopo l'ottava domanda il bonus chiude: il tabellone unico resta con il
      // totale delle giuste di ogni squadra.
      await expect(tv.locator('.cav-finale')).toBeVisible({ timeout: 20_000 });
      await expect(board.locator('.cav-row')).toHaveCount(3);
      for (const score of await board.locator('.cav-score').allInnerTexts()) {
        expect(score.trim(), 'punteggio del tabellone').toMatch(/^[0-8]\/8$/);
      }
    } finally {
      await close();
    }
  });
});

/**
 * N-07 — il ticchettio del timer non deve sopravvivere alla scena che lo ha
 * chiesto.
 *
 * Campiona ogni 5 s le sorgenti audio attive (`channelSnapshot()`, la stessa
 * fotografia del pannello `?audiodebug=1`) in una serata simulata vera: TV +
 * tre telefoni contro il backend reale. Un loop `clock` può stare acceso solo
 * dentro un conto alla rovescia vivo.
 *
 * Causa riprodotta: la Musica tickava per tutto il round (deve stare nel
 * silenzio) e la ripresa dalla pausa riaccendeva il tick anche su un round già
 * chiuso, dove nessun `onTimerEnd` sarebbe più arrivato a fermarlo.
 */
test.describe('N-07: il tick del timer ha un proprietario', () => {
  let token = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await openTv(page, 1);
    const id = await activeGameId();
    expect(id, 'nessuna partita attiva dopo APRI LOBBY').not.toBeNull();
    token = (await page.evaluate(
      (gameId) => localStorage.getItem(`pubgame.session.${gameId}.TV`) ?? '',
      id!,
    )) || '';
    expect(token, 'token TV assente nella lobby').not.toBe('');
    await context.close();
  });

  /** La fotografia che in sala si legge dietro `?audiodebug=1`. */
  const channels = (tv: Page) => tv.evaluate(() => {
    const component: any = (window as any).ng?.getComponent(document.querySelector('app-game-component'));
    return (component?.audioService?.channelSnapshot?.() ?? []) as Array<{
      channel: string; label: string; owner: string; event?: string;
    }>;
  });

  /** Campiona ogni 5 s: è la richiesta «campiona ogni 5 s le sorgenti attive». */
  const sampleEvery = async (tv: Page, samples: number) => {
    const out: Array<Array<{ event?: string }>> = [];
    for (let index = 0; index < samples; index += 1) {
      await tv.waitForTimeout(5_000);
      out.push(await channels(tv));
    }
    return out;
  };

  test('nessun tic fuori dal conto alla rovescia', async ({ browser }) => {
    test.setTimeout(360_000);
    const { tv, phones, close } = await setup(browser, token, 'N07');

    try {
      // Scaletta simulata: QUIZ, MUSIC. La dock di debug è il percorso della regia.
      const advance = tv.locator('.dock-btn.advance');
      await expect(advance).toBeVisible();
      await advance.click();
      await expect(tv.locator('.question-area')).toBeVisible({ timeout: 90_000 });

      // Prova del campionamento: nel Quiz il tic deve esserci davvero.
      const duringQuiz = await sampleEvery(tv, 4);
      expect(
        duringQuiz.some((rows) => rows.some((row) => row.event === 'clock')),
        'il Quiz non ha mai mostrato il loop clock: il campionamento non guarda la scena giusta',
      ).toBe(true);

      // Musica: silenzio per scelta, nessun tic sotto gli ascolti.
      await advance.click();
      await expect(tv.locator('app-song .music-board')).toBeVisible({ timeout: 90_000 });
      const duringMusic = (await sampleEvery(tv, 5)).flat()
        .filter((row) => row.event === 'clock');
      expect(duringMusic, `tic durante la Musica: ${JSON.stringify(duringMusic)}`).toEqual([]);

      // Pausa e ripresa a metà round: il tick non deve tornare.
      const pause = tv.locator('.dock-btn[aria-label="Pausa"]');
      await pause.click();
      await tv.waitForTimeout(1_500);
      await pause.click();
      const afterPause = (await sampleEvery(tv, 3)).flat()
        .filter((row) => row.event === 'clock');
      expect(afterPause, 'tic riacceso dalla ripresa della pausa').toEqual([]);

      // Ricarica della TV a metà round: la ripresa non riapre il tick.
      await tv.reload();
      const recovery = tv.locator('.recovery-panel');
      await expect(recovery).toBeVisible({ timeout: 60_000 });
      await recovery.getByRole('button', { name: 'Riprendi' }).click();
      await expect(tv.locator('app-song .music-board')).toBeVisible({ timeout: 60_000 });
      const afterReload = (await sampleEvery(tv, 3)).flat()
        .filter((row) => row.event === 'clock');
      expect(afterReload, 'tic riacceso dalla ripresa dopo la ricarica').toEqual([]);

      // I telefoni sono entrati davvero: il banco è quello della serata.
      await expect(phones[0].locator('.header-round')).toBeVisible();
    } finally {
      await close();
    }
  });
});
