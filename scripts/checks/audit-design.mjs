#!/usr/bin/env node
/**
 * Scannerizza con Impeccable le pagine renderizzate di TV e telefono per tutti
 * gli otto temi, senza modificare la grafica.
 *
 * Uso (con il dev server già attivo):
 *   BASE_URL=http://127.0.0.1:4210 node scripts/checks/audit-design.mjs
 *
 * Per ogni tema e superficie apre la pagina con Playwright, imposta
 * `pubgame-theme` in localStorage, salva il DOM renderizzato e lo serve da un
 * piccolo proxy HTTP (le richieste di CSS/font vanno al dev server). Poi lancia
 * `impeccable detect` su ogni snapshot e scrive:
 *   - docs/AUDIT-GRAFICO/IMPECCABLE-RENDERED.md
 *   - docs/AUDIT-GRAFICO/impeccable-rendered.json
 *
 * Richiede `playwright` e `impeccable` (devDependencies) e il Chromium di
 * Playwright installato.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4210';
const OUT_DIR = path.resolve('docs/AUDIT-GRAFICO');
const IMPECCABLE = existsSync('node_modules/.bin/impeccable')
  ? path.resolve('node_modules/.bin/impeccable')
  : 'npx';

/** L'elenco vive in theme.service.ts: qui lo si legge, senza duplicarlo. */
async function loadThemes() {
  const source = await readFile(
    path.resolve('apps/frontend/src/app/core/services/theme.service.ts'),
    'utf8',
  );
  const themesBlock = source.match(/export const THEMES = \[([\s\S]*?)\] as const/);
  const labelsBlock = source.match(/export const LABELS:[\s\S]*?= \{([\s\S]*?)\};/);
  if (!themesBlock) throw new Error('THEMES non trovato in theme.service.ts');
  const ids = [...themesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const labels = Object.fromEntries(
    [...(labelsBlock?.[1] || '').matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
  );
  if (ids.length === 0) throw new Error('Elenco temi vuoto in theme.service.ts');
  return ids.map((id) => ({ id, label: labels[id] || id }));
}

const THEMES = await loadThemes();

const SURFACES = [
  { id: 'tv-intro', label: 'TV intro', path: '/tv', width: 1920, height: 1080 },
  { id: 'tv-lobby', label: 'TV lobby', path: '/tv', width: 1920, height: 1080, dismissIntro: true },
  { id: 'phone-setup', label: 'Telefono setup', path: '/play?quad=1', width: 390, height: 844 },
];

const snapshots = new Map();
const results = [];

function runDetector(url, width, height) {
  const args = ['detect', '--json', '--viewport', `${width}x${height}`, url];
  const command = IMPECCABLE === 'npx' ? 'npx' : IMPECCABLE;
  const finalArgs = IMPECCABLE === 'npx' ? ['impeccable', ...args] : args;
  return new Promise((resolve) => {
    execFile(
      command,
      finalArgs,
      {
        timeout: 120_000,
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, IMPECCABLE_BROWSER: process.env.IMPECCABLE_BROWSER },
      },
      (error, stdout, stderr) => {
        if (error && !stdout.trim()) {
          resolve({ error: String(stderr || error).slice(0, 500), findings: [] });
          return;
        }
        try {
          resolve({ findings: JSON.parse(stdout), error: null });
        } catch {
          resolve({ error: `output non JSON: ${stdout.slice(0, 200)}`, findings: [] });
        }
      },
    );
  });
}

function proxyServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/__snap/')) {
      const html = snapshots.get(url.pathname.slice('/__snap/'.length));
      if (!html) {
        res.writeHead(404).end('missing snapshot');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    try {
      const upstream = await fetch(`${BASE}${req.url}`, {
        headers: { accept: req.headers.accept || '*/*' },
      });
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.writeHead(502).end(String(err));
    }
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const name = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
    };
    const tiny = [];
    const targets = [];
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const label = text(el);
      if (label && el.children.length === 0) {
        const size = parseFloat(style.fontSize);
        if (size > 0 && size < 12) tiny.push({ selector: name(el), text: label, size });
      }
      if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && (rect.width < 44 || rect.height < 44)) {
        targets.push({
          selector: name(el),
          text: label || el.getAttribute('aria-label') || '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      tinyText: tiny,
      targets,
    };
  });
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
process.env.IMPECCABLE_BROWSER ||= chromium.executablePath();

for (const theme of THEMES) {
  for (const surface of SURFACES) {
    const id = `${theme.id}__${surface.id}`;
    const context = await browser.newContext({
      viewport: { width: surface.width, height: surface.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await context.addInitScript(([key, value]) => localStorage.setItem(key, value), ['pubgame-theme', theme.id]);
    const page = await context.newPage();
    const entry = { theme: theme.id, themeLabel: theme.label, surface: surface.id, surfaceLabel: surface.label };
    try {
      await page.goto(`${BASE}${surface.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1400);
      if (surface.dismissIntro) {
        const start = page.locator('.intro-start').first();
        if (await start.count()) await start.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(700);
      }
      const measured = await measure(page);
      const html = (await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      snapshots.set(`${id}.html`, html);
      results.push({ ...entry, measured, findings: [], error: null });
      console.log(`${id}: theme=${measured.theme} tiny=${measured.tinyText.length} targets=${measured.targets.length}`);
    } catch (err) {
      results.push({ ...entry, measured: null, findings: [], error: String(err).slice(0, 300) });
      console.error(`${id}: FALLITO ${err}`);
    }
    await context.close();
  }
}
await browser.close();

const server = proxyServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

for (const result of results) {
  if (result.error) continue;
  const surface = SURFACES.find((s) => s.id === result.surface);
  const url = `http://127.0.0.1:${port}/__snap/${result.theme}__${result.surface}.html`;
  const scan = await runDetector(url, surface.width, surface.height);
  result.findings = scan.findings;
  result.error = scan.error;
  console.log(`detect ${result.theme}/${result.surface}: ${scan.findings.length} findings${scan.error ? ` (${scan.error})` : ''}`);
}
await new Promise((resolve) => server.close(resolve));

await writeFile(path.join(OUT_DIR, 'impeccable-rendered.json'), JSON.stringify(results, null, 2));

const contrast = [];
const undersized = [];
for (const result of results) {
  for (const finding of result.findings) {
    if (finding.antipattern === 'low-contrast') contrast.push({ result, finding });
    if (finding.antipattern === 'undersized-ui-text') undersized.push({ result, finding });
  }
}
const failed = results.filter((r) => r.error);
const unique = (items, key) => {
  const seen = new Map();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen.values()];
};
const themeRows = THEMES.map((theme) => {
  const rows = results.filter((r) => r.theme === theme.id);
  const missing = rows.filter((r) => r.error).length;
  const warnings = rows.reduce((sum, r) => sum + r.findings.filter((f) => f.severity === 'warning').length, 0);
  return `| ${theme.label} (\`${theme.id}\`) | ${rows.length - missing}/${SURFACES.length} | ${contrast.filter((c) => c.result.theme === theme.id).length} | ${warnings} |`;
});

const lines = [
  '# Impeccable sulle pagine renderizzate — tutti i temi',
  '',
  `**Data:** ${new Date().toISOString().slice(0, 10)} · **motore:** Impeccable 4.10.0 · **browser:** Chromium di Playwright · **grafica non modificata**.`,
  '',
  'Generato da `scripts/checks/audit-design.mjs`. Per rifarlo:',
  '',
  '```bash',
  'BASE_URL=http://127.0.0.1:4210 node scripts/checks/audit-design.mjs',
  '```',
  '',
  '## Copertura',
  '',
  `Scansionate per **tutti gli ${THEMES.length} temi** dichiarati in \`theme.service.ts\`:`,
  '- **TV intro** (1920×1080)',
  '- **TV lobby** (1920×1080, dopo la chiusura dell\'intro)',
  '- **Telefono setup** (390×844, `?quad=1`)',
  '',
  '**Non** scansionate: round di gioco, bonus, classifiche, manuale, demo, regia/admin, regia audio, stati di errore/offline.',
  '',
  '## Temi',
  '',
  '| Tema | Superfici | Contrasti | Warning |',
  '|---|---|---|---|',
  ...themeRows,
  '',
  `Scansioni riuscite: **${results.length - failed.length}/${results.length}**.`,
  '',
];
if (failed.length) {
  lines.push('## Scansioni fallite', '');
  for (const f of failed) lines.push(`- ${f.theme}/${f.surface}: ${f.error}`);
  lines.push('');
}

lines.push('## Contrasto (WCAG AA)', '');
for (const theme of THEMES) {
  const rows = contrast.filter((c) => c.result.theme === theme.id);
  lines.push(`### ${theme.label} (\`${theme.id}\`)`, '');
  if (!rows.length) {
    lines.push('Nessun contrasto sotto soglia.', '');
    continue;
  }
  lines.push('| Superficie | Elemento | Testo su fondo | Esito |', '|---|---|---|---|');
  for (const { result, finding } of rows) {
    lines.push(`| ${result.surfaceLabel} | \`${finding.selector || '—'}\` | ${finding.snippet} | ${finding.severity} |`);
  }
  lines.push('');
}

lines.push('## Testi piccoli', '');
const allTiny = unique(
  results.flatMap((r) => (r.measured?.tinyText || []).map((t) => ({ surface: r.surfaceLabel, ...t }))),
  (t) => `${t.surface}|${t.selector}|${t.size}`,
);
if (!allTiny.length) {
  lines.push('Nessun testo sotto 12 px.', '');
} else {
  lines.push('| Superficie | Elemento | Testo | Dimensione |', '|---|---|---|---|');
  for (const t of allTiny) lines.push(`| ${t.surface} | \`${t.selector}\` | ${t.text} | ${t.size} px |`);
  lines.push('');
}
if (undersized.length) {
  lines.push('Segnalazioni del detector (`undersized-ui-text`):', '');
  for (const { result, finding } of unique(undersized, (u) => `${u.result.surface}|${u.finding.selector}`)) {
    lines.push(`- ${result.surfaceLabel}: \`${finding.selector}\` — ${finding.snippet}`);
  }
  lines.push('');
}

lines.push('## Bersagli sotto 44 px', '');
const allTargets = unique(
  results.flatMap((r) => (r.measured?.targets || []).map((t) => ({ surface: r.surfaceLabel, ...t }))),
  (t) => `${t.surface}|${t.selector}`,
);
if (!allTargets.length) {
  lines.push('Nessun bersaglio sotto 44 px.', '');
} else {
  lines.push('| Superficie | Elemento | Testo | Misura |', '|---|---|---|---|');
  for (const t of allTargets) lines.push(`| ${t.surface} | \`${t.selector}\` | ${t.text} | ${t.width}×${t.height} px |`);
  lines.push('');
}

lines.push(
  '## Note',
  '',
  '- Le ombre piene offset (`hard-offset-shadow`) sono il linguaggio voluto: compaiono come advisory e non vanno rimosse.',
  '- Le etichette mono in maiuscolo con tracking largo sono segnalate come `wide-tracking`, ma sono etichette, non body text.',
  '- Il tema è impostato via `localStorage` prima del caricamento; il DOM viene salvato dopo l\'eventuale chiusura dell\'intro e servito da un proxy locale per il detector.',
  '',
);

await writeFile(path.join(OUT_DIR, 'IMPECCABLE-RENDERED.md'), lines.join('\n'), 'utf8');
console.log(`\nReferto: ${path.join(OUT_DIR, 'IMPECCABLE-RENDERED.md')}`);
if (failed.length) process.exitCode = 1;
