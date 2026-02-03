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

  private audio?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;

  private bandpassFilter?: BiquadFilterNode;
  private highpassFilter?: BiquadFilterNode;
  private lowpassFilter?: BiquadFilterNode;
  private distortionNode?: WaveShaperNode;

  audioReady = signal(false);
  isPlaying = signal(false);
  currentPhase = signal(0);
  vinylRotation = signal(0);
  blurAmount = signal(20);

  private vinylAnimationFrame?: number;
  private audioUnlocked = false;
  private lastPhase = 0;

  ngOnInit() {
    console.log('🎵 Song init');

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

      if (prevData?.previewUrl !== this.displayData.previewUrl) {
        console.log("🎵 Nuova canzone!");
        this.blurAmount.set(20);
        this.currentPhase.set(0);
        this.lastPhase = 0;
        this.initAudio();
      }

      const phase = this.displayData.currentPhase || 0;
      if (this.lastPhase !== phase && phase > 0) {
        console.log(`🎛️ Fase cambiata: ${this.lastPhase} → ${phase}`);
        this.lastPhase = phase;
        this.currentPhase.set(phase);
        this.applyFilters(phase);
      }

      const shouldPlay = this.displayData.audioPlaying;
      const actuallyPlaying = this.isPlaying();

      if (shouldPlay && !actuallyPlaying) {
        this.playAudio();
      } else if (!shouldPlay && actuallyPlaying) {
        this.pauseAudio();
      }

      if (this.displayData.revealed && this.blurAmount() > 0) {
        this.blurAmount.set(0);
      }
    }
  }

  private async unlockAudioContext() {
    if (this.audioUnlocked) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

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
      console.log('✅ Audio SBLOCCATO');

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

      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }

      this.audio = new Audio(this.displayData.previewUrl);
      this.audio.crossOrigin = 'anonymous';
      this.audio.loop = true;
      this.audio.preload = 'auto';

      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      this.bandpassFilter = this.audioContext.createBiquadFilter();
      this.bandpassFilter.type = 'bandpass';

      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';

      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';

      this.distortionNode = this.audioContext.createWaveShaper();
      this.distortionNode.oversample = '4x';

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0;

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      this.sourceNode
        .connect(this.bandpassFilter)
        .connect(this.highpassFilter)
        .connect(this.lowpassFilter)
        .connect(this.distortionNode)
        .connect(this.gainNode)
        .connect(this.audioContext.destination);

      this.audioReady.set(true);
      console.log('✅ Audio ready');

      if (!this.audioUnlocked) {
        await this.unlockAudioContext();
      }

    } catch (error) {
      console.error('❌ Init audio error:', error);
    }
  }

  /**
   * 🎛️ FILTRI BILANCIATI - Voce capibile ma canzone irriconoscibile
   */
  private applyFilters(phase: number) {
    if (!this.audioContext || !this.gainNode) return;

    console.log(`🎛️ APPLICANDO FILTRI FASE ${phase}`);

    switch (phase) {
      case 1: // 🔥 MANCHE 1: QUASI INCOMPRENSIBILE
        this.gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime);
        // Banda STRETTISSIMA = voce robotica alienata
        this.bandpassFilter!.frequency.setValueAtTime(750, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(18, this.audioContext.currentTime); // Q ALTISSIMO
        this.highpassFilter!.frequency.setValueAtTime(650, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(1100, this.audioContext.currentTime);
        // Distorsione MOLTO PESANTE
        this.distortionNode!.curve = this.makeDistortionCurve(70) as any;
        console.log('🔥 Fase 1: QUASI INCOMPRENSIBILE - voce robotica aliena');
        break;

      case 2: // 🔥 MANCHE 2: MOLTO DIFFICILE
        this.gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        // Banda ancora stretta
        this.bandpassFilter!.frequency.setValueAtTime(950, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(12, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(550, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(1600, this.audioContext.currentTime);
        // Distorsione PESANTE
        this.distortionNode!.curve = this.makeDistortionCurve(50) as any;
        console.log('🔥 Fase 2: MOLTO DIFFICILE - telefono rotto');
        break;

      case 3: // 🔥 MANCHE 3: DIFFICILE
        this.gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        this.bandpassFilter!.frequency.setValueAtTime(1300, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(7, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(400, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(2400, this.audioContext.currentTime);
        // Distorsione MEDIA
        this.distortionNode!.curve = this.makeDistortionCurve(25) as any;
        console.log('🔥 Fase 3: DIFFICILE - radio interferenze');
        break;

      case 4: // ✅ MANCHE 4: CHIARO
        this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        this.bandpassFilter!.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(0.5, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(50, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        this.distortionNode!.curve = null; // NESSUNA distorsione
        console.log('✅ Fase 4: CHIARO');
        break;

      default:
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        break;
    }
  }

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
      console.log('▶️ Audio PLAYING');
    } catch (err) {
      console.error('❌ Play error:', err);
    }
  }

  private pauseAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.stopVinylAnimation();
    console.log('⏸️ Audio PAUSED');
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

  ngOnDestroy() {
    this.pauseAudio();
    this.stopVinylAnimation();
    this.audioContext?.close();
  }

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
        return 'Manche 1 - Effetto telefono (25%)';
      case 2:
        return 'Manche 2 - Radio AM (50%)';
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
    if (phase === 1) return '☎️';
    if (phase === 2) return '📻';
    if (phase === 3) return '🔊';
    return '📢';
  }
}
