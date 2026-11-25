import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { vi } from 'vitest';

import { Song } from './song.component';

describe('Song', () => {
  let component: Song;
  let fixture: ComponentFixture<Song>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Song],
    }).compileComponents();

    fixture = TestBed.createComponent(Song);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should describe every phase', () => {
    expect(component.getPhaseLabel()).toBe('In attesa...');

    component.currentPhase.set(1);
    expect(component.getPhaseLabel()).toContain('Irriconoscibile');
    expect(component.getPhaseColor()).toBe('var(--tomato)');

    component.currentPhase.set(4);
    expect(component.getPhaseLabel()).toContain('Chiaro');
    expect(component.getPhaseColor()).toBe('var(--mint)');
  });

  it('should expose an icon per phase', () => {
    component.currentPhase.set(0);
    expect(component.getPhaseIcon()).toBe('⏳');

    component.currentPhase.set(4);
    expect(component.getPhaseIcon()).toBe('📢');
  });

  it('sfuma gli ultimi 5 secondi e avvisa quando il brano è finito', async () => {
    vi.useFakeTimers();
    try {
      const song = component as any;
      const ramp: Array<[number, number]> = [];
      const gain = {
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((value: number, at: number) => ramp.push([value, at])),
        disconnect: vi.fn(),
      };
      const filter = {
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        disconnect: vi.fn(),
      };

      song.audio = {
        loop: false,
        currentTime: 0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
      };
      song.audioContext = {
        currentTime: 100,
        state: 'running',
        resume: vi.fn(),
        sampleRate: 44100,
      };
      song.gainNode = { gain, disconnect: vi.fn() };
      song.bandpassFilter = filter;
      song.highpassFilter = filter;
      song.lowpassFilter = filter;
      song.distortionNode = { curve: null, disconnect: vi.fn() };
      song.startVinylAnimation = vi.fn();

      let ended = 0;
      component.onFullPlaybackEnd.subscribe(() => ended++);

      await song.startFullPlayback();

      // 25 s a volume pieno, poi 5 s di rampa fino a zero.
      expect(ramp).toContainEqual([0.0001, 130]);
      expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 125);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(ended).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('F-16: la prima manche è un filo calante, la terza torna naturale', () => {
    const song = component as any;
    const setValue = vi.fn();
    song.audio = { playbackRate: 1, pause: vi.fn() };
    song.audioContext = { currentTime: 0 };
    song.gainNode = { gain: { setValueAtTime: setValue, cancelScheduledValues: vi.fn() } };
    song.bandpassFilter = { frequency: { setValueAtTime: setValue }, Q: { setValueAtTime: setValue }, disconnect: vi.fn() };
    song.highpassFilter = { frequency: { setValueAtTime: setValue }, disconnect: vi.fn() };
    song.lowpassFilter = { frequency: { setValueAtTime: setValue }, disconnect: vi.fn() };
    song.distortionNode = { curve: null, disconnect: vi.fn() };
    song.setInterference = vi.fn();

    song.applyFilters(1);
    expect(song.audio.playbackRate).toBeCloseTo(1.03);

    song.applyFilters(3);
    expect(song.audio.playbackRate).toBe(1);

    // I mock restano solo in questo test: la distruzione non deve toccarli.
    song.audio = undefined;
    song.audioContext = undefined;
    song.gainNode = undefined;
    song.bandpassFilter = undefined;
    song.highpassFilter = undefined;
    song.lowpassFilter = undefined;
    song.distortionNode = undefined;
  });

  it('nella seconda manche suona la preview al contrario, senza il file', async () => {
    const song = component as any;
    const source = {
      buffer: null as any,
      loop: false,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    song.audioContext = {
      currentTime: 0,
      state: 'running',
      resume: vi.fn(),
      createBufferSource: () => source,
    };
    song.bandpassFilter = { connect: vi.fn(), disconnect: vi.fn() };
    song.audio = { loop: true, play: vi.fn(), pause: vi.fn() };
    song.audioUnlocked = true;
    song.startVinylAnimation = vi.fn();
    song.setInterference = vi.fn();
    song.displayData = { previewUrl: 'preview.mp3' };
    const buffer = { numberOfChannels: 1, getChannelData: () => Float32Array.from([1, 2, 3]) };
    song.reversed = { url: 'preview.mp3', buffer };

    song.currentPhase.set(2);
    await song.playAudio();

    expect(source.start).toHaveBeenCalled();
    expect(source.buffer).toBe(buffer);
    expect(source.loop).toBe(true);
    expect(source.playbackRate.value).toBeCloseTo(0.94);
    // L'elemento resta fermo: il brano non si sente due volte.
    expect(song.audio.play).not.toHaveBeenCalled();
    expect(song.audio.pause).toHaveBeenCalled();
    expect(song.isPlaying()).toBe(true);
  });

  it('quando la manche 2 finisce il file torna a suonare', () => {
    const song = component as any;
    song.stopReversePlayback = vi.fn();
    song.playAudio = vi.fn();
    song.applyFilters = vi.fn();
    song.applyBlur = vi.fn();
    song.reversed = { url: 'preview.mp3', buffer: {} };
    song.isPlaying.set(true);
    song.currentPhase.set(2);
    song.lastPhase = 2;
    song.displayData = {
      previewUrl: 'preview.mp3',
      audioPlaying: true,
      buzzedPlayer: null,
      fullPlayback: false,
      currentPhase: 3,
    };

    song.ngOnChanges({
      displayData: new SimpleChange(
        { ...song.displayData, currentPhase: 2 },
        song.displayData,
        false,
      ),
    });

    expect(song.stopReversePlayback).toHaveBeenCalled();
    expect(song.isPlaying()).toBe(false);
    expect(song.playAudio).toHaveBeenCalled();
  });

  it('should stop the preview as soon as a player buzzes', () => {
    const song = component as any;
    let pauses = 0;
    song.audio = {
      pause: () => { pauses++; },
      loop: true,
      playbackRate: 1,
      currentTime: 5,
    };
    song.isPlaying.set(true);
    song.displayData = {
      previewUrl: 'preview.mp3',
      audioPlaying: true,
      buzzedPlayer: 'Anna',
      fullPlayback: false,
      currentPhase: 1,
    };

    song.ngOnChanges({
      displayData: new SimpleChange(
        {
          previewUrl: 'preview.mp3',
          audioPlaying: true,
          buzzedPlayer: null,
          fullPlayback: false,
          currentPhase: 1,
        },
        song.displayData,
        false,
      ),
    });

    expect(pauses).toBeGreaterThan(0);
    expect(song.isPlaying()).toBe(false);
  });
});
