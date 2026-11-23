import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BONUSES_SERATA,
  EXPECTED_SERATA_ROUNDS,
  ROUNDS_SERATA,
  assertSerataContract,
} from './schedule.mjs';

const FIVE_BONUSES = [
  'CASINO_COLOR',
  'BLACKJACK',
  'CASINO_DOZEN',
  'CAVALLO',
  'CASINO_NUMBER',
];

test('la serata contiene esattamente 40 round', () => {
  assert.equal(ROUNDS_SERATA.length, EXPECTED_SERATA_ROUNDS);
});

test('la serata contiene tutti e cinque i bonus, senza duplicati', () => {
  assert.deepEqual(new Set(BONUSES_SERATA), new Set(FIVE_BONUSES));
  assert.equal(BONUSES_SERATA.length, FIVE_BONUSES.length);
});

test('il contratto rifiuta una scaletta corta', () => {
  assert.throws(
    () => assertSerataContract({ rounds: ROUNDS_SERATA.slice(0, -1) }),
    /40 round/,
  );
});

test('il contratto rifiuta un bonus mancante', () => {
  assert.throws(
    () => assertSerataContract({ bonuses: BONUSES_SERATA.slice(0, -1) }),
    /cinque bonus/,
  );
});
