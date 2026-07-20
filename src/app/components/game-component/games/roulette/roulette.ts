import { Component, Input, signal, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-roulette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette.html',
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
  pointerVelocity = signal(0);
  pointerSuspense = signal(false);

  colorMap: Record<string, string> = {
    'ROSSO': '#e74c3c',
    'NERO': '#2c3e50',
    'VERDE': '#27ae60',
    'BLU': '#2980b9',
    'GIALLO': '#f39c12',
    'BIANCO': '#ecf0f1'
  };

  segments = signal<string[]>([]);
  Math = Math;

  private spinTimeout: any;
  private tickInterval: any;
  private snapKick = 0; // decaying "just released" whip, layered on top of the continuous lean
  private hasStartedSpin = false;
  private lastShowGo = false;
  private hasFinishedSpinning = false;
  private audioCtx: AudioContext | null = null;


  private spinStartTime = 0;
  private spinDuration = 18000;
  private totalRotation = 0;

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
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private resetRoulette() {
    this.clearAllTimers();
    this.isSpinning.set(false);
    this.wheelRotation.set(0);
    this.showWinner.set(false);
    this.winningColor.set(null);
    this.pointerAngle.set(0);
    this.pointerVelocity.set(0);
    this.pointerSuspense.set(false);
    this.snapKick = 0;
    this.hasStartedSpin = false;
    this.lastShowGo = false;
    this.hasFinishedSpinning = false;
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

    this.totalRotation = extraSpins + rotationToAlign + jitter;
    /*
     * Longer than before to make room for a believable "human push":
     * a gentle start, a second harder push, then the long graceful
     * decay to a stop. See easeHumanSpin() for the phase breakdown.
     */
    this.spinDuration = 23000;
    this.spinStartTime = Date.now();

    /*
     * wheelRotation is no longer set once and handed to a CSS
     * transition — it's now driven every tick from easeHumanSpin(),
     * exactly like pointerAngle, so the visible wheel position, the
     * peg-strike sound/lean and the custom multi-phase motion curve
     * can never drift out of sync with each other.
     */


    this.startPhysicsLoop(segCount, winningColor);


    this.spinTimeout = setTimeout(() => {
      this.isSpinning.set(false);
      this.hasFinishedSpinning = true;
      this.winningColor.set(winningColor);

      if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }


      this.pointerAngle.set(0);
      this.pointerVelocity.set(0);
      this.pointerSuspense.set(false);

      setTimeout(() => this.showWinner.set(true), 500);
    }, this.spinDuration);
  }

  private startPhysicsLoop(segCount: number, winningColor: string) {
    if (this.tickInterval) clearInterval(this.tickInterval);

    const degreesPerSegment = 360 / segCount;

    let lastBoundaryCount = 0;
    let previousRotation = 0;
    let previousTime = this.spinStartTime;
    let peakVelocitySoFar = 1; // seed >0 to avoid a divide-by-zero on the very first tick


    const decelStart = 0.32; // must match the phase-3 boundary in easeHumanSpin()

    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.spinStartTime;
      const progress = Math.min(elapsed / this.spinDuration, 1);
      const easedProgress = this.easeHumanSpin(progress);
      const currentRotation = this.totalRotation * easedProgress;


      this.wheelRotation.set(currentRotation);


      const dt = Math.max(now - previousTime, 1) / 1000;
      const velocityDegPerSec = (currentRotation - previousRotation) / dt;
      previousRotation = currentRotation;
      previousTime = now;
      peakVelocitySoFar = Math.max(peakVelocitySoFar, velocityDegPerSec);


      const decelProgress = Math.max(0, (progress - decelStart) / (1 - decelStart));
      const inSuspense = decelProgress > 0.62;
      this.pointerSuspense.set(inSuspense);

      const currentBoundaryCount = Math.floor(currentRotation / degreesPerSegment);
      const newBoundaries = currentBoundaryCount - lastBoundaryCount;

      if (newBoundaries > 0) {
        lastBoundaryCount = currentBoundaryCount;

        const normalizedVel = Math.min(velocityDegPerSec / peakVelocitySoFar, 1);


        this.snapKick = (inSuspense ? 9 : 5) + (1 - normalizedVel) * (inSuspense ? 6 : 3);
        this.playTick(normalizedVel, inSuspense);
      }




      const segFrac = (currentRotation % degreesPerSegment) / degreesPerSegment;
      const approach = Math.max(0, (segFrac - 0.55) / 0.45);
      const shaped = Math.pow(approach, inSuspense ? 2.4 : 1.6);
      const leanMax = inSuspense ? 15 : 9;
      const leanAngle = shaped * leanMax;


      this.snapKick *= inSuspense ? 0.88 : 0.7;
      if (this.snapKick < 0.05) this.snapKick = 0;


      this.pointerAngle.set(this.snapKick - leanAngle);

      if (progress >= 1) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
        this.pointerSuspense.set(false);
        this.snapKick = 0;
        this.pointerAngle.set(0);
        this.wheelRotation.set(this.totalRotation);
      }
    }, 8);
  }

  /**
   * Human-push motion profile instead of a single monotonic ease-out.
   * Returns the fraction (0..1) of totalRotation completed at
   * normalized time t (0..1):
   *
   *  - phase 1  [0    → 0.18]: gentle ramp-up, like a hand starting
   *             to push the wheel — reaches only 5% of the rotation.
   *  - phase 2  [0.18 → 0.32]: a second, harder push — a visible
   *             jump in speed rather than a smooth continuation,
   *             reaching 24% of the rotation.
   *  - phase 3  [0.32 → 1.00]: long, smooth quintic decay from that
   *             peak speed down to a full stop — this is the same
   *             "crawl to the winning slice" shape as before, just
   *             confined to the back 68% of a longer total duration.
   *
   * Tune t1/r1/t2/r2 to taste; keep decelStart in startPhysicsLoop()
   * equal to t2 so the suspense window stays anchored to phase 3.
   */
  private easeHumanSpin(t: number): number {
    const t1 = 0.18, r1 = 0.05;
    const t2 = 0.32, r2 = 0.24;

    if (t <= t1) {
      const u = t / t1;
      return r1 * (u * u);
    }

    if (t <= t2) {
      const u = (t - t1) / (t2 - t1);
      return r1 + (r2 - r1) * (u * u);
    }

    const u = (t - t2) / (1 - t2);
    const quintOut = 1 - Math.pow(1 - u, 5);
    return r2 + (1 - r2) * quintOut;
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

  private playTick(velNorm: number, inSuspense: boolean): void {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const volume = inSuspense
      ? 0.15 + Math.random() * 0.08
      : 0.05 + velNorm * 0.25;


    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(inSuspense ? 160 : 300 + velNorm * 150, now);
    osc.frequency.exponentialRampToValueAtTime(inSuspense ? 55 : 70, now + 0.07);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (inSuspense ? 0.22 : 0.08));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (inSuspense ? 0.25 : 0.09));


    const bufSize = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

}
