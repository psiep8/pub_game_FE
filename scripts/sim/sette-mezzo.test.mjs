import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeck,
  chooseThreshold,
  handTotal,
  isNatural,
  playHand,
  seededRandom,
  simulate,
} from './sette-mezzo.mjs';

test('il mazzo della simulazione ha 40 carte tutte diverse', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck).size, 40);
});

test('le regole della simulazione sono quelle del gioco', () => {
  assert.equal(handTotal(['6-COPPE', 'RE-DENARI']), 7);
  assert.equal(handTotal(['7-COPPE', 'RE-DENARI']), 7.5);
  assert.equal(isNatural(['7-COPPE', 'FANTE-SPADE']), true);
  assert.equal(handTotal(['7-COPPE', 'ASSO-SPADE', '2-DENARI']), 10);
});

test('una mano produce sempre un esito noto', () => {
  const random = seededRandom(7);
  for (let index = 0; index < 500; index += 1) {
    assert.match(playHand(random, 5.5), /^(WIN|NATURAL|LOSE|BUST)$/);
  }
});

test('la soglia scelta fa vincere le squadre fra il 42% e il 45%', () => {
  const { best } = chooseThreshold(50_000);
  assert.ok(best.winRate >= 0.42 && best.winRate <= 0.45, `vittorie ${best.winRate}`);
});

test('la misura è ripetibile con lo stesso seme', () => {
  const first = simulate(5.5, 5_000, 42);
  const second = simulate(5.5, 5_000, 42);
  assert.equal(first.wins, second.wins);
});
