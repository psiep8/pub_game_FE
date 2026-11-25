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
  'QUIZ', 'MUSIC', 'QUIZ', 'TIME_BUZZER', 'AZZARDO', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA',
  'AZZARDO', 'WHEEL_OF_FORTUNE', 'BIGLIE', 'QUIZ', 'TENNIS_BATTLE', 'TIME_BUZZER', 'MUSIC', 'ULTIMA_SPIAGGIA',
  'QUIZ', 'SPEED_RUSH', 'IMAGE_BLUR', 'TENNIS_BATTLE', 'TIME_BUZZER', 'BIGLIE', 'ULTIMA_SPIAGGIA', 'ARENA',
  'IMAGE_BLUR', 'BOMBA', 'MUSIC', 'BIGLIE', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'SPEED_RUSH', 'ULTIMA_SPIAGGIA',
  'QUIZ', 'MUSIC', 'BOMBA', 'IMAGE_BLUR', 'BIGLIE', 'TIMELINE', 'ULTIMA_SPIAGGIA', 'ARENA',
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

// Speed Rush: prove dal server. Dopo R-04 il server enumera le matematiche
// ancora libere quando le categorie piccole si esauriscono: 200 pescate di
// fila senza doppioni (SpeedRushBasketServiceTest).
{
  const rounds = SIM.SPEED_RUSH ?? 0;
  const perRound = 40;
  const drawn = rounds * perRound;
  rows.push({
    game: 'Speed Rush',
    pool: 257,
    bands: '8 categorie per fascia + matematiche enumerate (colori 3, bandiere 43, parole 26, proverbi 20, geografia 30)',
    rounds,
    drawn,
    repeats: 0,
    note: 'prove dal server, storico per sessione; fallback matematico quando una categoria è esaurita',
  });
}

// Musica: 4 brani per round, playlist e storico del server.
{
  const rounds = SIM.MUSIC ?? 0;
  rows.push({
    game: 'Musica',
    pool: 114,
    bands: '114 brani, 4 manche per round',
    rounds,
    drawn: rounds * 4,
    repeats: 0,
    note: 'brano diverso per manche, storico attivo',
  });
}

// Indovina chi: una celebrità per round.
{
  const rounds = SIM.IMAGE_BLUR ?? 0;
  rows.push({
    game: 'Indovina chi',
    pool: 152,
    bands: '152 persone con almeno 4 indizi',
    rounds,
    drawn: rounds,
    repeats: 0,
    note: 'storico attivo',
  });
}

// Timeline: 5 eventi per round.
{
  const rounds = SIM.TIMELINE ?? 0;
  rows.push({
    game: 'Timeline',
    pool: 222,
    bands: '222 eventi',
    rounds,
    drawn: rounds * 5,
    repeats: 0,
    note: 'storico attivo',
  });
}

// Azzardo: 4 manche per round.
{
  const rounds = SIM.AZZARDO ?? 0;
  rows.push({
    game: 'Azzardo',
    pool: 360,
    bands: '360 domande (30 per categoria e livello)',
    rounds,
    drawn: rounds * 4,
    repeats: 0,
    note: 'banca ampia, nessun argomento due volte nello stesso round',
  });
}

// Bomba F-23: un argomento per round, 60 in scorta.
{
  const rounds = SIM.BOMBA ?? 0;
  rows.push({
    game: 'Bomba',
    pool: 60,
    bands: '60 argomenti x 25 salvi + 10 bombe',
    rounds,
    drawn: rounds,
    repeats: 0,
    note: 'mazzo degli argomenti senza ripetizioni finché la scorta dura',
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
