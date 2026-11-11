import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

interface Lane {
  playerName: string;
  progress: number;
  finished: boolean;
  position: number | null;
  streak: number;
  multiplier: number;
  /** Millisecondi dal via, valorizzati solo all'arrivo. */
  finishedAt: number | null;
}

/**
 * Speed Rush: corsie sulla TV, microprove sul telefono.
 *
 * La TV non calcola più avanzamento, arrivi o punti: riceve gli eventi
 * `SPEED_RUSH_PROGRESS` e `SPEED_RUSH_RESULT` dal server e li applica. In questo
 * modo un telefono non può dichiarare da sé una risposta corretta o un arrivo.
 */
export class SpeedRushMode extends GameModeBase {
  readonly type: GameModeType = 'SPEED_RUSH';
  readonly timerDuration = 60;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private lanes = signal<Lane[]>([]);
  private pointsApplied = false;
  private finishing = false;

  protected onInitialize(): void {
    this.lanes.set(this.emptyLanes());
    this.pointsApplied = false;
    this.finishing = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.lanes.set(this.emptyLanes());
    try {
      await this.config.startSpeedRush?.(this.config.activePlayers ?? []);
    } catch (error) {
      console.warn('Speed Rush: sessione server non aperta', error);
    }
    await this.runPreGameSequence(3000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}

  protected onCleanup(): void {
    this.lanes.set([]);
  }

  protected onTimeout(): void {
    void this.finishRace();
  }

  handlePartyEvent(event: any): void {
    if (event?.action === 'SPEED_RUSH_RESULT') {
      this.applyServerResults(Array.isArray(event.results) ? event.results : []);
      return;
    }
    if (event?.action !== 'SPEED_RUSH_PROGRESS' || !event.playerName) return;

    const key = String(event.playerName).trim().toLowerCase();
    this.lanes.update((lanes) => lanes.map((lane) => {
      if (lane.playerName.trim().toLowerCase() !== key) return lane;
      return {
        ...lane,
        progress: Math.max(0, Math.min(100, Number(event.progress) || 0)),
        streak: Math.max(0, Number(event.streak) || 0),
        multiplier: Math.max(1, Number(event.multiplier) || 1),
        finished: !!event.finished,
        position: event.position == null ? null : Number(event.position),
        finishedAt: event.finishedAt == null ? null : Number(event.finishedAt),
      };
    }));
  }

  /**
   * Chiede al server la graduatoria finale. Il server è l'unica fonte dei
   * punti: se la chiamata fallisce si ritenta, senza ripiegare su un calcolo
   * locale che sarebbe di nuovo falsificabile.
   */
  private async finishRace(): Promise<void> {
    if (this.pointsApplied || this.finishing) return;
    this.finishing = true;

    try {
      const results = await this.config.finishSpeedRush?.();
      if (!results) {
        this.finishing = false;
        setTimeout(() => void this.finishRace(), 1000);
        return;
      }
      this.applyServerResults(results);
    } catch {
      this.finishing = false;
      setTimeout(() => void this.finishRace(), 1000);
    }
  }

  private applyServerResults(results: any[]): void {
    if (this.pointsApplied) return;
    this.pointsApplied = true;

    for (const result of results) {
      const playerName = String(result?.playerName ?? '').trim();
      if (!playerName) continue;
      const points = Math.max(0, Number(result.points) || 0);
      this.config.onAnswerReceived?.({
        playerName,
        points,
        isCorrect: points > 0,
      });
    }
  }

  private emptyLanes(): Lane[] {
    return (this.config.activePlayers ?? []).map((playerName) => ({
      playerName,
      progress: 0,
      finished: false,
      position: null,
      streak: 0,
      multiplier: 1,
      finishedAt: null,
    }));
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: !!answer, points: 0 };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: this.payload?.question ?? 'Speed Rush!',
      lanes: [...this.lanes()].sort((a, b) => b.progress - a.progress),
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
  }
}
