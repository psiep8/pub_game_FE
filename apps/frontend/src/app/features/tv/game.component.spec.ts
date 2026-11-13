import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

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
import { ButtonTestService } from '../../core/services/button-test.service';
import { FakeButtonTestService } from '../../shared/testing/fake-button-test.service';
import { GamePhase } from '../../shared/enums/game-phase';
import { WsAction } from '../../shared/enums/ws-action';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;
  let ws: FakeWebSocketService;
  let leaderboard: LeaderboardService;

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

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
    expect(arenaMode.applyArenaAnswer).toHaveBeenCalledWith('Anna', true, 10);
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

  it('starts Speed Rush and Basket with server-verified scoring', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    vi.spyOn(game, 'startSpeedRush').mockReturnValue(of({ active: true }));
    const startBasket = vi.spyOn(game, 'startBasket').mockReturnValue(of({ active: true }));
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'extractGameType').mockReturnValue('SPEED_RUSH');
    const before = rounds.getCurrentRound();
    await component.startNewRound();
    expect(rounds.getCurrentRound()).not.toBe(before);
    expect(alert).not.toHaveBeenCalled();
    await component.startBonus('BASKET');
    expect(component.bonusActive()).toBe(true);
    expect(startBasket).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('starts Basket automatically with server scoring after the detailed leaderboard', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const game = TestBed.inject(GameService) as unknown as FakeGameService;
    const startBasket = vi.spyOn(game, 'startBasket').mockReturnValue(of({ active: true }));
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'bonusAfterAct').mockReturnValue('BASKET');
    vi.spyOn(rounds, 'getCurrentAct').mockReturnValue(1);
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);

    component.onLeaderboardComplete();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(startBasket).toHaveBeenCalled();
    expect(component.bonusActive()).toBe(true);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
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
