import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LeaderboardQuick } from './leaderboard-quick.component';
import { LeaderboardService, PlayerScore } from '../../../../core/services/leaderboard.service';

const players: PlayerScore[] = [
  { playerName: 'Anna', totalPoints: 300, correctAnswers: 3, wrongAnswers: 0, position: 1 },
  { playerName: 'Bruno', totalPoints: 200, correctAnswers: 2, wrongAnswers: 1, position: 2 },
  { playerName: 'Carla', totalPoints: 100, correctAnswers: 1, wrongAnswers: 2, position: 3 },
];

describe('LeaderboardQuick', () => {
  let fixture: ComponentFixture<LeaderboardQuick>;
  let component: LeaderboardQuick;
  let onComplete: ReturnType<typeof vi.fn>;

  function create(stored: PlayerScore[]): void {
    TestBed.configureTestingModule({
      imports: [LeaderboardQuick],
      providers: [
        provideNoopAnimations(),
        { provide: LeaderboardService, useValue: { getLeaderboard: () => [...stored] } },
      ],
    });

    fixture = TestBed.createComponent(LeaderboardQuick);
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

  it('should reveal players from the last position upwards', async () => {
    vi.useFakeTimers();
    create(players);

    expect(component.totalPlayers()).toBe(3);
    expect(component.visiblePlayers().map((player) => player.playerName)).toEqual(['Carla']);

    await vi.advanceTimersByTimeAsync(4000);
    expect(component.visiblePlayers().map((player) => player.playerName)).toEqual(['Carla', 'Bruno']);

    await vi.advanceTimersByTimeAsync(5000);
    expect(component.visiblePlayers().map((player) => player.playerName)).toEqual([
      'Carla',
      'Bruno',
      'Anna',
    ]);
    expect(component.progress()).toBe(100);
  });

  it('should notify the parent when the whole sequence is over', async () => {
    vi.useFakeTimers();
    create(players);

    await vi.advanceTimersByTimeAsync(4000 + 5000 + 6000 + 5000);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should complete immediately when there is no leaderboard', async () => {
    vi.useFakeTimers();
    create([]);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(component.visiblePlayers()).toEqual([]);
  });
});
