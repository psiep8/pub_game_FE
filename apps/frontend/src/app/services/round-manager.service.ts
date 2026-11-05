import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../components/game-component/interfaces/game-mode-type';

export interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
}

const TOTAL_ROUNDS = 24;
const STORAGE_KEY = 'roundProgress';

/**
 * Scaletta in tre atti da otto round.
 *
 * L'ordine è fisso e già verificato rispetto ai vincoli: mai due giochi in
 * tempo reale di fila (Arena, Speed Rush, Ping Pong), mai due giochi a
 * prenotazione consecutivi (Musica, Indovina chi), il primo round di ogni atto
 * è sempre Quiz.
 */
const ACT_DECKS: GameModeType[][] = [
  ['QUIZ', 'MUSIC', 'TIME_BUZZER', 'WHEEL_OF_FORTUNE', 'IMAGE_BLUR', 'TIMELINE', 'QUIZ', 'SPEED_RUSH'],
  ['QUIZ', 'IMAGE_BLUR', 'TIMELINE', 'ARENA', 'MUSIC', 'TIME_BUZZER', 'WHEEL_OF_FORTUNE', 'AIR_HOCKEY_BATTLE'],
  ['QUIZ', 'TIMELINE', 'MUSIC', 'SPEED_RUSH', 'TIME_BUZZER', 'AIR_HOCKEY_BATTLE', 'WHEEL_OF_FORTUNE', 'ARENA'],
];

/** Classifiche: rapida a metà atto, dettagliata a fine atto. */
const QUICK_LEADERBOARD_ROUNDS = [4, 12, 20];
const DETAILED_LEADERBOARD_ROUNDS = [8, 16, 24];

/**
 * Gestisce l'avanzamento della partita: quanti round mancano, quale modalità
 * estrarre e quando interrompere il gioco per mostrare la classifica.
 * Lo stato viene salvato in `localStorage` per sopravvivere a un refresh della TV.
 */
@Injectable({ providedIn: 'root' })
export class RoundManagerService {
  private roundConfig = signal<RoundConfig>({
    totalRounds: TOTAL_ROUNDS,
    currentRound: 0,
    completedRounds: [],
    nextRoundType: null,
  });

  constructor() {
    this.loadProgress();
  }

  /** Tipo previsto dalla scaletta per il round corrente (indice 0-based). */
  extractGameType(): GameModeType {
    const round = this.roundConfig().currentRound;
    const act = Math.min(ACT_DECKS.length - 1, Math.floor(round / 8));
    const deck = ACT_DECKS[act];
    return deck[round % deck.length];
  }

  startNewRound(): GameModeType {
    if (this.isGameOver()) throw new Error('Tutti i round completati!');

    const gameType = this.extractGameType();

    this.roundConfig.update((config) => ({
      ...config,
      currentRound: config.currentRound + 1,
      nextRoundType: gameType,
    }));
    this.saveProgress();

    return gameType;
  }

  /**
   * Bonus Roulette: non consuma un round della scaletta. Serve dopo la
   * classifica di fine atto, senza rubare il posto a un gioco vero.
   */
  startBonusRound(): GameModeType {
    this.roundConfig.update((config) => ({ ...config, nextRoundType: 'ROULETTE' }));
    this.saveProgress();
    return 'ROULETTE';
  }

  completeRound(gameType: GameModeType): void {
    this.roundConfig.update((config) => ({
      ...config,
      completedRounds: [...config.completedRounds, gameType],
      nextRoundType: null,
    }));
    this.saveProgress();
  }

  shouldShowLeaderboard(): 'QUICK' | 'DETAILED' | null {
    const round = this.roundConfig().currentRound;
    if (round === 0) return null;

    if (DETAILED_LEADERBOARD_ROUNDS.includes(round)) return 'DETAILED';
    if (QUICK_LEADERBOARD_ROUNDS.includes(round)) return 'QUICK';

    return null;
  }

  isGameOver(): boolean {
    const config = this.roundConfig();
    return config.currentRound >= config.totalRounds;
  }

  isActEnd(): boolean {
    const round = this.roundConfig().currentRound;
    return round > 0 && round % 8 === 0;
  }

  resetGame(): void {
    this.roundConfig.set({
      totalRounds: TOTAL_ROUNDS,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  }

  getRoundStats() {
    const config = this.roundConfig();
    const distribution: Record<string, number> = {};

    for (const type of config.completedRounds) {
      distribution[type] = (distribution[type] ?? 0) + 1;
    }

    return {
      current: config.currentRound,
      total: config.totalRounds,
      completed: config.completedRounds.length,
      remaining: config.totalRounds - config.currentRound,
      distribution,
    };
  }

  getCurrentRound(): number {
    return this.roundConfig().currentRound;
  }

  getTotalRounds(): number {
    return this.roundConfig().totalRounds;
  }

  getProgress() {
    const config = this.roundConfig();

    return {
      percentage: (config.currentRound / config.totalRounds) * 100,
      text: `${config.currentRound}/${config.totalRounds}`,
    };
  }

  private saveProgress(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.roundConfig()));
  }

  private loadProgress(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as RoundConfig;
      // Una scaletta vecchia (30 round) non deve trascinarsi dietro indici
      // fuori range: in quel caso si riparte puliti.
      if (parsed?.totalRounds !== TOTAL_ROUNDS) return;
      this.roundConfig.set(parsed);
    } catch {
      console.error('❌ Errore caricamento progresso');
    }
  }
}
