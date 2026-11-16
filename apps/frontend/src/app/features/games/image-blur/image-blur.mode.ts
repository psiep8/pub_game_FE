

import {signal} from '@angular/core';
import {GameModeBase} from '../../../shared/models/game-mode-base.class';
import {GAME_TIMINGS} from '../../../shared/models/game-timings';
import {GameModeResult, GameModeType} from '../../../shared/models/game-mode-type';

export class ImageBlurMode extends GameModeBase {
  readonly type: GameModeType = 'IMAGE_BLUR';
  /** Round da 60 secondi: un indizio ogni 6, fino a otto in tutto. */
  readonly timerDuration = GAME_TIMINGS.IMAGE_BLUR.seconds;
  readonly requiresBubbles = false;
  readonly requiresBuzz = true;

  private currentBlur = signal<number>(40);
  private blurInterval?: any;
  private blurElapsedSeconds = 0;

  /** Indizi biografici: uno ogni dieci secondi, senza svelare il nome. */
  private clues: string[] = [];
  private clueIndex = signal(0);
  private clueInterval?: any;

  protected onInitialize(): void {
    this.currentBlur.set(40);
    this.blurElapsedSeconds = 0;
    this.clues = Array.isArray(this.payload?.clues)
      ? this.payload.clues.map((clue: any) => String(clue)).filter((clue: string) => clue.length > 0)
      : [];
    this.clueIndex.set(0);
  }

  protected async onStart(): Promise<void> {
    
    await this.runPreGameSequence(10000);
    this.startBlurEffect();
    this.startClueEffect();
    this.saveCheckpoint();
  }

  /**
   * Riprende il round dopo un refresh: la foto e gli indizi sono nel payload,
   * quindi bastano il punto della sfocatura e l'indizio raggiunto. Il tempo
   * passato dal salvataggio si toglie dal punto salvato, non dal cronometro.
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const state = checkpoint?.state ?? {};
    const savedElapsed = Number(state.blurElapsedSeconds);
    const savedAt = Number(state.savedAt);
    const elapsed = Number.isFinite(savedElapsed) && savedElapsed >= 0
      ? savedElapsed
        + (Number.isFinite(savedAt) && savedAt > 0 ? Math.max(0, (Date.now() - savedAt) / 1000) : 0)
      : 0;

    this.blurElapsedSeconds = Math.min(this.timerDuration, Math.floor(elapsed));
    this.currentBlur.set(this.blurFor(this.blurElapsedSeconds));

    // Senza indice salvato si ricava dal tempo: un checkpoint vecchio non
    // riporta indietro gli indizi già letti.
    const rawClue = Number(state.clueIndex);
    const derived = Math.floor(this.blurElapsedSeconds / GAME_TIMINGS.IMAGE_BLUR.clueEverySeconds);
    const clue = Math.max(Number.isInteger(rawClue) && rawClue >= 0 ? rawClue : 0, derived);
    this.clueIndex.set(this.clues.length ? Math.min(this.clues.length - 1, clue) : 0);

    this.revealed.set(false);
    this.buzzedPlayer.set(null);
    this.isActive.set(true);
    this.isPaused.set(false);
    this.timer.set(Math.max(0, Math.round(Number(secondsLeft) || 0)));
    this.startTimer();
    this.startBlurEffect();
    this.startClueEffect();
  }

  /** Sfocatura per secondi trascorsi: curva non lineare, 40 → 0. */
  private blurFor(seconds: number): number {
    const progress = Math.min(1, Math.max(0, seconds / this.timerDuration));
    return Math.max(0, 40 * (1 - Math.pow(progress, 0.55)));
  }

  /** Il punto raggiunto (sfocatura e indizio) per la ripresa dopo un refresh. */
  private saveCheckpoint(): void {
    this.config.onTvCheckpoint?.({
      type: this.type,
      revision: Date.now(),
      state: {
        blurElapsedSeconds: this.blurElapsedSeconds,
        clueIndex: this.clueIndex(),
        savedAt: Date.now(),
      },
    });
  }

  protected onPause(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
  }

  protected onResume(): void {
    this.startBlurEffect();
    this.startClueEffect();
  }

  protected onStop(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
    this.currentBlur.set(0); 
  }

  protected onCleanup(): void {
    this.stopBlurEffect();
    this.stopClueEffect();
  }

  protected onTimeout(): void {
    
  }

  protected onBuzz(playerName: string): void {
    // Chi si prenota ha già la foto: gli indizi si fermano sul punto raggiunto.
    this.stopClueEffect();
    this.saveCheckpoint();
  }

  protected onAnswer(playerName: string, answer: any, result: any): void {
    
  }

  protected onConfirmCorrect(result: GameModeResult): void {
    
  }

  protected onConfirmWrong(result: GameModeResult): void {
    
  }

  protected validateAnswer(answer: any, timeMs: number): any {
    return {isCorrect: false};
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const maxTimeMs = this.timerDuration * 1000;

    
    
    const decayRatio = Math.max(0, 1 - (elapsedMs / maxTimeMs));

    if (isCorrect) {
      
      return Math.round(1000 * decayRatio);
    } else {
      
      return Math.round(-1000 * decayRatio);
    }
  }

  

  private startBlurEffect(): void {
    if (this.blurInterval) clearInterval(this.blurInterval);

    // Curva non lineare: i primi secondi tolgono più sfocatura, così la foto
    // diventa leggibile prima, ma resta velata fino agli ultimi indizi.
    this.blurInterval = setInterval(() => {
      if (this.buzzedPlayer()) return;

      this.blurElapsedSeconds = Math.min(this.timerDuration, this.blurElapsedSeconds + 1);
      this.currentBlur.set(this.blurFor(this.blurElapsedSeconds));
      if (this.blurElapsedSeconds >= this.timerDuration) this.stopBlurEffect();
    }, 1000);
  }

  private stopBlurEffect(): void {
    if (this.blurInterval) {
      clearInterval(this.blurInterval);
      this.blurInterval = undefined;
    }
  }

  private startClueEffect(): void {
    this.stopClueEffect();
    if (this.clues.length <= 1) return;

    this.clueInterval = setInterval(() => {
      if (this.buzzedPlayer()) {
        this.stopClueEffect();
        return;
      }

      const next = Math.min(this.clues.length - 1, this.clueIndex() + 1);
      if (next === this.clueIndex()) {
        this.stopClueEffect();
        return;
      }
      this.clueIndex.set(next);
      this.saveCheckpoint();
    }, GAME_TIMINGS.IMAGE_BLUR.clueEverySeconds * 1000);
  }

  private stopClueEffect(): void {
    if (this.clueInterval) {
      clearInterval(this.clueInterval);
      this.clueInterval = undefined;
    }
  }

  getDisplayData() {
    return {
      imageUrl: this.payload.imageUrl,
      blurAmount: this.currentBlur(),
      buzzedPlayer: this.buzzedPlayer(),
      clue: this.clues[this.clueIndex()] ?? null,
      clueIndex: this.clueIndex() + 1,
      clueTotal: this.clues.length,
      correctAnswer: this.revealed() ? this.payload.correctAnswer : null
    };
  }
}
