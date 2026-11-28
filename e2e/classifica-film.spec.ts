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
 * Nel 1366×768 e nello zoom salviamo anche gli scatti stabili di timbro, podio
 * e vincitore, con animazioni congelate.
 */

interface Viewport {
  width: number;
  height: number;
}

interface Scenario {
  label: string;
  slug: string;
  viewport: Viewport;
  screenshots: boolean;
}

const SCENARIOS: Scenario[] = [
  { label: '1280×720', slug: '1280x720', viewport: { width: 1280, height: 720 }, screenshots: false },
  { label: '1366×768', slug: '1366x768', viewport: { width: 1366, height: 768 }, screenshots: true },
  {
    label: '1366×768 a zoom 125%',
    slug: '1366x768-zoom125',
    viewport: { width: Math.round(1366 / 1.25), height: Math.round(768 / 1.25) },
    screenshots: true,
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

async function freezeRevealTimers(page: Page): Promise<void> {
  // Dopo i tre preannunci naturali il reveal non serve più: congeliamo i
  // timer per scattare podio e vincitore su fotogrammi deterministici,
  // senza il rischio che il prossimo posto sovrascriva la scena.
  await page.evaluate(() => {
    for (let id = 1; id < 100_000; id++) window.clearTimeout(id);
    window.setTimeout = (() => 0) as any;
  });
}

async function installPreannounceRecorder(page: Page): Promise<void> {
  // Il timbro dura 1,6 s: campionarlo con waitForFunction può perdere la
  // finestra mentre il test elabora lo scatto precedente. Un observer misura
  // ogni scena appena entra nel DOM e la conserva per le asserzioni.
  await page.evaluate(() => {
    const seen: Array<{ text: string; snapshot: unknown }> = [];
    (window as any).__filmSeen = seen;
    const recorded = new Set<string>();
    const observer = new MutationObserver(() => {
      const pre = document.querySelector('app-leaderboard-detailed .film-preannounce') as HTMLElement | null;
      if (!pre) return;
      const text = (pre.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text.includes('TRA POCO') || recorded.has(text)) return;
      const box = pre.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      const measure = (window as any).__filmMeasure;
      if (typeof measure !== 'function') return;
      recorded.add(text);
      seen.push({ text, snapshot: measure() });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

async function snapshotAt(
  page: Page,
  position: number | null,
  withPreannounce = true,
  prePosition?: number,
): Promise<LayoutSnapshot> {
  const snapshot = await page.evaluate(({ wanted, showPre, preWanted }) => {
    const FILM = 'app-leaderboard-detailed';
    const ng = (window as any).ng;
    const host = document.querySelector('app-game-component');
    const component: any = ng.getComponent(host);

    if (wanted !== null) {
      const filmElement = document.querySelector('app-leaderboard-detailed');
      const film: any = ng.getComponent(filmElement);
      const target = component.leaderboardService
        .getLeaderboard()
        .find((player: any) => Number(player.position) === wanted);
      if (!target) throw new Error(`Posizione ${wanted} assente`);

      // Il reveal continua in background: fissiamo il fotogramma da misurare.
      film.currentPlayer.set(target);
      const upcoming = preWanted ?? (wanted <= 3 ? wanted : null);
      film.podiumSoon.set(showPre ? upcoming : null);
      ng.applyChanges(filmElement);
    }

    const measure = (): LayoutSnapshot => {
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
    };

    // Il recorder dei preannunci richiama questa funzione appena il timbro
    // entra nel DOM, nello stesso fotogramma.
    (window as any).__filmMeasure = measure;
    return measure();
  }, {
    wanted: position,
    showPre: withPreannounce,
    preWanted: prePosition ?? null,
  });

  return snapshot as LayoutSnapshot;
}

async function hidePlatformEmoji(page: Page): Promise<void> {
  // Le emoji native (corona/medaglia) cambiano disegno tra Windows e Linux.
  // Le nascondiamo con visibility, che conserva il layout, invece di
  // mascherarle: a zoom la maschera della corona coprirebbe anche il chip
  // «CLASSIFICA FINALE» che le passa sopra. La corona resta nel flusso, quindi
  // l'interlinea va fissata: quella del font emoji cambia tra Windows e Linux
  // e sposta di qualche pixel tutta la copertina del vincitore.
  await page.addStyleTag({
    content: [
      `${FILM} .crown-inner { visibility: hidden !important; line-height: 1 !important; }`,
      `${FILM} .medal { visibility: hidden !important; }`,
    ].join('\n'),
  });
}

async function expectStableScreenshot(
  page: Page,
  scenario: Scenario,
  teams: number,
  moment: 'timbro' | 'podio' | 'vincitore',
): Promise<void> {
  // Il timbro dura 1,6 s; il podio/vincente hanno l'ingresso della copertina.
  // Aspettiamo la fine dell'animazione e lasciamo a Playwright il congelamento
  // delle animazioni residue prima dello scatto.
  await page.waitForTimeout(moment === 'timbro' ? 300 : 1_000);
  await expect(page.locator(`${FILM} .grand-leaderboard`)).toHaveScreenshot(
    `classifica-film-${moment}-${scenario.slug}-${teams}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Corona e medaglia sono nascoste da hidePlatformEmoji: il resto della
      // copertina resta confrontabile pixel per pixel. La loro geometria è
      // già verificata dai controlli qui sopra.
      maxDiffPixelRatio: 0.01,
      threshold: 0.25,
    },
  );
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
      // `snapshotAt` installa window.__filmMeasure: il recorder deve essere
      // attivo prima che parta il reveal.
      await snapshotAt(page, null);
      await installPreannounceRecorder(page);
      await mountFilm(page, teams);

      // Il reveal reale produce tre preavvisi: prima del terzo, del secondo
      // e del vincitore. Il recorder li ha misurati appena sono comparsi.
      const naturalPreannouncements = [
        { title: 'COLPO DI SCENA · 5° POSTO', label: 'naturale 5° posto' },
        { title: 'COLPO DI SCENA · 4° POSTO', label: 'naturale 4° posto' },
        { title: 'IL PODIO · 3° POSTO', label: 'naturale 3° posto' },
        { title: 'IL PODIO · 2° POSTO', label: 'naturale 2° posto' },
        { title: 'IL VINCITORE', label: 'naturale vincitore' },
      ];
      await page.waitForFunction(
        (expected) => ((window as any).__filmSeen?.length ?? 0) >= expected,
        naturalPreannouncements.length,
        { timeout: 120_000, polling: 100 },
      );
      const recorded = await page.evaluate(
        () => (window as any).__filmSeen as Array<{ text: string; snapshot: LayoutSnapshot }>,
      );
      for (const preannouncement of naturalPreannouncements) {
        const entry = recorded.find((item) => item.text.includes(preannouncement.title));
        expect(entry, `${preannouncement.label}, ${teams} squadre: timbro non registrato`).toBeTruthy();
        expect(entry!.text).toContain('TRA POCO');
        expectLayout(entry!.snapshot, `${preannouncement.label}, ${teams} squadre`, true, scenario.viewport);
      }

      // Dopo i tre preannunci il reveal ha già dato il suo spettacolo. Per gli
      // scatti fissi fermiamo i timer, poi rimontiamo lo stesso stato.
      if (scenario.screenshots) {
        await freezeRevealTimers(page);
      }
      await mountFilm(page, teams);

      if (scenario.screenshots) {
        await hidePlatformEmoji(page);
        // Timbrato mentre la quarta squadra è in scena, come nel reveal vero.
        const timbro = await snapshotAt(page, 4, true, 3);
        expectLayout(timbro, 'fotogramma timbro', true, scenario.viewport);
        await expectStableScreenshot(page, scenario, teams, 'timbro');
      }

      // Poi i fotogrammi fissi, per coprire anche ultimo e primo posto.
      for (const position of [teams, 3, 1]) {
        expectLayout(
          await snapshotAt(page, position),
          `posizione ${position}`,
          position <= 3,
          scenario.viewport,
        );

        if (scenario.screenshots && (position === 3 || position === 1)) {
          const clean = await snapshotAt(page, position, false);
          expectLayout(clean, `posizione ${position} senza timbro`, false, scenario.viewport);
          await expectStableScreenshot(
            page,
            scenario,
            teams,
            position === 3 ? 'podio' : 'vincitore',
          );
        }
      }
    });
  }
}