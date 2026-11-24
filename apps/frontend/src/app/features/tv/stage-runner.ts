import type { StagePhase, StageStep } from './tv-timing';

/** Orologio della regia: nei test è finto, in TV è il browser. */
export interface StageHooks {
  onPhase: (phase: StagePhase, step: StageStep) => void;
  sleep?: (ms: number) => Promise<void>;
}

const slice = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Esegue la sequenza scenica di un round.
 *
 * <p>La sequenza è una fila di fasi con una durata. Due cose non deve sbagliare:
 * la pausa della TV ferma il nastro senza perdere la fase raggiunta, e un nuovo
 * round (o un refresh) cancella la sequenza vecchia invece di lasciarla correre
 * sotto la scena nuova.</p>
 */
export class StageRunner {
  private generation = 0;
  private suspended = false;
  private current: StagePhase = 'idle';

  constructor(private readonly hooks: StageHooks) {}

  get phase(): StagePhase {
    return this.current;
  }

  get isRunning(): boolean {
    return this.generation > 0 && this.current !== 'live' && this.current !== 'idle';
  }

  /**
   * Avvia la sequenza. Torna `true` se è arrivata in fondo, `false` se è stata
   * cancellata da un'altra scena o dal componente che si chiude.
   */
  async play(steps: readonly StageStep[]): Promise<boolean> {
    const run = ++this.generation;
    for (const step of steps) {
      if (run !== this.generation) return false;
      this.current = step.phase;
      this.hooks.onPhase(step.phase, step);
      if (step.ms <= 0) continue;
      const arrived = await this.waitFor(step.ms, run);
      if (!arrived) return false;
    }
    return true;
  }

  /** Pausa: il nastro si ferma, la fase resta quella raggiunta. */
  setPaused(value: boolean): void {
    this.suspended = value === true;
  }

  /** Scena nuova, reset, uscita: la sequenza in corso non arriva in fondo. */
  cancel(): void {
    this.generation += 1;
    this.suspended = false;
    this.current = 'idle';
  }

  private async waitFor(ms: number, run: number): Promise<boolean> {
    const sleep = this.hooks.sleep ?? slice;
    let left = ms;
    while (left > 0) {
      if (run !== this.generation) return false;
      if (this.suspended) {
        // In pausa il tempo non scorre: si controlla e si riprova.
        await sleep(50);
        continue;
      }
      const piece = Math.min(100, left);
      await sleep(piece);
      left -= piece;
    }
    return run === this.generation;
  }
}
