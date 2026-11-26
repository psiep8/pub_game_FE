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
  roulette: {
    box: { x0: 88, y0: 88, x1: 512, y1: 512 },
    disegna: (p) => `<circle cx="300" cy="300" r="206" fill="${p.paper}" stroke="${p.ink}" stroke-width="18"/>
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
        const x = (300 + Math.cos(a) * 150).toFixed(1);
        const y = (300 + Math.sin(a) * 150).toFixed(1);
        const riempimento = i % 2 ? p.ink : p.accent;
        return `<circle cx="${x}" cy="${y}" r="23" fill="${riempimento}"/>`;
      }).join('\n      ')}
      <path d="${Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI * 2) / 12 - Math.PI / 2 + Math.PI / 12;
        const x1 = (300 + Math.cos(a) * 74).toFixed(1);
        const y1 = (300 + Math.sin(a) * 74).toFixed(1);
        const x2 = (300 + Math.cos(a) * 120).toFixed(1);
        const y2 = (300 + Math.sin(a) * 120).toFixed(1);
        return `M${x1} ${y1}L${x2} ${y2}`;
      }).join('')}" fill="none" stroke="${p.ink}" stroke-width="9"/>
      <circle cx="300" cy="300" r="88" fill="${p.ink}"/>
      <circle cx="300" cy="300" r="38" fill="${p.accent}"/>`,
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
function componiLogo(sticker, tema) {
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
  ].join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_MM}mm" height="${LOGO_MM}mm" viewBox="0 0 ${LOGO_LATO} ${LOGO_LATO}" role="img" aria-labelledby="title desc">
  <title id="title">quizzOne - ${escapeXml(sticker.titolo)}</title>
  <desc id="desc">Adesivo tondo quizzOne «${escapeXml(sticker.titolo)}»: logo del gioco su palette ${escapeXml(tema.nome)}, texture stampata e contorno di taglio CutContour.</desc>
  <defs>
${defs}
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
${indent(logo.disegna(tinteLogo(palette)), 4)}
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
  if (dirDiff) {
    console.log('\nDiff visivo con gli originali:');
    await diffVisivo(path.resolve(ROOT, dirDiff), rigenerati);
  }
}

main().catch((errore) => {
  console.error(errore);
  process.exitCode = 1;
});
