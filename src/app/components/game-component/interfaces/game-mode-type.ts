// src/app/core/game-modes/interfaces/game-round.interface.ts

/**
 * Tipi di modalità disponibili
 */
export type GameModeType =
  | 'QUIZ'
  | 'TRUE_FALSE'
  | 'CHRONO'
  | 'IMAGE_BLUR'
  | 'ROULETTE'
  | 'WHEEL_OF_FORTUNE';

/**
 * Configurazione per creare una modalità
 */
export interface GameModeConfig {
  type: GameModeType;
  payload: any;
  gameId: number;
  onTimerTick?: (seconds: number) => void;
  onTimerEnd?: () => void;
  onBuzz?: (playerName: string) => void;
  onAnswerReceived?: (data: any) => void;
  onPreGameTick?: (secondsRemaining: number) => void;
}

/**
 * Risultato di un'azione della modalità
 */
export interface GameModeResult {
  success: boolean;
  playerName: string;
  points: number;
  correctAnswer?: string;
  message?: string;
}

/**
 * Interfaccia base per tutte le modalità di gioco
 */
export interface IGameMode {
  readonly type: GameModeType;

  // Configurazione
  readonly timerDuration: number;
  readonly requiresBubbles: boolean;
  readonly requiresBuzz: boolean;

  // Lifecycle
  initialize(payload: any): void;
  start(): Promise<void> | void;
  pause(): void;
  resume(): void;
  stop(): void;
  cleanup(): void;

  // Interazioni
  handleBuzz(playerName: string): void;
  handleAnswer(playerName: string, answer: any, timeMs: number): void;
  confirmCorrect(playerName: string): void;
  confirmWrong(playerName: string): void;

  // State
  getDisplayData(): any;
  getTimerValue(): number;
  getShowGo?(): boolean;
  getPreStartCountdown?(): number;
  canBuzz(): boolean;
  isRevealed(): boolean;
}
