import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../../shared/models/game-mode-type';
import { BonusType } from '../../shared/models/bonus-type';
import {
  ACT_DECKS,
  bonusForRound,
  DETAILED_LEADERBOARD_ROUNDS,
  planBonusSlots,
  QUICK_LEADERBOARD_ROUNDS,
  ROUNDS_PER_ACT,
  TOTAL_ROUNDS,
  type BonusSlot,
} from '../../shared/schedule';

export interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
  /** Dove cadono i cinque bonus in questa serata: round e tipo, atto per atto. */
  bonusSlots: BonusSlot[];
  /** Seme che ha scelto gli slot: un refresh non li sposta. */
  bonusSeed: number;
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
  'TENNIS_BATTLE',
  'ULTIMA_SPIAGGIA',
  'AZZARDO',
  'BLACKJACK',
  'ARENA',
  'SPEED_RUSH',
  'BIGLIE',
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
    bonusSlots: [],
    bonusSeed: 0,
  });

  constructor() {
    this.loadProgress();
    if (!this.roundConfig().bonusSlots.length && !this.simulation) this.rollBonusSlots();
  }

  /**
   * Nuova disposizione dei bonus: un seme nuovo per ogni serata. Il reset non
   * scrive subito: il progresso torna al primo salvataggio del round.
   */
  private rollBonusSlots(persist = true): void {
    const bonusSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.roundConfig.update((config) => ({
      ...config,
      bonusSeed,
      bonusSlots: planBonusSlots(bonusSeed),
    }));
    if (persist) this.saveProgress();
  }

  /** Attiva la scaletta ridotta della simulazione (`?sim=1`). */
  enableSimulation(): void {
    this.simulation = true;
    this.roundConfig.set({
      totalRounds: SIMULATION_DECK.length,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null,
      bonusSlots: [],
      bonusSeed: 0,
    });
    this.saveProgress();
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

  /**
   * Bonus previsto dopo il round appena concluso, se quel round è uno slot.
   *
   * I cinque bonus (Casino nero/rosso, Blackjack, Casino dozzina, Cavallo di
   * Battaglia e Casino numero secco) sono sparsi dentro gli atti, uno per atto:
   * il seme sceglie in quale round interno cade, e la scelta resta per tutta la
   * serata. I punti entrano in classifica alla chiusura del bonus stesso.
   */
  bonusAfterRound(): BonusType | null {
    if (this.simulation) return null;
    const config = this.roundConfig();
    return bonusForRound(config.bonusSlots, config.currentRound)?.type ?? null;
  }

  /**
   * Atto del round appena concluso (0-based): il bonus vive dentro quell'atto,
   * quindi vale anche quando il round non è l'ultimo dei suoi otto.
   */
  bonusActIndex(): number {
    const round = this.roundConfig().currentRound;
    if (round <= 0) return -1;
    return Math.min(ACT_DECKS.length - 1, Math.floor((round - 1) / ROUNDS_PER_ACT));
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
    // La simulazione mostra i giochi senza classifiche automatiche: niente
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
        bonusSlots: [],
        bonusSeed: 0,
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
      // Un refresh o una TV nuova non spostano i bonus già sorteggiati.
      bonusSlots: this.roundConfig().bonusSlots,
      bonusSeed: this.roundConfig().bonusSeed,
    });
    this.saveProgress();
  }

  resetGame(): void {
    this.roundConfig.set({
      totalRounds: this.simulation ? SIMULATION_DECK.length : TOTAL_ROUNDS,
      currentRound: 0,
      completedRounds: [],
      nextRoundType: null,
      bonusSlots: [],
      bonusSeed: 0,
    });
    if (!this.simulation) localStorage.removeItem(STORAGE_KEY);
    else this.saveProgress();
    if (!this.simulation) this.rollBonusSlots(false);
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
      this.roundConfig.set({
        ...parsed,
        bonusSlots: Array.isArray(parsed.bonusSlots) ? parsed.bonusSlots : [],
        bonusSeed: Number(parsed.bonusSeed) || 0,
      });
    } catch {
      console.error('❌ Errore caricamento progresso');
    }
  }
}
