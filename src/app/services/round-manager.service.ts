import {Injectable, signal} from '@angular/core';
import {GameModeType} from '../components/game-component/interfaces/game-mode-type';

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
    // 'QUIZ': 25,
    // 'TRUE_FALSE': 15,
    // 'WHEEL_OF_FORTUNE': 10,
    // 'MUSIC': 20,
    // 'IMAGE_BLUR': 10,
    // 'CHRONO': 5,
    // 'ROULETTE': 5,
    // 'ONE_VS_ONE': 10
    'QUIZ': 16,
    'TRUE_FALSE': 14,
    'WHEEL_OF_FORTUNE': 14,
    'MUSIC': 14,
    'IMAGE_BLUR': 14,
    'CHRONO': 14,
    'ROULETTE': 14,
    'ONE_VS_ONE': 0
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

    console.log(`🎮 Round ${config.currentRound + 1}/${config.totalRounds}: ${gameType}`);

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

    // Ogni 6 round → Classifica DETTAGLIATA
    if (round % 6 === 0) {
      console.log(`📊 Round ${round}: Mostra classifica DETTAGLIATA`);
      return 'DETAILED';
    }

    // Ogni 3 round (ma non 6) → Classifica RAPIDA
    if (round % 3 === 0) {
      console.log(`📊 Round ${round}: Mostra classifica RAPIDA`);
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
    console.log('🔄 Partita resettata');
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

  // Persistenza
  private saveProgress() {
    localStorage.setItem('roundProgress', JSON.stringify(this.roundConfig()));
  }

  private loadProgress() {
    const saved = localStorage.getItem('roundProgress');
    if (saved) {
      try {
        this.roundConfig.set(JSON.parse(saved));
        console.log('📂 Progresso caricato:', this.roundConfig());
      } catch (e) {
        console.error('❌ Errore caricamento progresso');
      }
    }
  }
}
