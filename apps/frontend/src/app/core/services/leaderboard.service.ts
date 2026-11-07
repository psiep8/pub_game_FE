import { Injectable, signal } from '@angular/core';

export interface PlayerScore {
  playerName: string;
  totalPoints: number;
  correctAnswers: number;
  wrongAnswers: number;
  position: number;
}

const STORAGE_KEY = 'leaderboard';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private players = signal<Map<string, PlayerScore>>(new Map());

  constructor() {
    this.loadScores();
  }

  addPoints(playerName: string, points: number, isCorrect: boolean): void {
    const players = new Map(this.players());
    const existing = players.get(playerName);

    players.set(
      playerName,
      existing
        ? {
            ...existing,
            totalPoints: existing.totalPoints + points,
            correctAnswers: existing.correctAnswers + (isCorrect ? 1 : 0),
            wrongAnswers: existing.wrongAnswers + (isCorrect ? 0 : 1),
          }
        : {
            playerName,
            totalPoints: points,
            correctAnswers: isCorrect ? 1 : 0,
            wrongAnswers: isCorrect ? 0 : 1,
            position: 0,
          },
    );

    this.players.set(this.withPositions(players));
    this.saveScores();
  }

  getLeaderboard(): PlayerScore[] {
    return Array.from(this.players().values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  getTop3(): PlayerScore[] {
    return this.getLeaderboard().slice(0, 3);
  }

  getPlayerPosition(playerName: string): number {
    return this.getLeaderboard().findIndex((p) => p.playerName === playerName) + 1;
  }

  getPlayerStats(playerName: string): PlayerScore | null {
    return this.players().get(playerName) ?? null;
  }

  reset(): void {
    this.players.set(new Map());
    localStorage.removeItem(STORAGE_KEY);
  }

  getStats() {
    const leaderboard = this.getLeaderboard();
    const totalPoints = leaderboard.reduce((sum, player) => sum + player.totalPoints, 0);

    return {
      totalPlayers: leaderboard.length,
      totalPoints,
      averagePoints: leaderboard.length > 0 ? totalPoints / leaderboard.length : 0,
      leader: leaderboard[0] ?? null,
    };
  }

  /** Ricalcola le posizioni in modo immutabile, senza mutare gli oggetti salvati. */
  private withPositions(players: Map<string, PlayerScore>): Map<string, PlayerScore> {
    const ranked = Array.from(players.values()).sort((a, b) => b.totalPoints - a.totalPoints);

    return new Map(
      ranked.map((player, index) => [player.playerName, { ...player, position: index + 1 }]),
    );
  }

  private saveScores(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.players().entries())));
  }

  private loadScores(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data: [string, PlayerScore][] = JSON.parse(saved);
      this.players.set(this.withPositions(new Map(data)));
    } catch {
      console.error('❌ Errore caricamento classifica');
    }
  }
}
