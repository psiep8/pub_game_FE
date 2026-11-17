import { TestBed } from '@angular/core/testing';
import { BiglieBonus } from './biglie-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../../shared/testing/test-doubles';
import { AudioService } from '../../../core/services/audio.service';

const MARBLES = [
  { id: 'fulmine', name: 'FULMINE', color: '#facc15', emoji: '⚡', speed: 10, accel: 6, grip: 3 },
  { id: 'scheggia', name: 'SCHEGGIA', color: '#fb7185', emoji: '🔥', speed: 8, accel: 9, grip: 3 },
];

const ROWS = [
  { playerName: 'Anna', marbleId: 'fulmine', position: 1, points: 150, total: 150 },
  { playerName: 'Bruno', marbleId: 'scheggia', position: 2, points: 100, total: 100 },
];

describe('BiglieBonus — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BiglieBonus],
      providers: [{ provide: WebSocketService, useClass: FakeWebSocketService }],
    }).compileComponents();
  });

  /** `document.hidden` è in sola lettura: la visibilità si finge qui. */
  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  }

  function mount(resume: any = null, roundIndex = 0) {
    const fixture = TestBed.createComponent(BiglieBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('roundMode', true);
    fixture.componentRef.setInput('roundIndex', roundIndex);
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

  it('salva il round appena parte', () => {
    vi.useFakeTimers();
    const { checkpoints, fixture } = mount();

    vi.advanceTimersByTime(800);

    const state = checkpoints.at(-1);
    expect(state.phase).toBe('INTRO');
    expect(state.raceIndex).toBe(0);
    // Il piano delle piste parte con l'intro: due piste e il seme che le ha scelte.
    expect(state.trackPlan).toHaveLength(2);
    expect(new Set(state.trackPlan).size).toBe(2);
    expect(state.trackSeed).toBeGreaterThan(0);
    expect(state.roundIndex).toBe(0);
    // L'ordine di scelta si sorteggia dopo l'intro.
    expect(state.pickOrder).toEqual([]);
    expect(state.assignments).toEqual([]);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('riprende la scelta della biglia dal giocatore giusto', () => {
    const { component, fixture } = mount({
      phase: 'PICK',
      secondsLeft: 10,
      savedAt: Date.now() - 3000,
      raceIndex: 0,
      pickOrder: ['Anna', 'Bruno'],
      pickCursor: 1,
      marbles: MARBLES,
      assignments: [['Anna', 'fulmine']],
      totals: [],
      standings: [],
      raceResult: null,
    });

    expect(component.phase()).toBe('PICK');
    expect(component.currentPlayer()).toBe('Bruno');
    expect(component.secondsLeft()).toBe(7);
    // La biglia già scelta resta assegnata ad Anna.
    expect(component.marbles().find((marble) => marble.id === 'fulmine')?.owner).toBe('Anna');

    fixture.destroy();
  });

  it('una gara già pagata non viene rigiocata né ripagata', () => {
    vi.useFakeTimers();
    const { component, results, fixture } = mount({
      phase: 'RACE_END',
      secondsLeft: 4,
      savedAt: Date.now(),
      raceIndex: 1,
      pickOrder: ['Anna', 'Bruno'],
      pickCursor: 2,
      marbles: MARBLES,
      assignments: [['Anna', 'fulmine'], ['Bruno', 'scheggia']],
      totals: [['Anna', 150], ['Bruno', 100]],
      standings: ROWS,
      raceResult: ROWS,
    });

    expect(component.phase()).toBe('RACE_END');
    expect(component.standings()).toEqual(ROWS);
    // I punti erano già in classifica: la ripresa non li rimanda alla TV.
    expect(results).toEqual([]);

    vi.advanceTimersByTime(4100);
    // Due gare per round: quella appena chiusa era l'ultima, si va alla finale.
    expect(component.phase()).toBe('FINALE');
    expect(component.raceIndex()).toBe(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('riprende le due piste salvate e le numera nella serata', () => {
    const { component, fixture } = mount(
      {
        phase: 'PICK',
        secondsLeft: 10,
        savedAt: Date.now(),
        raceIndex: 0,
        roundIndex: 21,
        trackSeed: 1234,
        trackPlan: ['magma', 'neve'],
        pickOrder: ['Anna', 'Bruno'],
        pickCursor: 0,
        marbles: MARBLES,
        assignments: [],
        totals: [],
        standings: [],
        raceResult: null,
      },
      21,
    );

    expect(component.roundTracks().map((track) => track.id)).toEqual(['magma', 'neve']);
    // Round 22, prima gara: è la terza della serata.
    expect(component.raceNumber()).toBe(3);

    // Il telefono legge lo stato pubblicato: stessa numerazione della TV.
    const ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    const published = ws.broadcasted
      .map((status) => status.body)
      .filter((body) => body?.action === 'BIGLIE_STATE')
      .at(-1);
    expect(published?.state.raceNumber).toBe(3);
    expect(published?.state.totalRaces).toBe(8);
    expect(published?.state.races).toBe(2);

    fixture.destroy();
  });

  it('riprende la classifica finale e chiude il round', () => {
    vi.useFakeTimers();
    const { component, results, finished, fixture } = mount({
      phase: 'FINALE',
      secondsLeft: 7,
      savedAt: Date.now(),
      raceIndex: 4,
      pickOrder: ['Anna', 'Bruno'],
      pickCursor: 2,
      marbles: MARBLES,
      assignments: [['Anna', 'fulmine'], ['Bruno', 'scheggia']],
      totals: [['Anna', 250], ['Bruno', 200]],
      standings: ROWS,
      raceResult: ROWS,
    });

    expect(component.phase()).toBe('FINALE');
    expect(component.standings()).toEqual(ROWS);
    expect(results).toEqual([]);

    vi.advanceTimersByTime(7100);
    expect(finished).toHaveLength(1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('ferma la corsa quando la TV va in secondo piano e la riprende senza salti', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    const audio = TestBed.inject(AudioService);
    const stopBed = vi.spyOn(audio, 'stopMarbleBed');
    const startBed = vi.spyOn(audio, 'startMarbleBed');
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(77 as any);

    // Gara già partita, loop in corso e rotolamento acceso.
    const internal = component as any;
    internal.phase.set('RACE');
    internal.countdownLeft = 0;
    internal.frame = 42;
    internal.lastFrame = 1_000_000;
    internal.physicsAccumulator = 120;

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    // TV in secondo piano: frame annullato e sottofondo spento.
    expect(cancel).toHaveBeenCalledWith(42);
    expect(internal.frame).toBe(0);
    expect(stopBed).toHaveBeenCalled();

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    // Al ritorno il primo frame vale dt 0: la biglia non salta avanti.
    expect(internal.lastFrame).toBe(0);
    expect(internal.physicsAccumulator).toBe(0);
    expect(startBed).toHaveBeenCalled();
    expect(internal.frame).toBe(77);

    delete (document as any).hidden;
    vi.restoreAllMocks();
    vi.useRealTimers();
    fixture.destroy();
  });

  it('la gara interrotta riparte senza perdere le gare già chiuse', () => {
    const { component, results, fixture } = mount({
      phase: 'RACE',
      secondsLeft: 20,
      savedAt: Date.now(),
      raceIndex: 1,
      pickOrder: ['Anna', 'Bruno'],
      pickCursor: 2,
      marbles: MARBLES,
      assignments: [['Anna', 'fulmine'], ['Bruno', 'scheggia']],
      totals: [['Anna', 150], ['Bruno', 100]],
      standings: ROWS,
      raceResult: null,
    });

    expect(component.phase()).toBe('RACE');
    // Seconda gara del round: si rigioca quella, non la prima già pagata.
    expect(component.raceIndex()).toBe(1);
    // Il tabellone delle gare precedenti resta, i punti non si rimandano.
    expect(component.standings()).toEqual(ROWS);
    expect(results).toEqual([]);

    fixture.destroy();
  });
});
