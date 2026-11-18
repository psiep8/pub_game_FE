import { createRoom } from './audio-dsp';

/**
 * Grafo audio della serata: un solo contesto, un master, il bus della TV con
 * la coda di stanza e il bus dell'evento in corso.
 *
 * Non conosce gli eventi né i file: chi suona passa da `out()` e chi cambia
 * volume passa da `applyGain()`. Così TV, telefono e tappeti condividono lo
 * stesso volume e lo stesso muto.
 */
export class AudioEngine {
  private contextNode?: AudioContext;
  private masterNode?: GainNode;
  private tvNode?: GainNode;
  private roomNode?: GainNode;
  private wetNode?: GainNode;
  private dryNode?: GainNode;
  private enabled = true;
  private volume = 1;

  /** Contesto condiviso: anche il Quiz musicale ci appende i suoi filtri. */
  context(): AudioContext | undefined {
    return this.ensure();
  }

  /** Bus di uscita comune: ogni sorgente passa dal gain master. */
  output(): AudioNode | undefined {
    this.ensure();
    return this.masterNode;
  }

  master(): GainNode | undefined {
    this.ensure();
    return this.masterNode;
  }

  /** Destinazione dei suoni di sala: master più coda di stanza. */
  room(ctx: AudioContext): AudioNode {
    return this.tvNode ?? ctx.destination;
  }

  /**
   * Bus di un singolo evento: porta il volume del catalogo su tutte le voci
   * dell'evento, coda compresa. Un bus per riproduzione, così le code già
   * programmate non cambiano volume quando l'evento successivo comincia.
   */
  beginEventBus(volume: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.masterNode) return;
    const wet = ctx.createGain();
    wet.gain.value = Math.max(0, Math.min(2, volume));
    wet.connect(this.room(ctx));
    const dry = ctx.createGain();
    dry.gain.value = Math.max(0, Math.min(2, volume));
    dry.connect(this.masterNode);
    this.wetNode = wet;
    this.dryNode = dry;
    // Le code più lunghe del catalogo non superano i venti secondi.
    window.setTimeout(() => {
      try {
        wet.disconnect();
        dry.disconnect();
      } catch {
        // già scollegati
      }
    }, 25000);
  }

  /** Uscita dell'evento in corso: bagnata (sala) o asciutta (telefono). */
  out(ctx: AudioContext, wet = true): AudioNode {
    const bus = wet ? this.wetNode : this.dryNode;
    if (bus) return bus;
    return wet ? this.room(ctx) : this.masterNode ?? ctx.destination;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyGain();
  }

  applyGain(): void {
    const ctx = this.contextNode;
    const master = this.masterNode;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.enabled ? this.volume : 0, now + 0.03);
  }

  /** Riprende il contesto dopo un gesto utente o al ritorno sulla scheda. */
  async unlock(): Promise<void> {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Il browser vuole un gesto: ci riprovano i listener globali.
      }
    }
    this.applyGain();
  }

  /**
   * Primo gesto utile: sblocca il contesto una volta e poi si toglie.
   * `onUnlock` è un lavoro extra del chiamante dopo lo sblocco, se serve.
   */
  armUnlock(onUnlock: () => void = () => undefined): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!(window.AudioContext || (window as any).webkitAudioContext)) return;

    const unlock = () => {
      void this.unlock().then(() => {
        onUnlock();
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
      });
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.unlock().then(onUnlock);
      }
    });
  }

  private ensure(): AudioContext | undefined {
    try {
      if (!this.contextNode) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return undefined;
        this.contextNode = new Ctx();
        this.masterNode = this.contextNode.createGain();
        this.masterNode.gain.value = this.enabled ? this.volume : 0;
        this.masterNode.connect(this.contextNode.destination);
        // La TV suona in una stanza: coda discreta, il telefono resta asciutto.
        this.roomNode = createRoom(this.contextNode, this.masterNode, {
          seconds: 1.25,
          mix: 0.14,
          tone: 4800,
        });
        this.tvNode = this.contextNode.createGain();
        this.tvNode.connect(this.masterNode);
        this.tvNode.connect(this.roomNode);
      }
      if (this.contextNode.state === 'suspended') {
        void this.contextNode.resume().catch(() => undefined);
      }
      return this.contextNode;
    } catch {
      return undefined;
    }
  }
}
