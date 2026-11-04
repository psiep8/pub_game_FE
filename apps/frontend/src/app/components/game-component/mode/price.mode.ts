import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';
import { environment } from '../../../environment/environment';

/**
 * Quanto costa: tre oggetti per round.
 *
 * I telefoni mandano tre stime; il server elimina il peggiore di ogni oggetto
 * e assegna i punti ai superstiti in base alla distanza totale dal prezzo.
 * La soluzione non viaggia mai nel payload iniziale.
 */
export class PriceMode extends GameModeBase {
  readonly type: GameModeType = 'PRICE';
  readonly timerDuration = 45;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private items = signal<Array<{ name: string; emoji: string; category: string }>>([]);
  private guesses = signal<Array<{ playerName: string; count: number }>>([]);
  private revealData = signal<any | null>(null);
  private pointsApplied = false;

  protected onInitialize(): void {
    const payloadItems = Array.isArray(this.payload?.items) ? this.payload.items : [];
    this.items.set(payloadItems);
    this.guesses.set([]);
    this.revealData.set(null);
    this.pointsApplied = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(3000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}

  protected onCleanup(): void {
    this.items.set([]);
    this.guesses.set([]);
    this.revealData.set(null);
  }

  protected onTimeout(): void {
    void this.reveal();
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'PRICE_ANSWER' || !event.playerName) return;

    this.guesses.update((list) => [
      ...list.filter((item) => item.playerName !== event.playerName),
      {
        playerName: event.playerName,
        count: Number(event.count) || this.items().length,
      },
    ].sort((a, b) => a.playerName.localeCompare(b.playerName)));
  }

  private async reveal(): Promise<void> {
    if (this.revealData()) return;
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const response = await fetch(`${environment.apiUrl}/games/${this.config.gameId}/price/reveal`);
      const data = await response.json();
      this.revealData.set(data);
      this.applyPoints(data);
    } catch {
      this.revealData.set({ items: [], results: [], eliminations: [] });
    }
  }

  private applyPoints(data: any): void {
    if (this.pointsApplied) return;
    this.pointsApplied = true;

    for (const result of data?.results ?? []) {
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points: Number(result.score) || 0,
        isCorrect: Number(result.score) > 0,
      });
    }
  }

  protected onBuzz(_playerName: string): void {}
  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}
  protected onConfirmCorrect(_result: GameModeResult): void {}
  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: this.payload?.question ?? 'Quanto costa?',
      items: this.items(),
      count: this.items().length,
      unit: this.payload?.unit ?? '€',
      guesses: this.guesses(),
      reveal: this.revealData(),
      explain: this.payload?.explain ?? '',
      isReading: this.isReading(),
      correctAnswer: this.revealed() ? this.payload?.correctAnswer ?? null : null,
    };
  }
}
