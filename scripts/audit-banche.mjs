#!/usr/bin/env node
/**
 * Audit delle banche domande (sezione 4.1 della specifica punteggi e banche).
 *
 * Legge le banche servite dal backend e stampa, per ogni gioco, i controlli
 * che si possono fare senza conoscere il pubblico:
 *   - conteggi per categoria e difficoltà;
 *   - doppioni (stesso testo, stesso testo+risposta);
 *   - distrattori troppo corti o fuori formato;
 *   - posizione della risposta corretta (A/B/C/D) per categoria;
 *   - domande che contengono la propria risposta;
 *   - opzioni vietate ("tutte le precedenti", opinioni, "il più...");
 *   - Timeline: eventi per categoria, anni troppo vicini, campi mancanti;
 *   - Azzardo: copertura categoria x livello;
 *   - Ultima spiaggia: tabella categoria x livello con i buchi.
 *
 * Non modifica nulla: la revisione dei contenuti resta a mano, come chiede la
 * specifica. Con `--json` stampa il report in JSON; con `--write` aggiorna
 * docs/BANCHE-AUDIT.md.
 *
 * Con `--ci` non scrive nulla e fallisce (exit 1) per doppioni, segnalazioni,
 * campi mancanti o celle di Ultima spiaggia sotto la soglia.
 *
 * Uso: node scripts/audit-banche.mjs [--json] [--write] [--ci]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const staticDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'static');
const bankServiceFile = join(rootDir, 'apps', 'backend', 'src', 'main', 'java', 'com', 'pub_game_be', 'service', 'QuestionBankService.java');
const celebritaAmbitiFile = join(questionsDir, 'celebrita-ambiti.json');
const celebritaIndiziFile = join(questionsDir, 'celebrita-indizi.json');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const writeReport = args.has('--write');

const DIFFICULTIES = ['facile', 'medio', 'difficile'];
/**
 * Cinque fasce distinte, una per livello: 100 facile, 200 medio-facile,
 * 300 media, 400 medio-difficile, 500 difficile. Ogni livello ha bisogno di
 * almeno una domanda dedicata nella categoria.
 */
const ULTIMA_SPIAGGIA_BANDS = ['facile', 'medio-facile', 'media', 'medio-difficile', 'difficile'];
// Tre domande per categoria e livello: una serata ne consuma cinque (una per
// livello) e ogni categoria torna in scena dopo circa tre serate, quindi con
// una sola domanda per cella il pubblico la rivedeva subito. Il conto e' in
// docs/BANCHE-AUDIT.md; sotto questa soglia l'audit deve fallire.
const ULTIMA_SPIAGGIA_MIN_PER_LEVEL = 3;
/** Sotto questa differenza due eventi Timeline sono troppo vicini per un round. */
const TIMELINE_MIN_YEAR_GAP = 3;
const TIMELINE_CARDS_PER_ROUND = 8;
const TIMELINE_ROUNDS = 3;

function readJson(name) {
  return JSON.parse(readFileSync(join(questionsDir, name), 'utf8'));
}

/**
 * La banca media non è versionata: in CI il file non c'è e i controlli che la
 * riguardano si saltano invece di far fallire l'audit.
 */
function readJsonIfPresent(name) {
  const path = join(questionsDir, name);
  return existsSync(path) ? readJson(name) : null;
}

/**
 * Correzioni a mano della banca media, in un file versionato: `media-it.json`
 * non lo è, quindi senza questo passaggio l'audit controllerebbe anni diversi
 * da quelli corretti a mano.
 */
function applyMediaPatches(media) {
  // Senza banca (CI) le patch non hanno voci a cui applicarsi: si salta.
  const result = { fields: 0, unmatched: [], skipped: !media };
  const path = join(questionsDir, 'media-patches.json');
  if (!media || !existsSync(path)) return result;

  const patches = JSON.parse(readFileSync(path, 'utf8'));
  const key = (text) => normalizeText(String(text ?? ''));
  const tracks = new Map((media.music ?? []).map((item) => [key(`${item.title} ${item.artist}`), item]));
  const people = new Map((media.people ?? []).map((item) => [key(item.name), item]));

  const applyOne = (item, patch, label) => {
    if (!item) {
      result.unmatched.push(label);
      return;
    }
    for (const [field, value] of Object.entries(patch.set ?? {})) {
      if (item[field] === value) continue;
      item[field] = value;
      result.fields += 1;
    }
  };

  for (const patch of patches.music ?? []) {
    applyOne(
      tracks.get(key(`${patch.title ?? ''} ${patch.artist ?? ''}`)),
      patch,
      `musica: ${patch.artist ?? ''} - ${patch.title ?? ''}`,
    );
  }
  for (const patch of patches.people ?? []) {
    applyOne(people.get(key(patch.name)), patch, `persona: ${patch.name ?? ''}`);
  }

  return result;
}

/** I file media sono serviti da `/media/...`: il percorso su disco parte da static. */
function mediaFileExists(relative) {
  if (!relative) return false;
  return existsSync(join(staticDir, String(relative).replace(/^\//, '')));
}

/** Le copertine possono arrivare da un CDN: un URL assoluto è già servibile. */
function mediaOrRemoteExists(value) {
  if (!value) return false;
  return /^https?:\/\//i.test(String(value)) || mediaFileExists(value);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeDifficulty(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (key === 'easy') return 'facile';
  if (key === 'hard') return 'difficile';
  if (key === 'medium') return 'medio';
  return DIFFICULTIES.includes(key) ? key : key || '(assente)';
}

function countBy(rows, keyOf) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'it'));
}

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  return [head, rule, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}

/** Controlli comuni a Quiz, Arena, Cavallo, Tennis e Ultima spiaggia. */
function auditQuestions(bank) {
  const questions = bank.questions;
  const byType = countBy(questions, (q) => q.type ?? '(assente)');
  const byCategory = countBy(questions, (q) => q.category ?? '(assente)');
  const byDifficulty = countBy(questions, (q) => normalizeDifficulty(q.difficulty));

  const list = questions.map((q) => ({
    ...q,
    difficulty: normalizeDifficulty(q.difficulty),
    options: Array.isArray(q.options) ? q.options : [],
  }));

  const textSeen = new Map();
  const pairSeen = new Map();
  const duplicates = [];
  for (const q of list) {
    const textKey = normalizeText(q.question);
    const pairKey = `${textKey}|${normalizeText(q.correctAnswer)}`;
    // L'Indovina chi ripete "Chi è questa persona?" per ogni personaggio: il
    // testo è lo stesso ma la domanda (e il media) cambia.
    if (q.type === 'IMAGE_BLUR') {
      pairSeen.set(pairKey, q.id);
      continue;
    }
    if (pairSeen.has(pairKey)) {
      duplicates.push({ kind: 'testo+risposta', id: q.id, other: pairSeen.get(pairKey), question: q.question });
    } else if (textSeen.has(textKey) && q.type === textSeen.get(textKey).type) {
      duplicates.push({ kind: 'testo', id: q.id, other: textSeen.get(textKey).id, question: q.question });
    }
    pairSeen.set(pairKey, q.id);
    if (!textSeen.has(textKey)) textSeen.set(textKey, q);
  }

  // "Quale deserto è il più grande" ha una risposta sola e verificabile: il
  // divieto riguarda i superlativi di gusto, non i primati misurabili. Resta
  // segnalato solo ciò che è un'opinione o un'opzione-riassunto.
  const forbidden = /tutte le (precedenti|sopra)|nessuna delle (precedenti|sopra)|tutte e tre|i migliori|secondo me|opinione/i;
  const isNumeric = (value) => /^[\d.,%+\-−\s]+$/.test(String(value ?? ''));

  const issues = [];
  const positionByCategory = new Map();
  for (const q of list) {
    const correctIndex = q.options.indexOf(q.correctAnswer);
    if (q.type !== 'IMAGE_BLUR' && q.options.length > 0) {
      if (correctIndex < 0) {
        issues.push({ type: 'risposta assente dalle opzioni', id: q.id, detail: q.question });
      } else if (q.type !== 'TRUE_FALSE') {
        const positions = positionByCategory.get(q.category) ?? [0, 0, 0, 0];
        if (correctIndex < 4) positions[correctIndex] += 1;
        positionByCategory.set(q.category, positions);
      }
    }
    if (q.type === 'QUIZ' || q.type === 'TENNIS_BATTLE') {
      const wrong = q.options.filter((option) => option !== q.correctAnswer);
      if (q.options.length !== 4) {
        issues.push({ type: 'opzioni diverse da quattro', id: q.id, detail: `${q.options.length}` });
      }
      if (wrong.length !== new Set(wrong).size) {
        issues.push({ type: 'distrattori ripetuti', id: q.id, detail: q.question });
      }
      // Un'opzione come "C#" ha due caratteri reali: conta la lunghezza
      // scritta, non quella normalizzata che perderebbe il cancelletto.
      const tooShort = wrong.filter((option) => !isNumeric(option) && String(option).trim().length < 2);
      if (tooShort.length > 0) {
        issues.push({ type: 'distrattore troppo corto', id: q.id, detail: tooShort.join(', ') });
      }
      if (forbidden.test(q.question) || q.options.some((option) => forbidden.test(option))) {
        issues.push({ type: 'opzione vietata o opinione', id: q.id, detail: q.question });
      }
      // Una risposta di un solo carattere (per esempio l'articolo "L'")
      // comparirebbe dentro qualunque testo italiano: non è un indizio.
      const answerText = normalizeText(q.correctAnswer);
      if (answerText.length >= 2 && normalizeText(q.question).includes(answerText)) {
        issues.push({ type: 'la domanda contiene la risposta', id: q.id, detail: q.question });
      }
      const lengths = [q.correctAnswer, ...wrong].map((option) => String(option).length);
      const longest = Math.max(...lengths);
      const answerLongest = String(q.correctAnswer).length === longest;
      // Numeri e risposte brevissime non hanno un formato confrontabile.
      if (!isNumeric(q.correctAnswer) && answerLongest && longest > Math.min(...lengths) * 2 && longest > 8) {
        issues.push({ type: 'indizio di forma: risposta più lunga', id: q.id, detail: q.question });
      }
    }
  }

  return {
    total: list.length,
    byType: Object.fromEntries(sortedEntries(byType)),
    byCategory: Object.fromEntries(sortedEntries(byCategory)),
    byDifficulty: Object.fromEntries(sortedEntries(byDifficulty)),
    duplicates,
    issues,
    positionByCategory: Object.fromEntries(
      [...positionByCategory.entries()].map(([category, positions]) => [category, positions]),
    ),
    rows: list,
  };
}

/** Timeline: copertura, date ravvicinate, campi di verifica. */
function auditTimeline(bank) {
  const events = bank.events;
  const byCategory = countBy(events, (event) => event.category ?? '(assente)');
  const byDifficulty = countBy(events, (event) => normalizeDifficulty(event.difficulty));
  const seen = new Map();
  const duplicates = [];
  const missing = [];
  const questionable = [];

  events.forEach((event, index) => {
    const key = normalizeText(event.label);
    if (seen.has(key)) duplicates.push({ id: index, other: seen.get(key), label: event.label });
    seen.set(key, index);
    if (!Number.isInteger(event.year) || event.year <= 0) {
      missing.push({ id: index, label: event.label, field: 'year' });
    }
    if (!event.difficulty) missing.push({ id: index, label: event.label, field: 'difficulty' });
    if (!event.source) missing.push({ id: index, label: event.label, field: 'source' });
    if (/circa|secolo|intorno|attorno|xx|xi\b/i.test(String(event.label))) {
      questionable.push({ id: index, label: event.label, year: event.year });
    }
  });

  const sorted = [...events].filter((event) => Number.isInteger(event.year)).sort((a, b) => a.year - b.year);
  const closePairs = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].year - sorted[index - 1].year;
    if (gap < TIMELINE_MIN_YEAR_GAP) {
      closePairs.push({ a: sorted[index - 1].label, b: sorted[index].label, gap });
    }
  }

  const perRoundNeeded = TIMELINE_CARDS_PER_ROUND * TIMELINE_ROUNDS;
  const coverage = sortedEntries(byCategory).map(([category, total]) => ({
    category,
    total,
    rounds: Number((total / TIMELINE_CARDS_PER_ROUND).toFixed(1)),
  }));

  return {
    total: events.length,
    byCategory: Object.fromEntries(sortedEntries(byCategory)),
    byDifficulty: Object.fromEntries(sortedEntries(byDifficulty)),
    duplicates,
    missing,
    questionable,
    closePairs,
    perRoundNeeded,
    meetsPerRound: events.length >= perRoundNeeded,
    coverage,
    rows: events,
  };
}

/** Azzardo: una domanda numerica per categoria e livello. */
function auditAzzardo(bank) {
  const rows = Array.isArray(bank) ? bank : bank.questions;
  const cells = new Map();
  const seen = new Map();
  const duplicates = [];
  const missing = [];
  for (const row of rows) {
    const category = row.category ?? '(assente)';
    const level = Number(row.level) || 0;
    const key = `${category}|${level}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    const textKey = normalizeText(row.question);
    if (seen.has(textKey)) duplicates.push({ question: row.question, other: seen.get(textKey) });
    seen.set(textKey, row.question);
    if (!Number.isFinite(Number(row.value))) missing.push({ question: row.question, field: 'value' });
    if (!Number.isFinite(Number(row.step)) || Number(row.step) <= 0) {
      missing.push({ question: row.question, field: 'step' });
    }
  }
  const categories = [...new Set(rows.map((row) => row.category ?? '(assente)'))].sort();
  const levels = [...new Set(rows.map((row) => Number(row.level) || 0))].sort();
  return {
    total: rows.length,
    cells: Object.fromEntries(sortedEntries(cells)),
    table: { categories, levels, matrix: categories.map((category) => levels.map((level) => cells.get(`${category}|${level}`) ?? 0)) },
    duplicates,
    missing,
    rows,
  };
}

/** Ultima spiaggia: tabella categoria x livello con i buchi. */
function auditUltimaSpiaggia(quiz) {
  const categories = [...new Set(quiz.rows.filter((q) => q.type === 'QUIZ').map((q) => q.category))].sort();
  const pools = new Map();
  for (const q of quiz.rows) {
    if (q.type !== 'QUIZ' || q.options.length !== 4) continue;
    const list = pools.get(q.category) ?? [];
    list.push(q);
    pools.set(q.category, list);
  }
  const levels = [1, 2, 3, 4, 5];
  const holes = [];
  const matrix = categories.map((category) => {
    const pool = pools.get(category) ?? [];
    const counts = levels.map((level) => {
      const band = ULTIMA_SPIAGGIA_BANDS[level - 1];
      // Fascia dichiarata sulla domanda, non la difficoltà generica del Quiz:
      // ogni livello ha la sua domanda e non ci sono fasce condivise.
      const capacity = pool.filter((q) => q.spiaggiaBand === band).length;
      if (capacity < ULTIMA_SPIAGGIA_MIN_PER_LEVEL) {
        holes.push({ category, level, band, capacity, needed: ULTIMA_SPIAGGIA_MIN_PER_LEVEL });
      }
      return capacity;
    });
    return { category, counts };
  });
  return {
    categories,
    levels,
    matrix,
    holes,
    minPerLevel: ULTIMA_SPIAGGIA_MIN_PER_LEVEL,
    total: quiz.rows.filter((q) => q.type === 'QUIZ').length,
  };
}

/** Levenshtein sulle parole: misura quanti dettagli cambiano fra due frasi. */
function wordDistance(a, b) {
  const left = normalizeText(a).split(' ').filter(Boolean);
  const right = normalizeText(b).split(' ').filter(Boolean);
  const dp = Array.from({ length: left.length + 1 }, (_, index) =>
    [index, ...new Array(right.length).fill(0)]);
  for (let column = 0; column <= right.length; column += 1) dp[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      dp[row][column] = Math.min(
        dp[row - 1][column] + 1,
        dp[row][column - 1] + 1,
        dp[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
  }
  return dp[left.length][right.length];
}

/** Indovina chi: foto, indizi e categoria per ogni celebrità. */
function auditCelebrities(media) {
  const people = Array.isArray(media?.people) ? media.people : [];
  const seen = new Map();
  const duplicates = [];
  const missing = [];
  const clues = [];

  for (const person of people) {
    const name = String(person.name ?? '').trim();
    const key = normalizeText(name);
    if (key && seen.has(key)) duplicates.push({ name, other: seen.get(key) });
    if (key) seen.set(key, name);
    if (!key) missing.push({ name: '(assente)', field: 'name' });
    if (!person.category) missing.push({ name, field: 'category' });
    if (!mediaFileExists(person.file)) missing.push({ name, field: 'file', detail: String(person.file ?? '') });
    if (!person.description) missing.push({ name, field: 'description' });
    if (!person.extract) missing.push({ name, field: 'extract' });

    // L'indizio mostrato in TV toglie il nome: qui si controlla solo che la
    // banca non sia già senza indizi. La rimozione del nome è di
    // CelebrityImageService.cluesFromLocal.
    const text = normalizeText(`${person.description ?? ''} ${person.extract ?? ''}`);
    if (key && text.length < 40) clues.push({ name, detail: 'indizio troppo corto' });
  }

  const byCategory = countBy(people, (person) => person.category ?? '(assente)');
  return {
    total: people.length,
    byCategory: Object.fromEntries(sortedEntries(byCategory)),
    duplicates,
    missing,
    clues,
  };
}

/**
 * Celebrità a tre manche: ogni persona deve stare in uno dei tre ambiti e in un
 * sotto-ambito dello stesso ambito. Il file è versionato (media-it.json no),
 * così i conteggi si controllano anche in CI. I minimi della specifica
 * (60 / 50 / 70) sono un avviso, non un blocco: finché la banca è più piccola
 * l'audit lo dice invece di far finta che le persone esistano.
 */
// Requisito della serata con i più piccoli: almeno 120 celebrità del momento
// (Musica più Sport/Cinema/TV/Spettacolo) e almeno 30 fra Storia, Arte,
// Scienza e Letteratura. Le soglie sommano 190 persone.
const CELEBRITA_MINIMI = { 1: 30, 2: 60, 3: 100 };

function auditCelebritaAmbiti(ambitiFile, media) {
  const rows = Array.isArray(ambitiFile?.persone) ? ambitiFile.persone : [];
  const ambiti = ambitiFile?.ambiti ?? {};
  const problems = [];
  const seen = new Map();
  const byAmbito = new Map();
  const bySottoAmbito = new Map();
  const sottoByAmbito = new Map();

  for (const row of rows) {
    const name = String(row?.nome ?? '').trim();
    const key = normalizeText(name);
    if (!key) {
      problems.push({ name: '(assente)', detail: 'nome mancante' });
      continue;
    }
    if (seen.has(key)) problems.push({ name, detail: `nome ripetuto (${seen.get(key)})` });
    seen.set(key, name);

    const ambito = Number(row?.ambito);
    const sotto = String(row?.sottoAmbito ?? '').trim();
    const config = ambiti[String(ambito)];
    if (!config) {
      problems.push({ name, detail: `ambito ${row?.ambito} inesistente` });
      continue;
    }
    if (!Array.isArray(config.sottoAmbiti) || !config.sottoAmbiti.includes(sotto)) {
      problems.push({ name, detail: `sotto-ambito «${sotto}» fuori dall'ambito ${ambito}` });
    }
    byAmbito.set(ambito, (byAmbito.get(ambito) ?? 0) + 1);
    bySottoAmbito.set(sotto, (bySottoAmbito.get(sotto) ?? 0) + 1);
    const perAmbito = sottoByAmbito.get(ambito) ?? {};
    perAmbito[sotto] = (perAmbito[sotto] ?? 0) + 1;
    sottoByAmbito.set(ambito, perAmbito);
  }

  // Confronto con la banca locale, quando c'è: nessuna persona senza ambito e
  // nessuna riga di classificazione senza persona.
  const people = Array.isArray(media?.people) ? media.people : [];
  const inBank = new Set(people.map((person) => normalizeText(person.name)));
  if (people.length) {
    for (const person of people) {
      if (!seen.has(normalizeText(person.name))) {
        problems.push({ name: person.name, detail: 'persona della banca senza ambito' });
      }
    }
    for (const row of rows) {
      if (!inBank.has(normalizeText(row?.nome))) {
        problems.push({ name: String(row?.nome ?? ''), detail: 'ambito senza persona nella banca' });
      }
    }
  }

  const minimi = [1, 2, 3].map((ambito) => ({
    ambito,
    nome: ambiti[String(ambito)]?.nome ?? `ambito ${ambito}`,
    presenti: byAmbito.get(ambito) ?? 0,
    minimo: CELEBRITA_MINIMI[ambito],
  }));

  return {
    total: rows.length,
    byAmbito: Object.fromEntries(sortedEntries(byAmbito)),
    bySottoAmbito: Object.fromEntries(sortedEntries(bySottoAmbito)),
    sottoByAmbito: Object.fromEntries([...sottoByAmbito.entries()].map(([ambito, perAmbito]) => [ambito, perAmbito])),
    minimi,
    mancanti: minimi.filter((row) => row.presenti < row.minimo),
    problems,
  };
}

/**
 * Banca indizi Celebrità: quattro indizi per persona, due ampi e due
 * specifici, ognuno con la fonte, mai con il nome. È il controllo che la
 * specifica chiede bloccante: se manca una fonte, l'ordine è sbagliato o un
 * indizio contiene il nome, l'audit esce in errore.
 */
const CELEBRITA_LIVELLI = ['ampio', 'ampio', 'specifico', 'specifico'];
const CELEBRITA_SOTTO_AMBITI = new Set([
  'storia', 'arte', 'scienza', 'letteratura', 'musica', 'sport', 'cinema', 'tv', 'spettacolo',
]);
const NAME_PARTICLES = new Set([
  'de', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le',
  'van', 'von', 'jr', 'sr', 'ii', 'iii', 'iv',
]);

/** Stesse regole del controllo Java: nome, cognome e nomi corti svelano. */
function mentionsName(text, name) {
  const haystack = normalizeText(text);
  for (const token of normalizeText(name).split(' ').filter(Boolean)) {
    if (token.length < 3 || NAME_PARTICLES.has(token)) continue;
    if (new RegExp(`(^| )${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(haystack)) return true;
  }
  return false;
}

function auditCelebritaIndizi(indizi, ambitiFile) {
  const rows = Array.isArray(indizi?.persone) ? indizi.persone : [];
  const nonRisolte = Array.isArray(indizi?.nonRisolte) ? indizi.nonRisolte : [];
  const problemi = [];
  const perTesto = new Map();
  const solved = new Map();
  const classificate = new Map(
    (ambitiFile?.persone ?? []).map((row) => [normalizeText(row.nome), row]),
  );

  for (const persona of rows) {
    const nome = String(persona?.nome ?? '').trim();
    const key = normalizeText(nome);
    if (!key) {
      problemi.push({ nome: '(assente)', detail: 'nome mancante' });
      continue;
    }
    const classe = classificate.get(key);
    if (!classe) {
      problemi.push({ nome, detail: 'persona non riclassificata nei tre ambiti' });
    } else {
      if (Number(classe.ambito) !== Number(persona.ambito)) {
        problemi.push({ nome, detail: `ambito ${persona.ambito} diverso dalla classificazione (${classe.ambito})` });
      }
      if (String(classe.sottoAmbito) !== String(persona.sottoAmbito)) {
        problemi.push({ nome, detail: `sotto-ambito «${persona.sottoAmbito}» diverso dalla classificazione («${classe.sottoAmbito}»)` });
      }
    }
    if (!CELEBRITA_SOTTO_AMBITI.has(String(persona.sottoAmbito))) {
      problemi.push({ nome, detail: `sotto-ambito inesistente «${persona.sottoAmbito}»` });
    }
    if (!String(persona.pagina ?? '').startsWith('https://it.wikipedia.org/')) {
      problemi.push({ nome, detail: 'pagina Wikipedia assente' });
    }

    const indiziPersona = Array.isArray(persona.indizi) ? persona.indizi : [];
    if (indiziPersona.length !== 4) {
      problemi.push({ nome, detail: `indizi ${indiziPersona.length} invece di 4` });
      continue;
    }
    indiziPersona.forEach((indizio, index) => {
      const testo = String(indizio?.testo ?? '').trim();
      const livello = String(indizio?.livello ?? '').trim();
      const fonte = String(indizio?.fonte ?? '').trim();
      if (livello !== CELEBRITA_LIVELLI[index]) {
        problemi.push({ nome, detail: `indizio ${index + 1} è «${livello}», atteso «${CELEBRITA_LIVELLI[index]}»` });
      }
      if (testo.length < 12 || testo.length > 220) {
        problemi.push({ nome, detail: `indizio ${index + 1} lungo ${testo.length}` });
      }
      if (!fonte.startsWith('https://')) {
        problemi.push({ nome, detail: `indizio ${index + 1} senza fonte` });
      }
      if (mentionsName(testo, nome)) {
        problemi.push({ nome, detail: `indizio ${index + 1} contiene il nome` });
      }
      if (indizio?.verificato !== true) {
        problemi.push({ nome, detail: `indizio ${index + 1} non verificato` });
      }
      const testoKey = normalizeText(testo);
      if (perTesto.has(testoKey)) {
        problemi.push({ nome, detail: `indizio identico a quello di ${perTesto.get(testoKey)}` });
      }
      perTesto.set(testoKey, nome);
    });
    solved.set(normalizeText(persona.ambito), (solved.get(normalizeText(persona.ambito)) ?? 0) + 1);
  }

  for (const persona of nonRisolte) {
    if (!String(persona?.nome ?? '').trim()) problemi.push({ nome: '(assente)', detail: 'non risolta senza nome' });
    if (!String(persona?.motivo ?? '').trim()) {
      problemi.push({ nome: String(persona?.nome ?? ''), detail: 'non risolta senza motivo' });
    }
  }
  if (rows.length + nonRisolte.length !== classificate.size) {
    problemi.push({
      nome: '(totale)',
      detail: `persone con indizi ${rows.length} + non risolte ${nonRisolte.length} diverse dalle classificate ${classificate.size}`,
    });
  }

  return {
    total: rows.length,
    nonRisolte: nonRisolte.length,
    byAmbito: Object.fromEntries(sortedEntries(solved)),
    problemi,
  };
}

/** Musica: brano, artista, anno e file audio/copertina. */
function auditMusic(media) {
  const tracks = Array.isArray(media?.music) ? media.music : [];
  const seen = new Map();
  const duplicates = [];
  const missing = [];

  for (const track of tracks) {
    const title = String(track.title ?? '').trim();
    const artist = String(track.artist ?? '').trim();
    const key = `${normalizeText(title)}|${normalizeText(artist)}`;
    if (seen.has(key)) duplicates.push({ title: `${title} — ${artist}`, other: seen.get(key) });
    seen.set(key, `${title} — ${artist}`);
    if (!title) missing.push({ title: '(assente)', field: 'title' });
    if (!artist) missing.push({ title, field: 'artist' });
    if (!/^\d{4}$/.test(String(track.year ?? ''))) missing.push({ title, field: 'year', detail: String(track.year ?? '') });
    if (!mediaFileExists(track.file)) missing.push({ title, field: 'file', detail: String(track.file ?? '') });
    if (!mediaOrRemoteExists(track.albumCover)) {
      missing.push({ title, field: 'albumCover', detail: String(track.albumCover ?? '') });
    }
  }

  const artists = new Set(tracks.map((track) => normalizeText(track.artist)).filter(Boolean));
  return { total: tracks.length, artists: artists.size, duplicates, missing };
}

/** Ruota: le frasi sono un array nel codice del servizio, non un file JSON. */
function auditWheel() {
  const source = readFileSync(bankServiceFile, 'utf8');
  const block = source.match(/PROVERBS\s*=\s*\{([\s\S]*?)\};/);
  const phrases = block ? [...block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]) : [];
  const seen = new Map();
  const duplicates = [];
  const issues = [];

  for (const phrase of phrases) {
    const key = normalizeText(phrase);
    if (seen.has(key)) duplicates.push({ phrase, other: seen.get(key) });
    seen.set(key, phrase);
    const words = key.split(' ').filter(Boolean);
    if (words.length < 3) issues.push({ phrase, detail: 'meno di tre parole' });
    if (key.length < 12) issues.push({ phrase, detail: 'frase troppo corta' });
    if (/[0-9]/.test(phrase)) issues.push({ phrase, detail: 'contiene numeri' });
  }

  return { total: phrases.length, duplicates, issues, phrases };
}

/** Bomba: coppie vero/falso, fonte e un solo dettaglio cambiato. */
function auditBomba(bank) {
  const statements = (bank.statements ?? []).map((row) => ({ ...row, truth: row.true === true }));
  const trues = statements.filter((row) => row.truth);
  const falses = statements.filter((row) => !row.truth);
  const categories = [...new Set(statements.map((row) => row.category ?? '(assente)'))].sort();
  const table = categories.map((category) => [
    category,
    trues.filter((row) => row.category === category).length,
    falses.filter((row) => row.category === category).length,
  ]);

  const seen = new Map();
  const duplicates = [];
  const missing = [];
  const doubts = [];

  for (const row of statements) {
    const key = normalizeText(row.statement);
    if (seen.has(key)) duplicates.push({ id: row.id, statement: row.statement, other: seen.get(key) });
    seen.set(key, row.id);
    if (!row.id) missing.push({ statement: row.statement, field: 'id' });
    if (!row.category) missing.push({ statement: row.statement, field: 'category' });
    if (!row.source) missing.push({ statement: row.statement, field: 'source' });
    if (typeof row.true !== 'boolean') missing.push({ statement: row.statement, field: 'true' });
  }

  // Per ogni falsa, la vera più vicina della stessa categoria: la differenza
  // deve essere un solo dettaglio (anno, luogo, nome, cifra).
  for (const row of falses) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of trues) {
      if (candidate.category !== row.category) continue;
      const distance = wordDistance(row.statement, candidate.statement);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    if (!best) {
      doubts.push({ id: row.id, kind: 'nessuna vera nella stessa categoria', detail: row.statement });
    } else if (bestDistance > 2) {
      doubts.push({ id: row.id, kind: 'vera più vicina distante: verificare a mano', detail: `${bestDistance} parole: ${row.statement} / ${best.statement}` });
    }
  }

  // F-23: argomenti «quali di questi…?» con 25 salvi e 10 bombe. Bloccano
  // la CI, al contrario delle vecchie affermazioni che restano di ripiego.
  const topics = Array.isArray(bank.topics) ? bank.topics : [];
  const topicIssues = [];
  const topicIds = new Set();
  if (topics.length < 60) {
    topicIssues.push({ id: '-', detail: `argomenti ${topics.length}, minimo 60` });
  }
  for (const topic of topics) {
    const id = String(topic?.id ?? '(senza id)');
    if (topicIds.has(id)) topicIssues.push({ id, detail: 'id ripetuto' });
    topicIds.add(id);
    if (!String(topic?.prompt ?? '').trim().endsWith('?')) {
      topicIssues.push({ id, detail: 'domanda assente o senza punto interrogativo' });
    }
    const safe = Array.isArray(topic?.safe) ? topic.safe : [];
    const intruders = Array.isArray(topic?.intruders) ? topic.intruders : [];
    if (safe.length < 25) topicIssues.push({ id, detail: `salvi ${safe.length}, minimo 25` });
    if (intruders.length < 10) topicIssues.push({ id, detail: `bombe ${intruders.length}, minimo 10` });
    if (new Set(safe).size !== safe.length) topicIssues.push({ id, detail: 'salvi duplicati' });
    if (new Set(intruders).size !== intruders.length) topicIssues.push({ id, detail: 'bombe duplicate' });
    const overlap = safe.filter((value) => intruders.includes(value));
    if (overlap.length) topicIssues.push({ id, detail: `salvo e bomba insieme: ${overlap.join(', ')}` });
    const sources = Array.isArray(topic?.sources) ? topic.sources : [];
    if (!sources.length || sources.some((source) => !String(source).startsWith('https://'))) {
      topicIssues.push({ id, detail: 'fonte https mancante' });
    }
  }

  return {
    total: statements.length, trues: trues.length, falses: falses.length, table,
    duplicates, missing, doubts, topics: topics.length, topicIssues,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Audit delle banche domande');
  lines.push('');
  lines.push('Generato da `node scripts/audit-banche.mjs --write`. Non modifica le banche:');
  lines.push('elenca ciò che va corretto a mano e i buchi di copertura.');
  lines.push('');
  lines.push('## Quiz, Arena, Tennis, Cavallo');
  lines.push('');
  lines.push(table(['Tipo', 'Domande'], Object.entries(report.quiz.byType)));
  lines.push('');
  lines.push(table(['Difficoltà', 'Domande'], Object.entries(report.quiz.byDifficulty)));
  lines.push('');
  lines.push('### Posizione della risposta corretta');
  lines.push('');
  lines.push(table(['Categoria', 'A', 'B', 'C', 'D'], Object.entries(report.quiz.positionByCategory).map(([category, positions]) => [category, ...positions])));
  lines.push('');
  lines.push(`### Doppioni (${report.quiz.duplicates.length})`);
  lines.push('');
  if (report.quiz.duplicates.length === 0) {
    lines.push('Nessuno.');
  } else {
    lines.push(table(['Tipo', 'Domanda', 'Prima occorrenza'], report.quiz.duplicates.map((row) => [row.kind, `\`${row.id}\` ${row.question}`, row.other])));
  }
  lines.push('');
  lines.push(`### Segnalazioni (${report.quiz.issues.length})`);
  lines.push('');
  if (report.quiz.issues.length === 0) {
    lines.push('Nessuna.');
  } else {
    lines.push(table(['Controllo', 'Domanda', 'Dettaglio'], report.quiz.issues.map((row) => [row.type, `\`${row.id}\``, row.detail])));
  }
  lines.push('');
  lines.push('## Timeline');
  lines.push('');
  lines.push(`Eventi: **${report.timeline.total}** (servono almeno ${report.timeline.perRoundNeeded} per tre round da ${TIMELINE_CARDS_PER_ROUND}).`);
  lines.push('');
  lines.push(table(['Categoria', 'Eventi', 'Round coperti'], report.timeline.coverage.map((row) => [row.category, row.total, row.rounds])));
  lines.push('');
  lines.push(table(['Difficoltà', 'Eventi'], Object.entries(report.timeline.byDifficulty)));
  lines.push('');
  lines.push(`### Campi mancanti (${report.timeline.missing.length})`);
  if (report.timeline.missing.length === 0) {
    lines.push('');
    lines.push('Nessuno.');
  } else {
    lines.push('');
    lines.push(table(['Evento', 'Campo'], report.timeline.missing.slice(0, 60).map((row) => [row.label, row.field])));
    if (report.timeline.missing.length > 60) lines.push('', `…e altre ${report.timeline.missing.length - 60} righe.`);
  }
  lines.push('');
  lines.push(`### Anni troppo vicini (< ${TIMELINE_MIN_YEAR_GAP} anni)`);
  if (report.timeline.closePairs.length === 0) {
    lines.push('');
    lines.push('Nessuno.');
  } else {
    lines.push('');
    lines.push(table(['Primo', 'Secondo', 'Distanza'], report.timeline.closePairs.map((row) => [row.a, row.b, row.gap])));
  }
  lines.push('');
  lines.push('## Azzardo');
  lines.push('');
  lines.push(table(['Categoria', ...report.azzardo.table.levels.map((level) => `Livello ${level}`)], report.azzardo.table.categories.map((category, index) => [category, ...report.azzardo.table.matrix[index]])));
  lines.push('');
  lines.push(`## Ultima spiaggia (minimo ${report.ultimaSpiaggia.minPerLevel} domande per categoria e livello)`);
  lines.push('');
  lines.push(table(['Categoria', ...levelsLabel(report.ultimaSpiaggia.levels)], report.ultimaSpiaggia.matrix.map((row) => [row.category, ...row.counts])));
  lines.push('');
  lines.push(`Buchi: **${report.ultimaSpiaggia.holes.length}**.`);
  if (report.ultimaSpiaggia.holes.length > 0) {
    lines.push('');
    lines.push(table(['Categoria', 'Livello', 'Fascia', 'Capienza'], report.ultimaSpiaggia.holes.map((row) => [row.category, row.level, row.band, row.capacity])));
  }
  lines.push('');
  lines.push('## Indovina chi (media: people)');
  lines.push('');
  lines.push(`Celebrità: **${report.celebrities.total}**.`);
  lines.push('');
  lines.push(table(['Categoria', 'Persone'], Object.entries(report.celebrities.byCategory)));
  lines.push('');
  lines.push(`Doppioni: **${report.celebrities.duplicates.length}**. Campi mancanti o file assenti: **${report.celebrities.missing.length}**.`);
  if (report.celebrities.duplicates.length) {
    lines.push('');
    lines.push(table(['Nome', 'Prima occorrenza'], report.celebrities.duplicates.map((row) => [row.name, row.other])));
  }
  if (report.celebrities.missing.length) {
    lines.push('');
    lines.push(table(['Nome', 'Campo', 'Dettaglio'], report.celebrities.missing.slice(0, 40).map((row) => [row.name, row.field, row.detail ?? ''])));
    if (report.celebrities.missing.length > 40) lines.push('', `…e altre ${report.celebrities.missing.length - 40} righe.`);
  }
  lines.push('');
  lines.push('### Celebrità per ambito (tre manche)');
  lines.push('');
  lines.push(`Persone classificate: **${report.celebritaAmbiti.total}**.`);
  lines.push('');
  lines.push(table(
    ['Ambito', 'Sotto-ambiti', 'Persone', 'Minimo specifica', 'Esito'],
    report.celebritaAmbiti.minimi.map((row) => [
      `${row.ambito} — ${row.nome}`,
      Object.entries(report.celebritaAmbiti.sottoByAmbito[row.ambito] ?? {})
        .map(([sotto, total]) => `${sotto} ${total}`)
        .join(', ') || '—',
      row.presenti,
      row.minimo,
      row.presenti >= row.minimo ? 'ok' : `mancano ${row.minimo - row.presenti}`,
    ]),
  ));
  lines.push('');
  if (report.celebritaAmbiti.problems.length === 0) {
    lines.push('Nessuna persona senza ambito e nessun ambito inesistente.');
  } else {
    lines.push(table(['Nome', 'Controllo'], report.celebritaAmbiti.problems.map((row) => [row.name, row.detail])));
  }
  lines.push('');
  lines.push('### Indizi per persona (banca versionata)');
  lines.push('');
  lines.push(`Persone con quattro indizi: **${report.celebritaIndizi.total}**; non risolte: **${report.celebritaIndizi.nonRisolte}**.`);
  lines.push('');
  if (report.celebritaIndizi.problemi.length === 0) {
    lines.push('Quattro indizi per persona, due ampi e due specifici, fonte https su ognuno, nessun nome: **0 problemi**.');
  } else {
    lines.push(table(['Nome', 'Controllo'], report.celebritaIndizi.problemi.map((row) => [row.nome, row.detail])));
  }
  lines.push('');
  lines.push('## Indovina la canzone (media: music)');
  lines.push('');
  lines.push(`Brani: **${report.music.total}**, artisti distinti: **${report.music.artists}**. Doppioni: **${report.music.duplicates.length}**. Campi o file mancanti: **${report.music.missing.length}**.`);
  if (report.music.duplicates.length) {
    lines.push('');
    lines.push(table(['Brano', 'Prima occorrenza'], report.music.duplicates.map((row) => [row.title, row.other])));
  }
  if (report.music.missing.length) {
    lines.push('');
    lines.push(table(['Brano', 'Campo', 'Dettaglio'], report.music.missing.slice(0, 40).map((row) => [row.title, row.field, row.detail ?? ''])));
    if (report.music.missing.length > 40) lines.push('', `…e altre ${report.music.missing.length - 40} righe.`);
  }
  lines.push('');
  lines.push('## Ruota della fortuna (frasi dal servizio)');
  lines.push('');
  lines.push(`Frasi: **${report.wheel.total}**. Doppioni: **${report.wheel.duplicates.length}**. Segnalazioni: **${report.wheel.issues.length}**.`);
  if (report.wheel.issues.length) {
    lines.push('');
    lines.push(table(['Frase', 'Controllo'], report.wheel.issues.map((row) => [row.phrase, row.detail])));
  }
  lines.push('');
  lines.push('## Bomba (affermazioni vere e false)');
  lines.push('');
  lines.push(`Affermazioni: **${report.bomba.total}** (${report.bomba.trues} vere, ${report.bomba.falses} false). Doppioni: **${report.bomba.duplicates.length}**. Campi mancanti: **${report.bomba.missing.length}**.`);
  lines.push('');
  lines.push(table(['Categoria', 'Vere', 'False'], report.bomba.table));
  lines.push('');
  lines.push(`### False senza un solo dettaglio cambiato (${report.bomba.doubts.length})`);
  if (report.bomba.doubts.length === 0) {
    lines.push('');
    lines.push('Nessuna: ogni falsa ha una vera vicina con un solo dettaglio diverso.');
  } else {
    lines.push('');
    lines.push(table(['ID', 'Controllo', 'Dettaglio'], report.bomba.doubts.map((row) => [row.id ?? '', row.kind, row.detail])));
  }
  lines.push('');
  return lines.join('\n');
}

function levelsLabel(levels) {
  return levels.map((level) => `Livello ${level} (${100 * level})`);
}

const quizBank = readJson('questions-it.json');
const timelineBank = readJson('timeline-it.json');
const azzardoBank = readJson('azzardo-it.json');
const mediaBank = readJsonIfPresent('media-it.json');
const celebritaAmbiti = readJson('celebrita-ambiti.json');
const celebritaIndizi = readJsonIfPresent('celebrita-indizi.json');
const mediaPatches = applyMediaPatches(mediaBank);
const bombaBank = readJson('bomba-it.json');

const report = {
  generatedAt: new Date().toISOString(),
  files: {
    quiz: 'apps/backend/src/main/resources/questions/questions-it.json',
    timeline: 'apps/backend/src/main/resources/questions/timeline-it.json',
    azzardo: 'apps/backend/src/main/resources/questions/azzardo-it.json',
  media: 'apps/backend/src/main/resources/questions/media-it.json',
  bomba: 'apps/backend/src/main/resources/questions/bomba-it.json',
  },
  quiz: auditQuestions(quizBank),
  timeline: auditTimeline(timelineBank),
  azzardo: auditAzzardo(azzardoBank),
  ultimaSpiaggia: auditUltimaSpiaggia(auditQuestions(quizBank)),
  celebrities: auditCelebrities(mediaBank),
  celebritaAmbiti: auditCelebritaAmbiti(celebritaAmbiti, mediaBank),
  celebritaIndizi: auditCelebritaIndizi(celebritaIndizi, celebritaAmbiti),
  music: auditMusic(mediaBank),
  mediaPatches,
  wheel: auditWheel(),
  bomba: auditBomba(bombaBank),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('Quiz/Arena/Tennis/Cavallo:', report.quiz.total, 'domande');
  console.log('  per difficoltà:', report.quiz.byDifficulty);
  console.log('  doppioni:', report.quiz.duplicates.length);
  console.log('  segnalazioni:', report.quiz.issues.length);
  console.log('Timeline:', report.timeline.total, 'eventi, anni vicini:', report.timeline.closePairs.length);
  console.log('Azzardo:', report.azzardo.total, 'domande');
  console.log('Ultima spiaggia: buchi categoria x livello:', report.ultimaSpiaggia.holes.length);
  console.log('Indovina chi:', report.celebrities.total, 'persone, doppioni:', report.celebrities.duplicates.length, 'campi/file mancanti:', report.celebrities.missing.length);
  console.log('Celebrità indizi:', report.celebritaIndizi.total, 'persone con 4 indizi,',
    report.celebritaIndizi.nonRisolte, 'non risolte, problemi:', report.celebritaIndizi.problemi.length);
  console.log('Celebrità ambiti:', report.celebritaAmbiti.total, 'persone,',
    'ambiti', JSON.stringify(report.celebritaAmbiti.byAmbito),
    'problemi:', report.celebritaAmbiti.problems.length,
    'minimi mancanti:', report.celebritaAmbiti.mancanti.map((row) => `${row.ambito} ${row.presenti}/${row.minimo}`).join(' '));
  console.log('Musica:', report.music.total, 'brani, doppioni:', report.music.duplicates.length, 'campi/file mancanti:', report.music.missing.length);
  console.log('Ruota:', report.wheel.total, 'frasi, doppioni:', report.wheel.duplicates.length, 'segnalazioni:', report.wheel.issues.length);
  console.log('Bomba:', report.bomba.total, 'affermazioni, doppioni:', report.bomba.duplicates.length, 'campi mancanti:', report.bomba.missing.length, 'dubbi:', report.bomba.doubts.length);
  console.log('Bomba F-23:', report.bomba.topics, 'argomenti, problemi:', report.bomba.topicIssues.length);
  const byIssue = countBy(report.quiz.issues, (row) => row.type);
  for (const [type, total] of sortedEntries(byIssue)) console.log(`  ${type}: ${total}`);
}

if (writeReport) {
  const target = join(rootDir, 'docs', 'BANCHE-AUDIT.md');
  writeFileSync(target, renderMarkdown(report), 'utf8');
  console.log('Report scritto in docs/BANCHE-AUDIT.md');
}

if (args.has('--ci')) {
  const duplicates = report.quiz.duplicates.length
    + report.timeline.duplicates.length
    + report.azzardo.duplicates.length
    + report.celebrities.duplicates.length
    + report.music.duplicates.length
    + report.wheel.duplicates.length
    + report.bomba.duplicates.length;
  const issues = report.quiz.issues.length;
  const missing = report.timeline.missing.length + report.azzardo.missing.length
    + report.celebrities.missing.length + report.music.missing.length + report.bomba.missing.length
    + report.bomba.topicIssues.length + report.celebritaAmbiti.problems.length
    + report.celebritaIndizi.problemi.length;
  const holes = report.ultimaSpiaggia.holes.length;
  const unmatchedPatches = report.mediaPatches.unmatched.length;
  console.log(`CI banche: doppioni ${duplicates}, segnalazioni ${issues}, campi mancanti ${missing}`);
  if (report.mediaPatches.skipped) {
    console.log('Banca media assente (non versionata): controlli media e patch saltati.');
  } else {
    console.log(`Media corrette a mano: ${report.mediaPatches.fields} campi, ${unmatchedPatches} patch senza voce`);
  }
  for (const label of report.mediaPatches.unmatched) console.log(`  patch senza voce: ${label}`);
  console.log(`Ultima spiaggia: ${holes} celle sotto il minimo di ${report.ultimaSpiaggia.minPerLevel}`);
  console.log(`Bomba: ${report.bomba.doubts.length} false da rivedere (non bloccanti)`);
  for (const issue of report.bomba.topicIssues) console.log(`  argomento ${issue.id}: ${issue.detail}`);
  // I buchi di Ultima spiaggia bloccano: la soglia per cella e' il motivo per
  // cui esiste la banca (una domanda sola per livello tornava ogni tre serate).
  if (duplicates + issues + missing + holes + unmatchedPatches > 0) {
    console.error('Audit banche: controllo fallito.');
    process.exitCode = 1;
  } else {
    console.log('Audit banche: OK');
  }
}
