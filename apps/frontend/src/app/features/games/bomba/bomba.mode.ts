import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

const TURN_SECONDS = 20;
/** Malus della prima bomba: il server manda quello vero con l'evento. */
const BOMB_PENALTY_FALLBACK = 500;

/** Stato iniziale: la TV ha qualcosa da mostrare già prima del primo poll. */
function emptyState(): any {
  return {
    type: 'BOMBA',
    active: true,
    phase: 'TURN',
    prompt: '',
    cells: [],
    players: [],
    eliminated: [],
    penalties: {},
    turn: '',
    turnSeconds: TURN_SECONDS,
    secondsLeft: TURN_SECONDS,
    lastEvent: null,
  };
}

/**
 * Bomba: tabellone a turni, solo a malus.
 *
 * Il server tiene il tabellone, il turno corrente e la posizione delle bombe;
 * la TV fa polling e applica la penalità quando una squadra pesca una casella
 * falsa. La modalità non usa il timer della classe base: il tempo che conta è
 * quello del turno, deciso dal server.
 */
export class BombaMode extends GameModeBase {
  readonly type: GameModeType = 'BOMBA';
  readonly timerDuration = TURN_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private readonly state = signal<any>(emptyState());
  private players: string[] = [];
  private act = 1;
  private pollHandle?: ReturnType<typeof setInterval>;
  private pollBusy = false;
  private startedOnce = false;
  private ended = false;
  private lastEventSeq = 0;
  /** Cresce a ogni salvataggio: una scrittura vecchia non deve tornare indietro. */
  private revision = 0;

  protected onInitialize(): void {
    // La factory chiama initialize() prima di setConfig(): i giocatori veri
    // vanno letti in onStart, quando la configurazione è già disponibile.
    this.players = [];
    this.act = 1;
    this.startedOnce = false;
    this.ended = false;
    this.pollBusy = false;
    this.lastEventSeq = 0;
    this.revision = 0;
    this.stopPolling();
    this.state.set(emptyState());
    this.timer.set(TURN_SECONDS);
  }

  protected async onStart(): Promise<void> {
    this.players = [...(this.config.activePlayers ?? [])];
    this.act = Number(this.payload?.act) || 1;

    const api = this.config.bomba;
    if (!api) {
      console.error('Bomba: API non configurata');
      return;
    }

    this.timer.set(TURN_SECONDS);
    try {
      const initial = await api.start(this.players, this.act);
      this.startedOnce = true;
      this.applyState(initial);
      this.emitCheckpoint();
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

  /**
   * Riprende il round Bomba senza ripartire da zero.
   *
   * <p>Il tabellone, il turno e la scadenza sono già sul server: qui si adotta
   * solo la sequenza di eventi che la TV precedente aveva applicato, così la
   * penalità di una bomba non viene addebitata due volte. Un evento con
   * sequenza più alta (arrivato durante il refresh) viene invece applicato.</p>
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    if (!this.config.bomba) {
      throw new Error('Stato Bomba non ripristinabile');
    }
    const checkpoint = snapshot as { revision?: number; state?: { lastEventSeq?: number } } | null | undefined;
    const revision = checkpoint ? Number(checkpoint.revision) : 0;
    const applied = checkpoint ? Number(checkpoint.state?.lastEventSeq) : 0;
    // Senza checkpoint si riparte da zero eventi: al massimo la penalità
    // dell'ultima bomba viene riaddebitata una volta, ma il round non si perde.
    if (checkpoint && (!Number.isSafeInteger(revision) || revision <= 0)) {
      throw new Error('Stato Bomba non ripristinabile');
    }
    if (!Number.isSafeInteger(applied) || applied < 0) {
      throw new Error('Stato Bomba non ripristinabile');
    }

    this.players = [...(this.config.activePlayers ?? [])];
    this.act = Number(this.payload?.act) || 1;
    this.revision = revision;
    this.lastEventSeq = applied;
    this.startedOnce = true;
    this.ended = false;
    this.revealed.set(false);
    this.isActive.set(true);
    this.isPaused.set(false);

    const remaining = Math.max(0, Math.round(Number(secondsLeft) || 0));
    this.timer.set(remaining);
    this.config.onTimerTick?.(remaining);
    this.startPolling();
  }

  /** Salva la sequenza applicata: serve a non raddoppiare una penalità al refresh. */
  private emitCheckpoint(): void {
    const save = this.config.onTvCheckpoint;
    if (!save || this.ended) return;
    this.revision++;
    save({ type: this.type, revision: this.revision, state: { lastEventSeq: this.lastEventSeq } });
  }

  protected override startTimer(): void {
    // Il timer del turno è quello del server: niente setInterval locale.
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
    this.revision = 0;
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

    const event = next.lastEvent;
    const seq = Number(event?.seq) || 0;
    if (seq > this.lastEventSeq) {
      this.lastEventSeq = seq;
      // Bomba scelta o turno scaduto: la penalità arriva subito con l'evento,
      // non a fine ondata. Gli esiti di gioco restano comunque nascosti.
      if ((event?.kind === 'bomb' || event?.kind === 'eliminated') && event?.player) {
        this.applyBombPenalty(String(event.player), Number(event.penalty) || BOMB_PENALTY_FALLBACK);
      }
      // Anche un evento senza punti avanza la sequenza: il checkpoint resta
      // allineato e al refresh non si riapplica nulla.
      this.emitCheckpoint();
    }

    if (next.active === false && !this.ended) {
      this.ended = true;
      this.stopPolling();
      this.revealed.set(true);
      this.config.onTimerEnd?.();
    }
  }

  /**
   * Una bomba costa il malus decrescente deciso dal server (−500 alla prima),
   * ma il totale non scende sotto zero: la penalità si ferma ai punti che la
   * squadra ha davvero.
   */
  private applyBombPenalty(playerName: string, malus: number): void {
    const available = Math.max(0, Number(this.config.playerPoints?.(playerName)) || 0);
    const points = this.config.playerPoints
      ? -Math.min(malus, available)
      : -malus;
    if (points === 0) return;

    this.config.onAnswerReceived?.({
      playerName,
      points,
      isCorrect: false,
    });
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
