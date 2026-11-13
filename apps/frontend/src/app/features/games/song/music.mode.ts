import {GameModeBase} from '../../../shared/models/game-mode-base.class';
import {GameModeResult, GameModeType} from '../../../shared/models/game-mode-type';
import {GAME_TIMINGS} from '../../../shared/models/game-timings';
import {signal} from '@angular/core';

/** Quattro manche da trenta secondi: il timer è della manche, non del round. */
const MANCHES = GAME_TIMINGS.MUSIC.manches;
const MANCHE_SECONDS = GAME_TIMINGS.MUSIC.mancheSeconds;
/** Punti del brano: valore pieno con tutta la manche davanti. */
const FULL_POINTS = 1000;
/** Anche all'ultimo secondo una risposta giusta paga: non si resta a zero. */
const MIN_CORRECT_POINTS = 250;

export class MusicMode extends GameModeBase {
  protected override onAnswer(playerName: string, answer: any, result: any): void {
    
  }

  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = MANCHE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentManche = 0;
  private mancheTimer: any;
  private mancheCountdown?: ReturnType<typeof setInterval>;
  private audioPlaying = false;
  private fullPlayback = signal(false);
  private revealIntro = false;
  private introTimer?: ReturnType<typeof setTimeout>;

  /** Manche ascoltata fino in fondo: si aspetta il via dell'admin. */
  private waitingForStart = signal(false);

  protected onInitialize(): void {
    this.currentManche = 0;
    this.audioPlaying = false;
    this.revealIntro = false;
    this.fullPlayback.set(false);
  }

  protected async onStart(): Promise<void> {
    // Il conto alla rovescia è quello della manche: parte da 30 secondi e si
    // riazzera a ogni ascolto, non un unico conto da 200 per tutto il round.
    this.isActive.set(true);
    this.startManche(1);
  }

  private startManche(mancheNumber: number) {
    if (mancheNumber > MANCHES) {
      
      this.onTimeout();
      return;
    }

    this.currentManche = mancheNumber;
    this.revealIntro = false;
    this.fullPlayback.set(false);
    this.waitingForStart.set(false);
    this.timer.set(MANCHE_SECONDS);
    this.config.onTimerTick?.(MANCHE_SECONDS);
    this.startMancheCountdown();
    this.playAudio();

    // Fine dell'ascolto: la traccia si ferma, si vede la pausa e dopo 10
    // secondi la manche successiva parte da sola (l'admin può comunque
    // anticiparla col comando "prossima manche").
    this.mancheTimer = setTimeout(() => {
      if (this.buzzedPlayer()) return;
      this.pauseAudio();
      this.waitingForStart.set(true);
      this.broadcast();
      this.introTimer = setTimeout(() => {
        if (this.buzzedPlayer() || this.revealed()) return;
        this.nextManche();
      }, 10000);
    }, 30000);
  }

  /** Via alla manche successiva, su comando dell'admin. */
  nextManche(): void {
    if (this.buzzedPlayer() || this.revealed()) return;

    if (this.currentManche >= MANCHES) {
      void this.onTimeout();
      return;
    }

    this.startManche(this.currentManche + 1);
  }

  private broadcast(): void {
    this.config.onBroadcast?.({
      action: 'MUSIC_PHASE',
      state: this.getDisplayData(),
    });
  }

  protected onPause(): void {
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onResume(): void {
    if (this.currentManche > 0) {
      this.playAudio();
      this.startMancheCountdown();
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
    this.revealIntro = false;
    if (this.introTimer) clearTimeout(this.introTimer);
    this.fullPlayback.set(false);
  }

  protected async onTimeout(): Promise<void> {
    
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  protected onBuzz(playerName: string): void {
    
    this.stopAllTimers();
    this.pauseAudio();
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    // Reveal in due tempi: 4 secondi di intro a basso volume, poi la canzone
    // riparte da capo a volume pieno per 30 secondi, senza filtri.
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);
    this.revealIntro = true;
    this.fullPlayback.set(false);
    this.playAudio();

    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => {
      this.revealIntro = false;
      this.currentManche = MANCHES;
      this.fullPlayback.set(true);
      this.playAudio();
    }, 4000);
  }

  protected onConfirmWrong(result: GameModeResult): void {
    this.revealIntro = false;
    if (this.introTimer) clearTimeout(this.introTimer);
    this.fullPlayback.set(false);

    setTimeout(() => {
      if (this.currentManche > 0) {
        this.playAudio();
      }
    }, 1000);
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return {isCorrect: false, points: 0, timeMs};
  }

  /** Il brano vale in proporzione ai secondi rimasti: minimo garantito 250. */
  protected calculatePoints(isCorrect: boolean, _elapsedMs: number): number {
    if (!isCorrect) return -FULL_POINTS;
    const secondsLeft = Math.max(0, Math.min(MANCHE_SECONDS, this.timer()));
    return Math.max(
      MIN_CORRECT_POINTS,
      Math.round((FULL_POINTS / MANCHE_SECONDS) * secondsLeft)
    );
  }

  private startMancheCountdown(): void {
    this.stopMancheCountdown();
    this.mancheCountdown = setInterval(() => {
      if (this.isPaused() || this.buzzedPlayer() || this.revealed()) return;
      const next = Math.max(0, this.timer() - 1);
      this.timer.set(next);
      this.config.onTimerTick?.(next);
    }, 1000);
  }

  private stopMancheCountdown(): void {
    if (this.mancheCountdown) clearInterval(this.mancheCountdown);
    this.mancheCountdown = undefined;
  }

  private playAudio(): void {
    this.audioPlaying = true;
    
  }

  private pauseAudio(): void {
    this.audioPlaying = false;
    
  }

  private stopAllTimers(): void {
    this.stopMancheCountdown();
    if (this.introTimer) {
      clearTimeout(this.introTimer);
      this.introTimer = undefined;
    }
    if (this.mancheTimer) {
      clearTimeout(this.mancheTimer);
      this.mancheTimer = null;
    }
  }

  getDisplayData() {
    return {
      question: 'Indovina la canzone!',
      songTitle: this.payload.songTitle,
      artist: this.payload.artist,
      previewUrl: this.payload.previewUrl,
      albumCover: this.payload.albumCover,

      currentPhase: this.revealIntro ? 1 : this.currentManche,
      totalPhases: MANCHES,
      mancheSeconds: MANCHE_SECONDS,
      audioPlaying: this.audioPlaying,
      fullPlayback: this.fullPlayback(),
      buzzedPlayer: this.buzzedPlayer(),

      
      waitingForStart: this.waitingForStart(),

      year: this.payload.year,
      source: this.payload.source || 'apple-music',
      revealed: this.isRevealed()
    };
  }
}
