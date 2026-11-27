import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import { buildLetterOrder, isPlayableLetter } from './wheel-letter-deck';
import { GAME_TIMINGS } from '../../../shared/models/game-timings';

const FIRST_REVEAL_MS = 1000;
const REVEAL_EVERY_MS = 8000;

export class WheelOfFortuneMode extends GameModeBase {
  readonly type: GameModeType = 'WHEEL_OF_FORTUNE';
  readonly timerDuration = GAME_TIMINGS.WHEEL_OF_FORTUNE.seconds;
  /** Un round, un timer. */
  readonly roundSeconds = GAME_TIMINGS.WHEEL_OF_FORTUNE.seconds;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private revealedLetters = signal<Set<string>>(new Set());
  private letterOrder: string[] = [];
  private letterIndex = 0;
  private letterRevealInterval?: ReturnType<typeof setInterval>;
  private letterRevealInitialTimeout?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    this.revealedLetters.set(new Set());
    this.letterOrder = [];
    this.letterIndex = 0;
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(3000);
    // Il mazzo si costruisce all'avvio: dipende dalla frase, non dal tempo.
    this.letterOrder = buildLetterOrder(this.payload?.proverb || '');
    this.letterIndex = 0;
    this.saveCheckpoint();
    this.startLetterReveal();
  }

  /**
   * Riprende il round dalla frase nel payload: lettere già uscite e punto del
   * mazzo arrivano dal checkpoint. L'ordine è casuale, quindi va ripristinato
   * quello salvato, non ricostruito.
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const state = checkpoint?.state ?? {};
    const phrase = String(this.payload?.proverb ?? '').toUpperCase();
    const fromPayload = buildLetterOrder(this.payload?.proverb || '');

    const savedOrder: unknown[] = Array.isArray(state.order) ? state.order : [];
    const order = savedOrder
      .map((raw) => String(raw ?? '').toUpperCase())
      .filter((letter) => letter.length === 1 && isPlayableLetter(letter) && phrase.includes(letter));
    this.letterOrder = order.length ? order : fromPayload;

    // Solo lettere della frase: un checkpoint corrotto non svela altro.
    const savedLetters: unknown[] = Array.isArray(state.letters) ? state.letters : [];
    const letters = new Set<string>();
    for (const raw of savedLetters) {
      const letter = String(raw ?? '').toUpperCase();
      if (letter.length === 1 && isPlayableLetter(letter) && phrase.includes(letter)) letters.add(letter);
    }
    this.revealedLetters.set(letters);

    const rawIndex = Number(state.letterIndex);
    this.letterIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex <= this.letterOrder.length
      ? rawIndex
      : this.letterOrder.length;

    this.revealed.set(false);
    this.buzzedPlayer.set(null);
    this.isActive.set(true);
    this.isPaused.set(false);
    this.timer.set(Math.max(0, Math.round(Number(secondsLeft) || 0)));
    this.startTimer();
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

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {
    this.revealAllLetters();
  }

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: false, answer };
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

  /** Svela la prossima lettera del mazzo guidato. */
  private revealNextLetter(): boolean {
    while (this.letterIndex < this.letterOrder.length) {
      const letter = this.letterOrder[this.letterIndex++];
      if (this.revealedLetters().has(letter)) continue;

      this.revealedLetters.update((set) => {
        const next = new Set(set);
        next.add(letter);
        return next;
      });
      this.saveCheckpoint();
      return true;
    }
    return false;
  }

  /** Lettere uscite e punto del mazzo: la TV li riapre dopo un refresh. */
  private saveCheckpoint(): void {
    this.config.onTvCheckpoint?.({
      type: this.type,
      revision: Date.now(),
      state: {
        order: [...this.letterOrder],
        letterIndex: this.letterIndex,
        letters: [...this.revealedLetters()],
        savedAt: Date.now(),
      },
    });
  }

  private revealAllLetters(): void {
    const phrase = this.payload?.proverb || '';
    const allLetters = new Set<string>(
      phrase.toUpperCase().split('').filter((c: string) => isPlayableLetter(c)),
    );
    this.revealedLetters.set(allLetters);
  }

  private startLetterReveal(): void {
    this.stopLetterReveal();

    this.letterRevealInitialTimeout = setTimeout(() => {
      if (this.buzzedPlayer()) return;
      this.revealNextLetter();

      this.letterRevealInterval = setInterval(() => {
        if (this.buzzedPlayer()) return;

        if (!this.revealNextLetter()) {
          this.stopRevealInterval();
        }
      }, REVEAL_EVERY_MS);
    }, FIRST_REVEAL_MS);
  }

  private stopRevealInterval(): void {
    if (this.letterRevealInterval) {
      clearInterval(this.letterRevealInterval);
      this.letterRevealInterval = undefined;
    }
  }

  private stopLetterReveal(): void {
    if (this.letterRevealInitialTimeout) {
      clearTimeout(this.letterRevealInitialTimeout);
      this.letterRevealInitialTimeout = undefined;
    }
    this.stopRevealInterval();
  }

  getDisplayData() {
    const phrase = this.payload?.proverb || '';
    const revealed = this.revealedLetters();

    return {
      hint: this.payload?.hint,
      displayWords: phrase.split(' ').map((word: string) => {
        return word.split('').map((char: string) => {
          const cu = char.toUpperCase();
          if (!isPlayableLetter(cu)) return char;
          return revealed.has(cu) ? char : '_';
        });
      }),
      revealedCount: revealed.size,
      totalLetters: new Set(
        phrase.toUpperCase().split('').filter((c: string) => isPlayableLetter(c)),
      ).size,
      buzzedPlayer: this.buzzedPlayer(),
    };
  }
}
