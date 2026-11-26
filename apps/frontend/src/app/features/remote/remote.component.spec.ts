import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RemoteComponent } from './remote.component';
import { GameService } from '../../core/services/game.service';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { AudioService } from '../../core/services/audio.service';
import { FakeAudioService, FakeGameService, FakeSwUpdate, FakeWebSocketService } from '../../shared/testing/test-doubles';
import { FakeReliabilityService } from '../../shared/testing/test-doubles';
import { ReliabilityService } from '../../core/services/reliability.service';
import { ButtonTestService } from '../../core/services/button-test.service';
import { FakeButtonTestService } from '../../shared/testing/fake-button-test.service';
import { PlayerStatus } from '../../shared/enums/player-status';

describe('RemoteComponent', () => {
  let component: RemoteComponent;
  let fixture: ComponentFixture<RemoteComponent>;
  let ws: FakeWebSocketService;
  let reliability: FakeReliabilityService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RemoteComponent],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: ReliabilityService, useClass: FakeReliabilityService as any },
        { provide: GameService, useClass: FakeGameService },
        { provide: AudioService, useClass: FakeAudioService },
        { provide: SwUpdate, useClass: FakeSwUpdate },
        { provide: ButtonTestService, useClass: FakeButtonTestService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    reliability = TestBed.inject(ReliabilityService) as unknown as FakeReliabilityService;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Indovina chi: ogni nuova manche riarma il pulsante PRENOTATI', () => {
    ws.status$.next({
      action: 'SHOW_QUESTION', type: 'IMAGE_BLUR', round: 7, manche: 1,
      payload: JSON.stringify({ manche: 1, mancheTotal: 3, categoryLabel: 'Musica' }),
    });
    expect(component.imageManche()).toBe(1);
    expect(component.hasAnswered()).toBe(false);

    component.hasAnswered.set(true);
    ws.status$.next({
      action: 'SHOW_QUESTION', type: 'IMAGE_BLUR', round: 7, manche: 2,
      payload: JSON.stringify({ manche: 2, mancheTotal: 3, categoryLabel: 'Sport, Cinema, TV, Spettacolo' }),
    });

    expect(component.imageManche()).toBe(2);
    expect(component.hasAnswered()).toBe(false);
  });

  it('ordina le corsie live: prima chi è arrivato, poi chi ha più strada', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({
      action: 'BIGLIE_STATE',
      state: {
        phase: 'RACE',
        raceIndex: 0,
        totalRaces: 8,
        secondsLeft: 12,
        marbles: [
          { id: 'fulmine', name: 'FULMINE', color: '#ffc53d', emoji: '⚡', owner: 'Anna' },
          { id: 'scheggia', name: 'SCHEGGIA', color: '#ff4d2e', emoji: '🔥', owner: 'Bruno' },
          { id: 'ombra', name: 'OMBRA', color: '#2f5bff', emoji: '🌑', owner: 'Carla' },
        ],
        lanes: [
          { playerName: 'Anna', marbleId: 'fulmine', progress: 12, finished: false, position: null },
          { playerName: 'Bruno', marbleId: 'scheggia', progress: 88, finished: false, position: null },
          { playerName: 'Carla', marbleId: 'ombra', progress: 100, finished: true, position: 1 },
        ],
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = Array.from(fixture.nativeElement.querySelectorAll('.biglie-live-row')) as HTMLElement[];
    expect(rows.map((row) => row.querySelector('.biglie-live-rname')?.textContent?.trim()))
      .toEqual(['Carla', 'Bruno', 'Anna']);
    // Chi è arrivato mostra il piazzamento, gli altri la strada fatta.
    expect(rows[0].querySelector('.biglie-live-rpct')?.textContent).toContain('1°');
    expect(rows[2].querySelector('.biglie-live-rpct')?.textContent).toContain('12%');
    // La propria riga è in evidenza, in terza posizione, con la sua biglia.
    expect(rows[2].classList).toContain('mine');
    expect(fixture.nativeElement.querySelector('.biglie-live-pos b')?.textContent).toContain('3');
    expect(fixture.nativeElement.querySelector('.biglie-live-name b')?.textContent).toContain('FULMINE');
  });

  it('non anticipa il nome del gioco nell’intestazione, nemmeno dopo il riallineamento', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header-round').textContent).not.toContain('Quiz');

    reliability.syncState$.next({
      hasState: true,
      roundType: 'TIMELINE',
      roundKey: 'g1-r1',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: { type: 'TIMELINE', roundKey: 'g1-r1', payload: { items: [] } },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header-round').textContent).not.toContain('Timeline');
  });

  it('chiede nome e foto prima del tutorial', async () => {
    // Prima del nome la prova dei pulsanti non esiste: si entra con nome e
    // foto, poi si prova il telefono, poi si aspetta la TV.
    expect(component.showButtonTest()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-button-test')).toBeNull();
    const enableTutorial = vi.spyOn(component.showButtonTest, 'set');

    component.tempNickname = 'Bianca';
    await component.setNickname();

    // Il tutorial si apre dallo stesso gesto che registra nome e foto, non
    // prima: nessun ingresso senza squadra.
    expect(component.nickname()).toBe('Bianca');
    expect(enableTutorial).toHaveBeenCalledWith(true);
  });

  it('mostra il proverbio e manda al server il finale scelto', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set('VOTING' as any);
    component.questionType.set('SPEED_RUSH');
    component.speedTask.set({
      taskId: 'sr-proverb-1',
      kind: 'proverb',
      prompt: "L'unione fa la...",
      options: ['FORZA', 'FESTA', 'FORTUNA'],
      answer: 'FORZA',
    });
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.speed-options button'),
    ) as HTMLButtonElement[];
    const forza = buttons.find((button) => button.textContent?.includes('FORZA'));
    expect(forza).toBeTruthy();
    forza!.click();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    expect(game.speedAnswers).toEqual([{ taskId: 'sr-proverb-1', answer: 'FORZA' }]);
  });

  it('mostra la regione della città e invia la scelta geografica', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set('VOTING' as any);
    component.questionType.set('SPEED_RUSH');
    component.speedTask.set({
      taskId: 'sr-geo-1',
      kind: 'geo',
      prompt: 'In che regione si trova «Roma»?',
      options: ['LAZIO', 'LOMBARDIA', 'TOSCANA'],
      answer: 'LAZIO',
    });
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.speed-options button'),
    ) as HTMLButtonElement[];
    const lazio = buttons.find((button) => button.textContent?.includes('LAZIO'));
    expect(lazio).toBeTruthy();
    lazio!.click();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    expect(game.speedAnswers).toEqual([{ taskId: 'sr-geo-1', answer: 'LAZIO' }]);
  });

  it('conta i tap e invia il traguardo al server', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set('VOTING' as any);
    component.questionType.set('SPEED_RUSH');
    component.speedTask.set({ taskId: 'sr-tap-1', kind: 'tap', target: 3, answer: '3' });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.speed-tap-btn') as HTMLButtonElement;
    button.click();
    button.click();
    button.click();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    expect(game.speedAnswers).toEqual([{ taskId: 'sr-tap-1', answer: '3' }]);
  });

  it('rimette la prova a schermo se l\'invio Speed Rush fallisce', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set('VOTING' as any);
    component.roundActive.set(true);
    component.questionType.set('SPEED_RUSH');

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'answerSpeedRush').mockReturnValue(throwError(() => new Error('offline')));
    component.speedTask.set({ taskId: 'sr-net', kind: 'math', text: '2 + 2', options: [4, 5, 6], answer: 4 } as any);

    component.speedPickMath(4);

    expect((component.speedTask() as any)?.taskId).toBe('sr-net');
    expect(reliability.lastError()).toContain('non registrata');
  });

  it('mostra le risposte Quiz anche se arriva solo QUIZ_STATE', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.questionType.set('BOMBA');
    component.gameState.set('WAITING' as any);

    ws.status$.next({ action: 'QUIZ_STATE', state: { manche: 1, mancheReveal: false } });

    expect(component.questionType()).toBe('QUIZ');
    expect(component.roundActive()).toBe(true);
    expect(component.gameState()).toBe('VOTING' as any);
    expect(component.quizManche()).toBe(1);
  });

  it('uno snapshot in ritardo non richiude la prima manche Quiz', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({
      action: 'QUIZ_STATE',
      roundStartId: 'round-1',
      state: { manche: 1, mancheReveal: false },
    });
    expect(component.gameState()).toBe(PlayerStatus.VOTING);

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'QUIZ',
      roundKey: 'g1-r0',
      roundStartId: 'round-1',
      roundIndex: 0,
      roundDeadlineAt: Date.now() + 60_000,
      announced: false,
      currentRound: { type: 'QUIZ', roundKey: 'g1-r0', payload: '{}' },
    });
    await fixture.whenStable();

    expect(component.questionType()).toBe('QUIZ');
    expect(component.quizManche()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
  });

  it('dopo un refresh usa il round del server per il contatore', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'QUIZ',
      roundKey: 'g1-r2',
      roundStartId: 'round-3',
      roundIndex: 2,
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: { type: 'QUIZ', roundKey: 'g1-r2', payload: '{}' },
    });
    await fixture.whenStable();

    expect(component.roundNumber()).toBe(3);
  });

  it('due telefoni scartano un annuncio Quiz recapitato dopo il round successivo', async () => {
    const second = TestBed.createComponent(RemoteComponent);
    const phoneB = second.componentInstance;
    second.detectChanges();
    await second.whenStable();
    for (const [phone, name] of [[component, 'Anna'], [phoneB, 'Bruno']] as const) {
      phone.tempNickname = name;
      await phone.setNickname();
      phone.closeButtonTest();
    }
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitQuizAnswer')
      .mockReturnValue(of({ manche: 1, isCorrect: true, points: 100 }));
    const announce = (action: string, roundStartId: string, roundStartedAt: number) => {
      ws.status$.next(action === 'QUIZ_STATE'
        ? { action, roundStartId, roundStartedAt, state: { manche: 2 } }
        : { action, type: 'QUIZ', roundStartId, roundStartedAt, payload: {} });
    };

    announce('SHOW_QUESTION', 'round-2', 2000);
    announce('START_VOTING', 'round-2', 2000);
    announce('QUIZ_STATE', 'round-2', 2000);
    // Accettati prima del cambio round, ma consegnati solo adesso.
    announce('QUIZ_STATE', 'round-1', 1000);
    announce('START_VOTING', 'round-1', 1000);
    announce('SHOW_QUESTION', 'round-1', 1000);

    for (const phone of [component, phoneB]) {
      expect(phone.quizManche()).toBe(2);
      expect(phone.questionType()).toBe('QUIZ');
      expect(phone.gameState()).toBe(PlayerStatus.VOTING);
    }

    component.sendVote(0);
    phoneB.sendVote(1);

    // Entrambi votano il round corrente, non quello dell'annuncio tardivo.
    expect(submit).toHaveBeenNthCalledWith(1, 1, 0, 1, 'round-2');
    expect(submit).toHaveBeenNthCalledWith(2, 1, 1, 1, 'round-2');
    second.destroy();
  });

  it.each([false, true])('il primo Quiz non eredita il voto del gioco precedente (annuncio: %s)', async (announced) => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.questionType.set('BOMBA');
    component.hasAnswered.set(true);
    component.answeredManche.set(1);
    component.selectedAnswer.set(2);
    if (announced) ws.status$.next({ action: 'SHOW_QUESTION', type: 'QUIZ' });

    ws.status$.next({ action: 'QUIZ_STATE', state: { manche: 1, mancheReveal: false } });

    expect(component.questionType()).toBe('QUIZ');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.hasAnswered()).toBe(false);
    expect(component.selectedAnswer()).toBeNull();
  });

  it('la ripetizione dello stato della stessa manche Quiz non riapre un voto già dato', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.questionType.set('QUIZ');
    component.hasAnswered.set(true);
    component.answeredManche.set(1);
    component.selectedAnswer.set(2);

    ws.status$.next({ action: 'QUIZ_STATE', state: { manche: 1, mancheReveal: false } });

    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
    expect(component.selectedAnswer()).toBe(2);
  });

  it('dice subito che la squadra è fuori quando prende una bomba', async () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({ action: 'SHOW_QUESTION', type: 'BOMBA', payload: '{}' });
    ws.status$.next({
      action: 'BOMBA_STATE',
      state: {
        type: 'BOMBA', active: true, paused: false, phase: 'TURN', prompt: 'Scegli',
        cells: [{ id: 1, label: 'A', used: true, pickedBy: 'Anna' }],
        players: ['Anna', 'Bruno'], eliminated: [], penalties: {},
        turn: 'Bruno', turnSeconds: 20, secondsLeft: 12,
        lastEvent: { seq: 2, kind: 'bomb', player: 'Anna', label: 'A' },
        you: { yourTurn: false, penalty: -200, out: true },
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('SEI FUORI');
    expect(text).toContain('-200');
    expect(audio.played).toContain('bomb-siren');
  });

  it('mostra il via sul telefono quando parte il Time Buzzer', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({ action: 'START_VOTING', type: 'TIME_BUZZER' });
    ws.status$.next({ action: 'TIME_BUZZER_START', manche: 1 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.buzzPhase()).toBe('running');
    expect(fixture.nativeElement.querySelector('.buzz-live')?.textContent).toContain('VIA!');
  });

  it('F-20: il tempo da memorizzare resta sul telefono durante il 3-2-1', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({ action: 'START_VOTING', type: 'TIME_BUZZER' });
    ws.status$.next({
      action: 'TIME_BUZZER_STATE',
      state: { manche: 1, total: 3, targetMs: 7340, phase: 'countdown' },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formatBuzzTarget()).toBe('07:34');
    expect(fixture.nativeElement.querySelector('.buzz-target-value')?.textContent).toContain('07:34');
  });

  it('F-22: lo scoppio accende lo schermo del telefono', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    component.questionType.set('BOMBA');
    component.gameState.set('VOTING' as any);
    (component as any).applyBombaState({
      active: true,
      phase: 'TURN',
      secondsLeft: 10,
      cells: [],
      you: { yourTurn: true },
      lastEvent: { seq: 1, kind: 'bomb', player: 'Anna' },
    });
    fixture.detectChanges();

    expect(component.bombaFlash()).toContain('BOOM');
    expect(fixture.nativeElement.querySelector('.bomba-boom-flash')).toBeTruthy();
  });

  it('F-21: durante la lettura il telefono mostra l’argomento e le caselle spente', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    component.questionType.set('BOMBA');
    component.gameState.set('VOTING' as any);
    component.bombaState.set({
      active: true,
      phase: 'READING',
      reading: true,
      prompt: 'Quali di queste città sono in Belgio?',
      secondsLeft: 30,
      cells: [{ id: 1, label: 'Bruxelles', used: false }],
      you: { yourTurn: true },
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Quali di queste città sono in Belgio?');
    const cell = fixture.nativeElement.querySelector('.bomba-cell') as HTMLButtonElement;
    expect(cell.disabled).toBe(true);
  });

  it('torna al setup quando la regia espelle la squadra', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set('VOTING' as any);

    ws.status$.next({ action: 'PLAYER_REMOVED', playerName: 'Anna' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.nickname()).toBeNull();
    expect(component.removedNotice()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('La regia ha rimosso');
    expect(localStorage.getItem('nickname')).toBeNull();
  });

  it('il reset TV riporta al setup e azzera il contatore del telefono', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.roundNumber.set(3);
    component.gameState.set(PlayerStatus.VOTING);
    component.roundActive.set(true);
    component.paused.set(true);

    ws.status$.next({ action: 'GAME_RESET', players: ['Anna'] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.nickname()).toBeNull();
    expect(component.resetNotice()).toBe(true);
    expect(component.removedNotice()).toBe(false);
    expect(component.roundNumber()).toBe(0);
    expect(component.paused()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(localStorage.getItem('nickname')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('La partita è stata resettata');
  });

  it('GAME_RESET non butta fuori una squadra che non è stata resettata', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();

    ws.status$.next({ action: 'GAME_RESET', players: ['Bruno'] });
    fixture.detectChanges();

    expect(component.nickname()).toBe('Anna');
    expect(component.resetNotice()).toBe(false);
  });

  it('ascolta i topic della partita attiva adottata, non quella di default', async () => {
    fixture.destroy();
    localStorage.clear();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'getActiveGame').mockReturnValue(of({ gameId: 12 }));
    ws.subscribedGames.length = 0;

    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(component.gameId()).toBe(12);
    expect(ws.subscribedGames.at(-1)).toBe(12);
  });

  it('ritenta se il server non risponde al primo colpo e adotta la serata vera', async () => {
    // Con molte schede aperte la prima richiesta può cadere: senza un nuovo
    // tentativo il telefono restava sulla partita 1 e mostrava il gioco vecchio
    // di quella serata mentre la TV era già su un'altra partita.
    fixture.destroy();
    localStorage.clear();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const active = vi.spyOn(game, 'getActiveGame')
      .mockReturnValueOnce(throwError(() => new Error('rete')))
      .mockReturnValueOnce(throwError(() => new Error('rete')))
      .mockReturnValue(of({ gameId: 12 }));
    ws.subscribedGames.length = 0;

    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const deadline = Date.now() + 4000;
    while (component.gameId() !== 12 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(component.gameId()).toBe(12);
    expect(active).toHaveBeenCalledTimes(3);
    expect(ws.subscribedGames.at(-1)).toBe(12);
  });


  it('rientra senza tutorial quando il server riprende la stessa sessione', async () => {
    fixture.destroy();
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.nickname()).toBe('Anna');
    expect(component.showButtonTest()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-button-test')).toBeNull();
  });

  it('mantiene il tutorial se il server crea una nuova sessione', async () => {
    fixture.destroy();
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(false);
    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.nickname()).toBe('Anna');
    expect(component.showButtonTest()).toBe(true);
  });

  it('con un doppio tocco invia una sola risposta Arena e non salta la domanda', () => {
    component.nickname.set('Anna');
    component.roundActive.set(true);
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pending = new Subject<any>();
    const answer = vi.spyOn(game, 'answerArenaQuestion').mockReturnValue(pending.asObservable());

    component.sendArenaAnswer(0);
    component.sendArenaAnswer(1);

    expect(answer).toHaveBeenCalledTimes(1);
    expect(component.arenaQuestion()?.questionId).toBe('q1');
  });

  it('un secondo START_VOTING Arena non cambia la domanda mentre il giocatore risponde', () => {
    component.nickname.set('Anna');
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const request = vi.spyOn(game, 'getArenaQuestion');
    const pending = new Subject<any>();
    const answer = vi.spyOn(game, 'answerArenaQuestion').mockReturnValue(pending.asObservable());

    ws.status$.next({ action: 'START_VOTING', type: 'ARENA' });
    const questionId = component.arenaQuestion()?.questionId;
    expect(questionId).toBe('q-test');
    component.sendArenaAnswer(0);
    ws.status$.next({ action: 'START_VOTING', type: 'ARENA' });

    expect(request).toHaveBeenCalledTimes(1);
    expect(component.arenaQuestion()?.questionId).toBe(questionId);
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer.mock.calls[0][2]).toBe(questionId);
  });

  it('ignora una domanda Arena arrivata dopo la fine del round', async () => {
    component.nickname.set('Anna');
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pending = new Subject<any>();
    vi.spyOn(game, 'getArenaQuestion').mockReturnValue(pending.asObservable());
    component.onStartVoting('ARENA');
    expect(component.isFetchingQuestion()).toBe(true);

    ws.status$.next({ action: 'ROUND_ENDED' });
    pending.next({ question: 'Troppo tardi', options: ['A', 'B'], questionId: 'old' });
    expect(component.arenaQuestion()).toBeNull();
    expect(component.isFetchingQuestion()).toBe(false);

    component.onStartVoting('ARENA');
    pending.next({ question: 'Nuovo round', options: ['A', 'B'], questionId: 'new' });
    expect(component.arenaQuestion()?.questionId).toBe('new');
  });

  it('non ritenta domande Arena in pausa e riprende alla riapertura', () => {
    vi.useFakeTimers();
    try {
      component.nickname.set('Anna');
      component.roundActive.set(true);
      const game = TestBed.inject(GameService);
      const pending = new Subject<any>();
      const request = vi.spyOn(game, 'getArenaQuestion').mockReturnValue(pending.asObservable());
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      component.onStartVoting('ARENA');
      ws.status$.next({ action: 'GAME_PAUSED' });
      pending.error({ status: 409, error: { error: 'round-paused' } });
      vi.advanceTimersByTime(1000);
      expect(request).toHaveBeenCalledTimes(1);
      ws.status$.next({ action: 'GAME_RESUMED' });
      expect(request).toHaveBeenCalledTimes(2);
      log.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('una vecchia risposta Arena non blocca né sblocca il nuovo round', () => {
    component.nickname.set('Anna');
    component.roundActive.set(true);
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const oldAnswer = new Subject<any>();
    const newAnswer = new Subject<any>();
    const answer = vi.spyOn(game, 'answerArenaQuestion')
      .mockReturnValueOnce(oldAnswer.asObservable())
      .mockReturnValueOnce(newAnswer.asObservable());
    component.arenaQuestion.set({ text: 'Vecchia', options: ['A', 'B'], isTrueFalse: false, questionId: 'old' });
    component.sendArenaAnswer(0);
    ws.status$.next({ action: 'ROUND_ENDED' });
    // Il round nuovo si apre come in partita: ROUND_STARTED/START_VOTING.
    component.roundActive.set(true);
    component.roundClosed.set(false);
    component.arenaQuestion.set({ text: 'Nuova', options: ['A', 'B'], isTrueFalse: false, questionId: 'new' });
    component.sendArenaAnswer(0);
    expect(answer).toHaveBeenCalledTimes(2);

    oldAnswer.next({ correct: true });
    component.sendArenaAnswer(1);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(component.arenaQuestion()?.questionId).toBe('new');
    newAnswer.next({ correct: true });
    expect(component.arenaQuestion()).toBeNull();
  });

  it('sostituisce una domanda Arena non più verificabile senza fermare il round', () => {
    component.nickname.set('Anna');
    component.onStartVoting('ARENA');
    component.roundActive.set(true);
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const answer = new Subject<any>();
    vi.spyOn(game, 'answerArenaQuestion').mockReturnValue(answer.asObservable());
    const request = vi.spyOn(game, 'getArenaQuestion');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    component.arenaQuestion.set({ text: 'Vecchia', options: ['A', 'B'], isTrueFalse: false, questionId: 'old' });
    component.sendArenaAnswer(0);
    answer.error({ status: 409, error: { error: 'arena-question-stale' } });
    expect(request).toHaveBeenCalledTimes(1);
    expect(component.arenaQuestion()?.questionId).toBe('q-test');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    log.mockRestore();
  });

  it('non invia risposte Arena mentre il telefono è in pausa', () => {
    component.nickname.set('Anna');
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    component.paused.set(true);
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const answer = vi.spyOn(game, 'answerArenaQuestion');
    component.sendArenaAnswer(0);
    expect(answer).not.toHaveBeenCalled();
    expect(component.arenaQuestion()?.questionId).toBe('q1');
  });

  it('chiude la schermata Arena in silenzio se la risposta arriva a round chiuso', () => {
    component.nickname.set('Anna');
    component.roundActive.set(true);
    component.gameState.set(PlayerStatus.VOTING);
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const answer = vi.spyOn(game, 'answerArenaQuestion')
      .mockReturnValue(throwError(() => ({ status: 409, error: { error: 'round-closed' } })));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    component.sendArenaAnswer(0);

    // Round finito: la schermata si chiude come negli altri giochi, senza
    // errore a schermo e senza restare su una domanda che il server rifiuta.
    expect(component.arenaQuestion()).toBeNull();
    expect(component.roundActive()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(reliability.lastError()).toBeNull();
    expect(log).not.toHaveBeenCalled();

    // Il tap successivo non produce un altro 409: non c'è più domanda.
    component.sendArenaAnswer(1);
    expect(answer).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('non ritenta la domanda Arena se il round si chiude mentre la chiede', () => {
    vi.useFakeTimers();
    try {
      component.nickname.set('Anna');
      component.roundActive.set(true);
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const request = vi.spyOn(game, 'getArenaQuestion')
        .mockReturnValue(throwError(() => ({ status: 409, error: { error: 'round-closed' } })));
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      component.onStartVoting('ARENA');
      expect(request).toHaveBeenCalledTimes(1);
      expect(component.roundActive()).toBe(false);
      expect(component.gameState()).toBe(PlayerStatus.WAITING);

      // Un round chiuso non si ritenta: sarebbe un 409 al secondo.
      vi.advanceTimersByTime(2000);
      expect(request).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('in pausa un tap sul bonus non resta come scelta inviata', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('BONUS_CASINO');
    component.casinoState.set({ phase: 'PICK', manche: 1, options: ['NERO', 'ROSSO'] });

    component.paused.set(true);
    component.casinoAct('ROSSO');

    // Il tap non diventa una scelta inviata: alla ripresa si può ancora puntare.
    expect(component.casinoChoice()).toBeNull();
    expect(ws.broadcasted.some((entry) => entry.body.action === 'CASINO_ACTION')).toBe(false);

    component.paused.set(false);
    component.casinoAct('ROSSO');
    expect(component.casinoChoice()).toBe('ROSSO');
    expect(ws.broadcasted.filter((entry) => entry.body.action === 'CASINO_ACTION')).toHaveLength(1);
  });

  it('in pausa l’invio della puntata Azzardo non resta inviato', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.azzardoState.set({
      phase: 'BET',
      manche: 1,
      options: [10, 20, 30],
      ready: [{ playerName: 'Anna', points: 100, maxBet: 100 }],
    });
    component.azzardoChips.set([1, 0, 0]);
    component.roundActive.set(true);

    component.paused.set(true);
    component.azzardoSendBet();

    // La puntata non parte e il telefono non la segna come inviata.
    expect(component.azzardoSent()).toBe(false);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    component.paused.set(false);
    component.azzardoSendBet();
    expect(component.azzardoSent()).toBe(true);
    expect(ws.broadcasted.filter((entry) => entry.body.action === 'AZZARDO_ACTION')).toHaveLength(1);
  });

  it('in pausa il livello di Ultima Spiaggia non resta inviato', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('ULTIMA_SPIAGGIA');
    component.ultimaSpiaggiaState.set({
      phase: 'LEVEL',
      levels: [100, 200],
      rows: [{ playerName: 'Anna', used: [] }],
    });

    component.paused.set(true);
    component.ultimaSpiaggiaPickLevel(200);

    // Il tap non diventa una scelta inviata: alla ripresa i livelli sono ancora liberi.
    expect(component.ultimaSpiaggiaLevel()).toBeNull();
    expect(ws.broadcasted.some((entry) => entry.body.action === 'ULTIMA_SPIAGGIA_ACTION')).toBe(false);

    component.paused.set(false);
    component.ultimaSpiaggiaPickLevel(200);
    expect(component.ultimaSpiaggiaLevel()).toBe(200);
    expect(ws.broadcasted.filter((entry) => entry.body.action === 'ULTIMA_SPIAGGIA_ACTION')).toHaveLength(1);
  });

  it('mantiene la domanda Arena se la risposta arriva al server durante la pausa', () => {
    component.nickname.set('Anna');
    component.roundActive.set(true);
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const answer = vi.spyOn(game, 'answerArenaQuestion')
      .mockReturnValue(throwError(() => ({ status: 409, error: { error: 'round-paused' } })));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    component.sendArenaAnswer(0);
    expect(component.arenaQuestion()?.questionId).toBe('q1');
    component.sendArenaAnswer(0);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(component.arenaQuestion()?.questionId).toBe('q1');
    log.mockRestore();
  });

  it('ritenta la stessa risposta Arena dopo una conferma persa', () => {
    component.nickname.set('Anna');
    component.roundActive.set(true);
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    const game = TestBed.inject(GameService);
    const answer = vi.spyOn(game, 'answerArenaQuestion')
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(of({ correct: true }));
    const question = vi.spyOn(game, 'getArenaQuestion');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    component.sendArenaAnswer(0);
    expect(component.arenaQuestion()?.questionId).toBe('q1');
    expect(question).not.toHaveBeenCalled();
    expect(reliability.lastError()).toContain('A');
    component.sendArenaAnswer(1);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(answer.mock.calls[0][3]).toBe('A');
    expect(answer.mock.calls[1][3]).toBe('A');
    expect(answer.mock.calls[1][4]).toBe(answer.mock.calls[0][4]);
    expect(reliability.lastError()).toBeNull();
    log.mockRestore();
  });

  it('ignora una domanda Arena arrivata dopo una richiesta più recente', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pending: Subject<any>[] = [];
    vi.spyOn(game, 'getArenaQuestion').mockImplementation(() => {
      const request = new Subject<any>();
      pending.push(request);
      return request.asObservable();
    });

    component.onStartVoting('ARENA');
    component.generateNextArenaQuestion();
    expect(pending).toHaveLength(2);

    pending[1].next({ question: 'Nuova', options: ['A', 'B'], questionId: 'q2' });
    pending[0].next({ question: 'Vecchia', options: ['A', 'B'], questionId: 'q1' });

    expect(component.arenaQuestion()?.questionId).toBe('q2');
    expect(component.arenaQuestion()?.text).toBe('Nuova');
  });

  it('should only keep the active categories for the arena', () => {
    expect(component.categories().map((category) => category.name)).toEqual([
      'CULTURA GENERALE',
      'MUSICA',
      'FORTUNA',
    ]);
  });

  it('should store the nickname and announce the player to the TV', async () => {
    ws.connected.set(true);
    component.tempNickname = 'Anna';
    await component.setNickname();

    expect(component.nickname()).toBe('Anna');
    expect(localStorage.getItem('nickname')).toBe('Anna');
    const bodies = ws.broadcasted.map((message) => message.body);
    // L'ingresso porta anche l'identificativo del telefono: la TV riconosce
    // la stessa squadra se il giocatore rientra con un nome diverso.
    expect(bodies).toContainEqual({ action: 'JOIN_GAME', playerName: 'Anna', deviceId: 'device-test' });
    // La palette scelta prima del tutorial parte insieme all'ingresso e si blocca.
    expect(bodies).toContainEqual({
      action: 'SELECT_THEME',
      theme: component.theme.theme(),
      playerName: 'Anna',
    });
    expect(component.theme.isLocked()).toBe(true);
  });

  it('sends the chosen palette as soon as the socket is open', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    expect(ws.broadcasted.some((m) => m.body.action === 'SELECT_THEME')).toBe(false);

    ws.connectedAt$.next(Date.now());

    expect(ws.broadcasted.at(-1)?.body).toEqual({
      action: 'SELECT_THEME',
      theme: component.theme.theme(),
      playerName: 'Anna',
    });
  });

  it('requires a team name between 2 and 16 characters before registering', async () => {
    const start = vi.spyOn(reliability, 'start');
    for (const name of [' ', 'A', '12345678901234567']) {
      component.tempNickname = name;
      await component.setNickname();
      expect(component.nickname()).toBeNull();
      expect(reliability.lastError()).toContain('da 2 a 16');
    }
    expect(start).not.toHaveBeenCalled();
    component.tempNickname = '  AB  ';
    await component.setNickname();
    expect(component.nickname()).toBe('AB');
  });

  it('does not enter when the team name is rejected', async () => {
    vi.spyOn(reliability, 'start').mockResolvedValue(false);
    component.tempNickname = 'Anna';
    await component.setNickname();
    expect(component.nickname()).toBeNull();
    expect(localStorage.getItem('nickname')).toBeNull();
    expect(ws.broadcasted).toHaveLength(0);
  });

  it('should publish the vote and lock the phone', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('TIMELINE');

    component.sendVote(2);

    expect(ws.publishedAnswers).toHaveLength(1);
    expect(ws.publishedAnswers[0]).toMatchObject({
      gameId: 1,
      playerName: 'Anna',
      answerIndex: 2,
    });
    expect(component.gameState()).toBe('LOCKED');
  });

  it('mostra risposta inviata dopo un voto Quiz senza parlare di prenotazione', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.onStartVoting('QUIZ');
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'quiz-r1', state: { manche: 1 } });
    component.sendVote(2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('RISPOSTA INVIATA');
    expect(fixture.nativeElement.textContent).not.toContain('Sei PRENOTATO!');
  });

  it('mantiene il messaggio di prenotazione per i giochi con buzzer', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.onStartVoting('MUSIC');
    component.sendBuzz();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sei PRENOTATO!');
  });

  it('manda il voto Quiz al server, non via WebSocket', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('QUIZ');
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'quiz-r1', state: { manche: 1 } });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;

    component.sendVote(1);

    expect(game.quizAnswersSent).toEqual([1]);
    expect(ws.publishedAnswers).toHaveLength(0);
    expect(component.gameState()).toBe('LOCKED');
  });

  it('ignora la conferma di un voto Quiz arrivata dopo la manche successiva', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'quiz-r1', state: { manche: 1 } });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pending = new Subject<any>();
    const send = vi.spyOn(game, 'submitQuizAnswer').mockReturnValue(pending.asObservable());
    component.sendVote(0);
    expect(send).toHaveBeenCalledWith(1, 0, 0, 'quiz-r1');
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'quiz-r1', state: { manche: 2 } });
    pending.next({ manche: 0 });
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.hasAnswered()).toBe(false);
    expect(component.quizManche()).toBe(2);
  });

  it('keeps the phone unlocked when a vote or buzz cannot be sent', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('QUIZ');
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'quiz-r1', state: { manche: 1 } });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    game.quizFailNext = true;

    component.sendVote(2);
    expect(component.gameState()).toBe('VOTING');
    expect(component.hasAnswered()).toBe(false);
    expect(component.selectedAnswer()).toBeNull();
    expect(reliability.lastError()).toContain('non registrata');

    vi.spyOn(ws, 'sendAnswer').mockReturnValue(false);
    component.sendBuzz();
    expect(component.gameState()).toBe('VOTING');
    expect(reliability.lastError()).toContain('non inviata');
  });

  it('non riabilita gli input finché il server non ha detto in che round siamo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    let finishSync: () => void = () => {};
    vi.spyOn(reliability, 'sync').mockReturnValue(
      new Promise<void>((resolve) => { finishSync = resolve; }),
    );

    const realign = (component as any).realignWithServer();
    expect(component.resyncing()).toBe(true);
    expect(component.inputReady()).toBe(false);

    // Un tap mentre si riallinea non deve produrre una risposta.
    component.onStartVoting('QUIZ');
    component.sendVote(1);
    expect(ws.publishedAnswers).toHaveLength(0);

    // Anche se sync termina senza uno snapshot (errore o richiesta già in
    // corso), il telefono resta bloccato fino al recupero effettivo.
    finishSync();
    await realign;
    expect(component.resyncing()).toBe(true);
    expect(component.inputReady()).toBe(false);
    reliability.syncState$.next({ hasState: false });
    expect(component.resyncing()).toBe(false);
    // N-05: senza un round aperto il telefono non riabilita i tasti. Prima
    // bastava «non in pausa» e si poteva rispondere a un round già chiuso.
    expect(component.inputReady()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(component.roundActive()).toBe(false);
  });

  it('N-05: a round chiuso il telefono non manda più prenotazioni', async () => {
    component.nickname.set('Anna');
    ws.status$.next({ action: 'START_VOTING', type: 'IMAGE_BLUR', payload: {} });
    expect(component.roundActive()).toBe(true);
    expect(component.inputReady()).toBe(true);

    ws.status$.next({ action: 'ROUND_ENDED' });
    expect(component.roundClosed()).toBe(true);
    expect(component.inputReady()).toBe(false);

    const before = ws.publishedAnswers.length;
    component.sendBuzz();
    expect(ws.publishedAnswers.length).toBe(before);
  });

  it('N-05: alla scadenza del server il round si chiude anche senza ROUND_ENDED', () => {
    vi.useFakeTimers();
    try {
      component.nickname.set('Anna');
      // Il watcher creato in ngOnInit usa i timer veri: lo si riarma qui.
      clearInterval((component as any).roundDeadlineWatch);
      (component as any).roundDeadlineWatch = undefined;
      (component as any).startRoundDeadlineWatch();
      component.onStartVoting('IMAGE_BLUR');
      component.roundDeadlineAt.set(Date.now() - 1);
      expect(component.inputReady()).toBe(true);
      vi.advanceTimersByTime(600);
      expect(component.roundClosed()).toBe(true);
      expect(component.inputReady()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un evento di chiusura durante lo snapshot richiede una fotografia successiva', () => {
    component.nickname.set('Anna');
    reliability.syncing.set(true);
    const sync = vi.spyOn(reliability, 'sync');
    ws.status$.next({ action: 'ROUND_ENDED' });
    expect(component.resyncing()).toBe(true);
    expect(component.inputReady()).toBe(false);
    expect(sync).toHaveBeenCalledWith(true);
  });

  it('dopo il riallineamento a round chiuso torna in attesa, senza pulsanti attivi', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.gameState.set('VOTING' as any);

    reliability.syncState$.next({
      hasState: true,
      roundType: 'QUIZ',
      roundKey: 'g1-r9',
      roundDeadlineAt: Date.now() - 1_000,
      currentRound: { type: 'QUIZ', roundKey: 'g1-r9' },
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.roundActive()).toBe(false);
    expect(component.hasAnswered()).toBe(false);
  });

  it('usa lo stato corrente invece dell ultima riga di un round diverso', () => {
    component.nickname.set('Anna');
    reliability.syncState$.next({
      hasState: true, status: 'RUNNING', roundType: 'TIMELINE', roundIndex: 2, roundKey: 'g1-r2',
      roundDeadlineAt: Date.now() + 60_000,
      payload: { roundId: 'nuovo', items: [{ id: 7, label: 'Nuova' }] },
      currentRound: { type: 'QUIZ', roundIndex: 1, payload: { manche: 1 } },
    });
    expect(component.questionType()).toBe('TIMELINE');
    expect(component.timelineCards().map(card => card.label)).toEqual(['Nuova']);
  });

  it('non riapre un round chiuso anche se la scadenza è ancora nel futuro', () => {
    component.nickname.set('Anna');
    component.onStartVoting('QUIZ');
    reliability.syncState$.next({
      hasState: true, status: 'WAITING', roundType: 'QUIZ', roundKey: 'g1-r1',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { type: 'QUIZ' },
    });
    expect(component.roundActive()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
  });

  it('ricostruisce un round ancora aperto alla pausa anche se la deadline è passata', () => {
    const pausedAt = Date.now() - 30_000;
    reliability.syncState$.next({
      hasState: true, status: 'RUNNING', paused: true, pausedAt,
      roundType: 'TIMELINE', roundKey: 'paused-round', roundDeadlineAt: pausedAt + 12_000,
      currentRound: { type: 'TIMELINE', roundKey: 'paused-round',
        payload: { roundId: 'paused', items: [{ id: 1, label: 'Carta' }] } },
    });
    expect(component.paused()).toBe(true);
    expect(component.roundActive()).toBe(true);
    expect(component.gameState()).toBe('VOTING');
    expect(component.timelineCards()).toHaveLength(1);
  });

  it('attende la ripresa prima di richiedere una domanda Arena dopo il sync in pausa', () => {
    component.nickname.set('Anna');
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const request = vi.spyOn(game, 'getArenaQuestion');
    const pausedAt = Date.now() - 30_000;
    reliability.syncState$.next({
      hasState: true, status: 'RUNNING', paused: true, pausedAt,
      roundType: 'ARENA', roundKey: 'paused-arena', roundDeadlineAt: pausedAt + 12_000,
    });
    expect(component.roundActive()).toBe(true);
    expect(request).not.toHaveBeenCalled();
    ws.status$.next({ action: 'GAME_RESUMED' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(component.gameState()).toBe('VOTING');
  });

  it('attende la sessione prima di richiedere una domanda Arena', async () => {
    const game = TestBed.inject(GameService);
    const request = vi.spyOn(game, 'getArenaQuestion');
    let finishRegistration: (ok: boolean) => void = () => {};
    vi.spyOn(reliability, 'start').mockReturnValue(new Promise<boolean>(resolve => { finishRegistration = resolve; }));
    component.tempNickname = 'Anna';
    const registration = component.setNickname();
    reliability.syncState$.next({
      hasState: true, roundType: 'ARENA', roundKey: 'g1-r1',
      roundDeadlineAt: Date.now() + 60_000,
    });
    expect(request).not.toHaveBeenCalled();
    finishRegistration(true);
    await registration;
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][2]).toBe('Anna');
  });

  it('non carica Arena dopo la sessione prima dell’annuncio della TV', async () => {
    const game = TestBed.inject(GameService);
    const request = vi.spyOn(game, 'getArenaQuestion');
    let finishRegistration: (ok: boolean) => void = () => {};
    vi.spyOn(reliability, 'start').mockReturnValue(new Promise<boolean>(resolve => { finishRegistration = resolve; }));
    component.tempNickname = 'Anna';
    const registration = component.setNickname();
    ws.status$.next({ action: 'SHOW_QUESTION', type: 'ARENA' });
    finishRegistration(true);
    await registration;
    expect(request).not.toHaveBeenCalled();
    ws.status$.next({ action: 'START_VOTING', type: 'ARENA' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][2]).toBe('Anna');
  });

  it('il sync al nuovo round Arena scarta la domanda e le risposte precedenti', () => {
    component.nickname.set('Anna');
    const game = TestBed.inject(GameService);
    const oldQuestion = new Subject<any>();
    const newQuestion = new Subject<any>();
    const answer = new Subject<any>();
    const request = vi.spyOn(game, 'getArenaQuestion')
      .mockReturnValueOnce(oldQuestion.asObservable())
      .mockReturnValueOnce(newQuestion.asObservable());
    vi.spyOn(game, 'answerArenaQuestion').mockReturnValue(answer.asObservable());
    const snapshot = (key: string) => ({
      hasState: true, roundType: 'ARENA', roundKey: key,
      roundDeadlineAt: Date.now() + 60_000,
    });
    reliability.syncState$.next(snapshot('g1-r1'));
    oldQuestion.next({ question: 'Vecchia', options: ['A', 'B'], questionId: 'old' });
    component.sendArenaAnswer(0);
    reliability.syncState$.next(snapshot('g1-r2'));
    expect(request).toHaveBeenCalledTimes(2);
    expect(component.gameState()).toBe('VOTING');
    newQuestion.next({ question: 'Nuova', options: ['A', 'B'], questionId: 'new' });
    answer.next({ correct: true });
    expect(component.arenaQuestion()?.questionId).toBe('new');
    reliability.syncState$.next(snapshot('g1-r2'));
    expect(request).toHaveBeenCalledTimes(2);
    expect(component.arenaQuestion()?.questionId).toBe('new');
  });

  it('should block only the player named in the error', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    ws.status$.next({ action: 'BLOCKED_ERROR', blockedPlayer: 'Anna' });
    await fixture.whenStable();

    expect(component.isBlocked()).toBe(true);
    expect(component.gameState()).toBe('BLOCKED_ERROR');
  });

  it('should reopen a new round from the snapshot after an answer', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    ws.status$.next({
      action: 'START_VOTING',
      type: 'TIMELINE',
      payload: JSON.stringify({ items: [{ id: 0, label: 'Prima carta' }] }),
    });
    await fixture.whenStable();

    // Telefono rimasto bloccato con la risposta del round precedente: senza il
    // reset della chiave il nuovo snapshot veniva scartato e restava in attesa.
    component.hasAnswered.set(true);
    component.gameState.set('LOCKED' as any);

    reliability.syncState$.next({
      hasState: true,
      roundIndex: 1,
      roundType: 'TIMELINE',
      roundKey: 'g1-r1',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: {
        type: 'TIMELINE',
        roundKey: 'g1-r1',
        payload: JSON.stringify({
          items: [{ id: 0, label: 'Prima carta' }, { id: 1, label: 'Seconda carta' }],
        }),
      },
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('VOTING');
    expect(component.hasAnswered()).toBe(false);
    expect(component.timelineCards().length).toBe(2);
  });

  it('reopens a different Timeline round but preserves the order on a same-round sync', async () => {
    vi.useFakeTimers();
    try {
      component.tempNickname = 'Anna';
      await component.setNickname();
      const firstCards = [{ id: 0, label: 'Vecchia A' }, { id: 1, label: 'Vecchia B' }];
      component.onStartVoting('TIMELINE', { roundId: 'old', items: firstCards });
      const nextCards = [{ id: 0, label: 'Nuova A' }, { id: 1, label: 'Nuova B' }];
      const snapshot = {
        hasState: true, roundKey: 'g1-r2', roundType: 'TIMELINE',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: { type: 'TIMELINE', roundKey: 'g1-r2', payload: { roundId: 'new', items: nextCards } },
      };
      reliability.syncState$.next(snapshot);
      expect(component.timelineCards()).toEqual(nextCards);
      component.moveCard(0, 1);
      reliability.syncState$.next(snapshot);
      expect(component.timelineOrder()).toEqual([1, 0]);
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[4]).toBe('new');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should go back to waiting when the snapshot has no open round', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });
    await fixture.whenStable();

    reliability.syncState$.next({
      hasState: true,
      status: 'WAITING',
      roundType: null,
      roundDeadlineAt: Date.now() - 1_000,
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.hasAnswered()).toBe(false);
  });

  it('aspetta l annuncio TV prima di aprire un round dal snapshot', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.questionType.set('BOMBA');
    component.gameState.set('WAITING' as any);

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'QUIZ',
      roundKey: 'g1-r4',
      roundDeadlineAt: Date.now() + 60_000,
      announced: false,
      currentRound: { type: 'QUIZ', roundKey: 'g1-r4', payload: '{}' },
    });

    expect(component.roundActive()).toBe(true);
    expect(component.gameState()).toBe('WAITING' as any);
    expect(component.questionType()).toBe('BOMBA');

    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });

    expect(component.gameState()).toBe('VOTING' as any);
    expect(component.questionType()).toBe('QUIZ');
  });

  it('un round aperto ma non annunciato lascia il telefono in attesa neutra', async () => {
    // Sintomo della serata di prova: header con il round nuovo e telefono
    // ancora sul gioco precedente (Musica) mentre la TV mostrava il Quiz.
    component.tempNickname = 'Anna';
    await component.setNickname();

    ws.status$.next({ action: 'SHOW_QUESTION', type: 'MUSIC', payload: '{}' });
    ws.status$.next({ action: 'START_VOTING', type: 'MUSIC', payload: '{}' });
    await fixture.whenStable();
    expect(component.questionType()).toBe('MUSIC');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.textContent).toContain('PRENOTA E RISPONDI!');

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'AZZARDO',
      roundIndex: 4,
      roundKey: 'g1-r5',
      roundDeadlineAt: Date.now() + 60_000,
      // La TV ha aperto il round e sta facendo l'intro: nessun annuncio.
      announced: false,
      currentRound: { type: 'AZZARDO', roundKey: 'g1-r5', payload: { category: 'STORIA' } },
    });
    fixture.detectChanges();

    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    const text = String(fixture.nativeElement.textContent).replace(/\s+/g, ' ');
    expect(text).toContain('In attesa della prossima sfida');
    expect(text).not.toContain('PRENOTA E RISPONDI!');
  });

  it('un annuncio arretrato non riporta il telefono al gioco del round precedente', async () => {
    // Il comando della regia viene replicato: se l'annuncio del round vecchio
    // arriva dopo lo snapshot del round nuovo, il telefono non deve tornare
    // sulla schermata precedente con il numero di round nuovo nell'header.
    component.tempNickname = 'Anna';
    await component.setNickname();

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'AZZARDO',
      roundIndex: 4,
      roundKey: 'g1-r5',
      roundDeadlineAt: Date.now() + 60_000,
      announced: false,
      currentRound: { type: 'AZZARDO', roundKey: 'g1-r5', payload: { category: 'STORIA' } },
    });
    fixture.detectChanges();
    expect(component.roundNumber()).toBe(5);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    // Replica in ritardo dell'annuncio del round 4 (Musica).
    ws.status$.next({ action: 'START_VOTING', type: 'MUSIC', round: 4 });
    fixture.detectChanges();

    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(component.questionType()).not.toBe('MUSIC');
    expect(String(fixture.nativeElement.textContent)).not.toContain('PRENOTA E RISPONDI!');

    // L'annuncio del round in corso, invece, apre il gioco.
    ws.status$.next({ action: 'START_VOTING', type: 'AZZARDO', round: 5, payload: '{}' });
    expect(component.questionType()).toBe('AZZARDO');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
  });

  it('should not let a player with zero points bet in Azzardo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    const state = (maxBet: number, points: number) => ({
      phase: 'BET',
      manche: 1,
      total: 4,
      category: 'STORIA',
      unit: 'anno',
      options: [1900, 1910, 1920, 1930],
      ready: [{ playerName: 'Anna', points, maxBet, ready: false }],
    });

    component.roundActive.set(true);
    component.azzardoState.set(state(0, 0));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    // F-26: chi ha punti manda la puntata da sola, senza conferma.
    component.azzardoState.set(state(100, 100));
    component.azzardoPick(0);
    component.azzardoSendBet();
    const bets = ws.broadcasted.filter((entry) => entry.body.action === 'AZZARDO_ACTION');
    expect(bets).toHaveLength(1);
    expect(bets[0].body.value.chips).toEqual([1, 0, 0, 0]);

    // Togliere tutte le fiches e inviare annulla la puntata: vale l'ultima.
    component.azzardoAddChip(0, -1);
    component.azzardoSendBet();
    const after = ws.broadcasted.filter((entry) => entry.body.action === 'AZZARDO_ACTION');
    expect(after).toHaveLength(2);
    expect(after[1].body.value.chips).toEqual([0, 0, 0, 0]);
  });

  it('rispetta il tetto di fiches della squadra e cita i 500 punti di massimo per manche', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    const azzardoState = (row: Record<string, number>) => ({
      phase: 'BET',
      manche: 2,
      total: 4,
      category: 'CANZONI',
      unit: 'anno',
      options: [1969, 1971, 1973, 1975],
      chips: 10,
      chipValue: 20,
      chipCap: 15,
      winCap: 500,
      odds: 2,
      lossMultiplier: 0.8,
      ready: [{
        playerName: 'Anna',
        points: 1120,
        maxBet: 300,
        chipsBank: 17,
        chipsCap: 13,
        chips: [],
        ...row,
      }],
    });

    component.azzardoState.set(azzardoState({}));
    component.azzardoChips.set([7, 0, 0, 0]);

    // Salvadanaio 17, tetto della squadra 13, credito 300 / 20 = 15 → 13.
    expect(component.azzardoMyChipCap()).toBe(13);
    expect(component.azzardoMaxChips()).toBe(13);
    expect(component.azzardoChipsLeft()).toBe(10);

    // Il tetto della squadra comanda sul massimo dichiarato.
    component.azzardoState.set(azzardoState({ chipsCap: 11 }));
    expect(component.azzardoMaxChips()).toBe(11);

    // Il credito in punti taglia sotto il tetto.
    component.azzardoState.set(azzardoState({ maxBet: 100 }));
    expect(component.azzardoMaxChips()).toBe(5);

    // La riga di conversione dichiara il tetto di vincita della manche.
    expect(component.azzardoConvertHint()).toContain('500');
    expect(component.azzardoConvertHint()).toContain('manche');

    // Se il server non manda il tetto, resta quello del regolamento.
    const withoutCap: any = azzardoState({});
    delete withoutCap.winCap;
    component.azzardoState.set(withoutCap);
    expect(component.azzardoConvertHint()).toContain('500');
  });

  it('sends a pending Timeline answer only while the round is active', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      component.tempNickname = 'Anna';
      await component.setNickname();
      const start = () => ws.status$.next({
        action: 'START_VOTING', type: 'TIMELINE', payload: { items: [{ id: 1, label: 'Carta' }] },
      });

      start();
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);

      start();
      ws.status$.next({ action: 'ROUND_ENDED' });
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);

      start();
      component.ngOnDestroy();
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses a round-specific Timeline key and sends button changes', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      component.tempNickname = 'Anna';
      await component.setNickname();
      const cards = [{ id: 0, label: 'A' }, { id: 1, label: 'B' }];
      component.onStartVoting('TIMELINE', { roundId: 'round-one', items: cards });
      vi.advanceTimersByTime(350);
      const firstKey = submit.mock.calls.at(-1)?.[3];
      expect(submit.mock.calls.at(-1)?.[4]).toBe('round-one');
      component.moveCard(0, 1);
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[2]).toEqual([1, 0]);
      component.onStartVoting('TIMELINE', { roundId: 'round-two', items: cards });
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[3]).not.toBe(firstKey);
      expect(submit.mock.calls.at(-1)?.[4]).toBe('round-two');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps Timeline labels inside the card rows', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('TIMELINE', {
      items: [
        { id: 1, label: 'Incoronazione di Carlo Magno a Roma' },
        { id: 2, label: "Sbarco dell'uomo sulla Luna" },
        { id: 3, label: "Rivoluzione russa d'Ottobre" },
        { id: 4, label: 'Inaugurazione della Torre Eiffel' },
        { id: 5, label: 'Newton pubblica i Principia' },
        { id: 6, label: 'Caduta del Muro di Berlino' },
      ],
    });
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.tl-drag-card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(6);
    // Le etichette devono stare dentro la riga: prima erano inline e
    // debordavano sotto la carta, sovrapponendosi alla riga successiva.
    expect(getComputedStyle(cards[0]).display).toBe('flex');
    expect(getComputedStyle(cards[0]).overflow).toBe('hidden');
    const label = cards[0].querySelector('.tl-text') as HTMLElement;
    expect(getComputedStyle(label).webkitLineClamp).toBe('2');
  });

  it('should reset the answer state when the round ends', async () => {
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });
    ws.status$.next({ action: 'ROUND_ENDED' });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.hasAnswered()).toBe(false);
  });

  /**
   * F02 — il refresh è una nuova istanza del componente sullo stesso telefono:
   * stesso localStorage (nickname, serata) e stesso dispositivo, zero stato in
   * memoria. Le fake restano le stesse, così si vede cosa fa il "telefono"
   * dopo il riavvio.
   */
  async function reloadPhone(): Promise<void> {
    fixture.destroy();
    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('dopo un refresh rientra nel round aperto senza tutorial', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    expect(component.nickname()).toBe('Anna');
    expect(component.showButtonTest()).toBe(false);
    expect(reliability.started.at(-1)?.playerName).toBe('Anna');

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'TIMELINE',
      roundKey: 'g1-r3',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: { roundKey: 'g1-r3', type: 'TIMELINE', payload: { roundId: 'r3', items: [] } },
    });
    await fixture.whenStable();

    expect(component.roundActive()).toBe(true);
    expect(component.questionType()).toBe('TIMELINE');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
  });

  /** Snapshot di un Quiz aperto alla manche 2, round g1-r4. */
  function quizRoundSnapshot(): any {
    return {
      hasState: true,
      status: 'RUNNING',
      roundType: 'QUIZ',
      roundKey: 'g1-r4',
      roundStartId: 'round-1',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: {
        roundKey: 'g1-r4',
        type: 'QUIZ',
        payload: { manche: 2, question: 'Domanda?', options: ['A', 'B'] },
      },
    };
  }

  /** Snapshot del round Quiz successivo, con una nuova apertura. */
  function nextQuizSnapshot(): any {
    const next = quizRoundSnapshot();
    next.roundKey = 'g1-r5';
    next.roundStartId = 'round-2';
    next.currentRound = {
      roundKey: 'g1-r5',
      type: 'QUIZ',
      payload: { manche: 1, question: 'Nuova domanda?', options: ['A', 'B'] },
    };
    return next;
  }

  it('mostra subito la domanda del Quiz e la blocca quando il server conferma il voto', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();

    // Il server è lento: la domanda compare subito, ma i tasti restano chiusi.
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.hasAnswered()).toBe(false);
    expect(component.quizCheckPending()).toBe(true);

    summary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
    summary.complete();

    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
    expect(component.hasAnswered()).toBe(true);
    expect(component.selectedAnswer()).toBe(1);
  });

  it('tiene i tasti Quiz chiusi mentre il riepilogo è in volo e li riapre senza voto', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.quizCheckPending()).toBe(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    summary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [] });
    summary.complete();
    fixture.detectChanges();

    expect(component.quizCheckPending()).toBe(false);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('se il riepilogo Quiz fallisce lascia i tasti chiusi e non invia voti', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));
    const submit = vi.spyOn(game, 'submitQuizAnswer');

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.quizCheckPending()).toBe(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.every((button) => button.disabled)).toBe(true);

    component.sendVote(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it('un reannuncio senza identità non riapre i tasti dopo un errore, ma il round dopo la fine sì', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ roundStartId: 'round-1', mancheIndex: 1, answers: [] }))
      .mockReturnValueOnce(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(component.quizCheckPending()).toBe(true);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    // Il riallineamento ripete la verifica: stavolta risponde senza un voto.
    (component as any).realignWithServer();
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(buttons.every((button) => !button.disabled)).toBe(true);

    // Una nuova verifica fallisce ancora; il round successivo non eredita il blocco.
    (component as any).realignWithServer();
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    // Reannuncio senza identità dello stesso round: non deve riaprire i tasti.
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.quizCheckPending()).toBe(true);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    // Dopo la fine del round, invece, il nuovo annuncio senza identità riparte.
    ws.status$.next({ action: 'ROUND_ENDED' });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    const freshButtons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(freshButtons.length).toBe(4);
    expect(freshButtons.every((button) => !button.disabled)).toBe(true);
  });

  it('la fine del round chiude l attesa del riepilogo Quiz', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    ws.status$.next({ action: 'ROUND_ENDED' });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
  });

  it('REVEAL chiude l attesa del riepilogo Quiz e permette il round successivo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    ws.status$.next({ action: 'REVEAL' });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('REVEAL sblocca il legacy e permette il round successivo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({
      recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
    }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    ws.status$.next({ action: 'REVEAL' });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('uno snapshot di un nuovo round chiude l attesa del riepilogo Quiz', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ roundStartId: 'round-2', mancheIndex: 0, answers: [] }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    reliability.syncState$.next(nextQuizSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('uno snapshot di un nuovo round sblocca il legacy', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(of({
        recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
      }))
      .mockReturnValueOnce(of({ roundStartId: 'round-2', mancheIndex: 0, answers: [] }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    reliability.syncState$.next(nextQuizSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('dopo un refresh in Quiz non riapre il voto di una manche già votata', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    // Il server sa che Anna ha già risposto alla manche 2: il telefono che
    // rientra deve mostrarlo bloccato, non offrire un secondo voto.
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(
      of({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] }),
    );

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();

    expect(component.hasAnswered()).toBe(true);
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
  });

  it('con un blob Quiz legacy non lascia una domanda votabile dopo il refresh', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({
      recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
    }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(component.roundActive()).toBe(false);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).toBeNull();

    // Un altro snapshot della stessa apertura non riapre i tasti.
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).toBeNull();

    // Un annuncio del round successivo sblocca il telefono.
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', roundStartId: 'round-2',
      roundStartedAt: Date.now(), payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('un reannuncio senza identità non sblocca il legacy, ma il round dopo la fine sì', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({
      recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
    }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    // Reannuncio senza identità: non si può provare che sia una nuova domanda.
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).toBeNull();

    // La fine del round chiude il blocco; il nuovo annuncio può ripartire.
    ws.status$.next({ action: 'ROUND_ENDED' });
    fixture.detectChanges();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.quizCheckPending()).toBe(false);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('non riapre i tasti su un annuncio con lo stesso roundStartId, ma su uno nuovo sì', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // RIPRENDI ripete l'annuncio della stessa apertura: non deve sbloccare.
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', roundStartId: 'round-1',
      roundStartedAt: Date.now(), payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.quizCheckPending()).toBe(true);
    let buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    // Una nuova apertura è un round nuovo: l'attesa del vecchio non vale più.
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', roundStartId: 'round-2',
      roundStartedAt: Date.now() + 1, payload: {} });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('uno snapshot senza stato chiude l attesa del riepilogo e sblocca il legacy', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({
        recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
      }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    reliability.syncState$.next({ hasState: false });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.roundActive()).toBe(false);

    // Un secondo round trova il legacy: lo snapshot "senza stato" lo chiude.
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    reliability.syncState$.next({ hasState: false });
    await fixture.whenStable();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('uno snapshot a round chiuso chiude l attesa del riepilogo e sblocca il legacy', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({
        recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
      }));
    const closed = () => ({
      ...quizRoundSnapshot(), status: 'WAITING', roundDeadlineAt: Date.now() - 1_000,
    });

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    reliability.syncState$.next(closed());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    reliability.syncState$.next(closed());
    await fixture.whenStable();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('uno snapshot non ancora annunciato chiude l attesa del riepilogo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // La TV non ha ancora finito l'intro: non c'è una domanda da verificare.
    reliability.syncState$.next({ ...quizRoundSnapshot(), announced: false });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).toBeNull();
  });

  it('un QUIZ_STATE di manche nuova chiude l attesa del riepilogo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(of({ roundStartId: 'round-1', mancheIndex: 1, answers: [] }))
      .mockReturnValueOnce(throwError(() => new Error('offline')));

    // La verifica della manche 2 risponde senza voto: il telefono sa a che
    // manche è arrivato e i tasti restano aperti.
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizManche()).toBe(2);
    expect(component.quizCheckPending()).toBe(false);

    // Un riallineamento successivo non riceve il riepilogo: tasti chiusi.
    (component as any).realignWithServer();
    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // La TV passa alla manche 3: l'attesa della precedente non ha più senso.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 3 } });
    fixture.detectChanges();
    expect(component.quizManche()).toBe(3);
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('un QUIZ_STATE della stessa manche non sblocca un riepilogo fallito', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // La TV ripubblica la manche appena aperta: non è una verifica riuscita.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 2 } });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    // Uno stato vecchio (manche precedente) non vale come manche nuova.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 1 } });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // Solo la manche successiva chiude l'attesa.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 3 } });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.quiz-grid button').length).toBe(4);
  });

  it('uno stato vecchio non abbassa la manche: il successivo stato corrente non sblocca', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // La TV dichiara la manche corrente: diventa nota, senza sbloccare.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 2 } });
    fixture.detectChanges();
    expect(component.quizManche()).toBe(2);
    expect(component.quizCheckPending()).toBe(true);

    // Uno stato vecchio non deve abbassare la manche nota.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 1 } });
    fixture.detectChanges();
    expect(component.quizManche()).toBe(2);
    expect(component.quizCheckPending()).toBe(true);

    // Lo stato corrente non è una manche nuova: i tasti restano chiusi.
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 2 } });
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it('il retry della verifica Quiz ripete solo il riepilogo e non invia voti', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ roundStartId: 'round-1', mancheIndex: 1, answers: [] }));
    const submit = vi.spyOn(game, 'submitQuizAnswer');

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);
    expect(fixture.nativeElement.querySelector('.quiz-check-retry')).not.toBeNull();

    // Primo retry: la rete cade ancora, i tasti restano chiusi e nessun voto parte.
    (fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(summary).toHaveBeenCalledTimes(2);
    expect(component.quizCheckPending()).toBe(true);
    expect(fixture.nativeElement.querySelector('.quiz-check-retry')).not.toBeNull();
    expect(submit).not.toHaveBeenCalled();
    expect(game.quizAnswersSent).toEqual([]);

    // Secondo retry: il riepilogo risponde senza voto, i tasti si riaprono.
    (fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(summary).toHaveBeenCalledTimes(3);
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect(game.quizAnswersSent).toEqual([]);
  });

  it('il retry della verifica Quiz blocca la manche se il voto è già registrato', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({
        roundStartId: 'round-1', mancheIndex: 1,
        answers: [{ playerName: 'Anna', manche: 1, optionIndex: 2 }],
      }));
    const submit = vi.spyOn(game, 'submitQuizAnswer');

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    (fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.hasAnswered()).toBe(true);
    expect(component.selectedAnswer()).toBe(2);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
    expect(submit).not.toHaveBeenCalled();
    expect(game.quizAnswersSent).toEqual([]);
  });

  it('un riepilogo che non risponde scade e lascia il retry utilizzabile', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const hanging = new Subject<any>();
      const summary = vi.spyOn(game, 'quizAnswers')
        .mockReturnValueOnce(hanging.asObservable())
        .mockReturnValueOnce(of({ roundStartId: 'round-1', mancheIndex: 1, answers: [] }));

      reliability.syncState$.next(quizRoundSnapshot());
      fixture.detectChanges();
      expect(component.quizCheckPending()).toBe(true);
      expect(component.quizCheckFailed()).toBe(false);
      expect(fixture.nativeElement.querySelector('.quiz-check-retry')).toBeNull();

      vi.advanceTimersByTime(8_000);
      fixture.detectChanges();
      expect(component.quizCheckPending()).toBe(true);
      expect(component.quizCheckFailed()).toBe(true);
      expect(component.reliability.lastError()).toContain('Riprova verifica');
      const retry = fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement;
      expect(retry).not.toBeNull();

      retry.click();
      fixture.detectChanges();
      expect(summary).toHaveBeenCalledTimes(2);
      expect(component.quizCheckPending()).toBe(false);
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
      expect(buttons.length).toBe(4);
      expect(buttons.every((button) => !button.disabled)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scaduto il timeout, il retry con il voto già registrato blocca la risposta scelta', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const hanging = new Subject<any>();
      vi.spyOn(game, 'quizAnswers')
        .mockReturnValueOnce(hanging.asObservable())
        .mockReturnValueOnce(of({
          roundStartId: 'round-1', mancheIndex: 1,
          answers: [{ playerName: 'Anna', manche: 1, optionIndex: 2 }],
        }));
      const submit = vi.spyOn(game, 'submitQuizAnswer');

      reliability.syncState$.next(quizRoundSnapshot());
      fixture.detectChanges();
      expect(component.quizCheckPending()).toBe(true);

      // Il riepilogo non risponde: dopo 8 s l'attesa scade, senza aprire i tasti.
      vi.advanceTimersByTime(8_000);
      fixture.detectChanges();
      expect(component.quizCheckFailed()).toBe(true);
      expect(component.gameState()).toBe(PlayerStatus.VOTING);

      // Il retry trova il voto già registrato: blocco sulla risposta scelta,
      // nessun secondo voto inviato.
      (fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.quizCheckPending()).toBe(false);
      expect(component.quizCheckFailed()).toBe(false);
      expect(component.hasAnswered()).toBe(true);
      expect(component.selectedAnswer()).toBe(2);
      expect(component.gameState()).toBe(PlayerStatus.LOCKED);
      // Nessuna griglia votabile: resta la conferma della risposta scelta.
      expect(fixture.nativeElement.querySelector('.quiz-grid')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-sent-state')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('RISPOSTA INVIATA');
      expect(submit).not.toHaveBeenCalled();
      expect(game.quizAnswersSent).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('durante il retry la verifica resta visibile finché non risponde o scade', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      vi.spyOn(game, 'quizAnswers')
        .mockReturnValueOnce(new Subject<any>().asObservable())
        .mockReturnValueOnce(new Subject<any>().asObservable());

      reliability.syncState$.next(quizRoundSnapshot());
      fixture.detectChanges();
      vi.advanceTimersByTime(8_000);
      fixture.detectChanges();
      expect(component.quizCheckFailed()).toBe(true);

      const retry = fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement;
      expect(retry).not.toBeNull();
      retry.click();
      fixture.detectChanges();

      // Il pulsante sparisce, ma l'attesa non è più muta.
      expect(fixture.nativeElement.querySelector('.quiz-check-retry')).toBeNull();
      expect(component.quizCheckRetrying()).toBe(true);
      const status = fixture.nativeElement.querySelector('.quiz-check-status') as HTMLElement;
      expect(status).not.toBeNull();
      expect(status.textContent).toContain('Verifica in corso');

      // Nessuna risposta: lo stato resta per tutti gli 8 s, poi torna il retry.
      vi.advanceTimersByTime(7_999);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.quiz-check-status')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.quiz-check-retry')).toBeNull();

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(component.quizCheckRetrying()).toBe(false);
      expect(fixture.nativeElement.querySelector('.quiz-check-status')).toBeNull();
      expect(fixture.nativeElement.querySelector('.quiz-check-retry')).not.toBeNull();
      expect(component.quizCheckFailed()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('quando il riepilogo risponde durante il retry lo stato sparisce e i tasti si riaprono', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const answer = new Subject<any>();
      vi.spyOn(game, 'quizAnswers')
        .mockReturnValueOnce(new Subject<any>().asObservable())
        .mockReturnValueOnce(answer.asObservable());
      const submit = vi.spyOn(game, 'submitQuizAnswer');

      reliability.syncState$.next(quizRoundSnapshot());
      fixture.detectChanges();
      vi.advanceTimersByTime(8_000);
      fixture.detectChanges();
      expect(component.quizCheckFailed()).toBe(true);

      (fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.quiz-check-status')).not.toBeNull();
      let buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
      expect(buttons.length).toBe(4);
      expect(buttons.every((button) => button.disabled)).toBe(true);

      // Il riepilogo risponde senza voto: fine dell'attesa, tasti di nuovo aperti.
      answer.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [] });
      answer.complete();
      fixture.detectChanges();

      expect(component.quizCheckRetrying()).toBe(false);
      expect(component.quizCheckPending()).toBe(false);
      expect(component.quizCheckFailed()).toBe(false);
      expect(fixture.nativeElement.querySelector('.quiz-check-status')).toBeNull();
      expect(component.reliability.lastError()).toBeNull();
      buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
      expect(buttons.length).toBe(4);
      expect(buttons.every((button) => !button.disabled)).toBe(true);
      expect(submit).not.toHaveBeenCalled();
      expect(game.quizAnswersSent).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un altro errore non nasconde il retry della verifica Quiz', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ roundStartId: 'round-1', mancheIndex: 1, answers: [] }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);
    expect(component.quizCheckFailed()).toBe(true);

    // Un errore di un'altra azione non deve spegnere il pulsante.
    reliability.lastError.set('Risposta non inviata: riprova.');
    fixture.detectChanges();
    const retry = fixture.nativeElement.querySelector('.quiz-check-retry') as HTMLButtonElement;
    expect(retry).not.toBeNull();

    retry.click();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    // L'errore dell'altra azione resta: la verifica non lo ha prodotto.
    expect(component.reliability.lastError()).toBe('Risposta non inviata: riprova.');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('uno snapshot con la stessa chiave ma un roundStartId nuovo chiude l attesa', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ roundStartId: 'round-2', mancheIndex: 0, answers: [] }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    // Stessa chiave di round (g1-r4), ma il server ha aperto una nuova
    // identità: è un round nuovo, non un reannuncio.
    reliability.syncState$.next({ ...quizRoundSnapshot(), roundStartId: 'round-2' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.quiz-grid button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
  });

  it('uno snapshot con la stessa chiave ma un roundStartId nuovo sblocca il legacy', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(of({
        recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
      }))
      .mockReturnValueOnce(of({ roundStartId: 'round-2', mancheIndex: 0, answers: [] }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    reliability.syncState$.next({ ...quizRoundSnapshot(), roundStartId: 'round-2' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('l espulsione chiude l attesa del riepilogo Quiz', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.quizCheckPending()).toBe(true);

    ws.status$.next({ action: 'PLAYER_REMOVED', playerName: 'Anna' });
    fixture.detectChanges();
    expect(component.nickname()).toBeNull();
    expect(component.quizCheckPending()).toBe(false);
    expect(component.reliability.lastError()).toBeNull();
  });

  it('l espulsione sblocca il legacy: al rientro senza identità i tasti si aprono', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({
      recoveryBlocked: 'legacy-quiz-state', roundStartId: '', mancheIndex: -1, answers: [],
    }));

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.WAITING);

    ws.status$.next({ action: 'PLAYER_REMOVED', playerName: 'Anna' });
    fixture.detectChanges();
    expect(component.nickname()).toBeNull();

    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ', payload: {} });
    fixture.detectChanges();
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(fixture.nativeElement.querySelector('.quiz-grid')).not.toBeNull();
  });

  it('al refresh trova la manche corrente dal server quando il payload non la contiene', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({
      roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }],
    }));
    const snapshot = quizRoundSnapshot();
    snapshot.currentRound.payload = { questions: [{ question: 'A' }, { question: 'B' }] };
    reliability.syncState$.next(snapshot);
    expect(component.quizManche()).toBe(2);
    expect(component.answeredManche()).toBe(2);
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
  });

  it('ignora un riepilogo Quiz arrivato dopo la manche successiva', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());
    reliability.syncState$.next(quizRoundSnapshot());
    ws.status$.next({ action: 'QUIZ_STATE', state: { manche: 3, mancheReveal: false } });
    summary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
    expect(component.quizManche()).toBe(3);
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.hasAnswered()).toBe(false);
  });

  it('ignora un riepilogo partito prima del rientro e ne richiede uno nuovo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const oldSummary = new Subject<any>();
    const freshSummary = new Subject<any>();
    const answers = vi.spyOn(game, 'quizAnswers')
      .mockReturnValueOnce(oldSummary.asObservable()).mockReturnValueOnce(freshSummary.asObservable());
    reliability.syncState$.next(quizRoundSnapshot());
    (component as any).realignWithServer();
    reliability.syncState$.next(quizRoundSnapshot());
    oldSummary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 0 }] });
    expect(component.hasAnswered()).toBe(false);
    expect(answers).toHaveBeenCalledTimes(2);
    freshSummary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
  });

  it('scarta il riepilogo del vecchio round anche se la chiave viene riutilizzata', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const oldSummary = new Subject<any>();
    const freshSummary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValueOnce(oldSummary.asObservable())
      .mockReturnValueOnce(freshSummary.asObservable());
    reliability.syncState$.next(quizRoundSnapshot());
    reliability.syncState$.next({ ...quizRoundSnapshot(), roundStartId: 'round-2' });
    oldSummary.next({ roundStartId: 'round-1', mancheIndex: 1,
      answers: [{ playerName: 'Anna', manche: 1, optionIndex: 0 }] });
    expect(component.hasAnswered()).toBe(false);
    freshSummary.next({ roundStartId: 'round-2', mancheIndex: 1,
      answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
    expect(component.selectedAnswer()).toBe(1);
  });

  it('recupera la manche successiva anche senza il suo evento WebSocket', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({ roundStartId: 'round-1', mancheIndex: 2,
      answers: [{ playerName: 'Anna', manche: 2, optionIndex: 1 }] }));
    reliability.syncState$.next(quizRoundSnapshot());
    expect(component.quizManche()).toBe(3);
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
  });

  it('un riepilogo tardivo non sblocca né sovrascrive il voto confermato', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    const initial = new Subject<any>();
    const requests = vi.spyOn(game, 'quizAnswers').mockReturnValueOnce(initial.asObservable())
      .mockReturnValueOnce(summary.asObservable());
    reliability.syncState$.next(quizRoundSnapshot());
    ws.status$.next({ action: 'QUIZ_STATE', roundStartId: 'round-1', state: { manche: 2 } });
    reliability.syncState$.next(quizRoundSnapshot());
    expect(requests).toHaveBeenCalledTimes(2);
    // La verifica più recente non trova un voto: i tasti si aprono, Anna vota,
    // poi arriva il riepilogo della richiesta precedente.
    summary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [] });
    summary.complete();
    component.sendVote(1);
    initial.next({ roundStartId: 'round-1', mancheIndex: 1,
      answers: [{ playerName: 'Anna', manche: 1, optionIndex: 0 }] });
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
  });

  it('due telefoni recuperano indipendentemente i propri voti Quiz', async () => {
    const other = TestBed.createComponent(RemoteComponent);
    other.detectChanges();
    await other.whenStable();
    component.nickname.set('Anna');
    other.componentInstance.nickname.set('Bruno');
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const anna = new Subject<any>();
    const bruno = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValueOnce(anna.asObservable()).mockReturnValueOnce(bruno.asObservable());
    try {
      reliability.syncState$.next(quizRoundSnapshot());
      bruno.next({ roundStartId: 'round-1', mancheIndex: 1,
        answers: [{ playerName: 'Bruno', manche: 1, optionIndex: 0 }] });
      expect(other.componentInstance.selectedAnswer()).toBe(0);
      expect(component.hasAnswered()).toBe(false);
      anna.next({ roundStartId: 'round-1', mancheIndex: 1,
        answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
      expect(component.selectedAnswer()).toBe(1);
      expect(other.componentInstance.selectedAnswer()).toBe(0);
    } finally {
      other.destroy();
    }
  });

  it('un riepilogo arrivato dopo il reveal non riapre il Quiz', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());
    reliability.syncState$.next(quizRoundSnapshot());
    ws.status$.next({ action: 'QUIZ_STATE', state: { manche: 2, mancheReveal: true } });
    summary.next({ roundStartId: 'round-1', mancheIndex: 1, answers: [{ playerName: 'Anna', manche: 1, optionIndex: 1 }] });
    expect(component.gameState()).toBe(PlayerStatus.WAITING);
  });

  it('dopo un refresh in Musica il telefono prenota il brano in corso', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'MUSIC',
      roundKey: 'g1-r2',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: { roundKey: 'g1-r2', type: 'MUSIC', payload: { question: 'Brano?', options: [] } },
    });
    await fixture.whenStable();

    expect(component.questionType()).toBe('MUSIC');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);

    component.sendBuzz();
    expect(ws.publishedAnswers.at(-1)).toMatchObject({ playerName: 'Anna', answerIndex: -1 });
  });

  it('dopo un refresh in Bomba il telefono riprende a leggere lo stato', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    game.bombaStateCalls.length = 0;

    reliability.syncState$.next({
      hasState: true,
      status: 'RUNNING',
      roundType: 'BOMBA',
      roundKey: 'g1-r6',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: { roundKey: 'g1-r6', type: 'BOMBA', payload: { act: 2 } },
    });
    await fixture.whenStable();

    expect(component.questionType()).toBe('BOMBA');
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    // La bomba vive nella TV: il telefono riprende il polling da solo.
    expect(game.bombaStateCalls.at(-1)).toEqual({ gameId: component.gameId(), playerName: 'Anna' });
  });

  it('dopo un refresh ritrova l ordine Timeline già inviato senza rimandarlo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitTimeline');
    game.savedTimelineOrder = [2, 1];
    vi.useFakeTimers();
    try {
      reliability.syncState$.next({
        hasState: true,
        status: 'RUNNING',
        roundType: 'TIMELINE',
        roundKey: 'g1-r5',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: {
          roundKey: 'g1-r5',
          type: 'TIMELINE',
          payload: { roundId: 'r5', items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }] },
        },
      });

      expect(component.gameState()).toBe(PlayerStatus.VOTING);
      // Il telefono ha riletto la sua risposta: è l'ordine scelto, non quello della TV.
      expect(game.timelineAnswerCalls.at(-1)).toMatchObject({ playerName: 'Anna', roundId: 'r5' });
      expect(component.orderedCards().map((card) => card.id)).toEqual([2, 1]);

      vi.advanceTimersByTime(600);
      // L'ordine buono sta già sul server: non si rimanda nulla.
      expect(submit).not.toHaveBeenCalled();

      component.moveCard(2, 1);
      vi.advanceTimersByTime(400);
      expect(submit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dopo un refresh senza risposta Timeline invia l ordine iniziale', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitTimeline');
    game.savedTimelineOrder = null;
    vi.useFakeTimers();
    try {
      reliability.syncState$.next({
        hasState: true,
        status: 'RUNNING',
        roundType: 'TIMELINE',
        roundKey: 'g1-r5',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: {
          roundKey: 'g1-r5',
          type: 'TIMELINE',
          payload: { roundId: 'r5', items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }] },
        },
      });

      vi.advanceTimersByTime(400);
      // Chi non ha mai risposto non resta senza invio: vale l'ordine iniziale.
      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit.mock.calls.at(-1)?.[2]).toEqual([1, 2]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('se la lettura dell ordine Timeline fallisce non invia nulla da solo', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitTimeline');
    vi.spyOn(game, 'timelineAnswer').mockReturnValue(throwError(() => ({ status: 503 })));
    vi.useFakeTimers();
    try {
      reliability.syncState$.next({
        hasState: true,
        status: 'RUNNING',
        roundType: 'TIMELINE',
        roundKey: 'g1-r5',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: {
          roundKey: 'g1-r5',
          type: 'TIMELINE',
          payload: { roundId: 'r5', items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }] },
        },
      });

      // Non si sa se l'ordine è già sul server: sovrascriverlo sarebbe peggio.
      vi.advanceTimersByTime(600);
      expect(submit).not.toHaveBeenCalled();
      expect(component.gameState()).toBe(PlayerStatus.VOTING);

      component.moveCard(2, -1);
      vi.advanceTimersByTime(400);
      expect(submit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('se la risposta Timeline arriva dopo una modifica tiene l ordine del giocatore', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitTimeline');
    const summary = new Subject<any>();
    vi.spyOn(game, 'timelineAnswer').mockReturnValue(summary.asObservable());
    vi.useFakeTimers();
    try {
      reliability.syncState$.next({
        hasState: true,
        status: 'RUNNING',
        roundType: 'TIMELINE',
        roundKey: 'g1-r5',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: {
          roundKey: 'g1-r5',
          type: 'TIMELINE',
          payload: {
            roundId: 'r5',
            items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' }],
          },
        },
      });

      // Il giocatore sposta una carta mentre il server sta ancora rispondendo.
      component.moveCard(2, -1);
      vi.advanceTimersByTime(400);
      expect(submit).toHaveBeenCalledTimes(1);

      summary.next({ answered: true, order: [3, 2, 1] });
      summary.complete();

      // Il server parlava dell'ordine di prima: resta quello appena scelto.
      expect(component.orderedCards().map((card) => card.id)).toEqual([2, 1, 3]);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit.mock.calls.at(-1)?.[2]).toEqual([2, 1, 3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('anche spostando una carta e rimettendola la risposta Timeline è ignorata', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const submit = vi.spyOn(game, 'submitTimeline');
    const summary = new Subject<any>();
    vi.spyOn(game, 'timelineAnswer').mockReturnValue(summary.asObservable());
    vi.useFakeTimers();
    try {
      reliability.syncState$.next({
        hasState: true,
        status: 'RUNNING',
        roundType: 'TIMELINE',
        roundKey: 'g1-r5',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: {
          roundKey: 'g1-r5',
          type: 'TIMELINE',
          payload: {
            roundId: 'r5',
            items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' }],
          },
        },
      });

      // Sposta e rimette com'era: l'ordine finale coincide con quello iniziale.
      component.moveCard(2, -1);
      component.moveCard(2, 1);
      expect(component.orderedCards().map((card) => card.id)).toEqual([1, 2, 3]);
      vi.advanceTimersByTime(400);
      expect(submit).toHaveBeenCalledTimes(1);

      summary.next({ answered: true, order: [3, 2, 1] });
      summary.complete();

      // Ha scelto l'ordine mostrato: quello del server non vale più.
      expect(component.orderedCards().map((card) => card.id)).toEqual([1, 2, 3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('due snapshot della stessa manche fanno una sola richiesta al server', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    const answers = vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());

    // Il secondo snapshot arriva mentre la prima richiesta è ancora in volo.
    reliability.syncState$.next(quizRoundSnapshot());
    reliability.syncState$.next(quizRoundSnapshot());

    expect(answers).toHaveBeenCalledTimes(1);
  });

  it('con la sessione scaduta non entra da sola: nome pronto e avviso', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(false);
    vi.spyOn(reliability, 'start').mockResolvedValue(false);

    await reloadPhone();

    // Niente ingresso silenzioso: il nome resta pronto, ma il giocatore deve
    // sapere che la sessione non è più quella di prima.
    expect(component.tempNickname).toBe('Anna');
    expect(component.nickname()).toBeNull();
    expect(reliability.lastError() ?? '').toContain('sessione');
  });

  it('dopo l espulsione il telefono non invia risposte e non rientra da solo', async () => {
    component.nickname.set('Anna');
    component.questionType.set('QUIZ');
    component.gameState.set(PlayerStatus.VOTING);
    const startsBefore = reliability.started.length;

    ws.status$.next({ action: 'PLAYER_REMOVED', playerName: 'Anna' });
    fixture.detectChanges();

    expect(component.removedNotice()).toBe(true);
    expect(component.nickname()).toBeNull();
    expect(localStorage.getItem('nickname')).toBeNull();
    expect(reliability.started.length).toBe(startsBefore);

    // Senza nome non c'è squadra: il tocco non deve finire sul server.
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    component.sendVote(1);
    expect(game.quizAnswersSent).toEqual([]);
  });

  it('senza ?game= adotta la serata aperta dal server, non quella salvata', async () => {
    localStorage.setItem('activeGameId', '9');
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);

    // FakeGameService.getActiveGame() risponde 1: la serata vecchia (9) non
    // deve trascinare la squadra sulla partita sbagliata.
    await reloadPhone();

    expect(component.gameId()).toBe(1);
    expect(ws.subscribedGames.at(-1)).toBe(1);
    expect(reliability.started.at(-1)?.gameId).toBe(1);
  });

  it('con il lock della scheda già preso questo telefono non risponde', async () => {
    // Un'altra scheda tiene il lock: il browser risponde `null` subito.
    const request = vi.fn(async (...args: any[]) => (args[2] as (lock: unknown) => void)(null));
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    try {
      await reloadPhone();
      component.nickname.set('Anna');
      component.questionType.set('QUIZ');
      component.gameState.set(PlayerStatus.VOTING);

      expect(component.inputBlocked()).toBe(true);
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      component.sendVote(1);
      expect(game.quizAnswersSent).toEqual([]);
      expect(ws.publishedAnswers).toEqual([]);
    } finally {
      delete (navigator as any).locks;
    }
  });

  it('con due schede sullo stesso telefono la seconda non invia risposte', async () => {
    component.nickname.set('Anna');
    component.questionType.set('QUIZ');
    component.gameState.set(PlayerStatus.VOTING);
    reliability.duplicateDisplay.set(true);

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    component.sendVote(0);

    // La partita è una sola: la scheda doppia resta a guardare.
    expect(game.quizAnswersSent).toEqual([]);
  });

  it('fiche sul telefono: pila con contatore e tocco lungo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.closeButtonTest();
    component.gameState.set(PlayerStatus.VOTING);
    component.questionType.set('AZZARDO');
    component.azzardoState.set({
      phase: 'BET',
      options: [1970, 1971, 1975, 1980],
      unit: 'anno',
      chipValue: 20,
      odds: 3,
      lossMultiplier: 0.8,
      manche: 1,
      total: 4,
      ready: [{
        playerName: 'Anna',
        chips: [2, 0, 0, 0],
        maxBet: 200,
        chipsBank: 10,
        chipsCap: 10,
        points: 200,
      }],
      rows: [],
    });
    component.azzardoChips.set([2, 0, 0, 0]);
    fixture.detectChanges();

    const stack = fixture.nativeElement.querySelectorAll('.azzardo-chip-stack')[0] as HTMLElement;
    expect(stack.querySelectorAll('.fiche').length).toBe(2);
    expect(stack.querySelector('.fiche-count')?.textContent).toContain('×2');
    // Il tocco semplice e la pressione lunga finiscono sullo stesso stato locale.
    expect(stack.getAttribute('aria-label')).toContain('tocco lungo');

    vi.useFakeTimers();
    component.azzardoPressStart(0, new Event('pointerdown'));
    expect(component.azzardoChips()[0]).toBe(3);
    vi.advanceTimersByTime(700);
    expect(component.azzardoChips()[0]).toBeGreaterThan(3);
    component.azzardoPressEnd();
    const afterRelease = component.azzardoChips()[0];
    vi.advanceTimersByTime(400);
    expect(component.azzardoChips()[0]).toBe(afterRelease);
    vi.useRealTimers();
  });

  it('F-28: in Blackjack ogni telefono vede solo la propria mano', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.questionType.set('BLACKJACK');
    component.gameState.set(PlayerStatus.VOTING);

    component.blackjackState.set({
      phase: 'REVEAL', currentTable: 'Bruno', cards: ['A♠', 'K♥'], handTotal: 21,
      result: { points: 100 },
    });
    fixture.detectChanges();
    const other = String(fixture.nativeElement.textContent);
    expect(other).not.toContain('A♠');
    expect(other).not.toContain('21');
    expect(other).toContain('Mano di Bruno');

    component.blackjackState.set({
      phase: 'REVEAL', currentTable: 'Anna', cards: ['A♠', 'K♥'], handTotal: 21,
      result: { points: 100 },
    });
    fixture.detectChanges();
    expect(String(fixture.nativeElement.textContent)).toContain('A♠');
  });
});
