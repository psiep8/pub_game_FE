import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * N-10 — il movimento della scena TV.
 *
 * Due difetti non si vedono nei test di comportamento ma a schermo, e sono
 * quelli che fanno «saltare» la domanda:
 *
 * 1. `question-area` è centrata con `transform: translateY(-50%)`. Un'animazione
 *    di ingresso che scrive `transform` cancella quel centraggio: la scena nasce
 *    più in basso e al cambio di fase torna al suo posto con uno scatto. Per
 *    questo l'entrata ora è solo opacità: niente translate, scale o pop.
 * 2. La fase `options` animava `question-area > *`, cioè la categoria, la barra
 *    del tempo e l'intero gioco: a ogni passaggio il timer spariva 300 ms e la
 *    domanda 600 ms, poi rientravano sfalsate.
 */
const CSS = readFileSync('src/app/features/tv/restyle.css', 'utf8');

function keyframes(name: string): string {
  const start = CSS.indexOf(`@keyframes ${name}`);
  expect(start, `keyframes ${name} assenti`).toBeGreaterThanOrEqual(0);
  const end = CSS.indexOf('}', CSS.indexOf('to {', start));
  return CSS.slice(start, end + 1);
}

describe('TV — ingresso della scena', () => {
  it('l’entrata è solo dissolvenza, senza movimenti', () => {
    for (const name of ['stageIn', 'stageOut']) {
      const block = keyframes(name);
      expect(block, `${name} muove la scena`).not.toMatch(/transform|translate|scale/);
      expect(block, `${name} non è una dissolvenza`).toContain('opacity');
    }
  });

  it('la fase delle opzioni non rientra timer e gioco intero', () => {
    expect(CSS).not.toMatch(/stage-options-on[^{]*question-area\s*>\s*\*/);
  });

  it('la riga del tempo resta nel layout quando il timer è spento', () => {
    expect(CSS).toMatch(/\.timer-wrapper\.is-idle\s*\{[^}]*visibility:\s*hidden/);
  });
});