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
/** Un round, un timer. */
export const SPEED_RUSH_ROUND_SECONDS = 90;

export class SpeedRushMode extends GameModeBase {
  readonly type: GameModeType = 'SPEED_RUSH';
  readonly timerDuration = SPEED_RUSH_ROUND_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private lanes = signal<Lane[]>([]);
  private results = signal<any[]>([]);
  private pointsApplied = false;
  private finishing = false;
  private clockStarted = false;

  protected onInitialize(): void {
    this.lanes.set(this.emptyLanes());
    this.results.set([]);
    this.pointsApplied = false;
    this.finishing = false;
    this.clockStarted = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.lanes.set(this.emptyLanes());
    try {
      await this.config.startSpeedRush?.(this.config.activePlayers ?? []);
    } catch (error) {
      console.warn('Speed Rush: sessione server non aperta', error);
    }
    // F-32: la corsa è aperta, ma il cronometro parte alla prima risposta.
    this.isReading.set(false);
    this.isActive.set(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
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
    if (event?.action === 'SPEED_RUSH_PROGRESS') this.applyProgress(event);
  }

  private applyProgress(event: any): void {
    if (!event?.playerName) return;
    if (!this.clockStarted) {
      this.clockStarted = true;
      this.timer.set(this.timerDuration);
      this.startTimer();
    }
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
    this.results.set(results);
    // F-31: il riepilogo sostituisce la pista appena il server chiude la corsa.
    this.revealed.set(true);
    this.stopTimer();

    for (const result of results) {
      const playerName = String(result?.playerName ?? '').trim();
      if (!playerName) continue;
      // I punti negativi dell'ultimo posto sono punti veri: non si azzerano.
      const points = Number(result.points) || 0;
      this.config.onAnswerReceived?.({
        playerName,
        points,
        isCorrect: points > 0,
      });
    }
  }

  /**
   * Riprende la corsa senza checkpoint: il server tiene la sessione, quindi le
   * corsie si rileggono da lì (`start` è idempotente sullo stesso round) e il
   * cronometro riparte dal tempo che resta al round.
   */
  restore(secondsLeft: number, _snapshot?: unknown): void {
    this.pointsApplied = false;
    this.finishing = false;
    this.clockStarted = true;
    this.results.set([]);
    this.revealed.set(false);
    this.lanes.set(this.emptyLanes());

    const seconds = Number.isFinite(Number(secondsLeft))
      ? Math.max(0, Math.min(this.timerDuration, Math.round(Number(secondsLeft))))
      : this.timerDuration;
    this.timer.set(seconds);
    this.config.onTimerTick?.(seconds);
    this.revealed.set(false);
    this.isActive.set(true);
    this.isPaused.set(false);
    // Se il tempo è già finito il primo tick chiude la corsa chiedendo al server.
    this.startTimer();
    void this.refreshLanes();
  }

  /** Corsie autoritative dal server: dopo un refresh la TV non le ha più in memoria. */
  private async refreshLanes(): Promise<void> {
    try {
      const summary = await this.config.startSpeedRush?.(this.config.activePlayers ?? []);
      const players: any[] = Array.isArray(summary?.players) ? summary.players : [];
      if (!players.length) return;
      const lanes = players
        .filter((row: any) => row && typeof row.playerName === 'string' && row.playerName.trim())
        .map((row: any): Lane => ({
          playerName: String(row.playerName),
          progress: Math.max(0, Math.min(100, Number(row.progress) || 0)),
          finished: !!row.finished,
          position: row.position == null ? null : Number(row.position),
          streak: Math.max(0, Number(row.streak) || 0),
          multiplier: Math.max(1, Number(row.multiplier) || 1),
          finishedAt: row.finishedAt == null ? null : Number(row.finishedAt),
        }));
      this.lanes.set(this.mergeActivePlayers(lanes));
    } catch {
      // Senza server restano le corsie vuote: il primo evento le riempie.
    }
  }

  /** Chi si è unito durante il refresh deve comunque avere la sua corsia. */
  private mergeActivePlayers(lanes: Lane[]): Lane[] {
    const known = new Set(lanes.map((lane) => lane.playerName.trim().toLowerCase()));
    const missing = (this.config.activePlayers ?? [])
      .filter((name) => name && !known.has(name.trim().toLowerCase()))
      .map((playerName) => ({
        playerName,
        progress: 0,
        finished: false,
        position: null,
        streak: 0,
        multiplier: 1,
        finishedAt: null,
      }));
    return [...lanes, ...missing];
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
      results: this.results(),
      correctAnswer: null,
    };
  }
}
