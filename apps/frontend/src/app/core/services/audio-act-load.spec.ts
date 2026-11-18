import { describe, expect, it } from 'vitest';

import { ACT_DECKS } from '../../shared/schedule';
import { ACT_BEDS, GAME_BEDS } from './bed-map';
import { AudioService } from './audio.service';

/**
 * All'apertura di un atto la TV mette in memoria la base e i loop dei giochi
 * che la scaletta prevede in quell'atto: il primo round non deve aspettare la
 * fetch. Qui il player è un finto e dice soltanto quali file gli sono stati
 * chiesti; l'audio vero è coperto da `audio-question-bed.spec.ts`.
 */
describe('AudioService — caricamento dei sottofondi per atto', () => {
  /** Servizio con il player finto: `warm` sono i file chiesti, nell'ordine. */
  function service() {
    const audio = new AudioService();
    const warm: string[] = [];
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['warmBed'] = (file: string) => warm.push(file);
    player['startBed'] = () => undefined;
    player['stopBed'] = () => undefined;
    player['setBedLevel'] = () => undefined;
    return { audio, warm };
  }

  /** I loop dei giochi della scaletta dell'atto, senza la base e senza doppioni. */
  function gameBedsOf(act: number): string[] {
    const files = ACT_DECKS[act - 1]
      .map((type) => GAME_BEDS[type])
      .filter((bed) => !!bed && bed !== 'ACT_BASE')
      .map((bed) => (bed as { file: string }).file);
    return [...new Set(files)];
  }

  it('un atto caricato porta la sua base e i giochi dell’atto', () => {
    const { audio, warm } = service();

    // Atto 3: Quiz e Indovina chi suonano la base, gli altri hanno il loro loop.
    audio.setActBed(3);

    expect(warm).toEqual([
      'loop/atto-3.m4a',
      'loop/gioco-bomba.m4a',
      'loop/gioco-tennis.m4a',
    ]);
  });

  it('ogni atto chiede solo i file della propria scaletta', () => {
    for (const act of [1, 2, 3, 4, 5] as const) {
      const { audio, warm } = service();

      audio.preloadAct(act);

      expect(warm[0], `atto ${act}`).toBe(ACT_BEDS[act].file);
      expect(warm.slice(1), `atto ${act}`).toEqual(gameBedsOf(act));
      expect(new Set(warm).size, `atto ${act}: nessun doppione`).toBe(warm.length);
    }
  });

  it('senza atto aperto si carica la lobby, che è la base di ripiego', () => {
    const { audio, warm } = service();

    audio.preloadAct(null);

    expect(warm).toEqual(['loop/lobby.m4a']);
  });
});
