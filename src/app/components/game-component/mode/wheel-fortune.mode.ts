// src/app/core/game-modes/wheel-fortune/wheel-fortune.mode.ts

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

  // Sceglie la prossima lettera tra quelle non rivelate dando priorità
  // a quelle meno frequenti nella frase (per allungare la partita)
  private pickNextLetterByRarity(): string | null {
    const phraseRaw = this.payload.proverb || '';
    const phrase = phraseRaw.toUpperCase();
    const revealed = this.revealedLetters();

    // Conta le occorrenze di ogni lettera nella frase (escludi spazi)
    const counts: Record<string, number> = {};
    for (const ch of phrase.split('')) {
      if (ch === ' ') continue;
      counts[ch] = (counts[ch] || 0) + 1;
    }

    // costruiamo l'insieme delle lettere non ancora rivelate (uniche)
    const unrevealedSet = new Set<string>();
    for (const ch of phrase.split('')) {
      if (ch === ' ') continue;
      // confrontiamo in uppercase: lo revealed set contiene lettere uppercase
      if (!revealed.has(ch)) unrevealedSet.add(ch);
    }

    const unrevealed = Array.from(unrevealedSet);
    if (unrevealed.length === 0) return null;

    // Trova il minimo count tra le lettere non rivelate
    let minCount = Infinity;
    for (const l of unrevealed) {
      const c = counts[l] ?? 0;
      if (c < minCount) minCount = c;
    }

    // Filtra le lettere con count == minCount
    const candidates = unrevealed.filter(l => (counts[l] ?? 0) === minCount);

    // Scegli una a caso tra i candidati (per variare leggermente)
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
    // Rivela tutte le lettere
    const phrase = this.payload.proverb;
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
    const phrase = this.payload.proverb;
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
    const maxTimeMs = this.timerDuration * 1000;

    // Calcoliamo il fattore di decadimento (da 1.0 a 0)
    // Se elapsedMs è 0, ratio è 1. Se elapsedMs è maxTimeMs, ratio è 0.
    const decayRatio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    if (isCorrect) {
      // Da +1000 (istante 0) a 0 (fine tempo)
      return Math.round(1000 * decayRatio);
    } else {
      // Da -1000 (istante 0) a 0 (fine tempo)
      return Math.round(-1000 * decayRatio);
    }
  }

  // ========== WHEEL-SPECIFIC LOGIC ==========

  private startLetterReveal(): void {
    // Pulizia preventiva
    if (this.letterRevealInterval) clearInterval(this.letterRevealInterval);
    if (this.letterRevealInitialTimeout) clearTimeout(this.letterRevealInitialTimeout);

    // Prima rivelazione rapida dopo ~1s (se possibile)
    this.letterRevealInitialTimeout = setTimeout(() => {
      if (this.buzzedPlayer()) return; // non rivelare se qualcuno è prenotato
      const next = this.pickNextLetterByRarity();
      if (next) {
        this.revealedLetters.update(set => {
          const newSet = new Set(set);
          newSet.add(next.toUpperCase());
          return newSet;
        });
      }
      // dopo la rivelazione iniziale iniziamo l'intervallo regolare
      if (this.letterRevealInterval) clearInterval(this.letterRevealInterval);
      this.letterRevealInterval = setInterval(() => {
        if (this.buzzedPlayer()) return; // Pausa se qualcuno prenotato

        const nextLetter = this.pickNextLetterByRarity();
        if (nextLetter) {
          this.revealedLetters.update(set => {
            const newSet = new Set(set);
            newSet.add(nextLetter.toUpperCase());
            return newSet;
          });
        } else {
          // No more letters -> stop interval
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

  // ========== DISPLAY DATA ==========

  getDisplayData() {
    const phrase = this.payload.proverb || '';
    const revealed = this.revealedLetters();

    return {
      hint: this.payload.hint,
      // Split by words and map each word to an array of characters (revealed or underscore)
      // Use the original casing for display but check revealed set in uppercase
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
