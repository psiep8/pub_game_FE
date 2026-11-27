import { devices, expect, test, type BrowserContext, type Page } from 'playwright/test';
import { BACKEND_PORT } from './ports';

/**
 * M-03 — tutto ciò che in TV mostra un elenco, con 4, 8, 10, 14 e 20 squadre.
 *
 * Tre schermate fanno elenchi: la lobby (squadre collegate), il riepilogo delle
 * risposte e la classifica rapida (una riga per squadra, con le varianti dense e
 * triple oltre dieci e sedici squadre). Il banco apre una partita vera per ogni
 * dimensione, con telefoni veri e backend vero, e controlla due cose:
 *
 * - il numero di righe è esattamente quello delle squadre;
 * - nessuna riga esce dal proprio riquadro e nessuna riga si sovrappone a
 *   un'altra, perché a venti squadre un elenco che sborda è illeggibile in sala.
 */

const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
// Deve combaciare con CONTROL_SECRET del backend in playwright.config.ts.
const REGIA_SECRET = 'e2e-control-secret-0000000000000000';
const SIZES = [4, 8, 10, 14, 20];
const PHONES_PER_BATCH = 6;

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

/** Intro e «APRI LOBBY»: la TV non mostra il codice finché la lobby non è aperta. */
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
  await page.goto(`/tv?regia=${REGIA_SECRET}&sim=1&debug=1`);
  // La lobby fa fluttuare le squadre con una trasformazione continua: per
  // misurare il layout (e non il respiro dell'animazione) le animazioni CSS
  // restano ferme. I timer del gioco non c'entrano e continuano a girare.
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });
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
  await expect(page.locator('.header-round, app-button-test')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator('.header-round')).toBeVisible({ timeout: 30_000 });
}

/** Due riquadri si sovrappongono solo se si accavallano su entrambi gli assi. */
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const horizontal = a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1;
  const vertical = a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
  return horizontal && vertical;
}

test.describe.configure({ mode: 'serial' });

test.describe('M-03: elenchi con 4, 8, 10, 14 e 20 squadre', () => {
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

  for (const size of SIZES) {
    test(`${size} squadre: lobby e classifica rapida`, async ({ browser }) => {
      // Venti telefoni veri con il reload di rientro: la sala grande è lenta
      // per costruzione, non per il gioco.
      test.setTimeout(1_200_000);
      const t0 = Date.now();
      const step = (label: string) => console.log(`[${size}] ${label}: ${Math.round((Date.now() - t0) / 1000)}s`);
      const gameId = await createGame(bootstrapToken);
      const contexts: BrowserContext[] = [];
      const open = async (mobile = false): Promise<Page> => {
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

        const names = Array.from({ length: size }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
        const phones: Page[] = [];
        for (let start = 0; start < names.length; start += PHONES_PER_BATCH) {
          const batch = names.slice(start, start + PHONES_PER_BATCH);
          const joined = await Promise.all(batch.map(async (name) => {
            const phone = await open(true);
            await joinPhone(phone, gameId, name);
            return phone;
          }));
          phones.push(...joined);
          step(`telefoni ${phones.length}/${size}`);
        }

        // 1. Lobby: una riga per squadra, tutte dentro il riquadro.
        await expect.poll(
          () => tv.locator('.lobby-teams .lobby-team').count(),
          { timeout: 90_000, message: `la lobby non mostra ${size} squadre` },
        ).toBe(size);
        await expect(tv.locator('.lobby-sub')).toContainText(`${size} squadre collegate`);
        step('lobby');

        const lobbyTeams = tv.locator('.lobby-teams');
        const lobbyBox = await lobbyTeams.boundingBox();
        const lobbyItems = await tv.locator('.lobby-teams .lobby-team').all();
        expect(lobbyBox).toBeTruthy();
        for (const item of lobbyItems) {
          const box = await item.boundingBox();
          expect(box, 'una squadra della lobby non è visibile').toBeTruthy();
          expect(box!.y + box!.height, 'una squadra esce dalla lobby').toBeLessThanOrEqual(
            lobbyBox!.y + lobbyBox!.height + 1,
          );
        }
        for (let left = 0; left < lobbyItems.length; left += 1) {
          for (let right = left + 1; right < lobbyItems.length; right += 1) {
            const a = await lobbyItems[left].boundingBox();
            const b = await lobbyItems[right].boundingBox();
            expect(a && b, 'due squadre della lobby senza posizione').toBeTruthy();
            expect(overlaps(a!, b!), `squadre sovrapposte nella lobby (${left}/${right})`).toBe(false);
          }
        }
        // I nomi veri, non segnaposto ripetuti.
        const lobbyNames = await tv.locator('.lobby-teams .lobby-team b').allInnerTexts();
        expect(lobbyNames.sort()).toEqual([...names].sort());

        // 2. Classifica rapida: una riga per squadra, compatta oltre dieci e
        //    oltre sedici, senza righe che si accavallano.
        await admin.waitForTimeout(2_500);
        await admin.getByRole('button', { name: /MOSTRA CLASSIFICA/ }).click({ force: true });
        const container = tv.locator('.players-container');
        await expect(container).toHaveClass(/all-visible/, { timeout: 90_000 });
        await expect.poll(
          () => tv.locator('.players-container .player-row').count(),
          { timeout: 60_000, message: `la classifica non mostra ${size} squadre` },
        ).toBe(size);
        if (size > 10) expect(await container.getAttribute('class')).toContain('dense');
        if (size > 16) expect(await container.getAttribute('class')).toContain('triple');

        // Le righe entrano con un'animazione di 600 ms: si misura a scena ferma,
        // altrimenti le trasformazioni in volo fanno sembrare sovrapposte righe
        // che nel layout non lo sono.
        await tv.waitForTimeout(1_200);
        const rows = await tv.locator('.players-container .player-row').all();
        const rowBoxes = [];
        for (const row of rows) {
          const box = await row.boundingBox();
          expect(box, 'una riga della classifica non è visibile').toBeTruthy();
          rowBoxes.push(box!);
        }
        const containerBox = await container.boundingBox();
        expect(containerBox).toBeTruthy();
        for (const box of rowBoxes) {
          expect(box.y + box.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
        }
        // Le righe entrano con un'animazione di 600 ms: si misura a scena ferma,
        // altrimenti le trasformazioni in volo fanno sembrare sovrapposte righe
        // che nel layout non lo sono.
        step('classifica');
        for (let left = 0; left < rowBoxes.length; left += 1) {
          for (let right = left + 1; right < rowBoxes.length; right += 1) {
            expect(
              overlaps(rowBoxes[left], rowBoxes[right]),
              `righe sovrapposte in classifica (${left}/${right}): ${JSON.stringify(rowBoxes[left])} ${JSON.stringify(rowBoxes[right])}`,
            ).toBe(false);
          }
        }
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });
  }
});
