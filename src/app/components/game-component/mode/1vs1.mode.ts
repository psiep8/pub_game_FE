// src/app/components/game/mode/1vs1.mode.ts

import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

interface Match {
  player1: string;
  player2: string;
  currentPlayer: string | null; // Chi ha buzzato
  winner: string | null;
}

export class OneVsOneMode extends GameModeBase {
  readonly type: GameModeType = '1VS1';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private match: Match | null = null;

  protected onInitialize(): void {
    // Genera match casuale
    this.match = this.generateRandomMatch();
    console.log(`⚔️ 1vs1: ${this.match.player1} VS ${this.match.player2}`);
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(10000);
  }

  protected onPause(): void {
    // Niente da fare
  }

  protected onResume(): void {
    // Niente da fare
  }

  protected onStop(): void {
    // Rivela risposta
  }

  protected onCleanup(): void {
    this.match = null;
  }

  protected onTimeout(): void {
    console.log('⏰ Tempo scaduto! Nessuno ha risposto.');
  }

  protected onBuzz(playerName: string): void {
    console.log(`⚔️ ${playerName} si è prenotato!`);

    if (!this.match) return;

    // Verifica che sia uno dei due giocatori della sfida
    if (playerName !== this.match.player1 && playerName !== this.match.player2) {
      console.warn(`⚠️ ${playerName} non è in questa sfida!`);
      return;
    }

    this.match.currentPlayer = playerName;
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    // Non usato (buzz mode)
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    if (!this.match) return;

    console.log(`✅ ${result.playerName} ha vinto la sfida!`);
    this.match.winner = result.playerName;
  }

  protected onConfirmWrong(result: GameModeResult): void {
    if (!this.match) return;

    console.log(`❌ ${result.playerName} ha sbagliato!`);

    // L'altro giocatore ha chance con le 3 opzioni rimaste
    const opponent = result.playerName === this.match.player1
      ? this.match.player2
      : this.match.player1;

    console.log(`🎯 ${opponent} può ora rispondere (vocalmente)`);

    // Reset buzzed player per permettere all'avversario di rispondere
    this.buzzedPlayer.set(null);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return { isCorrect: false };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTimeMs = this.timerDuration * 1000;
    const decayRatio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    if (isCorrect) {
      return Math.round(1500 * decayRatio); // Bonus 1vs1
    } else {
      return Math.round(-500 * decayRatio);
    }
  }

  /**
   * 🎲 Genera match casuale tra giocatori
   */
  private generateRandomMatch(): Match {
    // TODO: Ottieni lista giocatori dal LeaderboardService
    // Per ora mock
    const players = ['Mario', 'Luigi', 'Peach', 'Toad', 'Yoshi', 'Bowser'];

    const shuffled = players.sort(() => Math.random() - 0.5);

    return {
      player1: shuffled[0],
      player2: shuffled[1],
      currentPlayer: null,
      winner: null
    };
  }

  getDisplayData() {
    return {
      question: this.payload.question || 'Domanda Quiz 1vs1',
      options: this.payload.options || [],
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null,

      // Match info
      match: this.match,
      player1: this.match?.player1,
      player2: this.match?.player2,
      currentPlayer: this.match?.currentPlayer,
      buzzedPlayer: this.buzzedPlayer()
    };
  }
}
