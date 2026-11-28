#!/usr/bin/env node
/**
 * Carte napoletane del Sette e Mezzo.
 *
 * Sorgente: SONDLecT/woodcut-napoletane, CC0 1.0.
 * Facce: cartella `colori/` (40 carte a colori).
 * Dorso: `cards/dorso.svg`, il dorso a inchiostro bianco/nero.
 *
 * Uso:
 *   node scripts/carte/scarica-napoletane.mjs          # scarica e scrive LICENZE.md
 *   node scripts/carte/scarica-napoletane.mjs --check  # verifica file e licenze
 */
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'apps/frontend/public/assets/carte-napoletane');
const REPO = 'https://raw.githubusercontent.com/SONDLecT/woodcut-napoletane/master';
const PROJECT = 'https://github.com/SONDLecT/woodcut-napoletane';
const AUTHOR = 'SONDLecT';
const LICENSE = 'CC0 1.0 Universal (public domain dedication)';
const FACE_SOURCE = 'colori';
const BACK_SOURCE = 'cards';

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
    source: FACE_SOURCE,
  }))),
  { file: 'dorso.svg', label: 'dorso bianco/nero', source: BACK_SOURCE },
];

/** Le vecchie facce a inchiostro restano solo come dorso: via dal set. */
const KEYLINE_FACES = SUITS.flatMap((suit) => RANKS.map(([file]) => `${suit}-${file}.svg`));

const destFor = ({ file, source }) =>
  source === FACE_SOURCE ? join(OUT, FACE_SOURCE, file) : join(OUT, file);
const urlFor = ({ file, source }) => `${REPO}/${source}/${file}`;
const licensePath = (file, source) => `${source}/${file}`;
const licenseRow = ({ file, label, source }) =>
  `| \`${licensePath(file, source)}\` | ${label} | [${AUTHOR}](${PROJECT}) | ${LICENSE} | ${urlFor({ file, source })} |`;

async function check() {
  const missing = [];
  for (const entry of FILES) {
    try {
      await access(destFor(entry));
    } catch {
      missing.push(licensePath(entry.file, entry.source));
    }
  }
  let license = '';
  try {
    license = await readFile(join(OUT, 'LICENZE.md'), 'utf8');
  } catch {
    missing.push('LICENZE.md');
  }
  const unlicensed = FILES
    .map((entry) => licensePath(entry.file, entry.source))
    .filter((file) => !license.includes(`\`${file}\``));
  if (missing.length || unlicensed.length) {
    console.error('Carte mancanti:', missing.join(', ') || 'nessuna');
    console.error('File senza riga di licenza:', unlicensed.join(', ') || 'nessuno');
    process.exit(1);
  }
  console.log(`OK: ${FILES.length} file (40 facce a colori + dorso) e LICENZE.md verificati.`);
}

async function download() {
  await mkdir(join(OUT, FACE_SOURCE), { recursive: true });
  for (const entry of FILES) {
    const response = await fetch(urlFor(entry));
    if (!response.ok) throw new Error(`${entry.file}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    await writeFile(destFor(entry), body);
    console.log(`${licensePath(entry.file, entry.source)} (${Math.round(body.length / 1024)} KB)`);
  }

  for (const file of KEYLINE_FACES) {
    await unlink(join(OUT, file)).catch(() => undefined);
  }

  const license = `# Carte napoletane — licenze

Set: **40 facce a colori + dorso a inchiostro**.
Sorgente: [${AUTHOR}/woodcut-napoletane](${PROJECT}).
Autore: **${AUTHOR}** (tracciato da un mazzo stampato a Napoli nel 1902).
Licenza: **${LICENSE}** — riuso, modifica e distribuzione liberi, anche commerciali.
Le facce sono copiate senza modifiche da \`colori/\`; il dorso da \`cards/dorso.svg\`.

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
