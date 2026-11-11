import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../../shared/models/game-mode-type';
import { BonusType } from '../../shared/models/bonus-type';
import {
  ACT_DECKS,
  BONUS_AFTER_ACT,
  DETAILED_LEADERBOARD_ROUNDS,
  QUICK_LEADERBOARD_ROUNDS,
  ROUNDS_PER_ACT,
  TOTAL_ROUNDS,
} from '../../shared/schedule';

export interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
}

const STORAGE_KEY = 'roundProgress';

/**
 * Scaletta della simulazione: un round per ogni gioco, senza i doppioni
 * della serata vera e senza classifiche automatiche. È attiva solo con
 * `?sim=1` e serve a provare il flusso completo in pochi minuti.
 */
const SIMULATION_DECK: GameModeType[] = [
  'QUIZ',
  'MUSIC',
  'IMAGE_BLUR',
  'WHEEL_OF_FORTUNE',
  'TIMELINE',
  'TIME_BUZZER',
  'BOMBA',
  'AIR_HOCKEY_BATTLE',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BLACKJACK',
  'ARENA',
  'SPEED_RUSH',
];

/**
 * Gestisce l'avanzamento della partita: quanti round mancano, quale modalità
 * estrarre e quando interrompere il gioco per mostrare la classifica.
 * Lo stato viene salvato in `localStorage` per sopravvivere a un refresh della TV.
 */
@Injectable({ providedIn: 'root' })
export class RoundManagerService {
  private simulation = false;
  private roundConfig = signal<RoundConfig>({
    totalRounds: TOTAL_ROUNDS,
    currentRound: 0,
    completedRounds: [],
    nextRoundType: null,
  });

  constructor() {
    this.loadProgress();
  }

  /** Attiva la scaletta ridotta della simulazione (`?sim=1`). */
  enableSimulation(): void {
    this.simulation = true;
    this.roundConfig.set({
      totalRounds: SIMULATION_DECK.length,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null,
    });
    this.saveProgress();
  }

  isSimulation(): boolean {
    return this.simulation;
  }

  /** Tipo previsto dalla scaletta per il round corrente (indice 0-based). */
  extractGameType(): GameModeType {
    const round = this.roundConfig().currentRound;
    if (this.simulation) {
      return SIMULATION_DECK[Math.min(round, SIMULATION_DECK.length - 1)];
    }
    const act = Math.min(ACT_DECKS.length - 1, Math.floor(round / ROUNDS_PER_ACT));
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

  /** Atto appena concluso (0-based). */
  getCurrentAct(): number {
    return Math.floor(this.roundConfig().currentRound / ROUNDS_PER_ACT) - 1;
  }

  /**
   * Bonus previsto dopo l'atto appena concluso, se esiste.
   *
   * Dopo l'atto 1 il Casino (quattro manche a difficoltà crescente), dopo il
   * 2 il Basket, dopo il 3 il Cavallo di Battaglia e dopo il 4 le Biglie.
   * Dopo il quinto atto non c'è bonus: si chiude con la classifica finale.
   */
  bonusAfterAct(): BonusType | null {
    const act = this.getCurrentAct();
    return act >= 0 ? BONUS_AFTER_ACT[act] ?? null : null;
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
    // La simulazione mostra solo i giochi e i quattro bonus: niente
    // classifiche automatiche che interromperebbero il flusso.
    if (this.simulation) return null;
    const round = this.roundConfig().currentRound;
    if (round === 0) return null;

    if (DETAILED_LEADERBOARD_ROUNDS.includes(round as never)) return 'DETAILED';
    if (QUICK_LEADERBOARD_ROUNDS.includes(round as never)) return 'QUICK';

    return null;
  }

  isGameOver(): boolean {
    const config = this.roundConfig();
    return config.currentRound >= config.totalRounds;
  }

  isActEnd(): boolean {
    const round = this.roundConfig().currentRound;
    return round > 0 && round % ROUNDS_PER_ACT === 0;
  }

  /**
   * Ricostruisce l'avanzamento dallo stato autorevole del server.
   *
   * <p>Il server conosce l'indice dell'ultimo round aperto; la scaletta è
   * deterministica, quindi le modalità già giocate si ricavano dai mazzi. Una
   * TV nuova o un browser ripulito ripartono dallo stesso punto della serata.</p>
   */
  restoreRound(roundNumber: number): void {
    if (this.simulation) {
      const target = Math.max(0, Math.min(SIMULATION_DECK.length, Math.trunc(roundNumber) || 0));
      this.roundConfig.set({
        totalRounds: SIMULATION_DECK.length,
        currentRound: target,
        completedRounds: SIMULATION_DECK.slice(0, target),
        nextRoundType: null,
      });
      this.saveProgress();
      return;
    }

    const target = Math.max(0, Math.min(TOTAL_ROUNDS, Math.trunc(roundNumber) || 0));
    const completedRounds: GameModeType[] = [];
    for (let index = 0; index < target; index++) {
      const act = Math.min(ACT_DECKS.length - 1, Math.floor(index / ROUNDS_PER_ACT));
      const deck = ACT_DECKS[act];
      completedRounds.push(deck[index % deck.length]);
    }

    this.roundConfig.set({
      totalRounds: TOTAL_ROUNDS,
      currentRound: target,
      completedRounds,
      nextRoundType: null,
    });
    this.saveProgress();
  }

  resetGame(): void {
    this.roundConfig.set({
      totalRounds: this.simulation ? SIMULATION_DECK.length : TOTAL_ROUNDS,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null,
    });
    if (!this.simulation) localStorage.removeItem(STORAGE_KEY);
    else this.saveProgress();
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
      // Una scaletta vecchia (es. 24 round) non deve trascinarsi dietro indici
      // fuori range: in quel caso si riparte puliti.
      if (parsed?.totalRounds !== TOTAL_ROUNDS) return;
      this.roundConfig.set(parsed);
    } catch {
      console.error('❌ Errore caricamento progresso');
    }
  }
}
