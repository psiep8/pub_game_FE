import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  SimpleChanges,
  OnChanges,
  Output,
  EventEmitter
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

  // Audio player
  private audio?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;

  // Filtri per distorsione
  private bandpassFilter?: BiquadFilterNode;
  private highpassFilter?: BiquadFilterNode;
  private lowpassFilter?: BiquadFilterNode;
  private distortionNode?: WaveShaperNode;

  audioReady = signal(false);
  isPlaying = signal(false);
  currentPhase = signal(0);
  vinylRotation = signal(0);

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();

  // Animation
  private vinylAnimationFrame?: number;

  ngOnInit() {
    console.log('🎵 Song component init');
    this.initAudio();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && this.displayData) {

      // 1. Se l'URL cambia, resetta tutto l'audio
      if (changes['displayData'].previousValue?.previewUrl !== this.displayData.previewUrl) {
        this.initAudio(); // Carica la nuova canzone
      }

      // 2. Gestione Play/Pause basata sul flag del backend
      const playing = this.displayData.audioPlaying;
      if (playing && !this.isPlaying()) {
        this.playAudio();
      } else if (!playing && this.isPlaying()) {
        this.pauseAudio();
      }

      // 3. Aggiorna la distorsione se la fase è cambiata
      const phase = this.displayData.currentPhase || 0;
      if (this.currentPhase() !== phase) {
        this.currentPhase.set(phase);
        this.updateAudioDistortion(phase);
      }
    }
  }

  /**
   * Setup audio con Web Audio API
   */
  private async initAudio() {
    // Se c'è già un audio che suona, fermalo e pulisci
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
    }

    if (!this.displayData?.previewUrl) return;

    try {
      this.audio = new Audio(this.displayData.previewUrl);
      this.audio.crossOrigin = 'anonymous';
      this.audio.loop = true;

      // Inizializza il contesto solo se non esiste
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Disconnetti i vecchi nodi se esistono
      this.sourceNode?.disconnect();

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Re-inizializza i filtri
      this.setupAudioFilters();

      // Riconnetti la catena
      this.sourceNode
        .connect(this.bandpassFilter!)
        .connect(this.highpassFilter!)
        .connect(this.lowpassFilter!)
        .connect(this.distortionNode!)
        .connect(this.gainNode!) // gainNode deve essere creato in setupAudioFilters
        .connect(this.audioContext.destination);

      this.audioReady.set(true);

      // Se il backend dice che deve già suonare, prova il play
      if (this.displayData.audioPlaying) {
        this.playAudio();
      }

    } catch (error) {
      console.error('❌ Errore inizializzazione audio:', error);
    }
  }
  /**
   * 🎛️ Setup filtri audio per distorsione
   */
  private setupAudioFilters() {
    if (!this.audioContext) return;

    // Bandpass filter (isola frequenze centrali)
    this.bandpassFilter = this.audioContext.createBiquadFilter();
    this.bandpassFilter.type = 'bandpass';
    this.bandpassFilter.frequency.value = 1000;
    this.bandpassFilter.Q.value = 1;

    // Highpass filter (taglia bassi)
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 200;

    // Lowpass filter (taglia alti)
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 4000;

    // Distortion (waveshaper)
    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode!.curve =
      this.makeDistortionCurve(0) as Float32Array<ArrayBuffer>;
    this.distortionNode.oversample = '4x';
  }

  /**
   * 🎵 AGGIORNA DISTORSIONE in base alla fase
   */
  private updateAudioDistortion(phase: number) {
    if (!this.audioContext) return;

    console.log(`🎛️ Updating distortion for phase ${phase}`);

    switch (phase) {
      case 0:
        // Silenzio / non iniziato
        this.gainNode!.gain.value = 0;
        break;

      case 1:
        // FASE 1 (25%) - MOLTO DISTORTO
        this.gainNode!.gain.value = 0.3;
        this.bandpassFilter!.frequency.value = 800;
        this.bandpassFilter!.Q.value = 10; // Molto stretto
        this.highpassFilter!.frequency.value = 600;
        this.lowpassFilter!.frequency.value = 1500;
        this.distortionNode!.curve =
          this.makeDistortionCurve(80) as Float32Array<ArrayBuffer>;
        console.log('🎛️ Fase 1: Audio MOLTO distorto (25%)');
        break;

      case 2:
        // FASE 2 (50%) - DISTORTO
        this.gainNode!.gain.value = 0.5;
        this.bandpassFilter!.frequency.value = 1200;
        this.bandpassFilter!.Q.value = 5;
        this.highpassFilter!.frequency.value = 300;
        this.lowpassFilter!.frequency.value = 2500;
        this.distortionNode!.curve =
          this.makeDistortionCurve(40) as Float32Array<ArrayBuffer>;
        console.log('🎛️ Fase 2: Audio distorto (50%)');
        break;

      case 3:
        // FASE 3 (75%) - QUASI CHIARO
        this.gainNode!.gain.value = 0.7;
        this.bandpassFilter!.frequency.value = 1500;
        this.bandpassFilter!.Q.value = 2;
        this.highpassFilter!.frequency.value = 150;
        this.lowpassFilter!.frequency.value = 4000;
        this.distortionNode!.curve =
          this.makeDistortionCurve(15) as Float32Array<ArrayBuffer>;
        console.log('🎛️ Fase 3: Audio quasi chiaro (75%)');
        break;

      case 4:
        // FASE 4 (100%) - CHIARO
        this.gainNode!.gain.value = 1.0;
        this.bandpassFilter!.frequency.value = 2000;
        this.bandpassFilter!.Q.value = 0.5; // Quasi flat
        this.highpassFilter!.frequency.value = 50;
        this.lowpassFilter!.frequency.value = 8000;
        this.distortionNode!.curve =
          this.makeDistortionCurve(0) as Float32Array<ArrayBuffer>;
        console.log('🎛️ Fase 4: Audio CHIARO (100%)');
        break;
    }
  }

  /**
   * Crea curva di distorsione
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);

    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) /
        (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }


  /**
   * ▶️ Play audio
   */
  private playAudio() {
    if (!this.audio || !this.audioContext) return;

    // Resume AudioContext (browser policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.audio.play().then(() => {
      this.isPlaying.set(true);
      this.startVinylAnimation();
      console.log('▶️ Audio playing');
    }).catch(err => {
      console.error('❌ Play error:', err);
    });
  }

  /**
   * ⏸️ Pause audio
   */
  private pauseAudio() {
    if (!this.audio) return;

    this.audio.pause();
    this.isPlaying.set(false);
    this.stopVinylAnimation();
    console.log('⏸️ Audio paused');
  }

  /**
   * 🎵 Animazione vinile (gira quando suona)
   */
  private startVinylAnimation() {
    const animate = () => {
      if (!this.isPlaying()) return;

      // Ruota di 1 grado per frame (360° = 1 rotazione completa)
      this.vinylRotation.update(r => (r + 1) % 360);

      this.vinylAnimationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  private stopVinylAnimation() {
    if (this.vinylAnimationFrame) {
      cancelAnimationFrame(this.vinylAnimationFrame);
      this.vinylAnimationFrame = undefined;
    }
  }

  ngOnDestroy() {
    this.pauseAudio();
    this.stopVinylAnimation();
    this.audioContext?.close();
  }

  // 🎨 HELPERS per template

  getPhaseColor(): string {
    const phase = this.currentPhase();
    if (phase === 0) return '#666';
    if (phase === 1) return '#e74c3c'; // Rosso (difficile)
    if (phase === 2) return '#f39c12'; // Arancione
    if (phase === 3) return '#3498db'; // Blu
    return '#27ae60'; // Verde (facile)
  }

  getPhaseLabel(): string {
    const phase = this.currentPhase();
    switch (phase) {
      case 0:
        return 'In attesa...';
      case 1:
        return 'Fase 1 - Molto distorto (25%)';
      case 2:
        return 'Fase 2 - Distorto (50%)';
      case 3:
        return 'Fase 3 - Quasi chiaro (75%)';
      case 4:
        return 'Fase 4 - Chiaro (100%)';
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
