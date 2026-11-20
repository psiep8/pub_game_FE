#!/usr/bin/env node
/**
 * Normalizzazione delle banche domande (sezioni 4.0 e 4.1 della specifica).
 *
 * Tre correzioni, tutte senza toccare i fatti:
 *   1. difficoltà scritte in inglese (EASY/MEDIUM/HARD) riportate a
 *      facile/medio/difficile, perché Quiz e Ultima spiaggia leggono solo le
 *      parole italiane;
 *   2. doppioni tolti: stessa domanda dello stesso tipo, e domande del Tennis
 *      già presenti nel Quiz;
 *   3. posizione della risposta corretta distribuita A/B/C/D dentro ogni
 *      categoria e difficoltà, senza cambiare testo né risposta.
 *
 * Uso: node scripts/normalizza-banche.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(rootDir, 'apps', 'backend', 'src', 'main', 'resources', 'questions', 'questions-it.json');
const write = process.argv.includes('--write');

const bank = JSON.parse(readFileSync(file, 'utf8'));

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeDifficulty(value) {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'easy':
    case 'facile':
      return 'facile';
    case 'hard':
    case 'difficile':
      return 'difficile';
    default:
      return 'medio';
  }
}

const removed = [];
for (const question of bank.questions) {
  const normalized = normalizeDifficulty(question.difficulty);
  if (question.difficulty !== normalized) question.difficulty = normalized;
}

const kept = [];
const byTypeText = new Map();
for (const question of bank.questions) {
  // Le domande "Chi è questa persona?" dell'Indovina chi condividono il testo
  // ma hanno personaggio e media diversi: non sono doppioni.
  if (question.type === 'IMAGE_BLUR') {
    kept.push(question);
    continue;
  }
  const key = `${question.type}|${normalizeText(question.question)}`;
  const other = byTypeText.get(key);
  if (other) {
    removed.push({ id: question.id, keeps: other.id, question: question.question, reason: 'stessa domanda e stesso tipo' });
    continue;
  }
  byTypeText.set(key, question);
  kept.push(question);
}

// Il Tennis pesca dal Quiz quando la sua banca è corta: una domanda già usata
// nel Quiz non deve ricomparire due volte nella stessa serata.
const quizTexts = new Set(
  kept.filter((question) => question.type === 'QUIZ').map((question) => normalizeText(question.question)),
);
const withoutTennisDuplicates = kept.filter((question) => {
  if (question.type !== 'TENNIS_BATTLE') return true;
  if (!quizTexts.has(normalizeText(question.question))) return true;
  removed.push({ id: question.id, keeps: 'banca Quiz', question: question.question, reason: 'doppione del Quiz' });
  return false;
});

// Distribuzione della risposta corretta: per ogni gruppo (categoria e
// difficoltà) si parte da una posizione diversa e si ruota, così ogni lettera
// riceve lo stesso numero di risposte senza sorteggi che possano sbilanciare.
const groups = new Map();
for (const question of withoutTennisDuplicates) {
  if (question.type !== 'QUIZ' && question.type !== 'TENNIS_BATTLE') continue;
  if (!Array.isArray(question.options) || question.options.length !== 4) continue;
  const key = `${question.category}|${question.difficulty}`;
  const list = groups.get(key) ?? [];
  list.push(question);
  groups.set(key, list);
}

let globalIndex = 0;
for (const [, questions] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const question of questions) {
    const current = question.options.indexOf(question.correctAnswer);
    if (current < 0) continue;
    const target = globalIndex % 4;
    globalIndex += 1;
    if (target === current) continue;
    const options = [...question.options];
    options[current] = options[target];
    options[target] = question.correctAnswer;
    question.options = options;
  }
}

bank.questions = withoutTennisDuplicates;
bank.version = Math.max(3, Number(bank.version) || 0);
bank.normalizedAt = new Date().toISOString();

console.log('Domande:', bank.questions.length);
console.log('Rimosse:', removed.length);
for (const row of removed) console.log(`  - ${row.id} (${row.reason}; resta ${row.keeps}): ${row.question}`);

const distribution = [0, 0, 0, 0];
for (const question of bank.questions) {
  if (question.type !== 'QUIZ') continue;
  const index = question.options?.indexOf(question.correctAnswer) ?? -1;
  if (index >= 0 && index < 4) distribution[index] += 1;
}
console.log('Posizione risposta nei Quiz:', distribution.join(' / '));

if (write) {
  writeFileSync(file, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  console.log('Scritto', file);
} else {
  console.log('Anteprima: rilancia con --write per salvare.');
}
