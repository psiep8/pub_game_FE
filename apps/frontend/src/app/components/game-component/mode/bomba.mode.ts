import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

/**
 * Bomba: la TV mostra lo stato, il server tiene micce e punteggi.
 *
 * La modalità non usa il timer della classe base: il tempo del round arriva
 * dallo stato del backend, così pausa, ripresa e refresh della TV non
 * desincronizzano la partita.
 */
export class BombaMode extends GameModeBase {
  readonly type: GameModeType = 'BOMBA';
  readonly timerDuration = 90;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private readonly state = signal<any>({
    type: 'BOMBA',
    active: true,
    remainingSeconds: 90,
    bombs: [],
    scores: {},
    events: [],
  });

  private players: string[] = [];
  private act = 1;
  private pollHandle?: ReturnType<typeof setInterval>;
  private pollBusy = false;
  private startedOnce = false;
  private ended = false;

  protected onInitialize(): void {
    // La factory chiama initialize() prima di setConfig(): i giocatori veri
    // vanno letti in onStart, quando la configurazione è già disponibile.
    this.players = [];
    this.act = 1;
    this.startedOnce = false;
    this.ended = false;
    this.pollBusy = false;
    this.stopPolling();
    this.state.set({
      type: 'BOMBA',
      active: true,
      remainingSeconds: this.timerDuration,
      bombs: [],
      scores: {},
      events: [],
    });
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.players = [...(this.config.activePlayers ?? [])];
    this.act = Number(this.payload?.act) || 1;

    const api = this.config.bomba;
    if (!api) {
      console.error('Bomba: API non configurata');
      return;
    }

    this.timer.set(this.timerDuration);
    try {
      const initial = await api.start(this.players, this.act);
      this.startedOnce = true;
      this.applyState(initial);
    } catch (error) {
      console.error('Bomba: impossibile avviare il round', error);
      this.state.set({
        ...this.state(),
        active: false,
        error: 'Impossibile avviare Bomba: servono almeno 2 squadre collegate.',
      });
    }
    this.startPolling();
  }

  protected override startTimer(): void {
    // Il timer del round è quello del server: niente setInterval locale.
  }

  protected onPause(): void {
    void this.config.bomba?.pause();
  }

  protected onResume(): void {
    void this.config.bomba?.resume();
    void this.poll();
  }

  protected onStop(): void {
    this.stopPolling();
  }

  protected onCleanup(): void {
    this.stopPolling();
    // Non resettare da qui: un reset HTTP potrebbe arrivare dopo lo start del
    // round successivo e cancellarlo. Il prossimo start rimpiazza il vecchio
    // stato sul server.
    this.state.set({
      type: 'BOMBA',
      active: false,
      remainingSeconds: 0,
      bombs: [],
      scores: {},
      events: [],
    });
  }

  protected onTimeout(): void {
    // La fine arriva dallo stato del backend, non dal timer locale.
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollHandle = setInterval(() => void this.poll(), 500);
    void this.poll();
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  private async poll(): Promise<void> {
    if (this.pollBusy || this.ended || this.isPaused() || !this.startedOnce) {
      return;
    }

    const api = this.config.bomba;
    if (!api) return;

    this.pollBusy = true;
    try {
      const next = await api.state();
      this.applyState(next);
    } catch (error) {
      // Un poll perso non deve fermare la partita: il prossimo recupera.
      console.warn('Bomba: stato non disponibile', error);
    } finally {
      this.pollBusy = false;
    }
  }

  private applyState(next: any): void {
    if (!next) return;

    this.state.set(next);
    const remaining = Number(next.remainingSeconds);
    if (Number.isFinite(remaining)) {
      this.timer.set(Math.max(0, Math.round(remaining)));
      this.config.onTimerTick?.(Math.max(0, Math.round(remaining)));
    }

    if (next.active === false && !this.ended) {
      this.ended = true;
      this.stopPolling();
      this.revealed.set(true);
      this.applyFinalScores(next);
      this.config.onTimerEnd?.();
    }
  }

  /**
   * Il round parte da 1000 per tutti. In classifica entra solo il delta, così
   * il punteggio di partenza non gonfia i totali della serata.
   */
  private applyFinalScores(next: any): void {
    const scores = next?.scores ?? {};
    for (const [playerName, rawScore] of Object.entries(scores)) {
      const score = Number(rawScore);
      if (!Number.isFinite(score)) continue;
      const delta = score - 1000;
      this.config.onAnswerReceived?.({
        playerName,
        points: delta,
        isCorrect: delta >= 0,
      });
    }
  }

  getDisplayData(): any {
    return {
      ...this.state(),
      type: 'BOMBA',
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
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
}
