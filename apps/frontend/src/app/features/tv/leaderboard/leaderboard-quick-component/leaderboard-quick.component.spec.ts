import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

import { LeaderboardQuick } from './leaderboard-quick.component';
import { LeaderboardService, PlayerScore } from '../../../../core/services/leaderboard.service';

const players: PlayerScore[] = [
  { playerName: 'Anna', totalPoints: 300, correctAnswers: 3, wrongAnswers: 0, position: 1 },
  { playerName: 'Bruno', totalPoints: 200, correctAnswers: 2, wrongAnswers: 1, position: 2 },
  { playerName: 'Carla', totalPoints: 100, correctAnswers: 1, wrongAnswers: 2, position: 3 },
];

function many(count: number): PlayerScore[] {
  return Array.from({ length: count }, (_, i) => ({
    playerName: `Squadra ${i + 1}`,
    totalPoints: 1000 - i * 10,
    correctAnswers: 0,
    wrongAnswers: 0,
    position: i + 1,
  }));
}

describe('LeaderboardQuick', () => {
  let fixture: ComponentFixture<LeaderboardQuick>;
  let component: LeaderboardQuick;
  let onComplete: ReturnType<typeof vi.fn>;
  let previous: Map<string, number>;
  let rememberRanks: ReturnType<typeof vi.fn>;

  function create(stored: PlayerScore[], ranks: Record<string, number> = {}): void {
    previous = new Map(Object.entries(ranks));
    rememberRanks = vi.fn();
    TestBed.configureTestingModule({
      imports: [LeaderboardQuick],
      providers: [
        provideNoopAnimations(),
        {
          provide: LeaderboardService,
          useValue: {
            getLeaderboard: () => [...stored],
            previousRanks: () => new Map(previous),
            rememberRanks,
          },
        },
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

    // Terzo posto: pausa breve da podio (900 ms), poi entra Bruno.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(component.visiblePlayers().map((player) => player.playerName)).toEqual(['Carla', 'Bruno']);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(component.visiblePlayers().map((player) => player.playerName)).toEqual([
      'Carla',
      'Bruno',
      'Anna',
    ]);
    expect(component.progress()).toBe(100);
  });

  it('chiude la flash entro il bersaglio di 10–12 secondi', async () => {
    vi.useFakeTimers();
    create(many(12));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(onComplete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_100);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(rememberRanks).toHaveBeenCalledTimes(1);
  });

  it('oltre otto squadre mostra solo la finestra delle ultime, senza perdere il podio', async () => {
    vi.useFakeTimers();
    create(many(20));

    await vi.advanceTimersByTimeAsync(15_000);
    fixture.detectChanges();

    expect(component.visiblePlayers()).toHaveLength(20);
    expect(component.windowPlayers()).toHaveLength(8);
    expect(component.windowPlayers().at(-1)?.position).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.player-row')).toHaveLength(8);
  });

  it('mostra di quanto è salita o scesa ogni squadra dall’ultima classifica', () => {
    vi.useFakeTimers();
    create(players, { Anna: 3, Bruno: 1, Carla: 3 });

    expect(component.movement(component.allPlayers().find((p) => p.playerName === 'Anna')!)).toBe(2);
    expect(component.movement(component.allPlayers().find((p) => p.playerName === 'Bruno')!)).toBe(-1);
  });

  it('should complete immediately when there is no leaderboard', async () => {
    vi.useFakeTimers();
    create([]);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(component.visiblePlayers()).toEqual([]);
  });
});
