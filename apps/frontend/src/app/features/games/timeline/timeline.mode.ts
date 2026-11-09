import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import { environment } from '../../../core/environment/environment';

/**
 * Timeline: tutte le squadre ordinano le stesse carte, dal passato al presente.
 *
 * Gli anni non stanno nel payload (i telefoni lo ricevono): la soluzione resta
 * sul server e arriva alla TV solo al reveal.
 */
export class TimelineMode extends GameModeBase {
  readonly type: GameModeType = 'TIMELINE';
  readonly timerDuration = 45;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  private cards = signal<Array<{ id: number; label: string }>>([]);
  private ordered = signal<Array<{ label: string; year: number }>>([]);
  private results = signal<any[]>([]);
  private solutionReady = signal(false);
  private pointsApplied = false;

  protected onInitialize(): void {
    this.cards.set(this.payload?.items ?? []);
    this.ordered.set([]);
    this.results.set([]);
    this.solutionReady.set(false);
    this.pointsApplied = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(4000);
  }

  protected onPause(): void {}
  protected onResume(): void {}

  protected onStop(): void {}

  protected onCleanup(): void {
    this.cards.set([]);
    this.ordered.set([]);
    this.results.set([]);
  }

  protected onTimeout(): void {
    void this.reveal();
  }

  /** Esiti dei singoli telefoni, trasmessi dal server appena rispondono. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'TIMELINE_RESULT' || !event.playerName) return;

    this.results.update((list) => [
      ...list.filter((item) => item.playerName !== event.playerName),
      {
        playerName: event.playerName,
        score: Number(event.score) || 0,
        correctPairs: Number(event.correctPairs) || 0,
        totalPairs: Number(event.totalPairs) || 0,
        correctPositions: Number(event.correctPairs) || 0,
      },
    ].sort((a, b) => b.score - a.score));
  }

  private async reveal(): Promise<void> {
    if (this.solutionReady()) return;
    this.solutionReady.set(true);

    // Mezzo secondo di margine: le ultime risposte possono essere ancora in volo.
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const token = localStorage.getItem(`pubgame.session.${this.config.gameId}.TV`);
      const response = await fetch(`${environment.apiUrl}/games/${this.config.gameId}/timeline/reveal`, {
        headers: token ? { 'X-Session-Token': token } : {},
      });
      if (!response.ok) throw new Error('Reveal non disponibile');
      const data = await response.json();
      this.ordered.set(data.items ?? []);
      this.results.set(data.results ?? []);
    } catch {
      // Senza rete resta l'ordine locale: la serata non si blocca.
    }

    this.applyPoints();
  }

  /** I punti entrano in classifica una sola volta, al reveal. */
  private applyPoints(): void {
    if (this.pointsApplied) return;
    this.pointsApplied = true;

    for (const result of this.results()) {
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points: result.score,
        isCorrect: result.score > 0,
      });
    }
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: !!answer, points: 0 };
  }

  protected calculatePoints(isCorrect: boolean, _elapsedMs: number): number {
    return isCorrect ? 0 : 0;
  }

  getDisplayData() {
    return {
      roundId: this.payload?.roundId ?? '',
      question: this.payload?.question ?? 'Metti le carte in ordine',
      items: this.cards(),
      count: this.cards().length,
      isReading: this.isReading(),
      revealed: this.revealed(),
      ordered: this.ordered(),
      results: this.results(),
      correctAnswer: null,
    };
  }
}
