import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LeaderboardDetailed } from './leaderboard-detailed.component';
import { LeaderboardService, PlayerScore } from '../../../../core/services/leaderboard.service';
import { AudioService } from '../../../../core/services/audio.service';
import type { RoundScoreHistory } from './leaderboard-film';

const players: PlayerScore[] = [
  { playerName: 'Anna', totalPoints: 300, correctAnswers: 3, wrongAnswers: 0, position: 1 },
  { playerName: 'Bruno', totalPoints: 200, correctAnswers: 2, wrongAnswers: 1, position: 2 },
  { playerName: 'Carla', totalPoints: 100, correctAnswers: 1, wrongAnswers: 2, position: 3 },
];

describe('LeaderboardDetailed', () => {
  let fixture: ComponentFixture<LeaderboardDetailed>;
  let component: LeaderboardDetailed;
  let onComplete: ReturnType<typeof vi.fn>;

  function create(stored: PlayerScore[], history?: RoundScoreHistory): void {
    TestBed.configureTestingModule({
      imports: [LeaderboardDetailed],
      providers: [
        provideNoopAnimations(),
        {
          provide: LeaderboardService,
          useValue: {
            getLeaderboard: () => [...stored],
            previousRanks: () => new Map<string, number>(),
            rememberRanks: vi.fn(),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(LeaderboardDetailed);
    component = fixture.componentInstance;
    component.roundScores = history ?? null;
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

  it('mostra la storia della squadra presa dallo storico server', () => {
    vi.useFakeTimers();
    const history: RoundScoreHistory = {
      rounds: [
        {
          roundIndex: 0,
          type: 'MUSIC',
          entries: [
            { playerName: 'Anna', points: 100, totalPoints: 1000 },
            { playerName: 'Bruno', points: 0, totalPoints: 600 },
            { playerName: 'Carla', points: 50, totalPoints: 700 },
          ],
        },
        {
          roundIndex: 1,
          type: 'QUIZ',
          entries: [
            { playerName: 'Anna', points: 0, totalPoints: 1000 },
            { playerName: 'Bruno', points: 300, totalPoints: 900 },
            { playerName: 'Carla', points: -100, totalPoints: 600 },
          ],
        },
        {
          roundIndex: 2,
          type: 'MUSIC',
          entries: [
            { playerName: 'Anna', points: 200, totalPoints: 1200 },
            { playerName: 'Bruno', points: -50, totalPoints: 850 },
            { playerName: 'Carla', points: 400, totalPoints: 1000 },
          ],
        },
      ],
    };
    create(players, history);

    expect(component.currentPlayer()?.playerName).toBe('Carla');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('MIGLIOR ROUND');
    expect(text).toContain('R3 · MUSIC · +400');
    expect(text).toContain('R2 · QUIZ · -100');
    expect(text).toContain('RIMONTA');
    expect(text).toContain('+1 POSIZIONI');
    expect(text).toContain('GIOCO FORTE');
    expect(text).toContain('MUSIC · +450');
  });

  it('annuncia il podio prima di svelarlo', async () => {
    vi.useFakeTimers();
    const many: PlayerScore[] = [
      { playerName: 'Anna', totalPoints: 600, correctAnswers: 6, wrongAnswers: 0, position: 1 },
      { playerName: 'Bruno', totalPoints: 500, correctAnswers: 5, wrongAnswers: 1, position: 2 },
      { playerName: 'Carla', totalPoints: 400, correctAnswers: 4, wrongAnswers: 1, position: 3 },
      { playerName: 'Dino', totalPoints: 300, correctAnswers: 3, wrongAnswers: 2, position: 4 },
      { playerName: 'Elena', totalPoints: 200, correctAnswers: 2, wrongAnswers: 2, position: 5 },
      { playerName: 'Fabio', totalPoints: 100, correctAnswers: 1, wrongAnswers: 3, position: 6 },
    ];
    create(many);

    // Sei squadre: sesto (1100), timbro 5° (1600), quinto (2400), timbro 4°
    // (1600), quarto (2800), poi il timbro del terzo.
    await vi.advanceTimersByTimeAsync(1100 + 1600 + 2400 + 1600 + 2800);
    fixture.detectChanges();
    expect(component.podiumSoon()).toBe(3);
    expect(component.currentPlayer()?.position).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('TRA POCO');
    expect(fixture.nativeElement.textContent).toContain('IL PODIO · 3° POSTO');

    await vi.advanceTimersByTimeAsync(1600);
    fixture.detectChanges();
    expect(component.podiumSoon()).toBeNull();
    expect(component.currentPlayer()?.position).toBe(3);
  });

  it('accompagna quinto e quarto posto con un richiamo dedicato', async () => {
    vi.useFakeTimers();
    const many: PlayerScore[] = [
      { playerName: 'Anna', totalPoints: 600, correctAnswers: 6, wrongAnswers: 0, position: 1 },
      { playerName: 'Bruno', totalPoints: 500, correctAnswers: 5, wrongAnswers: 1, position: 2 },
      { playerName: 'Carla', totalPoints: 400, correctAnswers: 4, wrongAnswers: 1, position: 3 },
      { playerName: 'Dino', totalPoints: 300, correctAnswers: 3, wrongAnswers: 2, position: 4 },
      { playerName: 'Elena', totalPoints: 200, correctAnswers: 2, wrongAnswers: 2, position: 5 },
      { playerName: 'Fabio', totalPoints: 100, correctAnswers: 1, wrongAnswers: 3, position: 6 },
    ];
    create(many);
    const reveal = vi.spyOn(TestBed.inject(AudioService), 'playRankReveal');

    // Il sesto posto entra, poi il timbro del quinto anticipa la sua storia.
    await vi.advanceTimersByTimeAsync(1100);
    expect(component.podiumSoon()).toBe(5);
    expect(component.currentPlayer()?.position).toBe(6);

    await vi.advanceTimersByTimeAsync(1600);
    expect(component.currentPlayer()?.position).toBe(5);
    expect(reveal).toHaveBeenCalledWith(5);

    await vi.advanceTimersByTimeAsync(2400);
    expect(component.podiumSoon()).toBe(4);
    expect(component.currentPlayer()?.position).toBe(5);

    await vi.advanceTimersByTimeAsync(1600);
    expect(component.currentPlayer()?.position).toBe(4);
    expect(reveal).toHaveBeenCalledWith(4);
  });

  it('should notify the parent once the winner has been shown', async () => {
    vi.useFakeTimers();
    create(players);

    // Q-05: la dettagliata resta almeno 30 secondi, anche con tre squadre.
    await vi.advanceTimersByTimeAsync(29_000);
    expect(onComplete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_100);
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
