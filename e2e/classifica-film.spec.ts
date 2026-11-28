import { expect, test, type Page } from 'playwright/test';

/**
 * N-15 — il layout della classifica «da film».
 *
 * Il test non dipende dal flusso della serata: monta la TV in simulazione e
 * inietta lo stesso stato che il componente riceverebbe dallo storico server.
 * Così può fermarsi sui posti che interessano (ultimo, terzo, primo) senza
 * aspettare il reveal completo e senza telefoni.
 *
 * Condizioni: 1280×720, 1366×768 e 1366×768 a zoom 125%, 14 e 20 squadre,
 * nomi lunghi e statistiche reali. Il caso zoom usa il viewport CSS efficace
 * (1093×614): il browser a 125% riduce lo spazio di layout, non i pixel fisici.
 */

interface Viewport {
  width: number;
  height: number;
}

interface Scenario {
  label: string;
  viewport: Viewport;
}

const SCENARIOS: Scenario[] = [
  { label: '1280×720', viewport: { width: 1280, height: 720 } },
  { label: '1366×768', viewport: { width: 1366, height: 768 } },
  {
    label: '1366×768 a zoom 125%',
    viewport: { width: Math.round(1366 / 1.25), height: Math.round(768 / 1.25) },
  },
];
const FILM = 'app-leaderboard-detailed';

interface Rect {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface LayoutSnapshot {
  player: string | null;
  position: string | null;
  showcase: Rect | null;
  stats: Rect | null;
  preannounce: Rect | null;
  preannounceText: string | null;
  preannouncePosition: string | null;
  statsInsideShowcase: boolean;
  preannounceInsideShowcase: boolean;
  statsOverlaps: string[];
  preannounceOverlaps: string[];
  clipped: string[];
  showcaseOverflow: boolean;
}

async function openTv(page: Page): Promise<void> {
  await page.goto('/tv?sim=1');
  await page.locator('app-game-component').waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('app-game-component');
    return !!(window as any).ng?.getComponent(host);
  });
}

/**
 * Apre la dettagliata con uno storico coerente: ogni round contiene tutte le
 * squadre, comprese quelle a zero punti. I nomi lunghi servono a stressare le
 * due colonne delle statistiche.
 */
async function mountFilm(page: Page, count: number): Promise<void> {
  await page.evaluate(({ total }) => {
    const ng = (window as any).ng;
    const host = document.querySelector('app-game-component');
    const component: any = ng.getComponent(host);
    component.dismissIntro?.();
    component.phase?.set('IDLE');
    component.showLeaderboardQuick?.set(false);
    component.isShowingLeaderboard?.set(false);
    ng.applyChanges(host);

    const names = Array.from({ length: total }, (_, index) =>
      index % 3 === 0
        ? `LA SQUADRA DEL QUARTIERE ${index + 1}`
        : `SQUADRA ${String(index + 1).padStart(2, '0')}`,
    );
    component.leaderboardService.replaceAll(names.map((playerName, index) => ({
      playerName,
      totalPoints: (total - index) * 100,
    })));

    const types = ['MUSIC', 'QUIZ', 'ARENA', 'WHEEL_OF_FORTUNE', 'QUIZ', 'MUSIC', 'ARENA', 'QUIZ'];
    const rounds = types.map((type, roundIndex) => ({
      roundIndex,
      type,
      entries: names.map((playerName, index) => ({
        playerName,
        points: ((index * 3 + roundIndex * 2) % 7 - 3) * 40,
        totalPoints: (total - index) * 100 + roundIndex * 7,
      })),
    }));

    component.leaderboardHistory.set({ gameId: component.currentGameId(), rounds });
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);
    ng.applyChanges(host);
  }, { total: count });

  // L'host del componente è inline e ha box zero: la scena visibile è il
  // figlio fixed che contiene la copertina.
  await expect(page.locator(`${FILM} .grand-leaderboard`)).toBeVisible({ timeout: 10_000 });
}

async function waitForNaturalPreannounce(page: Page, expectedTitle: string): Promise<void> {
  // Nessuna iniezione qui: aspettiamo il timer del reveal vero. I tre
  // preavvisi arrivano in sequenza prima del terzo, del secondo e del primo.
  await page.waitForFunction((title) => {
    const preannounce = document.querySelector('app-leaderboard-detailed .film-preannounce');
    if (!preannounce) return false;
    const text = (preannounce.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text.includes('TRA POCO') || !text.includes(title)) return false;
    const rect = preannounce.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, expectedTitle, { timeout: 45_000 });
}

async function snapshotAt(page: Page, position: number | null): Promise<LayoutSnapshot> {
  return page.evaluate(({ wanted }) => {
    const FILM = 'app-leaderboard-detailed';
    const ng = (window as any).ng;
    const host = document.querySelector('app-game-component');
    const component: any = ng.getComponent(host);
    const filmElement = document.querySelector('app-leaderboard-detailed');
    const film: any = ng.getComponent(filmElement);

    if (wanted !== null) {
      const target = component.leaderboardService
        .getLeaderboard()
        .find((player: any) => Number(player.position) === wanted);
      if (!target) throw new Error(`Posizione ${wanted} assente`);

      // Il reveal continua in background: fissiamo il fotogramma da misurare.
      film.currentPlayer.set(target);
      film.podiumSoon.set(wanted <= 3 ? wanted : null);
      ng.applyChanges(filmElement);
    }

    const q = (selector: string): HTMLElement | null =>
      document.querySelector(`${FILM} ${selector}`) as HTMLElement | null;
    const rect = (element: HTMLElement | null): Rect | null => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {
        x: r.x, y: r.y, top: r.top, right: r.right, bottom: r.bottom, left: r.left,
        width: r.width, height: r.height,
      };
    };
    const overlaps = (a: Rect | null, b: Rect | null): boolean =>
      !!a && !!b && !(a.bottom <= b.y || a.y >= b.bottom || a.right <= b.x || a.x >= b.right);
    const inside = (inner: Rect | null, outer: Rect | null): boolean =>
      !!inner && !!outer
      && inner.top >= outer.top - 1
      && inner.left >= outer.left - 1
      && inner.bottom <= outer.bottom + 1
      && inner.right <= outer.right + 1;

    const showcase = rect(q('.player-showcase'));
    const stats = rect(q('.film-stats'));
    const preannounce = rect(q('.film-preannounce'));
    const contentTargets: Array<[string, HTMLElement | null]> = [
      ['.position-number', q('.position-number')],
      ['.player-name-massive', q('.player-name-massive')],
      ['.points-showcase', q('.points-showcase')],
      ['.medal', q('.medal')],
      ['.crown-massive', q('.crown-massive')],
      ['.film-stats', q('.film-stats')],
    ];

    const statsOverlaps = contentTargets
      .filter(([selector]) => selector !== '.film-stats')
      .filter(([, element]) => overlaps(stats, rect(element)))
      .map(([selector]) => selector);
    const preannounceOverlaps = preannounce
      ? contentTargets
        .filter(([, element]) => overlaps(preannounce, rect(element)))
        .map(([selector]) => selector)
      : [];

    const clipped: string[] = [];
    const statsText = q('.film-stats');
    if (statsText && statsText.scrollWidth > statsText.clientWidth + 1) {
      clipped.push('.film-stats');
    }
    for (const element of document.querySelectorAll<HTMLElement>(`${FILM} .film-stat-value`)) {
      if (element.scrollWidth > element.clientWidth + 1) {
        clipped.push(`.film-stat-value:${element.textContent?.trim() ?? ''}`);
      }
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      `${FILM} .film-preannounce-title, ${FILM} .film-preannounce-kicker`,
    )) {
      if (element.scrollWidth > element.clientWidth + 1) {
        clipped.push(`.film-preannounce:${element.textContent?.trim() ?? ''}`);
      }
    }

    const showcaseElement = q('.player-showcase');
    return {
      player: q('.player-name-massive')?.textContent?.trim() ?? null,
      position: q('.position-number')?.textContent?.trim() ?? null,
      showcase,
      stats,
      preannounce,
      preannounceText: q('.film-preannounce')?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
      preannouncePosition: preannounce
        ? getComputedStyle(q('.film-preannounce')!).position
        : null,
      statsInsideShowcase: inside(stats, showcase),
      preannounceInsideShowcase: preannounce ? inside(preannounce, showcase) : true,
      statsOverlaps,
      preannounceOverlaps,
      clipped,
      showcaseOverflow: !!showcaseElement
        && showcaseElement.scrollHeight > showcaseElement.clientHeight + 1,
    };
  }, { wanted: position });
}

function expectLayout(
  snapshot: LayoutSnapshot,
  label: string,
  withPreannounce: boolean,
  viewport: Viewport,
): void {
  expect(snapshot.player, `${label}: giocatore`).toBeTruthy();
  expect(snapshot.stats, `${label}: statistiche mancanti`).not.toBeNull();
  expect(snapshot.statsInsideShowcase, `${label}: statistiche fuori dalla copertina`).toBe(true);
  expect(snapshot.statsOverlaps, `${label}: statistiche sovrapposte`).toEqual([]);
  expect(snapshot.clipped, `${label}: testo tagliato`).toEqual([]);
  expect(snapshot.showcaseOverflow, `${label}: copertina tagliata`).toBe(false);

  if (!withPreannounce) {
    expect(snapshot.preannounce, `${label}: timbro inatteso`).toBeNull();
    return;
  }

  expect(snapshot.preannounce, `${label}: timbro assente`).not.toBeNull();
  expect(snapshot.preannounceInsideShowcase, `${label}: timbro fuori dalla copertina`).toBe(true);
  expect(snapshot.preannounceOverlaps, `${label}: timbro sovrapposto`).toEqual([]);
  expect(snapshot.preannouncePosition).toBe('absolute');
  expect(snapshot.preannounceText).toContain('TRA POCO');
  expect(snapshot.preannounce!.width).toBeLessThan(viewport.width / 2);
  expect(snapshot.preannounce!.height).toBeLessThan(viewport.height / 2);
}

for (const scenario of SCENARIOS) {
  for (const teams of [14, 20]) {
    test(`classifica da film, ${teams} squadre a ${scenario.label}: niente sovrapposizioni o clipping`, async ({ page }) => {
      await page.setViewportSize(scenario.viewport);
      await openTv(page);
      await mountFilm(page, teams);

      // Il reveal reale produce tre preavvisi: prima del terzo, del secondo
      // e del vincitore. Ognuno deve restare nella copertina.
      const naturalPreannouncements = [
        { title: 'IL PODIO · 3° POSTO', label: 'naturale 3° posto' },
        { title: 'IL PODIO · 2° POSTO', label: 'naturale 2° posto' },
        { title: 'IL VINCITORE', label: 'naturale vincitore' },
      ];
      for (const preannouncement of naturalPreannouncements) {
        await waitForNaturalPreannounce(page, preannouncement.title);
        const snapshot = await snapshotAt(page, null);
        expectLayout(snapshot, `${preannouncement.label}, ${teams} squadre`, true, scenario.viewport);
        expect(snapshot.preannounceText).toContain(preannouncement.title);
      }

      // Dopo l'attesa il sync del server può aver svuotato la classifica di
      // prova: rimontiamo lo stesso stato per i fotogrammi fissi.
      await mountFilm(page, teams);

      // Poi i fotogrammi fissi, per coprire anche ultimo e primo posto.
      for (const position of [teams, 3, 1]) {
        expectLayout(
          await snapshotAt(page, position),
          `posizione ${position}`,
          position <= 3,
          scenario.viewport,
        );
      }
    });
  }
}