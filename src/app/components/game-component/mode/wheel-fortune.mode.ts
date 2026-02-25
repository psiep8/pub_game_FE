

import { signal } from '@angular/core'
import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class WheelOfFortuneMode extends GameModeBase {
  readonly type: GameModeType = 'WHEEL_OF_FORTUNE';
  readonly timerDuration = 120;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private revealedLetters = signal<Set<string>>(new Set());
  private letterRevealInterval?: any;
  private letterRevealInitialTimeout?: any;

  private pickNextLetterByRarity(): string | null {
    const phraseRaw = this.payload.proverb || '';
    const phrase = phraseRaw.toUpperCase();
    const revealed = this.revealedLetters();

    const counts: Record<string, number> = {};
    for (const ch of phrase.split('')) {
      if (ch === ' ') continue;
      counts[ch] = (counts[ch] || 0) + 1;
    }

    const unrevealedSet = new Set<string>();
    for (const ch of phrase.split('')) {
      if (ch === ' ') continue;
      if (!revealed.has(ch)) unrevealedSet.add(ch);
    }

    const unrevealed = Array.from(unrevealedSet);
    if (unrevealed.length === 0) return null;

    let minCount = Infinity;
    for (const l of unrevealed) {
      const c = counts[l] ?? 0;
      if (c < minCount) minCount = c;
    }

    const candidates = unrevealed.filter(l => (counts[l] ?? 0) === minCount);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

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
    this.revealAllLetters();
  }

  protected onCleanup(): void {
    this.stopLetterReveal();
  }

  protected onTimeout(): void {
    
    this.revealAllLetters();
  }

  protected onBuzz(playerName: string): void {
    
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    
    
    this.revealAllLetters();
  }

  protected onConfirmWrong(result: GameModeResult): void {
    
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return { isCorrect: false };
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

  /**
   * 🔥 Rivela TUTTE le lettere
   */
  private revealAllLetters(): void {
    const phrase = this.payload.proverb || '';
    const allLetters = new Set<string>(
      phrase.toUpperCase().split('').filter((c: string) => c !== ' ')
    );
    this.revealedLetters.set(allLetters);
    
  }

  private startLetterReveal(): void {
    if (this.letterRevealInterval) clearInterval(this.letterRevealInterval);
    if (this.letterRevealInitialTimeout) clearTimeout(this.letterRevealInitialTimeout);

    this.letterRevealInitialTimeout = setTimeout(() => {
      if (this.buzzedPlayer()) return;
      const next = this.pickNextLetterByRarity();
      if (next) {
        this.revealedLetters.update(set => {
          const newSet = new Set(set);
          newSet.add(next.toUpperCase());
          return newSet;
        });
      }

      if (this.letterRevealInterval) clearInterval(this.letterRevealInterval);
      this.letterRevealInterval = setInterval(() => {
        if (this.buzzedPlayer()) return;

        const nextLetter = this.pickNextLetterByRarity();
        if (nextLetter) {
          this.revealedLetters.update(set => {
            const newSet = new Set(set);
            newSet.add(nextLetter.toUpperCase());
            return newSet;
          });
        } else {
          if (this.letterRevealInterval) {
            clearInterval(this.letterRevealInterval);
            this.letterRevealInterval = undefined;
          }
        }
      }, 10000);
    }, 1000);
  }

  private stopLetterReveal(): void {
    if (this.letterRevealInitialTimeout) {
      clearTimeout(this.letterRevealInitialTimeout);
      this.letterRevealInitialTimeout = undefined;
    }
    if (this.letterRevealInterval) {
      clearInterval(this.letterRevealInterval);
      this.letterRevealInterval = undefined;
    }
  }

  getDisplayData() {
    const phrase = this.payload.proverb || '';
    const revealed = this.revealedLetters();

    return {
      hint: this.payload.hint,
      displayWords: phrase.split(' ').map((word: string) => {
        return word.split('').map((char: string) => {
          const cu = char.toUpperCase();
          return revealed.has(cu) ? char : '_';
        });
      }),
      revealedCount: revealed.size,
      totalLetters: new Set(phrase.toUpperCase().split('').filter((c: string) => c !== ' ')).size,
      buzzedPlayer: this.buzzedPlayer()
    };
  }
}
