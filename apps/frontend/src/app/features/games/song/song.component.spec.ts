import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Song } from './song.component';

function fakeNode() {
  const node: any = {
    connect: vi.fn((next: any) => next),
    disconnect: vi.fn(),
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    threshold: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
  };
  return node;
}

class FakeAudio {
  static created: FakeAudio[] = [];
  loop = true;
  preload = '';
  crossOrigin = '';
  currentTime = 9;
  paused = true;
  src = '';
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  constructor(public url: string) {
    FakeAudio.created.push(this);
  }
}

describe('Song — audio pulito della partita Musica', () => {
  let component: Song;
  let fixture: ComponentFixture<Song>;

  beforeEach(async () => {
    FakeAudio.created = [];
    vi.stubGlobal('Audio', FakeAudio);
    await TestBed.configureTestingModule({ imports: [Song] }).compileComponents();
    fixture = TestBed.createComponent(Song);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function wire(song: any) {
    const ctx = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      destination: {},
      createMediaElementSource: vi.fn(() => fakeNode()),
      createGain: vi.fn(() => fakeNode()),
      createDynamicsCompressor: vi.fn(() => fakeNode()),
      createBiquadFilter: vi.fn(),
      createWaveShaper: vi.fn(),
      createOscillator: vi.fn(),
      createBufferSource: vi.fn(),
    };
    song.audioContext = ctx;
    song.audioEngine = {
      context: () => ctx,
      output: () => fakeNode(),
      unlock: vi.fn(async () => undefined),
    };
    song.audioUnlocked = true;
    return ctx;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('non mette il brano in loop e non usa filtri, pitch o distorsione', () => {
    const song = component as any;
    const ctx = wire(song);

    song.initAudio('/media/music/a.m4a');

    expect(song.audio.loop).toBe(false);
    expect(song.audio.preload).toBe('auto');
    expect(ctx.createBiquadFilter).not.toHaveBeenCalled();
    expect(ctx.createWaveShaper).not.toHaveBeenCalled();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.createDynamicsCompressor).toHaveBeenCalled();
  });

  it('ogni ascolto riparte da zero con un fade di 60 ms in testa', async () => {
    const song = component as any;
    wire(song);
    song.initAudio('/media/music/a.m4a');
    song.audio.currentTime = 7;

    await song.playFrom(0);

    expect(song.audio.currentTime).toBe(0);
    const gain = song.gainNode.gain;
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 0.06);
    expect(song.isPlaying()).toBe(true);
  });

  it('taglia con un fade di 60 ms in coda', () => {
    vi.useFakeTimers();
    const song = component as any;
    wire(song);
    song.initAudio('/media/music/a.m4a');
    song.audio.paused = false;
    song.isPlaying.set(true);

    song.stopAudio();

    expect(song.gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.06);
    vi.advanceTimersByTime(80);
    expect(song.audio.pause).toHaveBeenCalled();
    expect(song.isPlaying()).toBe(false);
  });

  it('precarica la manca successiva e riusa l’elemento al cambio brano', () => {
    const song = component as any;
    wire(song);

    song.preload('/media/music/b.m4a');
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.created[0].preload).toBe('auto');

    song.initAudio('/media/music/b.m4a');
    expect(song.audio).toBe(FakeAudio.created[0]);
    expect(song.audio.loop).toBe(false);
  });

  it('la copertina si schiarisce dal primo al secondo ascolto e al reveal', () => {
    const song = component as any;

    song.displayData = { listen: 1, phase: 'LISTEN', revealed: false };
    song.applyBlur();
    expect(song.blurAmount()).toBe(26);

    song.displayData = { listen: 2, phase: 'LISTEN', revealed: false };
    song.applyBlur();
    expect(song.blurAmount()).toBe(14);

    song.displayData = { listen: 2, phase: 'REVEAL', revealed: true };
    song.applyBlur();
    expect(song.blurAmount()).toBe(0);
  });

  it('mostra l’etichetta mono con round, manca, ascolto e valore', () => {
    component.displayData = {
      round: 2,
      manche: 3,
      mancheTotal: 5,
      listen: 1,
      points: 200,
      label: 'Round 2 · manca 3 di 5 · 1° ascolto · 200 punti',
      phase: 'LISTEN',
      phaseSeconds: 4,
      revealed: false,
    };

    expect(component.phaseLabel).toBe('PRIMO ASCOLTO');
    expect(component.phaseSeconds).toBe(4);
  });
});
