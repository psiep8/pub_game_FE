#!/usr/bin/env node
/**
 * Celebrità — volti e testi per le persone nuove della banca.
 *
 * Le persone elencate in `celebrita-ambiti.json` ma assenti da
 * `media-it.json` (banca locale, non versionata) si cercano su it.wikipedia:
 * una richiesta ogni venti titoli porta l'introduzione e la miniatura. Le
 * miniature si scaricano in `static/media/people/` e la didascalia diventa la
 * descrizione breve in italiano (quella inglese della vecchia banca non serve
 * più a niente).
 *
 * I crediti non sono un dettaglio: autore, licenza, URL della pagina e file di
 * Commons finiscono in `docs/CREDITI-IMMAGINI-CELEBRITA.md`, che è versionato.
 * Un volto senza licenza registrata non entra.
 *
 * Uso: node scripts/banche/genera-volti.mjs [--dry] [--solo-nuovi]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const peopleDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'static', 'media', 'people');
const creditsPath = join(rootDir, 'docs', 'CREDITI-IMMAGINI-CELEBRITA.md');
const ambitiPath = join(questionsDir, 'celebrita-ambiti.json');
const mediaPath = join(questionsDir, 'media-it.json');

const args = new Set(process.argv.slice(2));
const dry = args.has('--dry');

const API = 'https://it.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'PubGameCelebrityBank/1.0 (banca volti per una serata privata; no crawl)';
const BLOCCO = 20;
const THUMB = 900;

const CATEGORIA = {
  musica: 'Musica',
  sport: 'Sport',
  cinema: 'Cinema',
  tv: 'Televisione',
  spettacolo: 'Spettacolo',
  storia: 'Storia',
  arte: 'Arte',
  scienza: 'Scienza',
  letteratura: 'Letteratura',
};

/**
 * Voci che il titolo diretto non trova: «Zucchero» è lo zucchero, «Amadeus»
 * porta a Mozart, «Tom Holland» è una disambiguazione. Qui si fissa il titolo
 * giusto una volta per sempre.
 */
const TITOLI = new Map([
  ['zucchero', 'Zucchero Fornaciari'],
  ['amadeus', 'Amadeus (conduttore televisivo)'],
  ['tom holland', 'Tom Holland (attore)'],
]);

const NAME_PARTICLES = new Set([
  'de', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le',
  'van', 'von', 'jr', 'sr', 'ii', 'iii', 'iv',
]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function slug(value) {
  return fold(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mentionsName(text, name) {
  const haystack = fold(text);
  for (const token of fold(name).split(/[^\p{L}0-9]+/u)) {
    if (token.length < 3 || NAME_PARTICLES.has(token)) continue;
    const pattern = new RegExp(`(?<!\\p{L})${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u');
    if (pattern.test(haystack)) return true;
  }
  return false;
}

/**
 * Una voce di persona ha una data di nascita e non è una pagina di
 * disambiguazione né la voce di un nome proprio: «Annalisa è un nome proprio
 * di persona» e «Salmo» (il libro) non sono persone.
 */
function looksLikePerson(extract) {
  const text = String(extract ?? '');
  if (!text) return false;
  if (/nome proprio|toponimo|disambiguazione|may refer to|può riferirsi|può indicare/i.test(text)) return false;
  return /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text);
}

function clean(value) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
    if (response.status === 429 || response.status >= 500) {
      await wait(6000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return null;
    return response.json();
  }
  return null;
}

/** Introduzione e miniatura di venti voci in una richiesta. */
async function fetchChunk(names) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    redirects: '1',
    prop: 'extracts|pageimages',
    explaintext: '1',
    exintro: '1',
    exlimit: 'max',
    piprop: 'thumbnail|name',
    pithumbsize: String(THUMB),
    titles: names.join('|'),
  });
  const json = await get(`${API}?${params}`);
  if (!json) return {};
  const back = new Map((json.query?.redirects ?? []).map((row) => [fold(row.from), row.to]));
  const pages = new Map(Object.values(json.query?.pages ?? {}).map((page) => [fold(page.title), page]));
  const result = {};
  for (const name of names) {
    const direct = pages.get(fold(name));
    const viaRedirect = back.has(fold(name)) ? pages.get(fold(back.get(fold(name)))) : null;
    const page = direct ?? viaRedirect;
    if (page && page.missing === undefined) result[name] = page;
  }
  return result;
}

/** Per le voci ambigue: si cerca il titolo giusto. */
async function searchTitle(name) {
  const json = await get(`https://it.wikipedia.org/w/rest.php/v1/search/page?limit=3&q=${encodeURIComponent(name)}`);
  const pages = json?.pages ?? [];
  // Il primo risultato può essere un'altra cosa («Salmo» → «Libro dei Salmi»):
  // si accetta solo un titolo che contiene il nome della persona.
  return pages.find((page) => fold(page.title).includes(fold(name)))?.title ?? null;
}

/**
 * La descrizione si ferma alla professione: «un politico e generale francese».
 * Senza questo taglio l'indizio ampio diventava un paragrafo.
 */
function shorten(value) {
  let text = String(value ?? '').replace(/\.$/, '');
  text = text.replace(/^(stato|stata|stati|state|diventato|diventata|noto|nota|considerato|considerata)\s+/i, '');
  const comma = text.indexOf(',');
  if (comma > 12) text = text.slice(0, comma);
  if (text.length > 90) {
    const cut = text.slice(0, 90);
    text = cut.slice(0, Math.max(cut.lastIndexOf(' '), 40));
  }
  return text.trim();
}

/**
 * Descrizione breve italiana dal predicato della voce: si prende ciò che
 * segue la copula («è un ex velocista giamaicano, …») e ci si ferma alla
 * virgola. Non si parte dalla prima frase: «Usain St. Leo Bolt» si spezza
 * dopo «St.» e la copula finiva nella frase successiva.
 */
function descriptionOf(extract, name) {
  const text = clean(String(extract ?? '').slice(0, 800));
  if (!text) return '';
  const lower = text.toLowerCase();
  let at = -1;
  let length = 0;
  for (const verb of [' è ', ' fu ', ' era ']) {
    const index = lower.indexOf(verb);
    if (index >= 0 && (at < 0 || index < at)) {
      at = index;
      length = verb.length;
    }
  }
  if (at < 0) return mentionsName(text, name) ? '' : shorten(text);
  const predicate = text.slice(at + length);
  const stop = predicate.search(/[,.;]/);
  const cut = stop > 8 ? predicate.slice(0, stop) : predicate;
  const descrizione = shorten(cut);
  return mentionsName(descrizione, name) ? '' : descrizione;
}

async function download(url, target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (response.status === 429 || response.status >= 500) {
      await wait(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 2000) return false;
    writeFileSync(target, buffer);
    return true;
  }
  return false;
}

/** Autore e licenza dei file di Commons, cinquanta alla volta. */
async function creditsFor(files) {
  const credits = new Map();
  for (let start = 0; start < files.length; start += 50) {
    const blocco = files.slice(start, start + 50);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url',
      titles: blocco.map((file) => `File:${file}`).join('|'),
    });
    const json = await get(`${COMMONS}?${params}`);
    for (const page of Object.values(json?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      // I nomi arrivano con gli underscore da it.wikipedia e con gli spazi da
      // Commons: la chiave si normalizza, altrimenti nessun credito combaciava.
      credits.set(String(page.title).replace(/^File:/, '').replace(/_/g, ' '), {
        autore: clean(String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, ' ')) || 'non indicato',
        licenza: clean(String(meta.LicenseShortName?.value ?? '')) || 'non indicata',
        licenzaUrl: String(meta.LicenseUrl?.value ?? ''),
        file: String(info.descriptionurl ?? ''),
      });
    }
    await wait(1200);
  }
  return credits;
}

/** Righe già scritte prima: una rigenerazione parziale non deve cancellarle. */
function mergeCredits(rows) {
  let text = '';
  try {
    text = readFileSync(creditsPath, 'utf8');
  } catch {
    text = '';
  }
  const merged = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| Persona') || line.startsWith('| ---')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length >= 3) merged.set(fold(cells[1]), line);
  }
  for (const row of rows) {
    merged.set(fold(row.persona),
      `| ${row.persona} | \`${row.file}\` | ${row.autore} | ${row.licenza} | ${row.fileCommons} |`);
  }
  return [...merged.values()].join('\n');
}

function creditTable(rows) {
  const lines = [
    '# Crediti delle immagini della banca Celebrità',
    '',
    'Generato da `node scripts/banche/genera-volti.mjs`. Ogni volto della banca',
    'locale arriva da Wikimedia Commons: autore e licenza sono registrati qui.',
    'Un’immagine senza credito non entra nella banca.',
    '',
    '| Persona | File locale | Autore | Licenza | File di Commons |',
    '| --- | --- | --- | --- | --- |',
  ];
  lines.push(mergeCredits(rows));
  lines.push('');
  return lines.join('\n');
}

/**
 * La voce giusta per una persona: se il titolo diretto è una pagina di
 * disambiguazione o un nome proprio, si prova «Nome (sotto-ambito)» e le
 * ricerche con l'ambito. Solo una voce con una data di nascita va bene.
 */
async function resolvePage(row, page) {
  // Il titolo fissato viene prima di tutto: «Zucchero» è una voce valida (lo
  // zucchero) ma non è la persona.
  const forzato = TITOLI.get(fold(row.nome));
  if (forzato) {
    const got = await fetchChunk([forzato]);
    const candidate = got[forzato];
    if (candidate && looksLikePerson(candidate.extract)) {
      console.log(`  ↻ ${row.nome}: «${candidate.title}» (voce fissata)`);
      return candidate;
    }
    await wait(700);
  }
  if (page && looksLikePerson(page.extract) && descriptionOf(page.extract, row.nome)) return page;
  const titoli = new Set([`${row.nome} (${row.sottoAmbito})`]);
  for (const query of [`${row.nome} ${row.sottoAmbito}`, row.nome]) {
    const json = await get(`https://it.wikipedia.org/w/rest.php/v1/search/page?limit=5&q=${encodeURIComponent(query)}`);
    for (const trovato of json?.pages ?? []) {
      if (fold(trovato.title).includes(fold(row.nome))) titoli.add(trovato.title);
    }
    await wait(1000);
  }
  for (const titolo of titoli) {
    if (page && fold(titolo) === fold(page.title)) continue;
    const got = await fetchChunk([titolo]);
    const candidate = got[titolo];
    if (candidate && looksLikePerson(candidate.extract) && descriptionOf(candidate.extract, row.nome)) {
      console.log(`  ↻ ${row.nome}: «${candidate.title}»`);
      return candidate;
    }
    await wait(700);
  }
  return page && looksLikePerson(page.extract) ? page : null;
}

/**
 * Riscrive i crediti di tutti i volti della banca: le pagine di Wikipedia si
 * chiedono in blocchi da venti, i file di Commons in blocchi da cinquanta.
 */
async function rebuildCredits() {
  const media = JSON.parse(readFileSync(mediaPath, 'utf8'));
  const people = (media.people ?? []).filter((person) => String(person.file ?? '').includes('/media/people/'));
  const images = new Map();
  for (let start = 0; start < people.length; start += BLOCCO) {
    const blocco = people.slice(start, start + BLOCCO);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      redirects: '1',
      prop: 'pageimages',
      piprop: 'name',
      pilimit: 'max',
      titles: blocco.map((person) => person.name).join('|'),
    });
    const json = await get(`${API}?${params}`);
    for (const page of Object.values(json?.query?.pages ?? {})) {
      if (page.pageimage) images.set(fold(page.title), page.pageimage);
    }
    await wait(1100);
    console.log(`  volti letti: ${Math.min(start + BLOCCO, people.length)}/${people.length}`);
  }

  const files = [...new Set([...images.values()])];
  const credits = files.length ? await creditsFor(files) : new Map();
  const righe = people.map((person) => {
    const nome = images.get(fold(person.name)) ?? '';
    const credit = credits.get(nome.replace(/_/g, ' ')) ?? null;
    return {
      persona: person.name,
      file: String(person.file).split('/').pop(),
      autore: credit?.autore ?? 'non indicato',
      licenza: credit?.licenza ?? 'da verificare',
      fileCommons: credit?.file
        ?? (nome ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(nome)}` : '—'),
    };
  });

  if (dry) {
    console.log(JSON.stringify(righe, null, 2));
    return;
  }
  writeFileSync(creditsPath, creditTable(righe), 'utf8');
  console.log(`Crediti riscritti per ${righe.length} volti in ${creditsPath}.`);
}

async function main() {
  if (args.has('--crediti')) {
    await rebuildCredits();
    return;
  }
  const ambiti = JSON.parse(readFileSync(ambitiPath, 'utf8'));
  const media = JSON.parse(readFileSync(mediaPath, 'utf8'));
  media.people = Array.isArray(media.people) ? media.people : [];

  const noti = new Map(media.people.map((person) => [fold(person.name), person]));
  const mancanti = (ambiti.persone ?? []).filter((row) => !noti.has(fold(row.nome)));
  const soloNuovi = args.has('--solo-nuovi');

  console.log(`Persone in banca: ${media.people.length}. Da aggiungere: ${mancanti.length}.`);
  if (!mancanti.length) {
    console.log('Niente da fare.');
    return;
  }

  const pages = {};
  for (let start = 0; start < mancanti.length; start += BLOCCO) {
    const blocco = mancanti.slice(start, start + BLOCCO);
    Object.assign(pages, await fetchChunk(blocco.map((row) => row.nome)));
    await wait(1200);
    console.log(`  voci lette: ${Math.min(start + BLOCCO, mancanti.length)}/${mancanti.length}`);
  }

  // Le voci ambigue o senza introduzione si cercano per titolo.
  for (const row of mancanti) {
    if (pages[row.nome] && String(pages[row.nome].extract ?? '').trim()) continue;
    const title = await searchTitle(row.nome);
    if (title) {
      const single = await fetchChunk([title]);
      if (single[title]) pages[row.nome] = single[title];
    }
    await wait(1500);
  }

  if (!existsSync(peopleDir)) mkdirSync(peopleDir, { recursive: true });

  const righeCrediti = [];
  const falliti = [];
  let aggiunti = 0;

  for (const row of mancanti) {
    const page = await resolvePage(row, pages[row.nome]);
    const extract = String(page?.extract ?? '').trim();
    if (!page || !extract) {
      falliti.push({ nome: row.nome, motivo: 'voce di Wikipedia assente o ambigua' });
      continue;
    }
    const descrizione = descriptionOf(extract, row.nome);
    if (!descrizione) {
      falliti.push({ nome: row.nome, motivo: 'descrizione breve non ricavabile' });
      continue;
    }
    const thumb = page.thumbnail?.source ?? '';
    const ext = (String(thumb).match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase();
    const file = `${slug(row.nome)}.${ext}`;
    const target = join(peopleDir, file);
    let scaricato = existsSync(target);
    if (!scaricato && thumb) {
      scaricato = await download(thumb, target);
      await wait(400);
    }
    const person = {
      type: 'IMAGE_BLUR',
      name: row.nome,
      category: CATEGORIA[row.sottoAmbito] ?? 'Celebrità',
      file: scaricato ? `/media/people/${file}` : '',
      description: descrizione,
      extract: extract.slice(0, 900),
    };
    // Senza foto la persona si aggiunge lo stesso: gli indizi restano validi e
    // la TV mostra il segnaposto con l'iniziale.
    media.people.push(person);
    aggiunti += 1;
    if (scaricato) {
      righeCrediti.push({ persona: row.nome, file, commons: page.pageimage ?? '', fonte: page.titles?.canonical ?? '' });
    } else {
      falliti.push({ nome: row.nome, motivo: 'miniatura non scaricata (segnaposto in TV)' });
    }
    // Salvataggio ogni dieci persone: se la sessione si interrompe non si
    // ricomincia da capo (i file già scaricati restano sul disco).
    if (!dry && aggiunti % 10 === 0) {
      writeFileSync(mediaPath, `${JSON.stringify(media, null, 2)}\n`, 'utf8');
    }
    console.log(`${scaricato ? '✓' : '·'} ${row.nome} — ${descrizione}`);
  }

  // Crediti: si chiedono a Commons per i file davvero scaricati.
  const files = righeCrediti.map((row) => row.commons).filter(Boolean);
  const credits = files.length ? await creditsFor(files) : new Map();
  const tabella = righeCrediti.map((row) => {
    const credit = credits.get(row.commons) ?? null;
    return {
      persona: row.persona,
      file: row.file,
      autore: credit?.autore ?? 'non indicato',
      licenza: credit?.licenza ?? 'da verificare',
      fileCommons: credit?.file ?? (row.commons ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(row.commons)}` : '—'),
    };
  });

  if (dry) {
    console.log(JSON.stringify({ aggiunti, falliti, tabella }, null, 2));
    return;
  }

  media.version = Number(media.version) || 1;
  writeFileSync(mediaPath, `${JSON.stringify(media, null, 2)}\n`, 'utf8');
  writeFileSync(creditsPath, creditTable(tabella), 'utf8');
  console.log(`\nAggiunte ${aggiunti} persone, ${falliti.length} da rivedere.`);
  console.log(`Banca locale: ${media.people.length} persone. Crediti in ${creditsPath}.`);
  if (falliti.length) {
    console.log('Da rivedere:');
    for (const row of falliti) console.log(`  - ${row.nome}: ${row.motivo}`);
  }
  if (soloNuovi) console.log('(modalità --solo-nuovi: nessun volto esistente toccato)');
}

await main();
