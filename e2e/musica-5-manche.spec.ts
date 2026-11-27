import { devices, expect, test, type Browser, type BrowserContext, type Page } from 'playwright/test';
import { BACKEND_PORT } from './ports';

/**
 * Musica: un round della serata vera, cinque manche.
 *
 * La scaletta apre con Musica (round 1 di 40, il primo dei quattro Musica),
 * quindi il test non ha bisogno di un deck di prova: tema e cinque brani
 * arrivano dal server. Nessun indice media locale: i brani vengono da
 * `music-themes.json`, che è nel repository.
 */
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
// Deve combaciare con CONTROL_SECRET del backend in playwright.config.ts.
const REGIA_SECRET = 'e2e-control-secret-0000000000000000';
const MANCHES = 5;

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
  // Niente `sim`: la scaletta vera apre proprio con Musica.
  await page.goto(`/tv?regia=${encodeURIComponent(REGIA_SECRET)}&debug=1`);
  await openLobby(page);
  await page.locator('.pairing-code').waitFor({ state: 'visible', timeout: 45_000 });
}

async function pairAdmin(page: Page, gameId: number, code: string): Promise<void> {
  await page.addInitScript((id) => localStorage.setItem('activeGameId', String(id)), gameId);
  await page.goto(`/admin?pair=${code.replace(/\D/g, '')}`);
  await expect(page.getByRole('button', { name: /PARTI/ }).first()).toBeVisible({ timeout: 60_000 });
  // Il verdetto parte dalla socket della regia: aspettare il pulsante non
  // basta se la connessione è ancora in apertura.
  await page.waitForFunction(() => {
    const admin = (window as any).ng?.getComponent(document.querySelector('app-admin-component'));
    return admin?.ws?.connected?.() === true;
  }, null, { timeout: 30_000 });
}

async function joinPhone(page: Page, gameId: number, name: string): Promise<void> {
  await page.goto(`/play?game=${gameId}`);
  await page.locator('#team-name').fill(name);
  // La pagina ha animazioni continue: Playwright non la considera mai
  // "stable", quindi il click deve essere forzato.
  await page.getByRole('button', { name: 'AVANTI' }).click({ force: true });
  await page.getByRole('button', { name: 'CONFERMA E ENTRA' }).click({ force: true });
  await expect(page.locator('.header-round, app-button-test')).toBeVisible({ timeout: 30_000 });
  // Un rientro con la stessa sessione salta la prova dei pulsanti.
  await page.reload();
  await expect(page.locator('.header-round')).toBeVisible({ timeout: 30_000 });
}

test.describe('Musica: cinque manche in un round', () => {
  let bootstrapToken = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await openTv(page, 1);
      const id = await activeGameId();
      expect(id, 'nessuna partita attiva dopo APRI LOBBY').not.toBeNull();
      bootstrapToken = (await page.evaluate(
        (gameId) => localStorage.getItem(`pubgame.session.${gameId}.TV`) ?? '',
        id!,
      )) || '';
      expect(bootstrapToken, 'token TV assente nella lobby').not.toBe('');
    } finally {
      await context.close();
    }
  });

  test('N-07: la Musica chiude le cinque manche e passa al gioco dopo', async ({ browser }) => {
    test.setTimeout(300_000);
    const gameId = await createGame(bootstrapToken);
    const contexts: BrowserContext[] = [];
    const open = async (mobile = false) => {
      const context = await browser.newContext(mobile ? { ...devices['iPhone 14'] } : {});
      contexts.push(context);
      return context.newPage();
    };

    try {
      const tv = await open();
      await openTv(tv, gameId);
      const code = (await tv.locator('.pairing-code').innerText()).replace(/\D/g, '');
      const admin = await open();
      await pairAdmin(admin, gameId, code);
      const phone = await open(true);
      await joinPhone(phone, gameId, 'MUS-1');

      // Giro 1 della scaletta: un click sulla dock di debug apre Musica.
      await tv.locator('.dock-btn.advance').click();
      await expect(tv.locator('app-song .music-board')).toBeVisible({ timeout: 90_000 });

      const ledger = (label: string) =>
        tv.locator('.ledger-row').filter({ hasText: label }).locator('.ledger-value');
      const manche = ledger('MANCA');
      const theme = tv.locator('.music-ledger .ledger-theme');

      await expect(ledger('ROUND')).toHaveText('1/4');
      await expect(manche).toHaveText('1/5');
      // `textContent`: il tema è scritto in maiuscolo solo dal CSS.
      const themeName = ((await theme.textContent()) ?? '').trim();
      expect(themeName, 'tema del round').not.toBe('');

      // Il tasto si arma solo nella fase BUZZ, quindi è lui la finestra di
      // prenotazione: nessun altro stato da aspettare.
      const buzz = phone.locator('.buzz-button.music-theme');
      const titles: string[] = [];

      for (let step = 1; step <= MANCHES; step += 1) {
        await expect(manche, `manca ${step} annunciata`).toHaveText(`${step}/5`, { timeout: 30_000 });
        await expect(theme, `tema della manca ${step}`).toHaveText(themeName);
        await expect(buzz, `prenotazione della manca ${step}`).toBeEnabled({ timeout: 45_000 });
        await buzz.click({ force: true });

        await expect(tv.locator('.buzz-alert .alert-name')).toHaveText('MUS-1', { timeout: 20_000 });
        await expect(admin.locator('.buzzed-player-name')).toContainText('MUS-1', { timeout: 20_000 });

        // Le pagine animate non diventano mai "stabili": il verdetto va forzato.
        await admin.locator('.decision-btn.btn-correct').click({ force: true });

        // Risposta giusta: reveal con titolo e artista del brano, non un segnaposto.
        const title = tv.locator('.song-reveal .reveal-title');
        await expect(title, `reveal della manca ${step}`).toHaveText(/\S/, { timeout: 20_000 });
        const text = ((await title.textContent()) ?? '').trim();
        expect(titles, `brano ripetuto nella manca ${step}`).not.toContain(text);
        titles.push(text);
        await expect(tv.locator('.song-reveal .reveal-artist')).toHaveText(/\S/);

        // Il reveal dura otto secondi e la manca dopo parte da sola.
      }

      // Quinta manca chiusa: il round finisce e la serata riparte da sola.
      await expect(tv.locator('.auto-advance-count')).toBeVisible({ timeout: 30_000 });
      // Il round dopo è Quiz: la Musica ha lasciato la scena al momento giusto.
      await expect(tv.locator('.question-area')).toBeVisible({ timeout: 120_000 });
    } finally {
      for (const context of contexts) await context.close();
    }
  });
});
