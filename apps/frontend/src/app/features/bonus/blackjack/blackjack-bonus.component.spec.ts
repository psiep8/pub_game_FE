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

  function mount(resume: any = null) {
    const fixture = TestBed.createComponent(BlackjackBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    if (resume) fixture.componentRef.setInput('resume', resume);

    const results: any[] = [];
    const checkpoints: any[] = [];
    component.result.subscribe((result) => results.push(result));
    component.checkpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));

    fixture.detectChanges();
    return { fixture, component, results, checkpoints };
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
