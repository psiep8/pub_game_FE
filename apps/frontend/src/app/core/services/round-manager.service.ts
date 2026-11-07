import { Injectable, signal } from '@angular/core';
import { GameModeType } from '../../shared/models/game-mode-type';
import { BonusType } from '../../shared/models/bonus-type';

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
 * tempo reale di fila (Bomba, Arena, Speed Rush, Air Hockey, Black Jack), mai
 * due giochi a prenotazione consecutivi (Musica, Indovina chi, Ruota), la
 * Ruota esce due volte e l'Arena chiude la serata.
 *
 * Nessun atto ripete l'apertura del precedente. Il Black Jack esce tre volte,
 * una per atto, sempre nei primi tre atti: è il round che dà il momento di
 * vetrina a un tavolo alla volta.
 *
 * Conteggi concordati: 5 Quiz, 5 Musica, 2 Azzardo, 2 Arena, 3 Bomba,
 * 4 Celebrità (Indovina chi), 3 Black Jack, 4 Timeline, 2 Ruota, 2 Speed Rush,
 * 3 Time Buzzer e 5 Ultima spiaggia.
 *
 * Ultima spiaggia è fissa al penultimo round di ogni atto (7, 15, 23, 31, 39).
 * Ogni atto ha due giochi in tempo reale, mai consecutivi; i giochi a
 * prenotazione (Musica, Celebrità, Ruota) non si susseguono. Le aperture
 * cambiano di atto in atto e l'Arena chiude la serata.
 */
const ACT_DECKS: GameModeType[][] = [
  ['QUIZ', 'MUSIC', 'BLACKJACK', 'IMAGE_BLUR', 'TIMELINE', 'TIME_BUZZER', 'ULTIMA_SPIAGGIA', 'BOMBA'],
  ['AZZARDO', 'MUSIC', 'BLACKJACK', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIME_BUZZER', 'ULTIMA_SPIAGGIA', 'ARENA'],
  ['TIMELINE', 'MUSIC', 'SPEED_RUSH', 'IMAGE_BLUR', 'QUIZ', 'TIME_BUZZER', 'ULTIMA_SPIAGGIA', 'BLACKJACK'],
  ['IMAGE_BLUR', 'BOMBA', 'MUSIC', 'QUIZ', 'WHEEL_OF_FORTUNE', 'TIMELINE', 'ULTIMA_SPIAGGIA', 'SPEED_RUSH'],
  ['QUIZ', 'MUSIC', 'BOMBA', 'IMAGE_BLUR', 'AZZARDO', 'TIMELINE', 'ULTIMA_SPIAGGIA', 'ARENA'],
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
   * Dopo l'atto 1 il Casino (quattro manche a difficoltà crescente), dopo il
   * 2 il Basket, dopo il 3 il Cavallo di Battaglia e dopo il 4 le Biglie.
   * Dopo il quinto atto non c'è bonus: si chiude con la classifica finale.
   */
  bonusAfterAct(): BonusType | null {
    switch (this.getCurrentAct()) {
      case 0:
        return 'CASINO';
      case 1:
        return 'BASKET';
      case 2:
        return 'CAVALLO';
      case 3:
        return 'BIGLIE';
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
