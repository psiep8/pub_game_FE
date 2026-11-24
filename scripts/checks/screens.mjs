#!/usr/bin/env node
/**
 * Cattura le schermate principali ai cinque viewport della serata e cerca
 * overflow, testi troppo piccoli e bersagli sotto i 44 px.
 *
 * Uso: BASE_URL=http://127.0.0.1:4210 node scripts/checks/screens.mjs
 * Filtri facoltativi: `SCREENS=demo` (solo le demo) e `VIEWPORTS=tv|phone`
 * (solo i formati indicati), per un giro mirato mentre si lavora su una scena.
 * Richiede `playwright` (devDependency) e `npx playwright install chromium`.
 * Le immagini finiscono in docs/AUDIT-GRAFICO/screens/<viewport>/<schermata>.png,
 * il referto in docs/AUDIT-GRAFICO/screens/report.json e report.md.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4210';
const OUT = path.resolve('docs/AUDIT-GRAFICO/screens');

const viewports = [
  { id: 'tv-1920x1080', width: 1920, height: 1080, phone: false },
  { id: 'tv-1600x900', width: 1600, height: 900, phone: false },
  { id: 'tv-1366x768', width: 1366, height: 768, phone: false },
  { id: 'tv-1280x720', width: 1280, height: 720, phone: false },
  { id: 'tv-1024x768', width: 1024, height: 768, phone: false },
  { id: 'phone-360x640', width: 360, height: 640, phone: true },
  { id: 'phone-390x844', width: 390, height: 844, phone: true },
  { id: 'phone-412x915', width: 412, height: 915, phone: true },
];

/**
 * Le demo della serata, nell'ordine di `DEMO_ORDER` in `demo-scripts.ts`.
 * Sono aperte con `?demo=<chiave>`, la via che la TV usa per l'anteprima.
 * Se una demo nuova sfugge a questo elenco, il referto la segnala come mancante.
 */
const DEMO_KEYS = [
  'INTRO',
  'QUIZ',
  'MUSIC',
  'IMAGE_BLUR',
  'WHEEL_OF_FORTUNE',
  'TIMELINE',
  'TIME_BUZZER',
  'BOMBA',
  'SPEED_RUSH',
  'TENNIS_BATTLE',
  'ARENA',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BIGLIE',
  'BONUS_CASINO_COLOR',
  'BONUS_BLACKJACK',
  'BONUS_CASINO_DOZEN',
  'BONUS_CAVALLO',
  'BONUS_CASINO_NUMBER',
];

const screens = [
  { id: 'tv-intro', path: '/tv', for: 'tv' },
  { id: 'tv-lobby', path: '/tv', for: 'tv', click: '.intro-start' },
  // `quad=1` è la via che la regia usa per aprire un telefono in un browser
  // desktop: senza, la guardia mobile rimanda a /tv.
  { id: 'play', path: '/play?quad=1', for: 'phone' },
  { id: 'audio', path: '/audio', for: 'phone' },
  { id: 'bonus-preview', path: '/bonus-preview', for: 'tv' },
  { id: 'admin', path: '/admin', for: 'tv' },
  // Ogni demo, nei cinque formati TV: area sicura, nessuno scroll, testo ≥ 20 px.
  ...DEMO_KEYS.map((key) => ({
    id: `demo-${key.toLowerCase().replaceAll('_', '-')}`,
    path: `/tv?demo=${key}&regia=1`,
    for: 'tv',
    demo: true,
  })),
];

const auditScript = ({ phone, demo }) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`;
  };
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const overflow = [];
  const smallTargets = [];
  const tinyText = [];
  const outsideSafeArea = [];
  const smallDemoText = [];

  // Demo: la scena è 16:9 e il contenuto deve stare dentro il 5% dai bordi.
  const frame = demo ? document.querySelector('.demo-frame') : null;
  // Una demo che non si apre non deve passare per «nessun problema»: la
  // pagina vuota è il guasto più facile da non vedere in un referto.
  const demoFrameMissing = !!demo && !frame;
  const safe = frame ? frame.getBoundingClientRect() : null;
  const safeBox = safe
    ? {
      left: safe.left + safe.width * 0.05,
      right: safe.right - safe.width * 0.05,
      top: safe.top + safe.height * 0.05,
      bottom: safe.bottom - safe.height * 0.05,
    }
    : null;

  // Nelle demo conta solo la scena: la lobby che resta dietro non è in onda.
  for (const el of (demo && frame ? frame : document.body).querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const bleedsRight = rect.right > vw + 1;
    const bleedsLeft = rect.left < -1;
    const scrolls = el.scrollWidth > el.clientWidth + 1 && /visible|auto|scroll/.test(style.overflowX);
    if (!demo && (bleedsRight || bleedsLeft || (scrolls && el.clientWidth > 0))) {
      overflow.push({
        selector: describe(el),
        text: textOf(el),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        why: bleedsRight ? 'esce a destra' : bleedsLeft ? 'esce a sinistra' : 'scroll orizzontale',
      });
    }

    if (phone && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      if (rect.width < 44 || rect.height < 44) {
        smallTargets.push({
          selector: describe(el),
          text: textOf(el) || el.getAttribute('aria-label') || el.getAttribute('href') || '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }

    if (phone && textOf(el).length > 0 && el.children.length === 0) {
      const size = parseFloat(style.fontSize);
      if (size > 0 && size < 12) {
        tinyText.push({ selector: describe(el), text: textOf(el), fontSize: size });
      }
    }

    if (safeBox && frame.contains(el) && el !== frame) {
      const inside = rect.left >= safeBox.left - 1
        && rect.right <= safeBox.right + 1
        && rect.top >= safeBox.top - 1
        && rect.bottom <= safeBox.bottom + 1;
      if (!inside) {
        outsideSafeArea.push({
          selector: describe(el),
          text: textOf(el),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        });
      }
    }

    if (demo && textOf(el).length > 0 && el.children.length === 0) {
      const size = parseFloat(style.fontSize);
      if (size > 0 && size < 20) {
        smallDemoText.push({ selector: describe(el), text: textOf(el), fontSize: size });
      }
    }
  }

  const doc = document.documentElement;
  return {
    url: location.href,
    viewport: { width: vw, height: vh },
    horizontalOverflow: doc.scrollWidth > vw + 1,
    documentScrollWidth: doc.scrollWidth,
    overflow,
    smallTargets,
    tinyText,
    demo: !!demo,
    demoFrameMissing,
    outsideSafeArea,
    smallDemoText,
    demoScrolls: demo ? doc.scrollWidth > vw + 1 || doc.scrollHeight > vh + 1 : false,
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];

const screensFilter = (process.env.SCREENS || '').trim();
const viewportFilter = (process.env.VIEWPORTS || '').trim();
const chosenScreens = screensFilter === 'demo'
  ? screens.filter((screen) => screen.demo)
  : screensFilter === 'base'
    ? screens.filter((screen) => !screen.demo)
    : screens;
const chosenViewports = viewportFilter === 'tv'
  ? viewports.filter((vp) => !vp.phone)
  : viewportFilter === 'phone'
    ? viewports.filter((vp) => vp.phone)
    : viewportFilter
      ? viewports.filter((vp) => vp.id === viewportFilter)
      : viewports;

for (const vp of chosenViewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const dir = path.join(OUT, vp.id);
  await mkdir(dir, { recursive: true });

  for (const screen of chosenScreens) {
    if (screen.for === 'tv' && vp.phone) continue;
    if (screen.for === 'phone' && !vp.phone) continue;

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 200));
    });

    try {
      await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);
      if (screen.click) {
        const target = page.locator(screen.click).first();
        if (await target.count()) await target.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
      await page.screenshot({
        path: path.join(dir, `${screen.id}.png`),
        fullPage: false,
        animations: 'disabled',
      });
      const audit = await page.evaluate(auditScript, { phone: vp.phone, demo: !!screen.demo });
          const demoBroken = audit.demoFrameMissing || (audit.demo && errors.length > 0);
      results.push({ ...audit, screen: screen.id, viewport: vp.id, ok: !demoBroken, errors });
      console.log(`${vp.id}/${screen.id}: overflow=${audit.overflow.length} targets=${audit.smallTargets.length} tiny=${audit.tinyText.length} safe=${audit.outsideSafeArea.length} demoText=${audit.smallDemoText.length}`);
    } catch (err) {
      results.push({ screen: screen.id, viewport: vp.id, ok: false, error: String(err), errors, overflow: [], smallTargets: [], tinyText: [] });
      console.error(`${vp.id}/${screen.id}: FALLITO ${err}`);
    }
    await page.close();
  }
  await context.close();
}

await browser.close();

const overflow = results.flatMap((r) => (r.overflow || []).map((o) => ({ screen: r.screen, viewport: r.viewport, ...o })));
const targets = results.flatMap((r) => (r.smallTargets || []).map((o) => ({ screen: r.screen, viewport: r.viewport, ...o })));
const tiny = results.flatMap((r) => (r.tinyText || []).map((o) => ({ screen: r.screen, viewport: r.viewport, ...o })));
const demoResults = results.filter((r) => r.demo);
const outsideSafe = results.flatMap((r) => (r.outsideSafeArea || []).map((o) => ({ screen: r.screen, viewport: r.viewport, ...o })));
const tinyDemo = results.flatMap((r) => (r.smallDemoText || []).map((o) => ({ screen: r.screen, viewport: r.viewport, ...o })));
const demoScroll = results.filter((r) => r.demoScrolls);
const demoMissing = results.filter((r) => r.demoFrameMissing);
const failed = results.filter((r) => !r.ok);
const bleeding = results.filter((r) => r.horizontalOverflow);

await writeFile(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));

const uniq = (list, key) => {
  const seen = new Map();
  for (const item of list) {
    const k = `${item.screen}|${item.viewport}|${item.selector}|${key(item)}`;
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.values()];
};

const lines = [
  '# Referto schermate',
  '',
  `Base: ${BASE} · ${new Date().toISOString()}`,
  '',
  `- Schermate catturate: **${results.filter((r) => r.ok).length}** (fallite: ${failed.length})`,
  `- Pagine con scroll orizzontale: **${bleeding.length}**`,
  `- Elementi che escono dal viewport: **${uniq(overflow, (o) => o.why).length}**`,
  `- Bersagli sotto 44 px (telefono): **${uniq(targets, (o) => o.selector).length}**`,
  `- Testi sotto 12 px (telefono): **${uniq(tiny, (o) => o.selector).length}**`,
  `- Demo catturate: **${demoResults.filter((r) => r.ok).length}** su ${DEMO_KEYS.length * 5} attese (5 formati TV)`,
  `- Demo con elementi fuori dall'area sicura: **${uniq(outsideSafe, (o) => o.selector).length}**`,
  `- Demo con testo sotto 20 px: **${uniq(tinyDemo, (o) => o.selector).length}**`,
  `- Demo con scroll: **${demoScroll.length}**`,
  '',
];

if (demoMissing.length) {
  lines.push('## Demo che non si aprono', '');
  for (const r of demoMissing) lines.push(`- ${r.viewport}/${r.screen}: manca la scena demo (pagina vuota o errore)`);
  lines.push('');
}
if (demoResults.length < DEMO_KEYS.length * 5) {
  lines.push('## Demo mancanti', '');
  lines.push(`Catturate ${demoResults.length} demo su ${DEMO_KEYS.length * 5} (${DEMO_KEYS.length} chiavi × 5 formati).`);
  lines.push('');
}
if (outsideSafe.length) {
  lines.push('## Demo fuori dall\'area sicura', '');
  for (const o of uniq(outsideSafe, (x) => x.selector).slice(0, 80)) {
    lines.push(`- ${o.viewport}/${o.screen}: \`${o.selector}\` (${o.left}→${o.right}, ${o.top}→${o.bottom}) «${o.text}»`);
  }
  lines.push('');
}
if (tinyDemo.length) {
  lines.push('## Demo con testo sotto 20 px', '');
  for (const t of uniq(tinyDemo, (x) => x.selector).slice(0, 80)) {
    lines.push(`- ${t.viewport}/${t.screen}: \`${t.selector}\` ${t.fontSize}px «${t.text}»`);
  }
  lines.push('');
}
if (demoScroll.length) {
  lines.push('## Demo con scroll', '');
  for (const r of demoScroll) lines.push(`- ${r.viewport}/${r.screen}: la pagina scorre`);
  lines.push('');
}
if (failed.length) {
  lines.push('## Schermate fallite', '');
  for (const f of failed) lines.push(`- ${f.viewport}/${f.screen}: ${f.error}`);
  lines.push('');
}
if (bleeding.length) {
  lines.push('## Scroll orizzontale', '');
  for (const r of bleeding) lines.push(`- ${r.viewport}/${r.screen}: documento ${r.documentScrollWidth}px su viewport ${r.viewport}`);
  lines.push('');
}
if (overflow.length) {
  lines.push('## Elementi fuori viewport', '');
  for (const o of uniq(overflow, (x) => x.why).slice(0, 80)) {
    lines.push(`- ${o.viewport}/${o.screen}: \`${o.selector}\` ${o.why} (${o.left}→${o.right}, ${o.scrollWidth}/${o.clientWidth}) «${o.text}»`);
  }
  lines.push('');
}
if (targets.length) {
  lines.push('## Bersagli sotto 44 px', '');
  for (const t of uniq(targets, (x) => x.selector).slice(0, 80)) {
    lines.push(`- ${t.viewport}/${t.screen}: \`${t.selector}\` ${t.width}×${t.height} «${t.text}»`);
  }
  lines.push('');
}
if (tiny.length) {
  lines.push('## Testi sotto 12 px', '');
  for (const t of uniq(tiny, (x) => x.selector).slice(0, 80)) {
    lines.push(`- ${t.viewport}/${t.screen}: \`${t.selector}\` ${t.fontSize}px «${t.text}»`);
  }
  lines.push('');
}
await writeFile(path.join(OUT, 'report.md'), lines.join('\n') + '\n');

console.log(`\nReferto: ${path.join(OUT, 'report.md')}`);
// Le demo sono un criterio di fine: fuori area sicura, testo piccolo o scroll
// fanno fallire il controllo, non solo il referto.
if (failed.length > 0 || outsideSafe.length > 0 || tinyDemo.length > 0
  || demoScroll.length > 0 || demoMissing.length > 0) {
  process.exitCode = 1;
}
