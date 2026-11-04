import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';
import { environment } from '../../../environment/environment';

interface PriceItem {
  name: string;
  emoji: string;
  category: string;
  price?: number;
  source?: string;
}

interface MancheGuess {
  playerName: string;
  value: number;
}

interface MancheResult extends MancheGuess {
  error: number;
  eliminated: boolean;
}

/**
 * Quanto costa — a manche.
 *
 * Ogni oggetto è una manche: solo chi è ancora in gara manda una stima, il
 * prezzo non viaggia mai nel payload (viene letto dal server e mostrato solo
 * al reveal). Il peggiore di ogni manche esce; vince chi resta in piedi.
 */
export class PriceMode extends GameModeBase {
  readonly type: GameModeType = 'PRICE';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private items = signal<PriceItem[]>([]);
  private mancheIndex = signal(0);
  private remaining = signal<string[]>([]);
  private eliminatedNames = signal<string[]>([]);
  private guesses = signal<MancheGuess[]>([]);
  private revealData = signal<any | null>(null);
  private finished = signal(false);

  private solution: PriceItem[] = [];
  private timerHandle?: ReturnType<typeof setTimeout>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    const payloadItems = Array.isArray(this.payload?.items) ? this.payload.items : [];
    this.items.set(payloadItems);
    this.solution = payloadItems.map((item: PriceItem) => ({ ...item }));
    this.mancheIndex.set(0);
    this.remaining.set([...(this.config.activePlayers ?? [])]);
    this.eliminatedNames.set([]);
    this.guesses.set([]);
    this.revealData.set(null);
    this.finished.set(false);
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(3000);
    await this.loadSolution();
    this.beginManche();
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.clearTimers();
  }

  protected onCleanup(): void {
    this.clearTimers();
  }

  protected onTimeout(): void {
    this.revealManche();
  }

  private async loadSolution(): Promise<void> {
    try {
      const response = await fetch(`${environment.apiUrl}/games/${this.config.gameId}/price/reveal`);
      const data = await response.json();
      if (Array.isArray(data?.items) && data.items.length) {
        this.solution = data.items;
      }
    } catch {
      // Senza backend restano i prezzi eventualmente presenti nel payload.
    }
  }

  private beginManche(): void {
    if (this.finished()) return;

    if (this.mancheIndex() >= this.items().length) {
      this.finish();
      return;
    }

    this.guesses.set([]);
    this.revealData.set(null);
    this.timer.set(this.timerDuration);

    this.clearTimers();
    this.timerHandle = setTimeout(() => this.revealManche(), this.timerDuration * 1000);
    this.broadcast();
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'PRICE_ANSWER' || !event.playerName) return;
    if (this.revealData() || this.finished()) return;

    const playerName = String(event.playerName);
    if (this.eliminatedNames().includes(playerName)) return;

    const value = Number(event.value ?? event.price);
    if (!Number.isFinite(value) || value <= 0) return;

    this.guesses.update((list) => [
      ...list.filter((guess) => guess.playerName !== playerName),
      { playerName, value },
    ]);

    if (this.guesses().length >= this.remaining().length) {
      this.revealManche();
    } else {
      this.broadcast();
    }
  }

  private revealManche(): void {
    if (this.revealData() || this.finished()) return;

    this.clearTimers();

    const index = this.mancheIndex();
    const item = this.items()[index];
    const price = Number(this.solution[index]?.price ?? item?.price ?? 0);

    const results: MancheResult[] = this.guesses()
      .map((guess) => ({
        ...guess,
        error: price > 0 ? Math.abs(guess.value - price) : 0,
        eliminated: false,
      }))
      .sort((a, b) => a.error - b.error);

    if (results.length > 1) {
      results[results.length - 1].eliminated = true;
    }

    const out = results.find((result) => result.eliminated)?.playerName ?? null;
    if (out) {
      this.eliminatedNames.update((list) => [...list, out]);
      this.remaining.update((list) => list.filter((name) => name !== out));
    }

    results.forEach((result, position) => {
      if (result.eliminated) return;
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points: Math.max(50, 250 - position * 50),
        isCorrect: position === 0,
      });
    });

    this.revealData.set({ price, results, eliminated: out, item });
    this.broadcast();

    this.advanceHandle = setTimeout(() => {
      if (this.remaining().length <= 1 || index + 1 >= this.items().length) {
        this.finish();
      } else {
        this.mancheIndex.update((value) => value + 1);
        this.beginManche();
      }
    }, 5500);
  }

  private finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.clearTimers();

    const winner = this.remaining()[0];
    if (winner) {
      this.config.onAnswerReceived?.({ playerName: winner, points: 500, isCorrect: true });
    }

    this.broadcast();
    this.config.onTimerEnd?.();
  }

  private clearTimers(): void {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    if (this.advanceHandle) clearTimeout(this.advanceHandle);
    this.timerHandle = undefined;
    this.advanceHandle = undefined;
  }

  private broadcast(): void {
    this.config.onBroadcast?.({ action: 'PRICE_STATE', state: this.getDisplayData() });
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
      question: this.payload?.question ?? 'Quanto costa?',
      unit: this.payload?.unit ?? '€',
      item: this.items()[this.mancheIndex()] ?? null,
      manche: this.mancheIndex() + 1,
      total: this.items().length,
      remaining: this.remaining(),
      eliminated: this.eliminatedNames(),
      guesses: this.guesses(),
      reveal: this.revealData(),
      finished: this.finished(),
      isReading: this.isReading(),
      correctAnswer: null,
    };
  }
}
