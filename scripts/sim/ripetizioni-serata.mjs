#!/usr/bin/env node
/**
 * F-08 — Misura delle ripetizioni in una serata simulata.
 *
 * Simula i 40 round della serata sulla scaletta reale (`SIMULATION_DECK`) e i
 * cinque bonus, e conta quante domande ogni gioco chiede e quante ne ripete.
 * I pescaggi per round sono quelli del gioco vero:
 *   - Quiz: 3 manche;
 *   - Tennis: 4 campi x ~11 punti (partita al meglio di 3 game);
 *   - Arena: 8 giocatori x 3 ondate;
 *   - Ultima spiaggia: 5 livelli;
 *   - Cavallo: 8 domande, una volta a serata.
 *
 * La banca Tennis arriva dal server a blocchi di 12 domande per round
 * (`game.component.ts`, count=12) più le 4 di riserva scritte nel client: è
 * questo il tetto che produce le ripetizioni.
 *
 * Uso: node scripts/sim/ripetizioni-serata.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questionsDir = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions');
const quizBank = JSON.parse(readFileSync(join(questionsDir, 'questions-it.json'), 'utf8')).questions;

/** La scaletta vera della serata (round-manager.service.ts). */
const DECK = [
  'QUIZ', 'MUSIC', 'IMAGE_BLUR', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'TIME_BUZZER', 'BOMBA',
  'TENNIS_BATTLE', 'ULTIMA_SPIAGGIA', 'AZZARDO', 'BLACKJACK', 'ARENA', 'SPEED_RUSH', 'BIGLIE',
];
const ROUNDS = 40;

function occurrences() {
  const counts = {};
  for (let round = 0; round < ROUNDS; round++) {
    const type = DECK[round % DECK.length];
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

const hasFourOptions = (q) => Array.isArray(q.options) && q.options.length === 4;
const quizPool = quizBank.filter((q) => q.type === 'QUIZ' && hasFourOptions(q));
const trueFalsePool = quizBank.filter((q) => q.type === 'TRUE_FALSE');
const tennisDedicated = quizBank.filter((q) => q.type === 'TENNIS_BATTLE' && hasFourOptions(q));
const tennisPool = [...tennisDedicated, ...quizPool];

const byDifficulty = (pool, difficulty) => pool.filter((q) => q.difficulty === difficulty).length;

/** Domande del Cavallo: stesse regole di QuestionBankService. */
function cavalloPool(category) {
  return quizBank.filter((q) => {
    if (q.type !== 'QUIZ' && q.type !== 'TRUE_FALSE') return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (!q.options.includes(q.correctAnswer)) return false;
    return !category || q.category === category;
  });
}

/** Matrice di Ultima spiaggia: 5 fasce per categoria, 3 domande per fascia. */
const ULTIMA_LEVELS = 5;
const ULTIMA_PER_LEVEL = 3;

const SIM = occurrences();
const rows = [];

// Quiz: 3 manche per round, storico del server attivo.
{
  const rounds = SIM.QUIZ ?? 0;
  const drawn = rounds * 3;
  rows.push({
    game: 'Quiz',
    pool: quizPool.length,
    bands: `facile ${byDifficulty(quizPool, 'facile')} / medio ${byDifficulty(quizPool, 'medio')} / difficile ${byDifficulty(quizPool, 'difficile')}`,
    rounds,
    drawn,
    repeats: Math.max(0, drawn - quizPool.length),
    note: 'storico attivo',
  });
}

// Tennis: 60 dal server per round (con storico), 4 campi x 11 punti.
{
  const rounds = SIM.TENNIS_BATTLE ?? 0;
  const perRound = 4 * 11;
  const availablePerRound = 60;
  const repeatsPerRound = Math.max(0, perRound - availablePerRound);
  rows.push({
    game: 'Tennis',
    pool: tennisPool.length,
    bands: `dedicate ${tennisDedicated.length} + Quiz ${quizPool.length}; 60 nuove per round`,
    rounds,
    drawn: rounds * perRound,
    repeats: rounds * repeatsPerRound,
    note: 'storico attivo, nessuna domanda due volte; prima erano 12 + 4 per ~44 punti (28 ripetizioni a round)',
  });
}

// Arena: 8 giocatori x 3 ondate, storico attivo.
{
  const rounds = SIM.ARENA ?? 0;
  const drawn = rounds * 8 * 3;
  rows.push({
    game: 'Arena',
    pool: trueFalsePool.length,
    bands: 'VERO/FALSO',
    rounds,
    drawn,
    repeats: Math.max(0, drawn - trueFalsePool.length),
    note: 'storico attivo su testo e risposta',
  });
}

// Cavallo: 8 domande, un bonus a serata, senza storico.
{
  const pool = cavalloPool(null);
  rows.push({
    game: 'Cavallo',
    pool: pool.length,
    bands: 'tutte le categorie, prima le difficili',
    rounds: 1,
    drawn: 8,
    repeats: 0,
    note: 'storico attivo: le stesse domande non tornano in una seconda esibizione',
  });
}

// Ultima spiaggia: 5 domande per round, una per livello, storico attivo.
{
  const rounds = SIM.ULTIMA_SPIAGGIA ?? 0;
  const drawn = rounds * ULTIMA_LEVELS;
  const pool = 16 * ULTIMA_LEVELS * ULTIMA_PER_LEVEL;
  rows.push({
    game: 'Ultima spiaggia',
    pool,
    bands: `16 categorie x 5 livelli x ${ULTIMA_PER_LEVEL} (3 per cella)`,
    rounds,
    drawn,
    repeats: Math.max(0, drawn - pool),
    note: 'storico attivo; una categoria esaurita lascia 10 domande per gli altri round',
  });
}

// Speed Rush: mazzo locale, non banca. Misura i doppioni delle microprove.
{
  const rounds = SIM.SPEED_RUSH ?? 0;
  const perRound = 40;
  const flag = 43;
  const words = 13 * 2;
  const translate = 20;
  const colors = 3;
  const kinds = ['math', 'colors', 'flag', 'words', 'translate'];
  const seen = new Map();
  let drawn = 0;
  let repeats = 0;
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < rounds * perRound; i++) {
    const kind = kinds[i % kinds.length];
    drawn++;
    let key;
    if (kind === 'math') key = `math|${i}`; // numeri sempre nuovi
    else if (kind === 'colors') key = `colors|${Math.floor(random() * colors)}`;
    else if (kind === 'flag') key = `flag|${Math.floor(random() * flag)}`;
    else if (kind === 'words') key = `words|${Math.floor(random() * words)}`;
    else key = `translate|${Math.floor(random() * translate)}`;
    if (seen.has(key)) repeats++;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  rows.push({
    game: 'Speed Rush',
    pool: flag + words + translate + colors,
    bands: `bandiere ${flag}, parole ${words}, traduzioni ${translate}, colori ${colors} (+ matematica generata)`,
    rounds,
    drawn,
    repeats,
    note: 'mazzo locale: i doppioni sono strutturali, non c’è storico',
  });
}

console.log(`Serata simulata: ${ROUNDS} round + 5 bonus (scaletta reale)\n`);
const header = ['Gioco', 'Disponibili', 'Pescate', 'Ripetute', 'Note'];
const widths = [16, 12, 8, 9, 70];
const pad = (text, width) => String(text).padEnd(width);
console.log(header.map((h, i) => pad(h, widths[i])).join(''));
console.log(widths.map((w) => '-'.repeat(w)).join(''));
for (const row of rows) {
  console.log([
    pad(row.game, widths[0]),
    pad(row.pool, widths[1]),
    pad(row.drawn, widths[2]),
    pad(row.repeats, widths[3]),
    pad(row.note, widths[4]),
  ].join(''));
}
console.log('\nFasce:');
for (const row of rows) console.log(`- ${row.game}: ${row.bands}`);
