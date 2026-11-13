import { Injectable, signal } from '@angular/core';

export interface PlayerScore {
  playerName: string;
  totalPoints: number;
  correctAnswers: number;
  wrongAnswers: number;
  position: number;
}

const STORAGE_KEY = 'leaderboard';

/** Callback con cui la TV salva la classifica sul server dopo ogni variazione. */
export type LeaderboardPersistence = (entries: PlayerScore[]) => void;

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private players = signal<Map<string, PlayerScore>>(new Map());
  private persistence: LeaderboardPersistence | null = null;
  private pointsListener: ((playerName: string, points: number) => void) | null = null;

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
    this.persistence?.(this.getLeaderboard());
    this.pointsListener?.(playerName, points);
  }

  getLeaderboard(): PlayerScore[] {
    return Array.from(this.players().values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  /** Fotografia della classifica da inviare al server. */
  entries(): PlayerScore[] {
    return this.getLeaderboard();
  }

  /**
   * Sostituisce la classifica con quella autorevole del server.
   *
   * <p>La usa la TV appena si collega: dopo un refresh o da un altro
   * dispositivo i punti non ripartono da zero. Non richiama la persistenza,
   * altrimenti l'idratazione riscriverebbe subito ciò che ha appena letto.</p>
   */
  replaceAll(entries: Array<Partial<PlayerScore>> | null | undefined): void {
    const players = new Map<string, PlayerScore>();
    for (const entry of entries ?? []) {
      const playerName = String(entry?.playerName ?? '').trim();
      if (!playerName) continue;
      players.set(playerName, {
        playerName,
        totalPoints: Number(entry.totalPoints) || 0,
        correctAnswers: Number(entry.correctAnswers) || 0,
        wrongAnswers: Number(entry.wrongAnswers) || 0,
        position: 0,
      });
    }
    this.players.set(this.withPositions(players));
    this.saveScores();
  }

  /** Registra (o rimuove) il salvataggio server della classifica. */
  setPersistence(sink: LeaderboardPersistence | null): void {
    this.persistence = sink;
  }

  /** La TV ascolta qui: serve a contare solo i punti del round aperto. */
  setPointListener(listener: ((playerName: string, points: number) => void) | null): void {
    this.pointsListener = listener;
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
    this.persistence?.([]);
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
