#!/usr/bin/env node
/**
 * Cattura le schermate principali ai cinque viewport della serata e cerca
 * overflow, testi troppo piccoli e bersagli sotto i 44 px.
 *
 * Uso: BASE_URL=http://127.0.0.1:4210 node scripts/checks/screens.mjs
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
  { id: 'tv-1280x720', width: 1280, height: 720, phone: false },
  { id: 'phone-360x640', width: 360, height: 640, phone: true },
  { id: 'phone-390x844', width: 390, height: 844, phone: true },
  { id: 'phone-412x915', width: 412, height: 915, phone: true },
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
];

const auditScript = ({ phone }) => {
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

  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const bleedsRight = rect.right > vw + 1;
    const bleedsLeft = rect.left < -1;
    const scrolls = el.scrollWidth > el.clientWidth + 1 && /visible|auto|scroll/.test(style.overflowX);
    if (bleedsRight || bleedsLeft || (scrolls && el.clientWidth > 0)) {
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
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const dir = path.join(OUT, vp.id);
  await mkdir(dir, { recursive: true });

  for (const screen of screens) {
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
      const audit = await page.evaluate(auditScript, { phone: vp.phone });
      results.push({ ...audit, screen: screen.id, viewport: vp.id, ok: true, errors });
      console.log(`${vp.id}/${screen.id}: overflow=${audit.overflow.length} targets=${audit.smallTargets.length} tiny=${audit.tinyText.length}`);
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
  '',
];

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
if (failed.length > 0) process.exitCode = 1;
