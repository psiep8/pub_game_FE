import {GameModeConfig, IGameMode} from '../interfaces/game-mode-type';

export class RouletteMode implements IGameMode {
  type: 'ROULETTE' = 'ROULETTE';
  timerDuration = 10;
  requiresBubbles = true;
  requiresBuzz = false;

  private timer: number = this.timerDuration;
  private intervalId?: any;
  private isPaused = false;
  private revealed = false;

  private playerChoices = new Map<string, string>();
  private correctAnswer: string = ''; // Inizializza o imposta in initialize
  private options: string[] = [];

  constructor(private config: GameModeConfig) {
    // Nota: Spesso è meglio spostare la logica del constructor in initialize()
    // per coerenza con le altre modalità create dalla factory.
  }

  // --- METODI MANCANTI RICHIESTI DALL'INTERFACCIA ---

  initialize(payload: any): void {
    this.correctAnswer = payload.correctAnswer || 'ROSSO';
    this.options = payload.options || [];
    this.timer = this.timerDuration;
    this.revealed = false;
    this.playerChoices.clear();
  }

  cleanup(): void {
    this.stop();
  }

  getTimerValue(): number {
    return this.timer;
  }

  canBuzz(): boolean {
    // Roulette non usa il buzz, quindi è sempre false o gestito diversamente
    return false;
  }

  // --- FINE METODI MANCANTI ---

  async start(): Promise<void> {
    // Se usi initialize(), assicurati che il timer sia resettato qui
    this.intervalId = setInterval(() => {
      if (this.isPaused) return;

      this.timer--;
      this.config.onTimerTick?.(this.timer);

      if (this.timer <= 0) {
        this.stop();
        this.config.onTimerEnd?.();
      }
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.revealed = true;
  }

  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  handleAnswer(playerName: string, answerIndex: number, responseTimeMs: number): void {
    if (answerIndex < 0 || answerIndex >= this.options.length) return;
    const chosenColor = this.options[answerIndex];
    this.playerChoices.set(playerName, chosenColor);
  }

  handleBuzz(playerName: string): void { }
  confirmCorrect(playerName: string): void { }
  confirmWrong(playerName: string): void { }

  getDisplayData(): any {
    return {
      question: 'Scegli un colore!',
      options: this.options,
      correctAnswer: this.revealed ? this.correctAnswer : null,
      playerChoices: Array.from(this.playerChoices.entries())
    };
  }

  isRevealed(): boolean {
    return this.revealed;
  }
}
