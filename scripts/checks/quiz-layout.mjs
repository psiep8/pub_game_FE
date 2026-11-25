#!/usr/bin/env node
/**
 * F-14 — Layout delle opzioni del Quiz a 1280×720 con testi lunghi.
 *
 * Carica la scena vera (`frame-harness.html?long=1`) e controlla che:
 *   - nessun pulsante esca dal bordo inferiore o laterale;
 *   - il testo non sbordi dal pulsante (scrollWidth ≤ clientWidth);
 *   - la griglia resti dentro i 720 px.
 *
 * Uso: node scripts/checks/quiz-layout.mjs
 * Esce 1 se trova un taglio.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORT = Number(process.env.LAYOUT_PORT || 4198);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) return res.writeHead(403).end();
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch();
const problems = [];

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${PORT}/scripts/checks/frame-harness.html?long=1`, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    const options = [...document.querySelectorAll('.quiz-option-btn')].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent.trim().slice(0, 40),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
        overText: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1,
      };
    });
    const grid = document.querySelector('.quiz-options-grid');
    const gridRect = grid.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      options,
      gridBottom: Math.round(gridRect.bottom),
      gridRight: Math.round(gridRect.right),
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    };
  });

  for (const option of report.options) {
    if (option.bottom > viewport.height || option.right > viewport.width || option.overText) {
      problems.push(`${viewport.width}×${viewport.height}: tagliato «${option.text}» (bottom ${option.bottom}, right ${option.right}, testo ${option.overText})`);
    }
  }
  if (report.gridBottom > viewport.height) {
    problems.push(`${viewport.width}×${viewport.height}: la griglia finisce a ${report.gridBottom}px`);
  }
  console.log(`${viewport.width}×${viewport.height}: ${report.columns} colonne, griglia a ${report.gridBottom}px, ${report.options.length} opzioni`);

  // F-15: riepilogo con 4, 8 e 10 squadre. Nessun chip oltre il bordo.
  for (const teams of [4, 8, 10]) {
    const summary = await page.evaluate((teamCount) => {
      const container = document.querySelector('.quiz-container') ?? document.getElementById('scene');
      const rows = [1, 2, 3].map((number) => `
        <div class="quiz-solution-row">
          <span class="quiz-solution-num">${number}</span>
          <div class="quiz-summary-main">
            <span class="quiz-solution-question">Domanda numero ${number} con un testo lungo quanto una domanda vera del Quiz?</span>
            <span class="quiz-solution-answer">✔ La risposta corretta</span>
          </div>
          <div class="quiz-summary-teams">
            ${Array.from({ length: teamCount }, (_, index) => `<span class="quiz-team ${index % 2 ? 'no' : 'ok'}">${index % 2 ? '❌' : '✅'} SQUADRA ${index + 1}</span>`).join('')}
          </div>
        </div>`).join('');
      container.innerHTML = `<div class="quiz-solution"><div class="quiz-summary-head">RIEPILOGO · 3 MANCHES</div>${rows}</div>`;
      const box = container.getBoundingClientRect();
      const chips = [...document.querySelectorAll('.quiz-team')].map((chip) => {
        const rect = chip.getBoundingClientRect();
        return { right: Math.round(rect.right), bottom: Math.round(rect.bottom), text: chip.textContent.trim() };
      });
      const rowsBoxes = [...document.querySelectorAll('.quiz-solution-row')].map((row) => {
        const rect = row.getBoundingClientRect();
        return { right: Math.round(rect.right), left: Math.round(rect.left) };
      });
      const solution = document.querySelector('.quiz-solution');
      return {
        chips,
        rows: rowsBoxes,
        boxRight: Math.round(box.right),
        wide: Math.round(solution.scrollWidth),
        tall: Math.round(solution.scrollHeight),
        visible: Math.round(solution.clientHeight),
      };
    }, teams);

    for (const chip of summary.chips) {
      if (chip.right > summary.boxRight + 1 || chip.bottom > viewport.height) {
        problems.push(`${viewport.width}×${viewport.height} · ${teams} squadre: chip fuori «${chip.text}» (right ${chip.right}, bottom ${chip.bottom})`);
      }
    }
    for (const row of summary.rows) {
      if (row.right > viewport.width || row.left < 0) {
        problems.push(`${viewport.width}×${viewport.height} · ${teams} squadre: riga fuori (${row.left}–${row.right})`);
      }
    }
    if (summary.wide > summary.boxRight + 1) {
      problems.push(`${viewport.width}×${viewport.height} · ${teams} squadre: il riepilogo è largo ${summary.wide}px`);
    }
    if (summary.tall > summary.visible + 1) {
      problems.push(`${viewport.width}×${viewport.height} · ${teams} squadre: il riepilogo sfora (${summary.tall}px su ${summary.visible})`);
    }
    console.log(`  riepilogo ${teams} squadre: ${summary.chips.length} chip, ${summary.tall}px su ${summary.visible}px visibili`);
  }
  await page.close();
}

await browser.close();
server.close();

if (problems.length) {
  console.error('\nF-14 non passa:');
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log('\nF-14/F-15 passano: nessun testo oltre il bordo, riepilogo dentro lo schermo.');
