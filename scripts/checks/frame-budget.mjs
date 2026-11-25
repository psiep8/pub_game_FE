#!/usr/bin/env node
/**
 * R-03 — Budget dei fotogrammi della scena Quiz a 1280×720 con CPU rallentata 4×.
 *
 * Apre `scripts/checks/frame-harness.html`, che usa il CSS vero della TV
 * (styles.css, game.component.css, quiz.component.css, restyle.css, alive.css)
 * e rifà la sequenza ingresso → opzioni → esito → uscita. Misura gli intervalli
 * fra fotogrammi e li confronta in quattro varianti:
 *   - `ora`       la regola F-11 attiva (alive in pausa durante entrata/uscita)
 *   - `prima`     la regola disattivata (alive sempre in movimento)
 *   - `senza-alive` bolle e respiro tolti del tutto
 *   - `senza-ombre` ombre offset spente
 *
 * Uso: node scripts/checks/frame-budget.mjs [--trace]
 * Richiede `playwright` e Chromium: `npx playwright install chromium`.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORT = Number(process.env.FRAME_PORT || 4199);
const VIEWPORT = { width: 1280, height: 720 };
const RUN_MS = 3_400;
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const variants = [
  { id: 'ora', css: '' },
  {
    id: 'prima',
    // Disattiva esattamente la regola di F-11: alive in movimento durante
    // entrata e uscita, come prima della correzione.
    css: '.game-container.stage-entrance .alive-breath, .game-container.stage-entrance .alive-drift,'
      + '.game-container.stage-entrance .alive-bubble, .game-container.stage-exit .alive-breath,'
      + '.game-container.stage-exit .alive-drift, .game-container.stage-exit .alive-bubble'
      + '{ animation-play-state: running !important; }',
  },
  {
    id: 'senza-alive',
    css: '.alive-bubbles { display: none !important; } .alive-breath, .alive-drift { animation: none !important; }',
  },
  {
    id: 'senza-ombre',
    css: '.quiz-option-btn, .result-popup, .stage-reading-card { box-shadow: none !important; }',
  },
  {
    id: 'senza-willchange',
    css: '.alive-bubble, .alive-breath, .alive-drift { will-change: auto !important; }',
  },
  {
    id: 'meno-bolle',
    css: '.alive-bubble:nth-child(n+9) { display: none !important; }',
  },
  {
    id: 'contain',
    css: '.alive-bubbles { contain: strict !important; } .alive-breath, .alive-drift { contain: layout paint !important; }',
  },
  {
    id: 'nascoste',
    css: '.game-container.stage-entrance .alive-bubbles, .game-container.stage-exit .alive-bubbles { visibility: hidden !important; }',
  },
];

const browser = await chromium.launch();
const results = [];
const RUNS = Number(process.env.FRAME_RUNS || 3);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function runOnce(variant) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (process.argv.includes('--trace')) {
    await session.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
  }

  await page.goto(`http://127.0.0.1:${PORT}/scripts/checks/frame-harness.html`, { waitUntil: 'load' });
  if (variant.css) await page.addStyleTag({ content: variant.css });
  await page.waitForTimeout(RUN_MS);

  const frames = await page.evaluate(() => window.__frames.slice(10));
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  const fps = frames.length / (frames.reduce((sum, value) => sum + value, 0) / 1000);
  const sample = {
    fotogrammi: frames.length,
    fps,
    p50: at(0.5),
    p95: at(0.95),
    max: Math.max(...frames),
    oltre33ms: frames.filter((value) => value > 33.4).length,
  };

  if (process.argv.includes('--trace')) {
    const done = new Promise((resolve) => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end');
    await done;
    const name = `docs/AUDIT-GRAFICO/trace-${variant.id}.json`;
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir('docs/AUDIT-GRAFICO', { recursive: true });
    await writeFile(name, JSON.stringify([]));
  }

  await context.close();
  return sample;
}

for (const variant of variants) {
  const samples = [];
  for (let run = 0; run < RUNS; run++) samples.push(await runOnce(variant));
  results.push({
    variante: variant.id,
    fotogrammi: Math.round(median(samples.map((sample) => sample.fotogrammi))),
    fps: Number(median(samples.map((sample) => sample.fps)).toFixed(1)),
    p50: Number(median(samples.map((sample) => sample.p50)).toFixed(1)),
    p95: Number(median(samples.map((sample) => sample.p95)).toFixed(1)),
    max: Number(median(samples.map((sample) => sample.max)).toFixed(1)),
    oltre33ms: Math.round(median(samples.map((sample) => sample.oltre33ms))),
  });
}

await browser.close();
server.close();

console.log(`Quiz TV — ${VIEWPORT.width}×${VIEWPORT.height}, CPU 4×, ${RUN_MS} ms per variante\n`);
const header = ['Variante', 'Fotogrammi', 'FPS', 'p50 ms', 'p95 ms', 'max ms', '>33 ms'];
const widths = [14, 11, 7, 8, 8, 8, 8];
const pad = (value, width) => String(value).padEnd(width);
console.log(header.map((value, index) => pad(value, widths[index])).join(''));
console.log(widths.map((width) => '-'.repeat(width)).join(''));
for (const row of results) {
  console.log([
    pad(row.variante, widths[0]),
    pad(row.fotogrammi, widths[1]),
    pad(row.fps, widths[2]),
    pad(row.p50, widths[3]),
    pad(row.p95, widths[4]),
    pad(row.max, widths[5]),
    pad(row.oltre33ms, widths[6]),
  ].join(''));
}
