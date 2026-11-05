import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

interface Lane {
  playerName: string;
  progress: number;
  finished: boolean;
  position: number | null;
  streak: number;
  multiplier: number;
}

const STEP_FORWARD = 9;
const STEP_BACK = 6;

/**
 * Speed Rush: corsie sulla TV, microprove sul telefono.
 *
 * La corsa è una conseguenza della bravura, non solo della velocità: una prova
 * sbagliata fa arretrare, una giusta avanza.
 */
export class SpeedRushMode extends GameModeBase {
  readonly type: GameModeType = 'SPEED_RUSH';
  readonly timerDuration = 60;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private lanes = signal<Lane[]>([]);
  private finishedCount = 0;
  private pointsApplied = false;

  protected onInitialize(): void {
    const players = this.config.activePlayers ?? [];
    this.lanes.set(players.map((playerName) => ({
      playerName,
      progress: 0,
      finished: false,
      position: null,
      streak: 0,
      multiplier: 1,
    })));
    this.finishedCount = 0;
    this.pointsApplied = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.initializeLanes();
    await this.runPreGameSequence(3000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}

  protected onCleanup(): void {
    this.lanes.set([]);
  }

  protected onTimeout(): void {
    this.finishRace();
  }

  private initializeLanes(): void {
    if (this.lanes().length > 0) return;

    const players = this.config.activePlayers ?? [];
    this.lanes.set(players.map((playerName) => ({
      playerName,
      progress: 0,
      finished: false,
      position: null,
      streak: 0,
      multiplier: 1,
    })));
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'SPEED_RUSH_PROGRESS' || !event.playerName) return;

    const key = String(event.playerName).trim().toLowerCase();
    const correct = !!event.correct;

    this.lanes.update((lanes) => lanes.map((lane) => {
      if (lane.playerName.trim().toLowerCase() !== key || lane.finished) return lane;

      if (!correct) {
        return {
          ...lane,
          progress: Math.max(0, lane.progress - STEP_BACK),
          streak: 0,
          multiplier: 1,
        };
      }

      const streak = lane.streak + 1;
      const multiplier = this.multiplierFor(streak);
      const progress = Math.min(100, lane.progress + STEP_FORWARD * multiplier);

      if (progress < 100) return { ...lane, progress, streak, multiplier };

      this.finishedCount += 1;
      return { ...lane, progress: 100, streak, multiplier, finished: true, position: this.finishedCount };
    }));
  }

  /** Catena di risposte giuste: 2 → x2, 5 → x3, 10 → x4. Un errore azzera. */
  private multiplierFor(streak: number): number {
    if (streak >= 10) return 4;
    if (streak >= 5) return 3;
    if (streak >= 2) return 2;
    return 1;
  }

  private finishRace(): void {
    if (this.pointsApplied) return;
    this.pointsApplied = true;

    const ranked = [...this.lanes()].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return (a.position ?? 99) - (b.position ?? 99);
      return b.progress - a.progress;
    });

    ranked.forEach((lane, index) => {
      const points = Math.max(0, 1000 - index * 100);
      this.config.onAnswerReceived?.({
        playerName: lane.playerName,
        points,
        isCorrect: index === 0,
      });
    });
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
