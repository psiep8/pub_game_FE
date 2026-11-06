import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

/** Il Cavallo è un round lungo: voto categoria + otto domande flash. */
const ROUND_SECONDS = 240;

/**
 * CAVALLO DI BATTAGLIA — round vero e proprio.
 *
 * Il flusso (voto della categoria, otto domande flash, reveal e finale) vive
 * nel componente TV `games/cavallo`, che parla ai telefoni con
 * `CAVALLO_STATE` / `CAVALLO_ACTION`. Qui c'è solo il contratto del round e la
 * rete di sicurezza: se la TV non chiude il finale, il timer completa il round
 * e la serata va avanti.
 */
export class CavalloMode extends GameModeBase {
  readonly type: GameModeType = 'CAVALLO';
  readonly timerDuration = ROUND_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private finished = signal(false);

  protected onInitialize(): void {
    this.finished.set(false);
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    // Niente pre-start: il componente disegna la propria introduzione e poi
    // apre il voto della categoria. Qui parte solo il cronometro di sicurezza.
    this.timer.set(this.timerDuration);
    this.startTimer();
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {}

  protected onCleanup(): void {}

  protected onTimeout(): void {
    this.finished.set(true);
  }

  /** La TV ha chiuso il finale: il round non deve aspettare il timer. */
  markFinished(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.stop();
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: this.payload?.question ?? 'Cavallo di Battaglia!',
      finished: this.finished(),
      isReading: this.isReading(),
      correctAnswer: null,
    };
  }
}
