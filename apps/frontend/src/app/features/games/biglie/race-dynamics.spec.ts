import {
  createDrama,
  createLineCharacter,
  dramaFactor,
  fieldProfile,
  hazardPenalty,
  lineOffset,
  resumeAccel,
  rubberBand,
  stepSpeed,
  wallPenalty,
} from './race-dynamics';

describe('Biglie — ripresa, corsia e gruppo', () => {
  const seeded = (seed: number): (() => number) => {
    let state = seed >>> 0 || 1;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };

  it('la velocità torna al bersaglio con inerzia, non in un passo', () => {
    let speed = 0;
    const accel = resumeAccel(6, false);
    const samples: number[] = [];
    for (let index = 0; index < 180; index++) {
      speed = stepSpeed(speed, 3.6, accel, 1 / 60);
      if (index % 30 === 29) samples.push(speed);
    }
    expect(samples[0]).toBeLessThan(3.6 * 0.65);
    expect(samples[2]).toBeGreaterThan(3.6 * 0.8);
    expect(speed).toBe(3.6);
  });

  it('a metà gas la ripresa costa più del doppio del tempo', () => {
    const full = resumeAccel(6, false);
    const half = resumeAccel(6, true);
    expect(half).toBeLessThan(full * 0.5);
    const stepsFor = (accel: number): number => {
      let speed = 0;
      let steps = 0;
      while (speed < 3.6 && steps < 600) {
        speed = stepSpeed(speed, 3.6, accel, 1 / 60);
        steps += 1;
      }
      return steps;
    };
    expect(stepsFor(half)).toBeGreaterThan(stepsFor(full) * 2);
  });

  it('gli ostacoli tolgono velocità e tengono la biglia ferma un attimo', () => {
    const mud = hazardPenalty('fango');
    expect(mud.factor).toBeLessThan(0.3);
    expect(mud.stun).toBeGreaterThan(0.25);
    expect(mud.recover).toBeGreaterThan(0.6);
    expect(hazardPenalty('ghiaccio').factor).toBe(1);
    expect(hazardPenalty('tipo-mai-visto').factor).toBeGreaterThan(0);
  });

  it('anche il muro costa, e l’urto secco costa il doppio', () => {
    const scrape = wallPenalty(false);
    const crash = wallPenalty(true);
    expect(scrape.factor).toBeLessThan(0.9);
    expect(crash.factor).toBeLessThan(scrape.factor);
    expect(crash.stun + crash.recover).toBeGreaterThan(0);
  });

  it('ogni biglia ha la sua corsia, diversa dal vicino e mobile nel tempo', () => {
    const rng = seeded(9);
    const lines = Array.from({ length: 4 }, () => createLineCharacter(rng));
    const offsets = lines.map((line) => lineOffset(line, 4, 80));
    expect(new Set(offsets.map((value) => value.toFixed(1))).size).toBe(4);
    for (const value of offsets) expect(Math.abs(value)).toBeLessThanOrEqual(80);
    expect(lineOffset(lines[0], 4, 80)).not.toBeCloseTo(lineOffset(lines[0], 11, 80), 1);
  });

  it('chi è davanti paga la fuga, chi è dietro tiene qualche punto', () => {
    expect(rubberBand(0.2, 0.5)).toBeGreaterThan(1);
    expect(rubberBand(0.9, 0.5)).toBeLessThan(1);
    expect(rubberBand(0.5, 0.5)).toBe(1);
    // La rincorsa è forte ma ha un tetto: non regala il pareggio istantaneo.
    expect(rubberBand(0, 1)).toBe(1.32);
    expect(rubberBand(0.1, 0.9)).toBeLessThanOrEqual(1.32);
    // Sull'ultimo tratto la rimonta pesa di più: è lì che si ribalta la gara.
    expect(rubberBand(0.5, 0.56, 1.7)).toBeGreaterThan(rubberBand(0.5, 0.56));
  });

  it('ogni biglia ha spinte e crisi, e la media della gara resta quella', () => {
    const drama = createDrama(seeded(21));
    const samples: number[] = [];
    for (let step = 0; step < 600; step++) samples.push(dramaFactor(drama, step / 10));
    expect(Math.max(...samples)).toBeGreaterThan(1.15);
    expect(Math.min(...samples)).toBeLessThan(0.9);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    // Spinte e crisi si compensano: la biglia non corre più veloce di prima.
    expect(mean).toBeGreaterThan(0.94);
    expect(mean).toBeLessThan(1.04);
  });

  it('sulla pista gli scarti delle schede si assottigliano', () => {
    const mean = 7;
    const best = fieldProfile(9.5, mean);
    const worst = fieldProfile(4.5, mean);
    expect(best - mean).toBeLessThan(9.5 - mean);
    expect(mean - worst).toBeLessThan(mean - 4.5);
    expect(fieldProfile(mean, mean)).toBe(mean);
  });
});
