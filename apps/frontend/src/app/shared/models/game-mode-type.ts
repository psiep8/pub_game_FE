/**
 * Contratto comune a tutte le modalità di gioco.
 *
 * La configurazione raccoglie i callback verso la TV (`GameComponent`) e lo
 * stato condiviso del round, così ogni modalità resta indipendente da Angular.
 */

import { GameModeType } from '../enums/game-mode-type';

export { GameModeType };

export interface BombaApi {
  start(players: string[], act: number): Promise<any>;
  state(player?: string): Promise<any>;
  pick(playerName: string, cellId: number): Promise<any>;
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
  /** Messaggio da mandare ai telefoni (es. nuova domanda dell'Tennis). */
  onBroadcast?: (event: any) => void;
  /** Ultima spiaggia: consuma il livello scelto per le occorrenze successive. */
  onUltimaSpiaggiaLevel?: (playerName: string, level: number) => void;
  /** Time Buzzer: il via della manche lo dà il server, che torna l'istante. */
  startTimeBuzzer?: (manche: number) => Promise<number | null>;
  /** Countdown visibili dentro una modalità (es. pausa tra le manche). */
  onCountdownTick?: (secondsRemaining: number) => void;
  /** Arena: una squadra è appena uscita dal cerchio. */
  onPlayerEliminated?: (playerName: string) => void;
  /** Arena: la partita è finita (rimasto un solo giocatore o tempo scaduto). */
  onRoundEnded?: () => void;
  /** Bomba: API server-authoritative condivisa da TV e telefoni. */
  bomba?: BombaApi;
  /** Punti attuali di una squadra: serve per non scendere sotto zero. */
  playerPoints?: (playerName: string) => number;
  /** Tennis: domande pescate dalla banca all'avvio del round. */
  loadTennisQuestions?: (difficulty: string) => Promise<Array<{
    text: string;
    options: string[];
    correctIndex: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  }>>;
  /** Speed Rush: la TV apre la sessione e chiude la corsa sul server. */
  startSpeedRush?: (players: string[]) => Promise<any>;
  finishSpeedRush?: () => Promise<any[]>;
  /** Blackjack: la TV salva lo stato della mano sul server a ogni cambio. */
  onBlackjackState?: (state: unknown | null) => void;
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
  /** Ripresa dopo un refresh: timer dal tempo rimasto, nessun nuovo round. */
  restore?(secondsLeft: number, snapshot?: unknown): void;
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
  getIsReading?(): boolean;
  canBuzz(): boolean;
  isRevealed(): boolean;

  /** Punteggio per una risposta, in base a correttezza e tempo impiegato. */
  pointsFor(isCorrect: boolean, elapsedMs: number): number;

  /** Scream Race: avanzamento spinto dall'intensità del microfono. */
  /** Scream Race: il giocatore ha tagliato il traguardo. */
  /** Arena: esito di una domanda a risposta rapida. */
  applyArenaAnswer?(playerName: string, isCorrect: boolean, points: number): void;
  /** Timeline, Speed Rush, Tennis: eventi dal server o dai telefoni. */
  handlePartyEvent?(event: any): void;
  /** Canzone: la manche successiva parte solo su comando dell'admin. */
  nextManche?(): void;
}
