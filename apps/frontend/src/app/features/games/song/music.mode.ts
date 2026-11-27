import {GameModeBase} from '../../../shared/models/game-mode-base.class';
import {GameModeResult, GameModeType} from '../../../shared/models/game-mode-type';
import {GAME_TIMINGS} from '../../../shared/models/game-timings';
import {signal} from '@angular/core';
import {musicPointsFor} from '../../../shared/models/scoring-rules';

/**
 * Un round di Musica: cinque manche (cinque brani) tutte sullo stesso tema.
 *
 * La difficoltà viene da QUANTA musica si ascolta, non da come suona:
 *   1° ascolto  4 secondi  → finestra di prenotazione 5 secondi, audio fermo
 *   2° ascolto  12 secondi da zero → finestra di prenotazione 5 secondi
 *   reveal      8 secondi di brano pulito con titolo, artista, anno, copertina
 *
 * I quattro round della partita sono quattro round della scaletta: questo
 * mode non li fa girare in serie. Tema e brani arrivano dal server, che tiene
 * nello stato della partita il sacchetto dei temi e i brani già suonati.
 */
const MANCHES = GAME_TIMINGS.MUSIC.manches;
const LISTEN_SECONDS = GAME_TIMINGS.MUSIC.listenSeconds;
const BUZZ_SECONDS = GAME_TIMINGS.MUSIC.buzzSeconds;
const REVEAL_SECONDS = GAME_TIMINGS.MUSIC.revealSeconds;

type MusicPhase = 'IDLE' | 'LISTEN' | 'BUZZ' | 'REVEAL';

interface MusicSong {
  title?: string;
  artist?: string;
  year?: string;
  previewUrl?: string;
  albumCover?: string;
  /** Secondi da cui far partire la clip (M-05): zero se non serve. */
  startAt?: number;
}

export class MusicMode extends GameModeBase {
  readonly type: GameModeType = 'MUSIC';
  readonly timerDuration = BUZZ_SECONDS;
  readonly requiresBubbles = true;
  readonly requiresBuzz = true;

  private mancheIndex = 0;
  private listenIndex = 1;
  private phase: MusicPhase = 'IDLE';
  private phaseSeconds = 0;
  private phaseEndHandler: (() => void) | null = null;
  private phaseTimeout?: ReturnType<typeof setTimeout>;
  private countdown?: ReturnType<typeof setInterval>;

  private roundNumber = 1;
  private theme = '';
  private songs: MusicSong[] = [];
  private wrongPlayers: string[] = [];

  private readonly audioPlaying = signal(false);

  protected onInitialize(): void {
    this.stopAllTimers();
    this.mancheIndex = 0;
    this.listenIndex = 1;
    this.phase = 'IDLE';
    this.phaseSeconds = 0;
    this.wrongPlayers = [];
    this.audioPlaying.set(false);
    this.roundNumber = Math.max(1, Number(this.payload?.round) || 1);
    this.theme = String(this.payload?.theme ?? '').trim();
    const songs = Array.isArray(this.payload?.songs) ? this.payload.songs : [];
    this.songs = songs.slice(0, MANCHES);
  }

  protected async onStart(): Promise<void> {
    this.isActive.set(true);
    this.revealed.set(false);
    this.startManche(1);
  }

  // ------------------------------------------------------------ Stato manche

  private startManche(manche: number): void {
    if (manche > MANCHES || manche < 1) {
      this.closeRound();
      return;
    }

    this.mancheIndex = manche;
    this.listenIndex = 1;
    this.wrongPlayers = [];
    this.buzzedPlayer.set(null);
    this.revealed.set(false);
    this.isActive.set(true);
    this.startListen(1);
  }

  private startListen(listen: number): void {
    this.listenIndex = listen;
    const seconds = LISTEN_SECONDS[Math.min(LISTEN_SECONDS.length, Math.max(1, listen)) - 1];
    this.startPhase('LISTEN', seconds, () => this.startBuzzWindow(), true);
  }

  /** Audio fermo: la finestra in cui i telefoni possono prenotarsi. */
  private startBuzzWindow(): void {
    if (this.revealed()) return;
    this.buzzedPlayer.set(null);
    this.startPhase('BUZZ', BUZZ_SECONDS, () => {
      if (this.listenIndex < LISTEN_SECONDS.length) {
        this.startListen(this.listenIndex + 1);
      } else {
        this.startReveal();
      }
    }, false);
  }

  private startReveal(): void {
    this.revealed.set(true);
    this.isActive.set(false);
    this.buzzedPlayer.set(null);
    this.startPhase('REVEAL', REVEAL_SECONDS, () => this.finishManche(), true);
  }

  /** Fine del reveal: manca successiva, oppure il round si chiude. */
  private finishManche(): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    if (this.mancheIndex >= MANCHES) {
      this.closeRound();
      return;
    }
    this.startManche(this.mancheIndex + 1);
  }

  private closeRound(): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    this.phase = 'IDLE';
    this.revealed.set(true);
    this.isActive.set(false);
    this.saveCheckpoint();
    this.broadcast();
    this.config.onTimerEnd?.();
  }

  private startPhase(kind: MusicPhase, seconds: number, end: () => void, audio: boolean): void {
    this.stopAllTimers();
    this.phase = kind;
    this.phaseSeconds = Math.max(1, seconds);
    this.phaseEndHandler = end;
    this.timer.set(this.phaseSeconds);
    this.config.onTimerTick?.(this.phaseSeconds);
    this.audioPlaying.set(audio);
    this.schedulePhase(this.phaseSeconds, end);
    this.saveCheckpoint();
    this.broadcast();
  }

  private schedulePhase(seconds: number, end: () => void): void {
    this.stopClock();
    if (seconds <= 0) {
      end();
      return;
    }
    this.phaseEndHandler = end;
    this.countdown = setInterval(() => {
      if (this.isPaused()) return;
      const next = Math.max(0, this.timer() - 1);
      this.timer.set(next);
      this.config.onTimerTick?.(next);
    }, 1000);
    this.phaseTimeout = setTimeout(() => {
      this.stopClock();
      end();
    }, seconds * 1000);
  }

  private stopClock(): void {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = undefined;
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    this.phaseTimeout = undefined;
  }

  private stopAllTimers(): void {
    this.stopClock();
  }

  // ------------------------------------------------------------ Prenotazione

  override canBuzz(): boolean {
    return this.isActive()
      && this.phase === 'BUZZ'
      && !this.buzzedPlayer()
      && !this.revealed();
  }

  override handleBuzz(playerName: string): void {
    // Una prenotazione per squadra per manca: chi ha già sbagliato rientra
    // alla manca successiva, non può riprovare sullo stesso brano.
    if (this.hasWrong(playerName)) return;
    if (!this.canBuzz()) return;
    super.handleBuzz(playerName);
  }

  protected onBuzz(_playerName: string): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    this.saveCheckpoint();
    this.broadcast();
  }

  protected onPause(): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    this.saveCheckpoint();
  }

  protected onResume(): void {
    // Il cronometro è della fase, non quello della modalità base.
    this.stopTimer();
    if (this.phase === 'IDLE') {
      this.saveCheckpoint();
      return;
    }
    if (this.buzzedPlayer()) {
      this.saveCheckpoint();
      return;
    }
    const end = this.phaseEndHandler;
    if (end) {
      const remaining = Math.max(1, this.timer());
      this.audioPlaying.set(this.phase === 'LISTEN' || this.phase === 'REVEAL');
      this.schedulePhase(remaining, end);
    }
    this.saveCheckpoint();
  }

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {
    // Nessuna risposta da tastiera: si prenota e si parla col presentatore.
  }

  protected validateAnswer(_answer: any, timeMs: number): any {
    return {isCorrect: false, points: 0, timeMs};
  }

  protected onConfirmCorrect(_result: GameModeResult): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    // Il reveal parte subito, pulito, senza intro filtrata.
    this.startReveal();
  }

  protected onConfirmWrong(result: GameModeResult): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    this.markWrong(result.playerName);
    this.buzzedPlayer.set(null);
    if (this.listenIndex < LISTEN_SECONDS.length) {
      // Sbagliare al primo ascolto non toglie punti e non chiude la manca:
      // passa al secondo ascolto, gli altri possono ancora prenotarsi.
      this.startListen(this.listenIndex + 1);
    } else {
      this.startReveal();
    }
  }

  protected onStop(): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
  }

  protected onCleanup(): void {
    this.stopAllTimers();
    this.audioPlaying.set(false);
    this.mancheIndex = 0;
    this.phase = 'IDLE';
    this.wrongPlayers = [];
    this.songs = [];
  }

  protected async onTimeout(): Promise<void> {
    this.closeRound();
  }

  /** Il presentatore anticipa la manca successiva (dock TV / admin). */
  nextManche(): void {
    if (this.buzzedPlayer()) return;
    this.finishManche();
  }

  hasNextManche(): boolean {
    return this.mancheIndex < MANCHES;
  }

  // ---------------------------------------------------------------- Punti

  /**
   * 200 al primo ascolto, 100 al secondo. Sbagliare al primo vale 0 (blocca
   * solo quell'ascolto), sbagliare al secondo costa 50.
   */
  protected calculatePoints(isCorrect: boolean): number {
    return musicPointsFor(this.listenIndex, isCorrect);
  }

  // ------------------------------------------------------------- Ripresa TV

  /**
   * Riprende round, manca, ascolto e secondi salvati: un refresh della TV a
   * metà round non ricomincia la manca.
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const state = checkpoint?.state ?? {};
    const manche = Math.floor(Number(state.manche));
    if (!Number.isFinite(manche) || manche < 1) return;

    this.mancheIndex = Math.min(MANCHES, manche);
    this.roundNumber = Math.max(1, Number(state.round) || this.roundNumber);
    this.theme = String(state.theme ?? this.theme).trim();
    this.wrongPlayers = Array.isArray(state.wrongPlayers)
      ? state.wrongPlayers.map((name: unknown) => String(name))
      : [];
    this.isActive.set(true);
    this.isPaused.set(false);

    const savedPhase = String(state.phase ?? 'LISTEN') as MusicPhase;
    this.phase = ['LISTEN', 'BUZZ', 'REVEAL'].includes(savedPhase) ? savedPhase : 'LISTEN';
    const listen = Math.floor(Number(state.listen));
    this.listenIndex = listen === 2 ? 2 : 1;

    const elapsed = Math.max(0, Math.floor((Date.now() - Number(state.savedAt || 0)) / 1000));
    const savedSeconds = Number(state.secondsLeft);
    const fallback = this.phase === 'LISTEN'
      ? LISTEN_SECONDS[this.listenIndex - 1]
      : this.phase === 'REVEAL' ? REVEAL_SECONDS : BUZZ_SECONDS;
    const phaseSeconds = this.phase === 'LISTEN'
      ? LISTEN_SECONDS[this.listenIndex - 1]
      : this.phase === 'REVEAL' ? REVEAL_SECONDS : BUZZ_SECONDS;
    const remaining = Math.max(
      0,
      Math.round((Number.isFinite(savedSeconds) ? Math.min(phaseSeconds, savedSeconds) : fallback) - elapsed),
    );

    this.phaseSeconds = phaseSeconds;
    this.timer.set(remaining);
    this.config.onTimerTick?.(remaining);

    const buzzed = String(state.buzzedPlayer ?? '').trim();
    if (buzzed) this.buzzedPlayer.set(buzzed);

    if (state.revealed === true && this.phase === 'IDLE') {
      this.revealed.set(true);
      this.isActive.set(false);
      this.broadcast();
      return;
    }

    if (this.phase === 'REVEAL') this.revealed.set(true);
    if (this.buzzedPlayer()) {
      this.audioPlaying.set(false);
      this.broadcast();
      return;
    }

    const end = this.phase === 'LISTEN'
      ? () => this.startBuzzWindow()
      : this.phase === 'BUZZ'
        ? () => (this.listenIndex < LISTEN_SECONDS.length ? this.startListen(this.listenIndex + 1) : this.startReveal())
        : () => this.finishManche();
    this.phaseEndHandler = end;
    this.audioPlaying.set(this.phase === 'LISTEN' || this.phase === 'REVEAL');
    this.schedulePhase(remaining, end);
    this.broadcast();
  }

  private saveCheckpoint(): void {
    this.config.onTvCheckpoint?.({
      type: this.type,
      revision: Date.now(),
      state: {
        round: this.roundNumber,
        theme: this.theme,
        manche: this.mancheIndex,
        listen: this.listenIndex,
        phase: this.phase,
        secondsLeft: this.timer(),
        savedAt: Date.now(),
        buzzedPlayer: this.buzzedPlayer(),
        wrongPlayers: [...this.wrongPlayers],
        revealed: this.revealed(),
      },
    });
  }

  private broadcast(): void {
    this.config.onBroadcast?.({
      action: 'MUSIC_PHASE',
      state: this.getDisplayData(),
    });
  }

  // ------------------------------------------------------------------ Vista

  private currentSong(): MusicSong {
    return this.songs[this.mancheIndex - 1] ?? {};
  }

  private nextSong(): MusicSong {
    return this.songs[this.mancheIndex] ?? {};
  }

  private hasWrong(playerName: string): boolean {
    const key = playerName.trim().toLowerCase();
    return this.wrongPlayers.some((name) => name.trim().toLowerCase() === key);
  }

  private markWrong(playerName: string): void {
    if (!playerName || this.hasWrong(playerName)) return;
    this.wrongPlayers = [...this.wrongPlayers, playerName];
  }

  private listenValue(): number {
    return this.listenIndex === 1 ? 200 : 100;
  }

  private label(): string {
    if (this.mancheIndex < 1) return '';
    const listen = this.listenIndex === 1 ? '1° ascolto' : '2° ascolto';
    if (this.phase === 'REVEAL' || this.revealed()) {
      return `Round ${this.roundNumber} · manca ${this.mancheIndex} di ${MANCHES} · reveal`;
    }
    return `Round ${this.roundNumber} · manca ${this.mancheIndex} di ${MANCHES} · ${listen} · ${this.listenValue()} punti`;
  }

  getDisplayData() {
    const song = this.currentSong();
    const revealed = this.isRevealed();
    return {
      question: 'Indovina la canzone!',
      round: this.roundNumber,
      theme: this.theme,
      themes: Array.isArray(this.payload?.themes) ? this.payload.themes : [],

      manche: this.mancheIndex,
      mancheTotal: MANCHES,
      listen: this.listenIndex,
      listenSeconds: LISTEN_SECONDS,
      phase: this.phase,
      phaseSeconds: this.phaseSeconds,
      timer: this.timer(),
      points: this.listenValue(),
      label: this.label(),

      // L'audio parte sempre da zero: l'offset serve solo alla ripresa della TV.
      audioPlaying: this.audioPlaying(),
      audioOffset: this.phase === 'LISTEN' || this.phase === 'REVEAL'
        ? Math.max(0, this.phaseSeconds - this.timer())
        : 0,
      previewUrl: song.previewUrl ?? '',
      startAt: Math.max(0, Number(song.startAt) || 0),
      nextPreviewUrl: this.nextSong().previewUrl ?? '',
      albumCover: song.albumCover ?? '',
      songTitle: revealed ? song.title ?? '' : '',
      artist: revealed ? song.artist ?? '' : '',
      year: revealed ? song.year ?? '' : '',

      buzzing: this.phase === 'BUZZ',
      buzzedPlayer: this.buzzedPlayer(),
      wrongPlayers: [...this.wrongPlayers],
      revealed,
    };
  }
}
