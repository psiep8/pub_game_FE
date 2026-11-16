import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { GameComponent } from './game.component';
import { AiGeneratorService } from '../../core/services/ai-generator-service';
import { AudioService } from '../../core/services/audio.service';
import { GameService } from '../../core/services/game.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
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

  it('salva il checkpoint Arena con l indice del round corrente', () => {
    component.round.set({ roundIndex: 5 } as any);
    const config = (component as unknown as {
      buildModeConfig(type: string, payload: any, players: string[]): any;
    }).buildModeConfig('ARENA', {}, ['Anna']);
    const state = { teams: [{ playerName: 'Anna', distance: 20 }] };
    config.onTvCheckpoint({ type: 'ARENA', revision: 2, state });
    expect(reliability.tvCheckpoints).toEqual([
      { mode: 'ARENA', revision: 2, state, roundIndex: 5 },
    ]);
  });

  it('salva il checkpoint Bomba con indice del round e sequenza eventi', () => {
    component.round.set({ roundIndex: 7 } as any);
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
