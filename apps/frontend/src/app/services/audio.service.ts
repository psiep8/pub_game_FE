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

  startHeartbeat(): void {
    if (!this.audioEnabled() || !this.heartbeatAudio) return;
    this.heartbeatAudio.currentTime = 0;
    this.heartbeatAudio.play().catch(() => {});
    this.heartbeatLoopInterval = setInterval(() => {
      if (this.heartbeatAudio) {
        this.heartbeatAudio.currentTime = 0;
        this.heartbeatAudio.play().catch(() => {});
      }
    }, 1500);
  }

  stopHeartbeat(): void {
    if (this.heartbeatLoopInterval) {
      clearInterval(this.heartbeatLoopInterval);
      this.heartbeatLoopInterval = undefined;
    }
    if (this.heartbeatAudio) {
      this.heartbeatAudio.pause();
      this.heartbeatAudio.currentTime = 0;
    }
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

  /** Nuova squadra collegata: bip luminoso a due note. */
  playJoin(): void {
    this.tone({ freq: 659.25, duration: 0.12, type: 'sine', gain: 0.06 });
    this.tone({ freq: 987.77, duration: 0.16, type: 'sine', gain: 0.05, delay: 0.1 });
  }

  /** Tick delle classifiche e dei countdown. */
  playTick(): void {
    this.tone({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.035 });
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

  /** Rullo di tamburi sintetico per la classifica dettagliata. */
  playDrumroll(seconds = 2): void {
    if (!this.audioEnabled()) return;
    const hits = Math.floor(seconds * 14);
    for (let i = 0; i < hits; i++) {
      this.tone({
        freq: 90 + (i % 3) * 8,
        duration: 0.045,
        type: 'square',
        gain: 0.025 + i / hits * 0.02,
        delay: i / 14,
      });
    }
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
    this.stopHeartbeat();
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
