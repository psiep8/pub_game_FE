import { signal, Signal, WritableSignal } from '@angular/core';
import { GameModeConfig, GameModeResult, GameModeType, IGameMode } from './game-mode-type';

/**
 * Classe base per tutte le modalità di gioco (Template Method).
 *
 * Gestisce timer, pre-start e ciclo di vita; le sottoclassi implementano solo
 * i comportamenti specifiche tramite gli hook `on*`.
 */
export abstract class GameModeBase implements IGameMode {
  abstract readonly type: GameModeType;
  abstract readonly timerDuration: number;
  abstract readonly requiresBubbles: boolean;
  abstract readonly requiresBuzz: boolean;

  protected started = false;
  protected paused = false;
  protected payload: any;

  protected config: GameModeConfig = {
    type: 'QUIZ',
    payload: {},
    gameId: 0,
  };

  protected timer = signal<number>(0);
  protected isActive = signal<boolean>(false);
  protected isPaused = signal<boolean>(false);
  protected revealed = signal<boolean>(false);
  protected buzzedPlayer = signal<string | null>(null);
  protected isReading = signal<boolean>(false);
  protected showGo: WritableSignal<boolean> = signal(false);
  protected preStartCountdown = signal<number>(0);

  protected timerInterval?: ReturnType<typeof setInterval>;
  private preStartInterval?: ReturnType<typeof setInterval>;

  getShowGo(): boolean {
    return this.showGo();
  }

  getPreStartCountdown(): number {
    return this.preStartCountdown();
  }

  getIsReading(): boolean {
    return this.isReading();
  }

  /** Punteggio calcolato dalla modalità specifica. */
  pointsFor(isCorrect: boolean, elapsedMs: number): number {
    return this.calculatePoints(isCorrect, elapsedMs);
  }

  initialize(payload: any): void {
    this.payload = payload;
    this.timer.set(this.timerDuration);
    this.isActive.set(false);
    this.revealed.set(false);
    this.buzzedPlayer.set(null);
    this.onInitialize();
  }

  setConfig(config: GameModeConfig): void {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await Promise.resolve(this.onStart());
  }

  pause(): void {
    this.isPaused.set(true);
    this.stopTimer();
    this.onPause();
  }

  resume(): void {
    this.isPaused.set(false);
    this.startTimer();
    this.onResume();
  }

  stop(): void {
    this.isActive.set(false);
    this.revealed.set(true);
    this.stopTimer();

    this.buzzedPlayer.set(null);
    this.onStop();

    this.started = false;
  }

  cleanup(): void {
    this.stopTimer();
    this.onCleanup();

    this.started = false;
  }

  /**
   * La partita parte sul comando esplicito del presentatore (admin o tasto
   * AVANTI in TV): niente countdown automatico prima della domanda.
   */
  protected async runPreGameSequence(_readingTime: number = 0): Promise<void> {
    this.stopPreStartInterval();
    this.preStartCountdown.set(0);
    this.isReading.set(false);
    this.showGo.set(false);
    this.isActive.set(true);
    this.startTimer();
  }

  protected startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.isPaused() || this.buzzedPlayer()) return;

      const current = this.timer();
      if (current > 0) {
        this.timer.set(current - 1);
        this.config.onTimerTick?.(current - 1);
      } else {
        this.stopTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  protected stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.stopPreStartInterval();
  }

  private stopPreStartInterval(): void {
    if (this.preStartInterval) {
      clearInterval(this.preStartInterval);
      this.preStartInterval = undefined;
    }
  }

  protected handleTimeout(): void {
    this.stop();
    this.config.onTimerEnd?.();
    this.onTimeout();
  }

  handleBuzz(playerName: string): void {
    if (!this.canBuzz()) return;

    this.buzzedPlayer.set(playerName);
    this.pause();
    this.config.onBuzz?.(playerName);
    this.onBuzz(playerName);
  }

  handleAnswer(playerName: string, answer: any, timeMs: number): void {
    const result = this.validateAnswer(answer, timeMs);
    this.config.onAnswerReceived?.({ playerName, ...result });
    this.onAnswer(playerName, answer, result);
  }

  confirmCorrect(playerName: string): void {
    const result: GameModeResult = {
      success: true,
      playerName,
      points: this.calculatePoints(true, this.timerDuration - this.timer()),
      correctAnswer: this.payload.correctAnswer,
    };

    this.stop();
    this.onConfirmCorrect(result);
  }

  confirmWrong(playerName: string): void {
    const result: GameModeResult = {
      success: false,
      playerName,
      points: this.calculatePoints(false, this.timerDuration - this.timer()),
    };

    this.buzzedPlayer.set(null);
    this.resume();
    this.onConfirmWrong(result);
  }

  getTimerValue(): number {
    return this.timer();
  }

  canBuzz(): boolean {
    return this.isActive() && !this.buzzedPlayer() && !this.revealed();
  }

  isRevealed(): boolean {
    return this.revealed();
  }

  protected timerSignal(): Signal<number> {
    return this.timer;
  }

  abstract getDisplayData(): any;

  protected abstract onInitialize(): void;

  protected abstract onStart(): Promise<void> | void;

  protected abstract onPause(): void;

  protected abstract onResume(): void;

  protected abstract onStop(): void;

  protected abstract onCleanup(): void;

  protected abstract onTimeout(): void;

  protected abstract onBuzz(playerName: string): void;

  protected abstract onAnswer(playerName: string, answer: any, result: any): void;

  protected abstract onConfirmCorrect(result: GameModeResult): void;

  protected abstract onConfirmWrong(result: GameModeResult): void;

  protected abstract validateAnswer(answer: any, timeMs: number): any;

  protected abstract calculatePoints(isCorrect: boolean, elapsedMs: number): number;
}
