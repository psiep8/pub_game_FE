import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { Biglie } from './biglie.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../../shared/testing/test-doubles';
import { AudioService } from '../../../core/services/audio.service';
import { simulateRace, simulationInteractions } from './race-simulation';
import {
  interactionStepCount,
  movingObstacle,
  PERNI_FACTOR,
  resetInteractionStepCount,
  type TrackFeature,
} from './track-features';

/**
 * Il sorgente dei due file da controllare, letto dal disco: il test guarda i
 * punti di chiamata, non solo le funzioni che chiama direttamente.
 */
const sourceOf = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), 'utf8');
const componentSource = sourceOf('./biglie.component.ts');
const simulationSource = sourceOf('./race-simulation.ts');

const MARBLES = [
  { id: 'fulmine', name: 'FULMINE', color: '#facc15', emoji: '⚡', speed: 10, accel: 6, grip: 3 },
  { id: 'scheggia', name: 'SCHEGGIA', color: '#fb7185', emoji: '🔥', speed: 8, accel: 9, grip: 3 },
];

const ROWS = [
  { playerName: 'Anna', marbleId: 'fulmine', position: 1, points: 150, total: 150 },
  { playerName: 'Bruno', marbleId: 'scheggia', position: 2, points: 100, total: 100 },
];

describe('Biglie — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Biglie],
      providers: [{ provide: WebSocketService, useClass: FakeWebSocketService }],
    }).compileComponents();
  });

  /** `document.hidden` è in sola lettura: la visibilità si finge qui. */
  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  }

  function mount(resume: any = null, roundIndex = 0) {
    const fixture = TestBed.createComponent(Biglie);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
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

  it('applica correnti, rampe e perni: è la TV a farlo, non solo la simulazione', () => {
    const { component, fixture } = mount();
    const features: TrackFeature[] = [
      { id: 'corrente', kind: 'corrente', progress: 0.5, span: 0.05, side: 1, strength: 1, phase: 0 },
      { id: 'attrito', kind: 'attrito', progress: 0.5, span: 0.05, side: 1, strength: 1, phase: 0 },
      { id: 'rampa', kind: 'rampa', progress: 0.6, span: 0.05, side: 1, strength: 1, phase: 0 },
      { id: 'perni', kind: 'perni', progress: 0.7, span: 0.05, side: 1, strength: 1, phase: 0 },
    ];
    component['features'] = features;
    component['raceElapsed'] = 10;
    const marble = {
      bumped: new Set<string>(),
      speed: 4,
      boostUntil: 0,
      stunUntil: 0,
      recoverUntil: 0,
    } as any;

    // Corrente e attrito: spinta di lato e bersaglio abbassato.
    const inCurrent = component['applyFeatures'](marble, 0.5, 4, 0, 80);
    expect(inCurrent.target).toBeLessThan(4);
    expect(inCurrent.lateral).toBeGreaterThan(0);
    expect(inCurrent.hit).toBeNull();

    // Rampa: bersaglio più alto e momento di gloria, una volta sola.
    const onRamp = component['applyFeatures'](marble, 0.6, 4, 0, 80);
    expect(onRamp.hit?.kind).toBe('rampa');
    expect(onRamp.target).toBeGreaterThan(4);
    expect(marble.boostUntil).toBeCloseTo(10.9, 5);

    // Perni: la biglia perde velocità e li passa una volta sola.
    const onPins = component['applyFeatures'](marble, 0.7, 4, 0, 80);
    expect(onPins.hit?.kind).toBe('perni');
    expect(onPins.along).toBeCloseTo(PERNI_FACTOR, 6);
    expect(marble.bumped.has('perni')).toBe(true);
    expect(component['applyFeatures'](marble, 0.7, 4, 0, 80).hit).toBeNull();

    fixture.destroy();
  });

  it('TV e simulazione passano dallo stesso passo di interazioni, nello stesso ordine', () => {
    const { component, fixture } = mount();
    const barra: TrackFeature = {
      id: 'barra-prova',
      kind: 'barra',
      progress: 0.52,
      span: 0.012,
      side: 1,
      strength: 1,
      phase: 0,
    };
    const perni: TrackFeature = {
      id: 'perni',
      kind: 'perni',
      progress: 0.52,
      span: 0.02,
      side: 1,
      strength: 1,
      phase: 0,
    };
    const features = [perni, barra];
    component['features'] = features;

    const start = () => ({
      bumped: new Set<string>(),
      speed: 4,
      boostUntil: 0,
      stunUntil: 0,
      recoverUntil: 0,
    });
    const tv = start();
    const sim = start();

    // Otto secondi di corsa sul passaggio dell'ostacolo: la biglia punta al
    // centro della barra, quindi la prende appena è lì.
    for (let step = 0; step < 480; step++) {
      const elapsed = 10 + step / 60;
      const pose = movingObstacle(barra, elapsed);
      const lateral = pose.blocking ? pose.center * 80 : 40;
      component['raceElapsed'] = elapsed;

      const fromTv = component['applyFeatures'](tv as any, 0.52, 4, lateral, 80);
      const fromSim = simulationInteractions(
        features,
        { progress: 0.52, elapsed, lateral, halfLane: 80 },
        4,
        sim,
      );

      // Stesso passo: bersaglio, spinta, colpo e ostacolo preso coincidono.
      expect(fromSim.target).toBe(fromTv.target);
      expect(fromSim.lateral).toBe(fromTv.lateral);
      expect(fromSim.lateralKick).toBe(fromTv.lateralKick);
      expect(fromSim.hit?.id).toBe(fromTv.hit?.id);
      expect(fromSim.obstacles.map((obstacle) => obstacle.id)).toEqual(
        fromTv.obstacles.map((obstacle) => obstacle.id),
      );

      // E lo applicano nello stesso punto: dopo il passo di accelerazione.
      tv.speed *= fromTv.along;
      sim.speed *= fromSim.along;
      expect(sim.speed).toBe(tv.speed);
      expect(sim.boostUntil).toBe(tv.boostUntil);
      expect(sim.stunUntil).toBe(tv.stunUntil);
      expect(sim.recoverUntil).toBe(tv.recoverUntil);
      expect([...sim.bumped]).toEqual([...tv.bumped]);
    }

    // L'ordine è quello fissato: prima i perni, poi la barra, mai il contrario.
    expect(tv.bumped.has('perni')).toBe(true);
    expect(tv.bumped.has('barra-prova@5')).toBe(true);

    fixture.destroy();
  });

  it('nessuna delle due corse può girare senza il passo condiviso', () => {
    const { component, fixture } = mount();

    // La TV entra nel passo da un punto solo: `applyFeatures`, che a sua volta
    // è `applyInteractions`. Il contatore lo dimostra sul codice che gira.
    component['features'] = [];
    component['raceElapsed'] = 0;
    resetInteractionStepCount();
    component['applyFeatures'](
      { bumped: new Set<string>(), boostUntil: 0, stunUntil: 0, recoverUntil: 0 } as any,
      0.5,
      4,
      0,
      80,
    );
    expect(interactionStepCount()).toBe(1);

    // La corsa headless, intera, passa dallo stesso punto migliaia di volte.
    resetInteractionStepCount();
    simulateRace({ trackId: 'sabbia', seed: 1000003 });
    expect(interactionStepCount()).toBeGreaterThan(1000);

    // Il contatore non dice chi chiama, quindi si guarda il punto di chiamata:
    // se TV o simulazione tornassero a farsi i conti in casa, il test muore qui.
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const body = (source: string, from: string): string => {
      const start = source.indexOf(from);
      expect(start, `manca "${from}"`).toBeGreaterThanOrEqual(0);
      const next = source.indexOf('\n  private ', start + from.length);
      return source.slice(start, next > start ? next : source.length);
    };

    // La TV applica il passo dentro il giro di fisica, una volta per biglia.
    const tvStep = body(stripComments(componentSource), 'private stepPhysics(');
    expect(tvStep.match(/this\.applyFeatures\(/g)?.length).toBe(1);
    expect(tvStep).not.toContain('applyInteractions(');

    // La simulazione lo applica nel suo ciclo, e solo attraverso il suo ingresso.
    const simulation = stripComments(simulationSource);
    const simLoop = simulation.slice(simulation.indexOf('while (elapsed < maxSeconds'));
    expect(simLoop.match(/simulationInteractions\(/g)?.length).toBe(1);
    expect(simLoop).not.toContain('applyInteractions(');

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

  it('la pausa della TV ferma il cronometro delle fasi', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    vi.advanceTimersByTime(800);
    const before = component.secondsLeft();
    expect(component.phase()).toBe('INTRO');
    expect(before).toBeGreaterThan(0);

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    // La sala aspetta: il conto alla rovescia dell'intro non scende.
    expect(component.secondsLeft()).toBe(before);
    expect(component.phase()).toBe('INTRO');

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);

    // Alla ripresa riparte da dove era, un secondo alla volta.
    expect(component.secondsLeft()).toBe(before - 1);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa della TV ferma la corsa e non paga i punti a schermo fermo', () => {
    vi.useFakeTimers();
    const { component, results, fixture } = mount();
    const audio = TestBed.inject(AudioService);
    const stopBed = vi.spyOn(audio, 'stopMarbleBed').mockImplementation(() => {});
    const applause = vi.spyOn(audio, 'playApplause').mockImplementation(() => {});
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(99 as any);

    const internal = component as any;
    internal.phase.set('RACE');
    internal.countdownLeft = 0;
    internal.frame = 42;
    internal.lastFrame = 1_000_000;
    internal.physicsAccumulator = 120;

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();

    // Loop annullato e rotolamento spento: la fisica non avanza più.
    expect(cancel).toHaveBeenCalledWith(42);
    expect(internal.frame).toBe(0);
    expect(stopBed).toHaveBeenCalled();

    // Mezzo minuto di pausa non fa arrivare nessuno: niente applausi, niente punti.
    vi.advanceTimersByTime(30000);
    expect(applause).not.toHaveBeenCalled();
    expect(results).toEqual([]);
    expect(component.phase()).toBe('RACE');

    vi.restoreAllMocks();
    vi.useRealTimers();
    fixture.destroy();
  });

  it('alla ripresa la corsa riparte dallo stesso istante', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    const audio = TestBed.inject(AudioService);
    vi.spyOn(audio, 'stopMarbleBed').mockImplementation(() => {});
    const startBed = vi.spyOn(audio, 'startMarbleBed').mockImplementation(() => {});
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(123 as any);

    const internal = component as any;
    internal.phase.set('RACE');
    internal.countdownLeft = 0;
    internal.frame = 42;

    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();

    // Primo frame a dt 0: nessun salto di tempo al ritorno.
    expect(internal.lastFrame).toBe(0);
    expect(internal.physicsAccumulator).toBe(0);
    expect(startBed).toHaveBeenCalled();
    expect(raf).toHaveBeenCalled();
    expect(internal.frame).toBe(123);

    vi.restoreAllMocks();
    vi.useRealTimers();
    fixture.destroy();
  });

  it('la corsa non riparte se resta la pausa o la scheda è nascosta', () => {
    vi.useFakeTimers();
    const { component, fixture } = mount();
    const audio = TestBed.inject(AudioService);
    vi.spyOn(audio, 'stopMarbleBed').mockImplementation(() => {});
    const startBed = vi.spyOn(audio, 'startMarbleBed').mockImplementation(() => {});
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(321 as any);

    const internal = component as any;
    internal.phase.set('RACE');
    internal.countdownLeft = 0;
    internal.frame = 42;

    // Scheda nascosta con la gara in corso: il loop si ferma.
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(cancel).toHaveBeenCalledWith(42);
    expect(internal.frame).toBe(0);

    // La pausa arriva mentre la scheda è nascosta e poi finisce: la scheda
    // nascosta da sola basta a tenere la corsa ferma.
    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    expect(internal.suspended).toBe(true);
    expect(internal.frame).toBe(0);
    expect(startBed).not.toHaveBeenCalled();

    // Tornano visibili scheda e pausa: solo ora la corsa riparte, da dt 0.
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(internal.suspended).toBe(false);
    expect(internal.lastFrame).toBe(0);
    expect(internal.physicsAccumulator).toBe(0);
    expect(startBed).toHaveBeenCalled();
    expect(internal.frame).toBe(321);

    // Ora è la pausa a restare: la scheda torna visibile ma la gara non riparte.
    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(internal.suspended).toBe(true);
    expect(internal.frame).toBe(0);
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(internal.suspended).toBe(true);
    expect(internal.frame).toBe(0);
    expect(startBed).toHaveBeenCalledTimes(1);

    // Finita la pausa, con la scheda visibile, la corsa riparte.
    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    expect(internal.suspended).toBe(false);
    expect(internal.frame).toBe(321);
    expect(startBed).toHaveBeenCalledTimes(2);

    delete (document as any).hidden;
    vi.restoreAllMocks();
    vi.useRealTimers();
    fixture.destroy();
  });

  it('la pausa durante la finale non chiude il round a schermo fermo', () => {
    vi.useFakeTimers();
    const { finished, fixture } = mount({
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

  it('paga i primi quattro e toglie agli ultimi quattro', () => {
    vi.useFakeTimers();
    const { component, results, fixture } = mount();
    const audio = TestBed.inject(AudioService);
    vi.spyOn(audio, 'stopMarbleBed').mockImplementation(() => {});
    vi.spyOn(audio, 'playApplause').mockImplementation(() => {});

    const names = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gina', 'Ugo'];
    const internal = component as any;
    internal.raceMarbles = names.map((playerName, index) => ({
      playerName,
      marbleId: MARBLES[index % MARBLES.length].id,
      x: 100 - index,
      v: 0,
      body: null,
      finished: true,
      position: index + 1,
      trail: [],
      spine: 0,
      bumped: new Set<string>(),
      slowUntil: 0,
      boostUntil: 0,
      speed: 0,
      stunUntil: 0,
      recoverUntil: 0,
      stuckFor: 0,
      bestProgress: 0,
      line: {},
      drama: {},
    }));

    internal.endRace();

    const rows = component.raceResult() ?? [];
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.map((row) => row.points)).toEqual([150, 100, 60, 30, -30, -60, -100, -150]);
    // I punti negativi arrivano davvero alla TV: senza l'emit resterebbero a zero.
    expect(results).toContainEqual({ playerName: 'Elena', score: -30 });
    expect(results).toContainEqual({ playerName: 'Ugo', score: -150 });
    expect(results).toHaveLength(8);
    // Anche la classifica del round somma i piazzamenti negativi.
    expect(component.standings().at(-1)?.total).toBe(-150);

    vi.useRealTimers();
    fixture.destroy();
  });

  it('scrive i punti col segno, anche quando tolgono', () => {
    const { component, fixture } = mount();

    expect(component.signedPoints(150)).toBe('+150');
    expect(component.signedPoints(-30)).toBe('−30');
    expect(component.signedPoints(0)).toBe('0');

    fixture.destroy();
  });
});
