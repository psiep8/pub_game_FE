import {GameModeBase} from '../../../shared/models/game-mode-base.class';
import {GameModeResult, GameModeType} from '../../../shared/models/game-mode-type';
import {GAME_TIMINGS} from '../../../shared/models/game-timings';
import {signal} from '@angular/core';
import { MUSIC_MANCHE_POINTS } from '../../../shared/models/scoring-rules';

/** Quattro manche da trenta secondi: il timer è della manche, non del round. */
const MANCHES = GAME_TIMINGS.MUSIC.manches;
const MANCHE_SECONDS = GAME_TIMINGS.MUSIC.mancheSeconds;
/** Punti del brano per manche: 1000, 750, 500, 250. */
const MANCHE_POINTS = MUSIC_MANCHE_POINTS;

export class MusicMode extends GameModeBase {
  protected override onAnswer(_playerName: string, _answer: any, _result: any): void {

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
  /** Istante in cui la pausa fra due manche finisce da sola. */
  private waitingUntil = 0;

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
    this.waitingUntil = 0;
    this.timer.set(MANCHE_SECONDS);
    this.config.onTimerTick?.(MANCHE_SECONDS);
    this.startMancheCountdown();
    this.playAudio();
    this.saveCheckpoint();

    // Fine dell'ascolto: la traccia si ferma, si vede la pausa e dopo 10
    // secondi la manche successiva parte da sola (l'admin può comunque
    // anticiparla col comando "prossima manche").
    this.mancheTimer = setTimeout(() => this.endListening(), MANCHE_SECONDS * 1000);
  }

  /** Fine dell'ascolto: pausa di dieci secondi, poi manche successiva. */
  private endListening(): void {
    if (this.buzzedPlayer()) return;
    this.pauseAudio();
    this.waitingForStart.set(true);
    this.waitingUntil = Date.now() + 10000;
    this.broadcast();
    this.saveCheckpoint();
    this.introTimer = setTimeout(() => {
      if (this.buzzedPlayer() || this.revealed()) return;
      this.nextManche();
    }, 10000);
  }

  /**
   * Riprende il round dopo un refresh della TV: manche, secondi rimasti e
   * pausa dell'ascolto tornano come li aveva lasciati. Un brano già pagato
   * (`revealed`) si riapre solo per mostrarlo, senza ridare i punti.
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const state = checkpoint?.state ?? {};
    const manche = Math.floor(Number(state.manche));
    // Senza manche salvata non c'è nulla da riprendere: resta l'avvio normale.
    if (!Number.isFinite(manche) || manche < 1) return;

    this.currentManche = Math.min(MANCHES, manche);
    this.isActive.set(true);
    this.isPaused.set(false);
    this.revealed.set(state.revealed === true);
    this.fullPlayback.set(state.fullPlayback === true);
    this.revealIntro = false;

    const savedSeconds = Number(state.secondsLeft);
    const savedAt = Number(state.savedAt);
    const elapsed = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      : 0;
    const seconds = Number.isFinite(savedSeconds)
      ? Math.min(MANCHE_SECONDS, Math.max(0, Math.round(savedSeconds) - elapsed))
      : Math.min(MANCHE_SECONDS, Math.max(0, Math.round(Number(secondsLeft) || 0)));
    this.timer.set(seconds);
    this.config.onTimerTick?.(seconds);

    const buzzed = String(state.buzzedPlayer ?? '').trim();
    if (buzzed) this.buzzedPlayer.set(buzzed);

    if (this.revealed()) {
      this.broadcast();
      return;
    }

    if (this.buzzedPlayer()) {
      // Qualcuno aveva premuto: si aspetta la conferma, niente cronometro.
      this.pauseAudio();
      this.broadcast();
      return;
    }

    if (state.waitingForStart === true) {
      this.waitingForStart.set(true);
      const savedWait = Number(state.waitingSeconds);
      const wait = Number.isFinite(savedWait) ? Math.max(0, Math.round(savedWait) - elapsed) : 0;
      if (wait <= 0) {
        this.nextManche();
        return;
      }
      this.waitingUntil = Date.now() + wait * 1000;
      this.broadcast();
      this.introTimer = setTimeout(() => {
        if (this.buzzedPlayer() || this.revealed()) return;
        this.nextManche();
      }, wait * 1000);
      return;
    }

    this.startMancheCountdown();
    this.playAudio();
    this.broadcast();
    // L'audio riparte dall'inizio del brano, ma il conto è quello rimasto.
    this.mancheTimer = setTimeout(() => this.endListening(), seconds * 1000);
  }

  /** Stato della manche: serve a riprendere senza ricominciare il round. */
  private saveCheckpoint(): void {
    const waiting = this.waitingForStart() && this.waitingUntil > Date.now()
      ? Math.max(0, Math.round((this.waitingUntil - Date.now()) / 1000))
      : 0;
    this.config.onTvCheckpoint?.({
      type: this.type,
      revision: Date.now(),
      state: {
        manche: this.currentManche,
        secondsLeft: this.timer(),
        savedAt: Date.now(),
        waitingForStart: this.waitingForStart(),
        waitingSeconds: waiting,
        revealed: this.revealed(),
        fullPlayback: this.fullPlayback(),
        buzzedPlayer: this.buzzedPlayer(),
      },
    });
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
    this.saveCheckpoint();
  }

  protected onResume(): void {
    if (this.currentManche > 0) {
      this.playAudio();
      this.startMancheCountdown();
      if (this.waitingForStart()) {
        const wait = Math.max(0, Math.round((this.waitingUntil - Date.now()) / 1000));
        this.waitingUntil = Date.now() + wait * 1000;
        this.introTimer = setTimeout(() => {
          if (this.buzzedPlayer() || this.revealed()) return;
          this.nextManche();
        }, wait * 1000);
      } else {
        this.mancheTimer = setTimeout(
          () => this.endListening(),
          Math.max(0, this.timer()) * 1000,
        );
      }
    }
    this.saveCheckpoint();
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
    this.saveCheckpoint();
    this.config.onTimerEnd?.();
  }

  protected onBuzz(_playerName: string): void {

    this.stopAllTimers();
    this.pauseAudio();
    this.saveCheckpoint();
  }

  protected onConfirmCorrect(_result: GameModeResult): void {
    // Il messaggio di vittoria e il brano pulito devono partire insieme: una
    // intro filtrata di 4 secondi faceva sentire la canzone ancora «storta»
    // proprio dopo il corretto. Si salta direttamente alla quarta fase.
    this.stopAllTimers();
    this.pauseAudio();
    this.revealed.set(true);
    this.revealIntro = false;
    this.currentManche = MANCHES;
    this.fullPlayback.set(true);
    this.playAudio();
    this.saveCheckpoint();
  }

  protected onConfirmWrong(_result: GameModeResult): void {
    this.revealIntro = false;
    if (this.introTimer) clearTimeout(this.introTimer);
    this.fullPlayback.set(false);

    setTimeout(() => {
      if (this.currentManche > 0) {
        this.playAudio();
      }
    }, 1000);
    this.saveCheckpoint();
  }

  protected validateAnswer(_answer: any, timeMs: number): any {
    return {isCorrect: false, points: 0, timeMs};
  }

  /**
   * Il brano vale secondo la manche in cui si risponde: 1000, 750, 500, 250.
   * Chi sbaglia paga lo stesso valore in negativo.
   */
  protected calculatePoints(isCorrect: boolean, _elapsedMs: number): number {
    const index = Math.min(MANCHE_POINTS.length, Math.max(1, this.currentManche)) - 1;
    const value = MANCHE_POINTS[index];
    return isCorrect ? value : -value;
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
