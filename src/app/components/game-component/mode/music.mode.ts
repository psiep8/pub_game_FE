import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';
import {signal} from '@angular/core';

export class MusicMode extends GameModeBase {
  protected override onAnswer(playerName: string, answer: any, result: any): void {
    // Non serve per MUSIC (è buzz mode)
  }

  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = 200;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentManche = 0;
  private mancheTimer: any;
  private audioPlaying = false;

  // 🔥 COUNTDOWN VISIBILE (per le pause tra manches)
  private inCountdown = signal(false);
  private countdownValue = signal(0);
  private countdownTimer: any;

  protected onInitialize(): void {
    console.log('🎤 MUSIC Mode inizializzato');
    console.log('📦 Payload:', this.payload);
    this.currentManche = 0;
    this.audioPlaying = false;
  }

  protected async onStart(): Promise<void> {
    console.log('🎤 Avvio modalità MUSIC');

    // 🔥 runPreGameSequence gestisce countdown iniziale + VIA popup
    await this.runPreGameSequence(10000);

    // Avvia prima manche
    this.startManche(1);
  }

  private startManche(mancheNumber: number) {
    if (mancheNumber > 4) {
      console.log('🏁 Fine manches');
      this.onTimeout();
      return;
    }

    this.currentManche = mancheNumber;
    this.playAudio();

    console.log(`🎮 ========== MANCHE ${mancheNumber}/4 ==========`);

    // Auto-pausa dopo 30s
    this.mancheTimer = setTimeout(() => {
      if (!this.buzzedPlayer()) {
        console.log(`⏸️ Manche ${mancheNumber} terminata`);
        this.pauseAudio();

        console.log('💤 Pausa 20 secondi...');
        setTimeout(() => {
          // 🔥 Countdown 10s VISIBILE tra manches
          this.startVisibleCountdown(10, () => {
            this.startManche(mancheNumber + 1);
          });
        }, 20000);
      }
    }, 30000);
  }

  /**
   * 🔥 Countdown VISIBILE tra manches
   */
  private startVisibleCountdown(seconds: number, onComplete: () => void) {
    this.inCountdown.set(true);
    this.countdownValue.set(seconds);

    console.log(`⏰ Countdown visibile START: ${seconds}s`);

    this.countdownTimer = setInterval(() => {
      const current = this.countdownValue();
      this.countdownValue.set(current - 1);
      console.log(`⏰ Countdown: ${this.countdownValue()}`);

      if (this.countdownValue() <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.inCountdown.set(false);
        onComplete();
      }
    }, 1000);
  }

  protected onPause(): void {
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onResume(): void {
    if (this.currentManche > 0) {
      this.playAudio();
    }
  }

  protected onStop(): void {
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onCleanup(): void {
    this.stopAllTimers();
    this.pauseAudio();
    this.currentManche = 0;
    this.audioPlaying = false;
  }

  protected async onTimeout(): Promise<void> {
    console.log('⏰ TIMEOUT');
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  protected onBuzz(playerName: string): void {
    console.log(`🎤 ${playerName} BUZZ! (onBuzz chiamato)`);
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ CORRETTO: ${result.playerName}`);
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);

    setTimeout(() => {
      this.currentManche = 4;
      this.playAudio();
    }, 1000);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ SBAGLIATO: ${result.playerName}`);

    setTimeout(() => {
      if (this.currentManche > 0) {
        this.playAudio();
      }
    }, 1000);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return {isCorrect: false, points: 0, timeMs};
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (!isCorrect) return -1000;

    switch (this.currentManche) {
      case 1: return 2000;
      case 2: return 1500;
      case 3: return 1000;
      case 4: return 500;
      default: return 0;
    }
  }

  private playAudio(): void {
    this.audioPlaying = true;
    console.log(`▶️ PLAY - Manche ${this.currentManche}`);
  }

  private pauseAudio(): void {
    this.audioPlaying = false;
    console.log('⏸️ PAUSE');
  }

  private stopAllTimers(): void {
    if (this.mancheTimer) {
      clearTimeout(this.mancheTimer);
      this.mancheTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  getDisplayData() {
    return {
      question: 'Indovina la canzone!',
      songTitle: this.payload.songTitle,
      artist: this.payload.artist,
      previewUrl: this.payload.previewUrl,
      albumCover: this.payload.albumCover,

      currentPhase: this.currentManche,
      totalPhases: 4,
      audioPlaying: this.audioPlaying,
      buzzedPlayer: this.buzzedPlayer(),

      // 🔥 COUNTDOWN VISIBILE
      inCountdown: this.inCountdown(),
      countdownValue: this.countdownValue(),

      year: this.payload.year,
      source: this.payload.source || 'apple-music',
      revealed: this.isRevealed()
    };
  }
}
