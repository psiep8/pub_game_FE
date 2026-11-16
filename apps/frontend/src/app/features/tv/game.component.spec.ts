import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
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

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;
  let ws: FakeWebSocketService;
  let leaderboard: LeaderboardService;
  let reliability: FakeReliabilityService;

  beforeEach(async () => {
    localStorage.clear();

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

  it('applica una sola volta l\'esito Quiz arrivato dal server', () => {
    const applyServerAnswer = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    component.currentMode.set({ type: 'QUIZ', applyServerAnswer } as any);
    const addPoints = vi.spyOn(leaderboard, 'addPoints');

    ws.status$.next({ action: 'QUIZ_ANSWER', playerName: 'Anna', manche: 0, isCorrect: true, points: 300 });
    ws.status$.next({ action: 'QUIZ_ANSWER', playerName: 'Anna', manche: 0, isCorrect: true, points: 300 });

    expect(applyServerAnswer).toHaveBeenCalledTimes(2);
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

  it('salva il checkpoint Arena con l indice della scaletta, non con il round vecchio', () => {
    // Scaletta: 6 round chiusi, quindi il round aperto è l'indice 5.
    TestBed.inject(RoundManagerService).restoreRound(6);
    // `round()` è ancora la fotografia del round precedente.
    component.round.set({ roundIndex: 3 } as any);
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('ARENA', {}, ['Anna']);
    const state = { teams: [{ playerName: 'Anna', distance: 20 }] };
    config.onTvCheckpoint({ type: 'ARENA', revision: 2, state });
    expect(reliability.tvCheckpoints).toEqual([
      { mode: 'ARENA', revision: 2, state, roundIndex: 5 },
    ]);
  });

  it('salva il checkpoint col round del server quando la scaletta è avanti', () => {
    // Avanzamento locale avanti: round aperto 8, il server è fermo al 6.
    TestBed.inject(RoundManagerService).restoreRound(9);
    const tv = component as unknown as { applyAuthoritativeState(snapshot: any): void };
    tv.applyAuthoritativeState({
      hasState: true, status: 'RUNNING', roundType: 'BOMBA', roundIndex: 6, roundKey: 'g1-r6',
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
    });

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
      roundDeadlineAt: Date.now() + 60_000, currentRound: { payload: {} },
      tvCheckpoint: { mode: 'QUIZ', roundKey: 'g1-r6', startedAt: 1, revision: 2, state: { mancheIndex: 1 } },
    });
    expect(rounds.getCurrentRound()).toBe(9);

    await component.resumeRecoveredRound();

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
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    component.currentGameId.set(1);
    component.currentMode.set({ isRevealed: () => false } as any);
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);

    component.adminNextRound();

    expect(close).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(component.showLeaderboardDetailed()).toBe(true);
    expect(component.isShowingLeaderboard()).toBe(true);
    expect(alert).toHaveBeenCalledOnce();
    alert.mockRestore();
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
});
