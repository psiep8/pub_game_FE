/**
 * Orologio e attese che si fermano con la pausa della TV.
 *
 * I bonus hanno ognuno il proprio conto alla rovescia e le proprie attese:
 * senza un punto solo, ciascuno doveva ricordarsi di fermare intervalli,
 * timeout e animazioni. Qui la pausa è una cosa sola: `setPaused` ferma il
 * cronometro e le attese, e alla ripresa li riarma da dove erano, senza
 * cambiare tempi, regole o esiti. Gli agganci `suspend`/`resume` servono alle
 * animazioni proprie (la ruota del Casino), che non sono né un intervallo né
 * un timeout.
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
  private clock?: ReturnType<typeof setInterval>;
  private tick?: () => boolean;
  private timers: PausableTimer[] = [];

  constructor(private readonly hooks: TvPauseHooks = {}) {}

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(value: boolean): void {
    const next = value === true;
    if (next === this.paused) return;
    this.paused = next;
    if (next) {
      this.hooks.suspend?.();
      this.stopClock();
      this.pauseTimers();
      return;
    }
    this.armClock();
    this.resumeTimers();
    this.hooks.resume?.();
  }

  /**
   * Cronometro da un secondo. `tick` restituisce false quando ha finito: il
   * cronometro si ferma e la pausa non lo riarma più.
   */
  startClock(tick: () => boolean): void {
    this.clearClock();
    this.tick = tick;
    if (!this.paused) this.armClock();
  }

  clearClock(): void {
    this.stopClock();
    this.tick = undefined;
  }

  /** Attesa che la pausa può fermare; il ritorno la annulla. */
  later(ms: number, action: () => void): () => void {
    const timer: PausableTimer = { action, remaining: ms, startedAt: 0 };
    this.timers.push(timer);
    if (!this.paused) this.armTimer(timer);
    return () => this.cancelTimer(timer);
  }

  /** Chiusura del componente: niente più tick né attese. */
  dispose(): void {
    this.clearClock();
    for (const timer of this.timers) {
      if (timer.id) clearTimeout(timer.id);
    }
    this.timers = [];
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
