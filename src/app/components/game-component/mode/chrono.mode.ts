import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';
import {GameModeBase} from '../interfaces/game-mode-base.class';

export class ChronoMode extends GameModeBase {
  readonly type: GameModeType = 'CHRONO';
  readonly timerDuration = 15;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  protected onInitialize(): void {
    console.log('📅 CHRONO Mode inizializzato');
  }

  protected async onStart(): Promise<void> {
    // Usa il flusso condiviso di pre-game (reading + VIA + start timer)
    await this.runPreGameSequence(10000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}
  protected onCleanup(): void {}
  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto per CHRONO');
  }
  protected onBuzz(playerName: string): void {}
  protected onAnswer(playerName: string, answer: any, result: any): void {}
  protected onConfirmCorrect(result: GameModeResult): void {}
  protected onConfirmWrong(result: GameModeResult): void {}

  protected validateAnswer(guessedYear: number, timeMs: number): any {
    const realYear = parseInt(this.payload.correctAnswer);
    const distance = Math.abs(guessedYear - realYear);
    const isCorrect = distance <= 2;
    const points = this.calculateChronoPoints(guessedYear, realYear, timeMs);

    return { isCorrect, points, guessedYear, realYear, distance };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    return 0;
  }

  private calculateChronoPoints(guessedYear: number, realYear: number, timeMs: number): number {
    const distance = Math.abs(guessedYear - realYear);
    if (distance > 100) return 0;
    let baseScore = 1000 - (distance * 10);
    const maxTime = this.timerDuration * 1000;
    const speedFactor = 1 - (Math.min(timeMs, maxTime) / maxTime);
    return Math.round(baseScore * Math.max(0.5, speedFactor));
  }

  getDisplayData() {
    return {
      question: this.payload.question,
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null,
      hint: this.payload.hint || "Scegli l'anno sul tuo telefono"
    };
  }
}
