

import {signal} from '@angular/core';
import {GameModeBase} from '../../../shared/models/game-mode-base.class';
import {GameModeResult, GameModeType} from '../../../shared/models/game-mode-type';

export class ImageBlurMode extends GameModeBase {
  readonly type: GameModeType = 'IMAGE_BLUR';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentBlur = signal<number>(40);
  private blurInterval?: any;

  /** Indizi biografici: uno ogni dieci secondi, senza svelare il nome. */
  private clues: string[] = [];
  private clueIndex = signal(0);
  private clueInterval?: any;

  protected onInitialize(): void {
    this.currentBlur.set(40);
    this.clues = Array.isArray(this.payload?.clues)
      ? this.payload.clues.map((clue: any) => String(clue)).filter((clue: string) => clue.length > 0)
      : [];
    this.clueIndex.set(0);
  }

  protected async onStart(): Promise<void> {
    
    await this.runPreGameSequence(10000);
    this.startBlurEffect();
    this.startClueEffect();
  }

  protected onPause(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
  }

  protected onResume(): void {
    this.startBlurEffect();
    this.startClueEffect();
  }

  protected onStop(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
    this.currentBlur.set(0); 
  }

  protected onCleanup(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
  }

  protected onTimeout(): void {
    
  }

  protected onBuzz(playerName: string): void {
    // Chi si prenota ha già la foto: gli indizi si fermano sul punto raggiunto.
    this.stopClueEffect();
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

  private startClueEffect(): void {
    this.stopClueEffect();
    if (this.clues.length <= 1) return;

    this.clueInterval = setInterval(() => {
      if (this.buzzedPlayer()) {
        this.stopClueEffect();
        return;
      }

      const next = Math.min(this.clues.length - 1, this.clueIndex() + 1);
      if (next === this.clueIndex()) {
        this.stopClueEffect();
        return;
      }
      this.clueIndex.set(next);
    }, 10000);
  }

  private stopClueEffect(): void {
    if (this.clueInterval) {
      clearInterval(this.clueInterval);
      this.clueInterval = undefined;
    }
  }

  getDisplayData() {
    return {
      imageUrl: this.payload.imageUrl,
      blurAmount: this.currentBlur(),
      buzzedPlayer: this.buzzedPlayer(),
      clue: this.clues[this.clueIndex()] ?? null,
      clueIndex: this.clueIndex() + 1,
      clueTotal: this.clues.length,
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }
}
