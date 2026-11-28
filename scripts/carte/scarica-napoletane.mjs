#!/usr/bin/env node
/**
 * Carte napoletane del Sette e Mezzo.
 *
 * Sorgente: SONDLecT/woodcut-napoletane, 40 carte + dorso in SVG, CC0 1.0.
 * Il set è tracciato da un mazzo stampato a Napoli nel 1902. La licenza è
 * verificata nel README del repository: CC0, riuso libero anche commerciale.
 *
 * Uso:
 *   node scripts/carte/scarica-napoletane.mjs          # scarica e scrive LICENZE.md
 *   node scripts/carte/scarica-napoletane.mjs --check  # verifica file e licenze
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'apps/frontend/public/assets/carte-napoletane');
const REPO = 'https://raw.githubusercontent.com/SONDLecT/woodcut-napoletane/master/cards';
const PROJECT = 'https://github.com/SONDLecT/woodcut-napoletane';
const AUTHOR = 'SONDLecT';
const LICENSE = 'CC0 1.0 Universal (public domain dedication)';

const SUITS = ['denari', 'coppe', 'spade', 'bastoni'];
const RANKS = [
  ['asso', 'asso'],
  ['02', '2'],
  ['03', '3'],
  ['04', '4'],
  ['05', '5'],
  ['06', '6'],
  ['07', '7'],
  ['fante', 'fante'],
  ['cavallo', 'cavallo'],
  ['re', 're'],
];

const FILES = [
  ...SUITS.flatMap((suit) => RANKS.map(([file, rank]) => ({
    file: `${suit}-${file}.svg`,
    label: `${rank} di ${suit}`,
  }))),
  { file: 'dorso.svg', label: 'dorso' },
];

const licenseRow = ({ file, label }) =>
  `| \`${file}\` | ${label} | [${AUTHOR}](${PROJECT}) | ${LICENSE} | ${REPO}/${file} |`;

async function check() {
  const missing = [];
  for (const { file } of FILES) {
    try {
      await access(join(OUT, file));
    } catch {
      missing.push(file);
    }
  }
  let license = '';
  try {
    license = await readFile(join(OUT, 'LICENZE.md'), 'utf8');
  } catch {
    missing.push('LICENZE.md');
  }
  const unlicensed = FILES
    .map(({ file }) => file)
    .filter((file) => !license.includes(`\`${file}\``));
  if (missing.length || unlicensed.length) {
    console.error('Carte mancanti:', missing.join(', ') || 'nessuna');
    console.error('File senza riga di licenza:', unlicensed.join(', ') || 'nessuno');
    process.exit(1);
  }
  console.log(`OK: ${FILES.length} file (40 carte + dorso) e LICENZE.md verificati.`);
}

async function download() {
  await mkdir(OUT, { recursive: true });
  for (const { file } of FILES) {
    const response = await fetch(`${REPO}/${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    await writeFile(join(OUT, file), body);
    console.log(`${file} (${Math.round(body.length / 1024)} KB)`);
  }

  const license = `# Carte napoletane — licenze

Set: **40 carte + dorso**, disegni in SVG a inchiostro (\`cards/\`).
Sorgente: [${AUTHOR}/woodcut-napoletane](${PROJECT}).
Autore: **${AUTHOR}** (tracciato da un mazzo stampato a Napoli nel 1902).
Licenza: **${LICENSE}** — riuso, modifica e distribuzione liberi, anche commerciali.
I file sono copiati senza modifiche dalla cartella \`cards/\` del repository.

| File | Carta | Autore | Licenza | URL |
| --- | --- | --- | --- | --- |
${FILES.map(licenseRow).join('\n')}
`;
  await writeFile(join(OUT, 'LICENZE.md'), license);
  console.log(`Scritto ${join(OUT, 'LICENZE.md')}`);
}

const main = process.argv.includes('--check') ? check : download;
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
