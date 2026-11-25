import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  SimpleChanges,
  OnChanges, EventEmitter, Output,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import {CommonModule} from '@angular/common';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Pipeline audio delle cinque manche.
 *
 * Manche 1 e 2 usano due motori "hybrid" separati (analogico e elettronico):
 * una sola catena bagnata è attiva per volta, con dry/wet, headroom,
 * saturazione compensata e compressore di sicurezza. Manche 3 e 4 restano
 * pulite (la 4 è il reveal, senza effetti). Il volume percepito resta simile
 * fra le manche: non crolla quando entrano i filtri.
 */
const FULL_PLAYBACK_SECONDS = 30;
const FULL_PLAYBACK_FADE_SECONDS = 5;

/** Manche 1: nastro analogico instabile, radio fuori sintonia. */
const HYBRID_MANCHE_1 = {
  wet: 0.78,
  dry: 0.22,
  highpassHz: 105,
  lowpassHz: 4600,
  presenceFrequencyHz: 1250,
  presenceQ: 1.1,
  presenceGainDb: -3.5,
  tapeDrive: 0.32,
  wowRateHz: 0.35,
  wowDepthSeconds: 0.006,
  flutterRateHz: 6.2,
  flutterDepthSeconds: 0.0012,
  hissGain: 0.008,
  hissCenterHz: 2600,
  hissQ: 0.8,
  compressorThresholdDb: -18,
  compressorRatio: 2.5,
  outputGain: 0.9,
} as const;

/** Manche 2: mutazione elettronica, più difficile della prima. */
const HYBRID_MANCHE_2 = {
  wet: 0.84,
  dry: 0.16,
  highpassHz: 145,
  lowpassHz: 5200,
  ringModFrequencyHz: 32,
  ringModDepth: 0.35,
  pitchRatio: 0.817,
  tremoloRateHz: 4.5,
  tremoloDepth: 0.12,
  digitalDrive: 0.24,
  stutterStepSeconds: 0.48,
  stutterDurationMs: 65,
  stutterCrossfadeMs: 8,
  compressorThresholdDb: -20,
  compressorRatio: 3,
  outputGain: 0.9,
} as const;

/** Manche 3 e 4: solo EQ leggera, poi brano pulito. */
const MANCHE_AUDIO: Record<number, { gain: number; highpass: number; lowpass: number }> = {
  3: { gain: 0.75, highpass: 200, lowpass: 5200 },
  4: { gain: 1, highpass: 50, lowpass: 8000 },
};

@Component({
  selector: 'app-song',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './song.component.css',
})
export class Song implements OnInit, OnDestroy, OnChanges {
  @Input() displayData: any;
  @Input() timer: number = 0;
  /** Spegne il cerchio del timer al reveal: la soluzione è svelata, il tempo no. */
  @Input() timerVisible = true;

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();
  /** La canzone del reveal è finita: la TV può passare al round successivo. */
  @Output() onFullPlaybackEnd = new EventEmitter<void>();

  private audioEngine = inject(AudioService);
  private audio?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;

  /** Nodo finale: è anche il volume del reveal (fade negli ultimi 5 s). */
  private gainNode?: GainNode;
  private inputGain?: GainNode;
  private preHighpass?: BiquadFilterNode;
  private preLowpass?: BiquadFilterNode;
  private dryGain?: GainNode;
  private mixBus?: GainNode;
  private compressor?: DynamicsCompressorNode;

  // Manche 1 — analog disguise.
  private m1Presence?: BiquadFilterNode;
  private m1Shaper?: WaveShaperNode;
  private m1Delay?: DelayNode;
  private m1Wet?: GainNode;
  private wowOsc?: OscillatorNode;
  private wowDepth?: GainNode;
  private flutterOsc?: OscillatorNode;
  private flutterDepth?: GainNode;
  private hissSource?: AudioBufferSourceNode;
  private hissFilter?: BiquadFilterNode;
  private hissGain?: GainNode;

  // Manche 2 — electronic mutation.
  private m2Ring?: GainNode;
  private ringOsc?: OscillatorNode;
  private ringDepth?: GainNode;
  private pitchStage?: GainNode;
  private pitchNode?: AudioWorkletNode;
  private pitchWorkletLoading = false;
  private m2Shaper?: WaveShaperNode;
  private m2Gate?: GainNode;
  private m2Trem?: GainNode;
  private m2Wet?: GainNode;
  private tremOsc?: OscillatorNode;
  private tremDepth?: GainNode;
  private stutterTimer?: ReturnType<typeof setInterval>;

  audioReady = signal(false);
  isPlaying = signal(false);
  currentPhase = signal(0);
  vinylRotation = signal(0);
  blurAmount = signal(28);
  scratching = signal(false);

  private vinylAnimationFrame?: number;
  private audioUnlocked = false;
  private lastPhase = 0;
  private scratchTimeout?: ReturnType<typeof setTimeout>;
  private driftTimer?: ReturnType<typeof setInterval>;
  private fullPlaybackActive = false;
  private fullPlaybackDone = false;
  private fullPlaybackTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() {

    const autoUnlock = async () => {
      await this.unlockAudioContext();
      window.removeEventListener('click', autoUnlock);
      window.removeEventListener('keydown', autoUnlock);
    };

    window.addEventListener('click', autoUnlock);
    window.addEventListener('keydown', autoUnlock);
    setTimeout(() => this.unlockAudioContext(), 100);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && this.displayData) {
      const prevData = changes['displayData'].previousValue;

      // Prenotazione: la puntina "strappa" il disco.
      const nextBuzz = this.displayData.buzzedPlayer ?? null;
      const prevBuzz = prevData?.buzzedPlayer ?? null;
      if (nextBuzz && nextBuzz !== prevBuzz) {
        this.scratch();
        this.stopFullPlayback();
        this.pauseAudio();
      }
      if (prevData?.previewUrl !== this.displayData.previewUrl) {
        this.blurAmount.set(28);
        this.currentPhase.set(0);
        this.lastPhase = 0;
        this.stopFullPlayback();
        this.initAudio();
      }

      const fullPlayback = !!this.displayData.fullPlayback && !nextBuzz;
      if (fullPlayback && !this.fullPlaybackDone) {
        this.startFullPlayback();
      } else if (!fullPlayback && this.fullPlaybackActive) {
        this.stopFullPlayback();
      }

      const phase = this.displayData.currentPhase || 0;
      if (this.lastPhase !== phase && phase > 0) {
        this.lastPhase = phase;
        this.currentPhase.set(phase);
        this.applyFilters(phase);
        this.applyBlur(phase);
      }

      if (!fullPlayback && !nextBuzz) {
        const shouldPlay = this.displayData.audioPlaying;
        const actuallyPlaying = this.isPlaying();

        if (shouldPlay && !actuallyPlaying) {
          this.playAudio();
        } else if (!shouldPlay && actuallyPlaying) {
          this.pauseAudio();
        }
      }

      if (this.displayData.revealed && this.blurAmount() > 0) {
        this.blurAmount.set(0);
      }
    }
  }

  private async unlockAudioContext() {
    if (this.audioUnlocked) return;

    try {
      this.audioContext ??= this.audioEngine.context();
      if (!this.audioContext) return;
      await this.audioEngine.unlock();

      if (this.audio && this.audio.paused) {
        this.audio.muted = true;
        try {
          await this.audio.play();
          this.audio.pause();
        } catch (e) {
        }
        this.audio.muted = false;
        this.audio.currentTime = 0;
      }

      this.audioUnlocked = true;

    } catch (err) {
      console.warn('⚠️ Unlock failed:', err);
    }
  }

  private async initAudio() {
    if (!this.displayData?.previewUrl) return;

    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.src = '';
      }

      this.teardownNodes();
      this.audio = new Audio(this.displayData.previewUrl);
      this.audio.crossOrigin = 'anonymous';
      this.audio.loop = true;
      this.audio.preload = 'auto';

      this.audioContext ??= this.audioEngine.context();
      if (!this.audioContext) return;

      this.buildPipeline(this.audioContext);
      this.audioReady.set(true);

      if (!this.audioUnlocked) {
        await this.unlockAudioContext();
      }

    } catch (error) {
      console.error('❌ Init audio error:', error);
    }
  }

  /**
   * Una sola catena attiva per manche: la 1 passa dal motore analogico, la 2 da
   * quello elettronico, la 3/4 vanno dritte. Nessun nodo duplicato.
   */
  private buildPipeline(ctx: AudioContext) {
    const out = this.audioEngine.output() ?? ctx.destination;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 0.9;
    this.preHighpass = ctx.createBiquadFilter();
    this.preHighpass.type = 'highpass';
    this.preHighpass.frequency.value = 50;
    this.preLowpass = ctx.createBiquadFilter();
    this.preLowpass.type = 'lowpass';
    this.preLowpass.frequency.value = 20000;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1;
    this.mixBus = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 2.5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1;

    this.sourceNode = ctx.createMediaElementSource(this.audio!);
    this.sourceNode
      .connect(this.inputGain)
      .connect(this.preHighpass)
      .connect(this.preLowpass);

    this.preLowpass.connect(this.dryGain).connect(this.mixBus);

    // Manche 1: presenza -> saturazione -> nastro nel tempo (wow/flutter).
    this.m1Presence = ctx.createBiquadFilter();
    this.m1Presence.type = 'peaking';
    this.m1Presence.frequency.value = HYBRID_MANCHE_1.presenceFrequencyHz;
    this.m1Presence.Q.value = HYBRID_MANCHE_1.presenceQ;
    this.m1Presence.gain.value = HYBRID_MANCHE_1.presenceGainDb;
    this.m1Shaper = ctx.createWaveShaper();
    this.m1Shaper.oversample = '4x';
    this.m1Delay = ctx.createDelay(0.1);
    this.m1Delay.delayTime.value = 0.018;
    this.m1Wet = ctx.createGain();
    this.m1Wet.gain.value = 0;
    this.preLowpass.connect(this.m1Presence).connect(this.m1Shaper).connect(this.m1Delay).connect(this.m1Wet).connect(this.mixBus);

    this.wowOsc = ctx.createOscillator();
    this.wowOsc.frequency.value = HYBRID_MANCHE_1.wowRateHz;
    this.wowDepth = ctx.createGain();
    this.wowDepth.gain.value = 0;
    this.wowOsc.connect(this.wowDepth).connect(this.m1Delay.delayTime);
    this.wowOsc.start();

    this.flutterOsc = ctx.createOscillator();
    this.flutterOsc.frequency.value = HYBRID_MANCHE_1.flutterRateHz;
    this.flutterDepth = ctx.createGain();
    this.flutterDepth.gain.value = 0;
    this.flutterOsc.connect(this.flutterDepth).connect(this.m1Delay.delayTime);
    this.flutterOsc.start();

    // Manche 2: ring -> pitch -> saturazione digitale -> gate ritmico -> tremolo.
    this.m2Ring = ctx.createGain();
    this.m2Ring.gain.value = 1;
    this.ringOsc = ctx.createOscillator();
    this.ringOsc.frequency.value = HYBRID_MANCHE_2.ringModFrequencyHz;
    this.ringDepth = ctx.createGain();
    this.ringDepth.gain.value = 0;
    this.ringOsc.connect(this.ringDepth).connect(this.m2Ring.gain);
    this.ringOsc.start();

    this.pitchStage = ctx.createGain();
    this.pitchStage.gain.value = 1;
    this.m2Shaper = ctx.createWaveShaper();
    this.m2Shaper.oversample = '2x';
    this.m2Gate = ctx.createGain();
    this.m2Gate.gain.value = 1;
    this.m2Trem = ctx.createGain();
    this.m2Trem.gain.value = 1;
    this.m2Wet = ctx.createGain();
    this.m2Wet.gain.value = 0;

    this.preLowpass.connect(this.m2Ring).connect(this.pitchStage).connect(this.m2Shaper)
      .connect(this.m2Gate).connect(this.m2Trem).connect(this.m2Wet).connect(this.mixBus);

    this.tremOsc = ctx.createOscillator();
    this.tremOsc.frequency.value = HYBRID_MANCHE_2.tremoloRateHz;
    this.tremDepth = ctx.createGain();
    this.tremDepth.gain.value = 0;
    this.tremOsc.connect(this.tremDepth).connect(this.m2Trem.gain);
    this.tremOsc.start();

    // Fruscio del nastro: buffer generato una volta e filtrato.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.hissSource = ctx.createBufferSource();
    this.hissSource.buffer = noise;
    this.hissSource.loop = true;
    this.hissFilter = ctx.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = HYBRID_MANCHE_1.hissCenterHz;
    this.hissFilter.Q.value = HYBRID_MANCHE_1.hissQ;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    this.hissSource.connect(this.hissFilter).connect(this.hissGain).connect(this.mixBus);
    this.hissSource.start();

    this.mixBus.connect(this.compressor).connect(this.gainNode).connect(out);

    void this.loadPitchWorklet();
  }

  /** Carica il pitch shifter granulare; se non c'è, la manche 2 resta senza. */
  private async loadPitchWorklet(): Promise<void> {
    const ctx = this.audioContext;
    if (!ctx || !ctx.audioWorklet || this.pitchNode || this.pitchWorkletLoading) return;
    this.pitchWorkletLoading = true;
    try {
      await ctx.audioWorklet.addModule('assets/audio/pitch-shift-worklet.js');
      const node = new AudioWorkletNode(ctx, 'pitch-shift', {
        channelCount: 1,
        channelCountMode: 'explicit',
        outputChannelCount: [1],
      });
      this.m2Ring?.disconnect();
      this.m2Ring?.connect(node);
      node.connect(this.pitchStage!);
      this.pitchNode = node;
      this.setPitchRatio(HYBRID_MANCHE_2.pitchRatio);
    } catch (error) {
      console.warn('⚠️ Pitch shifter non disponibile, manche 2 senza pitch shift', error);
    } finally {
      this.pitchWorkletLoading = false;
    }
  }

  private setPitchRatio(ratio: number): void {
    const parameter = this.pitchNode?.parameters.get('ratio');
    if (parameter && this.audioContext) {
      parameter.setValueAtTime(ratio, this.audioContext.currentTime);
    }
  }

  private applyFilters(phase: number) {
    const ctx = this.audioContext;
    if (!ctx || !this.gainNode || !this.dryGain || !this.mixBus) return;
    const now = ctx.currentTime;
    const ramp = (param: AudioParam, value: number, speed = 0.08) =>
      param.setTargetAtTime(value, now, speed);

    // Nessuna manche cambia la velocità: l'intonazione non passa da playbackRate.
    if (this.audio) this.audio.playbackRate = 1;

    this.stopStutter();

    if (phase === 1) {
      ramp(this.preHighpass!.frequency, HYBRID_MANCHE_1.highpassHz);
      ramp(this.preLowpass!.frequency, HYBRID_MANCHE_1.lowpassHz);
      ramp(this.dryGain.gain, HYBRID_MANCHE_1.dry);
      ramp(this.m1Wet!.gain, HYBRID_MANCHE_1.wet);
      ramp(this.m2Wet!.gain, 0);
      ramp(this.m1Presence!.gain, HYBRID_MANCHE_1.presenceGainDb);
      this.m1Shaper!.curve = this.saturationCurve(HYBRID_MANCHE_1.tapeDrive);
      ramp(this.wowDepth!.gain, HYBRID_MANCHE_1.wowDepthSeconds, 0.15);
      ramp(this.flutterDepth!.gain, HYBRID_MANCHE_1.flutterDepthSeconds, 0.15);
      ramp(this.hissGain!.gain, HYBRID_MANCHE_1.hissGain, 0.2);
      this.setCompressor(HYBRID_MANCHE_1.compressorThresholdDb, HYBRID_MANCHE_1.compressorRatio);
      ramp(this.gainNode.gain, HYBRID_MANCHE_1.outputGain);
      ramp(this.m2Trem!.gain, 1);
      ramp(this.ringDepth!.gain, 0);
      ramp(this.m2Gate!.gain, 1);
      this.setPitchRatio(1);
      return;
    }

    if (phase === 2) {
      ramp(this.preHighpass!.frequency, HYBRID_MANCHE_2.highpassHz);
      ramp(this.preLowpass!.frequency, HYBRID_MANCHE_2.lowpassHz);
      ramp(this.dryGain.gain, HYBRID_MANCHE_2.dry);
      ramp(this.m1Wet!.gain, 0);
      ramp(this.m2Wet!.gain, HYBRID_MANCHE_2.wet);
      ramp(this.wowDepth!.gain, 0);
      ramp(this.flutterDepth!.gain, 0);
      ramp(this.hissGain!.gain, 0);
      ramp(this.m1Presence!.gain, 0);
      this.m1Shaper!.curve = null;
      this.m2Shaper!.curve = this.saturationCurve(HYBRID_MANCHE_2.digitalDrive);
      // Ring vera: portante abbassata, LFO bipolare che arriva a moltiplicare.
      ramp(this.m2Ring!.gain, 1 - HYBRID_MANCHE_2.ringModDepth, 0.1);
      ramp(this.ringDepth!.gain, HYBRID_MANCHE_2.ringModDepth, 0.1);
      ramp(this.m2Trem!.gain, 1 - HYBRID_MANCHE_2.tremoloDepth / 2, 0.1);
      ramp(this.tremDepth!.gain, HYBRID_MANCHE_2.tremoloDepth / 2, 0.1);
      this.setCompressor(HYBRID_MANCHE_2.compressorThresholdDb, HYBRID_MANCHE_2.compressorRatio);
      ramp(this.gainNode!.gain, HYBRID_MANCHE_2.outputGain);
      ramp(this.m2Gate!.gain, 1);
      this.setPitchRatio(HYBRID_MANCHE_2.pitchRatio);
      this.startStutter();
      return;
    }

    // Manche 3 e 4: niente catene bagnate, solo EQ e volume.
    const clean = MANCHE_AUDIO[phase];
    if (!clean) {
      ramp(this.gainNode.gain, 0);
      return;
    }
    ramp(this.preHighpass!.frequency, clean.highpass);
    ramp(this.preLowpass!.frequency, clean.lowpass);
    ramp(this.dryGain.gain, 1);
    ramp(this.m1Wet!.gain, 0);
    ramp(this.m2Wet!.gain, 0);
    ramp(this.wowDepth!.gain, 0);
    ramp(this.flutterDepth!.gain, 0);
    ramp(this.hissGain!.gain, 0);
    ramp(this.ringDepth!.gain, 0);
    ramp(this.tremDepth!.gain, 0);
    ramp(this.m2Trem!.gain, 1);
    ramp(this.m2Gate!.gain, 1);
    this.m1Shaper!.curve = null;
    this.m2Shaper!.curve = null;
    this.setPitchRatio(1);
    this.setCompressor(phase === 3 ? -12 : -6, phase === 3 ? 1.5 : 1.2);
    ramp(this.gainNode.gain, clean.gain);
  }

  private setCompressor(threshold: number, ratio: number): void {
    if (!this.compressor || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.compressor.threshold.setTargetAtTime(threshold, now, 0.1);
    this.compressor.ratio.setTargetAtTime(ratio, now, 0.1);
  }

  /** Curva di saturazione normalizzata: nessun hard clipping, livello compensato. */
  private saturationCurve(drive: number): Float32Array<ArrayBuffer> {
    const samples = 2048;
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    const amount = 1 + drive * 6;
    const normalizer = Math.tanh(amount);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(amount * x) / normalizer;
    }
    return curve;
  }

  /**
   * Micro-chop intermittente: un gate sulla griglia di un ottavo (griglia
   * interna stabile, BPM non stimato). Solo manche 2, con ramp brevi per
   * evitare click.
   */
  private startStutter(): void {
    if (this.stutterTimer || !this.audioContext || !this.m2Gate) return;
    const ctx = this.audioContext;
    const step = HYBRID_MANCHE_2.stutterStepSeconds;
    let next = ctx.currentTime + step;
    this.stutterTimer = setInterval(() => {
      if (!this.audioContext || !this.m2Gate || this.currentPhase() !== 2) return;
      const horizon = this.audioContext.currentTime + 1.2;
      while (next < horizon) {
        const gate = this.m2Gate.gain;
        const dip = HYBRID_MANCHE_2.stutterDurationMs / 1000;
        const fade = HYBRID_MANCHE_2.stutterCrossfadeMs / 1000;
        gate.setValueAtTime(1, next);
        gate.linearRampToValueAtTime(0.12, next + fade);
        gate.setValueAtTime(0.12, next + dip);
        gate.linearRampToValueAtTime(1, next + dip + fade);
        next += step * 4;
      }
    }, 800);
  }

  private stopStutter(): void {
    if (this.stutterTimer) {
      clearInterval(this.stutterTimer);
      this.stutterTimer = undefined;
    }
    if (this.m2Gate && this.audioContext) {
      this.m2Gate.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.m2Gate.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.03);
    }
  }

  /** Manche 1 e 2 sono le uniche con il fruscio: le altre lo spengono. */
  private setInterference(phase: number): void {
    if (!this.hissGain || !this.audioContext) return;
    const value = phase === 1 ? HYBRID_MANCHE_1.hissGain : 0;
    this.hissGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.15);
  }

  private stopInterference(): void {
    if (this.hissGain && this.audioContext) {
      this.hissGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05);
    }
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = undefined;
    }
  }

  /** La copertina segue le manche: quasi illeggibile all'inizio, nitida alla fine. */
  private applyBlur(phase: number): void {
    const blur = phase === 1 ? 30 : phase === 2 ? 18 : phase === 3 ? 8 : 0;
    this.blurAmount.set(blur);
  }

  /**
   * Reveal: la traccia riparte dall'inizio, senza filtri e a volume pieno.
   * Dopo 30 secondi si ferma da sola, anche se la preview fosse più lunga.
   */
  private async startFullPlayback(): Promise<void> {
    if (this.fullPlaybackActive || this.fullPlaybackDone || !this.audio || !this.audioContext) return;

    this.fullPlaybackActive = true;
    this.fullPlaybackDone = false;
    if (this.fullPlaybackTimer) clearTimeout(this.fullPlaybackTimer);

    this.audio.loop = false;
    this.audio.currentTime = 0;
    this.applyFilters(4);
    this.blurAmount.set(0);

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      await this.audio.play();
      this.isPlaying.set(true);
      this.startVinylAnimation();
      this.scheduleFullPlaybackFade();
    } catch (err) {
      console.error('❌ Play full error:', err);
    }

    this.fullPlaybackTimer = setTimeout(() => {
      this.fullPlaybackDone = true;
      this.fullPlaybackActive = false;
      if (this.audio) this.audio.loop = true;
      this.pauseAudio();
      this.onFullPlaybackEnd.emit();
    }, FULL_PLAYBACK_SECONDS * 1000);
  }

  /** Volume pieno per 25 s, poi rampa lineare a zero negli ultimi 5. */
  private scheduleFullPlaybackFade(): void {
    const ctx = this.audioContext;
    const gain = this.gainNode;
    if (!ctx || !gain) return;

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(1, now);
    const fadeStart = now + FULL_PLAYBACK_SECONDS - FULL_PLAYBACK_FADE_SECONDS;
    gain.gain.setValueAtTime(1, fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, now + FULL_PLAYBACK_SECONDS);
  }

  private stopFullPlayback(): void {
    if (this.fullPlaybackTimer) clearTimeout(this.fullPlaybackTimer);
    this.fullPlaybackTimer = undefined;
    this.fullPlaybackActive = false;
    this.fullPlaybackDone = false;
    if (this.audio) this.audio.loop = true;
    if (this.gainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(1, now);
    }
  }

  private async playAudio() {
    if (!this.audio || !this.audioContext) return;

    if (!this.audioUnlocked) {
      await this.unlockAudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      await this.audio.play();
      this.isPlaying.set(true);
      this.startVinylAnimation();
      this.setInterference(this.currentPhase());
    } catch (err) {
      console.error('❌ Play error:', err);
    }
  }

  private pauseAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.stopVinylAnimation();
    this.stopInterference();
  }

  private startVinylAnimation() {
    const animate = () => {
      if (!this.isPlaying()) return;
      this.vinylRotation.update(r => (r + 2) % 360);
      this.vinylAnimationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  private stopVinylAnimation() {
    if (this.vinylAnimationFrame) {
      cancelAnimationFrame(this.vinylAnimationFrame);
    }
  }

  /** Scratch: il disco torna indietro di colpo e la puntina graffia la traccia. */
  private scratch(): void {
    this.scratching.set(true);
    if (this.scratchTimeout) clearTimeout(this.scratchTimeout);
    this.scratchTimeout = setTimeout(() => this.scratching.set(false), 560);

    if (!this.audioContext) return;
    const ctx = this.audioContext;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.45;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const env = Math.pow(1 - i / frames, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.3;
    band.frequency.setValueAtTime(2900, now);
    band.frequency.exponentialRampToValueAtTime(380, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(band);
    band.connect(gain);
    gain.connect(this.audioEngine.output() ?? ctx.destination);
    source.start(now);
    source.onended = () => {
      source.disconnect();
      band.disconnect();
      gain.disconnect();
    };

    // Il brano "inciampa" mentre il disco torna indietro.
    if (this.audio) {
      const previousRate = this.audio.playbackRate || 1;
      this.audio.playbackRate = 0.25;
      setTimeout(() => {
        if (this.audio) this.audio.playbackRate = previousRate;
      }, 140);
    }
  }

  ngOnDestroy() {
    this.pauseAudio();
    this.stopFullPlayback();
    this.stopVinylAnimation();
    this.stopStutter();
    if (this.scratchTimeout) clearTimeout(this.scratchTimeout);
    this.stopInterference();
    this.teardownNodes();
    // Il contesto è condiviso con gli effetti della TV: non si chiude qui.
    this.audioContext = undefined;
  }

  private teardownNodes(): void {
    this.sourceNode?.disconnect();
    for (const oscillator of [this.wowOsc, this.flutterOsc, this.ringOsc, this.tremOsc]) {
      try {
        oscillator?.stop();
      } catch {
        // già fermato
      }
      oscillator?.disconnect();
    }
    this.wowOsc = undefined;
    this.flutterOsc = undefined;
    this.ringOsc = undefined;
    this.tremOsc = undefined;
    try {
      this.hissSource?.stop();
    } catch {
      // già fermato
    }
    this.hissSource?.disconnect();
    this.hissSource = undefined;
    this.pitchNode?.disconnect();
    this.pitchNode = undefined;
    for (const node of [
      this.inputGain, this.preHighpass, this.preLowpass, this.dryGain, this.mixBus,
      this.compressor, this.gainNode, this.m1Presence, this.m1Shaper, this.m1Delay,
      this.m1Wet, this.wowDepth, this.flutterDepth, this.hissFilter, this.hissGain,
      this.m2Ring, this.ringDepth, this.pitchStage, this.m2Shaper, this.m2Gate,
      this.m2Trem, this.m2Wet, this.tremDepth,
    ]) {
      node?.disconnect();
    }
    this.inputGain = undefined;
    this.preHighpass = undefined;
    this.preLowpass = undefined;
    this.dryGain = undefined;
    this.mixBus = undefined;
    this.compressor = undefined;
    this.gainNode = undefined;
    this.m1Presence = undefined;
    this.m1Shaper = undefined;
    this.m1Delay = undefined;
    this.m1Wet = undefined;
    this.wowDepth = undefined;
    this.flutterDepth = undefined;
    this.hissFilter = undefined;
    this.hissGain = undefined;
    this.m2Ring = undefined;
    this.ringDepth = undefined;
    this.pitchStage = undefined;
    this.m2Shaper = undefined;
    this.m2Gate = undefined;
    this.m2Trem = undefined;
    this.m2Wet = undefined;
    this.tremDepth = undefined;
  }

  getPhaseColor(): string {
    const phase = this.currentPhase();
    if (phase === 0) return 'var(--paper)';
    if (phase === 1) return 'var(--tomato)';
    if (phase === 2) return 'var(--mustard)';
    if (phase === 3) return 'var(--cobalt)';
    return 'var(--mint)';
  }

  getPhaseLabel(): string {
    const phase = this.currentPhase();
    switch (phase) {
      case 0:
        return 'In attesa...';
      case 1:
        return 'Manche 1 - Irriconoscibile (nastro analogico, 25%)';
      case 2:
        return 'Manche 2 - Mutazione elettronica (50%)';
      case 3:
        return 'Manche 3 - Quasi chiaro (75%)';
      case 4:
        return 'Manche 4 - Chiaro (100%)';
      default:
        return '';
    }
  }

  getPhaseIcon(phase: number = this.currentPhase()): string {
    if (phase === 1) return '☎️';
    if (phase === 2) return '📻';
    if (phase === 3) return '🔊';
    if (phase === 4) return '📢';
    return '⏳';
  }
}
