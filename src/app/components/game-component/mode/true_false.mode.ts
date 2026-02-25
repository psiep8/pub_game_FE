import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class TrueFalseMode extends GameModeBase {
  readonly type: GameModeType = 'TRUE_FALSE';
  readonly timerDuration = 8;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  protected onInitialize(): void {
    
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(10000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}
  protected onCleanup(): void {}
  protected onTimeout(): void {
    
  }
  protected onBuzz(playerName: string): void {}
  protected onAnswer(playerName: string, answer: any, result: any): void {}
  protected onConfirmCorrect(result: GameModeResult): void {}
  protected onConfirmWrong(result: GameModeResult): void {}

  protected validateAnswer(answerIndex: number, timeMs: number): any {
    const playerChoice = this.payload.options[answerIndex];
    const isCorrect = playerChoice === this.payload.correctAnswer;
    const points = this.calculatePoints(isCorrect, timeMs);
    return { isCorrect, points, playerChoice };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTimeMs = this.timerDuration * 1000;

    
    
    const decayRatio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    if (isCorrect) {
      
      return Math.round(1000 * decayRatio);
    } else {
      
      return Math.round(-1000 * decayRatio);
    }
  }

  getDisplayData() {
    return {
      question: this.payload.question,
      options: this.payload.options,
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }
}
