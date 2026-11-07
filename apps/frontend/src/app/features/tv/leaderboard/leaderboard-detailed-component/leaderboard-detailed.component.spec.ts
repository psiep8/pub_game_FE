import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LeaderboardDetailed } from './leaderboard-detailed.component';
import { LeaderboardService, PlayerScore } from '../../../../core/services/leaderboard.service';

const players: PlayerScore[] = [
  { playerName: 'Anna', totalPoints: 300, correctAnswers: 3, wrongAnswers: 0, position: 1 },
  { playerName: 'Bruno', totalPoints: 200, correctAnswers: 2, wrongAnswers: 1, position: 2 },
  { playerName: 'Carla', totalPoints: 100, correctAnswers: 1, wrongAnswers: 2, position: 3 },
];

describe('LeaderboardDetailed', () => {
  let fixture: ComponentFixture<LeaderboardDetailed>;
  let component: LeaderboardDetailed;
  let onComplete: ReturnType<typeof vi.fn>;

  function create(stored: PlayerScore[]): void {
    TestBed.configureTestingModule({
      imports: [LeaderboardDetailed],
      providers: [
        provideNoopAnimations(),
        { provide: LeaderboardService, useValue: { getLeaderboard: () => [...stored] } },
      ],
    });

    fixture = TestBed.createComponent(LeaderboardDetailed);
    component = fixture.componentInstance;
    onComplete = vi.fn();
    component.onComplete.subscribe(onComplete);
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
  });

  it('should create', () => {
    vi.useFakeTimers();
    create(players);
    expect(component).toBeTruthy();
  });

  it('should spotlight the last classified player first', () => {
    vi.useFakeTimers();
    create(players);

    expect(component.totalPlayers()).toBe(3);
    expect(component.currentPlayer()?.playerName).toBe('Carla');
    expect(component.revealedCount()).toBe(1);
  });

  it('should move the spotlight up the ranking', async () => {
    vi.useFakeTimers();
    create(players);

    await vi.advanceTimersByTimeAsync(3000);
    expect(component.currentPlayer()?.playerName).toBe('Bruno');

    await vi.advanceTimersByTimeAsync(3000);
    expect(component.currentPlayer()?.playerName).toBe('Anna');
  });

  it('should notify the parent once the winner has been shown', async () => {
    vi.useFakeTimers();
    create(players);

    await vi.advanceTimersByTimeAsync(2600 + 3000 + 3600 + 8000);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should complete immediately when there is no leaderboard', async () => {
    vi.useFakeTimers();
    create([]);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(component.currentPlayer()).toBeNull();
  });
});
