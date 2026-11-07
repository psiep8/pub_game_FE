import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  SimpleChanges,
  OnChanges, EventEmitter, Output,
  ChangeDetectionStrategy
} from '@angular/core';
import {CommonModule} from '@angular/common';

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

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();

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
  blurAmount = signal(28);
  scratching = signal(false);

  private vinylAnimationFrame?: number;
  private audioUnlocked = false;
  private lastPhase = 0;
  private lastBuzz: string | null = null;
  private scratchTimeout?: ReturnType<typeof setTimeout>;
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
        // Una prenotazione ferma subito il brano, anche durante il reveal a
        // volume pieno: il loop non deve continuare sotto la risposta.
        this.stopFullPlayback();
        this.pauseAudio();
      }
      this.lastBuzz = nextBuzz;

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

    

    switch (phase) {
      case 1: 
        // Prima manche volutamente irriconoscibile: banda strettissima,
        // saturazione alta e volume basso. Si capisce solo il ritmo.
        this.gainNode.gain.setValueAtTime(0.16, this.audioContext.currentTime);
        
        this.bandpassFilter!.frequency.setValueAtTime(620, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(28, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(740, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(880, this.audioContext.currentTime);
        
        this.distortionNode!.curve = this.makeDistortionCurve(320) as any;
        
        break;

      case 2: 
        this.gainNode.gain.setValueAtTime(0.24, this.audioContext.currentTime);
        
        this.bandpassFilter!.frequency.setValueAtTime(820, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(18, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(600, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(1250, this.audioContext.currentTime);
        
        this.distortionNode!.curve = this.makeDistortionCurve(150) as any;
        
        break;

      case 3: 
        this.gainNode.gain.setValueAtTime(0.45, this.audioContext.currentTime);
        this.bandpassFilter!.frequency.setValueAtTime(1400, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(8, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(380, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(2600, this.audioContext.currentTime);
        
        this.distortionNode!.curve = this.makeDistortionCurve(45) as any;
        
        break;

      case 4: 
        this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        this.bandpassFilter!.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        this.bandpassFilter!.Q.setValueAtTime(0.5, this.audioContext.currentTime);
        this.highpassFilter!.frequency.setValueAtTime(50, this.audioContext.currentTime);
        this.lowpassFilter!.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        this.distortionNode!.curve = null; 
        
        break;

      default:
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        break;
    }
  }

  /** La copertina segue le manche: quasi illeggibile all'inizio, nitida alla fine. */
  private applyBlur(phase: number): void {
    const blur = phase === 1 ? 30 : phase === 2 ? 18 : phase === 3 ? 8 : 0;
    this.blurAmount.set(blur);
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

  /**
   * Reveal: la traccia riparte dall'inizio, senza filtri e a volume pieno.
   * Dopo 30 secondi si ferma da sola, anche se la preview fosse piu lunga.
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
    } catch (err) {
      console.error('❌ Play full error:', err);
    }

    this.fullPlaybackTimer = setTimeout(() => {
      this.fullPlaybackDone = true;
      this.fullPlaybackActive = false;
      // Il prossimo ascolto torna in loop: la pausa del reveal non spegne il
      // comportamento delle manche successive.
      if (this.audio) this.audio.loop = true;
      this.pauseAudio();
    }, 30000);
  }

  private stopFullPlayback(): void {
    if (this.fullPlaybackTimer) clearTimeout(this.fullPlaybackTimer);
    this.fullPlaybackTimer = undefined;
    this.fullPlaybackActive = false;
    this.fullPlaybackDone = false;
    if (this.audio) this.audio.loop = true;
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
      
    } catch (err) {
      console.error('❌ Play error:', err);
    }
  }

  private pauseAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.stopVinylAnimation();
    
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
    gain.connect(ctx.destination);
    source.start(now);

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
    if (this.scratchTimeout) clearTimeout(this.scratchTimeout);
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
        return 'Manche 1 - Irriconoscibile (25%)';
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
