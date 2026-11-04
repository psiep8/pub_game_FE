import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export interface ArenaTeamProgress {
  playerName: string;
  /** 0 = centro, 100 = bordo esterno. */
  distance: number;
  eliminated: boolean;
  score: number;
  position?: number;
}

export interface ArenaDisplayData {
  teams: ArenaTeamProgress[];
  circleRadius: number;
  eliminatedPlayers: string[];
  gameEnded: boolean;
  winners: string[];
}

const MIN_RADIUS = 20;
const SHRINK_GRACE_SECONDS = 10;
const TICK_MS = 1000;

export class ArenaMode extends GameModeBase {
  readonly type: GameModeType = 'ARENA';
  readonly timerDuration = 90;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private teams = signal<Map<string, ArenaTeamProgress>>(new Map());
  private circleRadius = signal<number>(100);
  private eliminatedPlayers = signal<string[]>([]);
  private gameEnded = signal<boolean>(false);
  private winners = signal<string[]>([]);

  protected onInitialize(): void {
    // Le squadre si creano in onStart, quando la configurazione è già applicata.
  }

  protected async onStart(): Promise<void> {
    this.initializeTeams();
    await this.runPreGameSequence(5000);
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.endGame();
  }

  protected onCleanup(): void {
    this.teams.set(new Map());
    this.circleRadius.set(100);
    this.eliminatedPlayers.set([]);
    this.gameEnded.set(false);
    this.winners.set([]);
  }

  protected onTimeout(): void {
    this.endGame();
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(playerName: string, _answer: any, result: any): void {
    if (this.gameEnded() || !this.isActive()) return;

    this.updateTeamFromAnswer(playerName, !!result?.isCorrect, result?.points || 0);
  }

  /** Risposta rapida arrivata dal telefono (canale WebSocket dedicato). */
  applyArenaAnswer(playerName: string, isCorrect: boolean, points: number = 0): void {
    if (this.gameEnded() || !this.isActive()) return;
    this.updateTeamFromAnswer(playerName, isCorrect, points);
  }

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: answer?.isCorrect || false };
  }

  protected calculatePoints(isCorrect: boolean, _elapsedMs: number): number {
    return isCorrect ? 10 : -10;
  }

  /**
   * Il cerchio si restringe negli ultimi secondi: chi resta fuori viene eliminato.
   */
  protected override startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.isPaused() || this.buzzedPlayer()) return;

      const current = this.timer();
      if (current > 0) {
        this.timer.set(current - 1);
        this.config.onTimerTick?.(current - 1);
        this.circleRadius.set(this.radiusForSecond(current));
        this.checkEliminations();
      } else {
        this.stopTimer();
        this.handleTimeout();
      }
    }, TICK_MS);
  }

  private radiusForSecond(secondsLeft: number): number {
    const timeRatio = secondsLeft / this.timerDuration;
    const shrinkStartRatio = (this.timerDuration - SHRINK_GRACE_SECONDS) / this.timerDuration;

    if (timeRatio >= shrinkStartRatio) return 100;

    const normalizedRatio = timeRatio / shrinkStartRatio;
    return MIN_RADIUS + (100 - MIN_RADIUS) * normalizedRatio;
  }

  private initializeTeams(): void {
    const activePlayers = this.config.activePlayers ?? [];
    const initialTeams = new Map<string, ArenaTeamProgress>();

    // L'array arriva già ordinato per classifica: chi è davanti parte più
    // vicino al centro, chi è indietro più vicino al bordo.
    activePlayers.forEach((playerName: string, index: number) => {
      const rankRatio = activePlayers.length > 1 ? index / (activePlayers.length - 1) : 0.5;

      initialTeams.set(playerName, {
        playerName,
        distance: 30 + rankRatio * 50,
        eliminated: false,
        score: 0,
      });
    });

    this.teams.set(initialTeams);
    this.circleRadius.set(100);
    this.eliminatedPlayers.set([]);
    this.gameEnded.set(false);
    this.winners.set([]);
  }

  private updateTeamFromAnswer(playerName: string, isCorrect: boolean, roundScore: number): void {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();

    const teamKey = Array.from(currentTeams.keys()).find((name) => name.toLowerCase() === key);
    if (!teamKey) return;

    const team = currentTeams.get(teamKey);
    if (!team || team.eliminated) return;

    // Bilanciamento: con il 50% di risposte a caso il movimento atteso deve
    // essere negativo. Giusta -10, sbagliata +15: pareggio al 60% di esatte.
    const movement = isCorrect ? -10 : 15;
    currentTeams.set(teamKey, {
      ...team,
      distance: Math.max(0, Math.min(100, team.distance + movement)),
      score: team.score + roundScore,
    });

    this.teams.set(currentTeams);
    this.checkEliminations();
  }

  private checkEliminations(): void {
    if (this.gameEnded()) return;

    const currentRadius = this.circleRadius();
    const currentTeams = new Map(this.teams());
    const eliminated = [...this.eliminatedPlayers()];
    const tolerance = 2;
    let newlyEliminated = false;
    let stillInGame = 0;

    currentTeams.forEach((team, key) => {
      if (team.eliminated) return;

      if (team.distance > currentRadius + tolerance) {
        currentTeams.set(key, { ...team, eliminated: true });
        eliminated.push(team.playerName);
        newlyEliminated = true;
      } else {
        stillInGame++;
      }
    });

    if (!newlyEliminated) return;

    this.teams.set(currentTeams);
    this.eliminatedPlayers.set(eliminated);

    if (stillInGame <= 1) this.endGame();
  }

  private endGame(): void {
    if (this.gameEnded()) return;

    this.gameEnded.set(true);

    const eliminatedOrder = this.eliminatedPlayers();
    const teams = Array.from(this.teams().values()).sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (!a.eliminated) return a.distance - b.distance;
      return eliminatedOrder.indexOf(b.playerName) - eliminatedOrder.indexOf(a.playerName);
    });

    // Il podio premia chi è arrivato più vicino al centro; la metà bassa perde punti.
    const halfMark = Math.ceil(teams.length / 2);
    const ranked = teams.map((team, index) => {
      let score = 0;
      if (index === 0) score = 1000;
      else if (index < halfMark) score = 500;
      else score = -300;

      return { ...team, position: index + 1, score };
    });

    this.winners.set(ranked.slice(0, 3).map((team) => team.playerName));
    this.teams.set(new Map(ranked.map((team) => [team.playerName, team])));

    if (this.isActive()) this.stop();
  }

  getDisplayData(): ArenaDisplayData {
    return {
      teams: Array.from(this.teams().values()),
      circleRadius: this.circleRadius(),
      eliminatedPlayers: this.eliminatedPlayers(),
      gameEnded: this.gameEnded(),
      winners: this.winners(),
    };
  }
}
