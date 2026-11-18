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

    expect(calls).toContain('start-bed:loop/sport.m4a');
    expect(calls).toContain('start-loop:marbleRoll');
  });

  it('senza una gara in corso la ripresa riporta solo la musica', () => {
    audio.setGameBed('QUIZ');
    calls.length = 0;

    audio.pauseBeds();
    calls.length = 0;
    audio.resumeBeds();

    expect(calls).toContain('start-bed:loop/pub.m4a');
    expect(calls).not.toContain('start-loop:marbleRoll');
  });
});
