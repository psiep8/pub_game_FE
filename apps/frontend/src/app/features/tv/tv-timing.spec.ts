import { describe, expect, it } from 'vitest';

import { StageRunner } from './stage-runner';
import {
  TV_TIMING,
  actionStage,
  countdownNumbers,
  optionDelays,
  optionsRevealMs,
  questionStage,
  readingPauseMs,
  stageFor,
  type StagePhase,
} from './tv-timing';

/**
 * Il ritmo della domanda: la lettura viene prima delle opzioni, il respiro e il
 * 3-2-1 vengono prima del via, e il timer non è mai parte della lettura.
 */
describe('TV — regia scenica', () => {
  it('la pausa di lettura parte da tre secondi e cresce ogni otto parole', () => {
    expect(readingPauseMs('Uno due tre')).toBe(3000);
    expect(readingPauseMs('parola '.repeat(8))).toBe(4000);
    expect(readingPauseMs('parola '.repeat(9))).toBe(4000);
    expect(readingPauseMs('parola '.repeat(16))).toBe(5000);
  });

  it('le opzioni compaiono una alla volta, sfalsate di 250–350 ms', () => {
    expect(optionDelays(4)).toEqual([0, 300, 600, 900]);
    expect(optionsRevealMs(4)).toBe(1220);
    expect(TV_TIMING.optionStaggerMs).toBeGreaterThanOrEqual(250);
    expect(TV_TIMING.optionStaggerMs).toBeLessThanOrEqual(350);
  });

  it('la domanda ha lettura, opzioni, respiro e 3-2-1 prima del via', () => {
    const steps = questionStage('Qual è la capitale d’Italia?', 4);
    expect(steps.map((step) => step.phase)).toEqual([
      'entrance',
      'title',
      'reading',
      'options',
      'breath',
      'countdown',
      'live',
    ]);
    // Il via arriva solo dopo la lettura, le opzioni e il respiro.
    const liveAt = steps.findIndex((step) => step.phase === 'live');
    expect(steps.findIndex((step) => step.phase === 'reading')).toBeLessThan(liveAt);
    expect(steps.findIndex((step) => step.phase === 'options')).toBeLessThan(liveAt);
    expect(steps.findIndex((step) => step.phase === 'countdown')).toBeLessThan(liveAt);

    const breath = steps.find((step) => step.phase === 'breath');
    expect(breath?.ms).toBeGreaterThanOrEqual(1000);
    expect(breath?.ms).toBeLessThanOrEqual(2000);
    expect(countdownNumbers()).toEqual([3, 2, 1]);
  });

  it('i giochi senza domanda hanno entrata, respiro e 3-2-1', () => {
    expect(actionStage().map((step) => step.phase)).toEqual([
      'entrance',
      'title',
      'breath',
      'countdown',
      'live',
    ]);
    expect(stageFor('BOMBA', '', 0).some((step) => step.phase === 'reading')).toBe(false);
    expect(stageFor('QUIZ', 'Domanda?', 4).some((step) => step.phase === 'reading')).toBe(true);
  });
});

describe('StageRunner — ordine delle fasi, pausa, cancellazione', () => {
  function runner(sleep?: (ms: number) => Promise<void>) {
    const phases: StagePhase[] = [];
    const stage = new StageRunner({
      onPhase: (phase) => phases.push(phase),
      sleep,
    });
    return { stage, phases };
  }

  it('percorre le fasi nell’ordine dichiarato', async () => {
    // Un orologio che risponde subito: qui conta l'ordine, non l'attesa vera.
    const planned: number[] = [];
    const { stage, phases } = runner(async (ms) => {
      planned.push(ms);
    });

    const steps = questionStage('parola '.repeat(16), 4);
    const arrived = await stage.play(steps);

    expect(arrived).toBe(true);
    expect(phases).toEqual(steps.map((step) => step.phase));
    // Le attese sono quelle della tabella, spezzate a piccoli passi.
    expect(planned.reduce((sum, ms) => sum + ms, 0))
      .toBe(steps.reduce((sum, step) => sum + step.ms, 0));
  });

  it('la pausa ferma il nastro e non perde la fase', async () => {
    const { stage, phases } = runner();
    const steps = [
      { phase: 'entrance' as const, ms: 100 },
      { phase: 'reading' as const, ms: 300 },
      { phase: 'live' as const, ms: 0 },
    ];

    const playing = stage.play(steps);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(phases.at(-1)).toBe('reading');

    stage.setPaused(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    // In pausa la fase resta raggiunta: non salta al via.
    expect(phases.at(-1)).toBe('reading');

    stage.setPaused(false);
    expect(await playing).toBe(true);
    expect(phases.at(-1)).toBe('live');
  }, 10_000);

  it('una scena nuova cancella la sequenza vecchia', async () => {
    const { stage, phases } = runner();
    const old = stage.play([
      { phase: 'entrance', ms: 100 },
      { phase: 'reading', ms: 300 },
      { phase: 'live', ms: 0 },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 150));

    stage.cancel();

    expect(await old).toBe(false);
    expect(phases).not.toContain('live');
  }, 10_000);
});
