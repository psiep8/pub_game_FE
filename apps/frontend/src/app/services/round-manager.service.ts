import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../components/game-component/interfaces/game-mode-type';
import { BonusType } from '../components/game-component/interfaces/bonus-type';

export interface RoundConfig {
  totalRounds: number;
  currentRound: number;
  completedRounds: GameModeType[];
  nextRoundType: GameModeType | null;
}

const TOTAL_ROUNDS = 40;
const STORAGE_KEY = 'roundProgress';

/**
 * Scaletta in cinque atti da otto round.
 *
 * L'ordine è fisso e già verificato rispetto ai vincoli: mai due giochi in
 * tempo reale di fila (Bomba, Arena, Speed Rush, Air Hockey), mai due giochi a
 * prenotazione consecutivi (Musica, Indovina chi, Ruota), la Ruota esce tre
 * volte e l'Arena chiude la serata.
 *
 * Solo i primi tre atti si aprono con Quiz: gli atti 4 e 5 partono da Indovina
 * chi e dalla Ruota, così il finale non è il replay dell'atto 3.
 *
 * Cavallo di Battaglia e Time Buzzer sono round veri e propri: il Cavallo
 * compare due volte (atti 1 e 5), Time Buzzer due (atti 2 e 4). La Scommessa
 * chiude l'atto 4 subito prima dello Speed Rush.
 */
const ACT_DECKS: GameModeType[][] = [
  ['QUIZ', 'MUSIC', 'BOMBA', 'IMAGE_BLUR', 'TIMELINE', 'WHEEL_OF_FORTUNE', 'CAVALLO', 'SPEED_RUSH'],
  ['QUIZ', 'IMAGE_BLUR', 'TIMELINE', 'ARENA', 'MUSIC', 'BOMBA', 'TIME_BUZZER', 'AIR_HOCKEY_BATTLE'],
  ['QUIZ', 'BOMBA', 'TIMELINE', 'SPEED_RUSH', 'MUSIC', 'AIR_HOCKEY_BATTLE', 'WHEEL_OF_FORTUNE', 'ARENA'],
  ['IMAGE_BLUR', 'QUIZ', 'BOMBA', 'MUSIC', 'TIME_BUZZER', 'TIMELINE', 'SCOMMESSA', 'SPEED_RUSH'],
  ['WHEEL_OF_FORTUNE', 'QUIZ', 'BOMBA', 'CAVALLO', 'TIMELINE', 'AIR_HOCKEY_BATTLE', 'MUSIC', 'ARENA'],
];

/** Classifiche: rapida a metà atto, dettagliata a fine atto. */
const QUICK_LEADERBOARD_ROUNDS = [4, 12, 20, 28, 36];
const DETAILED_LEADERBOARD_ROUNDS = [8, 16, 24, 32, 40];

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

  /** Atto appena concluso (0-based). */
  getCurrentAct(): number {
    return Math.floor(this.roundConfig().currentRound / 8) - 1;
  }

  /**
   * Bonus previsto dopo l'atto appena concluso, se esiste.
   *
   * Il vecchio Casino unico è spalmato in tre varianti distanziate: roulette
   * colorata dopo l'atto 1, Basket dopo il 2, roulette numerata dopo il 3,
   * Black Jack dopo il 4. Dopo il quinto atto non c'è bonus: si chiude con la
   * classifica finale.
   */
  bonusAfterAct(): BonusType | null {
    switch (this.getCurrentAct()) {
      case 0:
        return 'ROULETTE_COLORATA';
      case 1:
        return 'BASKET';
      case 2:
        return 'ROULETTE_NUMERATA';
      case 3:
        return 'BLACKJACK';
      default:
        return null;
    }
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
      // Una scaletta vecchia (es. 24 round) non deve trascinarsi dietro indici
      // fuori range: in quel caso si riparte puliti.
      if (parsed?.totalRounds !== TOTAL_ROUNDS) return;
      this.roundConfig.set(parsed);
    } catch {
      console.error('❌ Errore caricamento progresso');
    }
  }
}
