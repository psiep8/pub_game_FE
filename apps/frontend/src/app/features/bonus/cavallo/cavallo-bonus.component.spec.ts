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

    const checkpoints: any[] = [];
    const finished: number[] = [];
    component.checkpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));
    component.finished.subscribe(() => finished.push(1));

    fixture.detectChanges();
    return { fixture, component, checkpoints, finished };
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

  it('R-01: i voti dei telefoni fanno partire la domanda e chiudono la sfida', () => {
    const { component, fixture, finished } = mount({
      phase: 'CATEGORY',
      secondsLeft: 15,
      savedAt: Date.now(),
      chosenCategory: '',
      questions: [],
      index: 0,
      total: 2,
      scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
      votes: [],
      answers: [],
    });
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    // I due telefoni votano la stessa categoria: la sfida parte da sola.
    ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'CATEGORY', playerName: 'Anna', value: 'MUSICA' });
    ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'CATEGORY', playerName: 'Bruno', value: 'MUSICA' });
    fixture.detectChanges();

    expect(component.chosenCategory()).toBe('MUSICA');
    expect(component.phase()).toBe(component.Phase.QUESTION);
    expect(component.questionFor('Anna')?.text).toContain('MUSICA');

    // Le risposte arrivano al server TV: ogni telefono ha la sua.
    ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Anna', value: 0 });
    ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Bruno', value: 1 });
    fixture.detectChanges();
    expect(component.phase()).toBe(component.Phase.REVEAL);
    expect(finished.length).toBe(0);

    fixture.destroy();
  });

  it('R-01: l’ultima domanda chiude la sfida e manda finished alla TV', () => {
    vi.useFakeTimers();
    try {
      const { component, fixture, finished } = mount({
        phase: 'QUESTION',
        secondsLeft: 30,
        savedAt: Date.now(),
        chosenCategory: 'MUSICA',
        questions: [QUESTIONS[0]],
        index: 0,
        total: 1,
        scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
        votes: [],
        answers: [],
      });
      const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

      ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Anna', value: 0 });
      ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Bruno', value: 1 });
      fixture.detectChanges();
      expect(component.phase()).toBe(component.Phase.REVEAL);

      vi.advanceTimersByTime(1_700);
      expect(component.phase()).toBe(component.Phase.FINALE);

      vi.advanceTimersByTime(8_000);
      expect(finished.length).toBe(1);

      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
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

    const question = component.questionFor('Anna');
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
    expect(component.reveals()['Anna']?.heading).toBe('RISPOSTA ESATTA: Tokyo');

    vi.advanceTimersByTime(1700);

    expect(component.phase()).toBe(component.Phase.QUESTION);
    expect(component.index()).toBe(1);
    expect(component.questionFor('Anna')?.text).toBe('Chi ha dipinto la Gioconda?');

    vi.useRealTimers();
    fixture.destroy();
  });

  it('riprende il finale senza assegnare punti o premi in app', () => {
    vi.useFakeTimers();
    const { component, finished, fixture } = mount({
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

    vi.advanceTimersByTime(4100);
    expect(finished).toHaveLength(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('N-04: ogni squadra riceve la propria domanda e il tabellone resta uno', () => {
    const { component, fixture } = mount({
      phase: 'QUESTION',
      secondsLeft: 40,
      savedAt: Date.now(),
      chosenCategory: 'MUSICA',
      questionsByTeam: {
        Anna: [QUESTIONS[0]],
        Bruno: [QUESTIONS[1]],
      },
      index: 0,
      total: 1,
      scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
      votes: [],
      answers: [],
    });

    expect(component.questionFor('Anna')?.text).toBe('Capitale del Giappone?');
    expect(component.questionFor('Bruno')?.text).toBe('Chi ha dipinto la Gioconda?');
    // Un solo tabellone per tutte le squadre.
    expect(component.totals()).toHaveLength(2);
    expect(component.questionFor('Carla')).toBeNull();

    fixture.destroy();
  });

  it('N-04: ogni squadra risponde alla sua domanda e il tabellone somma le giuste', () => {
    vi.useFakeTimers();
    try {
      const { component, fixture } = mount({
        phase: 'QUESTION',
        secondsLeft: 40,
        savedAt: Date.now(),
        chosenCategory: 'MUSICA',
        questionsByTeam: {
          Anna: [QUESTIONS[0]],
          Bruno: [QUESTIONS[1]],
        },
        index: 0,
        total: 1,
        scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
        votes: [],
        answers: [],
      });
      const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

      // Tokyo è la risposta di Anna; Leonardo quella di Bruno.
      ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Anna', value: 1 });
      ws.status$.next({ action: 'CAVALLO_ACTION', kind: 'ANSWER', playerName: 'Bruno', value: 0 });
      fixture.detectChanges();

      expect(component.phase()).toBe(component.Phase.REVEAL);
      expect(component.totals()).toEqual([
        { playerName: 'Anna', score: 1 },
        { playerName: 'Bruno', score: 1 },
      ]);
      expect(component.reveals()['Anna']?.heading).toContain('Tokyo');
      expect(component.reveals()['Bruno']?.heading).toContain('Leonardo');

      const published = ws.broadcasted.at(-1)?.body?.state;
      expect(published.questions.Anna.text).toBe('Capitale del Giappone?');
      expect(published.questions.Bruno.text).toBe('Chi ha dipinto la Gioconda?');

      vi.advanceTimersByTime(1_700);
      expect(component.phase()).toBe(component.Phase.FINALE);

      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('la pausa della TV ferma la votazione della categoria', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    vi.advanceTimersByTime(2600);
    expect(component.phase()).toBe(component.Phase.CATEGORY);
    const before = component.secondsLeft();

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    expect(component.secondsLeft()).toBe(before);
    expect(component.phase()).toBe(component.Phase.CATEGORY);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    expect(component.secondsLeft()).toBe(before - 1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('in pausa la domanda non si rivela da sola', () => {
    vi.useFakeTimers();
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

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(8000);

    // La domanda resta aperta: l'attesa del reveal è ferma con la pausa.
    expect(component.phase()).toBe(component.Phase.QUESTION);
    expect(component.secondsLeft()).toBe(42);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(7000);
    expect(component.phase()).toBe(component.Phase.REVEAL);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa durante il finale non chiude il bonus a schermo fermo', () => {
    vi.useFakeTimers();
    const { finished, fixture } = mount({
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

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(10000);
    expect(finished).toEqual([]);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(4100);
    expect(finished).toHaveLength(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa respinge la scelta della categoria arrivata dal telefono', () => {
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    const { component, fixture } = mount({
      phase: 'CATEGORY',
      secondsLeft: 15,
      savedAt: Date.now(),
      chosenCategory: '',
      questions: [],
      index: 0,
      total: 8,
      scores: [{ playerName: 'Anna', score: 0 }, { playerName: 'Bruno', score: 0 }],
      votes: [],
      answers: [],
    });
    expect(component.phase()).toBe(component.Phase.CATEGORY);

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    ws.status$.next({ action: 'CAVALLO_ACTION', playerName: 'Anna', kind: 'CATEGORY', value: 'MUSICA' });
    fixture.detectChanges();

    // A sala ferma la scelta non entra nelle votazioni della categoria.
    expect(component.categoryVoteCounts()['MUSICA'] ?? 0).toBe(0);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    ws.status$.next({ action: 'CAVALLO_ACTION', playerName: 'Anna', kind: 'CATEGORY', value: 'MUSICA' });
    fixture.detectChanges();

    // Alla ripresa la stessa scelta vale come sempre.
    expect(component.categoryVoteCounts()['MUSICA']).toBe(1);

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
