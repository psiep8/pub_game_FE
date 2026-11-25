import { readFileSync } from 'node:fs';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { GameComponent } from './game.component';
import { AiGeneratorService } from '../../core/services/ai-generator-service';
import { AudioService } from '../../core/services/audio.service';
import { GameService } from '../../core/services/game.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { PlayerAvatarService } from '../../core/services/player-avatar.service';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import {
  FakeAiGeneratorService,
  FakeAudioService,
  FakeGameService,
  FakeWebSocketService,
} from '../../shared/testing/test-doubles';
import { FakeReliabilityService } from '../../shared/testing/test-doubles';
import { ReliabilityService } from '../../core/services/reliability.service';
import { RoundManagerService } from '../../core/services/round-manager.service';
import { GameModeService } from '../../core/services/game-mode-factory.service';
import { ButtonTestService } from '../../core/services/button-test.service';
import { FakeButtonTestService } from '../../shared/testing/fake-button-test.service';
import { GamePhase } from '../../shared/enums/game-phase';
import { WsAction } from '../../shared/enums/ws-action';
import { bonusEntranceFor } from '../../shared/bonus-entrances';
import { BonusEntrance } from '../bonus/bonus-entrance/bonus-entrance.component';
import { GAME_TIMINGS } from '../../shared/models/game-timings';
import { QuizMode } from '../games/quiz/quiz.mode';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;
  let ws: FakeWebSocketService;
  let leaderboard: LeaderboardService;
  let reliability: FakeReliabilityService;

  beforeEach(async () => {
    localStorage.clear();
    // Ogni test è una scheda nuova: l'ingresso già visto non si trascina.
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: ReliabilityService, useClass: FakeReliabilityService as any },
        { provide: GameService, useClass: FakeGameService },
        { provide: AiGeneratorService, useClass: FakeAiGeneratorService },
        { provide: AudioService, useClass: FakeAudioService },
        { provide: ButtonTestService, useClass: FakeButtonTestService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    leaderboard = TestBed.inject(LeaderboardService);
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

  /** `document.hidden` è in sola lettura: la visibilità si finge qui. */
  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  }

  it('la scheda nascosta ferma anche un round normale, e al ritorno lo riprende', () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const pause = vi.fn();
    const resume = vi.fn();
    component.currentMode.set({ type: 'QUIZ', pause, resume } as any);
    component.currentGameId.set(1);

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    // Nessuno guarda: il round si ferma anche sul server, non solo in TV.
    expect(component.isPaused()).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(game.pauseCalls).toEqual([1]);
    expect(audio.played).toContain('pause-beds');

    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    // La pausa l'ha aperta la scheda nascosta: al ritorno si chiude da sola.
    expect(component.isPaused()).toBe(false);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(game.resumeCalls).toEqual([1]);
    expect(audio.played).toContain('resume-beds');

    delete (document as any).hidden;
  });

  it('senza round né bonus la scheda nascosta non apre una pausa', () => {
    component.currentGameId.set(1);
    component.currentMode.set(null);
    component.bonusActive.set(false);

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));

    // In lobby non c'è niente da fermare: nessun cartello a sorpresa.
    expect(component.isPaused()).toBe(false);

    delete (document as any).hidden;
  });

  it('la pausa del presentatore resta quando la scheda torna visibile', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    component.currentMode.set({ type: 'QUIZ', pause, resume } as any);
    component.currentGameId.set(1);
    component.togglePause();
    expect(component.isPaused()).toBe(true);

    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));

    // Senza una pausa nata dalla scheda, al ritorno non si riprende da soli.
    expect(component.isPaused()).toBe(true);
    expect(resume).not.toHaveBeenCalled();

    delete (document as any).hidden;
  });

  it('la pausa funziona anche durante un bonus, che non ha una modalità di round', () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    component.currentGameId.set(1);
    component.currentMode.set(null);
    component.bonusActive.set(true);

    component.togglePause();
    expect(component.isPaused()).toBe(true);
    expect(audio.played).toContain('pause-beds');
    // Nessun round aperto: il server non viene toccato.
    expect(game.pauseCalls).toEqual([]);

    component.togglePause();
    expect(component.isPaused()).toBe(false);
    expect(audio.played).toContain('resume-beds');
    expect(game.resumeCalls).toEqual([]);

    // Fuori da round e bonus la pausa resta spenta.
    component.bonusActive.set(false);
    component.togglePause();
    expect(component.isPaused()).toBe(false);
  });

  it('si riprende anche se il bonus si chiude mentre la TV è in pausa', () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    component.currentGameId.set(1);
    component.currentMode.set(null);
    component.bonusActive.set(true);

    component.togglePause();
    expect(component.isPaused()).toBe(true);

    // Il bonus finisce per un'altra strada (regia, reset) mentre la sala è ferma.
    component.bonusActive.set(false);
    component.togglePause();

    // L'overlay si chiude e il sottofondo torna: la pausa non resta appesa.
    expect(component.isPaused()).toBe(false);
    expect(audio.played).toContain('resume-beds');
    // Non c'era un round aperto: il server non viene toccato.
    expect(game.resumeCalls).toEqual([]);

    // E il tasto torna al suo mestiere: fuori da round e bonus non apre una pausa.
    component.togglePause();
    expect(component.isPaused()).toBe(false);
  });

  it('riapre un bonus in pausa dopo un refresh della TV', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    component.currentGameId.set(1);

    tv.applyAuthoritativeState({
      hasState: true,
      status: 'CREATED',
      roundIndex: 0,
      tvCheckpoint: {
        mode: 'BONUS_CASINO_COLOR',
        roundIndex: -1,
        revision: Date.now(),
        state: { phase: 'PICK', manche: 1, secondsLeft: 9, savedAt: Date.now(), paused: true },
      },
    });

    // La sala era ferma quando la TV si è ricaricata: si torna in pausa.
    expect(component.isPaused()).toBe(true);
    expect(component.bonusResume()?.paused).toBe(true);
  });

  it('la pausa non si spegne quando il bonus riparte dopo il refresh', async () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    component.currentGameId.set(1);
    component.isPaused.set(true);

    const tv = component as unknown as { beginBonus(type: string): Promise<void> };
    await tv.beginBonus('CASINO_COLOR');

    // Il reset del bonus non deve riaccendere la sala: pausa e silenzio restano.
    expect(component.isPaused()).toBe(true);
    expect(audio.played.at(-1)).toBe('pause-beds');
  });

  it('annuncia la pausa al telefono che rientra', () => {
    component.currentGameId.set(1);
    component.bonusActive.set(true);
    component.togglePause();
    ws.broadcasted.length = 0;

    // Il telefono rimanda JOIN_GAME a ogni riconnessione: la TV gli ridice
    // che la sala è ferma, anche se l'annuncio originale è andato perso.
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno' });

    expect(ws.broadcasted.at(-1)?.body.action).toBe('GAME_PAUSED');
  });

  it('alla ripresa ripubblica lo stato del round per chi si è ricollegato', () => {
    component.currentGameId.set(1);
    component.currentMode.set({ type: 'AZZARDO', pause: vi.fn(), resume: vi.fn() } as any);
    component.showQuestion.set(true);
    ws.broadcastStatus(1, { action: 'AZZARDO_STATE', state: { phase: 'BET', secondsLeft: 9 } });

    component.togglePause();
    ws.broadcasted.length = 0;
    component.togglePause();

    const actions = ws.broadcasted.map((entry) => entry.body.action);
    expect(actions).toContain('GAME_RESUMED');
    expect(actions).toContain('AZZARDO_STATE');
    // Lo stato segue il via: il telefono lo applica a sala già aperta.
    expect(actions.indexOf('GAME_RESUMED')).toBeLessThan(actions.indexOf('AZZARDO_STATE'));
    expect(ws.broadcasted.find((entry) => entry.body.action === 'AZZARDO_STATE')?.body.state)
      .toEqual({ phase: 'BET', secondsLeft: 9 });
  });

  it('al rientro di un telefono ripubblica lo stato del round', () => {
    component.currentGameId.set(1);
    component.currentMode.set({ type: 'BIGLIE' } as any);
    component.showQuestion.set(true);
    ws.broadcastStatus(1, { action: 'BIGLIE_STATE', state: { phase: 'RACE', secondsLeft: 4 } });
    ws.broadcasted.length = 0;

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno' });

    expect(ws.broadcasted.some((entry) => entry.body.action === 'BIGLIE_STATE')).toBe(true);
  });

  it('salva lo stato nello storage alla pausa, non a ogni tick', () => {
    component.currentGameId.set(1);
    component.currentMode.set({ type: 'BIGLIE', pause: vi.fn(), resume: vi.fn() } as any);
    component.showQuestion.set(true);
    // Due tick di fila come nelle Biglie: nessuno deve toccare lo storage.
    ws.broadcastStatus(1, { action: 'BIGLIE_STATE', state: { phase: 'RACE', secondsLeft: 3 } });
    ws.broadcastStatus(1, { action: 'BIGLIE_STATE', state: { phase: 'RACE', secondsLeft: 2 } });
    expect(ws.persistCalls).toBe(0);

    component.togglePause();

    // Alla pausa si salva l'ultimo tick, quello che i telefoni devono vedere.
    expect(ws.persistCalls).toBe(1);
    expect(ws.lastStateFor(1, 'BIGLIE_STATE')).toEqual({
      action: 'BIGLIE_STATE',
      state: { phase: 'RACE', secondsLeft: 2 },
    });
  });

  it('dopo un refresh in pausa ripete lo stato del round non ancora a schermo', () => {
    component.currentGameId.set(1);
    component.isPaused.set(true);
    // La TV è appena ripartita: il round è solo nel pannello di ripristino.
    component.recoveredRound.set({
      type: 'AZZARDO', label: 'Azzardo', secondsLeft: 12, resumable: true, paused: true,
    });
    ws.broadcastStatus(1, { action: 'AZZARDO_STATE', state: { phase: 'BET', secondsLeft: 12 } });
    ws.broadcasted.length = 0;

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Carla' });

    expect(ws.broadcasted.find((entry) => entry.body.action === 'AZZARDO_STATE')?.body.state)
      .toEqual({ phase: 'BET', secondsLeft: 12 });
  });

  it('al rientro di un telefono in pausa ripubblica lo stato del bonus', () => {
    component.currentGameId.set(1);
    component.bonusActive.set(true);
    component.bonusType.set('CAVALLO');
    ws.broadcastStatus(1, { action: 'CAVALLO_STATE', state: { phase: 'PICK', secondsLeft: 7 } });

    component.togglePause();
    ws.broadcasted.length = 0;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });

    const actions = ws.broadcasted.map((entry) => entry.body.action);
    expect(actions).toContain('GAME_PAUSED');
    expect(actions).toContain('CAVALLO_STATE');
  });

  it('mette il loop della classifica e chiude sul gioco, o sulla lobby a serata finita', () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const rounds = TestBed.inject(RoundManagerService);
    component.currentMode.set({ type: 'QUIZ' } as any);

    // Classifica di metà serata: fanfara, poi di nuovo la musica del gioco.
    component.pendingLeaderboardType.set('QUICK');
    component.showPendingLeaderboard();
    expect(audio.played.at(-1)).toBe('bed-loop-classifica');
    component.closeLeaderboard();
    expect(audio.played.at(-1)).toBe('bed-QUIZ');

    // Classifica finale, con l'ultimo gioco ancora in memoria: il finale ha il
    // suo loop, e alla chiusura si va in lobby.
    rounds.restoreRound(40);
    component.pendingLeaderboardType.set('DETAILED');
    component.showPendingLeaderboard();
    expect(audio.played.at(-1)).toBe('bed-loop-gioco-casino-finale');
    component.closeLeaderboard();
    expect(audio.played.at(-1)).toBe('bed-lobby');

    // Anche forzata dalla regia, l'ultima classifica suona il finale.
    rounds.restoreRound(40);
    audio.played.length = 0;
    component.adminShowLeaderboard();
    expect(audio.played).toContain('bed-loop-gioco-casino-finale');
  });

  it('in pausa tace anche il sottofondo e riparte al ritorno', () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const pause = vi.fn();
    const resume = vi.fn();
    component.currentMode.set({ type: 'QUIZ', pause, resume } as any);
    component.currentGameId.set(1);

    component.togglePause();
    expect(pause).toHaveBeenCalled();
    expect(component.isPaused()).toBe(true);
    expect(audio.played).toContain('pause-beds');

    component.togglePause();
    expect(resume).toHaveBeenCalled();
    expect(component.isPaused()).toBe(false);
    expect(audio.played).toContain('resume-beds');
  });

  it('applica una sola volta l\'esito Quiz arrivato dal server', () => {
    const applyServerAnswer = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    component.currentMode.set({ type: 'QUIZ', applyServerAnswer } as any);
    const addPoints = vi.spyOn(leaderboard, 'addPoints');

    // L'evento del server porta anche l'opzione scelta: serve alla TV per
    // accendere la risposta sbagliata in pomodoro.
    ws.status$.next({ action: 'QUIZ_ANSWER', playerName: 'Anna', manche: 0, isCorrect: true, points: 300, optionIndex: 1 });
    ws.status$.next({ action: 'QUIZ_ANSWER', playerName: 'Anna', manche: 0, isCorrect: true, points: 300, optionIndex: 1 });

    expect(applyServerAnswer).toHaveBeenCalledTimes(2);
    expect(applyServerAnswer).toHaveBeenCalledWith(expect.objectContaining({ optionIndex: 1, manche: 0 }));
    expect(addPoints).toHaveBeenCalledTimes(1);
    expect(addPoints).toHaveBeenCalledWith('Anna', 300, true);
  });

  it('salva il checkpoint del bonus e lo riapre dopo un refresh', () => {
    component.onBonusCheckpoint('CASINO_COLOR', { votes: [], scores: [], winner: null });

    expect(reliability.tvCheckpoints.at(-1)).toMatchObject({
      mode: 'BONUS_CASINO_COLOR',
      roundIndex: -1,
    });

    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    const state = { votes: [{ playerName: 'Anna', choice: 'ROSSO' }], scores: [], winner: null };
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 0,
      tvCheckpoint: { mode: 'BONUS_CASINO_COLOR', bonus: true, revision: 5, state },
    });

    expect(component.bonusResume()).toEqual(state);
    expect(component.bonusEntrance()).toBe('CASINO_COLOR');
  });

  it('l’ingresso del bonus arriva dal seme della partita, non dal caso', async () => {
    component.currentGameId.set(1);
    (component as unknown as { bonusSeedByGame: Map<number, number> }).bonusSeedByGame.set(1, 99);
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;

    await component.startBonus('CASINO_COLOR');

    const entry = component.bonusEntranceEntry();
    expect(entry?.type).toBe('CASINO_COLOR');
    expect(entry?.id).toBe(bonusEntranceFor('CASINO_COLOR', 99).id);
    expect(audio.played).toContain(`play-${entry!.sound}`);
  });

  it('un bonus ripreso dopo un refresh non rigioca l’ingresso', async () => {
    component.currentGameId.set(1);
    sessionStorage.setItem('bonusEntrance:1:CAVALLO', 'cavallo-cancelli');

    await component.startBonus('CAVALLO', { votes: [], scores: [] });

    expect(component.bonusEntrance()).toBeNull();
    expect(component.bonusEntranceEntry()).toBeNull();
    sessionStorage.removeItem('bonusEntrance:1:CAVALLO');
  });

  it('la pausa ferma l’ingresso a metà scena', async () => {
    component.currentGameId.set(1);
    await component.startBonus('BLACKJACK');
    expect(component.bonusEntrance()).toBe('BLACKJACK');

    component.isPaused.set(true);
    fixture.detectChanges();

    // La pausa arriva all'ingresso: le animazioni vanno in `animation-play-state`.
    const entrance = fixture.debugElement.query(By.directive(BonusEntrance)).componentInstance as BonusEntrance;
    expect(entrance.paused).toBe(true);
    expect(entrance.entry?.type).toBe('BLACKJACK');
    const html = readFileSync('src/app/features/tv/game.component.html', 'utf8');
    expect(html).toContain('[paused]="isPaused()"');
  });

  it('riapre il Blackjack bonus dalla mano salvata sul server', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    component.currentGameId.set(1);
    const hand = {
      order: ['Anna', 'Bruno'],
      index: 1,
      hand: ['A♥', 'K♥'],
      bank: ['9♠', '7♠'],
      rows: [{ playerName: 'Anna', status: 'WIN', points: 150 }],
      phase: 'DECIDE',
      secondsLeft: 9,
    };

    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 8,
      bonusAct: { act: 0, type: 'BLACKJACK', status: 'STARTED' },
      blackjackState: hand,
    });

    expect(component.bonusResume()).toEqual(hand);
    expect(component.bonusEntrance()).toBe('BLACKJACK');
  });

  it('riapre il bonus Cavallo dal checkpoint salvato', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    component.currentGameId.set(1);
    const state = {
      phase: 'QUESTION',
      secondsLeft: 40,
      chosenCategory: 'MUSICA',
      questions: [{ question: 'Capitale del Giappone?', options: ['Pechino', 'Tokyo'], correctIndex: 1 }],
      scores: [{ playerName: 'Anna', score: 2 }],
    };

    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 8,
      bonusAct: { act: 0, type: 'CAVALLO', status: 'STARTED' },
      tvCheckpoint: { mode: 'BONUS_CAVALLO', bonus: true, revision: 5, state },
    });

    expect(component.bonusResume()).toEqual(state);
    expect(component.bonusEntrance()).toBe('CAVALLO');
  });

  it('salva la mano del Blackjack bonus e la cancella alla chiusura', () => {
    const hand = { order: ['Anna'], index: 0, hand: ['A♥', 'K♥'], phase: 'DECIDE' };
    component.onBlackjackBonusCheckpoint(hand);
    expect(reliability.blackjackStates.at(-1)).toEqual(hand);

    component.bonusEntrance.set(null);
    component.bonusActive.set(true);
    component.bonusType.set('BLACKJACK');
    (component as unknown as { finishBonus(): void }).finishBonus();

    expect(reliability.blackjackStates.at(-1)).toBeNull();
  });

  it('non riapre un bonus che non sa riprendere', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 0,
      tvCheckpoint: { mode: 'BONUS_CAVALLO', bonus: true, revision: 5, state: { phase: 'QUESTION' } },
    });

    expect(component.bonusResume()).toBeNull();
    expect(component.bonusEntrance()).toBeNull();
  });

  it('segna sul server il bonus dell’atto, avviato e chiuso', async () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    component.currentGameId.set(1);

    await component.startBonus('CAVALLO');
    expect(reliability.bonusActs.at(-1)).toEqual({ act: 0, type: 'CAVALLO', status: 'STARTED' });

    // Fine ingresso e bonus in corso: la chiusura è quella che paga i punti.
    component.bonusEntrance.set(null);
    component.bonusActive.set(true);
    component.bonusType.set('CAVALLO');
    (component as unknown as { finishBonus(): void }).finishBonus();

    expect(reliability.bonusActs.at(-1)).toEqual({ act: 0, type: 'CAVALLO', status: 'CLOSED' });
  });

  it('riapre dopo un refresh il bonus dell’atto che il server dice avviato', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    component.currentGameId.set(1);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 8,
      bonusAct: { act: 0, type: 'CAVALLO', status: 'STARTED' },
    });

    expect(component.bonusEntrance()).toBe('CAVALLO');
    expect(reliability.bonusActs.at(-1)).toEqual({ act: 0, type: 'CAVALLO', status: 'STARTED' });
  });

  it('non riapre un bonus già pagato se lo snapshot dice ancora avviato', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    component.currentGameId.set(1);

    // Bonus chiuso davvero: i punti sono già stati accreditati.
    component.bonusEntrance.set(null);
    component.bonusActive.set(true);
    component.bonusType.set('CAVALLO');
    (component as unknown as { finishBonus(): void }).finishBonus();
    // Il pannello successivo azzera il bonus aperto.
    component.bonusActive.set(false);
    expect(reliability.bonusActs.at(-1)).toEqual({ act: 0, type: 'CAVALLO', status: 'CLOSED' });

    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 8,
      bonusAct: { act: 0, type: 'CAVALLO', status: 'STARTED' },
    });

    expect(component.bonusEntrance()).toBeNull();
  });

  it('non riapre un bonus dell’atto già chiuso', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(8);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundIndex: 8,
      bonusAct: { act: 0, type: 'CAVALLO', status: 'CLOSED' },
    });

    expect(component.bonusEntrance()).toBeNull();
  });

  it('sincronizza pausa e ripresa con il server', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    component.currentMode.set({ type: 'QUIZ', pause, resume } as any);
    const game = TestBed.inject(GameService) as unknown as FakeGameService;

    component.togglePause();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(game.pauseCalls).toEqual([1]);

    component.togglePause();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(game.resumeCalls).toEqual([1]);
  });

  it('ricostruisce un round in pausa con il tempo fermo', () => {
    const pausedAt = Date.now() - 30_000;
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    tv.applyAuthoritativeState({
      hasState: true,
      status: 'RUNNING',
      roundType: 'TIMELINE',
      roundDeadlineAt: pausedAt + 12_000,
      paused: true,
      pausedAt,
      currentRound: { payload: { items: [{ id: 1, label: 'Carta' }] } },
    });

    // La deadline è già passata, ma la pausa la tiene ferma: restano i 12 s
    // che c'erano al momento dello stop.
    expect(component.recoveredRound()?.paused).toBe(true);
    expect(component.recoveredRound()?.secondsLeft).toBe(12);
  });

  it('toglie la pausa sul server prima di riaprire il round recuperato', async () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const modes = TestBed.inject(GameModeService);
    vi.spyOn(modes, 'createMode').mockReturnValue({
      type: 'TIMELINE', restore: vi.fn(), getDisplayData: () => ({}), isRevealed: () => false,
    } as any);
    component.recoveredRound.set({
      type: 'TIMELINE', label: 'Timeline', secondsLeft: 12, resumable: true, paused: true,
    });
    (component as unknown as { recoveredPayload: any }).recoveredPayload = {
      items: [{ id: 1, label: 'Carta' }],
    };

    await component.resumeRecoveredRound();

    expect(game.resumeCalls).toEqual([1]);
    expect(component.recoveredRound()).toBeNull();
    expect(ws.broadcasted.some((entry) => entry.body.action === WsAction.GAME_RESUMED)).toBe(true);
  });

  it('non annuncia la ripresa quando il server non la conferma', async () => {
    const game = TestBed.inject(GameService);
    vi.spyOn(game, 'resumeRound').mockReturnValue(throwError(() => new Error('offline')));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.recoveredRound.set({
      type: 'TIMELINE', label: 'Timeline', secondsLeft: 12, resumable: true, paused: true,
    });
    (component as unknown as { recoveredPayload: any }).recoveredPayload = { items: [] };
    await component.resumeRecoveredRound();
    expect(component.recoveredRound()).not.toBeNull();
    expect(ws.broadcasted.some((entry) => entry.body.action === WsAction.GAME_RESUMED)).toBe(false);
    alertSpy.mockRestore();
  });

  it('non riprende né toglie la pausa a un Quiz legacy con voti non verificabili', async () => {
    const game = TestBed.inject(GameService);
    vi.spyOn(game, 'quizAnswers').mockReturnValue(of({ recoveryBlocked: 'legacy-quiz-state', answers: [] }));
    const resume = vi.spyOn(game, 'resumeRound');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const modes = TestBed.inject(GameModeService);
    const create = vi.spyOn(modes, 'createMode');
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'QUIZ', roundIndex: 1, roundKey: 'g1-r1',
      roundStartId: 'round-1', roundDeadlineAt: Date.now() + 60000, paused: true, pausedAt: Date.now(),
      payload: { question: 'Q', options: ['A', 'B'], correctAnswer: 'A' },
      tvCheckpoint: { mode: 'QUIZ', revision: 1, state: { mancheIndex: 0, secondsLeft: 10 } },
    });
    await component.resumeRecoveredRound();
    expect(component.recoveredRound()).not.toBeNull();
    expect(component.currentMode()).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('voti salvati sono conservati'));
    expect(ws.broadcasted.some((entry) => entry.body.action === WsAction.GAME_RESUMED)).toBe(false);
    alertSpy.mockRestore();
  });

  it('non riprende un Quiz se non può verificare lo stato dei voti', async () => {
    const game = TestBed.inject(GameService);
    vi.spyOn(game, 'quizAnswers').mockReturnValue(throwError(() => new Error('offline')));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.recoveredRound.set({ type: 'QUIZ', label: 'Quiz', secondsLeft: 10, resumable: true, paused: false });
    await component.resumeRecoveredRound();
    expect(component.recoveredRound()).not.toBeNull();
    expect(component.currentMode()).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('non verificata'));
    alertSpy.mockRestore();
  });

  it('salva il checkpoint Arena con l indice della scaletta, non con il round vecchio', () => {
    // Scaletta: 6 round chiusi, quindi il round aperto è l'indice 5.
    TestBed.inject(RoundManagerService).restoreRound(6);
    // `round()` è ancora la fotografia del round precedente.
    component.round.set({ roundIndex: 3 } as any);
    component.currentMode.set({ type: 'ARENA' } as any);
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('ARENA', {}, ['Anna']);
    const state = { teams: [{ playerName: 'Anna', distance: 20 }] };
    config.onTvCheckpoint({ type: 'ARENA', revision: 2, state });
    expect(reliability.tvCheckpoints).toEqual([
      { mode: 'ARENA', revision: 2, state, roundIndex: 5 },
    ]);
  });

  it('non salva il checkpoint di una modalità che non è più quella aperta', () => {
    TestBed.inject(RoundManagerService).restoreRound(6);
    component.currentMode.set({ type: 'QUIZ' } as any);
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('ARENA', {}, ['Anna']);

    // Il tabellone di un'Arena già chiusa non deve salvarsi sopra il round
    // Quiz: il server risponderebbe 409 a ogni invio.
    config.onTvCheckpoint({ type: 'ARENA', revision: 2, state: {} });
    expect(reliability.tvCheckpoints).toEqual([]);

    config.onTvCheckpoint({ type: 'QUIZ', revision: 3, state: {} });
    expect(reliability.tvCheckpoints).toHaveLength(1);
  });

  it('libera AVANTI se il server non conferma la chiusura del round', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const close = vi.spyOn(game, 'closeRound').mockReturnValue(NEVER);
      const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
      component.currentGameId.set(1);
      component.currentMode.set({ type: 'QUIZ', isRevealed: () => false } as any);

      component.adminNextRound();
      expect(close).toHaveBeenCalledTimes(1);
      expect(start).not.toHaveBeenCalled();

      // Nessuna risposta: passato il tempo massimo la regia può riprovare
      // invece di restare bloccata per tutta la serata.
      await vi.advanceTimersByTimeAsync(8_000);
      component.adminNextRound();
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('non apre un secondo round se la chiusura risponde dopo il tempo massimo', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const response = new Subject<any>();
      vi.spyOn(game, 'closeRound').mockReturnValue(response.asObservable());
      const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
      component.currentGameId.set(1);
      component.currentMode.set({ type: 'QUIZ', isRevealed: () => false } as any);

      component.adminNextRound();
      await vi.advanceTimersByTimeAsync(8_000);
      response.next({ closed: true });
      response.complete();

      // La regia ha già ripreso il pulsante: la risposta in ritardo non avanza.
      expect(start).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('con la classifica aperta la X e AVANTI restano nella dock e la chiudono', () => {
    component.currentGameId.set(1);
    component.currentMode.set({ type: 'QUIZ', isRevealed: () => true } as any);
    component.showLeaderboardQuick.set(true);
    component.isShowingLeaderboard.set(true);
    const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
    fixture.detectChanges();

    // La X sta nella dock: un click la chiude, invece di finire sotto la scena
    // o sopra AVANTI.
    const close = fixture.debugElement.query(By.css('.tv-dock .dock-btn.close'));
    expect(close).toBeTruthy();
    close.nativeElement.click();
    expect(component.showLeaderboardQuick()).toBe(false);
    expect(component.isShowingLeaderboard()).toBe(false);
    expect(start).not.toHaveBeenCalled();

    // AVANTI arriva anche con la classifica a schermo e apre il round dopo.
    component.showLeaderboardQuick.set(true);
    component.isShowingLeaderboard.set(true);
    fixture.detectChanges();
    const advance = fixture.debugElement.queryAll(By.css('.tv-dock .dock-btn'))
      .find((el) => el.nativeElement.getAttribute('aria-label') === 'Prossimo round')!;
    advance.nativeElement.click();
    expect(component.showLeaderboardQuick()).toBe(false);
    expect(component.isShowingLeaderboard()).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('tiene la dock sopra la classifica invece di nasconderle i pulsanti', () => {
    const html = readFileSync('src/app/features/tv/game.component.html', 'utf8');
    const restyle = readFileSync('src/app/features/tv/restyle.css', 'utf8');
    const overlay = Number(readFileSync(
      'src/app/features/tv/leaderboard/leaderboard-quick-component/restyle.css', 'utf8',
    ).match(/z-index:\s*(\d+)/)?.[1]);
    const dockLayer = Number(
      restyle.slice(restyle.indexOf('.tv-dock.above-leaderboard')).match(/z-index:\s*(\d+)/)?.[1],
    );

    expect(overlay).toBeGreaterThan(0);
    // La classifica è a schermo intero: una dock sotto il suo livello non
    // riceve il click su AVANTI.
    expect(dockLayer).toBeGreaterThan(overlay);
    expect(html).toContain('[class.above-leaderboard]="isShowingLeaderboard()"');
  });

  it('un solo pulsante di chiusura, con la scritta, chiude la classifica', () => {
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);
    fixture.detectChanges();

    // Un solo comando di chiusura a schermo, e si legge: non è più una X muta
    // in un angolo.
    const closes = fixture.debugElement.queryAll(By.css('[aria-label="Chiudi la classifica"]'));
    expect(closes).toHaveLength(1);
    expect(closes[0].nativeElement.textContent).toContain('CHIUDI CLASSIFICA');

    closes[0].nativeElement.click();
    expect(component.showLeaderboardDetailed()).toBe(false);
    expect(component.isShowingLeaderboard()).toBe(false);
  });

  it('a fine partita mostra il pannello in scena invece di un alert che blocca la TV', async () => {
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'isGameOver').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await component.startNewRound();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.game-over-panel') as HTMLElement | null;
    expect(panel?.textContent).toContain('PARTITA COMPLETATA');
    expect(alertSpy).not.toHaveBeenCalled();

    // Torna al palco: si chiude senza resettare la partita.
    (panel!.querySelector('.game-over-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.gameOverNotice()).toBe(false);
    alertSpy.mockRestore();
  });

  it('la lobby dichiara la TV non abbinata invece di sembrare pronta', () => {
    component.phase.set('IDLE');
    component.currentGameId.set(1);
    component.reliability.sessionToken.set(null);
    fixture.detectChanges();

    const stamp = fixture.nativeElement.querySelector('.lobby-unpaired') as HTMLElement | null;
    expect(stamp?.textContent).toContain('TV NON IN LINEA');
  });

  it('fa ripartire la serata da sola anche dopo il riepilogo di un round', () => {
    vi.useFakeTimers();
    try {
      const rounds = TestBed.inject(RoundManagerService);
      rounds.restoreRound(3);
      vi.spyOn(rounds, 'bonusAfterRound').mockReturnValue(null);
      vi.spyOn(rounds, 'shouldShowLeaderboard').mockReturnValue(null);
      vi.spyOn(rounds, 'isGameOver').mockReturnValue(false);

      (component as unknown as { checkLeaderboardDisplay(): void }).checkLeaderboardDisplay();
      fixture.detectChanges();

      expect(component.autoAdvanceSeconds()).toBe(10);
      expect(fixture.nativeElement.querySelector('.auto-advance')).toBeTruthy();
    } finally {
      (component as unknown as { cancelAutoAdvance(): void }).cancelAutoAdvance();
      vi.useRealTimers();
    }
  });

  it('riporta il contatore a zero quando la partita è nuova o resettata', () => {
    const rounds = TestBed.inject(RoundManagerService);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    rounds.restoreRound(9);
    tv.applyAuthoritativeState({ hasState: false });
    expect(rounds.getCurrentRound()).toBe(0);
    expect(component.roundInfo()).toBe('0/40');

    rounds.restoreRound(9);
    tv.applyAuthoritativeState({
      hasState: true, status: 'CREATED', roundType: null, roundIndex: 0, roundKey: null,
    });
    expect(rounds.getCurrentRound()).toBe(0);
    expect(component.roundInfo()).toBe('0/40');
  });

  it('mostra 1/40 quando il server apre il primo round', () => {
    const rounds = TestBed.inject(RoundManagerService);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    rounds.restoreRound(9);
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'QUIZ', roundIndex: 0,
      roundKey: 'g1-r1', roundDeadlineAt: Date.now() + 60_000,
    });

    expect(rounds.getCurrentRound()).toBe(1);
    expect(component.roundInfo()).toBe('1/40');
  });

  it('salva il checkpoint col round del server quando la scaletta è avanti', () => {
    // Avanzamento locale avanti: round aperto 8, il server è fermo al 6.
    TestBed.inject(RoundManagerService).restoreRound(9);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'BOMBA', roundIndex: 6, roundKey: 'g1-r6',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
    });
    component.currentMode.set({ type: 'BOMBA' } as any);

    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('BOMBA', {}, ['Anna']);
    config.onTvCheckpoint({ type: 'BOMBA', revision: 4, state: { lastEventSeq: 2 } });

    // Il server rifiuterebbe un checkpoint con indice diverso dal suo.
    expect(reliability.tvCheckpoints.at(-1)).toMatchObject({
      mode: 'BOMBA',
      roundIndex: 6,
    });
  });

  it('salva il checkpoint Bomba con indice del round e sequenza eventi', () => {
    TestBed.inject(RoundManagerService).restoreRound(8);
    component.round.set({ roundIndex: 4 } as any);
    component.currentMode.set({ type: 'BOMBA' } as any);
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('BOMBA', {}, ['Anna']);
    config.onTvCheckpoint({ type: 'BOMBA', revision: 3, state: { lastEventSeq: 9 } });
    expect(reliability.tvCheckpoints).toEqual([
      { mode: 'BOMBA', revision: 3, state: { lastEventSeq: 9 }, roundIndex: 7 },
    ]);
  });

  it('propone di riprendere Bomba quando il server ha la sequenza eventi', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'BOMBA', roundIndex: 6, roundKey: 'g1-r6',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'BOMBA', roundKey: 'g1-r6', startedAt: 1, revision: 2, state: { lastEventSeq: 5 } },
    });
    expect(component.recoveredRound()?.resumable).toBe(true);
  });

  it('riapre Bomba dal checkpoint senza riavviare il round', async () => {
    const modes = TestBed.inject(GameModeService);
    const restore = vi.fn();
    const start = vi.fn();
    vi.spyOn(modes, 'createMode').mockReturnValue({
      type: 'BOMBA', restore, start, getDisplayData: () => ({}), isRevealed: () => false,
    } as any);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    const checkpoint = { mode: 'BOMBA', roundKey: 'g1-r6', startedAt: 1, revision: 2, state: { lastEventSeq: 5 } };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'BOMBA', roundIndex: 6, roundKey: 'g1-r6',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: checkpoint,
    });
    const seconds = component.recoveredRound()!.secondsLeft;

    await component.resumeRecoveredRound();

    expect(restore).toHaveBeenCalledWith(seconds, checkpoint);
    expect(start).not.toHaveBeenCalled();
    expect(component.recoveredRound()).toBeNull();
  });

  it('propone di riprendere Speed Rush senza checkpoint, perché le corsie sono sul server', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'SPEED_RUSH', roundIndex: 4, roundKey: 'g1-r4',
      roundDeadlineAt: Date.now() + 45_000, currentRound: { payload: {} },
    });
    expect(component.recoveredRound()?.resumable).toBe(true);
    expect(component.recoveredRound()?.secondsLeft).toBeGreaterThan(0);
  });

  it('propone di riprendere Quiz quando il server ha il checkpoint della modalità', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'QUIZ', roundIndex: 9, roundKey: 'g1-r9',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'QUIZ', roundKey: 'g1-r9', startedAt: 1, revision: 4, state: { mancheIndex: 1 } },
    });
    expect(component.recoveredRound()?.resumable).toBe(true);
  });

  it('propone di riprendere Biglie e passa la gara salvata al componente', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    const state = { phase: 'RACE_END', raceIndex: 1, standings: [], raceResult: [] };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'BIGLIE', roundIndex: 10, roundKey: 'g1-r10',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'BIGLIE', roundKey: 'g1-r10', startedAt: 1, revision: 4, state },
    });

    expect(component.recoveredRound()?.resumable).toBe(true);
    expect(component.biglieResume()).toEqual(state);
  });

  it('non usa un checkpoint di un\'altra modalità', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'QUIZ', roundIndex: 9, roundKey: 'g1-r9',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'ARENA', roundKey: 'g1-r9', startedAt: 1, revision: 4, state: { teams: [] } },
    });
    expect(component.recoveredRound()?.resumable).toBe(false);
  });

  it('propone di riprendere Arena quando il server ha il tabellone', () => {
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    const checkpoint = { mode: 'ARENA', roundKey: 'g1-r3', startedAt: 1, revision: 4, state: { teams: [] } };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'ARENA', roundIndex: 3, roundKey: 'g1-r3',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: checkpoint,
    });
    expect(component.recoveredRound()?.resumable).toBe(true);
  });

  it('riapre Arena dal checkpoint con il tempo residuo', async () => {
    const modes = TestBed.inject(GameModeService);
    const restore = vi.fn();
    vi.spyOn(modes, 'createMode').mockReturnValue({
      type: 'ARENA', restore, getDisplayData: () => ({}), isRevealed: () => false,
    } as any);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    const checkpoint = { mode: 'ARENA', roundKey: 'g1-r3', startedAt: 1, revision: 4, state: { teams: [] } };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'ARENA', roundIndex: 3, roundKey: 'g1-r3',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: checkpoint,
    });
    const seconds = component.recoveredRound()!.secondsLeft;

    await component.resumeRecoveredRound();

    expect(restore).toHaveBeenCalledWith(seconds, checkpoint);
    expect(component.currentMode()?.type).toBe('ARENA');
    expect(component.recoveredRound()).toBeNull();
  });

  it('non assegna punti Arena per un esito arrivato dopo la chiusura', () => {
    const applyArenaAnswer = vi.fn();
    component.currentMode.set({
      type: 'ARENA', acceptsArenaAnswers: () => false, applyArenaAnswer,
    } as any);
    ws.status$.next({ action: 'ARENA_ANSWER', playerName: 'Anna', isCorrect: true, points: 10, eventSeq: 9 });
    expect(leaderboard.getPlayerStats('Anna')).toBeFalsy();
    expect(applyArenaAnswer).not.toHaveBeenCalled();
  });

  it('passa al round successivo quando finisce la canzone del reveal', () => {
    component.currentMode.set({ type: 'MUSIC' } as any);
    const next = vi.spyOn(component, 'adminNextRound').mockImplementation(() => undefined);

    component.musicPlaybackEnded();

    expect(next).toHaveBeenCalledTimes(1);
    next.mockRestore();
  });

  it('non fa tornare indietro la scaletta dopo un round saltato', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(30);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    tv.applyAuthoritativeState({ hasState: true, status: 'RUNNING', roundIndex: 24, roundType: 'QUIZ' });

    expect(rounds.getCurrentRound()).toBe(30);
  });

  it('adotta l avanzamento del server su una TV nuova', () => {
    const rounds = TestBed.inject(RoundManagerService);
    rounds.restoreRound(0);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };

    tv.applyAuthoritativeState({ hasState: true, status: 'RUNNING', roundIndex: 24, roundType: 'QUIZ' });

    expect(rounds.getCurrentRound()).toBe(25);
  });

  it('distribuisce le categorie prima di ripeterle', () => {
    component.allCategories.set([
      { id: 1, name: 'Storia' },
      { id: 2, name: 'Scienza' },
      { id: 3, name: 'Sport' },
    ]);
    const pick = () => (component as unknown as { pickCategoryName(): string }).pickCategoryName();

    for (let round = 0; round < 3; round++) pick();

    const counts = new Map<string, number>();
    for (let round = 0; round < 6; round++) {
      const name = pick();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    expect(counts.size).toBe(3);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
  });

  it('per Timeline pesca solo categorie con eventi', () => {
    component.allCategories.set([
      { id: 1, name: 'Storia', timeline: true },
      { id: 2, name: 'Scienza', timeline: true },
      { id: 3, name: 'Sport', timeline: false },
    ]);
    const seen = new Set<string>();
    for (let round = 0; round < 6; round++) {
      seen.add((component as unknown as { pickTimelineCategoryName(): string }).pickTimelineCategoryName());
    }

    expect([...seen].sort()).toEqual(['Scienza', 'Storia']);
  });

  it('shows the intro once and remembers it after dismissal', () => {
    expect(component.phase()).toBe(GamePhase.INTRO);
    expect(localStorage.getItem('pubgame.intro.seen')).toBe('1');

    component.dismissIntro();

    expect(component.phase()).toBe('IDLE');
  });

  it('replays the intro on the admin command', () => {
    component.dismissIntro();

    ws.status$.next({ action: WsAction.ADMIN_SHOW_INTRO });

    expect(component.phase()).toBe(GamePhase.INTRO);
  });

  it('should place every category with non overlapping coordinates', async () => {
    const categories = component.allCategories();

    expect(categories.length).toBe(3);
    for (const category of categories) {
      expect(category.top).toMatch(/%$/);
      expect(category.left).toMatch(/%$/);
    }
  });

  it('should translate game types into Italian labels', () => {
    expect(component.getModeName('WHEEL_OF_FORTUNE')).toBe('RUOTA DELLA FORTUNA');
    expect(component.getModeName('ARENA')).toBe('ARENA BATTLE ROYALE');
    expect(component.getModeName('UNKNOWN')).toBe('UNKNOWN');
  });

  it('should never leak the correct answer to the remote before the reveal', () => {
    const safe = component.getSafeDisplayData();

    expect(safe.correctAnswer).toBeNull();
    expect(safe.question).toBe('');
    expect(safe.options).toEqual([]);
  });

  it('should award arena points when the remote reports an answer', async () => {
    const arenaMode = {
      type: 'ARENA',
      applyArenaAnswer: vi.fn(),
      getDisplayData: () => ({}),
      isRevealed: () => false,
    };
    component.currentMode.set(arenaMode as any);

    ws.status$.next({ action: 'ARENA_ANSWER', playerName: 'Anna', isCorrect: true });
    await fixture.whenStable();

    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(10);
    expect(arenaMode.applyArenaAnswer).toHaveBeenCalledWith('Anna', true, 10, undefined);
  });

  it('non riassegna punti per un evento Arena duplicato', () => {
    const arenaMode = { type: 'ARENA', hasArenaAnswer: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      applyArenaAnswer: vi.fn().mockReturnValue(true) };
    component.currentMode.set(arenaMode as any);
    const event = { action: 'ARENA_ANSWER', playerName: 'Anna', isCorrect: true, points: 10, eventSeq: 7 };
    ws.status$.next(event);
    ws.status$.next(event);
    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(10);
    expect(arenaMode.applyArenaAnswer).toHaveBeenCalledWith('Anna', true, 10, 7);
  });

  it('registra la risposta Arena prima che il movimento possa chiudere il round', () => {
    const applyArenaAnswer = vi.fn(() => {
      expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(10);
      return true;
    });
    component.currentMode.set({ type: 'ARENA', applyArenaAnswer } as any);
    ws.status$.next({ action: 'ARENA_ANSWER', playerName: 'Anna', isCorrect: true, eventSeq: 8 });
    expect(applyArenaAnswer).toHaveBeenCalledTimes(1);
  });

  it('gives the next round the palette of the previous round winner', () => {
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');

    // La palette del telefono non colora subito la TV: resta quella squadra.
    ws.status$.next({ action: WsAction.SELECT_THEME, theme: 'deep-ocean', playerName: 'Anna' });
    expect(theme.theme()).toBe('editorial-acid');
    expect(theme.themeForTeam('Anna')).toBe('deep-ocean');

    // Anna fa punti a round aperto: il round dopo prende il tema della squadra.
    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 100, true);
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();
    expect(theme.theme()).toBe('deep-ocean');
    expect(document.documentElement.dataset['theme']).toBe('deep-ocean');

    // Round senza punti (o senza vincitore): la TV torna in acido.
    tv.beginRoundScoring();
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();
    expect(theme.theme()).toBe('editorial-acid');
  });

  it('libera la palette della squadra espulsa, così un rientro la riusa', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno' });
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.PLAYER_REMOVED, playerName: 'Anna' });

    expect(theme.themeForTeam('Anna')).toBe('editorial-acid');
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Carla' });
    expect(theme.themeForTeam('Carla')).toBe(anna);
  });

  it('tiene palette e punti al telefono che rientra con un nome diverso', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    const anna = theme.themeForTeam('Anna');
    leaderboard.addPoints('Anna', 60, true);

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna Sofia', deviceId: 'dev-1' });

    expect(theme.themeForTeam('Anna Sofia')).toBe(anna);
    expect(leaderboard.getPlayerStats('Anna Sofia')?.totalPoints).toBe(60);
    expect(leaderboard.getPlayerStats('Anna')).toBeNull();
    expect(component.presencePlayers()).toContain('Anna Sofia');
    expect(component.presencePlayers()).not.toContain('Anna');
  });

  it('non porta i punti dell’espulsa se lo stesso telefono rientra con un altro nome', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    leaderboard.addPoints('Anna', 100, true);
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.PLAYER_REMOVED, playerName: 'Anna' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Marco', deviceId: 'dev-1' });

    // La riga di Anna resta com'era (ha punti), Marco è una squadra nuova.
    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(100);
    expect(leaderboard.getPlayerStats('Marco')?.totalPoints).toBe(0);
    expect(theme.themeForTeam('Marco')).not.toBe(anna);
  });

  it('porta con sé l’avatar quando il telefono rientra rinominato', () => {
    const avatars = TestBed.inject(PlayerAvatarService);
    const avatar = `data:image/png;base64,${'A'.repeat(120)}`;
    avatars.setAvatar('Anna', avatar);

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna Sofia', deviceId: 'dev-1' });

    expect(avatars.avatarFor('Anna Sofia')).toBe(avatar);
    expect(avatars.avatarFor('Anna')).toBeNull();
  });

  it('sposta sul nuovo nome anche i punti del round in corso', () => {
    const tv = component as unknown as {
      beginRoundScoring(): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
    };
    const theme = component.theme;
    theme.applyFromRemote('editorial-acid');
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 90, true);
    // Rinomina a round aperto: il verdetto deve tenere i punti di Anna.
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna Sofia', deviceId: 'dev-1' });
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe(theme.themeForTeam('Anna Sofia'));
    expect(theme.theme()).not.toBe('editorial-acid');
  });

  it('tratta come squadra nuova il nome nuovo di un altro telefono', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna Sofia', deviceId: 'dev-2' });

    expect(theme.themeForTeam('Anna Sofia')).not.toBe(anna);
    expect(theme.themeForTeam('Anna')).toBe(anna);
  });

  it('toglie una squadra a zero punti solo dopo due fotografie senza', async () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno', deviceId: 'dev-2' });
    const bruno = theme.themeForTeam('Bruno');

    component.currentGameId.set(1);
    // La revisione delle presenze gira solo nella lobby, non durante un round.
    component.phase.set('IDLE');
    const tv = component as unknown as { refreshLobbyPresence(): Promise<void> };

    // Prima fotografia: Bruno c'è, ed è la prova che era collegato.
    reliability.diagnosticsResult = {
      presence: [
        { connected: true, role: 'REMOTE', playerName: 'Anna' },
        { connected: true, role: 'REMOTE', playerName: 'Bruno' },
      ],
    };
    await tv.refreshLobbyPresence();
    expect(leaderboard.getPlayerStats('Bruno')).not.toBeNull();

    // Fotografia in ritardo che non lo vede: non basta, resta.
    reliability.diagnosticsResult = {
      presence: [{ connected: true, role: 'REMOTE', playerName: 'Anna' }],
    };
    await tv.refreshLobbyPresence();
    expect(leaderboard.getPlayerStats('Bruno')).not.toBeNull();

    // Seconda fotografia consecutiva senza: ora sparisce, con la sua palette.
    await tv.refreshLobbyPresence();
    expect(leaderboard.getPlayerStats('Bruno')).toBeNull();
    expect(leaderboard.getPlayerStats('Anna')).not.toBeNull();
    expect(theme.themeForTeam('Bruno')).toBe('editorial-acid');

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Carla', deviceId: 'dev-3' });
    expect(theme.themeForTeam('Carla')).toBe(bruno);
  });

  it('non toglie una squadra appena entrata che la fotografia non vede ancora', async () => {
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna', deviceId: 'dev-1' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno', deviceId: 'dev-2' });

    component.currentGameId.set(1);
    component.phase.set('IDLE');
    // Diagnostica in ritardo: vede solo Anna, perché Bruno è appena entrato.
    reliability.diagnosticsResult = {
      presence: [{ connected: true, role: 'REMOTE', playerName: 'Anna' }],
    };
    const tv = component as unknown as { refreshLobbyPresence(): Promise<void> };
    await tv.refreshLobbyPresence();
    await tv.refreshLobbyPresence();

    // Mai vista in una fotografia: non si può dire che sia andata via.
    expect(leaderboard.getPlayerStats('Bruno')).not.toBeNull();
  });

  it('tratta il rientro con un nome diverso come una squadra nuova', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna Sofia' });

    // Il messaggio di ingresso porta solo il nome: per la TV è un'altra squadra.
    expect(theme.themeForTeam('Anna Sofia')).not.toBe(anna);
    expect(theme.themeForTeam('Anna')).toBe(anna);
    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(0);
    expect(leaderboard.getPlayerStats('Anna Sofia')?.totalPoints).toBe(0);
  });

  it('libera e ricorda anche la palette scelta dal telefono', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.SELECT_THEME, theme: 'deep-ocean', playerName: 'Anna' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    expect(theme.themeForTeam('Anna')).toBe('deep-ocean');

    ws.status$.next({ action: WsAction.PLAYER_REMOVED, playerName: 'Anna' });
    expect(theme.themeForTeam('Anna')).toBe('editorial-acid');

    // Al rientro la scelta torna, senza che il telefono la rimandi.
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    expect(theme.themeForTeam('Anna')).toBe('deep-ocean');
  });

  it('fa rientrare la squadra espulsa con la stessa palette', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.PLAYER_REMOVED, playerName: 'Anna' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });

    expect(theme.themeForTeam('Anna')).toBe(anna);
  });

  it('non libera la palette di una squadra espulsa che ha già punti', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    leaderboard.addPoints('Anna', 40, true);
    const anna = theme.themeForTeam('Anna');

    ws.status$.next({ action: WsAction.PLAYER_REMOVED, playerName: 'Anna' });

    // Anna resta in classifica con i suoi punti: il colore non si libera.
    expect(theme.themeForTeam('Anna')).toBe(anna);
    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(40);
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Carla' });
    expect(theme.themeForTeam('Carla')).not.toBe(anna);
  });

  it('azzera le palette con il reset confermato', () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    theme.setTeamTheme('Bruno', 'kpop-aesthetic');
    component.currentGameId.set(1);
    // jsdom non naviga: il reload vero non serve al test e sporcherebbe l'output.
    const tv = component as unknown as { reloadPage(): void };
    const reload = vi.spyOn(tv, 'reloadPage').mockImplementation(() => undefined);

    component.confirmReset();

    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();

    expect(theme.themeForTeam('Anna')).toBe('editorial-acid');
    expect(theme.themeForTeam('Bruno')).toBe('editorial-acid');
    expect(leaderboard.getLeaderboard()).toHaveLength(0);
  });

  it('azzera le palette quando si apre una partita nuova', async () => {
    const theme = component.theme;
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    expect(theme.themeForTeam('Anna')).not.toBe('editorial-acid');

    // Nessuna partita aperta: `openLobby` ne crea una nuova e riparte da zero.
    component.currentGameId.set(0);
    await component.openLobby();

    expect(theme.themeForTeam('Anna')).toBe('editorial-acid');
  });

  it('dà al round successivo la palette della squadra anche senza scelta', () => {
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');

    // Anna entra senza scegliere: la TV le assegna una palette sua.
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Anna' });
    ws.status$.next({ action: WsAction.JOIN_GAME, playerName: 'Bruno' });
    const anna = theme.themeForTeam('Anna');
    expect(anna).not.toBe('editorial-acid');
    expect(theme.themeForTeam('Bruno')).not.toBe(anna);

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 100, true);
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe(anna);
    expect(document.documentElement.dataset['theme']).toBe(anna);
  });

  it('counts only the points earned while the round was open', () => {
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Anna', 'deep-ocean');
    theme.setTeamTheme('Bruno', 'kpop-aesthetic');

    // Anna arriva da una partita precedente con un vantaggio enorme.
    leaderboard.addPoints('Anna', 900, true);

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 10, true);
    // Bruno entra a metà round e dentro il round fa meglio di lei.
    leaderboard.addPoints('Bruno', 40, true);
    tv.settleRoundWinner();

    // Punti del bonus fra un round e l'altro: non devono ribaltare il verdetto.
    leaderboard.addPoints('Anna', 500, true);
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('kpop-aesthetic');
  });

  it('ritrova i punti del vincitore del round dopo un refresh', () => {
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      restoreRoundPoints(roundIndex: number | null): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
      roundPoints: Map<string, number>;
      roundScoring: boolean;
    };
    component.currentGameId.set(1);
    // Round aperto = indice 4 (round 1..5 chiusi).
    TestBed.inject(RoundManagerService).restoreRound(5);
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Anna', 'deep-ocean');
    theme.setTeamTheme('Bruno', 'kpop-aesthetic');

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 80, true);
    leaderboard.addPoints('Bruno', 30, true);
    expect(localStorage.getItem('roundPoints')).not.toBeNull();

    // Refresh: la TV riparte vuota e ricarica i punti del round aperto.
    tv.roundPoints.clear();
    tv.roundScoring = false;
    tv.restoreRoundPoints(4);

    expect(tv.roundScoring).toBe(true);
    expect(tv.roundPoints.get('Anna')).toBe(80);

    // I punti arrivati dopo il refresh si sommano a quelli di prima.
    leaderboard.addPoints('Anna', 20, true);
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('deep-ocean');
    expect(localStorage.getItem('roundPoints')).toBeNull();
  });

  it('non applica i punti di un altro round', () => {
    const tv = component as unknown as {
      beginRoundScoring(): void;
      restoreRoundPoints(roundIndex: number | null): void;
      roundPoints: Map<string, number>;
      roundScoring: boolean;
    };
    component.currentGameId.set(1);
    TestBed.inject(RoundManagerService).restoreRound(5);
    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 80, true);

    tv.roundPoints.clear();
    tv.roundScoring = false;
    tv.restoreRoundPoints(5);

    expect(tv.roundScoring).toBe(false);
    expect(tv.roundPoints.size).toBe(0);
  });

  it('usa l indice della scaletta, non quello vecchio del round', () => {
    const rounds = TestBed.inject(RoundManagerService);
    const tv = component as unknown as {
      beginRoundScoring(): void;
      restoreRoundPoints(roundIndex: number | null): void;
      roundPoints: Map<string, number>;
      roundScoring: boolean;
    };
    component.currentGameId.set(1);
    // Scaletta: 9 round chiusi, quindi il round aperto è l'indice 8.
    rounds.restoreRound(9);
    // Fotografia vecchia del round arrivata dallo snapshot sbagliato.
    component.round.set({ roundIndex: 3 } as any);

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 100, true);

    const stored = JSON.parse(localStorage.getItem('roundPoints') ?? 'null');
    expect(stored.roundIndex).toBe(8);

    // La ripresa del round aperto ritrova il conteggio; l'indice vecchio no.
    tv.roundPoints.clear();
    tv.roundScoring = false;
    tv.restoreRoundPoints(8);
    expect(tv.roundPoints.get('Anna')).toBe(100);

    tv.roundPoints.clear();
    tv.roundScoring = false;
    tv.restoreRoundPoints(3);
    expect(tv.roundScoring).toBe(false);
    expect(tv.roundPoints.size).toBe(0);
  });

  it('rimanda al server la classifica rimasta in coda dopo un refresh', async () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const tv = component as unknown as { restorePendingLeaderboard(): void };
    component.currentGameId.set(1);

    leaderboard.addPoints('Anna', 140, true);
    expect(localStorage.getItem('leaderboardPending')).not.toBeNull();

    // La coda sopravvive al refresh e la TV la rimanda subito.
    tv.restorePendingLeaderboard();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.savedLeaderboards.at(-1)).toEqual({
      gameId: 1,
      entries: [{ playerName: 'Anna', totalPoints: 140 }],
    });
    expect(localStorage.getItem('leaderboardPending')).toBeNull();
  });

  it('ritrova i punti del round con la scaletta anche se il server è indietro', async () => {
    const rounds = TestBed.inject(RoundManagerService);
    const modes = TestBed.inject(GameModeService);
    vi.spyOn(modes, 'createMode').mockReturnValue({
      type: 'QUIZ', restore: vi.fn(), getDisplayData: () => ({}), isRevealed: () => false,
    } as any);
    const tv = component as unknown as {
      beginRoundScoring(): void;
      roundPoints: Map<string, number>;
      roundScoring: boolean;
    };
    component.currentGameId.set(1);
    // Avanzamento locale avanti: 9 round chiusi, round aperto = indice 8.
    rounds.restoreRound(9);

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 70, true);

    // Il server è rimasto indietro (round 6): non deve spostare il conteggio.
    (component as unknown as { applyAuthoritativeState(snapshot: any): void }).applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'QUIZ', roundIndex: 6, roundKey: 'g1-r6',
      roundStartId: 'quiz-round-6', roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'QUIZ', roundKey: 'g1-r6', startedAt: 1, revision: 2, state: { mancheIndex: 1 } },
    });
    expect(rounds.getCurrentRound()).toBe(9);

    await component.resumeRecoveredRound();

    expect(component.recoveredRound()).toBeNull();
    expect(component.currentMode()?.type).toBe('QUIZ');
    expect(tv.roundScoring).toBe(true);
    expect(tv.roundPoints.get('Anna')).toBe(70);
  });

  it('rimanda la coda di classifica salvata prima di avere la partita', async () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const tv = component as unknown as { restorePendingLeaderboard(): void };
    component.currentGameId.set(1);
    localStorage.setItem('leaderboardPending', JSON.stringify({
      gameId: null,
      seq: 7,
      entries: [{ playerName: 'Anna', totalPoints: 60, correctAnswers: 2, wrongAnswers: 0, position: 1 }],
    }));

    tv.restorePendingLeaderboard();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Senza gameId la coda vale per la partita corrente, non va persa.
    expect(game.savedLeaderboards.at(-1)).toEqual({
      gameId: 1,
      entries: [{ playerName: 'Anna', totalPoints: 60 }],
    });
    expect(localStorage.getItem('leaderboardPending')).toBeNull();
  });

  it('non sposta su un tavolo la coda di un’altra partita', async () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const tv = component as unknown as { restorePendingLeaderboard(): void };
    component.currentGameId.set(1);
    localStorage.setItem('leaderboardPending', JSON.stringify({
      gameId: 2,
      seq: 3,
      entries: [{ playerName: 'Bruno', totalPoints: 40 }],
    }));

    tv.restorePendingLeaderboard();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.savedLeaderboards).toHaveLength(0);
    expect(localStorage.getItem('leaderboardPending')).not.toBeNull();
  });

  it('keeps the acid palette when the round is a tie', () => {
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      settleRoundWinner(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Bruno', 'kpop-aesthetic');
    theme.setTeamTheme('Carla', 'premium-gold');

    tv.beginRoundScoring();
    leaderboard.addPoints('Bruno', 50, true);
    leaderboard.addPoints('Carla', 50, true);
    tv.settleRoundWinner();
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('editorial-acid');
  });

  it('closes the round count when the host skips a round without a leaderboard', () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'closeRound').mockReturnValue(of({}));
    const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Anna', 'deep-ocean');
    theme.setTeamTheme('Bruno', 'kpop-aesthetic');

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 10, true);
    leaderboard.addPoints('Bruno', 40, true);

    component.currentGameId.set(1);
    component.currentMode.set({ type: 'QUIZ', isRevealed: () => false } as any);
    component.adminNextRound();

    // Il bonus che parte dopo lo skip non deve entrare nel verdetto.
    leaderboard.addPoints('Anna', 500, true);
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('kpop-aesthetic');
    start.mockRestore();
  });

  it('closes the round count when the host closes an already revealed round', () => {
    const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Anna', 'deep-ocean');

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 30, true);

    component.currentGameId.set(1);
    component.currentMode.set({ type: 'QUIZ', isRevealed: () => true } as any);
    component.adminNextRound();

    leaderboard.addPoints('Anna', 500, true);
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('deep-ocean');
    start.mockRestore();
  });

  it('closes the round count when a recovered round is closed after a refresh', () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'closeRound').mockReturnValue(of({}));
    const start = vi.spyOn(component, 'startNewRound').mockResolvedValue(undefined);
    const theme = component.theme;
    const tv = component as unknown as {
      beginRoundScoring(): void;
      applyRoundWinnerTheme(): void;
    };
    theme.applyFromRemote('editorial-acid');
    theme.setTeamTheme('Anna', 'deep-ocean');

    tv.beginRoundScoring();
    leaderboard.addPoints('Anna', 30, true);

    component.recoveredRound.set({
      type: 'QUIZ',
      label: 'Quiz',
      secondsLeft: 12,
      resumable: true,
    } as any);
    component.closeRecoveredRound(true);

    // Punti arrivati dopo la chiusura: fuori dal conteggio.
    leaderboard.addPoints('Anna', 500, true);
    tv.applyRoundWinnerTheme();

    expect(theme.theme()).toBe('deep-ocean');
    start.mockRestore();
  });

  it('adds a joining team to the lobby list without duplicates', async () => {
    ws.status$.next({ action: 'JOIN_GAME', playerName: 'Anna' });
    ws.status$.next({ action: 'JOIN_GAME', playerName: ' Anna ' });
    await fixture.whenStable();

    expect(component.presencePlayers()).toEqual(['Anna']);
  });

  it('should register a joining player with zero points', async () => {
    ws.status$.next({ action: 'JOIN_GAME', playerName: '  Bruno  ' });
    await fixture.whenStable();

    expect(leaderboard.getPlayerStats('Bruno')?.totalPoints).toBe(0);
    expect(leaderboard.getPlayerStats('Bruno')?.position).toBe(1);
  });

  it('starts Speed Rush with server-verified scoring', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'startSpeedRush').mockReturnValue(of({ active: true }));
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'extractGameType').mockReturnValue('SPEED_RUSH');
    const before = rounds.getCurrentRound();
    await component.startNewRound();
    expect(rounds.getCurrentRound()).not.toBe(before);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('does not start Basket from an old admin command or directly', async () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const startBasket = vi.spyOn(game, 'startBasket');
    await component.startBonus('BASKET' as any);
    ws.status$.next({ action: WsAction.ADMIN_START_BONUS, type: 'BASKET' });
    ws.status$.next({ action: WsAction.ADMIN_START_BONUS });
    await fixture.whenStable();

    expect(startBasket).not.toHaveBeenCalled();
    expect(component.bonusActive()).toBe(false);
  });

  it('does not advance when closing the current round is not confirmed', () => {
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const close = vi.spyOn(game, 'closeRound').mockReturnValue(throwError(() => new Error('offline')));
    const start = vi.spyOn(component, 'startNewRound');
    // L'avviso va in console, non in un alert che bloccherebbe la TV.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    component.currentGameId.set(1);
    component.currentMode.set({ isRevealed: () => false } as any);
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);

    component.adminNextRound();

    expect(close).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(component.showLeaderboardDetailed()).toBe(true);
    expect(component.isShowingLeaderboard()).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('preserves the local progress and scores when the server reset fails', () => {
    const rounds = TestBed.inject(RoundManagerService);
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(game, 'resetGame').mockReturnValue(throwError(() => new Error('offline')));
    component.currentGameId.set(1);
    rounds.startNewRound();
    leaderboard.addPoints('Anna', 50, true);

    component.confirmReset();

    expect(rounds.getCurrentRound()).toBe(1);
    expect(leaderboard.getPlayerStats('Anna')?.totalPoints).toBe(50);
    expect(alert).toHaveBeenCalledOnce();
  });

  it('should not expose a pre-round countdown any more', () => {
    expect((component as any).preStartCountdown).toBeUndefined();
    expect((component as any).getPrestartPreview).toBeUndefined();
  });

  it('il timer resta fermo durante la lettura e il 3-2-1', () => {
    component.currentMode.set({ type: 'QUIZ', isRevealed: () => false } as any);
    component.round.set({ status: 'ACTIVE' } as any);
    component.showQuestion.set(true);

    // La domanda è a schermo senza opzioni e senza conto alla rovescia.
    component.stagePhase.set('reading');
    expect(component.timerVisible()).toBe(false);
    component.stagePhase.set('options');
    expect(component.timerVisible()).toBe(false);
    component.stagePhase.set('countdown');
    expect(component.timerVisible()).toBe(false);

    // Il timer esiste solo quando il round è davvero aperto.
    component.stagePhase.set('live');
    expect(component.timerVisible()).toBe(true);
  });

  it('un round ripreso dopo un refresh non rifà l’introduzione', async () => {
    const factory = TestBed.inject(GameModeService);
    vi.spyOn(factory, 'createMode').mockReturnValue({
      type: 'BOMBA',
      timerDuration: 60,
      start: vi.fn(),
      restore: vi.fn(),
      getDisplayData: () => ({}),
      isRevealed: () => false,
    } as any);
    component.currentGameId.set(1);
    (component as unknown as { recoveredPayload: unknown }).recoveredPayload = {
      type: 'BOMBA',
      category: 'CULTURA GENERALE',
    };
    component.recoveredRound.set({
      type: 'BOMBA',
      label: 'Bomba',
      secondsLeft: 40,
      resumable: true,
      paused: false,
    });
    component.stagePhase.set('reading');

    await component.resumeRecoveredRound();

    // Si rientra nella fase di gioco, senza ripetere titolo e lettura.
    expect(component.stagePhase()).toBe('live');
    expect(component.stageReading()).toBeNull();
  });

  it('la domanda di Quiz abbassa il sottofondo e la soluzione lo riporta su', async () => {
    const audio = TestBed.inject(AudioService) as unknown as FakeAudioService;
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('QUIZ', {}, ['Anna']);
    const mode = new QuizMode();
    mode.setConfig(config);
    mode.initialize({
      questions: [{
        question: 'Qual è la capitale d’Italia?',
        options: ['Milano', 'Roma'],
        correctAnswer: 'Roma',
        difficulty: 'facile',
      }],
    });

    vi.useFakeTimers();
    try {
      await mode.start();
      expect(audio.played).toContain('question-open');

      // Scaduto il tempo la TV legge la soluzione: la base d'atto torna piena.
      await vi.advanceTimersByTimeAsync(GAME_TIMINGS.QUIZ.mancheSeconds * 1000);
      expect(audio.played).toContain('question-closed');
    } finally {
      mode.cleanup();
      vi.useRealTimers();
    }
  });

  describe('bonus sparsi negli atti', () => {
    /** `startScheduledBonus` è privato: qui interessa la decisione, non il DOM. */
    function scheduled(component: GameComponent): { startScheduledBonus(): boolean } {
      return component as unknown as { startScheduledBonus(): boolean };
    }

    it('apre il bonus solo nel round che lo ospita', () => {
      const rounds = TestBed.inject(RoundManagerService);
      component.currentGameId.set(1);
      const start = vi.spyOn(component, 'startBonus').mockResolvedValue(undefined);
      vi.spyOn(rounds, 'bonusAfterRound').mockReturnValue(null);
      vi.spyOn(rounds, 'bonusActIndex').mockReturnValue(0);

      // Round normale: nessun bonus, la scaletta va avanti.
      expect(scheduled(component).startScheduledBonus()).toBe(false);
      expect(start).not.toHaveBeenCalled();

      // Round dello slot: il bonus parte da solo.
      vi.mocked(rounds.bonusAfterRound).mockReturnValue('BLACKJACK');
      expect(scheduled(component).startScheduledBonus()).toBe(true);
      expect(start).toHaveBeenCalledWith('BLACKJACK');
    });

    it('non avvia due volte lo stesso bonus', () => {
      vi.useFakeTimers();
      try {
        const rounds = TestBed.inject(RoundManagerService);
        component.currentGameId.set(1);
        vi.spyOn(rounds, 'bonusAfterRound').mockReturnValue('CAVALLO');
        vi.spyOn(rounds, 'bonusActIndex').mockReturnValue(0);

        expect(scheduled(component).startScheduledBonus()).toBe(true);
        expect(component.bonusEntrance()).toBe('CAVALLO');
        // Il bonus è già in scena e il server lo sa: niente secondo ingresso.
        expect(scheduled(component).startScheduledBonus()).toBe(false);
        expect(reliability.bonusActs.filter((act) => act.status === 'STARTED')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('dopo un refresh non riapre un bonus già chiuso', () => {
      const rounds = TestBed.inject(RoundManagerService);
      vi.spyOn(rounds, 'bonusAfterRound').mockReturnValue('BLACKJACK');
      vi.spyOn(rounds, 'bonusActIndex').mockReturnValue(0);
      // La TV ricorda su disco i bonus pagati: è questa memoria che un refresh ritrova.
      localStorage.setItem('bonusClosed:1', JSON.stringify([0]));

      const fresh = TestBed.createComponent(GameComponent);
      fresh.componentInstance.currentGameId.set(1);
      fresh.detectChanges();
      const start = vi.spyOn(fresh.componentInstance, 'startBonus').mockResolvedValue(undefined);

      expect(scheduled(fresh.componentInstance).startScheduledBonus()).toBe(false);
      expect(start).not.toHaveBeenCalled();

      // E se il server dice già chiuso, non serve nemmeno la memoria locale.
      localStorage.removeItem('bonusClosed:1');
      (fresh.componentInstance as unknown as { serverBonus: unknown }).serverBonus = {
        act: 0,
        type: 'BLACKJACK',
        status: 'CLOSED',
      };
      expect(scheduled(fresh.componentInstance).startScheduledBonus()).toBe(false);
      expect(start).not.toHaveBeenCalled();

      fresh.destroy();
    });

    it('chiuso un bonus di metà atto, la scaletta riparte dal round successivo', async () => {
      vi.useFakeTimers();
      try {
        const rounds = TestBed.inject(RoundManagerService);
        rounds.restoreRound(3);
        component.currentGameId.set(1);
        component.bonusEntrance.set(null);
        component.bonusActive.set(true);
        component.bonusType.set('BLACKJACK');

        (component as unknown as { finishBonus(): void }).finishBonus();
        expect(component.bonusActive()).toBe(false);
        expect(component.bonusShowResult()).toBe(false);
        expect(rounds.getCurrentRound()).toBe(3);

        // Il Blackjack non ha una classifica da mostrare: il conto alla rovescia
        // parte subito, senza gli otto secondi di riepilogo del Casino.
        await vi.advanceTimersByTimeAsync(10_000);

        expect(rounds.getCurrentRound()).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('striscia di ripartenza dopo il bonus', () => {
    /** Porta la TV al riepilogo chiuso, quando parte il conto alla rovescia. */
    function closeBonus(type: 'CASINO_COLOR' | 'BLACKJACK' | 'CAVALLO' = 'CASINO_COLOR'): void {
      TestBed.inject(RoundManagerService).restoreRound(3);
      component.currentGameId.set(1);
      component.bonusEntrance.set(null);
      component.bonusActive.set(true);
      component.bonusType.set(type);
      // Il Casino ha una classifica da mostrare; Blackjack e Cavallo no.
      if (type === 'CASINO_COLOR') component.onBonusResult({ playerName: 'Anna', score: 2 });
      (component as unknown as { finishBonus(): void }).finishBonus();
    }

    function strip(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.auto-advance');
    }

    function countdownValue(): string | null {
      return strip()?.querySelector('.auto-advance-count')?.textContent?.trim() ?? null;
    }

    async function waitForCountdown(): Promise<void> {
      await vi.advanceTimersByTimeAsync(8_000);
      fixture.detectChanges();
    }

    it('compare a 10 quando si chiude il riepilogo e scende ogni secondo', async () => {
      vi.useFakeTimers();
      try {
        closeBonus();
        fixture.detectChanges();

        // Negli otto secondi di riepilogo la TV mostra la card, non la striscia.
        expect(component.bonusShowResult()).toBe(true);
        expect(strip()).toBeNull();

        await waitForCountdown();

        expect(component.bonusShowResult()).toBe(false);
        expect(strip()?.textContent).toContain('RIPARTENZA · PROSSIMO ROUND');
        expect(countdownValue()).toBe('10');

        await vi.advanceTimersByTimeAsync(1_000);
        fixture.detectChanges();
        expect(countdownValue()).toBe('9');
      } finally {
        vi.useRealTimers();
      }
    });

    it.each(['BLACKJACK', 'CAVALLO'] as const)(
      'chiude %s senza classifica vuota e riparte subito',
      async (type) => {
        vi.useFakeTimers();
        try {
          closeBonus(type);
          fixture.detectChanges();

          expect(component.bonusShowResult()).toBe(false);
          expect(component.bonusResult()).toEqual([]);
          expect(fixture.nativeElement.querySelector('.bonus-overlay')).toBeNull();
          expect(fixture.nativeElement.textContent).not.toContain('Nessun punto registrato');

          await vi.advanceTimersByTimeAsync(0);
          fixture.detectChanges();
          expect(strip()).not.toBeNull();
          expect(countdownValue()).toBe('10');
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it.each([
      { caso: 'la pausa', interrompi: () => component.togglePause(), roundDopo: 3 },
      { caso: 'la classifica', interrompi: () => component.adminShowLeaderboard(), roundDopo: 3 },
      { caso: 'l’avanzamento manuale', interrompi: () => component.adminNextRound(), roundDopo: 4 },
    ])('sparisce con $caso e non fa ripartire da sola la scaletta', async ({ interrompi, roundDopo }) => {
      vi.useFakeTimers();
      try {
        const rounds = TestBed.inject(RoundManagerService);
        closeBonus();
        await waitForCountdown();
        expect(strip()).not.toBeNull();

        interrompi();
        fixture.detectChanges();
        expect(strip()).toBeNull();

        // Passati gli altri dieci secondi, il conto chiuso non avanza più nulla.
        await vi.advanceTimersByTimeAsync(10_000);
        expect(rounds.getCurrentRound()).toBe(roundDopo);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
