#!/usr/bin/env node
/**
 * Generatore degli sticker quizzOne.
 *
 * Un solo modello SVG (badge a 10 lati, alone bianco, ombra offset, texture
 * ritagliata sul badge, testo Anton in tracciati) pilotato da temi.json e
 * sticker.json. Nessun font esterno nel file finale: il testo è convertito in
 * tracciati con opentype.js.
 *
 * Uso:
 *   node build.mjs                 # tappa 1 (8 esistenti + Bomba, Casino, Karaoke)
 *   node build.mjs --tappa 2       # tutto il pack
 *   node build.mjs --test          # solo i test, senza scrivere nulla
 *   node build.mjs --solo bomba    # un singolo sticker, per debug
 *   node build.mjs --diff <dir>    # confronto visivo con gli SVG originali
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import opentype from 'opentype.js';
import { decompress } from 'wawoff2';
import { optimize } from 'svgo';
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QUI, '../..');
const DOCS = path.join(ROOT, 'docs/stickers');
const PNG_DIR = path.join(DOCS, 'png');
const FONT_WOFF2 = path.join(DOCS, 'anton-latin.woff2');

// --- geometria del modello (invariata: è lo sticker di oggi) ---------------
const VIEW_W = 1200;
const VIEW_H = 560;
const MM_W = 180;
const MM_H = 84;
const DPI = 300;

// logo tondi dei giochi: cerchio Ø 84 mm su tela 90 × 90 mm
const LOGO_LATO = 1200;
const LOGO_MM = 90;
const LOGO_R = 560;
const LOGO_C = 600;
const BADGE_D =
  'M164 70H1036L1130 162L1098 255L1130 348L1036 440H164L70 348L102 255L70 162Z';
const BADGE_POLY = [
  [164, 70], [1036, 70], [1130, 162], [1098, 255], [1130, 348],
  [1036, 440], [164, 440], [70, 348], [102, 255], [70, 162],
];

const TESTO_MAX_W = 820; // stessa larghezza del wordmark di oggi
const TESTO_MAX = 218; // stesso corpo del wordmark di oggi
const TESTO_MAX_DUE_RIGHE = 152;
const TAGLIA_MIN = 84;
const TAGLINE = 42;
const TAGLINE_MAX_W = 760;

const NERO = '#000';
const pxPerMm = DPI / 25.4;

// --- util -----------------------------------------------------------------
const leggiJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

function escapeXml(testo) {
  return String(testo)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function indent(markup, spazi) {
  const pad = ' '.repeat(spazi);
  return markup
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((riga) => (riga.trim() ? pad + riga.trim() : ''))
    .filter((riga, i, tutte) => riga !== '' || (i > 0 && i < tutte.length - 1))
    .join('\n');
}

// --- font -----------------------------------------------------------------
let cacheFont = null;
async function caricaFont() {
  if (cacheFont) return cacheFont;
  const woff2 = await fs.readFile(FONT_WOFF2);
  const ttf = Buffer.from(await decompress(woff2));
  const buffer = ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength);
  const font = opentype.parse(buffer);
  const capRatio = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
  const discRatio = Math.abs(font.charToGlyph('p').getBoundingBox().y1) / font.unitsPerEm;
  cacheFont = { font, capRatio, discRatio };
  return cacheFont;
}

/** Tracciati di una riga, con posizioni cumulate e kerning del font. */
function traccia(riga, font, size, tracking = 0) {
  const unita = size / font.unitsPerEm;
  let x = 0;
  let precedente = null;
  let glifi = 0;
  const segmenti = [];
  for (const segmento of riga) {
    let d = '';
    for (const carattere of segmento.testo) {
      const glifo = font.charToGlyph(carattere);
      if (glifo.index === 0 && carattere.trim()) {
        throw new Error(`glifo mancante per "${carattere}" (U+${carattere.codePointAt(0).toString(16)})`);
      }
      if (precedente) x += font.getKerningValue(precedente, glifo) * unita;
      d += glifo.getPath(x, 0, size).toPathData(3);
      x += glifo.advanceWidth * unita + tracking;
      precedente = glifo;
      glifi += 1;
    }
    segmenti.push({ d, ruolo: segmento.ruolo });
  }
  return { segmenti, larghezza: x - (tracking || 0), glifi };
}

function spezzaRiga(riga, offset) {
  const sinistra = [];
  const destra = [];
  let visto = 0;
  for (const segmento of riga) {
    const inizio = visto;
    const fine = visto + segmento.testo.length;
    visto = fine;
    if (offset >= fine) {
      sinistra.push(segmento);
    } else if (offset <= inizio) {
      destra.push(segmento);
    } else {
      const taglio = offset - inizio;
      sinistra.push({ ...segmento, testo: segmento.testo.slice(0, taglio) });
      destra.push({ ...segmento, testo: segmento.testo.slice(taglio) });
    }
  }
  const pulisci = (lati) =>
    lati
      .map((s) => ({ ...s, testo: s.testo }))
      .filter((s) => s.testo.length > 0)
      .map((s) => (/\s$/.test(s.testo) ? { ...s, testo: s.testo.replace(/\s+$/, '') } : s))
      .map((s) => (/^\s/.test(s.testo) ? { ...s, testo: s.testo.replace(/^\s+/, '') } : s))
      .filter((s) => s.testo.length > 0);
  return [pulisci(sinistra), pulisci(destra)];
}

/** Spezza al primo spazio oltre la metà: "ULTIMA SPIAGGIA" -> 2 righe. */
function candidatiRighe(righe) {
  const candidati = [righe];
  if (righe.length === 1) {
    const testo = righe[0].map((s) => s.testo).join('');
    const spazi = [...testo]
      .map((c, i) => (c === ' ' ? i : -1))
      .filter((i) => i > 0);
    if (spazi.length) {
      const meta = testo.length / 2;
      const taglio = spazi.sort((a, b) => Math.abs(a - meta) - Math.abs(b - meta))[0];
      const [a, b] = spezzaRiga(righe[0], taglio);
      if (a.length && b.length) candidati.push([a, b]);
    }
  }
  return candidati;
}

function larghezzaRiga(riga, font, size) {
  let larghezza = 0;
  let precedente = null;
  const unita = size / font.unitsPerEm;
  for (const segmento of riga) {
    for (const carattere of segmento.testo) {
      const glifo = font.charToGlyph(carattere);
      if (precedente) larghezza += font.getKerningValue(precedente, glifo) * unita;
      larghezza += glifo.advanceWidth * unita;
      precedente = glifo;
    }
  }
  return larghezza;
}

/**
 * Corpo del testo grande: il più grande che sta nella larghezza, scegliendo
 * fra la riga scritta a mano e la sua divisione in due righe.
 */
function scegliTesto(sticker, font) {
  const righeAutore = sticker.testo.righe;
  const opzioni = candidatiRighe(righeAutore).map((righe) => {
    const max = righe.length === 1 ? TESTO_MAX : TESTO_MAX_DUE_RIGHE;
    let size = max;
    while (size > TAGLIA_MIN) {
      const larga = Math.max(...righe.map((r) => larghezzaRiga(r, font, size)));
      if (larga <= TESTO_MAX_W) break;
      size -= 1;
    }
    const larga = Math.max(...righe.map((r) => larghezzaRiga(r, font, size)));
    return { righe, size, larga };
  });
  opzioni.sort((a, b) => b.size - a.size || a.righe.length - b.righe.length);
  const scelta = opzioni[0];
  if (scelta.larga > TESTO_MAX_W || scelta.size < TAGLIA_MIN) {
    throw new Error(
      `"${sticker.slug}": il testo non sta nel badge nemmeno a ${scelta.size}px`,
    );
  }
  return scelta;
}

// --- icone ----------------------------------------------------------------
const cacheIcone = new Map();

async function iconaPhosphor(nome, peso) {
  const chiave = `${nome}-${peso}`;
  if (cacheIcone.has(chiave)) return cacheIcone.get(chiave);
  const file = path.join(
    QUI, 'node_modules/@phosphor-icons/core/assets', peso, `${nome}-${peso}.svg`,
  );
  let svg;
  try {
    svg = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(`icona Phosphor non trovata: ${nome}-${peso}.svg`);
  }
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const interno = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();
  const risultato = { viewBox, interno: indent(interno, 6) };
  cacheIcone.set(chiave, risultato);
  return risultato;
}

/**
 * Forme disegnate nello stesso stile delle icone esistenti: riquadro 100x100,
 * tratto 5, spigoli vivi, nessun arrotondamento decorativo.
 */
const DISEGNI = {
  roulette: {
    tipo: 'tratto',
    markup: `<circle cx="50" cy="50" r="42"/>
      <circle cx="50" cy="50" r="27"/>
      <path d="M50 8v19M50 73v19M8 50h19M73 50h19M20 20l13 13M67 67l13 13M80 20L67 33M33 67L20 80"/>
      <path d="M50 38a12 12 0 0 1 0 24a12 12 0 0 1 0-24Z" fill="currentColor"/>
      <circle cx="79" cy="23" r="6" fill="currentColor"/>`,
  },
  fiches: {
    tipo: 'tratto',
    markup: `<circle cx="50" cy="50" r="36"/>
      <circle cx="50" cy="50" r="24" stroke-dasharray="9 7"/>
      <circle cx="50" cy="50" r="10" fill="currentColor"/>`,
  },
  scintilla: {
    tipo: 'pieno',
    markup: `<path d="M50 2l7 30 22-19-12 32 31 5-31 5 12 32-22-19-7 30-7-30-22 19 12-32-31-5 31-5-12-32 22 19Z"/>`,
  },
};

// --- loghi tondi dei giochi ----------------------------------------------
// Pittogrammi tipo emoji: un soggetto solo, forme piatte, contorno scuro,
// colori presi dalla palette del tema. Riquadro locale 600×600 centrato.
const LOGHI = {
  bomba: {
    box: { x0: 95, y0: 30, x1: 600, y1: 545 },
    disegna: (p) => `<circle cx="285" cy="360" r="170" fill="${p.accent}" stroke="${p.ink}" stroke-width="14"/>
      <path d="M228 268a56 56 0 0 0 0 108 68 68 0 0 1 0-108Z" fill="${p.paper}"/>
      <path d="M352 250C398 200 418 130 486 106" fill="none" stroke="${p.paper}" stroke-width="26" stroke-linecap="round"/>
      <rect x="344" y="216" width="40" height="58" rx="4" fill="${p.second}" stroke="${p.ink}" stroke-width="12" transform="rotate(36 364 245)"/>
      <path d="M520 34l19 51 51 19-51 19-19 51-19-51-51-19 51-19Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="12"/>
      <path d="M420 52l30 28M392 140h44M424 208l24-22" fill="none" stroke="${p.second}" stroke-width="13" stroke-linecap="square"/>`,
  },
  slot: {
    box: { x0: 108, y0: 52, x1: 512, y1: 530 },
    disegna: (p) => `<rect x="118" y="64" width="324" height="430" rx="26" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <rect x="146" y="88" width="268" height="58" rx="10" fill="${p.accent}" stroke="${p.ink}" stroke-width="12"/>
      <path d="M172 117h0M212 117h0M252 117h0M292 117h0M332 117h0M372 117h0" fill="none" stroke="${p.paper}" stroke-width="16" stroke-linecap="round"/>
      <rect x="146" y="170" width="268" height="160" rx="10" fill="${p.ink}"/>
      <rect x="158" y="182" width="76" height="136" rx="8" fill="${p.paper}"/>
      <rect x="242" y="182" width="76" height="136" rx="8" fill="${p.paper}"/>
      <rect x="326" y="182" width="76" height="136" rx="8" fill="${p.paper}"/>
      <path d="M181 246c0-14 10-24 22-28M209 252c0-12-6-22-14-26" fill="none" stroke="${p.ink}" stroke-width="8"/>
      <circle cx="182" cy="262" r="17" fill="${p.second}" stroke="${p.ink}" stroke-width="8"/>
      <circle cx="212" cy="266" r="17" fill="${p.second}" stroke="${p.ink}" stroke-width="8"/>
      <circle cx="280" cy="252" r="28" fill="${p.second}" stroke="${p.ink}" stroke-width="9"/>
      <circle cx="280" cy="252" r="12" fill="${p.paper}"/>
      <path d="M364 216l11 25 25 11-25 11-11 25-11-25-25-11 25-11Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="8"/>
      <rect x="146" y="352" width="268" height="52" rx="8" fill="${p.accent}" stroke="${p.ink}" stroke-width="12"/>
      <path d="M168 378h224" fill="none" stroke="${p.ink}" stroke-width="8"/>
      <path d="M446 300l22-92" fill="none" stroke="${p.paper}" stroke-width="20" stroke-linecap="round"/>
      <circle cx="472" cy="196" r="28" fill="${p.second}" stroke="${p.ink}" stroke-width="12"/>
      <rect x="150" y="494" width="54" height="26" fill="${p.accent}" stroke="${p.ink}" stroke-width="10"/>
      <rect x="356" y="494" width="54" height="26" fill="${p.accent}" stroke="${p.ink}" stroke-width="10"/>`,
  },
  microfono: {
    box: { x0: 140, y0: 78, x1: 552, y1: 508 },
    disegna: (p) => `<path d="M150 240v50a115 115 0 0 0 230 0v-50" fill="none" stroke="${p.paper}" stroke-width="26"/>
      <path d="M265 407v76M196 483h138" fill="none" stroke="${p.paper}" stroke-width="26" stroke-linecap="square"/>
      <rect x="205" y="88" width="120" height="238" rx="56" fill="${p.accent}" stroke="${p.ink}" stroke-width="14"/>
      <path d="M222 150h86M222 188h86M222 226h86" fill="none" stroke="${p.ink}" stroke-width="10" stroke-linecap="square"/>
      <ellipse cx="466" cy="256" rx="35" ry="28" fill="${p.second}" stroke="${p.ink}" stroke-width="12"/>
      <path d="M497 256V150c32 8 46 26 46 54" fill="none" stroke="${p.paper}" stroke-width="18" stroke-linecap="square"/>
      <path d="M462 340l12 26 26 12-26 12-12 26-12-26-26-12 26-12Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="10"/>`,
  },
  biglia: {
    box: { x0: 40, y0: 96, x1: 560, y1: 504 },
    disegna: (p) => `<circle cx="300" cy="300" r="186" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M208 268c30-56 100-84 158-56 46 22 66 70 52 112-12 38-52 58-88 44-32-12-44-50-24-74 18-22 52-22 68 0" fill="none" stroke="${p.accent}" stroke-width="24" stroke-linecap="round"/>
      <circle cx="300" cy="300" r="24" fill="${p.second}"/>`,
  },
  cronometro: {
    box: { x0: 120, y0: 40, x1: 470, y1: 480 },
    disegna: (p) => `<rect x="252" y="52" width="96" height="42" rx="8" fill="${p.second}" stroke="${p.ink}" stroke-width="12"/>
      <rect x="286" y="94" width="28" height="76" fill="${p.paper}"/>
      <circle cx="300" cy="342" r="178" fill="${p.paper}" stroke="${p.ink}" stroke-width="18"/>
      <circle cx="300" cy="342" r="126" fill="none" stroke="${p.accent}" stroke-width="10"/>
      <path d="M300 342V228M300 342l76 60" fill="none" stroke="${p.ink}" stroke-width="18" stroke-linecap="square"/>
      <circle cx="300" cy="342" r="18" fill="${p.second}" stroke="${p.ink}" stroke-width="8"/>
      <path d="M300 184v18M444 342h18M300 500v-18M138 342h18" fill="none" stroke="${p.second}" stroke-width="12"/>`,
  },
  fiches: {
    box: { x0: 120, y0: 250, x1: 480, y1: 490 },
    disegna: (p) => `<ellipse cx="300" cy="424" rx="168" ry="52" fill="${p.second}" stroke="${p.ink}" stroke-width="14"/>
      <ellipse cx="300" cy="372" rx="168" ry="52" fill="${p.accent}" stroke="${p.ink}" stroke-width="14"/>
      <ellipse cx="300" cy="320" rx="168" ry="52" fill="${p.paper}" stroke="${p.ink}" stroke-width="14"/>
      <ellipse cx="300" cy="320" rx="104" ry="30" fill="none" stroke="${p.accent}" stroke-width="12" stroke-dasharray="20 14"/>
      <circle cx="300" cy="320" r="18" fill="${p.second}"/>`,
  },
  salvagente: {
    box: { x0: 96, y0: 86, x1: 504, y1: 528 },
    disegna: (p) => `<circle cx="300" cy="286" r="190" fill="${p.paper}"/>
      <path d="M300 96v92M300 384v92M110 286h92M398 286h92" fill="none" stroke="${p.accent}" stroke-width="58"/>
      <circle cx="300" cy="286" r="110" fill="${p.ink}"/>
      <circle cx="300" cy="286" r="190" fill="none" stroke="${p.ink}" stroke-width="18"/>
      <circle cx="300" cy="286" r="110" fill="none" stroke="${p.ink}" stroke-width="18"/>
      <path d="M112 498q44-34 88 0t88 0 88 0" fill="none" stroke="${p.second}" stroke-width="16" stroke-linecap="round"/>`,
  },
  arena: {
    box: { x0: 90, y0: 90, x1: 510, y1: 510 },
    disegna: (p) => `<circle cx="300" cy="300" r="206" fill="${p.paper}" stroke="${p.ink}" stroke-width="18"/>
      <circle cx="300" cy="300" r="146" fill="none" stroke="${p.accent}" stroke-width="24"/>
      <circle cx="300" cy="300" r="86" fill="${p.second}" stroke="${p.ink}" stroke-width="12"/>
      <circle cx="300" cy="300" r="20" fill="${p.ink}"/>`,
  },
  tennis: {
    box: { x0: 140, y0: 60, x1: 540, y1: 540 },
    disegna: (p) => `<defs><clipPath id="testa-racchetta"><ellipse cx="300" cy="225" rx="132" ry="160"/></clipPath></defs>
      <g transform="rotate(-24 300 300)">
      <ellipse cx="300" cy="225" rx="140" ry="168" fill="${p.paper}" stroke="${p.ink}" stroke-width="18"/>
      <path d="M300 393v140" fill="none" stroke="${p.accent}" stroke-width="44" stroke-linecap="square"/>
      <g clip-path="url(#testa-racchetta)" fill="none" stroke="${p.ink}" stroke-width="9">
        <path d="M240 50v350M300 50v350M360 50v350M160 225h280M160 175h280M160 275h280"/>
      </g>
    </g>
      <circle cx="466" cy="430" r="56" fill="${p.second}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M432 400a56 56 0 0 1 0 60M470 374a56 56 0 0 1 0 112" fill="none" stroke="${p.ink}" stroke-width="9"/>`,
  },
  speedrush: {
    box: { x0: 150, y0: 40, x1: 600, y1: 520 },
    disegna: (p) => `<path d="M318 48L148 344h116l-38 196 196-300H310Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="18"/>
      <path d="M436 236v264" fill="none" stroke="${p.paper}" stroke-width="22" stroke-linecap="square"/>
      <rect x="436" y="236" width="148" height="102" fill="${p.paper}" stroke="${p.ink}" stroke-width="12"/>
      <path d="M473 236v102M510 236v102M547 236v102M436 270h148M436 304h148" fill="none" stroke="${p.ink}" stroke-width="12"/>
      <path d="M436 236h37v34h-37Zm74 34h37v34h-37Zm-37 34h37v34h-37Z" fill="${p.ink}"/>`,
  },
  indovina: {
    box: { x0: 120, y0: 110, x1: 550, y1: 530 },
    disegna: (p) => `<circle cx="282" cy="212" r="94" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M106 524c0-118 80-180 176-180s176 62 176 180Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M428 158c0-48 78-48 78 0 0 36-46 40-46 78" fill="none" stroke="${p.accent}" stroke-width="32" stroke-linecap="round"/>
      <circle cx="460" cy="292" r="23" fill="${p.accent}"/>`,
  },
  timeline: {
    box: { x0: 90, y0: 180, x1: 510, y1: 380 },
    disegna: (p) => `<path d="M96 330H504" fill="none" stroke="${p.ink}" stroke-width="22" stroke-linecap="square"/>
      <circle cx="160" cy="330" r="38" fill="${p.paper}" stroke="${p.ink}" stroke-width="14"/>
      <circle cx="300" cy="330" r="38" fill="${p.accent}" stroke="${p.ink}" stroke-width="14"/>
      <circle cx="440" cy="330" r="38" fill="${p.second}" stroke="${p.ink}" stroke-width="14"/>
      <path d="M300 330V236" fill="none" stroke="${p.ink}" stroke-width="14"/>
      <path d="M300 176l42 42-42 42-42-42Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="14"/>`,
  },
  ruota: {
    box: { x0: 88, y0: 60, x1: 512, y1: 520 },
    disegna: (p) => {
      const centro = { x: 300, y: 310 };
      const raggio = 200;
      const spicchi = Array.from({ length: 8 }, (_, i) => {
        const a1 = (i * Math.PI * 2) / 8 - Math.PI / 2;
        const a2 = ((i + 1) * Math.PI * 2) / 8 - Math.PI / 2;
        const x1 = centro.x + Math.cos(a1) * raggio;
        const y1 = centro.y + Math.sin(a1) * raggio;
        const x2 = centro.x + Math.cos(a2) * raggio;
        const y2 = centro.y + Math.sin(a2) * raggio;
        const colore = i % 2 ? p.ink : p.accent;
        return `<path d="M${centro.x} ${centro.y}L${x1.toFixed(1)} ${y1.toFixed(1)}A${raggio} ${raggio} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${colore}"/>`;
      }).join('\n      ');
      return `<circle cx="300" cy="310" r="200" fill="${p.paper}"/>
      ${spicchi}
      <circle cx="300" cy="310" r="200" fill="none" stroke="${p.ink}" stroke-width="20"/>
      <circle cx="300" cy="310" r="42" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M300 52l42 74h-84Z" fill="${p.second}" stroke="${p.ink}" stroke-width="14" stroke-linejoin="miter"/>`;
    },
  },
  blackjack: {
    box: { x0: 120, y0: 110, x1: 550, y1: 500 },
    disegna: (p) => `<g transform="rotate(-12 300 320)">
      <rect x="126" y="150" width="204" height="292" rx="18" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
      <path d="M228 246c-46 54-70 80-70 104a34 34 0 0 0 52 29l-12 33h60l-12-33a34 34 0 0 0 52-29c0-24-24-50-70-104Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="10"/>
    </g>
      <g transform="rotate(10 400 300)">
        <rect x="330" y="130" width="204" height="292" rx="18" fill="${p.paper}" stroke="${p.ink}" stroke-width="16"/>
        <path d="M432 250c0-30 40-30 40 0 0 26-40 44-40 74 0-30-40-48-40-74 0-30 40-30 40 0Z" fill="${p.second}" stroke="${p.ink}" stroke-width="10"/>
      </g>`,
  },
  cavallo: {
    box: { x0: 90, y0: 90, x1: 510, y1: 510 },
    phosphor: { nome: 'horse', peso: 'bold', x: 70, y: 86, lato: 460 },
    disegna: (p) => `<circle cx="300" cy="300" r="214" fill="${p.accent}"/>`,
  },
  corona: {
    box: { x0: 96, y0: 120, x1: 504, y1: 500 },
    disegna: (p) => `<path d="M112 432V208l104 78 84-140 84 140 104-78v224Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="18" stroke-linejoin="miter"/>
      <path d="M112 432h376v56H112Z" fill="${p.second}" stroke="${p.ink}" stroke-width="16"/>
      <circle cx="112" cy="208" r="20" fill="${p.paper}" stroke="${p.ink}" stroke-width="10"/>
      <circle cx="300" cy="146" r="20" fill="${p.paper}" stroke="${p.ink}" stroke-width="10"/>
      <circle cx="488" cy="208" r="20" fill="${p.paper}" stroke="${p.ink}" stroke-width="10"/>`,
  },
  cucchiaio: {
    box: { x0: 100, y0: 90, x1: 510, y1: 530 },
    disegna: (p) => `<path d="M126 150l34 34M474 142l-28 30M108 300h44M456 300h36" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="square"/>
      <ellipse cx="300" cy="210" rx="98" ry="120" fill="${p.second}" stroke="${p.ink}" stroke-width="16"/>
      <rect x="278" y="310" width="44" height="200" rx="20" fill="${p.second}" stroke="${p.ink}" stroke-width="16"/>
      <circle cx="270" cy="188" r="11" fill="${p.ink}"/>
      <circle cx="330" cy="188" r="11" fill="${p.ink}"/>
      <path d="M266 230q34 30 68 0" fill="none" stroke="${p.ink}" stroke-width="12" stroke-linecap="round"/>`,
  },
};

const tinteLogo = (palette) => ({
  paper: palette.alone,
  ink: palette.fondo,
  accent: palette.accento,
  shadow: palette.ombra,
  second: palette.secondo,
});

// --- composizione ---------------------------------------------------------
function contenuta(punto, margine = 2) {
  const [x, y] = punto;
  let dentro = false;
  for (let i = 0, j = BADGE_POLY.length - 1; i < BADGE_POLY.length; j = i++) {
    const [xi, yi] = BADGE_POLY[i];
    const [xj, yj] = BADGE_POLY[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  if (!dentro) return false;
  for (let i = 0; i < BADGE_POLY.length; i += 1) {
    const [x1, y1] = BADGE_POLY[i];
    const [x2, y2] = BADGE_POLY[(i + 1) % BADGE_POLY.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const distanza = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (distanza < margine) return false;
  }
  return true;
}

function dentroBadge(box, margine = 2) {
  const { x0, y0, x1, y1 } = box;
  const punti = [
    [x0, y0], [x1, y0], [x0, y1], [x1, y1],
    [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1],
    [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2],
  ];
  return punti.every((p) => contenuta(p, margine));
}

async function componi(sticker, tema, font, capRatio, discRatio) {
  if (sticker.formato === 'logo') return componiLogo(sticker, tema);
  return componiBadge(sticker, tema, font, capRatio, discRatio);
}

/** Sticker tondo: solo il logo del gioco, nessun testo. */
async function componiLogo(sticker, tema) {
  const palette = tema.palette;
  const logo = LOGHI[sticker.logo];
  if (!logo) throw new Error(`${sticker.slug}: logo "${sticker.logo}" da disegnare`);
  const scala = logo.scala || 1.32;
  const box = logo.box;
  const riquadro = {
    x0: LOGO_C + (box.x0 - 300) * scala,
    y0: LOGO_C + (box.y0 - 300) * scala,
    x1: LOGO_C + (box.x1 - 300) * scala,
    y1: LOGO_C + (box.y1 - 300) * scala,
  };

  const defs = [
    '    <circle id="badge" cx="600" cy="600" r="560"/>',
    '    <clipPath id="clip"><use href="#badge"/></clipPath>',
    indent(tema.texture.pattern, 4),
  ];

  // pittogrammi presi da Phosphor (MIT), usati come sagoma piena
  let sagoma = '';
  if (logo.phosphor) {
    const { viewBox, interno } = await iconaPhosphor(logo.phosphor.nome, logo.phosphor.peso || 'bold');
    const id = `logo-${logo.phosphor.nome}`;
    defs.push(`    <symbol id="${id}" viewBox="${viewBox}">\n${interno}\n    </symbol>`);
    const p = logo.phosphor;
    sagoma = `\n    <use href="#${id}" x="${p.x}" y="${p.y}" width="${p.lato}" height="${p.lato}" fill="${palette.alone}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_MM}mm" height="${LOGO_MM}mm" viewBox="0 0 ${LOGO_LATO} ${LOGO_LATO}" role="img" aria-labelledby="title desc">
  <title id="title">quizzOne - ${escapeXml(sticker.titolo)}</title>
  <desc id="desc">Adesivo tondo quizzOne «${escapeXml(sticker.titolo)}»: logo del gioco su palette ${escapeXml(tema.nome)}, texture stampata e contorno di taglio CutContour.</desc>
  <defs>
${defs.join('\n')}
  </defs>
  <g id="Fondo">
    <use href="#badge" transform="translate(18 18)" fill="${palette.ombra}"/>
    <use href="#badge" fill="${palette.alone}" stroke="${palette.alone}" stroke-width="48"/>
    <use href="#badge" fill="${palette.fondo}" stroke="${palette.filo}" stroke-width="7"/>
  </g>
  <g id="Texture">
    <g clip-path="url(#clip)" opacity="${tema.texture.opacita}">
      <rect width="${LOGO_LATO}" height="${LOGO_LATO}" fill="url(#texture)"/>
    </g>
  </g>
  <g id="Logo" transform="translate(600 600) scale(${scala}) translate(-300 -300)">
${indent(logo.disegna(tinteLogo(palette)), 4)}${sagoma}
  </g>
  <g id="CutContour" data-spot-color="CutContour" data-tratto="0.25pt" fill="none" stroke="#FF00FF" stroke-width="0.588">
    <use href="#badge"/>
  </g>
</svg>
`;

  return {
    svg,
    boxes: [{ nome: `logo ${sticker.logo}`, ...riquadro }],
    formato: 'logo',
    size: 0,
    nRighe: 0,
    tagline: null,
    testoScelto: null,
  };
}

async function componiBadge(sticker, tema, font, capRatio, discRatio) {
  const palette = tema.palette;
  const colore = (ruolo) => palette[ruolo] || ruolo;
  const boxes = [];
  const gruppiTesto = [];
  const ombre = [];
  const iconeDefs = [];
  const iconeG = [];

  let size;
  let nRighe;
  let tagline = null;
  let testoScelto;

  if (sticker.marchio) {
    // wordmark di oggi: corpo 218, 820 unità di larghezza, ombra a +12/+12
    size = TESTO_MAX;
    nRighe = 1;
    const riga = [{ testo: 'quizz', ruolo: 'testo' }, { testo: 'One', ruolo: 'accento' }];
    const { segmenti, larghezza, glifi } = traccia(riga, font, size);
    const scala = TESTO_MAX_W / larghezza;
    sticker._glifi = glifi;
    testoScelto = { righe: [riga], size };
    boxes.push({
      nome: 'wordmark',
      x0: 600 - TESTO_MAX_W / 2,
      y0: 355 - capRatio * size,
      x1: 600 + TESTO_MAX_W / 2,
      y1: 355 + discRatio * size,
    });
    const path = segmenti
      .map((s) => `      <path d="${s.d}" fill="${colore(s.ruolo)}"/>`)
      .join('\n');
    gruppiTesto.push(
      `    <g transform="translate(190 355) scale(${scala.toFixed(5)} 1)">\n${path}\n    </g>`,
    );
    ombre.push(
      `    <g transform="translate(202 367) scale(${scala.toFixed(5)} 1)">\n${segmenti
        .map((s) => `      <path d="${s.d}" fill="${palette.ombra}"/>`)
        .join('\n')}\n    </g>`,
    );
  } else {
    testoScelto = scegliTesto(sticker, font);
    nRighe = testoScelto.righe.length;
    size = testoScelto.size;

    const baselineFinale = nRighe === 1 ? 352 : 362;
    const interlinea = Math.round(size * 0.14);
    const cap = capRatio * size;
    const baselinePrima = baselineFinale - (nRighe - 1) * (cap + interlinea);
    const taglineBaseline = nRighe === 1 ? 412 : 416;

    sticker._glifi = 0;
    testoScelto.righe.forEach((riga, indice) => {
      const { segmenti, larghezza, glifi } = traccia(riga, font, size);
      sticker._glifi += glifi;
      const x = 600 - larghezza / 2;
      const baseline = baselinePrima + indice * (cap + interlinea);
      boxes.push({
        nome: `testo riga ${indice + 1}`,
        x0: x, y0: baseline - cap, x1: x + larghezza, y1: baseline + discRatio * size,
      });
      const path = segmenti
        .map((s) => `      <path d="${s.d}" fill="${colore(s.ruolo)}"/>`)
        .join('\n');
      gruppiTesto.push(
        `    <g transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)})">\n${path}\n    </g>`,
      );
      const ombraPath = segmenti
        .map((s) => `      <path d="${s.d}" fill="${palette.ombra}"/>`)
        .join('\n');
      ombre.push(
        `    <g transform="translate(${(x + 12).toFixed(2)} ${(baseline + 12).toFixed(2)})">\n${ombraPath}\n    </g>`,
      );
    });

    // tagline: maiuscolo Anton spaziato, come un timbro
    if (sticker.testo.tagline) {
      const riga = [{ testo: sticker.testo.tagline.toUpperCase(), ruolo: sticker.testo.taglineColore || 'secondo' }];
      let taglia = TAGLINE;
      while (taglia > 24 && larghezzaRiga(riga, font, taglia) > TAGLINE_MAX_W) taglia -= 1;
      const { segmenti, larghezza } = traccia(riga, font, taglia, taglia * 0.14);
      const x = 600 - larghezza / 2;
      boxes.push({
        nome: 'tagline',
        x0: x, y0: taglineBaseline - capRatio * taglia, x1: x + larghezza, y1: taglineBaseline + discRatio * taglia,
      });
      tagline = {
        markup: `    <g transform="translate(${x.toFixed(2)} ${taglineBaseline.toFixed(2)})">\n      <path d="${segmenti[0].d}" fill="${colore(segmenti[0].ruolo)}"/>\n    </g>`,
      };
    }
  }

  // icone: per il marchio restano le due di oggi, per i soggetti nuovi le
  // forme della tabella nello stesso slot (in alto a sinistra, in basso a destra)
  if (sticker.marchio) {
    iconeG.push(indent(tema.icone, 4));
  }
  for (const icona of sticker.icone || []) {
    const lato = icona.lato;
    const x = icona.x;
    const y = icona.y;
    if (icona.tipo === 'phosphor') {
      const { viewBox, interno } = await iconaPhosphor(icona.nome, icona.peso || 'bold');
      const id = `icona-${icona.nome}`;
      if (!iconeDefs.some((d) => d.id === id)) {
        iconeDefs.push({
          id,
          markup: `    <symbol id="${id}" viewBox="${viewBox}" fill="currentColor">\n${interno}\n    </symbol>`,
        });
      }
      iconeG.push(
        `    <use href="#${id}" x="${x}" y="${y}" width="${lato}" height="${lato}" fill="${colore(icona.colore || 'accento')}"/>`,
      );
    } else {
      const disegno = DISEGNI[icona.nome];
      if (!disegno) throw new Error(`disegno sconosciuto: ${icona.nome}`);
      const scala = lato / 100;
      const riempimento = disegno.tipo === 'pieno' ? colore(icona.colore || 'accento') : 'none';
      iconeG.push(
        `    <g transform="translate(${x} ${y}) scale(${scala.toFixed(4)})" fill="${riempimento}" stroke="${disegno.tipo === 'pieno' ? 'none' : colore(icona.colore || 'accento')}" stroke-width="5" stroke-linejoin="miter" stroke-linecap="square">\n${indent(disegno.markup, 6)}\n    </g>`,
      );
    }
    boxes.push({ nome: `icona ${icona.nome}`, x0: x, y0: y, x1: x + lato, y1: y + lato });
  }

  const marchio = Boolean(sticker.marchio);
  const titolo = marchio ? `quizzOne - ${sticker.titolo}` : `quizzOne - ${sticker.titolo}`;
  const descrizione = stampaDescrizione(sticker, tema, testoScelto);

  const defs = [
    '    <path id="badge" d="' + BADGE_D + '"/>',
    '    <clipPath id="clip"><use href="#badge"/></clipPath>',
    indent(tema.texture.pattern, 4),
    ...iconeDefs.map((d) => d.markup),
  ].join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MM_W}mm" height="${MM_H}mm" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(titolo)}</title>
  <desc id="desc">${escapeXml(descrizione)}</desc>
  <defs>
${defs}
  </defs>
  <g id="Fondo">
    <use href="#badge" transform="translate(18 18)" fill="${palette.ombra}"/>
    <use href="#badge" fill="${palette.alone}" stroke="${palette.alone}" stroke-width="48" stroke-linejoin="miter"/>
    <use href="#badge" fill="${palette.fondo}" stroke="${palette.filo}" stroke-width="7" stroke-linejoin="miter"/>
  </g>
  <g id="Texture">
    <g clip-path="url(#clip)" opacity="${tema.texture.opacita}">
${indent(tema.macchie, 6)}
    </g>
  </g>
  <g id="Icone" fill="none">
${iconeG.join('\n')}
  </g>
  <g id="Testo">
${ombre.join('\n')}
${gruppiTesto.join('\n')}
${tagline ? tagline.markup : ''}
  </g>
  <g id="CutContour" data-spot-color="CutContour" data-tratto="0.25pt" fill="none" stroke="#FF00FF" stroke-width="0.588">
    <use href="#badge"/>
  </g>
</svg>
`;

  return { svg, boxes, testoScelto, nRighe, size, tagline, formato: 'badge' };
}

function stampaDescrizione(sticker, tema, testoScelto) {
  const testo = testoScelto.righe.map((r) => r.map((s) => s.testo).join('')).join(' ');
  const tagline = sticker.testo.tagline ? `, tagline «${sticker.testo.tagline}»` : '';
  if (sticker.marchio) return tema.descrizione;
  return `Adesivo vettoriale quizzOne «${sticker.titolo}»: ${testo}${tagline}. Forme piatte, texture ${tema.nome} e contorno di taglio CutContour.`;
}

// --- output ---------------------------------------------------------------
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          collapseGroups: false,
          mergePaths: false,
          convertShapeToPath: false,
          removeUnknownsAndDefaults: false,
          removeUselessStrokeAndFill: false,
          // niente scorciatoia Q→T: svgo 3 va in crash sui tracciati di
          // opentype (reflectPoint su un path ricostruito), il resto serve
          convertPathData: { floatPrecision: 3, transformPrecision: 4, curveSmoothShorthands: false },
          cleanupNumericValues: { floatPrecision: 3, convertToPx: false },
        },
      },
    },
  ],
};

function ottimizza(svg) {
  return optimize(svg, SVGO_CONFIG).data;
}

function senzaCutContour(svg) {
  // il gruppo non ha figli <g>: il primo </g> è la sua chiusura
  return svg.replace(/\s*<g id="CutContour"[\s\S]*?<\/g>/, '');
}

/** Aggiunge il chunk pHYs: senza, il PNG è a 2126 px ma non dichiara i 300 dpi. */
function conDpi(png, dpi) {
  if (png.readUInt32BE(12) === 0x70485973) return png; // pHYs già presente
  const perMetro = Math.round(dpi / 0.0254);
  const dati = Buffer.alloc(9);
  dati.writeUInt32BE(perMetro, 0);
  dati.writeUInt32BE(perMetro, 4);
  dati.writeUInt8(1, 8);

  const chunk = Buffer.alloc(12 + dati.length);
  chunk.writeUInt32BE(dati.length, 0);
  chunk.write('pHYs', 4, 'ascii');
  dati.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + dati.length)), 8 + dati.length);

  const corte = 8 + 25; // firma + IHDR
  return Buffer.concat([png.subarray(0, corte), chunk, png.subarray(corte)]);
}

let tabellaCrc = null;
function crc32(buffer) {
  if (!tabellaCrc) {
    tabellaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabellaCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = tabellaCrc[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function png(svg, larghezzaMm = MM_W) {
  const resvg = new Resvg(senzaCutContour(svg), {
    fitTo: { mode: 'width', value: Math.round(larghezzaMm * pxPerMm) },
    background: 'rgba(0,0,0,0)',
  });
  const immagine = resvg.render();
  return conDpi(immagine.asPng(), DPI);
}

// --- test -----------------------------------------------------------------
function dentroCerchio(box, raggio = LOGO_R - 12) {
  const punti = [
    [box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1],
    [(box.x0 + box.x1) / 2, box.y0], [(box.x0 + box.x1) / 2, box.y1],
    [box.x0, (box.y0 + box.y1) / 2], [box.x1, (box.y0 + box.y1) / 2],
  ];
  return punti.every(([x, y]) => Math.hypot(x - LOGO_C, y - LOGO_C) <= raggio);
}

function testSvg({ sticker, svg, boxes, formato }, temi) {
  const problemi = [];
  const logo = formato === 'logo';
  if (!svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')) problemi.push('radice SVG non valida');
  if (logo) {
    if (!svg.includes(`viewBox="0 0 ${LOGO_LATO} ${LOGO_LATO}"`)) problemi.push('viewBox logo cambiato');
    if (!svg.includes(`width="${LOGO_MM}mm"`) || !svg.includes(`height="${LOGO_MM}mm"`)) problemi.push('dimensioni mm logo cambiate');
    if (/<text|<tspan/.test(svg)) problemi.push('testo non convertito in tracciati');
  } else {
    if (!svg.includes(`viewBox="0 0 ${VIEW_W} ${VIEW_H}"`)) problemi.push('viewBox cambiato');
    if (!svg.includes(`width="${MM_W}mm"`) || !svg.includes(`height="${MM_H}mm"`)) problemi.push('dimensioni mm cambiate');
    // testo corretto: ogni carattere (spazi compresi) ha prodotto un glifo
    const atteso = sticker.testo.righe
      .flat()
      .map((s) => [...s.testo].length)
      .reduce((a, b) => a + b, 0);
    if (sticker._glifi !== atteso) problemi.push(`glifi ${sticker._glifi} invece di ${atteso}`);
  }
  if (!svg.includes('id="CutContour"')) problemi.push('livello CutContour assente');
  if (!temi[sticker.tema]) problemi.push(`tema ${sticker.tema} assente da temi.json`);

  for (const box of boxes) {
    const dentro = logo ? dentroCerchio(box) : dentroBadge(box);
    if (!dentro) {
      problemi.push(`${box.nome} esce dal ${logo ? 'cerchio' : 'badge'} (${box.x0.toFixed(0)},${box.y0.toFixed(0)} → ${box.x1.toFixed(0)},${box.y1.toFixed(0)})`);
    }
  }
  if (!/<\/svg>\s*$/.test(svg)) problemi.push('SVG troncato');

  return problemi;
}

async function controllo(svg) {
  // resvg fa da parser: se non disegna, l'SVG non è valido
  const resvg = new Resvg(senzaCutContour(svg), { fitTo: { mode: 'width', value: 120 } });
  const dati = resvg.render();
  if (!dati.width || !dati.height) throw new Error('render vuoto');
}

// --- diff visivo ----------------------------------------------------------
async function diffVisivo(dirOriginali, rigenerati) {
  let chromium;
  try {
    ({ chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright/index.mjs')).href));
  } catch (errore) {
    console.log('  diff visivo non eseguito: playwright non disponibile');
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (errore) {
    console.log(`  diff visivo non eseguito: ${String(errore.message).split('\n')[0]}`);
    return;
  }
  const pagina = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  const font = (await fs.readFile(FONT_WOFF2)).toString('base64');
  const scatta = async (file, larghezza, altezza) => {
    // il font va iniettato: da file:// il browser blocca i font esterni e
    // l'originale cadrebbe su Impact, falsando il confronto
    const svg = (await fs.readFile(file, 'utf8'))
      .replace(/url\("?anton-latin\.woff2"?\)/, `url(data:font/woff2;base64,${font})`);
    await pagina.setContent(svg, { waitUntil: 'load' });
    // l'SVG ha le misure in mm: qui lo si porta a 1 unità = 1 px
    await pagina.evaluate(([w, h]) => {
      const nodo = document.querySelector('svg');
      nodo.setAttribute('width', String(w));
      nodo.setAttribute('height', String(h));
      nodo.style.display = 'block';
    }, [larghezza, altezza]);
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.waitForTimeout(150);
    return pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: larghezza, height: altezza } });
  };
  for (const { slug, file, formato } of rigenerati) {
    const originale = path.join(dirOriginali, `${slug}.svg`);
    try {
      await fs.access(originale);
    } catch {
      continue;
    }
    const [larghezza, altezza] = formato === 'logo' ? [LOGO_LATO, LOGO_LATO] : [VIEW_W, VIEW_H];
    await pagina.setViewportSize({ width: larghezza, height: altezza });
    // il CutContour è un livello di stampa: fuori dal confronto visivo
    const pulito = path.join(ROOT, '.tmp', `senza-cut-${slug}.svg`);
    await fs.writeFile(pulito, senzaCutContour(await fs.readFile(file, 'utf8')));
    const a = PNG.sync.read(await scatta(originale, larghezza, altezza));
    const b = PNG.sync.read(await scatta(pulito, larghezza, altezza));
    const diverso = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
    const quota = (diverso / (a.width * a.height)) * 100;
    console.log(`  ${slug}: ${diverso} px diversi (${quota.toFixed(3)}%)`);
  }
  await browser.close();
}

// --- fogli A4 e PDF -------------------------------------------------------
const PT_MM = 2.834645669;
const pt = (mm) => mm * PT_MM;
const A4 = { larghezza: 210, altezza: 297 };

function hexRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Crocini di taglio a 2 mm dal vivo, 3 mm di lunghezza, 0,25 pt. */
function crocini(page, x, y, larghezza, altezza) {
  const scarto = pt(2);
  const lunga = pt(3);
  const linee = [
    [x, y - scarto, x, y - scarto - lunga],
    [x + larghezza, y - scarto, x + larghezza, y - scarto - lunga],
    [x, y + altezza + scarto, x, y + altezza + scarto + lunga],
    [x + larghezza, y + altezza + scarto, x + larghezza, y + altezza + scarto + lunga],
    [x - scarto, y, x - scarto - lunga, y],
    [x - scarto, y + altezza, x - scarto - lunga, y + altezza],
    [x + larghezza + scarto, y, x + larghezza + scarto + lunga, y],
    [x + larghezza + scarto, y + altezza, x + larghezza + scarto + lunga, y + altezza],
  ];
  for (const [x1, y1, x2, y2] of linee) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.25,
      color: rgb(0.15, 0.15, 0.15),
    });
  }
}

/**
 * Un foglio A4 di sticker. L'abbondanza di 2 mm è un rettangolo (o cerchio)
 * di carta disegnato sotto l'arte: si sovrappone ai vicini, poi l'arte copre.
 */
async function foglio(pdf, voci, { colonne, righe, larghezza, altezza, pagina }) {
  const carta = pdf.addPage([pt(A4.larghezza), pt(A4.altezza)]);
  const inizioX = (A4.larghezza - colonne * larghezza) / 2;
  const inizioY = (A4.altezza - righe * altezza) / 2;
  const celle = voci.map((voce, i) => {
    const x = pt(inizioX + (i % colonne) * larghezza);
    const alto = inizioY + Math.floor(i / colonne) * altezza;
    return { voce, x, y: carta.getHeight() - pt(alto) - pt(altezza), w: pt(larghezza), h: pt(altezza) };
  });

  for (const cella of celle) {
    if (cella.voce.tondo) {
      carta.drawCircle({
        x: cella.x + cella.w / 2,
        y: cella.y + cella.h / 2,
        size: cella.w / 2 + pt(2),
        color: hexRgb(cella.voce.sangue),
      });
    } else {
      carta.drawRectangle({
        x: cella.x - pt(2),
        y: cella.y - pt(2),
        width: cella.w + pt(4),
        height: cella.h + pt(4),
        color: hexRgb(cella.voce.sangue),
      });
    }
  }
  for (const cella of celle) {
    carta.drawImage(cella.voce.immagine, { x: cella.x, y: cella.y, width: cella.w, height: cella.h });
    crocini(carta, cella.x, cella.y, cella.w, cella.h);
  }
  if (pagina) {
    carta.drawText(pagina, {
      x: pt(12),
      y: pt(6),
      size: 6,
      font: await pdf.embedFont(StandardFonts.Helvetica),
      color: rgb(0.35, 0.35, 0.35),
    });
  }
  return carta;
}

async function immagine(pdf, cache, slug) {
  if (cache.has(slug)) return cache.get(slug);
  const bytes = await fs.readFile(path.join(PNG_DIR, `${slug}.png`));
  const img = await pdf.embedPng(bytes);
  cache.set(slug, img);
  return img;
}

/** Foglio di prova: tutti gli sticker, i nomi e le palette. */
async function paginaProva(pdf, stickers, temi) {
  const pagina = pdf.addPage([pt(A4.larghezza), pt(A4.altezza)]);
  const grasso = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const inchiostro = rgb(0.08, 0.08, 0.08);
  const grigio = rgb(0.4, 0.4, 0.4);
  const cache = new Map();
  // tutte le misure sono "dall'alto", convertite in coordinate PDF
  const da = (mm) => pagina.getHeight() - pt(mm);

  pagina.drawText('quizzOne — sticker pack', { x: pt(15), y: da(18), size: 26, font: grasso, color: inchiostro });
  pagina.drawText('Prova colore. Stampa al 100%, senza adattamento alla pagina.', {
    x: pt(15), y: da(26), size: 9, font: normale, color: grigio,
  });

  pagina.drawText('STICKER DEL MARCHIO — 90 × 42 mm', { x: pt(15), y: da(38), size: 7, font: grasso, color: inchiostro });
  const marchi = stickers.filter((s) => s.marchio);
  const larghezzaMarchio = 20;
  const altezzaMarchio = 9.33;
  const passoMarchio = (A4.larghezza - 30 - larghezzaMarchio) / Math.max(1, marchi.length - 1);
  for (let i = 0; i < marchi.length; i += 1) {
    const x = pt(15 + i * passoMarchio);
    const y = da(43) - pt(altezzaMarchio);
    pagina.drawImage(await immagine(pdf, cache, marchi[i].slug), {
      x, y, width: pt(larghezzaMarchio), height: pt(altezzaMarchio),
    });
    pagina.drawText(marchi[i].titolo, { x, y: y - pt(3.4), size: 5, font: normale, color: grigio });
  }

  pagina.drawText('LOGHI DEI GIOCHI — Ø 84 mm', { x: pt(15), y: da(64), size: 7, font: grasso, color: inchiostro });
  const loghi = stickers.filter((s) => s.formato === 'logo');
  const lato = 26;
  for (let i = 0; i < loghi.length; i += 1) {
    const x = pt(15 + (i % 5) * 36);
    const y = da(70 + Math.floor(i / 5) * 33) - pt(lato);
    pagina.drawImage(await immagine(pdf, cache, loghi[i].slug), { x, y, width: pt(lato), height: pt(lato) });
    pagina.drawText(loghi[i].titolo, { x, y: y - pt(4), size: 5, font: normale, color: grigio });
  }

  const temiUnici = [...new Set(stickers.map((s) => s.tema))];
  pagina.drawText('PALETTE', { x: pt(15), y: da(212), size: 7, font: grasso, color: inchiostro });
  temiUnici.forEach((chiave, i) => {
    const tema = temi[chiave];
    const x = pt(15 + (i % 4) * 46);
    const y = da(228 + Math.floor(i / 4) * 12);
    pagina.drawText(tema.nome, { x, y: y + pt(5), size: 5, font: normale, color: grigio });
    ['fondo', 'alone', 'accento', 'secondo'].forEach((ruolo, j) => {
      pagina.drawRectangle({
        x: x + pt(j * 5),
        y,
        width: pt(4.2),
        height: pt(4.2),
        color: hexRgb(tema.palette[ruolo]),
        borderColor: rgb(0.78, 0.78, 0.78),
        borderWidth: 0.3,
      });
    });
  });

  pagina.drawText(
    'Carta adesiva A4. Taglio a mano sui crocini o fustella sul livello CutContour (spot magenta, 0,25 pt).',
    { x: pt(15), y: da(286), size: 6.5, font: normale, color: grigio },
  );
  return pagina;
}

async function generaPdf(stickers, temi) {
  const cartella = path.join(DOCS, 'pdf');
  await fs.mkdir(cartella, { recursive: true });
  const marchi = stickers.filter((s) => s.marchio);
  const loghi = stickers.filter((s) => s.formato === 'logo');

  const nuovo = () => PDFDocument.create(); // è asincrono: va atteso
  const salva = async (pdf, nome) => {
    const bytes = await pdf.save();
    await fs.writeFile(path.join(cartella, nome), bytes);
    console.log(`  ${nome} · ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
  };

  const aggiungiBadge = async (pdf, elenco, perFoglio, larghezza, altezza, etichetta) => {
    const cache = new Map();
    for (let i = 0; i < elenco.length; i += perFoglio) {
      const gruppo = elenco.slice(i, i + perFoglio);
      const voci = [];
      for (const s of gruppo) {
        voci.push({ immagine: await immagine(pdf, cache, s.slug), sangue: temi[s.tema].palette.alone });
      }
      await foglio(pdf, voci, {
        colonne: 1,
        righe: gruppo.length,
        larghezza,
        altezza,
        pagina: `${etichetta} · ${gruppo.map((s) => s.titolo).join(' · ')}`,
      });
    }
  };

  const aggiungiLoghi = async (pdf) => {
    const cache = new Map();
    for (let i = 0; i < loghi.length; i += 4) {
      const gruppo = loghi.slice(i, i + 4);
      const voci = [];
      for (const s of gruppo) {
        voci.push({ immagine: await immagine(pdf, cache, s.slug), sangue: temi[s.tema].palette.alone, tondo: true });
      }
      await foglio(pdf, voci, {
        colonne: 2,
        righe: 2,
        larghezza: 90,
        altezza: 90,
        pagina: `Loghi Ø 84 mm · ${gruppo.map((s) => s.titolo).join(' · ')}`,
      });
    }
  };

  // 12 sticker da 90 × 42 su un foglio (8 soggetti + 4 ripetuti)
  const pdfPiccoli = await nuovo();
  const cachePiccoli = new Map();
  const dodici = [];
  for (let i = 0; i < 12; i += 1) {
    const s = marchi[i % marchi.length];
    dodici.push({ immagine: await immagine(pdfPiccoli, cachePiccoli, s.slug), sangue: temi[s.tema].palette.alone });
  }
  await foglio(pdfPiccoli, dodici, {
    colonne: 2, righe: 6, larghezza: 90, altezza: 42, pagina: '12 sticker 90 × 42 mm',
  });
  await salva(pdfPiccoli, 'quizzone-fogli-90x42.pdf');

  // 3 sticker da 180 × 84 per foglio
  const pdfGrandi = await nuovo();
  await aggiungiBadge(pdfGrandi, marchi, 3, 180, 84, '3 sticker 180 × 84 mm');
  await salva(pdfGrandi, 'quizzone-fogli-180x84.pdf');

  // loghi tondi, 4 per foglio
  const pdfLoghi = await nuovo();
  await aggiungiLoghi(pdfLoghi);
  await salva(pdfLoghi, 'quizzone-fogli-loghi.pdf');

  // pack completo: prova colore, poi tutti i fogli
  const pdfPack = await nuovo();
  await paginaProva(pdfPack, stickers, temi);
  const cachePack = new Map();
  const dodiciPack = [];
  for (let i = 0; i < 12; i += 1) {
    const s = marchi[i % marchi.length];
    dodiciPack.push({ immagine: await immagine(pdfPack, cachePack, s.slug), sangue: temi[s.tema].palette.alone });
  }
  await foglio(pdfPack, dodiciPack, {
    colonne: 2, righe: 6, larghezza: 90, altezza: 42, pagina: '12 sticker 90 × 42 mm',
  });
  await aggiungiBadge(pdfPack, marchi, 3, 180, 84, '3 sticker 180 × 84 mm');
  await aggiungiLoghi(pdfPack);
  await salva(pdfPack, 'quizzone-pack-completo.pdf');
}

// --- main -----------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const arg = (nome, fallback = null) => {
    const i = argv.indexOf(`--${nome}`);
    return i === -1 ? fallback : argv[i + 1] ?? true;
  };
  const soloTest = argv.includes('--test');
  const tappa = Number(arg('tappa', 1));
  const solo = arg('solo');
  const dirDiff = arg('diff');

  const [temi, config] = await Promise.all([
    leggiJson(path.join(QUI, 'temi.json')),
    leggiJson(path.join(QUI, 'sticker.json')),
  ]);
  const { font, capRatio, discRatio } = await caricaFont();

  const normalizza = (s) => ({
    ...s,
    testo: s.testo
      ? {
        ...s.testo,
        righe: s.testo.righe.map((riga) =>
          riga.map((segmento) =>
            Array.isArray(segmento) ? { testo: segmento[0], ruolo: segmento[1] } : segmento,
          ),
        ),
      }
      : null,
  });
  const stickers = config.stickers
    .filter(
      (s) => (solo ? s.slug.includes(solo) || s.titolo.toLowerCase().includes(String(solo).toLowerCase()) : s.tappa <= tappa),
    )
    .map(normalizza);
  if (!stickers.length) throw new Error('nessuno sticker da generare');

  if (!soloTest) await fs.mkdir(PNG_DIR, { recursive: true });

  let fallimenti = 0;
  const rigenerati = [];
  for (const sticker of stickers) {
    const tema = temi[sticker.tema];
    if (!tema) throw new Error(`${sticker.slug}: tema "${sticker.tema}" non in temi.json`);
    const composto = await componi(sticker, tema, font, capRatio, discRatio);
    const svg = ottimizza(composto.svg);
    const problemi = testSvg({ sticker, ...composto, svg }, temi);
    try {
      await controllo(svg);
    } catch (errore) {
      problemi.push(`SVG non renderizzabile: ${errore.message}`);
    }
    const stato = problemi.length ? `KO (${problemi.length})` : 'ok';
    const dettaglio = composto.formato === 'logo'
      ? 'logo tondo'
      : `corpo ${String(composto.size).padStart(3)} · ${composto.nRighe} riga${composto.nRighe > 1 ? 'he' : ''}${composto.tagline ? ' + tagline' : ''}`;
    console.log(`${sticker.slug.padEnd(34)} ${stato.padEnd(7)} ${dettaglio}`);
    for (const problema of problemi) console.log(`    ! ${problema}`);
    fallimenti += problemi.length;

    if (soloTest) continue;
    const fileSvg = path.join(DOCS, `${sticker.slug}.svg`);
    await fs.writeFile(fileSvg, svg);
    const immagine = await png(svg, composto.formato === 'logo' ? LOGO_MM : MM_W);
    await fs.writeFile(path.join(PNG_DIR, `${sticker.slug}.png`), immagine);
    rigenerati.push({ slug: sticker.slug, file: fileSvg, formato: composto.formato });
  }

  if (fallimenti) {
    console.error(`\n${fallimenti} problemi: build interrotta`);
    process.exitCode = 1;
    return;
  }
  if (!soloTest) {
    console.log(`\nScritti ${stickers.length} SVG in docs/stickers e ${stickers.length} PNG ${DPI} dpi in docs/stickers/png`);
  }
  if (!soloTest && !solo && tappa >= 2) {
    console.log('\nFogli A4 e PDF:');
    await generaPdf(stickers, temi);
  }
  if (dirDiff) {
    console.log('\nDiff visivo con gli originali:');
    await diffVisivo(path.resolve(ROOT, dirDiff), rigenerati);
  }
}

main().catch((errore) => {
  console.error(errore);
  process.exitCode = 1;
});
