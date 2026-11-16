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

  /**
   * Toglie una squadra espulsa se non ha ancora punti: chi ha già giocato
   * resta in classifica, perché i punti non si cancellano senza una decisione.
   *
   * @returns `true` se la squadra è stata tolta, `false` se resta in tabella.
   */
  forgetIfNoPoints(playerName: string): boolean {
    const entry = this.players().get(playerName);
    if (!entry || entry.totalPoints !== 0) return false;
    const players = new Map(this.players());
    players.delete(playerName);
    this.players.set(this.withPositions(players));
    this.saveScores();
    this.persistence?.(this.getLeaderboard());
    return true;
  }

  /**
   * Sposta una squadra sul nuovo nome scelto dal telefono.
   *
   * <p>Serve al rientro con un nome diverso: la squadra è la stessa, quindi
   * punti e risposte la seguono invece di restare su una riga fantasma. Se il
   * nuovo nome esisteva già, i totali si sommano.</p>
   */
  renamePlayer(previousName: string, nextName: string): boolean {
    const previous = previousName.trim();
    const next = nextName.trim();
    if (!previous || !next || previous === next) return false;

    const players = new Map(this.players());
    const entry = players.get(previous);
    if (!entry) return false;

    const merged = players.get(next);
    players.delete(previous);
    players.set(next, {
      ...entry,
      playerName: next,
      totalPoints: entry.totalPoints + (merged?.totalPoints ?? 0),
      correctAnswers: entry.correctAnswers + (merged?.correctAnswers ?? 0),
      wrongAnswers: entry.wrongAnswers + (merged?.wrongAnswers ?? 0),
    });

    this.players.set(this.withPositions(players));
    this.saveScores();
    this.persistence?.(this.getLeaderboard());
    return true;
  }

  /**
   * Toglie le squadre a zero punti indicate come assenti.
   *
   * <p>Un telefono che chiude la pagina lascia una riga in classifica: se non ha
   * ancora punti non è nessuno, e va via. Chi ha giocato resta comunque. Decide
   * la TV <em>quali</em> nomi sono assenti, perché una sola fotografia delle
   * presenze può essere in ritardo e non deve far sparire chi è appena entrato.</p>
   *
   * @returns i nomi tolti, così la TV può liberare le loro palette.
   */
  forgetAbsent(absent: string[]): string[] {
    const candidates = new Set(absent.map((name) => name.trim()).filter(Boolean));
    const players = new Map(this.players());
    const removed: string[] = [];

    for (const [name, entry] of players) {
      if (entry.totalPoints !== 0 || !candidates.has(name)) continue;
      players.delete(name);
      removed.push(name);
    }
    if (!removed.length) return [];

    this.players.set(this.withPositions(players));
    this.saveScores();
    this.persistence?.(this.getLeaderboard());
    return removed;
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
