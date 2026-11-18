import type { AudioEventId } from './audio-catalog';
import { AUDIO_FILES } from './audio-files';
import { AudioEngine } from './audio-engine';

/** Quattro partenze dello stesso applauso: offset in secondi e velocità. */
const APPLAUSE_VARIATIONS = [
  { offset: 0, rate: 1 },
  { offset: 1.15, rate: 0.97 },
  { offset: 2.3, rate: 1.03 },
  { offset: 3.4, rate: 0.99 },
];

/** Loop in corso: heartbeat e orologio restano accesi finché non li si ferma. */
interface ActiveLoop {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter?: BiquadFilterNode;
}

/** Sottofondo in onda: file, sorgente e guadagno su cui si fa la dissolvenza. */
interface ActiveBed {
  url: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** Ritocco del loop: velocità del nastro e taglio delle alte. */
interface LoopStyle {
  rate?: number;
  lowpass?: number;
}

/**
 * Suona i file della libreria: cache dei buffer, varianti, loop.
 *
 * Non sintetizza nulla: se un file manca lo dice al chiamante, che lo segnala
 * in console. La sintesi è sparita apposta, così un asset assente si vede
 * subito invece di restare nascosto da un suono di riserva.
 */
export class SoundPlayer {
  /** File già decodificati; `null` = assente, non si riprova. */
  private readonly buffers = new Map<string, AudioBuffer | null>();
  /** File in caricamento: evita doppie fetch sullo stesso evento. */
  private readonly loading = new Set<string>();
  private readonly loops = new Map<string, ActiveLoop>();
  /** Sottofondo musicale: un solo loop acceso alla volta. */
  private bed?: ActiveBed;
  /** Richiesta in corso: una risposta lenta non deve sovrascrivere la nuova. */
  private bedRequest = 0;

  constructor(
    private readonly engine: AudioEngine,
    private readonly isEnabled: () => boolean,
    private readonly onMissing: (url: string) => void = () => undefined,
  ) {}

  /**
   * Riproduce il file dell'evento. Torna `false` quando l'evento non ha file
   * o il file è già fallito: il chiamante lo segnala, senza ripiegare sulla
   * sintesi.
   */
  play(event: AudioEventId, variant = 0): boolean {
    const files = AUDIO_FILES[event];
    if (!files || files.length === 0) return false;
    const ctx = this.engine.context();
    if (!this.isEnabled()) return false;
    // Senza contesto (test, browser senza Web Audio) l'evento è accettato:
    // non c'è nulla da suonare, ma non è un file mancante.
    if (!ctx) return true;

    const file = files[Math.abs(variant) % files.length];
    const style = event === 'applause'
      ? APPLAUSE_VARIATIONS[Math.abs(variant) % APPLAUSE_VARIATIONS.length]
      : undefined;
    const url = `assets/audio/${file}`;
    const cached = this.buffers.get(url);
    if (cached === null) return false;
    if (cached) {
      this.start(ctx, cached, style);
      return true;
    }
    if (this.loading.has(url)) return true;

    this.loading.add(url);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} su ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        this.loading.delete(url);
        this.start(ctx, buffer, style);
      })
      .catch(() => {
        this.buffers.set(url, null);
        this.loading.delete(url);
        this.onMissing(url);
      });
    return true;
  }

  /** Loop continuo (heartbeat, orologio), con il suo volume. */
  startLoop(event: AudioEventId, level = 1, style: LoopStyle = {}): void {
    const files = AUDIO_FILES[event];
    if (!files || files.length === 0) return;
    const ctx = this.engine.context();
    if (!ctx || !this.isEnabled()) return;
    this.stopLoop(event);

    const url = `assets/audio/${files[0]}`;
    const buffered = this.buffers.get(url);
    if (buffered) {
      this.startLoopBuffer(ctx, event, buffered, level, style);
      return;
    }
    if (buffered === null) {
      this.onMissing(url);
      return;
    }
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} su ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        if (!this.isEnabled()) return;
        this.startLoopBuffer(ctx, event, buffer, level, style);
      })
      .catch(() => {
        this.buffers.set(url, null);
        this.onMissing(url);
      });
  }

  /** True se il loop dell'evento è in onda: serve alla pausa della TV. */
  isLooping(event: AudioEventId): boolean {
    return this.loops.has(event);
  }

  stopLoop(event: AudioEventId): void {
    const active = this.loops.get(event);
    if (!active) return;
    try {
      active.source.stop();
      active.source.disconnect();
      active.filter?.disconnect();
      active.gain.disconnect();
    } catch {
      // già fermo
    }
    this.loops.delete(event);
  }

  /**
   * Sottofondo registrato, con dissolvenza incrociata: il loop che esce scende
   * in `fade` secondi, quello che entra sale nello stesso tempo. Chiedere il
   * file già in onda non fa nulla, così il cambio di round nella stessa
   * famiglia non riparte da capo.
   */
  startBed(file: string, level: number, fade = 1.5): void {
    const url = `assets/audio/${file}`;
    if (this.bed?.url === url) return;
    const ctx = this.engine.context();
    if (!ctx || !this.isEnabled()) return;

    this.bedRequest += 1;
    const request = this.bedRequest;
    this.fadeOutBed(ctx, fade);

    const cached = this.buffers.get(url);
    if (cached) {
      this.startBedBuffer(ctx, url, cached, level, fade);
      return;
    }
    if (cached === null) {
      this.onMissing(url);
      return;
    }
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} su ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        if (request !== this.bedRequest || !this.isEnabled()) return;
        this.startBedBuffer(ctx, url, buffer, level, fade);
      })
      .catch(() => {
        this.buffers.set(url, null);
        this.onMissing(url);
      });
  }

  /**
   * Mette in memoria un sottofondo prima che serva: il file parte già
   * decodificato al primo round dell'atto, senza il vuoto della prima fetch.
   * È best-effort e si ricorda i fallimenti: un file non ancora in cartella
   * resta segnato come assente e non si riprova a ogni round, senza sporcare la
   * console — il 404 lo segnala chi prova a suonarlo davvero. Un ricaricamento
   * della pagina riapre i tentativi, così il file arriva con il nuovo deploy.
   */
  warmBed(file: string): void {
    const url = `assets/audio/${file}`;
    const ctx = this.engine.context();
    if (!ctx || !this.isEnabled()) return;
    if (this.buffers.has(url) || this.loading.has(url)) return;

    this.loading.add(url);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} su ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(url, buffer);
        this.loading.delete(url);
      })
      .catch(() => {
        // Un 404 si ricorda: senza questo il file dell'atto non ancora
        // consegnato tornava a bussare a ogni round di tutta la serata.
        this.buffers.set(url, null);
        this.loading.delete(url);
      });
  }

  /** Spegne il sottofondo con una dissolvenza breve. */
  stopBed(fade = 0.6): void {
    const ctx = this.engine.context();
    if (!ctx) return;
    this.bedRequest += 1;
    this.fadeOutBed(ctx, fade);
  }

  /**
   * Volume del sottofondo in onda, senza riavviarlo: la domanda di Quiz e
   * Indovina chi lo abbassa di 6 dB e alla chiusura lo riporta su.
   */
  setBedLevel(level: number, fade = 0.4): void {
    const ctx = this.engine.context();
    const active = this.bed;
    if (!ctx || !active || !this.isEnabled()) return;
    const now = ctx.currentTime;
    const seconds = Math.max(0.05, fade);
    const gain = active.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)), now + seconds);
  }

  private fadeOutBed(ctx: AudioContext, fade: number): void {
    const active = this.bed;
    if (!active) return;
    this.bed = undefined;
    const now = ctx.currentTime;
    const seconds = Math.max(0.05, fade);
    const gain = active.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + seconds);
    try {
      active.source.stop(now + seconds + 0.05);
    } catch {
      // già fermo
    }
  }

  private startBedBuffer(
    ctx: AudioContext,
    url: string,
    buffer: AudioBuffer,
    level: number,
    fade: number,
  ): void {
    const now = ctx.currentTime;
    const seconds = Math.max(0.05, fade);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)), now + seconds);
    source.connect(gain).connect(this.engine.room(ctx));
    source.start();
    this.bed = { url, source, gain };
  }

  private startLoopBuffer(
    ctx: AudioContext,
    event: AudioEventId,
    buffer: AudioBuffer,
    level: number,
    style: LoopStyle = {},
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (style.rate && Number.isFinite(style.rate)) {
      source.playbackRate.value = Math.max(0.5, Math.min(1.6, style.rate));
    }
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, level));
    let filter: BiquadFilterNode | undefined;
    if (style.lowpass) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.max(400, Math.min(18000, style.lowpass));
      source.connect(filter).connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(this.engine.room(ctx));
    source.start();
    this.loops.set(event, { source, gain, filter });
  }

  /**
   * Riproduce un buffer sul bus dell'evento. `offset` e `rate` servono agli
   * applausi: dalla stessa registrazione partono quattro attacchi diversi.
   */
  private start(
    ctx: AudioContext,
    buffer: AudioBuffer,
    style?: { offset?: number; rate?: number },
  ): void {
    if (!this.isEnabled()) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (style?.rate) source.playbackRate.value = style.rate;
    source.connect(this.engine.out(ctx));
    const offset = Math.max(0, Math.min(style?.offset ?? 0, Math.max(0, buffer.duration - 0.3)));
    source.start(0, offset);
  }
}
