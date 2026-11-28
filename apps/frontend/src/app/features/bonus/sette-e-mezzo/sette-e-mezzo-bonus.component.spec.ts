import { TestBed } from '@angular/core/testing';
import { SetteEMezzoBonus } from './sette-e-mezzo-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../../shared/testing/test-doubles';

describe('SetteEMezzoBonus — mano, telefono e ripresa TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetteEMezzoBonus],
      providers: [{ provide: WebSocketService, useClass: FakeWebSocketService }],
    }).compileComponents();
  });

  function mount(resume: any = null) {
    const fixture = TestBed.createComponent(SetteEMezzoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    if (resume) fixture.componentRef.setInput('resume', resume);

    const checkpoints: any[] = [];
    const finished: number[] = [];
    component.checkpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));
    component.finished.subscribe(() => finished.push(finished.length));

    fixture.detectChanges();
    return { fixture, component, checkpoints, finished };
  }

  it('riprende la mano con le carte napoletane e il banco coperto', () => {
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: ['2-SPADE', '3-SPADE'],
      hand: ['5-COPPE', '2-DENARI'],
      bank: ['4-BASTONI', '3-COPPE'],
      rows: [
        { playerName: 'Bruno', status: 'ACTIVE', points: 0 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      phase: 'DECIDE',
      choice: null,
      result: null,
      secondsLeft: 10,
      savedAt: Date.now(),
    });

    const display = component.display();
    expect(display.type).toBe('SETTE_E_MEZZO');
    expect(display.phase).toBe('DECIDE');
    expect(display.cards).toEqual(['5-COPPE', '2-DENARI']);
    expect(display.handTotal).toBe(7);
    expect(display.currentTable).toBe('Bruno');
    expect(display.bank.hidden).toBe(true);
    expect(display.bank.cards).toEqual(['4-BASTONI']);

    fixture.destroy();
  });

  it('lo STAND del tavolo chiamato apre il banco e non assegna punti bonus', () => {
    const { fixture, component } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: ['2-SPADE', '3-SPADE', '4-COPPE'],
      hand: ['5-COPPE', '2-DENARI'],
      bank: ['4-BASTONI', '3-COPPE'],
      rows: [
        { playerName: 'Bruno', status: 'ACTIVE', points: 0 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      phase: 'DECIDE',
      choice: null,
      result: null,
      secondsLeft: 10,
      savedAt: Date.now(),
    });
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    ws.status$.next({ action: 'BLACKJACK_ACTION', playerName: 'Bruno', kind: 'STAND' });

    const display = component.display();
    expect(display.phase).toBe('REVEAL');
    expect(display.bank.hidden).toBe(false);
    expect(display.result.points).toBe(0);
    expect(['WIN', 'NATURAL', 'BUST', 'LOSE']).toContain(display.result.outcome);

    fixture.destroy();
  });

  it('un esito salvato non si rigioca', () => {
    const { component, fixture } = mount({
      order: ['Bruno', 'Anna'],
      index: 0,
      deck: [],
      hand: ['7-DENARI', 'RE-DENARI'],
      bank: ['4-COPPE', '2-SPADE'],
      rows: [
        { playerName: 'Bruno', status: 'NATURAL', points: 0 },
        { playerName: 'Anna', status: 'WAITING', points: 0 },
      ],
      phase: 'REVEAL',
      choice: 'STAND',
      result: { outcome: 'NATURAL', points: 0, handTotal: 7.5, bankTotal: 6 },
      secondsLeft: 4,
      savedAt: Date.now(),
    });

    const display = component.display();
    expect(display.phase).toBe('REVEAL');
    expect(display.bank.hidden).toBe(false);
    expect(display.result).toMatchObject({ outcome: 'NATURAL', points: 0 });

    fixture.destroy();
  });
});
