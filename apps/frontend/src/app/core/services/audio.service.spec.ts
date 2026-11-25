import { beforeEach, describe, expect, it } from 'vitest';

import { AUDIO_EVENTS } from './audio-catalog';
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
    player['stopOneShots'] = () => calls.push('stop-one-shots');
    player['play'] = (event: string) => {
      calls.push(`play:${event}`);
      return true;
    };
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

  it('la pausa zittisce anche gli effetti lunghi già partiti, come il giro della roulette', () => {
    // F-05: il tac-tac del Casino è un effetto lungo già in onda; la pausa
    // fermava i loop ma non lui, e continuava a suonare a sala ferma.
    calls.length = 0;

    audio.pauseBeds();

    expect(calls).toContain('stop-one-shots');
  });

  it('alla ripresa riaccende il rotolamento solo se una gara era in corso', () => {
    audio.setGameBed('BIGLIE');
    audio.startMarbleBed('neve');
    marbleInOnda = true;
    audio.pauseBeds();
    calls.length = 0;
    marbleInOnda = false;

    audio.resumeBeds();

    expect(calls).toContain('start-bed:loop/gioco-biglie.m4a');
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

  it('in pausa nessun effetto parte, e alla ripresa ripartono', () => {
    calls.length = 0;
    audio.pauseBeds();

    expect(audio.play('gong')).toBe(false);
    expect(calls).not.toContain('play:gong');

    audio.resumeBeds();
    calls.length = 0;

    expect(audio.play('gong')).toBe(true);
    expect(calls).toContain('play:gong');
  });

  it('in pausa il cambio di sottofondo non fa partire il nuovo file', () => {
    audio.setGameBed('QUIZ');
    audio.pauseBeds();
    calls.length = 0;

    audio.setGameBed('BOMBA');

    expect(calls.filter((call) => call.startsWith('start-bed'))).toEqual([]);

    calls.length = 0;
    audio.resumeBeds();

    expect(calls).toContain('start-bed:loop/gioco-bomba.m4a');
  });

  it('in pausa clock e battito restano fermi', () => {
    audio.pauseBeds();
    calls.length = 0;

    audio.startClock();
    audio.startHeartbeat(0.8);

    expect(calls.filter((call) => call.startsWith('start-loop'))).toEqual([]);
  });
});

/**
 * «FERMA TUTTO» dalla regia deve zittire la sala per davvero: prima fermava
 * solo battito e orologio, e il sottofondo continuava a girare. Il player è un
 * finto anche qui: si guarda l'ordine delle chiamate, non l'audio.
 */
describe('AudioService — silenzio dalla regia', () => {
  let audio: AudioService;
  let calls: string[];

  beforeEach(() => {
    audio = new AudioService();
    calls = [];
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['startBed'] = (file: string) => calls.push(`start-bed:${file}`);
    player['stopBed'] = () => calls.push('stop-bed');
    player['startLoop'] = (event: string, level: number) =>
      calls.push(`start-loop:${event}:${level}`);
    player['stopLoop'] = (event: string) => calls.push(`stop-loop:${event}`);
    player['stopOneShots'] = () => calls.push('stop-one-shots');
    player['isLooping'] = () => false;
  });

  it('ferma sottofondo, rotolamento, orologio, battito ed effetti', () => {
    audio.setGameBed('BIGLIE');
    audio.startMarbleBed('neve');
    audio.startClock();
    audio.startHeartbeat(0.5);
    calls.length = 0;

    audio.stopAll();

    expect(calls).toEqual([
      'stop-loop:heartbeat',
      'stop-loop:clock',
      'stop-loop:marbleRoll',
      'stop-bed',
      'stop-one-shots',
    ]);
  });

  it('l’orologio suona al livello della bilanciatura', () => {
    audio.startClock();

    expect(calls).toContain(`start-loop:clock:${AUDIO_EVENTS.clock.volume}`);
    expect(AUDIO_EVENTS.clock.volume).toBeLessThan(1);
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

  it('il Time Buzzer porta il suo sottofondo anche dopo un altro gioco', () => {
    audio.setGameBed('BOMBA');
    calls.length = 0;

    audio.setGameBed('TIME_BUZZER');

    expect(started()).toEqual(['start-bed:loop/gioco-timeline.m4a']);
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
