// src/app/core/game-modes/wheel-fortune/wheel-fortune.mode.ts

import { signal } from '@angular/core'
import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class WheelOfFortuneMode extends GameModeBase { readonly type: GameModeType = 'WHEEL_OF_FORTUNE';
  readonly timerDuration = 120;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private revealedLetters = signal<Set<string>>(new Set());
  private letterRevealInterval?: any;

  protected onInitialize(): void {
    this.revealedLetters.set(new Set());
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(10000);
    this.startLetterReveal();
  }

  protected onPause(): void {
    this.stopLetterReveal();
  }

  protected onResume(): void {
    this.startLetterReveal();
  }

  protected onStop(): void {
    this.stopLetterReveal();
    // Rivela tutte le lettere
    const phrase = this.payload.correctAnswer;
    const allLetters = new Set<string>(
      phrase.split('').filter((c: string) => c !== ' ')
    );
    this.revealedLetters.set(allLetters);
  }

  protected onCleanup(): void {
    this.stopLetterReveal();
  }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto! Rivelo tutte le lettere.');
    // Rivela tutto automaticamente
    const phrase = this.payload.correctAnswer;
    const allLetters = new Set<string>(
      phrase.split('').filter((c: string) => c !== ' ')
    );
    this.revealedLetters.set(allLetters);
  }

  protected onBuzz(playerName: string): void {
    console.log(`🎡 ${playerName} si è prenotato!`);
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    // Non usato in WHEEL (risposta vocale)
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ ${result.playerName} ha vinto ${result.points} punti!`);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ ${result.playerName} ha sbagliato! Perde ${result.points} punti.`);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    // Non applicabile - risposta vocale
    return { isCorrect: false };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (isCorrect) {
      // Più rispondi velocemente, più punti
      const timeBonus = Math.max(0, 1 - (elapsedMs / (this.timerDuration * 1000)));
      return Math.round(1000 + (500 * timeBonus));
    } else {
      return -500;
    }
  }

  // ========== WHEEL-SPECIFIC LOGIC ==========

  private startLetterReveal(): void {
    if (this.letterRevealInterval) clearInterval(this.letterRevealInterval);

    // Rivela una lettera ogni 10 secondi
    this.letterRevealInterval = setInterval(() => {
      if (this.buzzedPlayer()) return; // Pausa se qualcuno prenotato

      const unrevealed = this.getUnrevealedLetters();
      if (unrevealed.length > 0) {
        const randomLetter = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        this.revealedLetters.update(set => {
          const newSet = new Set(set);
          newSet.add(randomLetter);
          return newSet;
        });
      }
    }, 10000);
  }

  private stopLetterReveal(): void {
    if (this.letterRevealInterval) {
      clearInterval(this.letterRevealInterval);
      this.letterRevealInterval = undefined;
    }
  }

  private getUnrevealedLetters(): string[] {
    const phrase = this.payload.correctAnswer;
    const revealed = this.revealedLetters();
    const letters = phrase.split('').filter((char: string) => char !== ' ');
    return letters.filter((letter: string) => !revealed.has(letter));
  }

  // ========== DISPLAY DATA ==========

  getDisplayData() {
    const phrase = this.payload.correctAnswer;
    const revealed = this.revealedLetters();

    return {
      hint: this.payload.hint,
      displayPhrase: phrase.split('').map((char: string) => {
        if (char === ' ') return ' ';
        return revealed.has(char) ? char : '_';
      }),
      revealedCount: revealed.size,
      totalLetters: new Set(phrase.split('').filter((c: string) => c !== ' ')).size,
      buzzedPlayer: this.buzzedPlayer()
    };
  }
}
