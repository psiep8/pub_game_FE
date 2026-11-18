import { beforeEach, describe, expect, it } from 'vitest';

import { AudioService } from './audio.service';

/**
 * La pausa della TV deve zittire tutto, non solo il tappeto: la musica si ferma
 * e il rotolamento delle Biglie smette, ma torna solo se una gara era davvero in
 * corso. Qui il player è un finto: si guardano le chiamate, non l'audio.
 */
describe('AudioService — pausa della TV', () => {
  let audio: AudioService;
  let calls: string[];
  let marbleInOnda: boolean;

  beforeEach(() => {
    audio = new AudioService();
    calls = [];
    marbleInOnda = false;
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['startBed'] = (file: string) => calls.push(`start-bed:${file}`);
    player['stopBed'] = () => calls.push('stop-bed');
    player['startLoop'] = (event: string) => calls.push(`start-loop:${event}`);
    player['stopLoop'] = (event: string) => calls.push(`stop-loop:${event}`);
    player['isLooping'] = (event: string) => event === 'marbleRoll' && marbleInOnda;
  });

  it('in pausa ferma musica e rotolamento', () => {
    audio.setGameBed('BIGLIE');
    audio.startMarbleBed('neve');
    marbleInOnda = true;
    calls.length = 0;

    audio.pauseBeds();

    expect(calls).toContain('stop-bed');
    expect(calls).toContain('stop-loop:marbleRoll');
  });

  it('alla ripresa riaccende il rotolamento solo se una gara era in corso', () => {
    audio.setGameBed('BIGLIE');
    audio.startMarbleBed('neve');
    marbleInOnda = true;
    audio.pauseBeds();
    calls.length = 0;
    marbleInOnda = false;

    audio.resumeBeds();

    expect(calls).toContain('start-bed:loop/gioco-tennis.m4a');
    expect(calls).toContain('start-loop:marbleRoll');
  });

  it('senza una gara in corso la ripresa riporta solo la musica', () => {
    audio.setGameBed('QUIZ');
    calls.length = 0;

    audio.pauseBeds();
    calls.length = 0;
    audio.resumeBeds();

    expect(calls).toContain('start-bed:loop/lobby.m4a');
    expect(calls).not.toContain('start-loop:marbleRoll');
  });
});

/**
 * Musica e Time Buzzer non vogliono un tappeto sotto: il loro sottofondo è il
 * silenzio, non il jazz della lobby abbassato.
 */
describe('AudioService — giochi muti', () => {
  let audio: AudioService;
  let calls: string[];

  const started = () => calls.filter((call) => call.startsWith('start-bed'));

  beforeEach(() => {
    audio = new AudioService();
    calls = [];
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['startBed'] = (file: string) => calls.push(`start-bed:${file}`);
    player['stopBed'] = () => calls.push('stop-bed');
    player['startLoop'] = (event: string) => calls.push(`start-loop:${event}`);
    player['stopLoop'] = (event: string) => calls.push(`stop-loop:${event}`);
    player['isLooping'] = () => false;
  });

  it('Musica spegne il sottofondo invece di suonare la lobby', () => {
    audio.setGameBed('TIMELINE');
    calls.length = 0;

    audio.setGameBed('MUSIC');

    expect(calls).toContain('stop-bed');
    expect(started()).toEqual([]);
  });

  it('Time Buzzer tace anche se arriva dopo un gioco con il suo loop', () => {
    audio.setGameBed('BOMBA');
    calls.length = 0;

    audio.setGameBed('TIME_BUZZER');

    expect(calls).toContain('stop-bed');
    expect(started()).toEqual([]);
  });

  it('dopo la pausa un gioco muto resta muto', () => {
    audio.setGameBed('MUSIC');
    calls.length = 0;

    audio.pauseBeds();
    calls.length = 0;
    audio.resumeBeds();

    expect(started()).toEqual([]);
  });

  it('uscendo dalla Musica il sottofondo torna', () => {
    audio.setGameBed('MUSIC');
    calls.length = 0;

    audio.setGameBed('QUIZ');

    expect(started()).toEqual(['start-bed:loop/lobby.m4a']);
  });
});
