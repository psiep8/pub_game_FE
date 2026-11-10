import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { throwError } from 'rxjs';

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

  it('does not start games whose scores are self-reported', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'extractGameType').mockReturnValue('SPEED_RUSH');
    const before = rounds.getCurrentRound();
    await component.startNewRound();
    expect(rounds.getCurrentRound()).toBe(before);
    await component.startBonus('BASKET');
    expect(component.bonusActive()).toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });

  it('does not start Basket automatically after the detailed leaderboard', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const rounds = TestBed.inject(RoundManagerService);
    vi.spyOn(rounds, 'bonusAfterAct').mockReturnValue('BASKET');
    vi.spyOn(rounds, 'getCurrentAct').mockReturnValue(1);
    component.showLeaderboardDetailed.set(true);
    component.isShowingLeaderboard.set(true);

    component.onLeaderboardComplete();

    expect(component.bonusActive()).toBe(false);
    expect(component.showLeaderboardDetailed()).toBe(true);
    expect(alert).toHaveBeenCalledOnce();
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
