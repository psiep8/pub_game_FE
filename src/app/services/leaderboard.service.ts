// src/app/services/leaderboard.service.ts

import {Injectable, signal} from '@angular/core';

export interface PlayerScore {
  playerName: string;
  totalPoints: number;
  correctAnswers: number;
  wrongAnswers: number;
  position: number;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  private players = signal<Map<string, PlayerScore>>(new Map());

  constructor() {
    this.loadScores();
  }

  addPoints(playerName: string, points: number, isCorrect: boolean) {
    const playersMap = new Map(this.players());

    const existing = playersMap.get(playerName);

    if (existing) {
      existing.totalPoints += points;
      existing.correctAnswers += isCorrect ? 1 : 0;
      existing.wrongAnswers += !isCorrect ? 1 : 0;
    } else {
      playersMap.set(playerName, {
        playerName,
        totalPoints: points,
        correctAnswers: isCorrect ? 1 : 0,
        wrongAnswers: !isCorrect ? 1 : 0,
        position: 0
      });
    }

    this.players.set(playersMap);
    this.updatePositions();
    this.saveScores();

    console.log(`📊 ${playerName}: ${points > 0 ? '+' : ''}${points} punti (Totale: ${playersMap.get(playerName)?.totalPoints})`);
  }

  getLeaderboard(): PlayerScore[] {
    const sorted = Array.from(this.players().values())
      .sort((a, b) => b.totalPoints - a.totalPoints);
    return sorted;
  }

  getTop3(): PlayerScore[] {
    return this.getLeaderboard().slice(0, 3);
  }

  getPlayerPosition(playerName: string): number {
    const leaderboard = this.getLeaderboard();
    return leaderboard.findIndex(p => p.playerName === playerName) + 1;
  }

  getPlayerStats(playerName: string): PlayerScore | null {
    return this.players().get(playerName) || null;
  }

  reset() {
    this.players.set(new Map());
    localStorage.removeItem('leaderboard');
    console.log('🔄 Classifica resettata');
  }

  private updatePositions() {
    const sorted = this.getLeaderboard();
    const playersMap = new Map(this.players());
    sorted.forEach((player, index) => {
      const p = playersMap.get(player.playerName);
      if (p) {
        p.position = index + 1;
      }
    });
    this.players.set(playersMap);
  }

  private saveScores() {
    const data = Array.from(this.players().entries());
    localStorage.setItem('leaderboard', JSON.stringify(data));
  }

  private loadScores() {
    const saved = localStorage.getItem('leaderboard');
    if (saved) {
      try {
        const data: [string, PlayerScore][] = JSON.parse(saved);
        this.players.set(new Map(data));
        this.updatePositions();
        console.log('📂 Classifica caricata:', this.getLeaderboard());
      } catch (e) {
        console.error('❌ Errore caricamento classifica');
      }
    }
  }

  getStats() {
    const leaderboard = this.getLeaderboard();
    return {
      totalPlayers: leaderboard.length,
      totalPoints: leaderboard.reduce((sum, p) => sum + p.totalPoints, 0),
      averagePoints: leaderboard.length > 0
        ? leaderboard.reduce((sum, p) => sum + p.totalPoints, 0) / leaderboard.length
        : 0,
      leader: leaderboard[0] || null
    };
  }
}
