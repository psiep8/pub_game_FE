import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { KaraokeBonus } from './karaoke-bonus.component';
import { KaraokeManche, KaraokeService } from './karaoke.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { AudioService } from '../../../core/services/audio.service';
import { FakeAudioService, FakeWebSocketService } from '../../../shared/testing/test-doubles';

const MANCHE: KaraokeManche = {
  manche: 1,
  punti: 100,
  titolo: 'La solitudine',
  artista: 'Laura Pausini',
  anno: 1993,
  file: '',
  offsetMs: 47250,
  testiPronti: true,
  righe: [
    { indice: 1, inizioMs: 0, testo: 'Chissà se tu mi penserai' },
    { indice: 2, inizioMs: 3940, testo: 'Se con i tuoi non parli mai' },
    { indice: 3, inizioMs: 7680, testo: 'Se ti nascondi come me' },
    { indice: 4, inizioMs: 11670, testo: 'Sfuggi gli sguardi e te ne stai' },
    { indice: 5, inizioMs: 15620, testo: 'Rinchiuso in camera e non vuoi mangiare' },
    { indice: 6, inizioMs: 20870, testo: 'Stringi forte al te il cuscino e' },
  ],
  risposte: [],
};

describe('KaraokeBonus — microfono conteso', () => {
  const richieste: number[] = [];

  beforeEach(async () => {
    richieste.length = 0;
    await TestBed.configureTestingModule({
      imports: [KaraokeBonus],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: AudioService, useClass: FakeAudioService },
        {
          provide: KaraokeService,
          useValue: {
            getManches: (gameId: number) => {
              richieste.push(gameId);
              return of([MANCHE]);
            },
          },
        },
      ],
    }).compileComponents();
  });

  function mount(gameId = 1) {
    const fixture = TestBed.createComponent(KaraokeBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', gameId);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('preview', true);
    fixture.componentRef.setInput('resume', {
      manche: 1,
      phase: 'STEAL',
      secondsLeft: 12,
      stopIndex: 3,
      stopAtMs: 9000,
      buzzAttempt: 1,
      micPlayer: null,
      blocked: [],
      scores: [],
    });

    const results: Array<{ playerName: string; score: number }> = [];
    component.result.subscribe((result) => results.push(result));
    fixture.detectChanges();
    return { fixture, component, results };
  }

  it('il primo che prenota prende il microfono e la regia assegna i punti', () => {
    const { fixture, component, results } = mount();
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    expect(component.phase()).toBe('STEAL');
    ws.status$.next({ action: 'KARAOKE_ACTION', playerName: 'Anna', manche: 1 });
    fixture.detectChanges();

    expect(component.phase()).toBe('JUDGE');
    expect(component.micPlayer()).toBe('Anna');
    expect(component.answerLines().map((line) => line.testo)).toEqual([
      'Rinchiuso in camera e non vuoi mangiare',
      'Stringi forte al te il cuscino e',
    ]);

    ws.status$.next({
      action: 'ADMIN_KARAOKE_RESULT',
      manche: 1,
      playerName: 'Anna',
      result: 'CORRECT',
    });
    fixture.detectChanges();

    expect(component.phase()).toBe('REVEAL');
    expect(results).toEqual([{ playerName: 'Anna', score: 100 }]);

    fixture.destroy();
  });

  it('chi sbaglia non perde punti, resta fuori e il microfono torna libero', () => {
    const { fixture, component, results } = mount();
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    ws.status$.next({ action: 'KARAOKE_ACTION', playerName: 'Anna', manche: 1 });
    fixture.detectChanges();
    component.judge('WRONG');

    expect(component.phase()).toBe('STEAL');
    expect(component.micPlayer()).toBeNull();
    expect(component.blocked()).toEqual(['Anna']);
    expect(results).toEqual([]);

    // Un secondo tocco di Anna non riapre il microfono.
    ws.status$.next({ action: 'KARAOKE_ACTION', playerName: 'Anna', manche: 1 });
    fixture.detectChanges();
    expect(component.phase()).toBe('STEAL');

    // Tocca a Bruno: il telefono si riarma perché la prenotazione è nuova.
    ws.status$.next({ action: 'KARAOKE_ACTION', playerName: 'Bruno', manche: 1 });
    fixture.detectChanges();
    expect(component.phase()).toBe('JUDGE');
    expect(component.micPlayer()).toBe('Bruno');

    component.judge('WRONG');
    expect(component.phase()).toBe('REVEAL');
    expect(component.reveal()?.heading).toContain('NESSUN TAVOLO');

    fixture.destroy();
  });

  it('chiede le manche al server con il gameId della partita', () => {
    const { fixture } = mount(77);

    expect(richieste).toEqual([77]);

    fixture.destroy();
  });

  it('pubblica un tentativo nuovo a ogni riapertura delle prenotazioni', () => {
    const { fixture, component } = mount();
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    ws.status$.next({ action: 'KARAOKE_ACTION', playerName: 'Anna', manche: 1 });
    fixture.detectChanges();
    component.judge('WRONG');

    const state = ws.broadcasted
      .map((entry) => entry.body)
      .filter((body) => body.action === 'KARAOKE_STATE')
      .at(-1)?.state;
    expect(state.phase).toBe('STEAL');
    expect(state.buzzAttempt).toBe(2);
    expect(state.micPlayer).toBeNull();

    fixture.destroy();
  });
});
