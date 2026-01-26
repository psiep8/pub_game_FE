import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';
import {GameModeBase} from '../interfaces/game-mode-base.class';

export class QuizMode extends GameModeBase {
  readonly type: GameModeType = 'QUIZ';
  readonly timerDuration = 10;
  readonly requiresBubbles = true;
  readonly requiresBuzz = true;

  // ================= FLUSSO =================
  override async onStart(): Promise<void> {
    await this.runPreGameSequence(10000); // isReading + showGo + timer
  }

  override getDisplayData(): any {
    return {
      ...this.payload,
      buzzedPlayer: this.buzzedPlayer(),
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }

  // ================= HOOKS =================
  protected onInitialize(): void {
    console.log('✓ QuizMode inizializzato');
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
    console.log('⏰ Tempo scaduto!');
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
    return {isCorrect, points, playerChoice};
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTime = this.timerDuration * 1000;
    const safeTime = Math.min(elapsedMs, maxTime);
    const ratio = (maxTime - safeTime) / maxTime;
    return isCorrect ? Math.round(1000 * ratio) : Math.round(-500 * ratio);
  }
}
