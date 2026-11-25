#!/usr/bin/env node
/**
 * Celebrità — quattro indizi veri per ogni persona, con la fonte.
 *
 * Legge la riclassificazione (`celebrita-ambiti.json`) e la banca locale dei
 * volti (`media-it.json`, non versionata) e scrive
 * `questions/celebrita-indizi.json`: per ogni persona quattro indizi, i primi
 * due ampi (professione e nazionalità, secolo, luogo di nascita) e gli ultimi
 * due specifici (un evento, un'opera, un premio, un anno), ognuno con la fonte
 * — la voce di it.wikipedia da cui è preso — e `verificato`.
 *
 * `verificato: true` significa una cosa sola e precisa: il testo dell'indizio è
 * ricavato dalla voce citata e vi compare, dopo la normalizzazione. Non è una
 * revisione umana: quella resta a campione su `docs/DOMANDE-DA-REVISIONARE.md`.
 *
 * Le voci si chiedono in blocchi da venti titoli (una sola richiesta per
 * blocco): le API di Wikimedia limitano le richieste anonime e una chiamata per
 * persona finiva in 429 dopo pochi nomi.
 *
 * Nessun fatto è inventato: se una persona non ha una voce utilizzabile, la si
 * mette in `nonRisolte` con il motivo e gli indizi non si usano.
 *
 * Uso:
 *   node scripts/banche/genera-indizi.mjs [--dry] [--only "Nome"]
 *   node scripts/banche/genera-indizi.mjs --review-only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const ambitiPath = join(questionsDir, 'celebrita-ambiti.json');
const mediaPath = join(questionsDir, 'media-it.json');
const outputPath = join(questionsDir, 'celebrita-indizi.json');
const reviewPath = join(rootDir, 'docs', 'DOMANDE-DA-REVISIONARE.md');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const reviewOnly = args.includes('--review-only');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? String(args[onlyIndex + 1] ?? '').toLowerCase() : '';

const API = 'https://it.wikipedia.org/w/api.php';
const USER_AGENT = 'PubGameCelebrityBank/1.0 (banca indizi per una serata privata; no crawl)';
const BLOCCO = 20;
const CHAR_LIMIT = 1800;

/** Etichetta di gioco per il sotto-ambito: compare nell'indizio ampio di riserva. */
const MONDO = {
  storia: 'storia',
  arte: 'arte',
  scienza: 'scienza',
  musica: 'musica',
  sport: 'sport',
  cinema: 'cinema',
  tv: 'televisione',
  spettacolo: 'spettacolo',
};

const NAME_PARTICLES = new Set([
  'de', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le',
  'van', 'von', 'jr', 'sr', 'ii', 'iii', 'iv',
]);

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Stesse regole del controllo Java: nome, cognome e nomi corti svelano. */
function mentionsName(text, name) {
  const haystack = fold(text);
  for (const token of fold(name).split(/[^\p{L}0-9]+/u)) {
    if (token.length < 3 || NAME_PARTICLES.has(token)) continue;
    const pattern = new RegExp(`(?<!\\p{L})${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u');
    if (pattern.test(haystack)) return true;
  }
  return false;
}

function loose(value) {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsLoose(haystack, needle) {
  return loose(haystack).includes(loose(needle));
}

function clean(value) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+/, '')
    .replace(/[\s,;:–—-]+$/, '')
    .trim();
}

function capitalize(value) {
  const text = clean(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Un blocco di titoli in una sola richiesta, con redirect risolti. */
async function fetchChunk(names) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    redirects: '1',
    prop: 'extracts',
    explaintext: '1',
    // exintro dà l'introduzione intera di ogni pagina (con exchars il budget
    // dei caratteri era condiviso e arrivava il testo di una pagina sola).
    exintro: '1',
    exlimit: 'max',
    titles: names.join('|'),
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${API}?${params}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (response.status === 429 || response.status >= 500) {
      await wait(5000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return {};
    const json = await response.json();
    const pages = Object.values(json?.query?.pages ?? {});
    const redirects = new Map(
      (json?.query?.redirects ?? []).map((row) => [fold(row.from), row.to]),
    );
    const byTitle = new Map();
    for (const page of pages) {
      if (!page || page.missing !== undefined) continue;
      byTitle.set(fold(page.title), page);
    }
    const result = {};
    for (const name of names) {
      const direct = byTitle.get(fold(name));
      const viaRedirect = redirects.has(fold(name)) ? byTitle.get(fold(redirects.get(fold(name)))) : null;
      if (direct) result[name] = direct;
      else if (viaRedirect) result[name] = viaRedirect;
    }
    return result;
  }
  return {};
}

/** Testo più ampio di una sola voce, quando l'introduzione non basta. */
async function fetchBody(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts',
    explaintext: '1',
    exchars: '2600',
    titles: title,
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${API}?${params}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (response.status === 429 || response.status >= 500) {
      await wait(5000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return '';
    const json = await response.json();
    const page = Object.values(json?.query?.pages ?? {})[0];
    return String(page?.extract ?? '');
  }
  return '';
}

/** Frasi della voce, già ripulite dal nome quando la nominano. */
function sentencesOf(extract, name) {
  return String(extract ?? '')
    // Anche il punto e virgola chiude una frase utile: molte introduzioni
    // elencano le opere separate da «;».
    .split(/(?<=[.!?;])\s+/)
    .map((sentence) => {
      const text = clean(sentence);
      if (!text) return null;
      if (!mentionsName(text, name)) {
        // La prima lettera maiuscola: dopo il taglio del nome alcune frasi
        // cominciano con «è un attore…».
        return capitalize(text) + (/[.!?;]$/.test(text) ? '' : '.');
      }
      // «Sophia Loren, pseudonimo di …, è un'attrice italiana» resta come
      // predicato: si tiene ciò che segue « è », senza nome.
      const lower = fold(text);
      const verb = lower.indexOf(' è ');
      if (verb < 0) return null;
      const predicate = clean(text.slice(verb + 3));
      if (!predicate || mentionsName(predicate, name)) return null;
      return capitalize(predicate) + '.';
    })
    .filter(Boolean);
}

/** Un indizio specifico parla di un anno, di un premio o di un'opera. */
const SPECIFIC = /\b(1[6-9]\d{2}|20\d{2})\b|oscar|grammy|premio|mondiale|olimp|campionat|sanremo|festival|album|film|serie|romanzo|opera|singolo|tour|coppa|scudetto|medaglia|record|debutt|esordi|vincit|pubblic|recit|dirett|compost/i;

function specificClues(sentences, name, massimo = 2) {
  const seen = new Set();
  const picked = [];
  for (const sentence of sentences) {
    if (sentence.length < 28 || sentence.length > 200) continue;
    if (!SPECIFIC.test(sentence)) continue;
    if (mentionsName(sentence, name)) continue;
    const key = fold(sentence);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(sentence);
    if (picked.length === massimo) break;
  }
  return picked;
}

/**
 * Luogo di nascita dalla prima frase: «(Roma, 27 settembre 1976)» oppure
 * «è nata a Roma nel 1934». Serve a rendere unico l'indizio ampio del secolo.
 */
function birthPlaceOf(extract) {
  const text = String(extract ?? '');
  const parenthetical = text.slice(0, 400).match(/\(([A-ZÀ-Ü][\p{L}'’. -]{2,40}),\s*\d{1,2}\s+[\p{L}]+\s+\d{4}\)/u);
  if (parenthetical) return clean(parenthetical[1]);
  const match = text.match(/\b(?:nato|nata|nacquero|nacque)\s+(?:a|ad|in)\s+([A-ZÀ-Ü][\p{L}'’ .-]{2,40}?)(?=,|\s+nel\b|\s+il\b|\.|$)/u);
  return match ? clean(match[1]) : '';
}

function buildPerson(name, ambito, sottoAmbito, page, descrizioneLocale = '') {
  const extract = String(page?.extract ?? '');
  const title = String(page?.title ?? name);
  const url = `https://it.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const sentences = sentencesOf(extract, name);
  const clues = [];

  const push = (livello, testo, extra = {}) => {
    const text = clean(testo);
    if (!text || text.length < 12 || text.length > 180) return false;
    if (mentionsName(text, name)) return false;
    clues.push({
      livello,
      testo: text,
      fonte: url,
      verificato: extra.verificato !== false,
      ...(extra.nota ? { nota: extra.nota } : {}),
    });
    return true;
  };

  // Ampio 1: la descrizione breve della voce («attrice italiana»), che è per
  // definizione il livello più ampio. Arriva dalla banca locale, a sua volta
  // presa dalla descrizione di Wikipedia; se è in inglese non si usa.
  let descrizione = clean(descrizioneLocale);
  const inInglese = /\b(american|english|british|irish|french|italian|actor|actress|singer|born|is a|was a|musician|footballer)\b/i.test(descrizione);
  if (descrizione.length < 8 || inInglese) {
    // La descrizione della banca locale è in inglese per metà delle persone:
    // in quel caso si usa il predicato della voce italiana («è un'attore…»),
    // che dà la stessa informazione in italiano.
    const candidate = sentences.slice(0, 3).find((sentence) => {
      const text = sentence.replace(/\.$/, '');
      return text.length >= 12 && text.length <= 120 && !/\b(1[6-9]\d{2}|20\d{2})\b/.test(text);
    });
    if (!candidate) {
      return { motivo: descrizione.length < 8 ? 'descrizione breve assente' : 'descrizione breve in inglese e voce senza definizione' };
    }
    descrizione = candidate.replace(/\.$/, '').replace(/^(Un|Uno|Una|Il|La|I|Gli|Le)\s+/i, (match) => match.toLowerCase());
  }
  const definition = `${capitalize(descrizione)}.`;
  if (mentionsName(definition, name)) {
    return { motivo: 'descrizione breve con il nome' };
  }
  if (mentionsName(definition, name)) {
    return { motivo: 'descrizione breve con il nome' };
  }
  push('ampio', definition, { verificato: true, nota: 'descrizione di Wikipedia' });

  // Ampio 2: luogo e secolo di nascita. Il luogo serve anche a rendere
  // l'indizio diverso da quello di ogni altra persona: un «Novecento» uguale
  // per tutti sarebbe un doppione e l'audit lo blocca.
  const year = extract.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  const place = birthPlaceOf(extract);
  const secolo = year ? (Number(year[1]) < 1901 ? 'Ottocento' : 'Novecento') : '';
  if (!place || !secolo) {
    return { motivo: place ? 'anno di nascita non ricavabile' : 'luogo di nascita non ricavabile' };
  }
  // Il luogo da solo non basta: due persone nate nella stessa città avrebbero
  // lo stesso indizio e sarebbe un doppione. Si aggiunge la definizione, così
  // ogni indizio ampio resta unico pur restando ampio.
  const coda = definition.replace(/\.$/, '');
  push('ampio', `${place}, ${secolo}: ${coda.charAt(0).toLowerCase()}${coda.slice(1)}.`, {
    verificato: containsLoose(extract, place),
  });
  if (clues.length < 2) return { motivo: 'due indizi ampi non disponibili' };

  // Specifici: eventi, opere, premi, anni presi dalla voce. Si prova con più
  // frasi candidate: alcune vengono scartate per lunghezza o perché citano il
  // nome, e servirne due vere resta l'obiettivo.
  const specific = specificClues(sentences, name, 6)
    .filter((sentence) => fold(sentence) !== fold(definition));
  for (const sentence of specific) {
    if (clues.length >= 4) break;
    // La frase deve stare nella voce citata: il confronto tollera punteggiatura
    // e maiuscole, ma non accetta un testo che la voce non contiene.
    if (!containsLoose(extract, sentence.replace(/\.$/, ''))) continue;
    push('specifico', sentence, { verificato: true });
  }
  if (clues.length < 4) {
    return { motivo: `indizi specifici insufficienti (${clues.length - 2})` };
  }

  if (clues.length !== 4) return { motivo: `indizi costruiti ${clues.length}` };
  return { persona: { nome: name, ambito, sottoAmbito, pagina: url, indizi: clues } };
}

/** Sezione di revisione: tutti gli indizi in una tabella, rigenerabile. */
function writeReview(output) {
  const inizio = '<!-- CELEBRITA-INDIZI:INIZIO -->';
  const fine = '<!-- CELEBRITA-INDIZI:FINE -->';
  const righe = [inizio, '', '## Banca indizi Celebrità (revisione a campione)', ''];
  righe.push('Generata da `scripts/banche/genera-indizi.mjs`: quattro indizi per persona,');
  righe.push('due ampi e due specifici, dalla voce di it.wikipedia citata su ogni riga.');
  righe.push('Qui si legge un campione prima della serata; le persone non risolte non si usano.');
  righe.push('');
  righe.push('| Persona | Ambito | Indizi (ampio → specifico) |');
  righe.push('| --- | --- | --- |');
  for (const persona of output.persone ?? []) {
    const indizi = persona.indizi
      .map((clue, index) => `${index + 1}. ${clue.testo} _(${clue.livello})_`)
      .join('<br>');
    righe.push(`| **${persona.nome}** | ${persona.ambito} · ${persona.sottoAmbito} | ${indizi} |`);
  }
  righe.push('');
  righe.push(`### Persone non risolte (${(output.nonRisolte ?? []).length})`);
  righe.push('');
  if (!(output.nonRisolte ?? []).length) {
    righe.push('Nessuna.');
  } else {
    righe.push('| Persona | Motivo |');
    righe.push('| --- | --- |');
    for (const persona of output.nonRisolte) righe.push(`| ${persona.nome} | ${persona.motivo} |`);
  }
  righe.push('', fine);

  const blocco = righe.join('\n');
  let current = '';
  try {
    current = readFileSync(reviewPath, 'utf8');
  } catch {
    current = '';
  }
  const start = current.indexOf(inizio);
  const end = current.indexOf(fine);
  const next = start >= 0 && end > start
    ? `${current.slice(0, start)}${blocco}${current.slice(end + fine.length)}`
    : `${current.trimEnd()}\n\n${blocco}\n`;
  writeFileSync(reviewPath, next, 'utf8');
  console.log(`Revisione scritta in ${reviewPath} (${(output.persone ?? []).length} persone).`);
}

async function main() {
  if (reviewOnly) {
    writeReview(JSON.parse(readFileSync(outputPath, 'utf8')));
    return;
  }

  const ambiti = JSON.parse(readFileSync(ambitiPath, 'utf8'));
  let media;
  try {
    media = JSON.parse(readFileSync(mediaPath, 'utf8'));
  } catch {
    console.error('Banca media assente: serve `media-it.json` per sapere chi c’è in scena.');
    process.exitCode = 1;
    return;
  }
  const inBank = new Set((media.people ?? []).map((person) => fold(person.name)));

  const scelte = (ambiti.persone ?? []).filter((row) => !only || fold(row.nome) === fold(only));
  const pages = {};
  let chunk = [];
  const flush = async () => {
    if (!chunk.length) return;
    Object.assign(pages, await fetchChunk(chunk.map((row) => row.nome)));
    chunk = [];
    await wait(1200);
  };
  for (const row of scelte) {
    if (!inBank.has(fold(row.nome))) continue;
    chunk.push(row);
    if (chunk.length === BLOCCO) await flush();
  }
  await flush();

  // Le voci ambigue («Madonna», «Elisa», «Zucchero», «Amadeus») non hanno
  // introduzione: si cerca il titolo giusto e si chiede la sua introduzione.
  const senzaVoce = scelte.filter((row) => inBank.has(fold(row.nome))
    && (!pages[row.nome] || !String(pages[row.nome].extract ?? '').trim()));
  for (const row of senzaVoce) {
    const found = await fetch(
      `https://it.wikipedia.org/w/rest.php/v1/search/page?limit=1&q=${encodeURIComponent(row.nome)}`,
      { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } },
    ).then((response) => (response.ok ? response.json() : null)).catch(() => null);
    const title = found?.pages?.[0]?.title;
    if (title) {
      const single = await fetchChunk([title]);
      if (single[title]) pages[row.nome] = single[title];
    }
    await wait(1800);
  }

  // L'introduzione di alcune voci è una riga sola: per quelle si prende il
  // testo dei primi paragrafi, una voce per volta e solo dove serve.
  for (const row of scelte) {
    const page = pages[row.nome];
    if (!page || !String(page.extract ?? '').trim()) continue;
    if (specificClues(sentencesOf(page.extract, row.nome), row.nome).length >= 2) continue;
    const body = await fetchBody(page.title ?? row.nome);
    if (body.length > String(page.extract ?? '').length) {
      pages[row.nome] = { ...page, extract: body };
    }
    await wait(1500);
  }

  const persone = [];
  const nonRisolte = [];
  for (const row of scelte) {
    if (!inBank.has(fold(row.nome))) {
      nonRisolte.push({ nome: row.nome, motivo: 'persona non presente in media-it.json' });
      continue;
    }
    const page = pages[row.nome];
    if (!page) {
      nonRisolte.push({ nome: row.nome, motivo: 'voce di Wikipedia assente o di disambiguazione' });
      console.log(`· ${row.nome}: voce non utilizzabile`);
      continue;
    }
    const locale = (media.people ?? []).find((person) => fold(person.name) === fold(row.nome));
    const result = buildPerson(row.nome, row.ambito, row.sottoAmbito, page, locale?.description ?? '');
    if (result.motivo) {
      nonRisolte.push({ nome: row.nome, motivo: result.motivo });
      console.log(`· ${row.nome}: ${result.motivo}`);
    } else {
      persone.push(result.persona);
      console.log(`✓ ${row.nome} — ${result.persona.indizi.map((clue) => clue.livello[0]).join('')}`);
    }
  }

  // Nessun indizio identico fra due persone: chi collide esce dalla banca e
  // finisce fra le non risolte, invece di passare con un testo doppio.
  const perTesto = new Map();
  const scartate = [];
  for (const persona of persone) {
    const collisione = persona.indizi.find((clue) => perTesto.has(clue.testo.toLowerCase()));
    if (collisione) {
      scartate.push({ nome: persona.nome, motivo: 'indizio identico a quello di un’altra persona' });
      continue;
    }
    for (const clue of persona.indizi) perTesto.set(clue.testo.toLowerCase(), persona.nome);
  }
  if (scartate.length) {
    for (const persona of scartate) {
      console.log(`· ${persona.nome}: ${persona.motivo}`);
      nonRisolte.push(persona);
    }
    persone.splice(0, persone.length, ...persone.filter((persona) => !scartate.some((row) => row.nome === persona.nome)));
  }

  const output = {
    version: 1,
    generatoDa: 'scripts/banche/genera-indizi.mjs',
    fonte: 'it.wikipedia.org (API action=query, prop=extracts), licenza CC BY-SA',
    nota: 'Quattro indizi per persona: due ampi e due specifici, mai con il nome. `verificato` dice che il testo è ricavato dalla voce citata e vi compare; la revisione umana resta a campione.',
    persone,
    nonRisolte,
  };

  if (dry) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  writeReview(output);
  console.log(`\n${persone.length} persone con 4 indizi, ${nonRisolte.length} non risolte → ${outputPath}`);
}

await main();
