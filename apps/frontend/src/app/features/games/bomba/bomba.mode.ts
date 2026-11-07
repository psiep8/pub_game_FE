import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

const WAVES = 3;
const WAVE_SECONDS = 15;
const BOMB_PENALTY = 200;

/** Stato iniziale: la TV ha qualcosa da mostrare già prima del primo poll. */
function emptyState(): any {
  return {
    type: 'BOMBA',
    active: true,
    phase: 'PICK',
    wave: 1,
    waves: WAVES,
    waveSeconds: WAVE_SECONDS,
    secondsLeft: WAVE_SECONDS,
    prompt: '',
    cells: [],
    picks: [],
    hits: [],
    defused: [],
    penalties: {},
    remainingBombs: 0,
  };
}

/**
 * Bomba: gioco a tabellone, solo a malus.
 *
 * Il server tiene il tabellone, le scadenze delle ondate e la posizione delle
 * bombe; la TV fa polling e applica le penalità una sola volta per ondata,
 * quando arriva la rivelazione. La modalità non usa il timer della classe base:
 * il tempo che conta è quello dell'ondata, deciso dal server.
 */
export class BombaMode extends GameModeBase {
  readonly type: GameModeType = 'BOMBA';
  readonly timerDuration = WAVES * WAVE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private readonly state = signal<any>(emptyState());
  private players: string[] = [];
  private act = 1;
  private pollHandle?: ReturnType<typeof setInterval>;
  private pollBusy = false;
  private startedOnce = false;
  private ended = false;
  private readonly appliedWaves = new Set<number>();

  protected onInitialize(): void {
    // La factory chiama initialize() prima di setConfig(): i giocatori veri
    // vanno letti in onStart, quando la configurazione è già disponibile.
    this.players = [];
    this.act = 1;
    this.startedOnce = false;
    this.ended = false;
    this.pollBusy = false;
    this.appliedWaves.clear();
    this.stopPolling();
    this.state.set(emptyState());
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.players = [...(this.config.activePlayers ?? [])];
    this.act = Number(this.payload?.act) || 1;

    const api = this.config.bomba;
    if (!api) {
      console.error('Bomba: API non configurata');
      return;
    }

    this.timer.set(WAVE_SECONDS);
    try {
      const initial = await api.start(this.players, this.act);
      this.startedOnce = true;
      this.applyState(initial);
    } catch (error) {
      console.error('Bomba: impossibile avviare il round', error);
      this.state.set({
        ...this.state(),
        active: false,
        error: 'Impossibile avviare Bomba: servono almeno 2 squadre collegate.',
      });
    }
    this.startPolling();
  }

  protected override startTimer(): void {
    // Il timer dell'ondata è quello del server: niente setInterval locale.
  }

  protected onPause(): void {
    void this.config.bomba?.pause();
  }

  protected onResume(): void {
    void this.config.bomba?.resume();
    void this.poll();
  }

  protected onStop(): void {
    this.stopPolling();
  }

  protected onCleanup(): void {
    this.stopPolling();
    // Non resettare da qui: un reset HTTP potrebbe arrivare dopo lo start del
    // round successivo e cancellarlo. Il prossimo start rimpiazza lo stato.
    this.state.set(emptyState());
  }

  protected onTimeout(): void {
    // La fine arriva dallo stato del backend, non dal timer locale.
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollHandle = setInterval(() => void this.poll(), 400);
    void this.poll();
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  private async poll(): Promise<void> {
    if (this.pollBusy || this.ended || this.isPaused() || !this.startedOnce) {
      return;
    }

    const api = this.config.bomba;
    if (!api) return;

    this.pollBusy = true;
    try {
      this.applyState(await api.state());
    } catch (error) {
      // Un poll perso non deve fermare la partita: il prossimo recupera.
      console.warn('Bomba: stato non disponibile', error);
    } finally {
      this.pollBusy = false;
    }
  }

  private applyState(next: any): void {
    if (!next) return;

    this.state.set(next);
    const seconds = Math.max(0, Math.round(Number(next.secondsLeft) || 0));
    this.timer.set(seconds);
    this.config.onTimerTick?.(seconds);

    const wave = Number(next.wave) || 0;
    if (next.phase === 'REVEAL' && wave > 0 && !this.appliedWaves.has(wave)) {
      this.appliedWaves.add(wave);
      this.applyWavePenalties(next);
    }

    if (next.active === false && !this.ended) {
      this.ended = true;
      this.stopPolling();
      this.revealed.set(true);
      this.config.onTimerEnd?.();
    }
  }

  /**
   * Una bomba costa 200 punti alla squadra, ma il totale non scende sotto
   * zero: la penalità si ferma ai punti che la squadra ha davvero.
   */
  private applyWavePenalties(next: any): void {
    const hits = Array.isArray(next?.hits) ? next.hits : [];
    for (const hit of hits) {
      const playerName = String(hit?.player ?? '');
      if (!playerName) continue;

      const bombs = Math.max(1, Number(hit?.bombs) || 1);
      const raw = bombs * BOMB_PENALTY;
      const available = Math.max(0, Number(this.config.playerPoints?.(playerName)) || 0);
      const points = this.config.playerPoints ? -Math.min(raw, available) : -raw;
      if (points === 0) continue;

      this.config.onAnswerReceived?.({
        playerName,
        points,
        isCorrect: false,
      });
    }
  }

  getDisplayData(): any {
    return {
      ...this.state(),
      type: 'BOMBA',
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(): number {
    return 0;
  }
}
