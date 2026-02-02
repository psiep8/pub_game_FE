import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class MusicMode extends GameModeBase {
  protected override onAnswer(playerName: string, answer: any, result: any): void {
      throw new Error("Method not implemented.");
  }
  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = 160; // 10s attesa + 4x(30s+20s) = 10 + 200 = 210s totali
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  // 🎵 GESTIONE MANCHES
  private currentManche = 0; // 0 = attesa iniziale, 1-4 = manches
  private mancheTimer: any;
  private preStartTimer: any;
  private mancheStartTime = 0;

  // Stati
  private audioPlaying = false;
  private inCountdown = false;
  private countdownValue = 0;

  protected onInitialize(): void {
    console.log('🎤 MUSIC Mode inizializzato');
    console.log('🎵 Canzone:', this.payload.songTitle);
    console.log('🎨 Artista:', this.payload.artist);
    console.log('🔊 Preview URL:', this.payload.previewUrl);

    this.currentManche = 0;
    this.audioPlaying = false;
  }

  protected async onStart(): Promise<void> {
    console.log('🎤 Avvio modalità MUSIC');

    // 🔥 COUNTDOWN INIZIALE 10 SECONDI
    await this.initialCountdown();

    // 🔥 AVVIA MANCHE 1
    this.startManche(1);
  }

  /**
   * 🔥 Countdown iniziale 10 secondi
   */
  private async initialCountdown(): Promise<void> {
    console.log('⏰ Countdown iniziale 10 secondi...');
    this.inCountdown = true;

    return new Promise(resolve => {
      this.countdownValue = 10;

      const interval = setInterval(() => {
        this.countdownValue--;

        if (this.countdownValue <= 0) {
          clearInterval(interval);
          this.inCountdown = false;
          console.log('✅ Countdown completato!');
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * 🔥 AVVIA MANCHE (1-4)
   */
  private startManche(mancheNumber: number) {
    if (mancheNumber > 4) {
      console.log('🏁 Tutte le manches completate - TIMEOUT');
      this.onTimeout();
      return;
    }

    this.currentManche = mancheNumber;
    this.mancheStartTime = Date.now();
    this.playAudio();

    console.log(`🎮 MANCHE ${mancheNumber}/4 avviata`);

    // 🔥 Auto-pausa dopo 30 secondi
    this.mancheTimer = setTimeout(() => {
      if (!this.buzzedPlayer()) {
        console.log(`⏸️ Manche ${mancheNumber} completata - avvio pausa`);
        this.pauseAudio();
        this.startMancheBreak(mancheNumber + 1);
      }
    }, 30000); // 30 secondi
  }

  /**
   * 🔥 PAUSA tra manches: 20s silenziosi + 5s countdown
   */
  private startMancheBreak(nextManche: number) {
    if (nextManche > 4) {
      console.log('🏁 Fine gioco');
      this.onTimeout();
      return;
    }

    console.log(`⏸️ Pausa 20 secondi prima manche ${nextManche}`);

    // 20 secondi di pausa
    setTimeout(() => {
      console.log('⏰ Countdown 5 secondi...');
      this.inCountdown = true;
      this.countdownValue = 5;

      this.preStartTimer = setInterval(() => {
        this.countdownValue--;

        if (this.countdownValue <= 0) {
          clearInterval(this.preStartTimer);
          this.inCountdown = false;
          // 🔥 AVVIA MANCHE SUCCESSIVA
          this.startManche(nextManche);
        }
      }, 1000);

    }, 20000); // 20 secondi pausa
  }

  protected onPause(): void {
    console.log('⏸️ MUSIC in pausa');
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onResume(): void {
    console.log('▶️ MUSIC ripresa');
    // Riprendi dalla manche corrente
    if (this.currentManche > 0) {
      this.playAudio();
    }
  }

  protected onStop(): void {
    console.log('🛑 MUSIC terminata');
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
    console.log('⏰ Tempo scaduto - Nessuno ha indovinato');
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  protected onBuzz(playerName: string): void {
    console.log(`🎤 ${playerName} si è prenotato!`);
    // 🔥 FERMA TUTTO quando qualcuno buzza
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ ${result.playerName} ha indovinato!`);
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);

    // 🔥 Riproduci canzone chiara per reveal
    setTimeout(() => {
      this.currentManche = 4; // Fase 100% chiara
      this.playAudio();
    }, 1000);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ ${result.playerName} ha sbagliato`);
    // 🔥 RIPRENDI dalla manche corrente
    if (this.currentManche > 0 && this.currentManche <= 4) {
      this.startManche(this.currentManche);
    }
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return {
      isCorrect: false,
      points: 0,
      timeMs
    };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (!isCorrect) return -1000;

    // Punti basati sulla manche
    switch(this.currentManche) {
      case 1: return 2000; // Manche 1 - Difficilissimo!
      case 2: return 1500; // Manche 2 - Difficile
      case 3: return 1000; // Manche 3 - Medio
      case 4: return 500;  // Manche 4 - Facile
      default: return 0;
    }
  }

  private playAudio(): void {
    this.audioPlaying = true;
    console.log(`▶️ Audio playing - Manche ${this.currentManche}`);
  }

  private pauseAudio(): void {
    this.audioPlaying = false;
    console.log('⏸️ Audio paused');
  }

  private stopAllTimers(): void {
    if (this.mancheTimer) {
      clearTimeout(this.mancheTimer);
      this.mancheTimer = null;
    }
    if (this.preStartTimer) {
      clearInterval(this.preStartTimer);
      this.preStartTimer = null;
    }
  }

  getDisplayData() {
    return {
      question: 'Indovina la canzone!',
      songTitle: this.payload.songTitle,
      artist: this.payload.artist,
      previewUrl: this.payload.previewUrl,
      albumCover: this.payload.albumCover,

      // Stato manches
      currentPhase: this.currentManche,
      totalPhases: 4,

      // Stato audio
      audioPlaying: this.audioPlaying,
      buzzedPlayer: this.buzzedPlayer(),

      // Countdown
      inCountdown: this.inCountdown,
      countdownValue: this.countdownValue,

      // Metadati
      year: this.payload.year,
      source: this.payload.source || 'apple-music',
      revealed: this.isRevealed()
    };
  }
}
