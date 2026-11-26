import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  signal,
  SimpleChanges,
  OnChanges,
  EventEmitter,
  Output,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import {CommonModule} from '@angular/common';
import { AudioService } from '../../../core/services/audio.service';

/**
 * Audio del round Musica.
 *
 * Niente filtri, pitch, ring, stutter o fruscio: il brano si sente pulito.
 * Restano il gain (fade di 60 ms in testa e in coda a ogni taglio), il
 * compressore di sicurezza e la copertina sfocata come indizio visivo.
 *
 * Ogni ascolto riparte da zero e si ferma alla durata decisa dal mode; la
 * manca successiva è già precaricata, così non c'è un buco fra i due brani.
 */
const FADE_SECONDS = 0.06;

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
  /** Il cerchio del timer resta visibile finché si può prenotare. */
  @Input() timerVisible = true;

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();
  /** Riservato alla regia: il mode chiude da solo il round dopo il reveal. */
  @Output() onFullPlaybackEnd = new EventEmitter<void>();

  private audioEngine = inject(AudioService);
  private audio?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;
  private compressor?: DynamicsCompressorNode;

  private preloaded?: HTMLAudioElement;
  private preloadedUrl = '';
  private currentUrl = '';

  audioReady = signal(false);
  isPlaying = signal(false);
  blurAmount = signal(26);

  private audioUnlocked = false;
  private listenToken = '';
  private stopTimeout?: ReturnType<typeof setTimeout>;

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
      const previous = changes['displayData'].previousValue;
      const previewUrl = String(this.displayData.previewUrl ?? '');
      if (previewUrl && previous?.previewUrl !== previewUrl) {
        this.initAudio(previewUrl);
      }

      const nextUrl = String(this.displayData.nextPreviewUrl ?? '');
      if (nextUrl) {
        this.preload(nextUrl);
      }

      // Un taglio (nuova manca, nuovo ascolto, reveal) ricrea il grafo audio
      // solo se il brano cambia; per lo stesso brano si riparte da zero.
      const token = [
        this.displayData.round,
        this.displayData.manche,
        this.displayData.listen,
        this.displayData.phase,
      ].join('-');
      if (token !== this.listenToken) {
        this.listenToken = token;
        this.applyBlur();
        if (this.displayData.audioPlaying) {
          void this.playFrom(Number(this.displayData.audioOffset) || 0);
        } else {
          this.stopAudio();
        }
      } else if (this.displayData.audioPlaying && !this.isPlaying()) {
        void this.playFrom(Number(this.displayData.audioOffset) || 0);
      } else if (!this.displayData.audioPlaying && this.isPlaying()) {
        this.stopAudio();
      }

      if (this.displayData.revealed) {
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
        } catch {
          // il browser non ha ancora sbloccato l'audio: si riprova al gesto
        }
        this.audio.muted = false;
        this.audio.currentTime = 0;
      }
      this.audioUnlocked = true;
    } catch (error) {
      console.warn('⚠️ Unlock failed:', error);
    }
  }

  /** Il grafo si ricrea a ogni previewUrl: un elemento media ha una sola source. */
  private initAudio(url: string): void {
    if (!url || (url === this.currentUrl && this.audio)) return;

    this.teardown();
    let element: HTMLAudioElement | undefined;
    if (this.preloaded && this.preloadedUrl === url) {
      element = this.preloaded;
      this.preloaded = undefined;
      this.preloadedUrl = '';
    } else {
      element = new Audio(url);
    }
    element.crossOrigin = 'anonymous';
    element.loop = false;
    element.preload = 'auto';

    this.audio = element;
    this.currentUrl = url;

    try {
      this.audioContext ??= this.audioEngine.context();
      if (!this.audioContext) return;
      this.buildGraph(this.audioContext);
      this.audioReady.set(true);
    } catch (error) {
      console.error('❌ Init audio error:', error);
    }
  }

  private buildGraph(ctx: AudioContext): void {
    if (!this.audio) return;
    const out = this.audioEngine.output() ?? ctx.destination;
    this.sourceNode = ctx.createMediaElementSource(this.audio);
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 2.5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.sourceNode.connect(this.gainNode).connect(this.compressor).connect(out);
  }

  private preload(url: string): void {
    if (!url || url === this.currentUrl || url === this.preloadedUrl) return;
    if (this.preloaded) this.preloaded.src = '';
    const element = new Audio(url);
    element.crossOrigin = 'anonymous';
    element.preload = 'auto';
    element.load();
    this.preloaded = element;
    this.preloadedUrl = url;
  }

  /** Riparte sempre da zero (o dall'offset della ripresa TV) con fade in. */
  private async playFrom(offsetSeconds: number): Promise<void> {
    if (!this.audio) return;
    if (!this.audioUnlocked) await this.unlockAudioContext();
    const ctx = this.audioContext;
    if (ctx?.state === 'suspended') await ctx.resume();

    try {
      this.audio.currentTime = Math.max(0, Number(offsetSeconds) || 0);
      if (ctx && this.gainNode) {
        const now = ctx.currentTime;
        const gain = this.gainNode.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0.0001, now);
        gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
      }
      await this.audio.play();
      this.isPlaying.set(true);
    } catch (error) {
      console.error('❌ Play error:', error);
    }
  }

  /** Taglio con fade di 60 ms in coda: nessun click fra gli ascolti. */
  private stopAudio(): void {
    if (!this.audio) {
      this.isPlaying.set(false);
      return;
    }
    const ctx = this.audioContext;
    const gain = this.gainNode;
    if (ctx && gain && !this.audio.paused) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + FADE_SECONDS);
    }
    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    this.stopTimeout = setTimeout(() => {
      if (!this.audio) return;
      this.audio.pause();
      this.audio.currentTime = 0;
      if (this.gainNode && this.audioContext) {
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
      }
    }, Math.round(FADE_SECONDS * 1000) + 10);

    this.isPlaying.set(false);
  }

  private applyBlur(): void {
    if (this.displayData?.revealed) {
      this.blurAmount.set(0);
      return;
    }
    const listen = Number(this.displayData?.listen) || 1;
    this.blurAmount.set(listen === 1 ? 26 : 14);
  }

  ngOnDestroy() {
    this.stopAudio();
    if (this.stopTimeout) clearTimeout(this.stopTimeout);
    this.teardown();
    if (this.preloaded) this.preloaded.src = '';
    this.preloaded = undefined;
    // Il contesto è condiviso con gli effetti della TV: non si chiude qui.
    this.audioContext = undefined;
  }

  private teardown(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.sourceNode?.disconnect();
    this.gainNode?.disconnect();
    this.compressor?.disconnect();
    this.sourceNode = undefined;
    this.gainNode = undefined;
    this.compressor = undefined;
    this.audio = undefined;
    this.currentUrl = '';
    this.audioReady.set(false);
    this.isPlaying.set(false);
  }

  // ------------------------------------------------------------------ Vista

  get phaseSeconds(): number {
    return Math.max(1, Number(this.displayData?.phaseSeconds) || 1);
  }

  get phaseLabel(): string {
    const phase = String(this.displayData?.phase ?? 'IDLE');
    if (phase === 'LISTEN') {
      return Number(this.displayData?.listen) === 2 ? 'SECONDO ASCOLTO' : 'PRIMO ASCOLTO';
    }
    if (phase === 'BUZZ') return 'PRENOTAZIONE';
    if (phase === 'REVEAL') return 'REVEAL';
    return 'IN ATTESA';
  }

  get phaseHint(): string {
    const phase = String(this.displayData?.phase ?? 'IDLE');
    if (phase === 'LISTEN') {
      return Number(this.displayData?.listen) === 2
        ? 'Dodici secondi dall’inizio del brano'
        : 'Quattro secondi: ascolta e riconosci';
    }
    if (phase === 'BUZZ') return 'Audio fermo: cinque secondi per prenotarsi';
    if (phase === 'REVEAL') return 'Brano pulito, soluzione in chiaro';
    return 'La manca sta per partire';
  }

  get timerOffset(): number {
    return 283 - (283 * Math.min(this.timer, this.phaseSeconds)) / this.phaseSeconds;
  }
}
