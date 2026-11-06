/**
 * Contratto comune a tutte le modalità di gioco.
 *
 * La configurazione raccoglie i callback verso la TV (`GameComponent`) e lo
 * stato condiviso del round, così ogni modalità resta indipendente da Angular.
 */

export type GameModeType =
  | 'QUIZ'
  | 'IMAGE_BLUR'
  | 'MUSIC'
  | 'WHEEL_OF_FORTUNE'
  | 'ARENA'
  | 'TIMELINE'
  | 'TIME_BUZZER'
  | 'BOMBA'
  | 'SPEED_RUSH'
  | 'AIR_HOCKEY_BATTLE'
  | 'SCOMMESSA';

export interface BombaApi {
  start(players: string[], act: number): Promise<any>;
  state(player?: string): Promise<any>;
  answer(playerName: string, bombId: number, answerIndex: number): Promise<any>;
  pass(playerName: string, bombId: number, target: string): Promise<any>;
  pause(): Promise<any>;
  resume(): Promise<any>;
  reset(): Promise<any>;
}

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
  /** Messaggio da mandare ai telefoni (es. nuova domanda dell'Air Hockey). */
  onBroadcast?: (event: any) => void;
  onPreGameTick?: (secondsRemaining: number) => void;
  /** Countdown visibili dentro una modalità (es. pausa tra le manche). */
  onCountdownTick?: (secondsRemaining: number) => void;
  /** Arena: una squadra è appena uscita dal cerchio. */
  onPlayerEliminated?: (playerName: string) => void;
  /** Arena: la partita è finita (rimasto un solo giocatore o tempo scaduto). */
  onRoundEnded?: () => void;
  /** Bomba: API server-authoritative condivisa da TV e telefoni. */
  bomba?: BombaApi;
  /** Air Hockey: domande pescate dalla banca all'avvio del round. */
  loadAirHockeyQuestions?: (difficulty: string) => Promise<Array<{
    text: string;
    options: string[];
    correctIndex: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  }>>;
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
  /** Scream Race: il giocatore ha tagliato il traguardo. */
  /** Arena: esito di una domanda a risposta rapida. */
  applyArenaAnswer?(playerName: string, isCorrect: boolean, points: number): void;
  /** Timeline, Speed Rush, Air Hockey: eventi dal server o dai telefoni. */
  handlePartyEvent?(event: any): void;
}
