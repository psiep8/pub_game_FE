import { Component, Input, signal, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Roulette in stile "carta e inchiostro".
 *
 * La ruota non usa più una transizione CSS: il moto è calcolato a ogni frame
 * con una curva di decelerazione, così possiamo sapere esattamente quando un
 * piolo passa sotto il triangolo. Il triangolo è un vero flapper fisico:
 * riceve un impulso a ogni contatto, torna indietro con una molla smorzata e
 * rimbalza sui pioli. Ogni contatto genera anche il suo click sintetizzato.
 */
@Component({
  selector: 'app-roulette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './roulette.css',
})
export class Roulette implements OnInit, OnDestroy, OnChanges {
  @Input() displayData: any;
  @Input() timer: number = 0;

  isSpinning = signal(false);
  wheelRotation = signal(0);
  showWinner = signal(false);
  winningColor = signal<string | null>(null);

  pointerAngle = signal(0);
  pointerSuspense = signal(false);

  /** Palette mutata: stessa semantica dei colori, tono da tabellone stampato. */
  colorMap: Record<string, string> = {
    'ROSSO': '#b23b2e',
    'NERO': '#211a14',
    'VERDE': '#456b45',
    'BLU': '#345a72',
    'GIALLO': '#d6a441',
    'BIANCO': '#efe2c9'
  };

  segments = signal<string[]>([]);
  Math = Math;

  private spinTimeout: any;
  private pointerReturnTimeout: any;
  private hasStartedSpin = false;
  private lastShowGo = false;
  private hasFinishedSpinning = false;
  private audioCtx: AudioContext | null = null;

  private spinStartTime = 0;
  private spinDuration = 18000;
  private totalRotation = 0;
  private targetColor = 'ROSSO';

  // Fisica del flapper: angolo in gradi, velocità in gradi/secondo.
  private flapperAngle = 0;
  private flapperVelocity = 0;
  private lastFrame = 0;
  private lastPegIndex = 0;
  private lastClickAt = 0;
  private rafId = 0;
  private settling = false;
  private settleUntil = 0;

  ngOnInit() {
    this.generateSegments();
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {}
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && !changes['displayData'].firstChange) {
      const oldData = changes['displayData'].previousValue;
      const newData = changes['displayData'].currentValue;
      if (oldData?.correctAnswer !== newData?.correctAnswer) {
        this.resetRoulette();
        this.generateSegments();
      }
    }

    if (this.displayData) {
      const currentShowGo = this.displayData.showGo || false;
      if (!this.lastShowGo && currentShowGo && !this.hasStartedSpin && !this.hasFinishedSpinning) {
        setTimeout(() => this.startSpin(), 1500);
        this.hasStartedSpin = true;
      }
      this.lastShowGo = currentShowGo;
    }
  }

  ngOnDestroy() {
    this.clearAllTimers();
    if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
  }

  private clearAllTimers() {
    if (this.spinTimeout) clearTimeout(this.spinTimeout);
    if (this.pointerReturnTimeout) clearTimeout(this.pointerReturnTimeout);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private resetRoulette() {
    this.clearAllTimers();
    this.isSpinning.set(false);
    this.wheelRotation.set(0);
    this.showWinner.set(false);
    this.winningColor.set(null);
    this.pointerAngle.set(0);
    this.pointerSuspense.set(false);
    this.hasStartedSpin = false;
    this.lastShowGo = false;
    this.hasFinishedSpinning = false;
    this.flapperAngle = 0;
    this.flapperVelocity = 0;
    this.settling = false;
  }

  private generateSegments() {
    const colors = Object.keys(this.colorMap);
    const segmentCount = 24;
    const sequence: string[] = [];
    for (let i = 0; i < segmentCount; i++) {
      const lastColor = sequence[i - 1];
      let available = colors.filter(c => c !== lastColor);
      if (i === segmentCount - 1) available = available.filter(c => c !== sequence[0]);
      sequence.push(available[Math.floor(Math.random() * available.length)]);
    }
    this.segments.set(sequence);
  }

  private startSpin() {
    if (this.isSpinning() || this.hasFinishedSpinning) return;

    this.isSpinning.set(true);
    this.showWinner.set(false);
    this.winningColor.set(null);

    const winningColor = this.displayData?.correctAnswer || 'ROSSO';
    const segments = this.segments();
    const segCount = segments.length;
    const degreesPerSegment = 360 / segCount;

    const winningIndices = segments
      .map((c, i) => c === winningColor ? i : -1)
      .filter(i => i !== -1);
    const targetIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];

    const segmentCenterAngle = targetIndex * degreesPerSegment + degreesPerSegment / 2;
    const rotationToAlign = (360 - segmentCenterAngle) % 360;
    const extraSpins = (10 + Math.floor(Math.random() * 5)) * 360;
    const jitter = (Math.random() - 0.5) * degreesPerSegment * 0.7;

    this.targetColor = winningColor;
    this.totalRotation = extraSpins + rotationToAlign + jitter;
    this.spinDuration = 18000;
    this.spinStartTime = performance.now();
    this.lastFrame = this.spinStartTime;
    this.lastPegIndex = 0;
    this.flapperAngle = 0;
    this.flapperVelocity = 0;
    this.settling = false;
    this.wheelRotation.set(0);

    this.startPhysicsLoop(segCount);
  }

  private startPhysicsLoop(segCount: number) {
    const degreesPerSegment = 360 / segCount;
    const peakVelocity = this.peakVelocity();

    const frame = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - this.lastFrame) / 1000));
      this.lastFrame = now;

      if (!this.settling) {
        const elapsed = now - this.spinStartTime;
        const t = Math.min(elapsed / this.spinDuration, 1);
        const rotation = this.totalRotation * this.easeOutQuint(t);
        this.wheelRotation.set(rotation);

        const velocity = this.angularVelocity(t);
        const pegIndex = Math.floor(rotation / degreesPerSegment);

        if (pegIndex > this.lastPegIndex) {
          const hits = Math.min(pegIndex - this.lastPegIndex, 3);
          for (let i = 0; i < hits; i++) {
            this.hitPeg(velocity, peakVelocity, t);
          }
          this.lastPegIndex = pegIndex;
        }

        this.pointerSuspense.set(t > 0.74);
        if (t > 0.985) this.pointerSuspense.set(true);

        if (t >= 1) {
          this.settling = true;
          this.settleUntil = now + 900;
          this.finishSpin();
        }
      }

      this.stepFlapper(dt);

      if (this.settling && now >= this.settleUntil) {
        this.flapperAngle = 0;
        this.flapperVelocity = 0;
        this.pointerAngle.set(0);
        this.rafId = 0;
        return;
      }

      this.rafId = requestAnimationFrame(frame);
    };

    this.rafId = requestAnimationFrame(frame);
  }

  /** Impulso del piolo sul triangolo + click. */
  private hitPeg(velocity: number, peakVelocity: number, progress: number) {
    const normalized = Math.min(velocity / Math.max(peakVelocity, 1), 1);

    // Più la ruota va veloce, più il piolo spinge il triangolo in là.
    const impulse = 90 + normalized * 720;
    this.flapperVelocity -= impulse;
    if (this.flapperVelocity < -2600) this.flapperVelocity = -2600;

    this.playPeg(normalized, progress > 0.74);
  }

  /** Molla smorzata: il triangolo torna a riposo e rimbalza sul piolo. */
  private stepFlapper(dt: number) {
    const stiffness = 1500;
    const damping = 24;

    this.flapperVelocity += (-stiffness * this.flapperAngle - damping * this.flapperVelocity) * dt;
    this.flapperAngle += this.flapperVelocity * dt;

    // Il piolo è un vincolo: il triangolo non lo attraversa.
    if (this.flapperAngle < -34) {
      this.flapperAngle = -34;
      if (this.flapperVelocity < 0) this.flapperVelocity *= -0.22;
    }
    if (this.flapperAngle > 7) {
      this.flapperAngle = 7;
      if (this.flapperVelocity > 0) this.flapperVelocity = 0;
    }

    this.pointerAngle.set(this.flapperAngle);
  }

  private angularVelocity(t: number): number {
    // Derivata di easeOutQuint, in gradi/secondo.
    return (this.totalRotation * 5 * Math.pow(1 - t, 4)) / (this.spinDuration / 1000);
  }

  private peakVelocity(): number {
    return (this.totalRotation * 5) / (this.spinDuration / 1000);
  }

  private finishSpin() {
    this.isSpinning.set(false);
    this.hasFinishedSpinning = true;
    this.winningColor.set(this.targetColor);
    this.pointerSuspense.set(false);
    this.playWin();
    setTimeout(() => this.showWinner.set(true), 420);
  }

  /** Click del piolo: legno secco + corpo basso, più acuto se la ruota è lenta. */
  private playPeg(velocityNorm: number, slow: boolean): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    if ((now - this.lastClickAt) < 0.019) return;
    this.lastClickAt = now;

    const volume = slow ? 0.24 : 0.08 + velocityNorm * 0.16;

    // Attacco secco (legno/plastica)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(slow ? 900 : 1250 + velocityNorm * 700, now);
    osc.frequency.exponentialRampToValueAtTime(slow ? 240 : 420, now + 0.035);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);

    // Corpo basso del colpo
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(slow ? 150 : 220, now);
    thud.frequency.exponentialRampToValueAtTime(70, now + 0.06);
    thudGain.gain.setValueAtTime(volume * 0.7, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.08);

    // Grana del piolo
    const bufSize = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = slow ? 1800 : 3200;
    band.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = volume * 0.55;
    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  /** Tre note quando la pallina si ferma sul colore vincente. */
  private playWin(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      const at = ctx.currentTime + index * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.34);
    });
  }

  getSlicePath(index: number, total: number): string {
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = (index + 1) * angle - 90;
    const polarToCartesian = (deg: number, r: number) => ({
      x: 50 + r * Math.cos(deg * Math.PI / 180),
      y: 50 + r * Math.sin(deg * Math.PI / 180)
    });
    const start = polarToCartesian(startAngle, 50);
    const end = polarToCartesian(endAngle, 50);
    const largeArcFlag = angle <= 180 ? "0" : "1";
    return `M 50 50 L ${start.x} ${start.y} A 50 50 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  }

  private easeOutQuint(t: number): number {
    return 1 - Math.pow(1 - t, 5);
  }
}
