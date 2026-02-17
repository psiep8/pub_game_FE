// src/app/core/game-modes/chrono/chrono.mode.ts

import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

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

  protected onPause(): void {
    // Niente da fare
  }

  protected onResume(): void {
    // Niente da fare
  }

  protected onStop(): void {
    // Niente da fare
  }

  protected onCleanup(): void {
    // Niente da fare
  }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto per CHRONO');
  }

  protected onBuzz(playerName: string): void {
    // Non usato
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    console.log(`📅 ${playerName} risponde: ${answer}`);
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

    // ✅ Esatto
    if (diff === 0) {
      return {
        isCorrect: true,
        correctAnswer: this.payload.correctAnswer,
        difference: 0,
        timeMs
      };
    }

    // ⚠️ Vicino (entro 3 anni)
    if (diff <= 3) {
      return {
        isCorrect: false,
        isClose: true,
        correctAnswer: this.payload.correctAnswer,
        difference: diff,
        timeMs
      };
    }

    // ❌ Sbagliato
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

    if (isCorrect) {
      return Math.round(1000 * ratio);
    } else {
      return Math.round(-500 * ratio);
    }
  }

  /**
   * 🔥 Calcola range dinamico basato sull'anno corretto
   */
  private calculateDynamicRange(): { min: number; max: number; step: number } {
    const correctYear = parseInt(this.payload.correctAnswer);

    // Eventi ANTICHI (prima del 1500)
    if (correctYear < 1500) {
      return {
        min: Math.max(0, correctYear - 500),
        max: correctYear + 500,
        step: 10 // Step più ampio
      };
    }

    // Eventi STORICI (1500-1800)
    if (correctYear < 1800) {
      return {
        min: correctYear - 200,
        max: correctYear + 200,
        step: 5
      };
    }

    // Eventi MODERNI (1800-1950)
    if (correctYear < 1950) {
      return {
        min: correctYear - 100,
        max: correctYear + 100,
        step: 1
      };
    }

    // Eventi CONTEMPORANEI (1950-2000)
    if (correctYear < 2000) {
      return {
        min: correctYear - 50,
        max: correctYear + 50,
        step: 1
      };
    }

    // Eventi RECENTI (2000+)
    return {
      min: correctYear - 30,
      max: Math.min(new Date().getFullYear() + 5, correctYear + 30),
      step: 1
    };
  }

  getDisplayData() {
    const range = this.calculateDynamicRange();

    return {
      question: this.payload.question || '',
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null,
      isReading: this.isReading(),
      // 🔥 Range dinamico
      minYear: range.min,
      maxYear: range.max,
      step: range.step
    };
  }
}
