import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioService } from '../../core/services/audio.service';
import { AudioLab } from './audio-lab.component';

/**
 * La regia audio mostra i sottofondi per atto e per gioco con il peso di
 * ognuno. Il peso arriva da una HEAD su ogni file: qui la rete è finta, e i
 * file d'atto non ancora consegnati devono leggersi «manca».
 */
describe('Regia audio — sottofondi', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: !url.includes('/atto-'),
          headers: { get: () => String(1024 * 1024) },
        }),
      ),
    );

    TestBed.configureTestingModule({
      imports: [AudioLab],
      providers: [
        {
          provide: AudioService,
          useValue: { isEnabled: () => true, masterVolume: signal(1) },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('elenca atti e giochi con file e peso, e segna i mancanti', async () => {
    const fixture = TestBed.createComponent(AudioLab);
    fixture.detectChanges();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('1,00 MB');
    });

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('SOTTOFONDI PER ATTO');
    expect(text).toContain('SOTTOFONDI PER GIOCO');
    // Base d'atto non consegnata: file sì, peso no.
    expect(text).toContain('loop/atto-1.m4a · manca');
    expect(text).toContain('Atto 1 — Aperitivo');
    // Un gioco con il suo loop, misurato.
    expect(text).toContain('loop/gioco-bomba.m4a · 1,00 MB');
    // Un gioco che vive sulla base d'atto e uno muto.
    expect(text).toContain('base dell’atto');
    expect(text).toContain('silenzio');
  });

  it("conta nel totale solo i file che l'atto ha davvero", async () => {
    const fixture = TestBed.createComponent(AudioLab);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('1,00 MB');
    });

    const text: string = fixture.nativeElement.textContent;
    // Atto 1: casino e bomba misurati (2 MB), la sua base ancora da consegnare.
    expect(text).toContain('2,00 MB · 1 da consegnare');
  });
});
