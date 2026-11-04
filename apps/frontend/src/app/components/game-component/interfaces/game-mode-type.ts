/**
 * Contratto comune a tutte le modalità di gioco.
 *
 * La configurazione raccoglie i callback verso la TV (`GameComponent`) e lo
 * stato condiviso del round, così ogni modalità resta indipendente da Angular.
 */

export type GameModeType =
  | 'QUIZ'
  | 'IMAGE_BLUR'
  | 'ROULETTE'
  | 'MUSIC'
  | 'SCREAM_RACE'
  | 'WHEEL_OF_FORTUNE'
  | 'ARENA'
  | 'TIMELINE'
  | 'PRICE'
  | 'SPEED_RUSH'
  | 'PING_PONG';

export interface GameModeConfig {
  type: GameModeType;
  payload: any;
  gameId: number;
  /** Giocatori in classifica, nell'ordine della leaderboard. */
  activePlayers?: string[];
  onTimerTick?: (seconds: number) => void;
  onTimerEnd?: () => void;
  onBuzz?: (playerName: string) => void;
  onAnswerReceived?: (data: any) => void;
  /** Messaggio da mandare ai telefoni (es. nuova domanda del Ping Pong). */
  onBroadcast?: (event: any) => void;
  onPreGameTick?: (secondsRemaining: number) => void;
  /** Arena: una squadra è appena uscita dal cerchio. */
  onPlayerEliminated?: (playerName: string) => void;
  /** Arena: la partita è finita (rimasto un solo giocatore o tempo scaduto). */
  onRoundEnded?: () => void;
}

export interface GameModeResult {
  success: boolean;
  playerName: string;
  points: number;
  correctAnswer?: string;
  message?: string;
}

export interface IGameMode {
  readonly type: GameModeType;

  readonly timerDuration: number;
  readonly requiresBubbles: boolean;
  readonly requiresBuzz: boolean;

  initialize(payload: any): void;
  setConfig(config: GameModeConfig): void;
  start(): Promise<void> | void;
  pause(): void;
  resume(): void;
  stop(): void;
  cleanup(): void;

  handleBuzz(playerName: string): void;
  handleAnswer(playerName: string, answer: any, timeMs: number): void;
  confirmCorrect(playerName: string): void;
  confirmWrong(playerName: string): void;

  getDisplayData(): any;
  getTimerValue(): number;
  getShowGo?(): boolean;
  getPreStartCountdown?(): number;
  getIsReading?(): boolean;
  canBuzz(): boolean;
  isRevealed(): boolean;

  /** Punteggio per una risposta, in base a correttezza e tempo impiegato. */
  pointsFor(isCorrect: boolean, elapsedMs: number): number;

  /** Scream Race: avanzamento spinto dall'intensità del microfono. */
  applyScreamIntensity?(playerName: string, intensity: number): void;
  /** Scream Race: il giocatore ha tagliato il traguardo. */
  markTeamFinished?(playerName: string, position: number): void;
  /** Arena: esito di una domanda a risposta rapida. */
  applyArenaAnswer?(playerName: string, isCorrect: boolean, points: number): void;
  /** Timeline, Quanto costa, Speed Rush, Ping Pong: eventi dal server o dai telefoni. */
  handlePartyEvent?(event: any): void;
}
