import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export interface TeamProgress {
  playerName: string;
  progress: number;
  position?: number;
  finished: boolean;
}

export interface ScreamRaceDisplayData {
  teams: TeamProgress[];
  winners: string[];
  raceEnded: boolean;
}

const NOISE_GATE = 5;
const GOAL = 100;

export class ScreamRaceMode extends GameModeBase {
  readonly type: GameModeType = 'SCREAM_RACE';
  /** Praticamente infinito: la gara finisce quando qualcuno taglia il traguardo. */
  readonly timerDuration = 3600;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private teams = signal<Map<string, TeamProgress>>(new Map());
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

  protected onStop(): void {}

  protected onCleanup(): void {
    this.teams.set(new Map());
    this.winners.set([]);
  }

  protected onTimeout(): void {}

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(_answer: any, _timeMs: number): any {
    return { isCorrect: false };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    // I punti dipendono dalla posizione d'arrivo, calcolata dal backend.
    return 0;
  }

  private initializeTeams(): void {
    const activePlayers = this.config.activePlayers ?? [];
    const initialTeams = new Map<string, TeamProgress>();

    activePlayers.forEach((playerName) => {
      initialTeams.set(playerName, { playerName, progress: 0, finished: false });
    });

    this.teams.set(initialTeams);
  }

  /** Avanza il giocatore in base all'intensità dell'urlo (0-100). */
  applyScreamIntensity(playerName: string, intensity: number): void {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();

    const teamKey =
      Array.from(currentTeams.keys()).find(
        (name) =>
          name.toLowerCase() === key ||
          name.toLowerCase().includes(key) ||
          key.includes(name.toLowerCase()),
      ) ?? playerName;

    const existing = currentTeams.get(teamKey) ?? {
      playerName,
      progress: 0,
      finished: false,
    };
    const team: TeamProgress = { ...existing };

    if (!team.finished) {
      const value = Number(intensity) || 0;

      if (value > NOISE_GATE) {
        // Curva non lineare: gli urli forti spingono molto più dei medi.
        const normalized = value - NOISE_GATE;
        const delta = Math.pow(normalized / 50, 1.5) * 0.5;

        team.progress = Math.min(GOAL, team.progress + delta);

        if (team.progress >= GOAL) {
          team.progress = GOAL;
          currentTeams.set(teamKey, team);
          this.teams.set(currentTeams);
          this.markTeamFinished(playerName, this.winners().length + 1);
          return;
        }
      }
    }

    currentTeams.set(teamKey, team);
    this.teams.set(currentTeams);
  }

  markTeamFinished(playerName: string, position: number): void {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();
    const teamKey =
      Array.from(currentTeams.keys()).find((name) => name.toLowerCase() === key) ?? playerName;
    const team = currentTeams.get(teamKey);

    if (team) {
      currentTeams.set(teamKey, { ...team, finished: true, position, progress: GOAL });
      this.teams.set(currentTeams);
    }

    if (!this.winners().includes(playerName)) {
      this.winners.set([...this.winners(), playerName]);
    }
  }

  getDisplayData(): ScreamRaceDisplayData {
    const teams = Array.from(this.teams().values()).sort((a, b) => b.progress - a.progress);
    const activePlayersCount = this.config.activePlayers?.length ?? 0;

    return {
      teams,
      winners: this.winners(),
      raceEnded: activePlayersCount > 0 && this.winners().length >= activePlayersCount,
    };
  }
}
