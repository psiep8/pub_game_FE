#!/usr/bin/env node
/**
 * Sostituisce i link di ricerca della Timeline con la pagina voce di Wikipedia.
 *
 * Gli eventi sono 222 e i link sono tutti `w/index.php?search=...`: una ricerca,
 * non una fonte. Questo script copre gli eventi di difficoltà 5 e un campione
 * sparso di 30 (due per categoria più i primi due del file).
 *
 * Per ognuno c'è un titolo di voce proposto qui sotto: lo script lo verifica su
 * it.wikipedia (la pagina esiste? il testo contiene l'anno dell'evento? c'è
 * almeno una parola dell'etichetta?) e solo se i controlli passano scrive
 * `https://it.wikipedia.org/wiki/<voce>` nel campo `source`. Se nessun titolo
 * proposto passa, l'evento resta com'è e finisce tra i dubbi da mettere a mano
 * in docs/DOMANDE-DA-REVISIONARE.md: niente fonti inventate.
 *
 * Uso (serve la rete: interroga it.wikipedia in blocchi, con attese fra le
 * richieste; se Wikipedia risponde 429 lo script aspetta e riprova):
 *   node scripts/generate-questions/fix_timeline_sources.mjs            # prova
 *   node scripts/generate-questions/fix_timeline_sources.mjs --write    # scrive
 *   node scripts/generate-questions/fix_timeline_sources.mjs --write --json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const bankPath = join(root, 'apps', 'backend', 'src', 'main', 'resources', 'questions', 'timeline-it.json');

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const asJson = args.has('--json');

const API = 'https://it.wikipedia.org/w/api.php';
const UA = 'PubGame-bank-audit/1.0 (controllo fonti Timeline)';

/**
 * Titoli proposti: il primo che passa i controlli vince. Sono voci di
 * it.wikipedia, non link di ricerca; lo script verifica che esistano e che
 * l'anno dell'evento compaia nel testo.
 */
const CANDIDATES = {
  // --- difficoltà 5 (14 eventi)
  'Pace di Aquisgrana': ['Trattato di Aquisgrana (1748)', 'Pace di Aquisgrana'],
  'La spedizione di Perry apre il Giappone': ['Convenzione di Kanagawa', 'Matthew Perry'],
  'Scoperta della fissione nucleare': ['Fissione nucleare', 'Otto Hahn'],
  'Primo campionato italiano di calcio': ['Campionato italiano di calcio 1898', 'Prima Categoria 1898-1899', 'Campionato italiano di football 1898'],
  'Esce La corazzata Potëmkin': ['La corazzata Potëmkin'],
  'Prima edizione dell\'Eurovision Song Contest': ['Eurovision Song Contest 1956'],
  'Prima esecuzione del Requiem di Verdi': ['Messa da requiem (Verdi)'],
  'Bernini completa il colonnato di San Pietro': ['Piazza San Pietro', 'Basilica di San Pietro in Vaticano', 'Gian Lorenzo Bernini'],
  'Firmato lo Statuto di Roma': ['Statuto di Roma'],
  'Enzo Ferrari fonda la Ferrari': ['Ferrari', 'Enzo Ferrari'],
  'Nasce la Barilla a Parma': ['Barilla'],
  'Bembo pubblica le Prose della volgar lingua': ['Prose della volgar lingua', 'Pietro Bembo'],
  'Debutta Capitan Harlock': ['Capitan Harlock'],
  'Esce Doom': ['Doom (videogioco)'],
  // --- campione di 30
  'Caduta dell\'Impero romano d\'Occidente': ['Caduta dell\'Impero romano d\'Occidente'],
  'Incoronazione di Carlo Magno': ['Incoronazione di Carlo Magno', 'Carlo Magno'],
  'Congresso di Vienna': ['Congresso di Vienna'],
  'Hillary e Tenzing raggiungono l\'Everest': ['Everest', 'Edmund Hillary'],
  'Lancio dello Sputnik': ['Sputnik 1', 'Programma Sputnik'],
  'Il Dream Team vince l\'oro olimpico': ['Dream Team (pallacanestro)', 'Nazionale di pallacanestro degli Stati Uniti d\'America'],
  'Esce Matrix': ['The Matrix', 'Matrix (film)'],
  'Nasce Sky Italia': ['Sky Italia'],
  'Esce Sgt. Pepper\'s Lonely Hearts Club Band': ['Sgt. Pepper\'s Lonely Hearts Club Band'],
  'Nasce il cubismo con Les Demoiselles d\'Avignon': ['Les Demoiselles d\'Avignon'],
  'Trattato di Maastricht': ['Trattato di Maastricht'],
  'Toyota lancia la Prius': ['Toyota Prius'],
  'Nasce il movimento Slow Food a Bra': ['Slow Food'],
  'Pubblicato La strada di Swann di Proust': ['Dalla parte di Swann', 'Alla ricerca del tempo perduto'],
  'Inizia il manga One Piece': ['One Piece'],
  'Tim Berners-Lee presenta il World Wide Web': ['World Wide Web'],
  'Presa di Roma': ['Presa di Roma'],
  'Scoperta della tomba di Tutankhamon': ['Tutankhamon'],
  'Röntgen scopre i raggi X': ['Raggi X'],
  'Nadia Comăneci ottiene il primo 10 alle Olimpiadi': ['Nadia Comăneci'],
  'Esce Il padrino': ['Il padrino (film)'],
  'Debutta Chi vuol essere miliardario? in Italia': ['Chi vuol essere miliardario?'],
  'Esce Thriller di Michael Jackson': ['Thriller (album Michael Jackson)', 'Thriller (Michael Jackson)', 'Thriller (album)'],
  'Il Louvre diventa museo pubblico': ['Museo del Louvre'],
  'Trattato di Roma, nasce la CEE': ['Trattati di Roma', 'Trattato di Roma (1957)'],
  'Debutta la Lamborghini Miura': ['Lamborghini Miura'],
  'Apre il primo McDonald\'s': ['McDonald\'s'],
  'Prima di Amleto di Shakespeare': ['Amleto'],
  'Esce il film Akira': ['Akira (film)'],
  'Esce Super Mario Bros. per NES': ['Super Mario Bros.'],
};

const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dei', 'degli',
  'delle', 'da', 'dal', 'dalla', 'in', 'nel', 'nella', 'su', 'sul', 'per', 'con', 'e', 'ed', 'a',
  'al', 'alla', 'che', 'non', 'si', 'esce', 'nasce', 'debutta', 'firma', 'pubblica', 'prima',
  'primo', 'primi', 'prime', 'completa', 'apre', 'fonda', 'scoperta', 'edizione', 'anno',
]);


function tokens(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
}

function mentionsYear(text, year) {
  return new RegExp(`(?<!\\d)${year}(?!\\d)`).test(text);
}

function sharesWord(text, words) {
  const flat = ` ${tokens(text).join(' ')} `;
  return words.some((word) => flat.includes(` ${word} `));
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`wikipedia ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    await new Promise((done) => setTimeout(done, Math.max(retryAfter * 1000, 2000 * attempt)));
  }
  throw new Error('wikipedia: troppe richieste anche dopo le attese');
}

/**
 * Testo di più voci in una richiesta sola: titolo chiesto -> testo (o null).
 * Si legge il wikitesto invece dell'estratto: l'API restituisce l'estratto di
 * una pagina per volta senza `exintro`, e qui serve il testo intero per
 * cercare l'anno.
 */
async function pageTexts(titles) {
  const out = new Map();
  if (!titles.length) return out;
  const data = await api({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    redirects: '1',
    titles: titles.join('|'),
  });
  const query = data.query ?? {};
  const alias = new Map();
  for (const item of query.normalized ?? []) alias.set(item.from, item.to);
  for (const item of query.redirects ?? []) alias.set(item.from, item.to);
  const byTitle = new Map();
  for (const page of Object.values(query.pages ?? {})) {
    const content = page.revisions?.[0]?.slots?.main?.['*'];
    byTitle.set(page.title, page.missing || !content ? null : content);
  }
  for (const title of titles) {
    let current = title;
    for (let hop = 0; hop < 5 && alias.has(current); hop += 1) current = alias.get(current);
    const text = byTitle.get(current) ?? null;
    // Il titolo finale serve per l'URL: un redirect non è una voce.
    out.set(title, text === null ? null : { title: current, text });
  }
  return out;
}

function sample(events, size = 30) {
  const first = events.slice(0, 2);
  const byCategory = new Map();
  for (const event of events) {
    const list = byCategory.get(event.category) ?? [];
    list.push(event);
    byCategory.set(event.category, list);
  }
  const picked = new Set(first.map((event) => event.label));
  for (const list of [...byCategory.values()].sort((a, b) => a[0].category.localeCompare(b[0].category))) {
    for (const fraction of [0.33, 0.66]) {
      const event = list[Math.floor(list.length * fraction)];
      if (event && picked.size < size) picked.add(event.label);
    }
  }
  return events.filter((event) => picked.has(event.label));
}

async function main() {
  const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
  const events = bank.events ?? [];
  const hard = events.filter((event) => Number(event.difficulty) === 5);
  const targets = [...new Map([...hard, ...sample(events)].map((event) => [event.label, event])).values()];

  const wanted = new Set();
  for (const event of targets) {
    for (const title of [event.label, ...(CANDIDATES[event.label] ?? [])]) wanted.add(title);
  }

  const texts = new Map();
  const allTitles = [...wanted];
  for (let index = 0; index < allTitles.length; index += 20) {
    const batch = allTitles.slice(index, index + 20);
    for (const [title, page] of await pageTexts(batch)) texts.set(title, page);
    await new Promise((done) => setTimeout(done, 500));
  }

  const rows = [];
  for (const event of targets) {
    const words = tokens(event.label);
    let picked = null;
    const tried = [];
    for (const title of [event.label, ...(CANDIDATES[event.label] ?? [])]) {
      const page = texts.get(title);
      if (!page) {
        tried.push(`${title} (voce assente)`);
        continue;
      }
      // Una pagina di disambiguazione non è una fonte: contiene tutto e nulla.
      if (/disambigua/i.test(page.title) || /\{\{\s*disambigua/i.test(page.text)) {
        tried.push(`${title} (pagina di disambiguazione)`);
        continue;
      }
      if (!mentionsYear(page.text, event.year)) {
        tried.push(`${title} (anno ${event.year} non nel testo)`);
        continue;
      }
      if (!sharesWord(page.text, words)) {
        tried.push(`${title} (nessuna parola in comune)`);
        continue;
      }
      picked = page.title;
      break;
    }
    // Rinomina: se la voce è un redirect si usa il titolo finale, quello che
    // risponde davvero all'URL.
    const finalTitle = picked;
    rows.push({
      label: event.label,
      year: event.year,
      difficulty: event.difficulty,
      category: event.category,
      title: finalTitle,
      url: finalTitle ? `https://it.wikipedia.org/wiki/${encodeURIComponent(finalTitle.replace(/ /g, '_'))}` : null,
      tried,
      before: event.source ?? '',
    });
    if (finalTitle) event.source = rows.at(-1).url;
  }

  const resolved = rows.filter((row) => row.url);
  const doubts = rows.filter((row) => !row.url);

  if (asJson) {
    console.log(JSON.stringify({ total: rows.length, resolved: resolved.length, doubts, rows }, null, 2));
  } else {
    for (const row of rows) {
      const mark = row.url ? 'ok ' : 'DA REVISIONARE';
      console.log(`${mark} | ${row.year} | ${row.label} | ${row.title ?? row.tried.join(' ; ')}`);
    }
    console.log(`\nVoci risolte: ${resolved.length}/${rows.length}; dubbi: ${doubts.length}`);
    if (!write) console.log('Prova: nessun file scritto (aggiungi --write).');
  }

  if (write) {
    bank.events = events;
    writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n', 'utf8');
    // Con --json l'uscita resta JSON puro: la conferma va su stderr.
    const conferma = `Scritto ${bankPath}: ${resolved.length} fonti aggiornate.`;
    if (asJson) console.error(conferma);
    else console.log(conferma);
  }
}

await main();
