// src/app/components/game/modes/roulette-mode.ts
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export class RouletteMode extends GameModeBase {
  readonly type: GameModeType = 'ROULETTE';
  readonly timerDuration = 10; // 10 secondi per scegliere il colore
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private playerChoices = new Map<string, string>();
  private spinCompleted = false; // 🔥 NUOVO: traccia se lo spin è completato
  private rouletteTimerInterval?: any;

  protected onInitialize(): void {
    console.log('🎰 ROULETTE Mode inizializzato');
    console.log('🎯 Colore vincente:', this.payload.correctAnswer);
    console.log('🎨 Opzioni:', this.payload.options);
    this.spinCompleted = false; // Reset
  }

  protected async onStart(): Promise<void> {
    // FASE 1: Mostra istruzioni + tempo di scelta (10 secondi)
    console.log('⏱️ Fase scelta colore - 10 secondi');
    this.isActive.set(true);
    this.isReading.set(false); // I giocatori possono già votare

    // Custom timer per evitare che la base class chiami prematuramente 'stop()' e 'onTimerEnd()'
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
    console.log('⏸️ ROULETTE in pausa');
  }

  protected onResume(): void {
    console.log('▶️ ROULETTE ripresa');
  }

  protected onStop(): void {
    console.log('🛑 ROULETTE terminata');
    console.log('🏆 Vincitori:', this.getWinners());
  }

  protected onCleanup(): void {
    this.playerChoices.clear();
    this.spinCompleted = false;
    if (this.rouletteTimerInterval) clearInterval(this.rouletteTimerInterval);
  }

  protected onTimeout(): void {
    // Non usato più! La base class non lo chiamerà mai perché startTimer() non viene mai chiamato.
  }

  private async runRouletteSequence(): Promise<void> {
    console.log('⏰ Timer scelta terminato - FERMO TUTTO');

    // 🔥 IMPORTANTE: Ferma le votazioni
    this.isActive.set(false);

    // FASE 2: Countdown 5-1 DOPO la scelta
    console.log('⏰ Avvio countdown 5-1');
    for (let i = 5; i >= 1; i--) {
      this.preStartCountdown.set(i);
      this.config.onPreGameTick?.(i);
      await new Promise(r => setTimeout(r, 1000));
    }

    // 🔥 FIX: Resetta ESPLICITAMENTE a 0
    this.preStartCountdown.set(0);
    this.config.onPreGameTick?.(0);
    console.log('⏰ Countdown terminato, resettato a 0');

    // FASE 3: Mostra VIA!
    console.log('🚦 VIA!');
    this.showGo.set(true);
    await new Promise(r => setTimeout(r, 1500));
    this.showGo.set(false);

    console.log('🎰 La ruota gira...');

    // ✅ FIX: Aspetta che lo spin finisca (18 secondi = transizione CSS)
    await new Promise(r => setTimeout(r, 18000));

    // ✅ SOLO ADESSO (appena esce il colore vincente) segnala la fine e mostra il bottone
    console.log('🏁 FINE SPIN - Revealed = true, bottone PROSSIMO ROUND appare ora');
    this.revealed.set(true);
    this.spinCompleted = true;
    this.config.onTimerEnd?.();

    // Aspetta che il vincitore sia visibile per qualche secondo
    await new Promise(r => setTimeout(r, 3000));
  }

  protected onBuzz(playerName: string): void {
    // Non usato per roulette
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    console.log(`🎰 ${playerName} ha scelto: ${result.playerChoice}`);
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    // Non usato per roulette
  }

  protected onConfirmWrong(result: GameModeResult): void {
    // Non usato per roulette
  }

  override handleAnswer(playerName: string, answerIndex: number, responseTimeMs: number): void {
    if (answerIndex < 0 || answerIndex >= this.payload.options.length) {
      console.warn('⚠️ Indice non valido:', answerIndex);
      return;
    }

    const chosenColor = this.payload.options[answerIndex];
    this.playerChoices.set(playerName, chosenColor);

    console.log(`✅ ${playerName} → ${chosenColor}`);

    // Notifica tramite callback
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
    // Per roulette: punti fissi se vinci (non dipende dalla velocità)
    if (isCorrect) {
      return 1000; // Vincita fissa
    } else {
      return 0; // Nessuna penalità per chi perde
    }
  }

  getDisplayData() {
    return {
      question: 'Scegli un colore!',
      options: this.payload.options,
      // 🔥 SEMPRE esporre correctAnswer per permettere lo spin corretto
      correctAnswer: this.payload.correctAnswer,
      playerChoices: Array.from(this.playerChoices.entries()),
      showGo: this.showGo()
    };
  }

  // Metodo custom per roulette
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
