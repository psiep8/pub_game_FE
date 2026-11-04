import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../components/game-component/interfaces/game-mode-type';

export interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
}

const TOTAL_ROUNDS = 30;
const STORAGE_KEY = 'roundProgress';

/** Pesi percentuali di estrazione: la somma deve fare 100. */
const GAME_WEIGHTS: Record<GameModeType, number> = {
  QUIZ: 12,
  TRUE_FALSE: 12,
  WHEEL_OF_FORTUNE: 10,
  MUSIC: 10,
  IMAGE_BLUR: 10,
  CHRONO: 10,
  ROULETTE: 10,
  SCREAM_RACE: 10,
  ARENA: 14,
};

/** Ogni quante partite mostrare la classifica. */
const LEADERBOARD_EVERY = { QUICK: 3, DETAILED: 6 } as const;

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

  /** Estrae il tipo di gioco in base ai pesi configurati. */
  extractGameType(): GameModeType {
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const [type, weight] of Object.entries(GAME_WEIGHTS) as [GameModeType, number][]) {
      cumulative += weight;
      if (roll <= cumulative) return type;
    }

    return 'QUIZ';
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

    if (round % LEADERBOARD_EVERY.DETAILED === 0) return 'DETAILED';
    if (round % LEADERBOARD_EVERY.QUICK === 0) return 'QUICK';

    return null;
  }

  isGameOver(): boolean {
    const config = this.roundConfig();
    return config.currentRound >= config.totalRounds;
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
      this.roundConfig.set(JSON.parse(saved));
    } catch {
      console.error('❌ Errore caricamento progresso');
    }
  }
}
