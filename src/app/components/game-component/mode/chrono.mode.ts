// src/app/core/game-modes/chrono/chrono.mode.ts

import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export class ChronoMode extends GameModeBase {
  readonly type: GameModeType = 'CHRONO';
  readonly timerDuration = 30;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  protected onInitialize(): void {
    console.log('📅 CHRONO Mode inizializzato');
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(10000);
  }

  protected onPause(): void { }
  protected onResume(): void { }
  protected onStop(): void { }
  protected onCleanup(): void { }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto');
  }

  protected onBuzz(playerName: string): void { }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    console.log(`📅 ${playerName}: ${answer}`);
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ ${result.playerName}: ${result.correctAnswer}`);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ ${result.playerName} sbagliato`);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    const correctYear = parseInt(this.payload.correctAnswer);
    const userYear = parseInt(answer);
    const diff = Math.abs(correctYear - userYear);

    if (diff === 0) {
      return {
        isCorrect: true,
        correctAnswer: this.payload.correctAnswer,
        difference: 0,
        timeMs
      };
    }

    if (diff <= 3) {
      return {
        isCorrect: false,
        isClose: true,
        correctAnswer: this.payload.correctAnswer,
        difference: diff,
        timeMs
      };
    }

    return {
      isCorrect: false,
      correctAnswer: this.payload.correctAnswer,
      difference: diff,
      timeMs
    };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTimeMs = this.timerDuration * 1000;
    const ratio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    return isCorrect ? Math.round(1000 * ratio) : Math.round(-500 * ratio);
  }

  /**
   * 🔥 Range ASIMMETRICO cache
   */
  private cachedRange: { min: number; max: number; step: number } | null = null;

  private calculateAsymmetricRange(): { min: number; max: number; step: number } {
    if (this.cachedRange) {
      return this.cachedRange;
    }

    const correctYear = parseInt(this.payload.correctAnswer);
    const random = Math.random();

    // < 1500: Range 1000 anni
    if (correctYear < 1500) {
      const totalRange = 1000;
      const minOffset = Math.floor(totalRange * random * 0.7);

      this.cachedRange = {
        min: Math.max(0, correctYear - minOffset),
        max: correctYear + (totalRange - minOffset),
        step: 10
      };
      return this.cachedRange;
    }

    // 1500-1800: Range 400 anni
    if (correctYear < 1800) {
      const totalRange = 400;
      const minOffset = Math.floor(totalRange * random * 0.65);

      this.cachedRange = {
        min: correctYear - minOffset,
        max: correctYear + (totalRange - minOffset),
        step: 5
      };
      return this.cachedRange;
    }

    // 1800-1950: Range 200 anni
    if (correctYear < 1950) {
      const totalRange = 200;
      const minOffset = Math.floor(totalRange * random * 0.6);

      this.cachedRange = {
        min: correctYear - minOffset,
        max: correctYear + (totalRange - minOffset),
        step: 1
      };
      return this.cachedRange;
    }

    // 1950-2000: Range 100 anni
    if (correctYear < 2000) {
      const totalRange = 100;
      const minOffset = Math.floor(totalRange * random * 0.55);

      this.cachedRange = {
        min: correctYear - minOffset,
        max: correctYear + (totalRange - minOffset),
        step: 1
      };
      return this.cachedRange;
    }

    // 2000+: Range 60 anni
    const totalRange = 60;
    const minOffset = Math.floor(totalRange * random * 0.5);

    this.cachedRange = {
      min: correctYear - minOffset,
      max: Math.min(new Date().getFullYear() + 5, correctYear + (totalRange - minOffset)),
      step: 1
    };
    return this.cachedRange;
  }

  getDisplayData() {
    const range = this.calculateAsymmetricRange();

    return {
      question: this.payload.question || '',
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null,
      isReading: this.isReading(),
      minYear: range.min,
      maxYear: range.max,
      step: range.step
    };
  }
}
