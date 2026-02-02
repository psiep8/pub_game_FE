import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-song',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song.html',
  styleUrl: './song.css',
})
export class Song implements OnInit, OnDestroy, OnChanges {
  @Input() displayData: any;
  @Input() timer: number = 0;

  // Audio
  private audio?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;

  // 🔥 FILTRI per distorsione
  private bandpassFilter?: BiquadFilterNode;
  private highpassFilter?: BiquadFilterNode;
  private lowpassFilter?: BiquadFilterNode;
  private distortionNode?: WaveShaperNode;

  audioReady = signal(false);
  isPlaying = signal(false);
  currentPhase = signal(0);
  vinylRotation = signal(0);

  // 🔥 BLUR cover (20px = molto blur, 0px = chiaro)
  blurAmount = signal(20);

  private vinylAnimationFrame?: number;
  private audioUnlocked = false;

  ngOnInit() {
    console.log('🎵 Song component init');
    window.addEventListener('click', this.unlockAudioContext.bind(this), {once: true});
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && this.displayData) {
      const prevData = changes['displayData'].previousValue;

      // 🔥 NUOVO URL = NUOVA CANZONE
      if (prevData?.previewUrl !== this.displayData.previewUrl) {
        console.log("🎵 Nuova canzone, init audio...");
        this.blurAmount.set(20); // Reset blur
        this.initAudio().then(() => {
          if (!this.audioUnlocked) {
            this.unlockAudioContext();
          }
        });
      }

      // 🔥 PLAY/PAUSE
      const shouldPlay = this.displayData.audioPlaying;
      const actuallyPlaying = this.isPlaying();

      if (shouldPlay && !actuallyPlaying) {
        this.playAudio();
      } else if (!shouldPlay && actuallyPlaying) {
        this.pauseAudio();
      }

      // 🔥 AGGIORNA FASE E FILTRI
      const phase = this.displayData.currentPhase || 0;
      if (this.currentPhase() !== phase) {
        this.currentPhase.set(phase);
        this.applyAudioFilters(phase);
      }

      // 🔥 REVEAL = RIMUOVI BLUR
      if (this.displayData.revealed && this.blurAmount() > 0) {
        this.blurAmount.set(0);
      }
    }
  }

  /**
   * 🔓 Unlock AudioContext
   */
  private async unlockAudioContext() {
    if (this.audioUnlocked) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (this.audio) {
        this.audio.muted = true;
        await this.audio.play();
        this.audio.pause();
        this.audio.muted = false;
        this.audio.currentTime = 0;
      }

      this.audioUnlocked = true;
      console.log('✅ Audio sbloccato');

    } catch (err) {
      console.warn('⚠️ Unlock failed:', err);
    }
  }

  /**
   * 🔥 INIT AUDIO con FILTRI
   */
  private async initAudio() {
    if (!this.displayData?.previewUrl) return;

    this.audio?.pause();
    this.audio = new Audio(this.displayData.previewUrl);
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop = true;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // 🔥 CREA TUTTI I FILTRI
    this.bandpassFilter = this.audioContext.createBiquadFilter();
    this.bandpassFilter.type = 'bandpass';

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';

    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';

    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.oversample = '4x';

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0; // Parte da 0

    // 🔥 CATENA: Source → Bandpass → Highpass → Lowpass → Distortion → Gain → Destination
    this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

    this.sourceNode
      .connect(this.bandpassFilter)
      .connect(this.highpassFilter)
      .connect(this.lowpassFilter)
      .connect(this.distortionNode)
      .connect(this.gainNode)
      .connect(this.audioContext.destination);

    this.audioReady.set(true);
    console.log('✅ Catena audio con filtri pronta');
  }

  /**
   * 🔥 APPLICA FILTRI in base alla manche
   */
  private applyAudioFilters(manche: number) {
    if (!this.audioContext || !this.gainNode) return;

    console.log(`🎛️ Applicando filtri MANCHE ${manche}`);

    switch (manche) {
      case 0:
        // Attesa iniziale
        this.gainNode.gain.value = 0;
        break;

      case 1: // 25% - MOLTO DISTORTO
        this.gainNode.gain.value = 0.3;
        this.bandpassFilter!.frequency.value = 800;
        this.bandpassFilter!.Q.value = 10;
        this.highpassFilter!.frequency.value = 600;
        this.lowpassFilter!.frequency.value = 1500;
        this.distortionNode!.curve = this.makeDistortionCurve(80) as any
        console.log('🎛️ Manche 1: MOLTO distorto (25%)');
        break;

      case 2: // 50% - DISTORTO
        this.gainNode.gain.value = 0.5;
        this.bandpassFilter!.frequency.value = 1200;
        this.bandpassFilter!.Q.value = 5;
        this.highpassFilter!.frequency.value = 300;
        this.lowpassFilter!.frequency.value = 2500;
        this.distortionNode!.curve = this.makeDistortionCurve(40) as any
        console.log('🎛️ Manche 2: Distorto (50%)');
        break;

      case 3: // 75% - QUASI CHIARO
        this.gainNode.gain.value = 0.7;
        this.bandpassFilter!.frequency.value = 1500;
        this.bandpassFilter!.Q.value = 2;
        this.highpassFilter!.frequency.value = 150;
        this.lowpassFilter!.frequency.value = 4000;
        this.distortionNode!.curve = this.makeDistortionCurve(15) as any
        console.log('🎛️ Manche 3: Quasi chiaro (75%)');
        break;

      case 4: // 100% - CHIARO
        this.gainNode.gain.value = 1.0;
        this.bandpassFilter!.frequency.value = 2000;
        this.bandpassFilter!.Q.value = 0.5;
        this.highpassFilter!.frequency.value = 50;
        this.lowpassFilter!.frequency.value = 8000;
        this.distortionNode!.curve = null; // PULITO!
        console.log('🎛️ Manche 4: CHIARO (100%)');
        break;
    }
  }

  /**
   * Curva distorsione
   */
  private makeDistortionCurve(amount: number): Float32Array | null {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /**
   * ▶️ PLAY
   */
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
      console.log('▶️ Audio playing');
    } catch (err) {
      console.error('❌ Play error:', err);
    }
  }

  /**
   * ⏸️ PAUSE
   */
  private pauseAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.stopVinylAnimation();
    console.log('⏸️ Audio paused');
  }

  /**
   * 🎵 ANIMAZIONE VINILE
   */
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

  ngOnDestroy() {
    this.pauseAudio();
    this.stopVinylAnimation();
    this.audioContext?.close();
  }

  // HELPERS
  getPhaseColor(): string {
    const phase = this.currentPhase();
    if (phase === 0) return '#666';
    if (phase === 1) return '#e74c3c';
    if (phase === 2) return '#f39c12';
    if (phase === 3) return '#3498db';
    return '#27ae60';
  }

  getPhaseLabel(): string {
    const phase = this.currentPhase();
    switch (phase) {
      case 0:
        return 'In attesa...';
      case 1:
        return 'Manche 1 - Molto distorto (25%)';
      case 2:
        return 'Manche 2 - Distorto (50%)';
      case 3:
        return 'Manche 3 - Quasi chiaro (75%)';
      case 4:
        return 'Manche 4 - Chiaro (100%)';
      default:
        return '';
    }
  }

  getPhaseIcon(): string {
    const phase = this.currentPhase();
    if (phase === 0) return '⏳';
    if (phase === 1) return '🔇';
    if (phase === 2) return '🔉';
    if (phase === 3) return '🔊';
    return '📢';
  }
}
