import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';
import { GameModeBase } from '../interfaces/game-mode-base.class';

export class QuizMode extends GameModeBase {
  readonly type: GameModeType = 'QUIZ';
  readonly timerDuration = 10;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  
  override async onStart(): Promise<void> {
    await this.runPreGameSequence(10000); 
  }

  override getDisplayData(): any {
    return {
      ...this.payload,
      buzzedPlayer: this.buzzedPlayer(),
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }

  
  protected onInitialize(): void {
    
  }

  protected onPause(): void {
  }

  protected onResume(): void {
  }

  protected onStop(): void {
  }

  protected onCleanup(): void {
  }

  protected onTimeout(): void {
    
  }

  protected onBuzz(playerName: string): void {
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
  }

  protected onConfirmCorrect(result: GameModeResult): void {
  }

  protected onConfirmWrong(result: GameModeResult): void {
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    const playerChoice = this.payload.options[answer as number];
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
}
