// src/app/core/game-modes/base/game-mode-base.class.ts

import {signal, Signal, WritableSignal} from '@angular/core';
import {GameModeConfig, GameModeResult, GameModeType, IGameMode} from './game-mode-type';

/**
 * Classe base astratta per tutte le modalità di gioco
 * Implementa logica comune e pattern Template Method
 */
export abstract class GameModeBase implements IGameMode {
  abstract readonly type: GameModeType;
  abstract readonly timerDuration: number;
  abstract readonly requiresBubbles: boolean;
  abstract readonly requiresBuzz: boolean;
  protected started = false;
  protected paused = false;
  protected config: GameModeConfig = {
    type: 'QUIZ',
    payload: {},
    gameId: 0,
    onTimerTick: () => {
    },
    onTimerEnd: () => {
    },
    onBuzz: () => {
    },
    onAnswerReceived: () => {
    }
  };

  protected payload: any;

  // State signals
  protected timer = signal<number>(0);
  protected isActive = signal<boolean>(false);
  protected isPaused = signal<boolean>(false);
  protected revealed = signal<boolean>(false);
  protected buzzedPlayer = signal<string | null>(null);
  public isReading = signal<boolean>(false);
  protected showGo: WritableSignal<boolean> = signal(false);

  getShowGo() {
    return this.showGo();
  }

  getIsReading() {
    return this.isReading();
  }

  private timerInterval?: any;

  constructor() {
  }

  // ========== LIFECYCLE ==========

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

  // Rendiamo start asincrono così chi chiama può awaitare l'intero flusso onStart()
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    // Se onStart restituisce una Promise la attendiamo, altrimenti proseguiamo subito
    await Promise.resolve(this.onStart()); // permette onStart essere sync o async
  }

  private async preTimerDelay() {
    // 10 secondi di pausa
    await new Promise(r => setTimeout(r, 10000));

    // Mostra popup "VIA" velocissimo
    this.showGoPopup();

    // poi parte il timer vero
    this.startTimer();
  }

  private showGoPopup() {
    // Qui puoi triggerare un segnale o evento UI veloce per mostrare "VIA"
    console.log('🚦 VIA!'); // esempio console, puoi usare signal per il template
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
    this.onStop();
    // Permetti di riavviare la stessa istanza se necessario
    this.started = false;
  }

  cleanup(): void {
    this.stopTimer();
    this.onCleanup();
    // Assicuriamoci che lo stato di started sia resettato
    this.started = false;
  }

  // ========== TIMER MANAGEMENT ==========
  protected async runPreGameSequence(readingTime: number = 10000) {
    this.isReading.set(true);      // fase lettura
    this.isActive.set(false);      // blocca remote
    this.showGo.set(false);        // "VIA" nascosto

    // 1️⃣ Pausa lettura
    await new Promise(r => setTimeout(r, readingTime));

    // 2️⃣ Mostra popup VIA ~1.4s per renderlo più evidente
    this.showGo.set(true);
    await new Promise(r => setTimeout(r, 1400));
    this.showGo.set(false);

    // 3️⃣ Avvio reale del timer
    this.isReading.set(false);     // remote può rispondere
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

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  private handleTimeout(): void {
    this.stop();
    this.config.onTimerEnd?.();
    this.onTimeout();
  }

  // ========== INTERACTIONS ==========

  handleBuzz(playerName: string): void {
    if (!this.canBuzz()) return;

    this.buzzedPlayer.set(playerName);
    this.pause();
    this.config.onBuzz?.(playerName);
    this.onBuzz(playerName);
  }

  handleAnswer(playerName: string, answer: any, timeMs: number): void {
    const result = this.validateAnswer(answer, timeMs);
    this.config.onAnswerReceived?.({playerName, ...result});
    this.onAnswer(playerName, answer, result);
  }

  confirmCorrect(playerName: string): void {
    const result: GameModeResult = {
      success: true,
      playerName,
      points: this.calculatePoints(true, this.timerDuration - this.timer()),
      correctAnswer: this.payload.correctAnswer
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

  // ========== STATE GETTERS ==========

  getTimerValue(): number {
    return this.timer();
  }

  canBuzz(): boolean {
    return this.isActive() && !this.buzzedPlayer() && !this.revealed();
  }

  isRevealed(): boolean {
    return this.revealed();
  }

  abstract getDisplayData(): any;

  // ========== ABSTRACT HOOKS (Template Method Pattern) ==========

  protected abstract onInitialize(): void;

  // Permetti onStart asincrono
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
