import { Injectable, signal } from '@angular/core';

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
  /** Attacco in secondi: più lungo = suono meno "elettronico". */
  attack?: number;
  /** Filtro passa-basso applicato al singolo tono. */
  lowpass?: number;
  /** Numero di armoniche aggiunte: dà corpo a campane e legni. */
  partials?: number;
}

/**
 * Suoni della serata.
 *
 * Tutto è sintetizzato con la Web Audio API: nessun mp3 da scaricare, nessun
 * 404 silenzioso e la licenza resta nostra. La sintesi è costruita per
 * somigliare a oggetti veri — legno, campane, gettoni, applausi — invece dei
 * bip da videogioco: attacchi brevi, code lunghe, armoniche e un master che
 * tiene i livelli uniformi tra un effetto e l'altro.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioEnabled = signal(true);
  private audioContext?: AudioContext;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;

  private heartbeatLoopInterval?: any;
  private heartbeatIntensity = 0;
  private clockLoopInterval?: any;
  private ambientInterval?: any;
  private ambientNodes: OscillatorNode[] = [];
  private ambientGain?: GainNode;

  /**
   * Heartbeat della serata. `intensity` va da 0 (lobby) a 1 (round 40):
   * più si alza, più il battito è frequente e presente.
   */
  startHeartbeat(intensity = 0): void {
    this.stopHeartbeat();
    if (!this.audioEnabled()) return;

    this.heartbeatIntensity = Math.max(0, Math.min(1, intensity));
    const interval = Math.round(1500 - this.heartbeatIntensity * 650);

    const beat = () => {
      // Due colpi ravvicinati: il "lub-dub" di un cuore, non un bip.
      this.thump(this.heartbeatIntensity);
      this.tone({ freq: 58, duration: 0.16, type: 'sine', gain: 0.03 + this.heartbeatIntensity * 0.02, delay: 0.15, slideTo: 42 });
    };

    beat();
    this.heartbeatLoopInterval = setInterval(beat, interval);
  }

  stopHeartbeat(): void {
    if (this.heartbeatLoopInterval) {
      clearInterval(this.heartbeatLoopInterval);
      this.heartbeatLoopInterval = undefined;
    }
    this.heartbeatIntensity = 0;
  }

  /**
   * Suspense dei giochi a conto alla rovescia: parte dal round 20 e sale
   * gradualmente fino al round 40. Il battito cresce con la serata.
   */
  startSuspense(round: number): void {
    const level = Math.max(0, Math.min(1, (round - 19) / 21));
    if (level <= 0) {
      this.stopSuspense();
      return;
    }

    this.startHeartbeat(level);
    this.playSuspenseSting(level);
  }

  stopSuspense(): void {
    this.stopHeartbeat();
  }

  startClock(): void {
    if (!this.audioEnabled()) return;
    this.tickClock();
    this.clockLoopInterval = setInterval(() => this.tickClock(), 1000);
  }

  stopClock(): void {
    if (this.clockLoopInterval) {
      clearInterval(this.clockLoopInterval);
      this.clockLoopInterval = undefined;
    }
  }

  /** Campana da bar: attacco secco e coda lunga con armoniche non intere. */
  playBell(): void {
    if (!this.audioEnabled()) return;
    this.bell(880, 1.1, 0.16);
  }

  playCorrect(): void {
    if (!this.audioEnabled()) return;
    this.stopClock();
    // Marimba in salita, poi gettoni e applauso: tre strati, non un accordo.
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.marimba(freq, 0.42, 0.055, index * 0.07);
    });
    this.playCoins();
    this.playApplause();
  }

  playWrong(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 196, duration: 0.4, type: 'sawtooth', gain: 0.035, slideTo: 108, lowpass: 900 });
    this.tone({ freq: 185, duration: 0.42, type: 'sawtooth', gain: 0.028, slideTo: 102, lowpass: 900, delay: 0.01 });
    this.noiseBurst(0.22, 0.03, 0, 260);
    this.playUuuh();
  }

  /** Tintinnio di gettoni: pioggia di ping metallici, effetto da bar. */
  playCoins(): void {
    if (!this.audioEnabled()) return;
    const pings = [1760, 2093, 2349, 2637, 3136];
    for (let i = 0; i < 14; i++) {
      const freq = pings[i % pings.length] * (0.94 + Math.random() * 0.12);
      this.tone({
        freq,
        duration: 0.11,
        type: 'triangle',
        gain: 0.009 + (i % 4) * 0.002,
        delay: i * 0.032,
        partials: 2,
      });
    }
  }

  /** Applauso: molte mani, quindi folate irregolari di rumore filtrato. */
  playApplause(): void {
    if (!this.audioEnabled()) return;
    for (let i = 0; i < 7; i++) {
      this.noiseBurst(
        0.34 + Math.random() * 0.26,
        0.012 + Math.random() * 0.008,
        i * 0.11 + Math.random() * 0.04,
        1200 + Math.random() * 1800,
      );
    }
  }

  /** «Uuuh» del pubblico quando una squadra sbaglia. */
  playUuuh(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 310, duration: 0.6, type: 'sawtooth', gain: 0.02, slideTo: 150, lowpass: 700, attack: 0.12 });
    this.tone({ freq: 232, duration: 0.66, type: 'triangle', gain: 0.016, delay: 0.03, slideTo: 118, attack: 0.14 });
  }

  /** Sirena della Bomba: due toni alternati, da allarme da bar. */
  playBombSiren(): void {
    if (!this.audioEnabled()) return;
    for (let i = 0; i < 6; i++) {
      this.tone({
        freq: i % 2 === 0 ? 720 : 520,
        duration: 0.24,
        type: 'square',
        gain: 0.016,
        delay: i * 0.26,
        lowpass: 2200,
      });
    }
  }

  /**
   * Conferma globale: risposta registrata o azione accettata dal server.
   * Suono breve, due note in salita, pensato per il telefono.
   */
  playConfirm(): void {
    this.marimba(740, 0.12, 0.04);
    this.marimba(1108.73, 0.16, 0.03, 0.05);
  }

  /**
   * Errore globale: risposta rifiutata, azione non valida o tempo scaduto.
   * Suono corto e grave, distinto dal «sbagliato» della TV.
   */
  playError(): void {
    this.tone({ freq: 220, duration: 0.16, type: 'square', gain: 0.022, slideTo: 140, lowpass: 1200 });
    this.tone({ freq: 165, duration: 0.18, type: 'square', gain: 0.019, delay: 0.08, slideTo: 110, lowpass: 1200 });
  }

  playReveal(): void {
    if (!this.audioEnabled()) return;
    this.stopClock();
    // Rullo, pausa, poi il colpo del reveal: la suspense la fa il silenzio.
    this.playDrumroll(0.9, 0.65);
    window.setTimeout(() => {
      if (!this.audioEnabled()) return;
      this.bell(659.25, 1.4, 0.13);
      this.tone({ freq: 1046.5, duration: 0.5, type: 'triangle', gain: 0.035, delay: 0.07, partials: 3 });
      this.noiseBurst(0.5, 0.02, 0.02, 3400);
    }, 720);
  }

  /**
   * Tick della pallina sui separatori della roulette: partono fitti e
   * rallentano fino al fermo, con un tonfo quando la pallina scende sul rotore.
   */
  playRouletteTicks(durationMs = 6750): void {
    if (!this.audioEnabled()) return;
    if (!this.ensureContext()) return;

    let elapsed = 0;
    while (elapsed < durationMs - 120) {
      const progress = elapsed / durationMs;
      this.tone({
        freq: 1480 - progress * 420,
        duration: 0.028,
        type: 'triangle',
        gain: 0.024 * (1 - progress * 0.45),
        delay: elapsed / 1000,
        partials: 2,
      });
      elapsed += 26 + Math.pow(progress, 2.4) * 340;
    }

    // Rumore continuo della pallina che rotola sul legno.
    this.noiseBurst(1.1, 0.012, durationMs / 1000 - 1.2, 2200);
    this.tone({
      freq: 92,
      duration: 0.22,
      type: 'sine',
      gain: 0.045,
      delay: (durationMs * 0.29) / 1000,
    });
  }

  /** Atterraggio della roulette: tonfo grave e accento luminoso. */
  playRouletteLanding(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 120, duration: 0.34, type: 'sine', gain: 0.06, slideTo: 54 });
    this.tone({ freq: 1046.5, duration: 0.18, type: 'triangle', gain: 0.03, delay: 0.02, partials: 2 });
    this.chord([523.25, 659.25, 783.99], 0.8, 0.06);
    this.bell(1567.98, 0.9, 0.05, 0.16);
  }

  /** Nuova squadra collegata: bip luminoso a due note. */
  playJoin(): void {
    this.marimba(659.25, 0.16, 0.05);
    this.marimba(987.77, 0.22, 0.04, 0.09);
  }

  /** Tick delle classifiche e dei countdown. */
  playTick(): void {
    this.woodTick(0.032, 0);
  }

  /** Tick del countdown: legno secco e bassissimo, sotto la musica. */
  playCountdownTick(): void {
    this.woodTick(0.02, 0);
  }

  /** Bong di fine countdown: campana grave con coda breve. */
  playCountdownBong(): void {
    this.bell(196, 0.9, 0.07);
    this.tone({ freq: 392, duration: 0.4, type: 'sine', gain: 0.018, delay: 0.02, partials: 2 });
  }

  /** Transizione tra schermate. */
  playWhoosh(): void {
    this.noiseBurst(0.34, 0.02, 0, 900);
    this.tone({ freq: 240, duration: 0.32, type: 'sine', gain: 0.03, slideTo: 1100, lowpass: 2400 });
  }

  /** Eliminazione dall'Arena. */
  playElimination(): void {
    this.tone({ freq: 330, duration: 0.32, type: 'sawtooth', gain: 0.04, slideTo: 88, lowpass: 900 });
    this.noiseBurst(0.2, 0.02, 0, 300);
  }

  /** Fanfara del podio: arpeggio ascendente e accordo finale. */
  playPodium(): void {
    if (!this.audioEnabled()) return;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      this.marimba(freq, 0.28, 0.045, index * 0.14);
    });
    this.chord([523.25, 659.25, 783.99, 1046.5], 1, 0.6);
    this.bell(1567.98, 1.1, 0.04, 0.7);
  }

  /** Rullo di tamburi sintetico; `strength` regola volume e presenza. */
  playDrumroll(seconds = 2, strength = 0.6): void {
    if (!this.audioEnabled()) return;
    const hits = Math.max(1, Math.floor(seconds * 16));
    const baseGain = 0.008 + Math.max(0, Math.min(1, strength)) * 0.018;
    for (let i = 0; i < hits; i++) {
      this.noiseBurst(
        0.05,
        baseGain * (0.75 + (i / hits) * 0.4),
        i / 16,
        180 + (i % 3) * 40,
      );
      this.tone({
        freq: 82 + (i % 3) * 7,
        duration: 0.045,
        type: 'sine',
        gain: baseGain * (0.7 + (i / hits) * 0.4),
        delay: i / 16,
      });
    }
  }

  /**
   * Podio della classifica: il rullo sale dal terzo al primo posto e lascia
   * spazio al festeggiamento. Al secondo si aggiungono le botticelle, al
   * primo i botti pieni.
   */
  playPodiumReveal(position: number): void {
    const place = Math.max(1, Math.min(3, Math.round(position)));

    if (place === 3) {
      this.playDrumroll(0.8, 0.45);
      this.playCelebration(1, 0.8);
      return;
    }

    if (place === 2) {
      this.playDrumroll(1.4, 0.7);
      this.playCelebration(2, 1.4);
      this.playFireworks(2, 1.5);
      return;
    }

    this.playDrumroll(2.6, 1);
    this.playCelebration(3, 2.6);
    this.playFireworks(3, 2.7);
  }

  /** Tappeto lounge molto leggero: accordi lunghi e arpeggi random. */
  startAmbient(): void {
    if (!this.audioEnabled() || this.ambientInterval) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.value = 0.022;
    master.connect(ctx.destination);
    this.ambientGain = master;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.connect(master);

    [110, 164.81, 220].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.22;
      osc.connect(gain).connect(filter);
      osc.start();
      this.ambientNodes.push(osc);
    });

    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25];
    this.ambientInterval = setInterval(() => {
      if (!this.audioEnabled() || !this.audioContext) return;
      const freq = scale[Math.floor(Math.random() * scale.length)];
      this.marimba(freq, 1.2, 0.012);
    }, 2600);
  }

  stopAmbient(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = undefined;
    }
    for (const osc of this.ambientNodes) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // già fermo
      }
    }
    this.ambientNodes = [];
    this.ambientGain?.disconnect();
    this.ambientGain = undefined;
  }

  stopAll(): void {
    this.stopSuspense();
    this.stopClock();
    this.stopAmbient();
  }

  toggleAudio(): void {
    this.audioEnabled.update((enabled) => !enabled);
    if (!this.audioEnabled()) {
      this.stopAll();
    } else {
      this.startAmbient();
      this.playTick();
    }
  }

  isEnabled(): boolean {
    return this.audioEnabled();
  }

  // ------------------------------------------------------------- sintesi

  private ensureContext(): AudioContext | undefined {
    try {
      if (!this.audioContext) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return undefined;
        this.audioContext = new Ctx();

        // Un solo master per tutti gli effetti: i volumi restano coerenti
        // anche quando più suoni partono insieme.
        this.master = this.audioContext.createGain();
        this.master.gain.value = 0.75;
        this.master.connect(this.audioContext.destination);
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return this.audioContext;
    } catch {
      return undefined;
    }
  }

  private output(): AudioNode | undefined {
    const ctx = this.ensureContext();
    return ctx ? (this.master ?? ctx.destination) : undefined;
  }

  private tickClock(): void {
    // Legno + meccanismo: due strati brevi, non un bip elettronico.
    this.woodTick(0.028, 0);
    this.noiseBurst(0.02, 0.008, 0, 2600);
  }

  /** Legno secco: rumore filtrato più un corpo grave, coda cortissima. */
  private woodTick(gain = 0.03, delay = 0): void {
    this.noiseBurst(0.035, gain, delay, 1100);
    this.tone({ freq: 210, duration: 0.05, type: 'triangle', gain: gain * 0.6, delay });
  }

  private thump(intensity: number): void {
    const level = 0.035 + intensity * 0.03;
    this.tone({ freq: 96, duration: 0.13, type: 'sine', gain: level, slideTo: 48 });
    this.noiseBurst(0.06, level * 0.35, 0, 160);
  }

  /** Marimba: attacco morbido, parziali armoniche, coda che si spegne. */
  private marimba(freq: number, duration: number, gain: number, delay = 0): void {
    this.tone({ freq, duration, type: 'sine', gain, delay, attack: 0.012, partials: 3 });
    this.tone({ freq: freq * 2, duration: duration * 0.55, type: 'sine', gain: gain * 0.35, delay, attack: 0.008 });
  }

  /** Campana: fondamenta più parziali non armoniche per il timbro metallico. */
  private bell(freq: number, duration: number, gain: number, delay = 0): void {
    const output = this.output();
    const ctx = this.ensureContext();
    if (!output || !ctx) return;

    const start = ctx.currentTime + delay;
    const partialRatios = [1, 2.01, 2.98, 4.16];
    partialRatios.forEach((ratio, index) => {
      this.tone({
        freq: freq * ratio,
        duration: duration * (1 - index * 0.16),
        type: 'sine',
        gain: gain / (1 + index * 1.35),
        delay,
        attack: 0.005,
      });
    });

    this.noiseBurst(0.03, gain * 0.35, delay, 4200);
    void start;
  }

  /** Applauso sintetico, rumore filtrato a bande: base del pubblico. */
  private noiseBufferFor(ctx: AudioContext): AudioBuffer | undefined {
    if (this.noiseBuffer) return this.noiseBuffer;
    try {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
      return buffer;
    } catch {
      return undefined;
    }
  }

  /** Rumore filtrato con inviluppo: base di applausi, legni e foliate. */
  private noiseBurst(duration: number, gain: number, delay = 0, frequency = 1600): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    const output = this.output();
    if (!ctx || !output) return;

    const buffer = this.noiseBufferFor(ctx);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;

    const level = ctx.createGain();
    const start = ctx.currentTime + delay;
    level.gain.setValueAtTime(0.0001, start);
    level.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.008);
    level.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(level).connect(output);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  private tone(options: ToneOptions): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    const output = this.output();
    if (!ctx || !output) return;

    const start = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.freq, start);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.slideTo), start + options.duration);
    }

    const peak = Math.max(0.0002, options.gain ?? 0.03);
    const attack = Math.max(0.004, options.attack ?? 0.012);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

    let last: AudioNode = osc;
    if (options.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = options.lowpass;
      osc.connect(filter);
      last = filter;
    }
    last.connect(gain).connect(output);

    osc.start(start);
    osc.stop(start + options.duration + 0.06);

    // Armoniche: rendono il timbro più "vero" senza aggiungere campioni.
    const partials = Math.max(0, Math.min(3, options.partials ?? 0));
    for (let index = 1; index <= partials; index++) {
      const extra = ctx.createOscillator();
      const extraGain = ctx.createGain();
      extra.type = 'sine';
      extra.frequency.setValueAtTime(options.freq * (index + 1), start);
      extraGain.gain.setValueAtTime(0.0001, start);
      extraGain.gain.exponentialRampToValueAtTime(peak / (2.2 + index), start + attack);
      extraGain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + options.duration * (1 - index * 0.18),
      );
      extra.connect(extraGain).connect(output);
      extra.start(start);
      extra.stop(start + options.duration + 0.06);
    }
  }

  private chord(freqs: number[], duration: number, delay = 0): void {
    freqs.forEach((freq) => this.tone({ freq, duration, type: 'sine', gain: 0.024, delay, partials: 2 }));
  }

  private playCelebration(level: 1 | 2 | 3, delay: number): void {
    const notes = level === 1
      ? [523.25, 659.25, 783.99]
      : level === 2
        ? [392, 523.25, 659.25, 783.99]
        : [392, 523.25, 659.25, 783.99, 1046.5];
    const step = level === 1 ? 0.11 : level === 2 ? 0.12 : 0.14;
    const gain = level === 1 ? 0.022 : level === 2 ? 0.03 : 0.036;

    notes.forEach((freq, index) => {
      this.marimba(freq, level === 1 ? 0.22 : 0.3, gain, delay + index * step);
    });
    this.chord(notes.slice(-3), 0.75 + level * 0.15, delay + notes.length * step);
  }

  private playFireworks(level: 2 | 3, delay: number): void {
    const pops = level === 2 ? 6 : 12;
    for (let i = 0; i < pops; i++) {
      const at = delay + i * 0.09 + (i % 4) * 0.02;
      this.noiseBurst(0.04, 0.008 + (level === 3 ? 0.004 : 0), at, 2800 + (i % 5) * 500);
      if (i % 3 === 0) {
        this.tone({
          freq: 88 - (i % 2) * 14,
          duration: 0.18,
          type: 'sine',
          gain: 0.016 + level * 0.004,
          delay: at,
        });
      }
    }

    if (level === 3) {
      this.bell(1567.98, 1, 0.026, delay + 0.3);
    }
  }

  /** Richiamo breve all'inizio di un gioco in suspense. */
  private playSuspenseSting(level: number): void {
    this.tone({
      freq: 110,
      duration: 0.7,
      type: 'sine',
      gain: 0.008 + level * 0.012,
      slideTo: 55,
      attack: 0.05,
    });
    this.tone({
      freq: 220,
      duration: 0.5,
      type: 'triangle',
      gain: 0.006 + level * 0.008,
      delay: 0.04,
      slideTo: 110,
      lowpass: 900,
    });
  }
}
