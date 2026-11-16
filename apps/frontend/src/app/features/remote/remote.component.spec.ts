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
    component.arenaQuestion.set({ text: 'Domanda', options: ['A', 'B'], isTrueFalse: false, questionId: 'q1' });
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pending = new Subject<any>();
    const answer = vi.spyOn(game, 'answerArenaQuestion').mockReturnValue(pending.asObservable());

    component.sendArenaAnswer(0);
    component.sendArenaAnswer(1);

    expect(answer).toHaveBeenCalledTimes(1);
    expect(component.arenaQuestion()?.questionId).toBe('q1');
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
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const oldAnswer = new Subject<any>();
    const newAnswer = new Subject<any>();
    const answer = vi.spyOn(game, 'answerArenaQuestion')
      .mockReturnValueOnce(oldAnswer.asObservable())
      .mockReturnValueOnce(newAnswer.asObservable());
    component.arenaQuestion.set({ text: 'Vecchia', options: ['A', 'B'], isTrueFalse: false, questionId: 'old' });
    component.sendArenaAnswer(0);
    ws.status$.next({ action: 'ROUND_ENDED' });
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

  it('mantiene la domanda Arena se la risposta arriva al server durante la pausa', () => {
    component.nickname.set('Anna');
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
    expect(bodies).toContainEqual({ action: 'JOIN_GAME', playerName: 'Anna' });
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
    const game = TestBed.inject(GameService) as unknown as FakeGameService;

    component.sendVote(1);

    expect(game.quizAnswersSent).toEqual([1]);
    expect(ws.publishedAnswers).toHaveLength(0);
    expect(component.gameState()).toBe('LOCKED');
  });

  it('keeps the phone unlocked when a vote or buzz cannot be sent', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('QUIZ');
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

    finishSync();
    await realign;
    expect(component.resyncing()).toBe(false);
    expect(component.inputReady()).toBe(true);
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

    component.azzardoState.set(state(0, 0));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    // Chi ha punti può preparare la puntata, ma non parte da sola: serve la
    // conferma e almeno una fiche sul tavolo.
    component.azzardoState.set(state(100, 100));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    component.azzardoAddChip(0, -1);
    component.azzardoConfirmBet();
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);
    expect(reliability.lastError()).toContain('almeno una fiche');

    component.azzardoPick(0);
    component.azzardoConfirmBet();
    const bets = ws.broadcasted.filter((entry) => entry.body.action === 'AZZARDO_ACTION');
    expect(bets).toHaveLength(1);
    expect(bets[0].body.value.chips).toEqual([1, 0, 0, 0]);
  });

  it('rispetta il tetto di fiches della squadra e cita i 1000 punti di massimo', async () => {
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
      winCap: 1000,
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
    expect(component.azzardoConvertHint()).toContain('1000');
    expect(component.azzardoConvertHint()).toContain('manche');

    // Se il server non manda il tetto, resta quello del regolamento.
    const withoutCap: any = azzardoState({});
    delete withoutCap.winCap;
    component.azzardoState.set(withoutCap);
    expect(component.azzardoConvertHint()).toContain('1000');
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
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: {
        roundKey: 'g1-r4',
        type: 'QUIZ',
        payload: { manche: 2, question: 'Domanda?', options: ['A', 'B'] },
      },
    };
  }

  it('apre subito i tasti del Quiz e li blocca quando il server conferma il voto', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const summary = new Subject<any>();
    vi.spyOn(game, 'quizAnswers').mockReturnValue(summary.asObservable());

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();

    // Il server è lento: il telefono non resta fermo ad aspettarlo.
    expect(component.gameState()).toBe(PlayerStatus.VOTING);
    expect(component.hasAnswered()).toBe(false);

    summary.next({ mancheIndex: 2, answers: [{ playerName: 'Anna', manche: 2, optionIndex: 1 }] });
    summary.complete();

    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
    expect(component.hasAnswered()).toBe(true);
    expect(component.selectedAnswer()).toBe(1);
  });

  it('dopo un refresh in Quiz non riapre il voto di una manche già votata', async () => {
    localStorage.setItem('nickname', 'Anna');
    reliability.resumedSession.set(true);
    await reloadPhone();

    // Il server sa che Anna ha già risposto alla manche 2: il telefono che
    // rientra deve mostrarlo bloccato, non offrire un secondo voto.
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'quizAnswers').mockReturnValue(
      of({ mancheIndex: 2, answers: [{ playerName: 'Anna', manche: 2, optionIndex: 1 }] }),
    );

    reliability.syncState$.next(quizRoundSnapshot());
    await fixture.whenStable();

    expect(component.hasAnswered()).toBe(true);
    expect(component.selectedAnswer()).toBe(1);
    expect(component.gameState()).toBe(PlayerStatus.LOCKED);
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
});
