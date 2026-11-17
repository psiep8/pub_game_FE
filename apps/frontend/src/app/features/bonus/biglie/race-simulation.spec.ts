import { simulateRace, type SimResult } from './race-simulation';
import { TRACK_IDS } from './track-plan';

/**
 * Taratura della corsa, con i numeri invece che a occhio.
 *
 * Le piste sono le otto del catalogo, i semi due fissi, le biglie otto: la
 * simulazione usa lo stesso passo, le stesse penalità e la stessa rimonta
 * della TV. Se una costante cambia, questo test dice subito quale gara sfora.
 */
const SEEDS = [424242, 20261117, 777001];

const report = (results: SimResult[]): string =>
  results
    .map(
      (row) =>
        `${row.trackId.padEnd(7)} ${row.surface.padEnd(8)} `
        + `prima ${row.leaderTime.toFixed(1).padStart(5)}s `
        + `ultima ${row.lastTime.toFixed(1).padStart(5)}s `
        + `contatti ${row.contactsPerSecond.toFixed(2).padStart(4)}/s `
        + `in contatto ${(row.contactShare * 100).toFixed(0).padStart(3)}% `
        + `ostacoli ${String(row.hazardHits).padStart(3)} muri ${String(row.wallHits).padStart(3)} `
        + `cambi ${String(row.leadChanges).padStart(2)} sorpassi ${String(row.overtakes).padStart(3)} `
        + `rimonta ${row.comeback ? 'sì' : 'no'}`,
    )
    .join('\n');

describe('Biglie — corsa simulata su tutte le piste', () => {
  const runs: SimResult[] = [];
  for (const seed of SEEDS) {
    for (const trackId of TRACK_IDS) {
      runs.push(simulateRace({ trackId, seed }));
    }
  }

  it('ogni gara finisce sotto i 70 secondi, su tutte e otto le piste', () => {
    for (let index = 0; index < runs.length; index += 4) {
      console.log(report(runs.slice(index, index + 4)));
    }
    console.log('ultima biglia: ' + runs.map((run) => run.trackId + ' ' + run.lastTime.toFixed(1) + 's').join(' · '));
    console.log('contatti: ' + runs.map((run) => run.trackId + ' ' + run.contactsPerSecond.toFixed(1) + '/s ' + (run.contactShare * 100).toFixed(0) + '%').join(' · '));
    console.log('drama: ' + runs.map((run) => run.trackId + ' ' + run.leadChanges + ' cambi/' + run.overtakes + ' sorpassi/' + (run.comeback ? 'rimonta' : '—')).join(' · '));
    for (const run of runs) {
      expect(run.lastTime, `${run.trackId} (seme ${run.leaderTime.toFixed(1)}s)`).toBeLessThan(70);
    }
  });

  it('la gara chiude quando l ultima biglia taglia il traguardo', () => {
    for (const run of runs) {
      // Nessuno resta per strada: i rallentamenti non devono lasciare biglie
      // fuori dal traguardo quando scade il tempo.
      const arrivate = run.marbles.filter((marble) => marble.finish !== null).length;
      expect(arrivate, run.trackId).toBe(run.marbles.length);
    }
  });

  it('nessuna gara si chiude troppo presto: la volata dura', () => {
    for (const run of runs) {
      expect(run.leaderTime, run.trackId).toBeGreaterThan(40);
    }
  });

  it('la testa della gara cambia padrone e chi è dietro può rimontare', () => {
    for (const run of runs) {
      // Il primo non scappa: almeno tre cambi di prima posizione a gara.
      expect(run.leadChanges, `${run.trackId} (seme ${run.leaderTime.toFixed(1)}s)`).toBeGreaterThanOrEqual(3);
      // Il gruppo si scambia posizioni davvero, non solo ai bordi.
      expect(run.overtakes, run.trackId).toBeGreaterThanOrEqual(12);
    }

    // Penultimo, terzultimo o quartultimo a un terzo di gara che finisce sul
    // podio: non deve succedere sempre (altrimenti è sceneggiato), ma quasi.
    const rimonte = runs.filter((run) => run.comeback).length;
    expect(rimonte, `rimonte ${rimonte}/${runs.length}`).toBeGreaterThanOrEqual(Math.ceil(runs.length * 0.8));
    for (const trackId of TRACK_IDS) {
      expect(
        runs.some((run) => run.trackId === trackId && run.comeback),
        `${trackId} senza rimonte su ${SEEDS.length} semi`,
      ).toBe(true);
    }
  });

  it('il gruppo resta compatto senza diventare uno scontro continuo', () => {
    for (const run of runs) {
      // Il distacco fra prima e ultima resta sotto i 25 secondi di gara.
      expect(run.lastTime - run.leaderTime, run.trackId).toBeLessThan(25);
      // Contatti radi: si sentono, non sono la corsa.
      expect(run.contactsPerSecond, run.trackId).toBeLessThan(5);
      expect(run.contactShare, run.trackId).toBeLessThan(0.3);
    }
  });
});
