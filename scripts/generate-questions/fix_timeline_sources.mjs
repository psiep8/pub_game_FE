#!/usr/bin/env node
/**
 * Sostituisce i link di ricerca della Timeline con la pagina voce di Wikipedia.
 *
 * Prende tutti gli eventi che hanno ancora `w/index.php?search=...`, che è una
 * ricerca e non una fonte. Per ognuno la mappa qui sotto propone uno o più
 * titoli di voce; lo script li verifica (la pagina esiste, il suo testo contiene
 * l'anno dell'evento, c'è almeno una parola in comune, non è una pagina di
 * disambiguazione) e solo allora riscrive `source` con
 * `https://it.wikipedia.org/wiki/<voce>`.
 *
 * I casi che nessun titolo proposto supera restano com'erano e finiscono
 * nell'elenco dei dubbi, da mettere a mano in docs/DOMANDE-DA-REVISIONARE.md:
 * nessun titolo inventato, nessuna pagina scelta "somiglia".
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
 * Un titolo (o più, in ordine di preferenza) per ogni evento. La chiave è
 * l'etichetta dell'evento in `timeline-it.json`: se l'etichetta cambia, la
 * voce torna tra i dubbi invece di essere associata a caso.
 */
const CANDIDATES = {
  // --- Storia
  'Battaglia di Hastings': ['Battaglia di Hastings'],
  'Scoperta dell\'America': ['Scoperta dell\'America', 'Cristoforo Colombo'],
  'Rivoluzione francese': ['Rivoluzione francese'],
  'Inizio della Prima guerra mondiale': ['Prima guerra mondiale'],
  'Caduta del Muro di Berlino': ['Muro di Berlino'],
  'Caduta di Costantinopoli': ['Caduta di Costantinopoli'],
  'Incoronazione di Napoleone': ['Incoronazione di Napoleone', 'Napoleone Bonaparte'],
  'Patti Lateranensi': ['Patti lateranensi'],
  'Fine della Seconda guerra mondiale in Europa': ['Giorno della vittoria in Europa', 'Seconda guerra mondiale'],
  'Costruzione del Muro di Berlino': ['Muro di Berlino'],
  'Dissoluzione dell\'Unione Sovietica': ['Dissoluzione dell\'Unione Sovietica'],

  // --- Geografia e Viaggi
  'Vasco da Gama arriva in India': ['Vasco da Gama'],
  'Apertura del Canale di Suez': ['Canale di Suez'],
  'Naufragio del Titanic': ['RMS Titanic'],
  'Primo volo transatlantico senza scalo': ['Alcock e Brown'],
  'Amelia Earhart attraversa l\'Atlantico in solitaria': ['Amelia Earhart'],
  'Apertura del Tunnel della Manica': ['Tunnel della Manica'],
  'La nave Ever Given blocca il Canale di Suez': ['Ever Given'],
  'Spedizione oceanografica dello Challenger': ['Spedizione Challenger', 'HMS Challenger'],
  'Amundsen raggiunge il Polo Sud': ['Roald Amundsen'],
  'Inaugurazione del Golden Gate Bridge': ['Golden Gate Bridge'],
  'Il batiscafo Trieste raggiunge il fondo delle Marianne': ['Trieste (batiscafo)', 'Fossa delle Marianne'],
  'Eruzione del Monte Sant\'Elena': ['Monte Saint Helens'],
  'L\'eruzione dell\'Eyjafjallajökull blocca i voli': ['Eyjafjallajökull'],

  // --- Scienza e Spazio
  'Copernico pubblica le rivoluzioni celesti': ['De revolutionibus orbium coelestium'],
  'Newton pubblica i Principia': ['Philosophiæ Naturalis Principia Mathematica'],
  'Einstein pubblica la relatività ristretta': ['Relatività ristretta'],
  'Scoperta della penicillina': ['Penicillina'],
  'Scoperta della struttura del DNA': ['DNA', 'Struttura del DNA'],
  'Sbarco dell\'uomo sulla Luna': ['Apollo 11'],
  'Conferma del bosone di Higgs': ['Bosone di Higgs'],
  'Inizio della pandemia di COVID-19': ['Pandemia di COVID-19'],
  'Darwin pubblica L\'origine delle specie': ['L\'origine delle specie'],
  'Primo volo dei fratelli Wright': ['Wright Flyer', 'Fratelli Wright'],
  'Einstein pubblica la relatività generale': ['Relatività generale'],
  'Gagarin, primo uomo nello spazio': ['Jurij Gagarin'],
  'Lancio del telescopio Hubble': ['Telescopio spaziale Hubble'],

  // --- Sport
  'Prime Olimpiadi moderne ad Atene': ['Giochi della I Olimpiade'],
  'Primo Tour de France': ['Tour de France 1903'],
  'Primo Mondiale di calcio in Uruguay': ['Campionato mondiale di calcio 1930'],
  'Jesse Owens vince quattro ori a Berlino': ['Jesse Owens'],
  'Olimpiadi di Roma': ['Giochi della XVII Olimpiade'],
  'Usain Bolt stabilisce il record dei 100 metri': ['Usain Bolt'],
  'L\'Italia vince il Campionato europeo di calcio': ['Campionato europeo di calcio 2020'],
  'Primi Giochi olimpici invernali a Chamonix': ['Giochi olimpici invernali 1924', 'Giochi della I Olimpiade invernale'],
  'Italia-Germania 4-3 ai Mondiali del Messico': ['Campionato mondiale di calcio 1970', 'Italia-Germania 4-3'],
  'L\'Italia vince i Mondiali di calcio in Spagna': ['Campionato mondiale di calcio 1982'],
  'L\'Italia ospita i Mondiali di calcio': ['Campionato mondiale di calcio 1990'],
  'L\'Italia vince i Mondiali di calcio in Germania': ['Campionato mondiale di calcio 2006'],
  'Il Portogallo vince il Campionato europeo': ['Campionato europeo di calcio 2016'],

  // --- Cinema, Serie TV
  'Prima proiezione cinematografica dei fratelli Lumière': ['Fratelli Lumière', 'Auguste e Louis Lumière'],
  'Esce Il cantante di jazz, primo film sonoro': ['Il cantante di jazz (film 1927)'],
  'Biancaneve e i sette nani, primo lungometraggio animato Disney': ['Biancaneve e i sette nani (film 1937)'],
  'Esce Quarto potere di Orson Welles': ['Quarto potere'],
  'Esce Guerre stellari': ['Guerre stellari (film)'],
  'Esce Avatar': ['Avatar (film 2009)'],
  'Parasite vince la Palma d\'Oro': ['Parasite (film 2019)', 'Parasite (film)'],
  'Esce Via col vento': ['Via col vento'],
  'Esce La dolce vita': ['La dolce vita'],
  'Esce Pulp Fiction': ['Pulp Fiction'],
  'Esce Titanic': ['Titanic (film 1997)'],
  'Esce Il Signore degli Anelli: La Compagnia dell\'Anello': ['Il Signore degli Anelli - La Compagnia dell\'Anello'],
  'Esce Inception': ['Inception'],
  'Esce Matrix': ['The Matrix', 'Matrix (film)'],
  'Esce Il padrino': ['Il padrino (film)'],
  'Esce il film Akira': ['Akira (film)'],

  // --- TV e Spettacolo
  'Prima edizione del Festival di Sanremo': ['Festival di Sanremo 1951'],
  'Inizio delle trasmissioni Rai': ['Rai'],
  'Nasce CNN': ['CNN'],
  'Nasce MTV': ['MTV'],
  'Debutta I Simpson': ['I Simpson'],
  'Netflix lancia lo streaming': ['Netflix'],
  'House of Cards, prima serie originale Netflix': ['House of Cards - Gli intrighi del potere'],
  'Debutta Twin Peaks': ['Twin Peaks'],
  'Debutta Friends': ['Friends'],
  'Nasce YouTube': ['YouTube'],
  'Nasce Twitter': ['Twitter'],
  'Debutta Game of Thrones': ['Il Trono di Spade (serie televisiva)'],
  'Debutta Stranger Things': ['Stranger Things'],
  'Nasce Sky Italia': ['Sky Italia'],
  'Debutta Chi vuol essere miliardario? in Italia': ['Chi vuol essere miliardario?'],

  // --- Musica
  'Prima de Le nozze di Figaro di Mozart': ['Le nozze di Figaro'],
  'Prima della Nona sinfonia di Beethoven': ['Sinfonia n. 9 (Beethoven)'],
  'Apertura del Festival di Bayreuth': ['Festival di Bayreuth'],
  'Elvis Presley incide That\'s All Right': ['That\'s All Right, Mama'],
  'I Beatles pubblicano Love Me Do': ['Love Me Do'],
  'Live Aid': ['Live Aid'],
  'Apple lancia l\'iTunes Store': ['ITunes', 'ITunes Store'],
  'Festival di Woodstock': ['Festival di Woodstock'],
  'Esce Bohemian Rhapsody dei Queen': ['Bohemian Rhapsody'],
  'Esce Nevermind dei Nirvana': ['Nevermind'],
  'Escono i Coldplay con Parachutes': ['Parachutes'],
  'Esce Viva la Vida dei Coldplay': ['Viva la vida or Death and All His Friends'],
  'Bob Dylan riceve il Nobel per la letteratura': ['Bob Dylan'],
  'Esce Sgt. Pepper\'s Lonely Hearts Club Band': ['Sgt. Pepper\'s Lonely Hearts Club Band'],
  'Esce Thriller di Michael Jackson': ['Thriller (album Michael Jackson)'],

  // --- Arte e Architettura
  'Completa la cupola del Duomo di Firenze': ['Cupola del Brunelleschi'],
  'Viene inaugurato il David di Michelangelo': ['David (Michelangelo)'],
  'Michelangelo completa la volta della Cappella Sistina': ['Cappella Sistina'],
  'Inaugurazione della Torre Eiffel': ['Torre Eiffel'],
  'Apre il Museum of Modern Art di New York': ['Museum of Modern Art'],
  'Picasso dipinge Guernica': ['Guernica (Picasso)'],
  'Inaugura la Sydney Opera House': ['Sydney Opera House'],
  'Apre la National Gallery di Londra': ['National Gallery (Londra)'],
  'Inaugurazione dell\'Empire State Building': ['Empire State Building'],
  'Apre il Guggenheim Museum di New York': ['Solomon R. Guggenheim Museum'],
  'Apre il museo Guggenheim di Bilbao': ['Guggenheim Museum Bilbao'],
  'Incendio di Notre-Dame a Parigi': ['Cattedrale di Notre-Dame'],
  'Bernini completa il colonnato di San Pietro': ['Piazza San Pietro', 'Basilica di San Pietro in Vaticano'],

  // --- Politica e Attualità
  'Magna Carta in Inghilterra': ['Magna Carta'],
  'Dichiarazione d\'indipendenza degli Stati Uniti': ['Dichiarazione d\'indipendenza degli Stati Uniti d\'America'],
  'Dichiarazione dei diritti dell\'uomo e del cittadino': ['Dichiarazione dei diritti dell\'uomo e del cittadino'],
  'Fondazione delle Nazioni Unite': ['Organizzazione delle Nazioni Unite'],
  'Entrata in vigore della Costituzione italiana': ['Costituzione della Repubblica Italiana'],
  'Attentato alle Torri Gemelle': ['Attentati dell\'11 settembre 2001'],
  'Uscita del Regno Unito dall\'Unione Europea': ['Brexit'],
  'Proclamazione del Regno d\'Italia': ['Regno d\'Italia'],
  'Referendum per la Repubblica in Italia': ['Referendum istituzionale in Italia del 1946'],
  'Accordi di Helsinki': ['Atto finale di Helsinki'],
  'L\'euro entra in circolazione': ['Euro'],
  'Trattato di Lisbona': ['Trattato di Lisbona'],
  'Referendum sulla Brexit': ['Brexit'],
  'Firmato lo Statuto di Roma': ['Statuto di Roma'],
  'Trattato di Roma, nasce la CEE': ['Trattati di Roma'],

  // --- Motori
  'Karl Benz brevetta la prima automobile a motore': ['Benz Patent Motorwagen'],
  'Ford lancia il Model T': ['Ford Model T'],
  'Prima 24 Ore di Le Mans': ['24 Ore di Le Mans'],
  'Primo campionato mondiale di Formula 1': ['Campionato mondiale di Formula 1 1950', 'Formula 1'],
  'Debutta la Volkswagen Golf': ['Volkswagen Golf'],
  'Tesla lancia il Model S': ['Tesla Model S'],
  'Max Verstappen vince il mondiale di Formula 1': ['Max Verstappen'],
  'Nasce Harley-Davidson': ['Harley-Davidson'],
  'Debutta la Mini': ['Mini (1959)'],
  'L\'incidente di Niki Lauda al Nürburgring': ['Niki Lauda'],
  'Debutta la Ferrari F40': ['Ferrari F40'],
  'Muore Ayrton Senna a Imola': ['Ayrton Senna'],
  'Nasce la Formula E': ['Formula E'],
  'Enzo Ferrari fonda la Ferrari': ['Ferrari'],
  'Debutta la Lamborghini Miura': ['Lamborghini Miura'],

  // --- Cibo e Gastronomia
  'Nasce la Coca-Cola': ['Coca-Cola'],
  'La pizza Margherita viene servita a Napoli': ['Pizza Margherita'],
  'Prima guida Michelin': ['Guida Michelin'],
  'Momofuku Ando inventa i noodles istantanei': ['Momofuku Andō', 'Momofuku Ando', 'Noodle istantaneo'],
  'Apre il primo Starbucks a Seattle': ['Starbucks'],
  'La dieta mediterranea entra nel patrimonio UNESCO': ['Dieta mediterranea'],
  'L\'arte del pizzaiolo napoletano entra nel patrimonio UNESCO': ['Pizza napoletana'],
  'Nascono i biscotti Oreo': ['Oreo'],
  'Nasce la carne in scatola Spam': ['Spam (carne)'],
  'Nasce la Nutella': ['Nutella'],
  'Nasce la Diet Coke': ['Coca-Cola Light', 'The Coca-Cola Company', 'Coca-Cola'],
  'Nasce la Red Bull': ['Red Bull'],
  'Apre Eataly a Torino': ['Eataly'],
  'Nasce la Barilla a Parma': ['Barilla'],
  'Apre il primo McDonald\'s': ['McDonald\'s'],

  // --- Lingua e Letteratura
  'Muore Dante e circola la Divina Commedia': ['Divina Commedia'],
  'Pubblicato il Vocabolario della Crusca': ['Vocabolario degli Accademici della Crusca'],
  'Pubblicati I promessi sposi': ['I promessi sposi'],
  'Pubblicati I Malavoglia': ['I Malavoglia'],
  'Pubblicato 1984 di Orwell': ['1984 (romanzo)'],
  'Pubblicato Lolita di Nabokov': ['Lolita (romanzo)'],
  'Pubblicato Harry Potter e la pietra filosofale': ['Harry Potter e la pietra filosofale'],
  'I fratelli Grimm pubblicano le loro fiabe': ['Fratelli Grimm'],
  'Esce Alice nel Paese delle Meraviglie': ['Le avventure di Alice nel Paese delle Meraviglie'],
  'Esce Il piccolo principe': ['Il piccolo principe'],
  'Esce Il Signore degli Anelli': ['Il Signore degli Anelli'],
  'Esce Il nome della rosa': ['Il nome della rosa'],
  'Bembo pubblica le Prose della volgar lingua': ['Prose della volgar lingua'],
  'Prima di Amleto di Shakespeare': ['Amleto'],

  // --- Anime e manga
  'Inizia il manga Astro Boy': ['Astro Boy'],
  'Debutta l\'anime Astro Boy': ['Astro Boy'],
  'Inizia il manga Doraemon': ['Doraemon'],
  'Inizia il manga Dragon Ball': ['Dragon Ball'],
  'Fondazione dello Studio Ghibli': ['Studio Ghibli'],
  'Inizia il manga Naruto': ['Naruto'],
  'La città incantata vince l\'Orso d\'oro': ['La città incantata'],
  'Debutta l\'anime Heidi': ['Heidi (serie animata 1974)'],
  'Debutta Mobile Suit Gundam': ['Mobile Suit Gundam'],
  'Debutta Sailor Moon': ['Sailor Moon'],
  'Esce Princess Mononoke': ['Principessa Mononoke'],
  'Debutta L\'attacco dei giganti': ['L\'attacco dei giganti'],
  'Debutta Demon Slayer': ['Demon Slayer - Kimetsu no yaiba'],
  'Debutta Capitan Harlock': ['Capitan Harlock'],
  'Inizia il manga One Piece': ['One Piece'],

  // --- Gaming e Tecnologia
  'ENIAC, primo computer elettronico general-purpose': ['ENIAC'],
  'Tennis for Two, primo videogioco': ['Tennis for Two'],
  'Primo collegamento ARPANET': ['ARPANET'],
  'Atari lancia Pong': ['Pong'],
  'Nintendo pubblica Mario Bros.': ['Mario Bros.'],
  'Apple presenta il primo iPhone': ['IPhone (prima generazione)'],
  'Nintendo lancia Switch': ['Nintendo Switch'],
  'Atari lancia la console 2600': ['Atari 2600'],
  'Esce Pac-Man': ['Pac-Man'],
  'Nintendo lancia il Game Boy': ['Game Boy'],
  'Escono i primi giochi Pokémon': ['Pokémon Rosso e Blu'],
  'Esce World of Warcraft': ['World of Warcraft'],
  'Esce Minecraft': ['Minecraft'],
  'Esce Doom': ['Doom (videogioco)'],
  'Tim Berners-Lee presenta il World Wide Web': ['World Wide Web'],

  // --- Curiosità già risolte (restano qui per non perderne la scelta)
  'Congresso di Vienna': ['Congresso di Vienna'],
  'Presa di Roma': ['Presa di Roma'],
  'Patti lateranensi': ['Patti lateranensi'],
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

function plain(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mentionsYear(text, year) {
  return new RegExp(`(?<!\\d)${year}(?!\\d)`).test(text);
}

function sharesWord(text, words) {
  const flat = ` ${tokens(text).join(' ')} `;
  return words.some((word) => flat.includes(` ${word} `));
}

function pause(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`wikipedia ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    await pause(Math.max(retryAfter * 1000, 2000 * attempt));
  }
  throw new Error('wikipedia: troppe richieste anche dopo le attese');
}

/**
 * Testo di più voci in una richiesta sola: titolo chiesto -> { titolo finale, testo }.
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

async function main() {
  const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
  const events = bank.events ?? [];
  const targets = events.filter((event) => (event.source ?? '').includes('index.php?search='));
  console.error(`${targets.length} eventi con il link di ricerca`);

  // Testi di tutte le voci proposte, in blocchi.
  const wanted = new Set();
  for (const event of targets) for (const title of CANDIDATES[event.label] ?? []) wanted.add(title);
  const texts = new Map();
  const allTitles = [...wanted];
  for (let index = 0; index < allTitles.length; index += 20) {
    for (const [title, page] of await pageTexts(allTitles.slice(index, index + 20))) texts.set(title, page);
    await pause(500);
  }

  // Verifica e scelta: vince il primo titolo proposto che supera i controlli.
  const rows = [];
  for (const event of targets) {
    const words = tokens(event.label);
    const proposals = CANDIDATES[event.label] ?? [];
    const tried = [];
    let picked = null;

    for (const title of proposals) {
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
      // L'etichetta può contenere il titolo così com'è (CNN, MTV, Pac-Man):
      // in quel caso non serve nessun'altra parola in comune.
      const titleInLabel = plain(event.label).includes(plain(page.title)) && plain(page.title).length >= 3;
      if (!titleInLabel && !sharesWord(page.text, words)) {
        tried.push(`${title} (nessuna parola in comune)`);
        continue;
      }
      picked = page.title;
      break;
    }
    if (!proposals.length) tried.push('nessun titolo proposto nella mappa');

    rows.push({
      label: event.label,
      year: event.year,
      difficulty: event.difficulty,
      category: event.category,
      title: picked,
      url: picked ? `https://it.wikipedia.org/wiki/${encodeURIComponent(picked.replace(/ /g, '_'))}` : null,
      tried,
    });
    if (picked) event.source = rows.at(-1).url;
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
