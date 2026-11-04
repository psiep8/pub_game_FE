import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../components/game-component/interfaces/game-mode-type';

interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
}

@Injectable({
  providedIn: 'root'
})
export class RoundManagerService {

  private roundConfig = signal<RoundConfig>({
    totalRounds: 30,
    currentRound: 0,
    completedRounds: [],
    nextRoundType: null
  });

  private readonly GAME_PROBABILITIES: Record<GameModeType, number> = {
    // 'QUIZ': 14,
    // 'TRUE_FALSE': 14,
    // 'WHEEL_OF_FORTUNE': 12,
    // 'MUSIC': 12,
    // 'IMAGE_BLUR': 12,
    // 'CHRONO': 12,
    // 'ROULETTE': 12,
    // 'SCREAM_RACE': 12,
    // 'ONE_VS_ONE':0
    'QUIZ': 12,
    'TRUE_FALSE': 12,
    'WHEEL_OF_FORTUNE': 10,
    'MUSIC': 10,
    'IMAGE_BLUR': 10,
    'CHRONO': 10,
    'ROULETTE': 10,
    'SCREAM_RACE': 10,
    // 'ONE_VS_ONE': 2,
    'ARENA': 14
  };

  constructor() {
    this.loadProgress();
  }

  /**
   * 🎲 Estrae tipo di gioco in base alle probabilità
   */
  extractGameType(): GameModeType {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const [type, probability] of Object.entries(this.GAME_PROBABILITIES)) {
      cumulative += probability;
      if (rand <= cumulative) {
        return type as GameModeType;
      }
    }
    return 'QUIZ';
  }

  startNewRound(): GameModeType {
    const config = this.roundConfig();

    if (config.currentRound >= config.totalRounds) {
      throw new Error('Tutti i round completati!');
    }

    const gameType = this.extractGameType();

    this.roundConfig.update(c => ({
      ...c,
      currentRound: c.currentRound + 1,
      nextRoundType: gameType
    }));

    this.saveProgress();



    return gameType;
  }

  completeRound(gameType: GameModeType) {
    this.roundConfig.update(c => ({
      ...c,
      completedRounds: [...c.completedRounds, gameType],
      nextRoundType: null
    }));

    this.saveProgress();
  }

  shouldShowLeaderboard(): 'QUICK' | 'DETAILED' | null {
    const round = this.roundConfig().currentRound;

    if (round === 0) return null;


    if (round % 6 === 0) {

      return 'DETAILED';
    }


    if (round % 3 === 0) {

      return 'QUICK';
    }

    return null;
  }

  isGameOver(): boolean {
    const config = this.roundConfig();
    return config.currentRound >= config.totalRounds;
  }

  resetGame() {
    this.roundConfig.set({
      totalRounds: 30,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null
    });
    localStorage.removeItem('roundProgress');

  }

  getRoundStats() {
    const config = this.roundConfig();
    const stats: Record<string, number> = {};
    config.completedRounds.forEach(type => {
      stats[type] = (stats[type] || 0) + 1;
    });
    return {
      current: config.currentRound,
      total: config.totalRounds,
      completed: config.completedRounds.length,
      remaining: config.totalRounds - config.currentRound,
      distribution: stats
    };
  }

  getCurrentRound() {
    return this.roundConfig().currentRound;
  }

  getTotalRounds() {
    return this.roundConfig().totalRounds;
  }

  getProgress() {
    const config = this.roundConfig();
    return {
      percentage: (config.currentRound / config.totalRounds) * 100,
      text: `${config.currentRound}/${config.totalRounds}`
    };
  }


  private saveProgress() {
    localStorage.setItem('roundProgress', JSON.stringify(this.roundConfig()));
  }

  private loadProgress() {
    const saved = localStorage.getItem('roundProgress');
    if (saved) {
      try {
        this.roundConfig.set(JSON.parse(saved));

      } catch (e) {
        console.error('❌ Errore caricamento progresso');
      }
    }
  }
}
