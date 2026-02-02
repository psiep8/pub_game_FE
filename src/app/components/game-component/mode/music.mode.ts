import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class MusicMode extends GameModeBase {
  protected override onAnswer(playerName: string, answer: any, result: any): void {
      throw new Error("Method not implemented.");
  }
  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = 200;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentManche = 0;
  private mancheTimer: any;
  private audioPlaying = false;
  private inCountdown = false;
  private countdownValue = 0;
  private countdownTimer: any;

  protected onInitialize(): void {
    console.log('🎤 MUSIC Mode inizializzato');
    console.log('🎵 Canzone:', this.payload.songTitle);

    this.currentManche = 0;
    this.audioPlaying = false;
  }

  protected async onStart(): Promise<void> {
    console.log('🎤 Avvio modalità MUSIC');

    // 🔥 Countdown iniziale
    this.startCountdown(10, () => {
      console.log('✅ Countdown completato → Manche 1');
      this.startManche(1);
    });
  }

  /**
   * 🔥 Countdown NON bloccante
   */
  private startCountdown(seconds: number, onComplete: () => void) {
    this.inCountdown = true;
    this.countdownValue = seconds;

    console.log(`⏰ Countdown START: ${seconds}s`);

    this.countdownTimer = setInterval(() => {
      this.countdownValue--;
      console.log(`⏰ Countdown: ${this.countdownValue}`);

      if (this.countdownValue <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.inCountdown = false;
        onComplete();
      }
    }, 1000);
  }

  /**
   * 🔥 AVVIA MANCHE
   */
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

        // Pausa 20s
        console.log('💤 Pausa 20 secondi...');
        setTimeout(() => {
          // Countdown 5s
          this.startCountdown(5, () => {
            this.startManche(mancheNumber + 1);
          });
        }, 20000);
      }
    }, 30000);
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
    console.log(`🎤 ${playerName} BUZZ!`);
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ CORRETTO: ${result.playerName}`);
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);

    // Audio chiaro per reveal
    setTimeout(() => {
      this.currentManche = 4;
      this.playAudio();
    }, 1000);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ SBAGLIATO: ${result.playerName}`);

    // Riprendi dopo 1s
    setTimeout(() => {
      if (this.currentManche > 0) {
        this.playAudio();
      }
    }, 1000);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return { isCorrect: false, points: 0, timeMs };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (!isCorrect) return -1000;

    switch(this.currentManche) {
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
    const data = {
      question: 'Indovina la canzone!',
      songTitle: this.payload.songTitle,
      artist: this.payload.artist,
      previewUrl: this.payload.previewUrl,
      albumCover: this.payload.albumCover,

      // 🔥 STATI che devono aggiornarsi
      currentPhase: this.currentManche,
      totalPhases: 4,
      audioPlaying: this.audioPlaying,
      buzzedPlayer: this.buzzedPlayer(),

      // 🔥 COUNTDOWN
      inCountdown: this.inCountdown,
      countdownValue: this.countdownValue,

      // Meta
      year: this.payload.year,
      source: this.payload.source || 'apple-music',
      revealed: this.isRevealed()
    };

    // Log per debug
    console.log('📊 DisplayData:', {
      manche: data.currentPhase,
      audioPlaying: data.audioPlaying,
      inCountdown: data.inCountdown,
      countdownValue: data.countdownValue
    });

    return data;
  }
}
