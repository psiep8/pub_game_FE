
/*
import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

interface Match {
  player1: string;
  player2: string;
  currentPlayer: string | null; 
  winner: string | null;
}

export class OneVsOneMode extends GameModeBase {
  readonly type: GameModeType = 'ONE_VS_ONE';
  readonly timerDuration = 30;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private matches: Match[] = [];
  private currentMatchIndex = 0;

  protected onInitialize(): void {
    
    this.matches = this.generateRealMatches();

    if (this.matches.length > 0) {
      
      this.matches.forEach((match, i) => {
        
      });
    } else {
      console.warn('⚠️ Servono almeno 2 giocatori');
    }
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(10000);
  }

  protected onPause(): void {
  }

  protected onResume(): void {
  }

  protected onStop(): void {
  }

  protected onCleanup(): void {
    this.matches = [];
  }

  protected onTimeout(): void {
    
  }

  protected onBuzz(playerName: string): void {
    

    const match = this.getCurrentMatch();
    if (!match) return;

    if (playerName !== match.player1 && playerName !== match.player2) {
      console.warn(`⚠️ ${playerName} non è in questa sfida`);
      return;
    }

    match.currentPlayer = playerName;
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    const match = this.getCurrentMatch();
    if (!match) return;

    
    match.winner = result.playerName;
    this.currentMatchIndex++;
  }

  protected onConfirmWrong(result: GameModeResult): void {
    const match = this.getCurrentMatch();
    if (!match) return;

    

    const opponent = result.playerName === match.player1
      ? match.player2
      : match.player1;

    
    this.buzzedPlayer.set(null);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return {isCorrect: false};
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTimeMs = this.timerDuration * 1000;
    const ratio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    return isCorrect ? Math.round(1500 * ratio) : Math.round(-500 * ratio);
  }

  private generateRealMatches(): Match[] {
    const players = (this.config as any).activePlayers || [];

    if (players.length < 2) return [];

    const shuffled = [...players].sort(() => Math.random() - 0.5);

    const matches: Match[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      matches.push({
        player1: shuffled[i],
        player2: shuffled[i + 1],
        currentPlayer: null,
        winner: null
      });
    }

    return matches;
  }

  private getCurrentMatch(): Match | null {
    return this.matches[this.currentMatchIndex] || null;
  }

  getDisplayData() {
    const match = this.getCurrentMatch();

    return {
      question: this.payload.question || '',
      options: this.payload.options || [],
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null,
      matches: this.matches,
      currentMatch: match,
      currentMatchIndex: this.currentMatchIndex,
      totalMatches: this.matches.length,
      player1: match?.player1,
      player2: match?.player2,
      buzzedPlayer: this.buzzedPlayer()
    };
  }
}
*/
