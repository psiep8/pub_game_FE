// src/app/core/game-modes/image-blur/image-blur.mode.ts

import { signal } from '@angular/core';
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

  protected onStart(): void {
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
    this.currentBlur.set(0); // Rivela immagine completamente
  }

  protected onCleanup(): void {
    this.stopBlurEffect();
  }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto! Immagine rivelata.');
  }

  protected onBuzz(playerName: string): void {
    console.log(`📸 ${playerName} ha buzzato!`);
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    // Non usato - risposta vocale
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ ${result.playerName}: ${result.correctAnswer} - ${result.points} punti`);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ ${result.playerName} ha sbagliato!`);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return { isCorrect: false };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (isCorrect) {
      const timeBonus = Math.max(0, 1 - (elapsedMs / (this.timerDuration * 1000)));
      return Math.round(1000 * (1 + timeBonus));
    } else {
      return -500;
    }
  }

  // ========== BLUR-SPECIFIC LOGIC ==========

  private startBlurEffect(): void {
    if (this.blurInterval) clearInterval(this.blurInterval);

    const blurStep = 40 / this.timerDuration; // Diminuisce uniformemente

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
