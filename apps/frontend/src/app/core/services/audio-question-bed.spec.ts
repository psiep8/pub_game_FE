import { beforeEach, describe, expect, it } from 'vitest';

import { AudioService } from './audio.service';

/**
 * Con la domanda aperta Quiz e Indovina chi tengono la base d'atto 6 dB sotto:
 * la musica resta, ma sotto la voce che legge le risposte. Qui il player è un
 * finto: si guardano i livelli chiesti, non l'audio.
 */
describe('AudioService — −6 dB con la domanda aperta', () => {
  let audio: AudioService;
  let calls: string[];

  /** I cambi di volume chiesti al sottofondo in onda. */
  const levels = () => calls.filter((call) => call.startsWith('bed-level'));
  const starts = () => calls.filter((call) => call.startsWith('start-bed'));

  beforeEach(() => {
    audio = new AudioService();
    calls = [];
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['startBed'] = (file: string, level: number) => calls.push(`start-bed:${file}:${level.toFixed(3)}`);
    player['stopBed'] = () => calls.push('stop-bed');
    player['setBedLevel'] = (level: number) => calls.push(`bed-level:${level.toFixed(3)}`);
    player['startLoop'] = (event: string) => calls.push(`start-loop:${event}`);
    player['stopLoop'] = (event: string) => calls.push(`stop-loop:${event}`);
    player['isLooping'] = () => false;
  });

  it('Quiz scende di 6 dB con la domanda e risale alla chiusura', () => {
    audio.setGameBed('QUIZ');
    calls.length = 0;

    audio.setQuestionActive(true);
    expect(levels()).toEqual(['bed-level:0.451']);

    calls.length = 0;
    audio.setQuestionActive(false);
    expect(levels()).toEqual(['bed-level:0.900']);
  });

  it('Indovina chi segue la stessa regola', () => {
    audio.setGameBed('IMAGE_BLUR');
    calls.length = 0;

    audio.setQuestionActive(true);
    expect(levels()).toEqual(['bed-level:0.451']);
  });

  it('un gioco con il suo loop non si abbassa', () => {
    audio.setGameBed('BOMBA');
    calls.length = 0;

    audio.setQuestionActive(true);
    expect(levels()).toEqual([]);
  });

  it('aprire la domanda due volte non ripete il comando', () => {
    audio.setGameBed('QUIZ');
    audio.setQuestionActive(true);
    calls.length = 0;

    audio.setQuestionActive(true);
    expect(levels()).toEqual([]);
  });

  it('il gioco nuovo chiude la domanda e riporta la base piena', () => {
    audio.setGameBed('QUIZ');
    audio.setQuestionActive(true);
    calls.length = 0;

    audio.setGameBed('BOMBA');

    expect(levels()).toEqual([]);
    expect(starts()).toContain('start-bed:loop/gioco-bomba.m4a:0.900');
  });

  it('entrando in un gioco muto la domanda non accende nulla', () => {
    audio.setGameBed('MUSIC');
    calls.length = 0;

    audio.setQuestionActive(true);
    expect(levels()).toEqual([]);
    expect(starts()).toEqual([]);
  });
});
