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
  private audioUnlocked = false; // Flag per sapere se AudioContext è stato sbloccato

  ngOnInit() {
    console.log('🎵 Song component init');

    // 🔥 LISTENER GLOBALE per sbloccare audio al primo click
    window.addEventListener('click', this.unlockAudioContext.bind(this), {once: true});
    window.addEventListener('keydown', this.unlockAudioContext.bind(this), {once: true});
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && this.displayData) {
      const prevData = changes['displayData'].previousValue;

      // 1. CARICA AUDIO: Solo se l'URL cambia davvero
      if (prevData?.previewUrl !== this.displayData.previewUrl) {
        console.log("🎵 Nuovo URL rilevato, inizializzo audio...");
        this.initAudio().then(() => {
          console.log('✅ Audio inizializzato');
          // 🔥 Sblocca subito se non già fatto
          if (!this.audioUnlocked) {
            this.unlockAudioContext();
          }
        });
      }

      // 2. GESTIONE PLAY/PAUSA
      const shouldBePlaying = this.displayData.audioPlaying;
      const isActuallyPlaying = this.isPlaying();

      // Buzz ha priorità
      // if (this.displayData.buzzedPlayer && isActuallyPlaying) {
      //   this.pauseAudio();
      // } else if (shouldBePlaying !== isActuallyPlaying) {
      //   if (shouldBePlaying) {
      //     this.playAudio();
      //   } else {
      //     this.pauseAudio();
      //   }
      // }
      this.playAudio();

      // 3. DISTORSIONE: Solo se fase cambiata
      const phase = this.displayData.currentPhase || 0;
      if (this.currentPhase() !== phase) {
        this.currentPhase.set(phase);
        this.updateAudioDistortion(phase);
      }
    }
  }

  /**
   * 🔓 SBLOCCA AudioContext (richiesto da browser policy)
   */
  private async unlockAudioContext() {
    if (this.audioUnlocked) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume se sospeso
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔓 AudioContext resumed');
      }

      // Play/pause trick per sbloccare autoplay
      if (this.audio) {
        this.audio.muted = true;
        await this.audio.play();
        this.audio.pause();
        this.audio.muted = false;
        this.audio.currentTime = 0;
        console.log('🔓 Audio unlocked');
      }

      this.audioUnlocked = true;
      console.log('✅ Audio completamente sbloccato');

    } catch (err) {
      console.warn('⚠️ Unlock audio failed (potrebbe servire click utente):', err);
    }
  }

  /**
   * Setup audio con Web Audio API
   */
  private async initAudio() {
    if (!this.displayData?.previewUrl) return;

    // Distruggi eventuale audio precedente
    this.audio?.pause();

    this.audio = new Audio(this.displayData.previewUrl);
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop = true;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // 🔥 NESSUN PROBLEMA CON APPLE MUSIC
    this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1;

    this.sourceNode
      .connect(this.gainNode)
      .connect(this.audioContext.destination);

    this.audioReady.set(true);
    console.log('✅ Audio Apple Music pronto');
  }

  private setupAudioFilters() {
    if (!this.audioContext) return;

    // Inizializza tutti i nodi
    this.bandpassFilter = this.audioContext.createBiquadFilter();
    this.bandpassFilter.type = 'bandpass';

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';

    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';

    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.oversample = '4x';

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0; // Parte da 0, verrà settato dalla fase

    // Applica valori iniziali
    this.updateAudioDistortion(this.currentPhase());
  }

  /**
   * 🔥 FORZA START AUDIO (chiamato da bottone debug)
   */
  public async forceStartAudio() {
    console.log('🔥 Force start audio...');
    await this.unlockAudioContext();

    if (this.audio && this.audioReady()) {
      try {
        await this.audio.play();
        this.isPlaying.set(true);
        this.startVinylAnimation();
        console.log('✅ Audio forzato a partire');
      } catch (err) {
        console.error('❌ Force play failed:', err);
      }
    }
  }

  /**
   * 🎵 AGGIORNA DISTORSIONE in base alla fase
   */
  private updateAudioDistortion(phase: number) {
    if (!this.audioContext || !this.gainNode) return;

    if (phase === 0) {
      this.gainNode.gain.value = 0;
      console.log('🔇 Phase 0: audio spento');
      return;
    }

    console.log(`🎛️ Updating distortion for phase ${phase}`);

    switch (phase) {
      case 1:
        this.gainNode.gain.value = 0.3;
        this.bandpassFilter!.frequency.value = 800;
        this.bandpassFilter!.Q.value = 10;
        this.highpassFilter!.frequency.value = 600;
        this.lowpassFilter!.frequency.value = 1500;
        this.distortionNode!.curve = this.makeDistortionCurve(80) as any;
        console.log('🎛️ Fase 1: MOLTO distorto (25%)');
        break;

      case 2:
        this.gainNode.gain.value = 0.5;
        this.bandpassFilter!.frequency.value = 1200;
        this.bandpassFilter!.Q.value = 5;
        this.highpassFilter!.frequency.value = 300;
        this.lowpassFilter!.frequency.value = 2500;
        this.distortionNode!.curve = this.makeDistortionCurve(40) as any;
        console.log('🎛️ Fase 2: Distorto (50%)');
        break;

      case 3:
        this.gainNode.gain.value = 0.7;
        this.bandpassFilter!.frequency.value = 1500;
        this.bandpassFilter!.Q.value = 2;
        this.highpassFilter!.frequency.value = 150;
        this.lowpassFilter!.frequency.value = 4000;
        this.distortionNode!.curve = this.makeDistortionCurve(15) as any;
        console.log('🎛️ Fase 3: Quasi chiaro (75%)');
        break;

      case 4:
        this.gainNode.gain.value = 1.0;
        this.bandpassFilter!.frequency.value = 2000;
        this.bandpassFilter!.Q.value = 0.5;
        this.highpassFilter!.frequency.value = 50;
        this.lowpassFilter!.frequency.value = 8000;
        this.distortionNode!.curve = null; // PULITO!
        console.log('🎛️ Fase 4: CHIARO (100%)');
        break;
    }
  }

  /**
   * Crea curva di distorsione
   */
  /**
   * Crea curva di distorsione
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Formula classica per la distorsione soft-clipping
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /**
   * ▶️ Play audio
   */
  private async playAudio() {
    if (!this.audio || !this.audioContext) {
      console.warn('⚠️ Audio non inizializzato');
      return;
    }

    // 🔥 SBLOCCA se necessario
    if (!this.audioUnlocked) {
      await this.unlockAudioContext();
    }

    // Resume AudioContext
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
      console.log('💡 Potrebbe servire interazione utente - clicca il bottone!');
    }
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
   * 🎵 Animazione vinile
   */
  private startVinylAnimation() {
    const animate = () => {
      if (!this.isPlaying()) return;
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

    // Rimuovi listeners
    window.removeEventListener('click', this.unlockAudioContext.bind(this));
    window.removeEventListener('keydown', this.unlockAudioContext.bind(this));
  }

  // 🎨 HELPERS per template

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
