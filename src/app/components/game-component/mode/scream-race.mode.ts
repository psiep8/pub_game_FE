// src/app/core/game-modes/scream-race/scream-race.mode.ts

import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

interface TeamProgress {
  playerName: string;
  progress: number;
  position?: number;
  finished: boolean;
}

export class ScreamRaceMode extends GameModeBase {
  readonly type: GameModeType = 'SCREAM_RACE';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private teams = signal<Map<string, TeamProgress>>(new Map());
  private finishOrder = signal<string[]>([]);

  protected onInitialize(): void {
    console.log('🎤 SCREAM RACE inizializzato');
  }

  private initializeTeams() {
    const activePlayers = (this.config as any).activePlayers || [];
    const initialTeams = new Map<string, TeamProgress>();

    activePlayers.forEach((playerName: string) => {
      initialTeams.set(playerName, {
        playerName,
        progress: 0,
        finished: false
      });
    });

    this.teams.set(initialTeams);
    console.log(`🎤 Team inizializzati: ${activePlayers.length} giocatori`);
  }

  protected async onStart(): Promise<void> {
    this.initializeTeams();
    await this.runPreGameSequence(5000); // 5s countdown
  }

  protected onPause(): void {
    // Non serve pause per scream race
  }

  protected onResume(): void {
    // Non serve resume
  }

  protected onStop(): void {
    console.log('🏁 Gara terminata');
  }

  protected onCleanup(): void {
    this.teams.set(new Map());
    this.finishOrder.set([]);
  }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto! Fine gara.');
  }

  protected onBuzz(playerName: string): void {
    // Non usato
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    // Non usato
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    // Non usato
  }

  protected onConfirmWrong(result: GameModeResult): void {
    // Non usato
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return { isCorrect: false };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    return 0; // Punti calcolati dal backend in base alla posizione
  }

  /**
   * 🎤 Aggiorna progresso squadra (con accumulo migliorato)
   */
  updateTeamProgress(playerName: string, value: number) {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();

    // Cerchiamo il team con una logica più permissiva
    let teamKey = Array.from(currentTeams.keys()).find(k =>
      k.toLowerCase() === key ||
      k.toLowerCase().includes(key) ||
      key.includes(k.toLowerCase())
    ) || playerName;

    let team = currentTeams.get(teamKey);

    if (!team) {
      team = {
        playerName,
        progress: 0,
        finished: false
      };
      teamKey = playerName;
      currentTeams.set(teamKey, team);
    } else {
      team = { ...team };
    }

    if (!team.finished) {
      // 🚀 LOGICA DI MOVIMENTO (Corretta e Potenziata)
      // Assicuriamoci che 'value' sia un numero per evitare errori toFixed
      const intensity = Number(value) || 0;

      const speedFactor = 0.05; // Gara veloce!
      const noiseGate = 5;

      if (intensity > noiseGate) {
        // Accumuliamo il progresso
        const delta = (intensity / 100) * speedFactor * 100;
        team.progress = Math.min(99.9, Number(team.progress || 0) + delta);

        console.log(`%c 🏃 MOVE: ${playerName} -> ${team.progress.toFixed(1)}% `, 'color: #ff00ff; font-weight: bold;');
      }
    }

    currentTeams.set(teamKey, team);
    this.teams.set(currentTeams);
  }

  /**
   * 🏆 Segna squadra come finita (forza 100%)
   */
  markTeamFinished(playerName: string, position: number) {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();
    let teamKey = Array.from(currentTeams.keys()).find(k => k.toLowerCase() === key) || playerName;
    let team = currentTeams.get(teamKey);

    if (team) {
      team = { ...team, finished: true, position: position, progress: 100 };
      currentTeams.set(teamKey, team);
      this.teams.set(currentTeams);
    }

    const order = [...this.finishOrder()];
    if (!order.includes(playerName)) {
      order.push(playerName);
      this.finishOrder.set(order);
    }

    console.log(`🏆 ${playerName} finito in posizione ${position}`);
  }

  getDisplayData() {
    const teamsArray = Array.from(this.teams().values())
      .sort((a, b) => b.progress - a.progress); // Ordina per progresso

    const activePlayersCount = (this.config as any).activePlayers?.length || 0;
    const raceEnded = this.finishOrder().length >= activePlayersCount && activePlayersCount > 0;

    return {
      teams: teamsArray,
      finishOrder: this.finishOrder(),
      raceEnded: raceEnded
    };
  }
}
