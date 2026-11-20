/**
 * Orologio e attese che si fermano con la pausa della TV.
 *
 * Bonus e Biglie hanno ognuno il proprio conto alla rovescia e le proprie
 * attese: senza un punto solo, ciascuno doveva ricordarsi di fermare
 * intervalli, timeout e animazioni. Qui la pausa è una cosa sola: `setPaused`
 * ferma il cronometro e le attese, e alla ripresa li riarma da dove erano,
 * senza cambiare tempi, regole o esiti. La scheda nascosta vale come una
 * pausa senza cartello: ferma le stesse cose, così un bonus o una fase non
 * finiscono mentre nessuno guarda la TV. Gli agganci `suspend`/`resume`
 * servono alle animazioni proprie (la ruota del Casino, il loop della corsa),
 * che non sono né un intervallo né un timeout.
 */

/** Attesa in corso: il tempo residuo si conserva attraverso la pausa. */
interface PausableTimer {
  id?: ReturnType<typeof setTimeout>;
  action: () => void;
  remaining: number;
  startedAt: number;
}

export interface TvPauseHooks {
  /** Ferma un'animazione propria, per esempio un `requestAnimationFrame`. */
  suspend?: () => void;
  /** Riarma l'animazione fermata da `suspend`. */
  resume?: () => void;
}

export class TvPause {
  private paused = false;
  /** Scheda nascosta: ferma come la pausa, ma la TV non mostra il cartello. */
  private hidden = false;
  /** Stato effettivo già applicato: gli agganci scattano solo sul cambio. */
  private stopped = false;
  private clock?: ReturnType<typeof setInterval>;
  private tick?: () => boolean;
  private timers: PausableTimer[] = [];

  constructor(private readonly hooks: TvPauseHooks = {}) {
    if (typeof document === 'undefined') return;
    this.hidden = document.hidden === true;
    this.stopped = this.hidden;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Pausa del presentatore o scheda nascosta: in entrambi i casi è fermo. */
  get isSuspended(): boolean {
    return this.paused || this.hidden;
  }

  setPaused(value: boolean): void {
    const next = value === true;
    if (next === this.paused) return;
    this.paused = next;
    this.sync();
  }

  /**
   * Cronometro da un secondo. `tick` restituisce false quando ha finito: il
   * cronometro si ferma e la pausa non lo riarma più.
   */
  startClock(tick: () => boolean): void {
    this.clearClock();
    this.tick = tick;
    if (!this.isSuspended) this.armClock();
  }

  clearClock(): void {
    this.stopClock();
    this.tick = undefined;
  }

  /** Attesa che la pausa può fermare; il ritorno la annulla. */
  later(ms: number, action: () => void): () => void {
    const timer: PausableTimer = { action, remaining: ms, startedAt: 0 };
    this.timers.push(timer);
    if (!this.isSuspended) this.armTimer(timer);
    return () => this.cancelTimer(timer);
  }

  /** Chiusura del componente: niente più tick, attese né ascolto della scheda. */
  dispose(): void {
    this.clearClock();
    for (const timer of this.timers) {
      if (timer.id) clearTimeout(timer.id);
    }
    this.timers = [];
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private readonly onVisibilityChange = (): void => {
    const hidden = typeof document !== 'undefined' && document.hidden === true;
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.sync();
  };

  /** Applica lo stato effettivo una volta sola, anche se pausa e scheda si sommano. */
  private sync(): void {
    const stopped = this.isSuspended;
    if (stopped === this.stopped) return;
    this.stopped = stopped;
    if (stopped) {
      this.hooks.suspend?.();
      this.stopClock();
      this.pauseTimers();
      return;
    }
    this.armClock();
    this.resumeTimers();
    this.hooks.resume?.();
  }

  private armClock(): void {
    const tick = this.tick;
    if (!tick || this.clock) return;
    const id = setInterval(() => {
      if (tick()) return;
      // Il tick può aver già avviato il cronometro successivo: in quel caso
      // questo non è più quello da fermare.
      if (this.clock === id) this.clearClock();
    }, 1000);
    this.clock = id;
  }

  private stopClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private armTimer(timer: PausableTimer): void {
    timer.startedAt = Date.now();
    timer.id = setTimeout(() => {
      this.timers = this.timers.filter((entry) => entry !== timer);
      timer.action();
    }, timer.remaining);
  }

  private cancelTimer(timer: PausableTimer): void {
    if (timer.id) clearTimeout(timer.id);
    this.timers = this.timers.filter((entry) => entry !== timer);
  }

  private pauseTimers(): void {
    const now = Date.now();
    for (const timer of this.timers) {
      if (!timer.id) continue;
      clearTimeout(timer.id);
      timer.id = undefined;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    }
  }

  private resumeTimers(): void {
    for (const timer of this.timers) {
      if (!timer.id) this.armTimer(timer);
    }
  }
}
