import { expect, test, type Page } from 'playwright/test';

/**
 * N-11 — banco del riepilogo di fine round.
 *
 * Cinque taglie (4/8/10/14/20 squadre) nella scena vera a 1280×720, con la dock
 * della regia a schermo: righe, ombre, fascia della testata e nessuno scroll.
 * Poi la pausa da tastiera: ESC ferma l'orologio, la ripresa torna sulla stessa
 * pagina e allo stesso secondo.
 *
 * Le righe si creano dal percorso vero (`beginRoundScoring` + `checkLeaderboardDisplay`),
 * non injectando il template: il banco misura anche l'apertura del riepilogo.
 */

const VIEWPORT = { width: 1280, height: 720 };

const NAMES = [
  'LE IENE',
  'BAR SPORT',
  'GLI SCAFATI',
  'QUIZZONE',
  'AMICI DI PEPPA',
  'I TOSTI',
  'LA BANDA',
  'IL SOSIA',
  'PICCOLI',
  'DOPPIO MALTO',
  'IL MURO',
  'ZERO ALCOL',
  'I RAGAZZI DEL PONTE',
  'NON CI CREDO',
  'TUTTI A CASA',
  'MAMMA MIA',
  'PEPERONCINO',
  'IL SOLE',
  'BOH',
  'ULTIMO',
];

function names(count: number): string[] {
  return NAMES.slice(0, count);
}

/** La TV in modalità regia: senza `?debug=1` la dock non c'è e il banco non misura nulla. */
async function openTv(page: Page): Promise<void> {
  await page.goto('/tv?debug=1');
  await page.waitForSelector('app-game-component', { timeout: 45_000 });
  await page.waitForFunction(
    () => Boolean((window as any).ng?.getComponent),
    null,
    { timeout: 45_000 },
  );
  await page.evaluate(() => {
    const component: any = (window as any).ng.getComponent(
      document.querySelector('app-game-component'),
    );
    component.dismissIntro();
    // La pausa usa il game id per il broadcast: senza partita il foglio non ne ha uno.
    component.currentGameId.set(1);
    // Il banco misura il riepilogo: la coda del round resta deterministica.
    component.startScheduledBonus = () => false;
    component.roundManager.shouldShowLeaderboard = () => null;
  });
}

/** Apre il riepilogo con `count` squadre passando dal percorso vero della regia. */
async function openRecap(page: Page, count: number): Promise<void> {
  await page.evaluate((list: string[]) => {
    const component: any = (window as any).ng.getComponent(
      document.querySelector('app-game-component'),
    );
    // Dopo una pausa sul podio la sala resta ferma: il foglio nuovo deve partire.
    component.isPaused.set(false);
    component.leaderboardService.replaceAll(
      list.map((playerName, index) => ({
        playerName,
        totalPoints: (list.length - index) * 80 + 40,
      })),
    );
    component.currentMode.set({ type: 'QUIZ' });
    component.beginRoundScoring();
    list.forEach((playerName, index) => {
      component.leaderboardService.addPoints(
        playerName,
        index % 5 === 0 ? -(index * 15 + 10) : index * 25 + 30,
        true,
      );
    });
    component.checkLeaderboardDisplay();
  }, names(count));

  await expect(page.locator('.recap-sheet')).toBeVisible();
  await page.waitForTimeout(250);
}

/** Geometria del foglio e delle righe, con le ombre calcolate dai loro offset. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const box = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: +rect.top.toFixed(1),
        bottom: +rect.bottom.toFixed(1),
        left: +rect.left.toFixed(1),
        right: +rect.right.toFixed(1),
        width: +rect.width.toFixed(1),
      };
    };
    const dock = document.querySelector('.tv-dock');
    const recap = document.querySelector('.recap');
    const dockBox = box(dock);
    const sheet = box(document.querySelector('.recap-sheet'));
    const header = box(document.querySelector('.recap-head'));
    const footer = box(document.querySelector('.recap-foot'));
    const pauseButton = document.querySelector('.tv-dock .dock-btn[aria-label="Pausa"]');

    let pauseHit: boolean | null = null;
    if (pauseButton) {
      const rect = pauseButton.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      pauseHit = Boolean(hit?.closest('.tv-dock'));
    }

    return {
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      dock: dockBox,
      sheet,
      header,
      footer,
      pauseHit,
      dockZ: dock ? getComputedStyle(dock).zIndex : null,
      recapZ: recap ? getComputedStyle(recap).zIndex : null,
      stamp: document.querySelector('.recap-paused')?.textContent?.trim() ?? null,
      counter: document.querySelector('.recap-counter')?.textContent?.trim() ?? null,
      few: document.querySelector('.recap-rows')?.classList.contains('is-few') ?? false,
      rows: [...document.querySelectorAll('.recap-row')].map((row) => {
        const rect = row.getBoundingClientRect();
        const style = getComputedStyle(row);
        const offsets = style.boxShadow.match(/-?\d+(?:\.\d+)?px/g)?.map((value) => parseFloat(value)) ?? [];
        const name = row.querySelector('.recap-name') as HTMLElement | null;
        return {
          name: name?.textContent?.trim() ?? null,
          top: +rect.top.toFixed(1),
          bottom: +rect.bottom.toFixed(1),
          height: +rect.height.toFixed(1),
          shadowRight: +(rect.right + (offsets[0] ?? 0)).toFixed(1),
          shadowBottom: +(rect.bottom + (offsets[1] ?? 0)).toFixed(1),
          align: name ? getComputedStyle(name).textAlign : null,
          clipped: name ? name.scrollWidth > name.clientWidth + 1 : false,
        };
      }),
    };
  });

/** Stato del componente: la pausa congela `totalRemaining`, la ripresa usa la deadline. */
const recapState = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('app-round-recap');
    if (!element) return { paused: false };
    const recap: any = (window as any).ng.getComponent(element);
    const now = Date.now();
    return {
      paused: recap.paused,
      page: recap.pageIndex(),
      pages: recap.pages().length,
      frozenMs: Math.round(recap.totalRemaining),
      leftMs: recap.doneDeadline ? Math.max(0, Math.round(recap.doneDeadline - now)) : null,
    };
  });

test.describe('N-11: riepilogo nella scena vera', () => {
  test.use({ viewport: VIEWPORT });

  test('matrice 4/8/10/14/20 con dock e pausa ESC', async ({ page }) => {
    test.setTimeout(240_000);
    await openTv(page);

    const rowsPerPage: Record<number, number> = { 4: 4, 8: 8, 10: 10, 14: 7, 20: 7 };
    const counters: Record<number, string | null> = { 4: null, 8: null, 10: null, 14: '1 / 2', 20: '1 / 3' };

    for (const count of [4, 8, 10, 14, 20]) {
      await openRecap(page, count);
      const before = await layout(page);

      expect(before.rows.length, `righe a ${count} squadre`).toBe(rowsPerPage[count]);
      expect(before.counter, `contatore pagine a ${count} squadre`).toBe(counters[count]);
      expect(before.dock, 'dock assente: il banco gira senza ?debug=1').not.toBeNull();
      expect(before.recapZ, 'riepilogo assente').not.toBeNull();
      expect(Number(before.dockZ), 'dock sotto il riepilogo').toBeGreaterThan(Number(before.recapZ));
      expect(before.header!.top, 'testata sotto la dock').toBeGreaterThanOrEqual(before.dock!.bottom - 0.5);
      expect(before.pauseHit, 'la dock è coperta dal riepilogo').toBe(true);
      expect(before.sheet!.top).toBeGreaterThanOrEqual(0);
      expect(before.sheet!.bottom).toBeLessThanOrEqual(VIEWPORT.height);
      expect(before.scroll).toEqual([VIEWPORT.width, VIEWPORT.height]);

      // Poche righe: il foglio si riempie. Da otto in su la misura non cambia.
      expect(before.few, `variante poche righe a ${count} squadre`).toBe(count === 4);
      if (count === 4) {
        expect(before.rows[0].height, 'la pagina da quattro non riempie il foglio').toBeGreaterThan(100);
        expect(before.rows.at(-1)!.bottom, 'la pagina da quattro si ferma a metà').toBeGreaterThan(640);
      } else {
        expect(before.rows[0].height, `la taglia ${count} non deve cambiare`).toBeLessThan(70);
      }
      console.log(
        `N-11 n=${count} righe=${before.rows.length} h=${before.rows[0]?.height} `
        + `prima=${before.rows[0]?.top} ultima=${before.rows.at(-1)?.bottom} `
        + `ombra=${before.rows.at(-1)?.shadowBottom} piede=${before.footer?.top} few=${before.few}`,
      );

      for (const row of before.rows) {
        expect(row.height, `riga troppo schiacciata (${row.name})`).toBeGreaterThanOrEqual(30);
        expect(row.shadowRight, `ombra oltre il foglio (${row.name})`).toBeLessThanOrEqual(before.sheet!.right + 0.5);
        expect(row.shadowBottom, `ombra sul piede (${row.name})`).toBeLessThanOrEqual(before.footer!.top + 0.5);
        expect(row.align, `nome non a filo (${row.name})`).toBe('left');
        expect(row.clipped, `nome tagliato (${row.name})`).toBe(false);
      }

      // ESC: la sala si ferma e l'orologio non consuma scena.
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await recapState(page)).paused).toBe(true);
      const paused = await recapState(page);
      expect(paused.frozenMs).toBeGreaterThan(0);
      await page.waitForTimeout(1_300);
      const stillPaused = await recapState(page);
      expect(stillPaused.frozenMs, 'il tempo scorre in pausa').toBe(paused.frozenMs);
      expect(stillPaused.page).toBe(paused.page);
      expect((await layout(page)).stamp).toBe('PAUSA');

      // ESC: riprende dallo stesso punto, un secondo dopo ne manca uno in meno.
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await recapState(page)).paused).toBe(false);
      const resumed = await recapState(page);
      expect(Math.abs((resumed.leftMs ?? 0) - paused.frozenMs)).toBeLessThan(400);
      const pageAtResume = resumed.page;
      const startedAt = Date.now();
      await page.waitForTimeout(1_100);
      const later = await recapState(page);
      const elapsed = Date.now() - startedAt;
      const spent = (resumed.leftMs ?? 0) - (later.leftMs ?? 0);
      expect(Math.abs(spent - elapsed), 'la ripresa non scala il tempo vero').toBeLessThan(400);
      expect(later.page).toBe(pageAtResume);

      // Podio: l'ultima pagina non deve appoggiare l'ombra sul piede.
      if (later.pages > 1) {
        await page.keyboard.press('Escape');
        await expect.poll(async () => (await recapState(page)).paused).toBe(true);
        await page.evaluate(() => {
          const recap: any = (window as any).ng.getComponent(document.querySelector('app-round-recap'));
          recap.pageIndex.set(recap.lastPage());
        });
        await page.waitForTimeout(250);
        const podium = await layout(page);
        expect(podium.rows.length).toBe(count === 20 ? 6 : 7);
        expect(podium.counter).toBe(count === 20 ? '3 / 3' : '2 / 2');
        for (const row of podium.rows) {
          expect(row.shadowRight).toBeLessThanOrEqual(podium.sheet!.right + 0.5);
          expect(row.shadowBottom).toBeLessThanOrEqual(podium.footer!.top + 0.5);
        }
        expect((await recapState(page)).page).toBe(later.pages - 1);
      }

      await page.evaluate(() => {
        const component: any = (window as any).ng.getComponent(
          document.querySelector('app-game-component'),
        );
        if (component.roundRecapOpen()) component.onRoundRecapComplete();
        component.stopAutoAdvance();
      });
      await expect(page.locator('.recap-sheet')).toHaveCount(0);
    }
  });

  test('poche righe: 2, 3, 5 squadre con il tetto', async ({ page }) => {
    test.setTimeout(120_000);
    await openTv(page);

    for (const count of [2, 3, 4, 5]) {
      await openRecap(page, count);
      const before = await layout(page);

      expect(before.few, `variante poche righe a ${count} squadre`).toBe(true);
      expect(before.rows.length).toBe(count);
      for (const row of before.rows) {
        expect(row.height, `riga enorme con ${count} squadre`).toBeLessThan(126);
        expect(row.height, `riga schiacciata con ${count} squadre`).toBeGreaterThan(90);
        expect(row.shadowRight).toBeLessThanOrEqual(before.sheet!.right + 0.5);
        expect(row.shadowBottom).toBeLessThanOrEqual(before.footer!.top + 0.5);
        expect(row.align).toBe('left');
      }
      if (count === 4) {
        expect(before.rows.at(-1)!.bottom, 'la pagina da quattro non riempie').toBeGreaterThan(640);
      }
      console.log(
        `N-11 few n=${count} h=${before.rows[0]?.height} prima=${before.rows[0]?.top} `
        + `ultima=${before.rows.at(-1)?.bottom} ombra=${before.rows.at(-1)?.shadowBottom} piede=${before.footer?.top}`,
      );

      await page.evaluate(() => {
        const component: any = (window as any).ng.getComponent(
          document.querySelector('app-game-component'),
        );
        if (component.roundRecapOpen()) component.onRoundRecapComplete();
        component.stopAutoAdvance();
      });
      await expect(page.locator('.recap-sheet')).toHaveCount(0);
    }
  });

  test('AVANTI con il riepilogo aperto passa dalla coda del round', async ({ page }) => {
    test.setTimeout(120_000);
    await openTv(page);
    await openRecap(page, 10);

    // La coda deve partire: se AVANTI salta al gioco dopo, il bonus si perde.
    await page.evaluate(() => {
      const component: any = (window as any).ng.getComponent(
        document.querySelector('app-game-component'),
      );
      const scope = window as any;
      scope.__bonusTail = false;
      scope.__newRound = false;
      component.startScheduledBonus = () => {
        scope.__bonusTail = true;
        return true;
      };
      component.startNewRound = () => {
        scope.__newRound = true;
        return Promise.resolve();
      };
    });

    const advance = page.locator('.tv-dock .dock-btn.advance');
    await expect(advance).toBeEnabled();
    await advance.click();

    const result = await page.evaluate(() => {
      const component: any = (window as any).ng.getComponent(
        document.querySelector('app-game-component'),
      );
      return {
        open: component.roundRecapOpen(),
        bonusTail: (window as any).__bonusTail,
        newRound: (window as any).__newRound,
      };
    });

    expect(result.open, 'il riepilogo è rimasto aperto').toBe(false);
    expect(result.bonusTail, 'la coda del round non è partita: bonus perso').toBe(true);
    expect(result.newRound, 'AVANTI è saltato direttamente al gioco dopo').toBe(false);
    await expect(page.locator('.recap-sheet')).toHaveCount(0);
  });
});

test.describe('N-11: riepilogo a 1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('il foglio segue la larghezza e le righe restano dentro', async ({ page }) => {
    test.setTimeout(120_000);
    await openTv(page);

    // Altezze attese a 1080p: tetto 17vh (183,6), cinque righe 151,4,
    // otto 90,9, dieci 70,7, sette righe al massimo di 96.
    const heights: Record<number, number> = {
      2: 183.6, 3: 183.6, 4: 183.6, 5: 151.4, 8: 90.9, 10: 70.7, 14: 96, 20: 96,
    };

    for (const count of [2, 3, 4, 5, 8, 10, 14, 20]) {
      await openRecap(page, count);
      const before = await layout(page);

      // Il foglio prende 7/8 della larghezza: 1680 su 1920, come 1120 su 1280.
      expect(before.sheet!.left, `margine sinistro a ${count}`).toBeGreaterThan(119);
      expect(before.sheet!.left, `margine sinistro a ${count}`).toBeLessThan(121);
      expect(before.sheet!.right, `margine destro a ${count}`).toBeGreaterThan(1799);
      expect(before.sheet!.right, `margine destro a ${count}`).toBeLessThan(1801);
      expect(before.scroll).toEqual([1920, 1080]);
      expect(before.header!.top).toBeGreaterThanOrEqual(before.dock!.bottom - 0.5);
      expect(before.few, `variante poche righe a ${count}`).toBe(count <= 5);
      expect(before.rows.length).toBe(count <= 10 ? count : 7);

      for (const row of before.rows) {
        expect(row.height, `riga fuori misura a ${count} squadre`).toBeGreaterThan(heights[count] - 2.5);
        expect(row.height, `riga fuori misura a ${count} squadre`).toBeLessThan(heights[count] + 2.5);
        expect(row.shadowRight, `ombra oltre il foglio (${row.name})`).toBeLessThanOrEqual(1800.5);
        expect(row.shadowBottom, `ombra sul piede (${row.name})`).toBeLessThanOrEqual(before.footer!.top + 0.5);
        expect(row.clipped, `nome tagliato (${row.name})`).toBe(false);
      }
      if (count === 4) {
        expect(before.rows.at(-1)!.bottom, 'la pagina da quattro non riempie').toBeGreaterThan(960);
      }
      console.log(
        `N-11 1080 n=${count} righe=${before.rows.length} h=${before.rows[0]?.height} `
        + `foglio=${before.sheet!.left}→${before.sheet!.right} ultima=${before.rows.at(-1)?.bottom}`,
      );

      await page.evaluate(() => {
        const component: any = (window as any).ng.getComponent(
          document.querySelector('app-game-component'),
        );
        if (component.roundRecapOpen()) component.onRoundRecapComplete();
        component.stopAutoAdvance();
      });
      await expect(page.locator('.recap-sheet')).toHaveCount(0);
    }
  });
});