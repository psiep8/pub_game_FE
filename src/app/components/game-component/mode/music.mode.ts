import {GameModeBase} from '../interfaces/game-mode-base.class';
import {GameModeResult, GameModeType} from '../interfaces/game-mode-type';

export class MusicMode extends GameModeBase {
  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = 120; // 2 minuti totali (4 fasi da 30s)
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  // 🎵 FASI AUDIO (4 livelli)
  private currentPhase = 0; // 0 = fermo, 1-4 = fasi attive
  private phaseStartTime = 0;
  private phaseDuration = 30000; // 30 secondi per fase

  // Stato audio
  private audioPlaying = false;
  private currentAudioTime = 0;

  protected onInitialize(): void {
    console.log('🎤 SONG Mode inizializzato');
    console.log('🎵 Canzone:', this.payload.songTitle);
    console.log('🎨 Artista:', this.payload.artist);
    console.log('🔊 Preview URL:', this.payload.previewUrl);

    this.currentPhase = 0;
    this.audioPlaying = false;
  }

  protected async onStart(): Promise<void> {
    console.log('🎤 Avvio modalità SONG');

    // Mostra istruzioni
    await this.runPreGameSequence(5000); // 5 secondi "Indovina la canzone!"

    // Dopo il VIA, il gioco è pronto
    // L'admin controllerà le fasi con i bottoni
    console.log('✅ SONG pronto - Admin controlla le fasi');
  }

  protected onPause(): void {
    console.log('⏸️ SONG in pausa');
    this.pauseAudio();
  }

  protected onResume(): void {
    console.log('▶️ SONG ripresa');
  }

  protected onStop(): void {
    console.log('🛑 SONG terminata');
    this.pauseAudio();
  }

  protected onCleanup(): void {
    this.pauseAudio();
    this.currentPhase = 0;
    this.audioPlaying = false;
  }

  protected async onTimeout(): Promise<void> {
    console.log('⏰ Tempo scaduto - Nessuno ha indovinato');
    this.pauseAudio();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  protected onBuzz(playerName: string): void {
    console.log(`🎤 ${playerName} si è prenotato!`);
    // Ferma l'audio quando qualcuno buzza
    this.pauseAudio();
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    console.log(`🎤 ${playerName} ha buzzato`);
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    console.log(`✅ ${result.playerName} ha indovinato!`);
    this.pauseAudio();
    this.revealed.set(true);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    console.log(`❌ ${result.playerName} ha sbagliato`);
    // L'audio può riprendere se admin vuole
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    // Non usato - la validazione è manuale dall'admin
    return {
      isCorrect: false,
      points: 0,
      timeMs
    };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    if (!isCorrect) return -1000;

    // Punti basati sulla fase in cui hanno indovinato
    switch(this.currentPhase) {
      case 1: return 2000; // Fase 25% - Difficilissimo!
      case 2: return 1500; // Fase 50% - Difficile
      case 3: return 1000; // Fase 75% - Medio
      case 4: return 500;  // Fase 100% - Facile
      default: return 0;
    }
  }

  // 🎮 CONTROLLI ADMIN (chiamati da Game Component)

  /**
   * Admin avvia fase successiva
   */
  public startNextPhase(): void {
    if (this.currentPhase >= 4) {
      console.warn('⚠️ Già alla fase finale!');
      return;
    }

    this.currentPhase++;
    this.playAudio();
    this.phaseStartTime = Date.now();

    console.log(`▶️ FASE ${this.currentPhase}/4 avviata (${this.getPhasePercentage()}%)`);

    // Auto-pausa dopo 30 secondi
    setTimeout(() => {
      if (this.audioPlaying && !this.buzzedPlayer()) {
        this.pauseAudio();
        console.log('⏸️ Fase completata - 30s scaduti');
      }
    }, this.phaseDuration);
  }

  /**
   * Admin pausa/riprende audio manualmente
   */
  public toggleAudio(): void {
    if (this.audioPlaying) {
      this.pauseAudio();
    } else {
      this.playAudio();
    }
  }

  /**
   * Admin resetta alla fase 1 (ricomincia da capo)
   */
  public resetPhases(): void {
    this.currentPhase = 0;
    this.pauseAudio();
    this.currentAudioTime = 0;
    console.log('🔄 Fasi resettate');
  }

  private playAudio(): void {
    this.audioPlaying = true;
    console.log(`▶️ Audio playing - Fase ${this.currentPhase}`);
  }

  private pauseAudio(): void {
    this.audioPlaying = false;
    console.log('⏸️ Audio paused');
  }

  /**
   * Percentuale chiarezza audio per fase corrente
   */
  private getPhasePercentage(): number {
    switch(this.currentPhase) {
      case 1: return 25;
      case 2: return 50;
      case 3: return 75;
      case 4: return 100;
      default: return 0;
    }
  }

  /**
   * Label fase corrente
   */
  private getPhaseLabel(): string {
    switch(this.currentPhase) {
      case 0: return 'In attesa...';
      case 1: return 'Fase 1 - Audio molto distorto (25%)';
      case 2: return 'Fase 2 - Audio distorto (50%)';
      case 3: return 'Fase 3 - Audio quasi chiaro (75%)';
      case 4: return 'Fase 4 - Audio chiaro (100%)';
      default: return '';
    }
  }

  getDisplayData() {
    return {
      question: 'Indovina la canzone!',
      songTitle: this.payload.songTitle,
      artist: this.payload.artist,
      previewUrl: this.payload.previewUrl,
      albumCover: this.payload.albumCover,

      // Stato fasi
      currentPhase: this.currentPhase,
      totalPhases: 4,
      phasePercentage: this.getPhasePercentage(),
      phaseLabel: this.getPhaseLabel(),

      // Stato audio
      audioPlaying: this.audioPlaying,
      buzzedPlayer: this.buzzedPlayer(),

      // Metadati
      year: this.payload.year,
      source: this.payload.source || 'deezer'
    };
  }

}
