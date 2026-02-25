
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export class RouletteMode extends GameModeBase {
  readonly type: GameModeType = 'ROULETTE';
  readonly timerDuration = 10; 
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private playerChoices = new Map<string, string>();
  private spinCompleted = false; 
  private rouletteTimerInterval?: any;

  protected onInitialize(): void {
    
    
    
    this.spinCompleted = false; 
  }

  protected async onStart(): Promise<void> {
    
    
    this.isActive.set(true);
    this.isReading.set(false); 

    
    return new Promise(resolve => {
      this.rouletteTimerInterval = setInterval(() => {
        if (this.isPaused() || !this.isActive()) return;

        const current = this.timer();
        if (current > 0) {
          this.timer.set(current - 1);
          this.config.onTimerTick?.(current - 1);
        } else {
          clearInterval(this.rouletteTimerInterval);
          this.runRouletteSequence().then(resolve);
        }
      }, 1000);
    });
  }

  protected onPause(): void {
    
  }

  protected onResume(): void {
    
  }

  protected onStop(): void {
    
    
  }

  protected onCleanup(): void {
    this.playerChoices.clear();
    this.spinCompleted = false;
    if (this.rouletteTimerInterval) clearInterval(this.rouletteTimerInterval);
  }

  protected onTimeout(): void {
    
  }

  private async runRouletteSequence(): Promise<void> {
    

    
    this.isActive.set(false);

    
    
    for (let i = 5; i >= 1; i--) {
      this.preStartCountdown.set(i);
      this.config.onPreGameTick?.(i);
      await new Promise(r => setTimeout(r, 1000));
    }

    
    this.preStartCountdown.set(0);
    this.config.onPreGameTick?.(0);
    

    
    
    this.showGo.set(true);
    await new Promise(r => setTimeout(r, 1500));
    this.showGo.set(false);

    

    
    await new Promise(r => setTimeout(r, 18000));

    
    
    this.revealed.set(true);
    this.spinCompleted = true;
    this.config.onTimerEnd?.();

    
    await new Promise(r => setTimeout(r, 3000));
  }

  protected onBuzz(playerName: string): void {
    
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    
  }

  protected onConfirmWrong(result: GameModeResult): void {
    
  }

  override handleAnswer(playerName: string, answerIndex: number, responseTimeMs: number): void {
    if (answerIndex < 0 || answerIndex >= this.payload.options.length) {
      console.warn('⚠️ Indice non valido:', answerIndex);
      return;
    }

    const chosenColor = this.payload.options[answerIndex];
    this.playerChoices.set(playerName, chosenColor);

    

    
    const result = this.validateAnswer(answerIndex, responseTimeMs);
    this.config.onAnswerReceived?.({ playerName, ...result });
  }

  protected validateAnswer(answerIndex: number, timeMs: number): any {
    const playerChoice = this.payload.options[answerIndex];
    const isCorrect = playerChoice === this.payload.correctAnswer;
    const points = this.calculatePoints(isCorrect, timeMs);

    return {
      isCorrect,
      points,
      playerChoice,
      timeMs
    };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    
    if (isCorrect) {
      return 1000; 
    } else {
      return 0; 
    }
  }

  getDisplayData() {
    return {
      question: 'Scegli un colore!',
      options: this.payload.options,
      
      correctAnswer: this.payload.correctAnswer,
      playerChoices: Array.from(this.playerChoices.entries()),
      showGo: this.showGo()
    };
  }

  
  getWinners(): string[] {
    const winners: string[] = [];
    this.playerChoices.forEach((color, playerName) => {
      if (color === this.payload.correctAnswer) {
        winners.push(playerName);
      }
    });
    return winners;
  }
}
