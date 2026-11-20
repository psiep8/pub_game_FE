import { TestBed } from '@angular/core/testing';
import { BlackjackBonus } from './blackjack-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../../shared/testing/test-doubles';

describe('BlackjackBonus — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlackjackBonus],
      providers: [{ provide: WebSocketService, useClass: FakeWebSocketService }],
    }).compileComponents();
  });

  /** `document.hidden` è in sola lettura: la visibilità si finge qui. */
  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  }

  function mount(resume: any = null, preview = false) {
    const fixture = TestBed.createComponent(BlackjackBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    if (resume) fixture.componentRef.setInput('resume', resume);
    if (preview) fixture.componentRef.setInput('preview', true);

    const results: any[] = [];
    const checkpoints: any[] = [];
    const finished: number[] = [];
    component.result.subscribe((result) => results.push(result));
    component.checkpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));
    component.finished.subscribe(() => finished.push(finished.length));

    fixture.detectChanges();
    return { fixture, component, results, checkpoints, finished };
  }

  it('riprende la mano in corso con le stesse carte e il tempo che resta', () => {
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 1,
      deck: ['2♠', '3♠'],
      hand: ['A♥', 'K♥'],
      bank: ['9♠', '7♠'],
      rows: [
        { playerName: 'Bruno', status: 'WIN', points: 150 },
        { playerName: 'Anna', status: 'ACTIVE', points: 0 },
      ],
      handPoints: 0,
      phase: 'DECIDE',
      choice: null,
      result: null,
      secondsLeft: 10,
      savedAt: Date.now() - 4000,
    });

    const display = component.display();
    expect(display.phase).toBe('DECIDE');
    // Nessuna nuova distribuzione: le carte sono quelle salvate.
    expect(display.cards).toEqual(['A♥', 'K♥']);
    expect(display.index).toBe(2);
    expect(display.currentTable).toBe('Anna');
    // Durante la decisione il banco resta coperto come in gioco.
    expect(display.bank.hidden).toBe(true);
    expect(display.bank.cards).toEqual(['9♠']);

    fixture.destroy();
  });

  it('un esito già calcolato non si rigioca e i punti tornano alla TV', () => {
    const { component, results, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: ['2♠', '3♠'],
      hand: ['J♥', '8♥'],
      bank: ['10♠', '9♠'],
      rows: [
        { playerName: 'Bruno', status: 'WIN', points: 150 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      handPoints: 150,
      phase: 'REVEAL',
      choice: 'STAND',
      result: { outcome: 'WIN', points: 150, round: 1, handTotal: 18, bankTotal: 19 - 1 },
      secondsLeft: 4,
      savedAt: Date.now(),
    });

    const display = component.display();
    expect(display.phase).toBe('REVEAL');
    expect(display.bank.hidden).toBe(false);
    expect(display.result).toMatchObject({ outcome: 'WIN', points: 150 });
    // I punti dei tavoli chiusi non sono mai stati pagati: si ricostruiscono.
    expect(results).toEqual([{ playerName: 'Bruno', score: 150 }]);

    fixture.destroy();
  });

  it('salva la mano appena distribuita', () => {
    vi.useFakeTimers();
    const { checkpoints, fixture } = mount();

    vi.advanceTimersByTime(600);

    const state = checkpoints.at(-1);
    expect(state.phase).toBe('DECIDE');
    expect(state.hand).toHaveLength(2);
    expect(state.bank).toHaveLength(2);
    expect(state.deck.length).toBeGreaterThan(0);
    expect(state.order).toEqual(['Bruno', 'Anna']);
    expect(state.secondsLeft).toBe(15);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('con una mano salvata senza carte riparte da capo', () => {
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      hand: [],
      bank: [],
      rows: [],
      phase: 'DECIDE',
      secondsLeft: 5,
    });

    expect(component.display().cards).toHaveLength(2);
    expect(component.display().index).toBe(1);

    fixture.destroy();
  });

  it('nel banco di prova gioca le mani da solo, senza il conto alla rovescia', () => {
    vi.useFakeTimers();
    const { component, checkpoints, results, finished, fixture } = mount(null, true);

    // Distribuzione (500 ms) e prima scelta demo (400 ms).
    vi.advanceTimersByTime(1000);
    expect(['DECIDE', 'REVEAL']).toContain(component.display()?.phase);
    // Nessun intervallo di decisione: le carte le pesca il tavolo demo, quindi
    // i 15 secondi non possono chiudere la mano a metà.
    expect((component as any).clock).toBeUndefined();

    vi.advanceTimersByTime(6000);
    expect(checkpoints.some((state) => state.phase === 'REVEAL')).toBe(true);

    vi.advanceTimersByTime(40000);
    expect(finished).toHaveLength(1);
    expect(results.every((row) => row.score === 75 || row.score === 150)).toBe(true);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('nel banco di prova l’esito resta due secondi, non quattro', () => {
    vi.useFakeTimers();
    const { component, checkpoints, fixture } = mount(null, true);

    vi.advanceTimersByTime(12000);
    const reveals = checkpoints.filter((state) => state.phase === 'REVEAL');
    expect(reveals.length).toBeGreaterThan(1);
    expect(reveals[0].secondsLeft).toBe(2);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa della TV ferma la decisione del tavolo', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    vi.advanceTimersByTime(600);
    expect(component.display()?.phase).toBe('DECIDE');
    const internal = component as any;
    const before = internal.secondsLeft;

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    expect(internal.secondsLeft).toBe(before);
    expect(component.display()?.phase).toBe('DECIDE');

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    expect(internal.secondsLeft).toBe(before - 1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('salva la pausa nel checkpoint per il refresh della TV', () => {
    const { checkpoints, fixture } = mount();

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    expect(checkpoints.at(-1)?.paused).toBe(true);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    expect(checkpoints.at(-1)?.paused).toBe(false);

    fixture.destroy();
  });

  it('la scheda nascosta ferma anche la decisione del tavolo', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    vi.advanceTimersByTime(600);
    expect(component.display()?.phase).toBe('DECIDE');
    const internal = component as any;
    const before = internal.secondsLeft;

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);

    // Con la scheda nascosta il tavolo non decide e non passa la mano.
    expect(internal.secondsLeft).toBe(before);
    expect(component.display()?.phase).toBe('DECIDE');

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1000);
    expect(internal.secondsLeft).toBe(before - 1);

    delete (document as any).hidden;
    vi.useRealTimers();
    fixture.destroy();
  });

  it('in pausa il tavolo non passa alla mano successiva', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: ['2♠', '3♠'],
      hand: ['J♥', '8♥'],
      bank: ['10♠', '9♠'],
      rows: [
        { playerName: 'Bruno', status: 'WIN', points: 150 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      handPoints: 150,
      phase: 'REVEAL',
      choice: 'STAND',
      result: { outcome: 'WIN', points: 150, round: 1, handTotal: 18, bankTotal: 18 },
      secondsLeft: 4,
      savedAt: Date.now(),
    });

    expect(component.display()?.currentTable).toBe('Bruno');
    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(10000);
    expect(component.display()?.currentTable).toBe('Bruno');

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(4100);
    expect(component.display()?.currentTable).toBe('Anna');

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa respinge la mossa arrivata dal telefono', () => {
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: ['2♠', '3♠'],
      hand: ['J♥', '8♥'],
      bank: ['10♠', '9♠'],
      rows: [
        { playerName: 'Bruno', status: 'ACTIVE', points: 0 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      handPoints: 0,
      phase: 'DECIDE',
      choice: null,
      result: null,
      secondsLeft: 12,
      savedAt: Date.now(),
    });
    expect(component.display()?.currentTable).toBe('Bruno');

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    ws.status$.next({ action: 'BLACKJACK_ACTION', playerName: 'Bruno', kind: 'STAND' });
    fixture.detectChanges();

    // A tavolo fermo la mossa non chiude la mano.
    expect(component.display()?.phase).toBe('DECIDE');
    expect(component.display()?.bank.hidden).toBe(true);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    ws.status$.next({ action: 'BLACKJACK_ACTION', playerName: 'Bruno', kind: 'STAND' });
    fixture.detectChanges();

    // Alla ripresa la stessa mossa vale come sempre.
    expect(component.display()?.phase).toBe('REVEAL');
    expect(component.display()?.bank.hidden).toBe(false);

    fixture.destroy();
  });

  it('rimanda lo stato ai telefoni alla ripresa', () => {
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    const { fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      hand: ['A♥', 'K♥'],
      bank: ['9♠', '7♠'],
      rows: [],
      phase: 'DECIDE',
      secondsLeft: 12,
    });

    expect(ws.broadcasted.at(-1)?.body.action).toBe('BLACKJACK_STATE');
    expect(ws.broadcasted.at(-1)?.body.state.currentTable).toBe('Bruno');

    fixture.destroy();
  });
});
