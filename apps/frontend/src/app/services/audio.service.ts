import { Injectable, signal } from '@angular/core';

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

/**
 * Suoni della TV.
 *
 * I file mp3 coprono countdown e risposte; il resto è sintetizzato con la Web
 * Audio API, così non serve nessun asset esterno e la licenza è nostra.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioEnabled = signal(true);
  private audioContext?: AudioContext;

  private heartbeatAudio?: HTMLAudioElement;
  private clockAudio?: HTMLAudioElement;
  private bellAudio?: HTMLAudioElement;
  private correctAudio?: HTMLAudioElement;
  private wrongAudio?: HTMLAudioElement;
  private revealAudio?: HTMLAudioElement;

  private heartbeatLoopInterval?: any;
  private heartbeatIntensity = 0;
  private clockLoopInterval?: any;
  private ambientInterval?: any;
  private ambientNodes: OscillatorNode[] = [];
  private ambientGain?: GainNode;

  constructor() {
    this.loadAudio();
  }

  private loadAudio(): void {
    try {
      this.heartbeatAudio = new Audio('assets/audio/heartbeat.mp3');
      this.heartbeatAudio.volume = 0.25;

      this.clockAudio = new Audio('assets/audio/clock.mp3');
      this.clockAudio.volume = 0.35;

      this.bellAudio = new Audio('assets/audio/bell.mp3');
      this.bellAudio.volume = 0.55;

      this.correctAudio = new Audio('assets/audio/correct.mp3');
      this.correctAudio.volume = 0.7;

      this.wrongAudio = new Audio('assets/audio/wrong.mp3');
      this.wrongAudio.volume = 0.7;

      this.revealAudio = new Audio('assets/audio/reveal.mp3');
      this.revealAudio.volume = 0.6;
    } catch (e) {
      console.warn('⚠️ Errore caricamento audio:', e);
    }
  }

  /**
   * Heartbeat della serata. `intensity` va da 0 (lobby) a 1 (round 40):
   * più si alza, più il battito è frequente e presente.
   */
  startHeartbeat(intensity = 0): void {
    this.stopHeartbeat();
    if (!this.audioEnabled() || !this.heartbeatAudio) return;

    this.heartbeatIntensity = Math.max(0, Math.min(1, intensity));
    this.heartbeatAudio.volume = 0.18 + this.heartbeatIntensity * 0.16;
    this.heartbeatAudio.currentTime = 0;
    this.heartbeatAudio.play().catch(() => {});

    const interval = Math.round(1500 - this.heartbeatIntensity * 650);
    this.heartbeatLoopInterval = setInterval(() => {
      if (this.heartbeatAudio) {
        this.heartbeatAudio.currentTime = 0;
        this.heartbeatAudio.play().catch(() => {});
      }
    }, interval);
  }

  stopHeartbeat(): void {
    if (this.heartbeatLoopInterval) {
      clearInterval(this.heartbeatLoopInterval);
      this.heartbeatLoopInterval = undefined;
    }
    this.heartbeatIntensity = 0;
    if (this.heartbeatAudio) {
      this.heartbeatAudio.pause();
      this.heartbeatAudio.currentTime = 0;
    }
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
    if (!this.audioEnabled() || !this.clockAudio) return;
    this.clockAudio.currentTime = 0;
    this.clockAudio.play().catch(() => {});
    this.clockLoopInterval = setInterval(() => {
      if (this.clockAudio) {
        this.clockAudio.currentTime = 0;
        this.clockAudio.play().catch(() => {});
      }
    }, 1000);
  }

  stopClock(): void {
    if (this.clockLoopInterval) {
      clearInterval(this.clockLoopInterval);
      this.clockLoopInterval = undefined;
    }
    if (this.clockAudio) {
      this.clockAudio.pause();
      this.clockAudio.currentTime = 0;
    }
  }

  playBell(): void {
    if (!this.audioEnabled() || !this.bellAudio) return;
    this.bellAudio.currentTime = 0;
    this.bellAudio.play().catch(() => {});
  }

  playCorrect(): void {
    if (!this.audioEnabled() || !this.correctAudio) return;
    this.stopClock();
    this.correctAudio.currentTime = 0;
    this.correctAudio.play().catch(() => {});
    this.chord([523.25, 659.25, 783.99], 0.55);
  }

  playWrong(): void {
    if (!this.audioEnabled() || !this.wrongAudio) return;
    this.wrongAudio.currentTime = 0;
    this.wrongAudio.play().catch(() => {});
    this.tone({ freq: 196, duration: 0.45, type: 'sawtooth', gain: 0.05, slideTo: 110 });
  }

  playReveal(): void {
    if (!this.audioEnabled() || !this.revealAudio) return;
    this.stopClock();
    this.revealAudio.currentTime = 0;
    this.revealAudio.play().catch(() => {});
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
        freq: 1680 - progress * 520,
        duration: 0.026,
        type: 'triangle',
        gain: 0.03 * (1 - progress * 0.45),
        delay: elapsed / 1000,
      });
      elapsed += 26 + Math.pow(progress, 2.4) * 340;
    }

    this.tone({
      freq: 92,
      duration: 0.22,
      type: 'sine',
      gain: 0.055,
      delay: (durationMs * 0.29) / 1000,
    });
  }

  /** Atterraggio della roulette: tonfo grave e accento luminoso. */
  playRouletteLanding(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 120, duration: 0.32, type: 'sine', gain: 0.075, slideTo: 58 });
    this.tone({ freq: 1046.5, duration: 0.16, type: 'triangle', gain: 0.04, delay: 0.02 });
    this.chord([523.25, 659.25, 783.99], 0.75, 0.06);
    this.tone({ freq: 1567.98, duration: 0.42, type: 'sine', gain: 0.032, delay: 0.16 });
  }

  /** Nuova squadra collegata: bip luminoso a due note. */
  playJoin(): void {
    this.tone({ freq: 659.25, duration: 0.12, type: 'sine', gain: 0.06 });
    this.tone({ freq: 987.77, duration: 0.16, type: 'sine', gain: 0.05, delay: 0.1 });
  }

  /** Tick delle classifiche e dei countdown. */
  playTick(): void {
    this.tone({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.035 });
  }

  /** Tick del countdown: legno secco e bassissimo, sotto la musica. */
  playCountdownTick(): void {
    this.tone({ freq: 1180, duration: 0.035, type: 'triangle', gain: 0.022 });
  }

  /** Bong di fine countdown: campana grave con coda breve. */
  playCountdownBong(): void {
    this.tone({ freq: 196, duration: 0.55, type: 'sine', gain: 0.055, slideTo: 130 });
    this.tone({ freq: 392, duration: 0.35, type: 'sine', gain: 0.022, delay: 0.02 });
  }

  /** Transizione tra schermate. */
  playWhoosh(): void {
    this.tone({ freq: 220, duration: 0.35, type: 'sine', gain: 0.05, slideTo: 1320 });
  }

  /** Eliminazione dall'Arena. */
  playElimination(): void {
    this.tone({ freq: 330, duration: 0.3, type: 'sawtooth', gain: 0.06, slideTo: 90 });
  }

  /** Fanfara del podio: arpeggio ascendente e accordo finale. */
  playPodium(): void {
    if (!this.audioEnabled()) return;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      this.tone({ freq, duration: 0.22, type: 'square', gain: 0.04, delay: index * 0.14 });
    });
    this.chord([523.25, 659.25, 783.99, 1046.5], 0.9, 0.6);
    this.tone({ freq: 1567.98, duration: 0.5, type: 'sine', gain: 0.045, delay: 0.7 });
  }

  /** Rullo di tamburi sintetico; `strength` regola volume e presenza. */
  playDrumroll(seconds = 2, strength = 0.6): void {
    if (!this.audioEnabled()) return;
    const hits = Math.max(1, Math.floor(seconds * 14));
    const baseGain = 0.012 + Math.max(0, Math.min(1, strength)) * 0.03;
    for (let i = 0; i < hits; i++) {
      this.tone({
        freq: 90 + (i % 3) * 8,
        duration: 0.045,
        type: 'square',
        gain: baseGain * (0.85 + (i / hits) * 0.35),
        delay: i / 14,
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

  private playCelebration(level: 1 | 2 | 3, delay: number): void {
    const notes = level === 1
      ? [523.25, 659.25, 783.99]
      : level === 2
        ? [392, 523.25, 659.25, 783.99]
        : [392, 523.25, 659.25, 783.99, 1046.5];
    const step = level === 1 ? 0.11 : level === 2 ? 0.12 : 0.14;
    const gain = level === 1 ? 0.022 : level === 2 ? 0.03 : 0.038;

    notes.forEach((freq, index) => {
      this.tone({
        freq,
        duration: level === 1 ? 0.18 : 0.24,
        type: 'triangle',
        gain,
        delay: delay + index * step,
      });
    });
    this.chord(notes.slice(-3), 0.7 + level * 0.15, delay + notes.length * step);
  }

  private playFireworks(level: 2 | 3, delay: number): void {
    const pops = level === 2 ? 6 : 12;
    for (let i = 0; i < pops; i++) {
      const at = delay + i * 0.09 + (i % 4) * 0.02;
      this.tone({
        freq: 620 + (i % 5) * 180,
        duration: 0.025,
        type: 'square',
        gain: 0.012 + (level === 3 ? 0.006 : 0),
        delay: at,
      });
      if (i % 3 === 0) {
        this.tone({
          freq: 90 - (i % 2) * 15,
          duration: 0.16,
          type: 'sine',
          gain: 0.018 + level * 0.004,
          delay: at,
        });
      }
    }

    if (level === 3) {
      this.tone({ freq: 1567.98, duration: 0.5, type: 'sine', gain: 0.03, delay: delay + 0.3 });
    }
  }

  /** Richiamo breve all'inizio di un gioco in suspense. */
  private playSuspenseSting(level: number): void {
    this.tone({
      freq: 110,
      duration: 0.7,
      type: 'sine',
      gain: 0.008 + level * 0.014,
      slideTo: 55,
    });
    this.tone({
      freq: 220,
      duration: 0.5,
      type: 'triangle',
      gain: 0.006 + level * 0.01,
      delay: 0.04,
      slideTo: 110,
    });
  }

  /** Tappeto lounge molto leggero: accordi lunghi e arpeggi random. */
  startAmbient(): void {
    if (!this.audioEnabled() || this.ambientInterval) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.value = 0.035;
    master.connect(ctx.destination);
    this.ambientGain = master;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.connect(master);

    [110, 164.81, 220].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      osc.connect(gain).connect(filter);
      osc.start();
      this.ambientNodes.push(osc);
    });

    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25];
    this.ambientInterval = setInterval(() => {
      if (!this.audioEnabled() || !this.audioContext) return;
      const freq = scale[Math.floor(Math.random() * scale.length)];
      this.tone({ freq, duration: 1.1, type: 'triangle', gain: 0.018, delay: 0 });
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
    [this.bellAudio, this.correctAudio, this.wrongAudio, this.revealAudio].forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
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

  private ensureContext(): AudioContext | undefined {
    try {
      if (!this.audioContext) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return undefined;
        this.audioContext = new Ctx();
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return this.audioContext;
    } catch {
      return undefined;
    }
  }

  private tone(options: ToneOptions): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const start = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.freq, start);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.slideTo), start + options.duration);
    }

    const peak = options.gain ?? 0.05;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + options.duration + 0.05);
  }

  private chord(freqs: number[], duration: number, delay = 0): void {
    freqs.forEach((freq) => this.tone({ freq, duration, type: 'sine', gain: 0.03, delay }));
  }
}
