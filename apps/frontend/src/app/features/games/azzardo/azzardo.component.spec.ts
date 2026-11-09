import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Azzardo } from './azzardo.component';

class FakeAudio {
  static played: string[] = [];

  src: string;
  paused = true;
  volume = 1;
  preload = 'auto';
  currentTime = 0;

  constructor(src: string) {
    this.src = src;
  }

  play(): Promise<void> {
    this.paused = false;
    FakeAudio.played.push(this.src);
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  addEventListener(): void {
    // Il test non ha bisogno degli eventi del media.
  }
}

describe('Azzardo media locale', () => {
  let fixture: ComponentFixture<Azzardo>;
  let originalAudio: typeof Audio;

  beforeEach(async () => {
    FakeAudio.played = [];
    originalAudio = window.Audio;
    Object.defineProperty(window, 'Audio', { value: FakeAudio, configurable: true });

    await TestBed.configureTestingModule({
      imports: [Azzardo],
    }).compileComponents();

    fixture = TestBed.createComponent(Azzardo);
  });

  afterEach(() => {
    fixture.destroy();
    Object.defineProperty(window, 'Audio', { value: originalAudio, configurable: true });
  });

  function setBet(media: any): void {
    fixture.componentRef.setInput('displayData', {
      phase: 'BET',
      level: 2,
      odds: 3,
      lossMultiplier: 0.8,
      secondsLeft: 15,
      manche: 2,
      total: 4,
      category: 'CANZONI',
      unit: 'anno',
      question: 'In che anno è uscita Imagine di John Lennon?',
      options: [1970, 1971, 1975, 1980],
      answerIndex: 1,
      value: 1971,
      media,
      clue: 'Guarda la foto e pensa all\'anno.',
      clueIndex: 1,
      clueTotal: 1,
      ready: [],
      rows: [],
      chips: 10,
      chipValue: 20,
    });
    fixture.detectChanges();
  }

  it('mostra la foto che arriva dalla banca locale', () => {
    setBet({
      kind: 'celebrity',
      name: 'Albert Einstein',
      imageUrl: 'http://192.168.1.10:8080/media/people/albert-einstein.jpg',
      clues: ['fisico tedesco'],
    });

    const image = fixture.nativeElement.querySelector('.az-photo img') as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.getAttribute('src'))
      .toBe('http://192.168.1.10:8080/media/people/albert-einstein.jpg');
  });

  it('riproduce la preview e carica la copertina locale', async () => {
    setBet({
      kind: 'song',
      title: 'Imagine',
      artist: 'John Lennon',
      previewUrl: 'http://192.168.1.10:8080/media/music/john-lennon-imagine.m4a',
      albumCover: 'http://192.168.1.10:8080/media/covers/john-lennon-imagine.jpg',
    });
    await fixture.whenStable();

    expect(FakeAudio.played)
      .toContain('http://192.168.1.10:8080/media/music/john-lennon-imagine.m4a');

    const cover = fixture.nativeElement.querySelector('.az-cover img') as HTMLImageElement;
    expect(cover).toBeTruthy();
    expect(cover.getAttribute('src'))
      .toBe('http://192.168.1.10:8080/media/covers/john-lennon-imagine.jpg');
  });
});
