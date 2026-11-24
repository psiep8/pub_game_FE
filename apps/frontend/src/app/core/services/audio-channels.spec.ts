import { describe, expect, it } from 'vitest';

import { AudioChannels, OWNER_FADE_SECONDS, type LoopSink } from './audio-channels';
import { AudioService } from './audio.service';

/**
 * Il cambio scena deve spegnere i loop del proprietario uscente, senza toccare
 * quelli del nuovo e senza che un avvio in ritardo riapra un gioco chiuso.
 * Questi test guardano le chiamate al player: l'audio vero non serve.
 */
function fakeSink() {
  const started: Array<{ event: string; offset: number }> = [];
  const stopped: Array<{ event: string; fade: number }> = [];
  const positions = new Map<string, number>();
  const sink: LoopSink = {
    startLoop: (event, _level, _style, offsetSeconds = 0) => {
      started.push({ event, offset: offsetSeconds });
    },
    stopLoop: (event, fadeSeconds = 0) => {
      stopped.push({ event, fade: fadeSeconds });
    },
    isLooping: () => false,
    loopPosition: (event) => positions.get(event) ?? 0,
  };
  return { sink, started, stopped, positions };
}

describe('AudioChannels — proprietari e anti-corsa', () => {
  it('al cambio di proprietario spegne con dissolvenza solo i loop uscenti', () => {
    const { sink, started, stopped } = fakeSink();
    const channels = new AudioChannels(sink);

    channels.setOwner('round:1:QUIZ');
    expect(channels.start('clock', {
      channel: 'loop-gioco', owner: 'round:1:QUIZ', label: 'Ticchettio',
    })).toBe(true);

    channels.setOwner('round:2:BOMBA');
    expect(stopped).toContainEqual({ event: 'clock', fade: OWNER_FADE_SECONDS });
    expect(started.map((row) => row.event)).toEqual(['clock']);
  });

  it('un avvio in ritardo del vecchio proprietario non parte', () => {
    const { sink, started } = fakeSink();
    const channels = new AudioChannels(sink);

    channels.setOwner('round:1:QUIZ');
    channels.setOwner('round:2:BOMBA');

    // È la fetch lenta del gioco A che arriva dopo la fine di A.
    expect(channels.start('marbleRoll', {
      channel: 'loop-gioco', owner: 'round:1:QUIZ', label: 'Rotolamento',
    })).toBe(false);
    expect(started).toHaveLength(0);
    expect(channels.snapshot()).toHaveLength(0);
  });

  it('la pausa sospende tutto e la ripresa parte dal punto', () => {
    const { sink, started, stopped, positions } = fakeSink();
    const channels = new AudioChannels(sink);

    channels.setOwner('round:3:TIMELINE');
    channels.start('clock', { channel: 'loop-gioco', owner: 'round:3:TIMELINE', label: 'Ticchettio' });
    positions.set('clock', 4.2);

    channels.suspend();
    expect(stopped.at(-1)).toEqual({ event: 'clock', fade: 0.3 });

    channels.resume();
    expect(started.at(-1)).toEqual({ event: 'clock', offset: 4.2 });
  });

  it('il reset azzera loop, sospesi e canale del sottofondo', () => {
    const { sink, stopped } = fakeSink();
    const channels = new AudioChannels(sink);

    channels.setOwner('bonus:CAVALLO');
    channels.setBed('bonus:CAVALLO', 'Cavallo', 'loop/gioco-cavallo.m4a');
    channels.start('heartbeat', { channel: 'loop-gioco', owner: 'bonus:CAVALLO', label: 'Battito' });
    channels.reset();

    expect(stopped.map((row) => row.event)).toContain('heartbeat');
    expect(channels.snapshot()).toHaveLength(0);
    expect(channels.currentOwner).toBe('lobby');
  });
});

/**
 * Attraverso il servizio: la TV cambia proprietario a ogni gioco e il gestore
 * deve lasciare in onda un solo insieme di loop, quello del nuovo gioco.
 */
describe('AudioService — loop del proprietario uscente', () => {
  function serviceWithFakePlayer() {
    const audio = new AudioService();
    const calls: string[] = [];
    const player = (audio as unknown as { player: Record<string, unknown> }).player;
    player['startLoop'] = (event: string) => calls.push(`start:${event}`);
    player['stopLoop'] = (event: string, fade?: number) => calls.push(`stop:${event}:${fade ?? 0}`);
    player['isLooping'] = () => true;
    player['loopPosition'] = () => 2;
    player['startBed'] = () => calls.push('start-bed');
    player['stopBed'] = () => calls.push('stop-bed');
    return { audio, calls };
  }

  it('nel giro di un secondo resta solo il loop del nuovo gioco', () => {
    const { audio, calls } = serviceWithFakePlayer();

    audio.setOwner('round:1:QUIZ');
    audio.startClock();
    calls.length = 0;

    audio.setOwner('round:2:BOMBA');
    audio.startClock();

    expect(calls).toContain('stop:clock:0.45');
    expect(calls.filter((call) => call === 'start:clock')).toHaveLength(1);

    // Un secondo dopo non c'è nessun altro avvio: la coda è chiusa.
    expect(calls.filter((call) => call.startsWith('start:'))).toEqual(['start:clock']);
  });

  it('cambi rapidi sotto il secondo non fanno ripartire il gioco vecchio', () => {
    const { audio, calls } = serviceWithFakePlayer();

    for (const owner of ['round:5:MUSIC', 'round:6:TIMELINE', 'round:7:BIGLIE']) {
      audio.setOwner(owner);
      audio.startClock();
    }
    // Il rotolamento arriva dalla gara precedente, ormai fuori scena.
    audio.startMarbleBed('neve');

    expect(calls.filter((call) => call === 'start:marbleRoll')).toHaveLength(1);
    expect(new Set(audio.channelSnapshot().map((row) => row.owner))).toEqual(new Set(['round:7:BIGLIE']));
  });

  it('pausa, ripresa e reset passano dal gestore', () => {
    const { audio, calls } = serviceWithFakePlayer();

    audio.setOwner('round:9:BIGLIE');
    audio.startClock();
    audio.startMarbleBed('sabbia');
    audio.pauseBeds();
    expect(calls.filter((call) => call.startsWith('stop:clock'))).toHaveLength(1);
    expect(calls.filter((call) => call === 'stop:marbleRoll:0.3')).toHaveLength(1);

    calls.length = 0;
    audio.resumeBeds();
    expect(calls).toContain('start:clock');
    expect(calls).toContain('start:marbleRoll');

    calls.length = 0;
    audio.resetAudio();
    expect(audio.channelSnapshot()).toHaveLength(0);
  });

  it('uscendo dalla TV non resta nessun loop attivo', () => {
    const { audio } = serviceWithFakePlayer();

    audio.setOwner('round:12:QUIZ');
    audio.startClock();
    audio.endSession();

    expect(audio.channelSnapshot()).toHaveLength(0);
  });
});
