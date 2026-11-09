import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

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

  it('should register a joining player with zero points', async () => {
    ws.status$.next({ action: 'JOIN_GAME', playerName: '  Bruno  ' });
    await fixture.whenStable();

    expect(leaderboard.getPlayerStats('Bruno')?.totalPoints).toBe(0);
    expect(leaderboard.getPlayerStats('Bruno')?.position).toBe(1);
  });

  it('should not expose a pre-round countdown any more', () => {
    expect((component as any).preStartCountdown).toBeUndefined();
    expect((component as any).getPrestartPreview).toBeUndefined();
  });
});
