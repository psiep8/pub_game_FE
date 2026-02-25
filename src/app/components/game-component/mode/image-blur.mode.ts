

import {signal} from '@angular/core';
import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class ImageBlurMode extends GameModeBase {
  readonly type: GameModeType = 'IMAGE_BLUR';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentBlur = signal<number>(40);
  private blurInterval?: any;

  protected onInitialize(): void {
    this.currentBlur.set(40);
  }

  protected async onStart(): Promise<void> {
    
    await this.runPreGameSequence(10000);
    this.startBlurEffect();
  }

  protected onPause(): void {
    this.stopBlurEffect();
  }

  protected onResume(): void {
    this.startBlurEffect();
  }

  protected onStop(): void {
    this.stopBlurEffect();
    this.currentBlur.set(0); 
  }

  protected onCleanup(): void {
    this.stopBlurEffect();
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
    return {isCorrect: false};
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

  

  private startBlurEffect(): void {
    if (this.blurInterval) clearInterval(this.blurInterval);

    const blurStep = 40 / this.timerDuration; 

    this.blurInterval = setInterval(() => {
      if (this.buzzedPlayer()) return;

      const current = this.currentBlur();
      if (current > 0) {
        this.currentBlur.set(Math.max(0, current - blurStep));
      } else {
        this.stopBlurEffect();
      }
    }, 1000);
  }

  private stopBlurEffect(): void {
    if (this.blurInterval) {
      clearInterval(this.blurInterval);
      this.blurInterval = undefined;
    }
  }

  getDisplayData() {
    return {
      imageUrl: this.payload.imageUrl,
      blurAmount: this.currentBlur(),
      buzzedPlayer: this.buzzedPlayer(),
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }
}
