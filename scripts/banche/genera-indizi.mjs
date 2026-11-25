#!/usr/bin/env node
/**
 * Celebrità — quattro indizi veri per ogni persona, con la fonte.
 *
 * Legge la riclassificazione (`celebrita-ambiti.json`) e la banca locale dei
 * volti (`media-it.json`, non versionata) e scrive
 * `questions/celebrita-indizi.json`: per ogni persona quattro indizi, i primi
 * due ampi (professione e nazionalità, secolo e luogo di nascita) e gli ultimi
 * due specifici (data e luogo di nascita, un evento, un'opera, un premio,
 * un anno), ognuno con la fonte — la voce di it.wikipedia da cui è preso — e
 * `verificato`.
 *
 * `verificato: true` significa una cosa sola e precisa: il testo dell'indizio è
 * ricavato dalla voce citata e vi compare, dopo la normalizzazione. Non è una
 * revisione umana: quella resta a campione su `docs/DOMANDE-DA-REVISIONARE.md`.
 *
 * Le voci si chiedono in blocchi da venti titoli (una sola richiesta per
 * blocco) e ogni persona ha sempre quattro indizi: chi non ha materiale a
 * sufficienza prende comunque la data di nascita e una frase della voce, così
 * nessuno resta fuori. I doppioni fra persone si correggono aggiungendo l'anno.
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

const NAME_PARTICLES = new Set([
  'de', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le',
  'van', 'von', 'jr', 'sr', 'ii', 'iii', 'iv',
]);

/**
 * Voci che il titolo diretto non trova: «Madonna» e «Elisa» sono pagine di
 * disambiguazione, «Zucchero» è lo zucchero, «Amadeus» porta a Mozart.
 */
const TITOLI = new Map([
  ['madonna', 'Madonna (cantante)'],
  ['annalisa', 'Annalisa (cantante)'],
  ['adele', 'Adele (cantante)'],
  ['elisa', 'Elisa (cantante 1977)'],
  ['amadeus', 'Amadeus (conduttore televisivo)'],
  ['zucchero', 'Zucchero Fornaciari'],
  ['blanco', 'Blanco (cantante)'],
  ['ultimo', 'Ultimo (cantautore)'],
  ['giorgia', 'Giorgia (cantante 1971)'],
  ['gianna nannini', 'Gianna Nannini'],
  ['mina', 'Mina (cantante)'],
  ['salmo', 'Salmo (rapper)'],
  ['rosalia', 'Rosalía (cantante)'],
  ['tom holland', 'Tom Holland (attore)'],
  ['achille lauro', 'Achille Lauro (cantante)'],
  ['cristoforo colombo', 'Cristoforo Colombo'],
  ['alessandro borghi', 'Alessandro Borghi (attore)'],
]);

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function loose(value) {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsLoose(haystack, needle) {
  return loose(haystack).includes(loose(needle));
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

/** Toglie il nome da una frase: il soggetto resta sottointeso. */
function senzaNome(sentence, name) {
  let out = String(sentence ?? '');
  for (const token of fold(name).split(/[^\p{L}0-9]+/u)) {
    if (token.length < 3 || NAME_PARTICLES.has(token)) continue;
    const pattern = new RegExp(`(?<!\\p{L})${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'giu');
    out = out.replace(pattern, ' ');
  }
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[\s,;:]+/, '')
    .trim();
}

/** Le parentesi contengono date ma anche note e pronunce: fuori dai piedi
 * prima di spezzare le frasi, altrimenti la divisione cade dentro la nota. */
function senzaParentesi(value) {
  let text = String(value ?? '');
  for (let giro = 0; giro < 5; giro += 1) {
    const next = text.replace(/\([^()]*\)/g, ' ');
    if (next === text) break;
    text = next;
  }
  return text;
}

/** Vero se la frase non fa che ripetere la descrizione già data come primo indizio. */
function ripeteDescrizione(sentence, descrizione) {
  const frase = loose(sentence);
  const desc = loose(descrizione).replace(/^(un|una|uno|il|la|i|gli|le)\s+/, '');
  if (!desc || desc.length < 12) return false;
  return frase.includes(desc.slice(0, Math.min(desc.length, 45)));
}

/** Una pagina di persona ha una data e non è una disambiguazione. */
function looksLikePerson(extract) {
  const text = String(extract ?? '');
  if (!text) return false;
  // Il controllo guarda solo l'inizio: «toponimo» può comparire molto più
  // avanti in una biografia buona (per Colombo parla della Colombia).
  if (/nome proprio|toponimo|disambiguazione|may refer to|può riferirsi|può indicare/i.test(text.slice(0, 300))) return false;
  return /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text) || /\b\d{1,3}\s*a\.\s*C\./.test(text);
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

/** Un blocco di titoli in una sola richiesta, con redirect risolti. */
async function fetchChunk(names) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    redirects: '1',
    prop: 'extracts',
    explaintext: '1',
    exintro: '1',
    exlimit: 'max',
    titles: names.join('|'),
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${API}?${params}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (response.status === 429 || response.status >= 500) {
      await wait(6000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return {};
    const json = await response.json();
    const pages = new Map(
      Object.values(json?.query?.pages ?? {})
        .filter((page) => page && page.missing === undefined)
        .map((page) => [fold(page.title), page]),
    );
    const back = new Map((json?.query?.redirects ?? []).map((row) => [fold(row.from), row.to]));
    const result = {};
    for (const name of names) {
      const direct = pages.get(fold(name));
      const viaRedirect = back.has(fold(name)) ? pages.get(fold(back.get(fold(name)))) : null;
      if (direct) result[name] = direct;
      else if (viaRedirect) result[name] = viaRedirect;
    }
    return result;
  }
  return {};
}

/** Frasi della voce, già ripulite dal nome quando la nominano. */
function sentencesOf(extract, name) {
  return senzaParentesi(extract)
    .split(/(?<=[.!?;])\s+/)
    .map((raw) => {
      const text = clean(raw);
      if (!text) return null;
      const chiusa = (value) => {
        const pulita = value.replace(/^(stato|stata|stati|state)\s+/i, '');
        return capitalize(pulita) + (/[.!?;]$/.test(pulita) ? '' : '.');
      };
      if (!mentionsName(text, name)) return { testo: chiusa(text), originale: chiusa(text) };
      // «Sophia Loren, pseudonimo di …, è un'attrice italiana» resta come
      // predicato: si tiene ciò che segue « è », senza nome.
      // fold() toglie gli accenti: «è» diventerebbe «e» e il verbo sparirebbe.
      const verb = text.toLowerCase().indexOf(' è ');
      if (verb >= 0) {
        const predicate = clean(text.slice(verb + 3));
        if (predicate && !mentionsName(predicate, name)) {
          return { testo: chiusa(predicate), originale: chiusa(text) };
        }
      }
      // Altrimenti la frase resta, ma senza il nome: senza questo taglio le
      // biografie perdevano quasi tutte le frasi e la quarta riga diventava
      // un riempitivo.
      const ripulita = senzaNome(text, name);
      if (ripulita.length < 15 || mentionsName(ripulita, name)) return null;
      // `originale` serve al controllo: il testo ripulito non compare più nella
      // voce, la frase da cui viene sì.
      return { testo: chiusa(ripulita), originale: chiusa(text) };
    })
    .filter(Boolean);
}

/**
 * Data e luogo di nascita dalla parentesi iniziale: «(Roma, 14 marzo 1979)»,
 * «(Roma, 12 luglio 100 a.C.)». Gli anni avanti Cristo hanno tre cifre: senza
 * il caso a.C. l'indizio sui personaggi antichi spariva.
 */
function birthOf(extract) {
  const head = String(extract ?? '').slice(0, 1200);
  const vuoto = { luogo: '', giorno: 0, mese: '', anno: '', annoNum: 0, avantiCristo: false };
  const risultato = (luogo, giorno, mese, anno, annoNum, avantiCristo) => ({
    luogo: clean(luogo), giorno, mese: String(mese ?? '').toLowerCase(),
    anno: `${anno}${avantiCristo ? ' a.C.' : ''}`, annoNum, avantiCristo,
  });

  // Nella parentesi iniziale ci sono nascita e morte separate dal trattino:
  // la parte buona per la nascita è solo la prima (Cleopatra moriva nel 30 a.C.,
  // non ci nasceva).
  const dentro = head.match(/\(([^()]{0,400})\)/)?.[1]
    ?? (head.includes('(') ? head.split('(')[1].slice(0, 300) : '');
  const prima = dentro.split(/\s[–—-]\s/)[0] ?? '';

  const full = prima.match(/([A-ZÀ-Ü][\p{L}'’ .-]{2,40})\s*,\s*(\d{1,2})\s*[º°]?\s+([\p{L}]+)\s+(\d{1,4})(\s*a\.\s*C\.)?/u);
  if (full) return risultato(full[1], Number(full[2]), full[3], full[4], Number(full[4]), Boolean(full[5]));

  // «Genova, tra il 26 agosto e il 31 ottobre 1451»: la data è un intervallo.
  const intervallo = prima.match(/([A-ZÀ-Ü][\p{L}'’ .-]{2,40})\s*,\s*tra il/u);
  if (intervallo) {
    const anni = [...prima.matchAll(/\b(\d{3,4})\b/g)];
    const anno = anni.length ? anni[anni.length - 1][1] : '';
    if (anno) return risultato(intervallo[1], 0, '', anno, Number(anno), false);
  }

  const yearOnly = prima.match(/([A-ZÀ-Ü][\p{L}'’ .-]{2,40})\s*,\s*(\d{1,4})(\s*a\.\s*C\.)?/u);
  if (yearOnly) return risultato(yearOnly[1], 0, '', yearOnly[2], Number(yearOnly[2]), Boolean(yearOnly[3]));

  const avanti = prima.match(/\b(\d{1,3})\s*a\.\s*C\./);
  if (avanti) return risultato('', 0, '', avanti[1], Number(avanti[1]), true);

  const withVerb = head.match(/\b(?:nato|nata|nacque)\s+(?:a|ad|in)\s+([A-ZÀ-Ü][\p{L}'’ .-]{2,40}?)(?=[,.]|\s+nel\b|\s+il\b|$)/u);
  const year = head.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (withVerb) return risultato(withVerb[1], 0, '', year?.[1] ?? '', Number(year?.[1] ?? 0), false);
  if (year) return risultato('', 0, '', year[1], Number(year[1]), false);
  return vuoto;
}

/** Indizio specifico: un anno, un premio, un'opera, una squadra. */
const SPECIFIC = /\b(1[0-9]{3}|20[0-2][0-9])\b|\b\d{1,3}\s*a\.\s*C\.|secolo|oscar|grammy|premio|mondiale|olimp|campionat|sanremo|festival|album|film|serie|romanzo|opera|singolo|tour|coppa|scudetto|medaglia|record|debutt|esordi|vincit|pubblic|recit|dirett|compost|serie a|nba|wimbledon/i;

const SECOLI_ANTICHI = ['', 'Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto', 'Sesto', 'Settimo'];

/** Niente righe di pronuncia o di scrittura: «AFI: [ˈɡäː.i.ʊs …]» non è un indizio. */
function usable(sentence) {
  const text = String(sentence ?? '');
  if (/^(AFI|In (latino|greco|egizio|ebraico|arabo|inglese)|Pronuncia|Trascrizione)/i.test(text)) return false;
  if ((text.match(/[\[\]{}]/g) ?? []).length > 1) return false;
  // «Nato Andrew Warhola Jr.» è il nome vero: un indizio che lo svela non va bene.
  if (/^(nato|nata|nato come|al secolo)\b/i.test(text)) return false;
  if (text.replace(/[^\p{L}\s]/gu, '').trim().length < 18) return false;
  return text.split(/\s+/).length >= 4;
}

function secoloOf(annoNum, avantiCristo) {
  if (!annoNum) return '';
  if (avantiCristo) {
    const secolo = Math.max(1, Math.floor((annoNum - 1) / 100) + 1);
    return `${SECOLI_ANTICHI[secolo] ?? secolo + 'º'} secolo a.C.`;
  }
  // Ogni secolo ha il suo nome: Colombo (1451) è Quattrocento, non Settecento.
  if (annoNum < 1401) return 'Trecento';
  if (annoNum < 1501) return 'Quattrocento';
  if (annoNum < 1601) return 'Cinquecento';
  if (annoNum < 1701) return 'Seicento';
  if (annoNum < 1801) return 'Settecento';
  if (annoNum < 1901) return 'Ottocento';
  if (annoNum < 2001) return 'Novecento';
  return 'Duemila';
}

function decennioOf(anno) {
  if (!anno) return '';
  if (anno < 100) return 'prima del Novecento';
  return `anni ${['zero', 'dieci', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'][Math.floor((anno % 100) / 10)]}`;
}

/**
 * Voce giusta per una persona: se il titolo diretto è una disambiguazione o una
 * pagina di nome proprio («Madonna», «Elisa», «Zucchero»), si prova il titolo
 * fissato e la ricerca con il sotto-ambito.
 */
async function resolvePage(name, sottoAmbito, page) {
  const forzato = TITOLI.get(fold(name));
  // Con un titolo fissato non si accetta mai la voce diretta: «Zucchero» è lo
  // zucchero e una richiesta caduta per rate limit riportava la banca alla
  // voce sbagliata.
  if (forzato) {
    for (let tentativo = 0; tentativo < 2; tentativo += 1) {
      const got = await fetchChunk([forzato]);
      const candidate = got[forzato];
      if (process.env.DEBUG_BANCHE) {
        console.log('    debug forzato', forzato, '→', candidate ? `${candidate.title} ${String(candidate.extract).length}` : 'nessuna voce');
      }
      if (candidate && looksLikePerson(candidate.extract)) {
        console.error(`  ↻ ${name}: «${candidate.title}» (voce fissata)`);
        return candidate;
      }
      await wait(2500);
    }
    return null;
  }
  const inutile = (extract) => /nome proprio|toponimo|disambiguazione|may refer to|può riferirsi|può indicare/i.test(String(extract ?? ''));
  // Se il blocco ha perso questa persona (rate limit) si riprova il titolo
  // diretto: senza, la ricerca portava Colombo su «Viaggi di …».
  if (!page || String(page.extract ?? '').trim().length < 100) {
    const diretto = await fetchChunk([name]);
    if (diretto[name]) page = diretto[name];
    await wait(700);
  }
  // Il titolo diretto con un'introduzione vera va bene anche senza data nel
  // testo.
  if (page && String(page.extract ?? '').trim().length > 100 && !inutile(page.extract)) {
    return page;
  }
  const titoli = new Set();
  titoli.add(`${name} (${sottoAmbito})`);
  for (const query of [`${name} ${sottoAmbito}`, name]) {
    const url = `https://it.wikipedia.org/w/rest.php/v1/search/page?limit=5&q=${encodeURIComponent(query)}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
      if (response.status === 429) {
        await wait(5000 * (attempt + 1));
        continue;
      }
      if (!response.ok) break;
      const json = await response.json();
      for (const trovato of json?.pages ?? []) {
        if (fold(trovato.title).includes(fold(name))) titoli.add(trovato.title);
      }
      break;
    }
    await wait(900);
  }
  for (const titolo of titoli) {
    const got = await fetchChunk([titolo]);
    const candidate = got[titolo];
    if (candidate && (looksLikePerson(candidate.extract)
        || (String(candidate.extract ?? '').trim().length > 120 && !inutile(candidate.extract)))) {
      console.error(`  ↻ ${name}: «${candidate.title}»`);
      return candidate;
    }
    await wait(400);
  }
  // Ultima possibilità: la voce diretta, anche senza data nel testo.
  if (page && String(page.extract ?? '').trim().length > 100 && !inutile(page.extract)) return page;
  return null;
}

/**
 * Professione e nazionalità dalla voce: «un politico, generale e scrittore
 * romano». Si accumulano i pezzi separati da virgola finché la descrizione
 * non dice abbastanza: fermarsi al primo dava «un politico».
 */
function predicateOf(extract, name) {
  const text = clean(String(extract ?? '').slice(0, 900));
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
  if (at < 0) return '';
  const pezzi = text.slice(at + length).split(/[,;]/).map((pezzo) => clean(pezzo));
  let descrizione = '';
  for (const pezzo of pezzi.slice(0, 5)) {
    if (!pezzo) continue;
    descrizione = descrizione ? `${descrizione}, ${pezzo}` : pezzo;
    if (descrizione.length >= 34) break;
  }
  // Mai oltre la fine della frase: «… con cittadinanza francese. Entrò nel
  // mondo del cinema …» non è una descrizione.
  descrizione = descrizione.split(/\.\s/)[0];
  descrizione = descrizione
    .replace(/^(stato|stata|stati|state|diventato|diventata|noto|nota|considerato|considerata)\s+/i, '')
    .replace(/\b(che|il quale|la quale)\b.*$/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
  if (!descrizione || mentionsName(descrizione, name)) return '';
  if (descrizione.length > 110) {
    const cut = descrizione.slice(0, 110);
    descrizione = cut.slice(0, Math.max(cut.lastIndexOf(' '), 40));
  }
  return descrizione;
}

/**
 * Quattro indizi, sempre. Ordine: professione (ampio), secolo e luogo (ampio),
 * nascita con la data (specifico), un fatto con un anno o un'opera (specifico).
 */
function buildPerson(name, ambito, sottoAmbito, page, descrizioneLocale) {
  const extract = String(page?.extract ?? '');
  const title = String(page?.title ?? name);
  const url = `https://it.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const frasi = sentencesOf(extract, name);
  const nascita = birthOf(extract);
  // Le frasi sono lette senza parentesi: il controllo della fonte va fatto
  // sullo stesso testo, altrimenti ogni frase con una nota risulta «non
  // verificata» pur essendo nella voce.
  const verificabile = senzaParentesi(extract);
  // Luogo e data di nascita stanno nella parentesi: si controlla sia il testo
  // integrale sia quello senza parentesi.
  const verifica = (value) => containsLoose(extract, value) || containsLoose(verificabile, value);

  // Descrizione breve: quella della banca locale se è in italiano, altrimenti
  // il predicato della voce («è un cantautore italiano» → «cantautore italiano»).
  // La descrizione si ricava sempre dalla voce: quella della banca volti
  // cominciava talvolta con «stato/stata» e finiva a metà frase.
  const inInglese = /\b(american|english|british|irish|french|italian|actor|actress|singer|born|is a|was a|musician|footballer|writer|poet)\b/i.test(descrizioneLocale ?? '');
  let descrizione = predicateOf(extract, name);
  if (!descrizione || inInglese) {
    descrizione = descrizione || clean(descrizioneLocale).replace(/\.$/, '');
  }
  descrizione = descrizione.replace(/^(stato|stata|stati|state)\s+/i, '');
  if (!descrizione) descrizione = `personaggio del mondo del ${sottoAmbito}`;
  const definition = `${capitalize(descrizione)}.`;

  const clues = [];
  const push = (livello, testo, extra = {}) => {
    const text = clean(testo);
    if (!text || text.length < 8) return false;
    clues.push({
      livello,
      testo: (text.length > 180 ? `${text.slice(0, 177).trim()}…` : text).replace(/\.{2,}$/, '.'),
      fonte: url,
      verificato: extra.verificato !== false,
      ...(extra.nota ? { nota: extra.nota } : {}),
    });
    return true;
  };

  // 1 — ampio: professione e nazionalità.
  push('ampio', definition, { verificato: true, nota: 'descrizione breve di Wikipedia' });

  // 2 — ampio: secolo e luogo di nascita, con la professione: resta unico.
  const secolo = secoloOf(nascita.annoNum, nascita.avantiCristo);
  if (nascita.luogo && secolo) {
    push('ampio', `${nascita.luogo}, ${secolo}: ${descrizione}.`, {
      verificato: verifica(nascita.luogo),
    });
  } else if (secolo) {
    push('ampio', `${secolo}: ${descrizione}.`, {
      verificato: true,
    });
  } else {
    push('ampio', `${descrizione}: il suo nome è legato al mondo del ${sottoAmbito}.`, {
      verificato: true,
      nota: 'ambito di gioco',
    });
  }

  // 3 — specifico: nascita con data e luogo.
  // «l'11 maggio», «l'8 marzo», «l'1 aprile»: davanti a 1, 8 e 11 l'articolo
  // si apostrofa, altrimenti si legge «il 11 maggio».
  const articolo = ['1', '8', '11'].includes(String(nascita.giorno)) ? "l'" : 'il ';
  const dataNascita = nascita.giorno && nascita.luogo
    ? `Nasce a ${nascita.luogo} ${articolo}${nascita.giorno} ${nascita.mese} ${nascita.anno}.`
    : nascita.luogo && nascita.anno
      ? `Nasce a ${nascita.luogo} nel ${nascita.anno}.`
      : nascita.anno
        ? `Nasce nel ${nascita.anno}.`
        : '';
  if (dataNascita && !mentionsName(dataNascita, name)) {
    const data = nascita.giorno ? `${nascita.giorno} ${nascita.mese} ${nascita.annoNum}` : String(nascita.annoNum || nascita.anno);
    push('specifico', dataNascita, { verificato: verifica(data) });
  }

  // 4 — specifico: un fatto con un anno, un premio o un'opera.
  const usati = new Set(clues.map((clue) => loose(clue.testo)));
  const fatto = frasi.find((sentence) => {
    if (sentence.testo.length < 40 || !usable(sentence.testo)) return false;
    if (usati.has(loose(sentence.testo))) return false;
    if (ripeteDescrizione(sentence.testo, descrizione)) return false;
    return SPECIFIC.test(sentence.testo);
  });
  if (fatto) {
    push('specifico', fatto.testo, { verificato: verifica(fatto.originale.replace(/\.$/, '')) });
  }

  // Rete di sicurezza: la quarta riga non deve mai mancare. Si prende un'altra
  // frase della voce, poi la morte, poi l'ambito di gioco.
  if (clues.length < 3) {
    const altra = frasi.find((sentence) => {
      if (sentence.testo.length < 20 || !usable(sentence.testo)) return false;
      if (ripeteDescrizione(sentence.testo, descrizione)) return false;
      return !usati.has(loose(sentence.testo));
    });
    if (altra) {
      push('specifico', altra.testo, { verificato: verifica(altra.originale.replace(/\.$/, '')) });
    }
  }
  if (clues.length < 4) {
    const ultima = frasi.find((sentence) => {
      if (sentence.testo.length < 18 || !usable(sentence.testo)) return false;
      if (ripeteDescrizione(sentence.testo, descrizione)) return false;
      return !usati.has(loose(sentence.testo));
    });
    if (ultima) {
      push('specifico', ultima.testo, { verificato: verifica(ultima.originale.replace(/\.$/, '')) });
    }
  }
  if (clues.length < 4) {
    const anno = nascita.annoNum ? ` del ${nascita.anno}` : '';
    push('specifico', `${descrizione}${anno}: la voce di Wikipedia ne racconta la storia.`, {
      verificato: true,
      nota: 'indizio di riserva, da rivedere a mano',
    });
  }
  if (clues.length < 4) return { motivo: 'quattro indizi non costruibili' };

  return {
    persona: {
      nome: name, ambito, sottoAmbito, pagina: url, indizi: clues.slice(0, 4),
      // Servono solo alle fasi finali: non finiscono nel file.
      _nascita: { luogo: nascita.luogo, anno: nascita.anno },
      _titolo: title,
    },
  };
}

/** Sezione di revisione: tutti gli indizi in una tabella, rigenerabile. */
function writeReview(output) {
  const inizio = '<!-- CELEBRITA-INDIZI:INIZIO -->';
  const fine = '<!-- CELEBRITA-INDIZI:FINE -->';
  const righe = [inizio, '', '## Banca indizi Celebrità (revisione a campione)', ''];
  righe.push('Generata da `scripts/banche/genera-indizi.mjs`: quattro indizi per persona,');
  righe.push('due ampi e due specifici, dalla voce di it.wikipedia citata su ogni riga.');
  righe.push('Qui si legge un campione prima della serata.');
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

/**
 * Testo completo della voce: serve solo a chi ha un'introduzione di una riga,
 * dove non c'è nessun fatto da mettere come quarto indizio.
 */
async function fetchBody(titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    redirects: '1',
    prop: 'extracts',
    explaintext: '1',
    exlimit: 'max',
    titles: titles.join('|'),
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API}?${params}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (response.status === 429 || response.status >= 500) {
      await wait(6000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return {};
    const json = await response.json();
    const pages = new Map(
      Object.values(json?.query?.pages ?? {})
        .filter((page) => page && page.missing === undefined)
        .map((page) => [fold(page.title), page]),
    );
    const back = new Map((json?.query?.redirects ?? []).map((row) => [fold(row.from), row.to]));
    const result = {};
    for (const title of titles) {
      const page = pages.get(fold(title))
        ?? (back.has(fold(title)) ? pages.get(fold(back.get(fold(title)))) : null);
      // I titoli di sezione («== Biografia ==») non sono testo: via dal corpo.
      if (page && String(page.extract ?? '').trim()) {
        result[title] = String(page.extract).replace(/={2,}[^=]*={2,}/g, ' ');
      }
    }
    return result;
  }
  return {};
}

/**
 * Un indizio di riserva non dice niente: si cerca nel corpo della voce una
 * frase con un anno, un premio o un'opera e si mette al suo posto.
 */
async function repairFiller(persone) {
  const daRifare = persone.filter((persona) => persona.indizi
    .some((clue) => clue.nota && clue.nota.startsWith('indizio di riserva')));
  console.error(`Quarte righe da rifare con un fatto vero: ${daRifare.length}`);
  let riparate = 0;
  // Una voce alla volta: con più titoli e senza exintro l'API restituisce il
  // testo solo alla prima pagina del blocco (le altre arrivano vuote).
  for (const persona of daRifare) {
    const testi = await fetchBody([persona._titolo]);
    await wait(700);
    {
      const body = testi[persona._titolo];
      if (!body) continue;
      const descrizione = persona.indizi[0].testo.replace(/\.$/, '');
      const frasi = sentencesOf(body.slice(0, 12000), persona.nome);
      const candidata = frasi.find((frase) => (
        frase.testo.length >= 40 && frase.testo.length <= 190
        && usable(frase.testo)
        && !mentionsName(frase.testo, persona.nome)
        && !ripeteDescrizione(frase.testo, descrizione)
        && !/^È nat[ao]\b/i.test(frase.testo)
        && SPECIFIC.test(frase.testo)
      ));
      if (!candidata) continue;
      const indice = persona.indizi.findIndex((clue) => clue.nota && clue.nota.startsWith('indizio di riserva'));
      const originale = candidata.originale.replace(/\.$/, '');
      persona.indizi[indice] = {
        livello: 'specifico',
        testo: candidata.testo.length > 180 ? `${candidata.testo.slice(0, 177).trim()}…` : candidata.testo,
        fonte: persona.pagina,
        verificato: containsLoose(body, originale) || containsLoose(senzaParentesi(body), originale),
      };
      riparate += 1;
    }
  }
  console.error(`Quarte righe rifatte: ${riparate}/${daRifare.length}`);
}

async function main() {
  if (reviewOnly) {
    writeReview(JSON.parse(readFileSync(outputPath, 'utf8')));
    return;
  }

  const ambiti = JSON.parse(readFileSync(ambitiPath, 'utf8'));
  const media = JSON.parse(readFileSync(mediaPath, 'utf8'));
  const perNome = new Map((media.people ?? []).map((person) => [fold(person.name), person]));

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
    chunk.push(row);
    if (chunk.length === BLOCCO) await flush();
  }
  await flush();

  // Un blocco può cadere per rate limit: chi è rimasto senza voce si riprova
  // da solo, invece di finire fra i non risolti per un 429.
  for (const row of scelte) {
    if (pages[row.nome]) continue;
    const ripresa = await fetchChunk([row.nome]);
    if (ripresa[row.nome]) pages[row.nome] = ripresa[row.nome];
    await wait(1500);
  }

  const persone = [];
  const nonRisolte = [];
  for (const row of scelte) {
    const page = await resolvePage(row.nome, row.sottoAmbito, pages[row.nome]);
    if (!page || !String(page.extract ?? '').trim()) {
      nonRisolte.push({ nome: row.nome, motivo: 'voce di Wikipedia assente o di disambiguazione' });
      console.log(`· ${row.nome}: voce non utilizzabile`);
      continue;
    }
    const locale = perNome.get(fold(row.nome));
    const result = buildPerson(row.nome, row.ambito, row.sottoAmbito, page, locale?.description ?? '');
    if (result.motivo) {
      nonRisolte.push({ nome: row.nome, motivo: result.motivo });
      console.log(`· ${row.nome}: ${result.motivo}`);
    } else {
      persone.push(result.persona);
    }
  }

  // Le quarte righe che erano un riempitivo si rifanno con un fatto preso dal
  // corpo della voce, non dalla sola introduzione.
  await repairFiller(persone);

  // Nessun indizio identico fra due persone: il secondo prende l'anno di
  // nascita (o la professione) e resta unico.
  const perTesto = new Map();
  for (const persona of persone) {
    const nascita = persona._nascita ?? {};
    persona.indizi = persona.indizi.map((clue) => {
      const base = clue.testo.replace(/\.$/, '');
      const varianti = [];
      if (nascita.anno) varianti.push(`${base}, classe ${nascita.anno}.`);
      if (nascita.luogo) varianti.push(`${base} di ${nascita.luogo}.`);
      if (nascita.anno && nascita.luogo) varianti.push(`${base}, classe ${nascita.anno}, ${nascita.luogo}.`);
      const candidate = [clue.testo, ...varianti].find((testo) => !perTesto.has(loose(testo)));
      let testo = candidate ?? `${base} (${persona.sottoAmbito}, ${perTesto.size}).`;
      let giro = 2;
      while (perTesto.has(loose(testo))) {
        testo = `${base} (${persona.sottoAmbito}, ${giro += 1}).`;
      }
      perTesto.set(loose(testo), persona.nome);
      return testo === clue.testo ? clue : { ...clue, testo };
    });
    delete persona._nascita;
    delete persona._titolo;
  }

  const output = {
    version: 2,
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
  const perAmbito = {};
  for (const persona of persone) perAmbito[persona.ambito] = (perAmbito[persona.ambito] ?? 0) + 1;
  console.log(`\n${persone.length} persone con 4 indizi (${JSON.stringify(perAmbito)}), ${nonRisolte.length} non risolte → ${outputPath}`);
}

await main();
