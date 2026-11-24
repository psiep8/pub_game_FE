import { TestBed } from '@angular/core/testing';
import { CasinoBonus } from './casino-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { AudioService } from '../../../core/services/audio.service';
import { FakeAudioService, FakeWebSocketService } from '../../../shared/testing/test-doubles';

describe('CasinoBonus — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CasinoBonus],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: AudioService, useClass: FakeAudioService },
      ],
    }).compileComponents();
  });

  function mount(resume: any) {
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('variant', 'COLOR');
    fixture.componentRef.setInput('resume', resume);

    const results: any[] = [];
    const finished: number[] = [];
    component.result.subscribe((result) => results.push(result));
    component.finished.subscribe(() => finished.push(1));

    fixture.detectChanges();
    return { fixture, component, results, finished };
  }

  it('riapre il voto con i voti già dati e il tempo che resta', () => {
    const { fixture, component } = mount({
      votes: [{ playerName: 'Anna', choice: 'ROSSO' }],
      scores: [{ playerName: 'Anna', score: 100 }],
      secondsLeft: 8,
      savedAt: Date.now() - 3000,
      winner: null,
    });

    expect(component.phase()).toBe(component.Phase.PICK);
    expect(component.secondsLeft()).toBe(5);
    expect(component.options()).toEqual(['NERO', 'ROSSO']);
    expect(component.votesView()).toEqual([{ playerName: 'Anna', choice: 'ROSSO' }]);
    expect(component.totals()).toEqual([{ playerName: 'Anna', score: 100 }]);

    fixture.destroy();
  });

  it('scarta i voti di chi non gioca o su opzioni che non esistono', () => {
    const { fixture, component } = mount({
      votes: [
        { playerName: 'Carla', choice: 'ROSSO' },
        { playerName: 'Bruno', choice: 'VERDE' },
      ],
      scores: [],
      secondsLeft: 10,
      savedAt: Date.now(),
      winner: null,
    });

    expect(component.votesView()).toEqual([]);
    fixture.destroy();
  });

  it('la pausa della TV ferma il voto e non chiude la manche', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount(null);
    vi.advanceTimersByTime(2600);
    expect(component.phase()).toBe(component.Phase.PICK);
    const before = component.secondsLeft();

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    // La sala aspetta: il voto non scende e la ruota non parte.
    expect(component.secondsLeft()).toBe(before);
    expect(component.phase()).toBe(component.Phase.PICK);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);

    // Alla ripresa riparte da dove era, un secondo alla volta.
    expect(component.secondsLeft()).toBe(before - 1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa respinge la puntata arrivata dal telefono', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount(null);
    vi.advanceTimersByTime(2600);
    expect(component.phase()).toBe(component.Phase.PICK);
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    ws.status$.next({ action: 'CASINO_ACTION', playerName: 'Anna', manche: 1, choice: 'ROSSO' });
    fixture.detectChanges();
    // A sala ferma la puntata non entra nel tabellone.
    expect(component.votesView()).toEqual([]);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    ws.status$.next({ action: 'CASINO_ACTION', playerName: 'Anna', manche: 1, choice: 'ROSSO' });
    fixture.detectChanges();
    // Alla ripresa la stessa puntata vale come sempre.
    expect(component.votesView()).toEqual([{ playerName: 'Anna', choice: 'ROSSO' }]);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa durante la finale non chiude il bonus a schermo fermo', () => {
    vi.useFakeTimers();
    const { component, finished, fixture } = mount(null);

    (component as any).finale();
    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(10000);
    expect(finished).toEqual([]);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(7100);
    expect(finished).toHaveLength(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa congela il giro della ruota e lo riarma alla ripresa', () => {
    const { component, fixture } = mount(null);
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const resumeSpin = vi.fn();
    const internal = component as any;
    internal.frame = 42;
    internal.spinResume = resumeSpin;

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(internal.frame).toBeUndefined();

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    expect(resumeSpin).toHaveBeenCalledTimes(1);

    cancel.mockRestore();
    fixture.destroy();
  });

  it('il numero secco fa tre girate e non conosce la fase di rigiro', () => {
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna']);
    fixture.componentRef.setInput('variant', 'NUMBER');
    fixture.componentRef.setInput('resume', {
      votes: [],
      scores: [],
      secondsLeft: 10,
      savedAt: Date.now(),
      winner: null,
    });

    fixture.detectChanges();

    expect(component.manches[0].spins).toBe(3);
    expect(component.rounds).toHaveLength(3);
    expect((component.Phase as any).RESPIN).toBeUndefined();

    fixture.destroy();
  });

  it('il numero secco paga 1000 una volta sola anche se il numero esce due volte', () => {
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna']);
    fixture.componentRef.setInput('variant', 'NUMBER');
    fixture.componentRef.setInput('resume', {
      votes: [{ playerName: 'Anna', choice: '17' }],
      scores: [],
      secondsLeft: 10,
      savedAt: Date.now(),
      winner: null,
    });
    fixture.detectChanges();

    const addPoints = vi.spyOn(component as any, 'addPoints');
    (component as any).showReveal(17);
    expect(addPoints).toHaveBeenCalledWith('Anna', 1000);

    // Esce di nuovo in una girata successiva: non paga il doppio.
    (component as any).showReveal(17);
    expect(addPoints).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('la manche gira una volta sola anche se nessuno becca il numero', async () => {
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna']);
    fixture.componentRef.setInput('variant', 'NUMBER');
    fixture.componentRef.setInput('resume', {
      votes: [{ playerName: 'Anna', choice: '17' }],
      scores: [],
      secondsLeft: 10,
      savedAt: Date.now(),
      winner: null,
    });
    fixture.detectChanges();
    const spinOnce = vi.spyOn(component as any, 'spinOnce').mockResolvedValue(undefined);
    vi.spyOn(component as any, 'showReveal').mockImplementation(() => undefined);

    await (component as any).spinManche();

    expect(spinOnce).toHaveBeenCalledTimes(1);
    expect(component.phase()).not.toBe('RESPIN');
    fixture.destroy();
  });

  it('senza tempo rimasto va diretto alla ruota', () => {
    // La ruota vera usa Matter: qui interessa solo che la manche riparta.
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('variant', 'COLOR');
    fixture.componentRef.setInput('resume', {
      votes: [{ playerName: 'Anna', choice: 'NERO' }],
      scores: [],
      secondsLeft: 2,
      savedAt: Date.now() - 60_000,
      winner: null,
    });
    const spin = vi.spyOn(component as any, 'spinManche').mockResolvedValue(undefined);

    fixture.detectChanges();

    // Il voto non si riapre: la manche era già scaduta, la ruota riparte.
    expect(spin).toHaveBeenCalled();
    expect(component.votesView()).toEqual([{ playerName: 'Anna', choice: 'NERO' }]);
    fixture.destroy();
  });
});
