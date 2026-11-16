import { TestBed } from '@angular/core/testing';
import { CavalloBonus } from './cavallo-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { GameService } from '../../../core/services/game.service';
import { FakeGameService, FakeWebSocketService } from '../../../shared/testing/test-doubles';

const QUESTIONS = [
  { question: 'Capitale del Giappone?', options: ['Pechino', 'Tokyo'], correctIndex: 1, category: 'GEOGRAFIA' },
  { question: 'Chi ha dipinto la Gioconda?', options: ['Leonardo', 'Raffaello'], correctIndex: 0, category: 'ARTE' },
];

describe('CavalloBonus — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CavalloBonus],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: GameService, useClass: FakeGameService },
      ],
    }).compileComponents();
  });

  function mount(resume: any = null) {
    const fixture = TestBed.createComponent(CavalloBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('categories', [
      { id: 1, name: 'CULTURA GENERALE', active: true },
      { id: 2, name: 'MUSICA', active: true },
    ]);
    if (resume) fixture.componentRef.setInput('resume', resume);

    const results: any[] = [];
    const checkpoints: any[] = [];
    const finished: number[] = [];
    component.result.subscribe((result) => results.push(result));
    component.checkpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));
    component.finished.subscribe(() => finished.push(1));

    fixture.detectChanges();
    return { fixture, component, results, checkpoints, finished };
  }

  it('riprende la votazione della categoria con i voti già dati', () => {
    const { component, fixture } = mount({
      phase: 'CATEGORY',
      secondsLeft: 15,
      savedAt: Date.now() - 5000,
      chosenCategory: '',
      questions: [],
      index: 0,
      total: 8,
      scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
      votes: [{ playerName: 'Anna', category: 'MUSICA' }],
      answers: [],
    });

    expect(component.phase()).toBe(component.Phase.CATEGORY);
    expect(component.secondsLeft()).toBe(10);
    expect(component.categoryVoteCounts()['MUSICA']).toBe(1);

    fixture.destroy();
  });

  it('riprende la domanda in corso con tabellone e tempo della rush', () => {
    const { component, fixture } = mount({
      phase: 'QUESTION',
      secondsLeft: 42,
      savedAt: Date.now(),
      chosenCategory: 'MUSICA',
      questions: QUESTIONS,
      index: 0,
      total: 2,
      scores: [{ playerName: 'Anna', score: 1 }, { playerName: 'Bruno', score: 0 }],
      votes: [],
      answers: [{ playerName: 'Anna', index: 1 }],
    });

    const question = component.question();
    expect(component.phase()).toBe(component.Phase.QUESTION);
    expect(question?.text).toBe('Capitale del Giappone?');
    expect(component.secondsLeft()).toBe(42);
    // Il tabellone salvato non viene azzerato dal refresh.
    expect(component.totals()).toEqual([
      { playerName: 'Bruno', score: 0 },
      { playerName: 'Anna', score: 1 },
    ]);

    fixture.destroy();
  });

  it('se tutti avevano risposto calcola l’esito una volta sola', () => {
    const { component, fixture } = mount({
      phase: 'QUESTION',
      secondsLeft: 40,
      savedAt: Date.now(),
      chosenCategory: 'MUSICA',
      questions: QUESTIONS,
      index: 0,
      total: 2,
      scores: [{ playerName: 'Anna', score: 1 }, { playerName: 'Bruno', score: 0 }],
      answers: [{ playerName: 'Anna', index: 1 }, { playerName: 'Bruno', index: 0 }],
    });

    expect(component.phase()).toBe(component.Phase.REVEAL);
    expect(component.totals()).toEqual([
      { playerName: 'Bruno', score: 0 },
      { playerName: 'Anna', score: 2 },
    ]);

    fixture.destroy();
  });

  it('riprende il reveal e passa alla domanda successiva', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount({
      phase: 'REVEAL',
      secondsLeft: 40,
      savedAt: Date.now(),
      chosenCategory: 'MUSICA',
      questions: QUESTIONS,
      index: 0,
      total: 2,
      scores: [{ playerName: 'Anna', score: 1 }],
      answers: [],
      reveal: {
        heading: 'RISPOSTA ESATTA: Tokyo',
        rows: [{ playerName: 'Anna', label: 'Tokyo', points: 1 }],
      },
      deltas: { Anna: 1 },
    });

    expect(component.phase()).toBe(component.Phase.REVEAL);
    expect(component.reveal()?.heading).toBe('RISPOSTA ESATTA: Tokyo');

    vi.advanceTimersByTime(1700);

    expect(component.phase()).toBe(component.Phase.QUESTION);
    expect(component.index()).toBe(1);
    expect(component.question()?.text).toBe('Chi ha dipinto la Gioconda?');

    vi.useRealTimers();
    fixture.destroy();
  });

  it('riprende il finale e paga il podio una volta sola', () => {
    vi.useFakeTimers();
    const { component, results, finished, fixture } = mount({
      phase: 'FINALE',
      secondsLeft: 4,
      savedAt: Date.now(),
      chosenCategory: 'MUSICA',
      questions: QUESTIONS,
      index: 1,
      total: 2,
      scores: [{ playerName: 'Bruno', score: 1 }, { playerName: 'Anna', score: 3 }],
      answers: [],
    });

    expect(component.phase()).toBe(component.Phase.FINALE);
    expect(results).toEqual([
      { playerName: 'Anna', score: 200 },
      { playerName: 'Bruno', score: 100 },
    ]);

    vi.advanceTimersByTime(4100);
    expect(finished).toHaveLength(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('salva il checkpoint quando parte la votazione', () => {
    vi.useFakeTimers();
    const { checkpoints, fixture } = mount();

    vi.advanceTimersByTime(2600);

    const state = checkpoints.at(-1);
    expect(state.phase).toBe('CATEGORY');
    expect(state.secondsLeft).toBe(15);
    expect(typeof state.savedAt).toBe('number');
    expect(state.votes).toEqual([]);

    vi.useRealTimers();
    fixture.destroy();
  });
});
