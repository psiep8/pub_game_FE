import {Component, Input, signal, OnInit, OnDestroy, SimpleChanges, OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';

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
  pointerShaking = signal(false);

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
  private clickInterval: any;
  private hasStartedSpin = false;
  private lastShowGo = false;
  private hasFinishedSpinning = false;
  private clickSound?: HTMLAudioElement;

  ngOnInit() {
    this.generateSegments();

    try {
      this.clickSound = new Audio();
      this.clickSound.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA==';
      this.clickSound.volume = 0.15;
    } catch (e) {
      console.log('Audio non disponibile');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayData'] && !changes['displayData'].firstChange) {
      const oldData = changes['displayData'].previousValue;
      const newData = changes['displayData'].currentValue;

      if (oldData?.correctAnswer !== newData?.correctAnswer) {
        console.log('🔄 Nuovo round REALE - Reset roulette');
        this.resetRoulette();
        this.generateSegments();
      }
    }

    if (this.displayData) {
      const currentShowGo = this.displayData.showGo || false;

      if (!this.lastShowGo && currentShowGo && !this.hasStartedSpin && !this.hasFinishedSpinning) {
        console.log('🚦 VIA rilevato - Avvio spin tra 1.5s');
        setTimeout(() => {
          this.startSpin();
        }, 1500);
        this.hasStartedSpin = true;
      }

      this.lastShowGo = currentShowGo;
    }
  }

  ngOnDestroy() {
    if (this.spinTimeout) clearTimeout(this.spinTimeout);
    if (this.clickInterval) clearInterval(this.clickInterval);
  }

  private resetRoulette() {
    this.isSpinning.set(false);
    this.wheelRotation.set(0);
    this.showWinner.set(false);
    this.winningColor.set(null);
    this.pointerShaking.set(false);
    this.hasStartedSpin = false;
    this.lastShowGo = false;
    this.hasFinishedSpinning = false;

    if (this.spinTimeout) {
      clearTimeout(this.spinTimeout);
      this.spinTimeout = null;
    }

    if (this.clickInterval) {
      clearInterval(this.clickInterval);
      this.clickInterval = null;
    }
  }

  private generateSegments() {
    const colors = Object.keys(this.colorMap);
    const segmentCount = 24;
    const sequence: string[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const lastColor = sequence[i - 1];
      let availableColors = colors.filter(c => c !== lastColor);

      if (i === segmentCount - 1) {
        availableColors = availableColors.filter(c => c !== sequence[0]);
      }

      const nextColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      sequence.push(nextColor);
    }

    this.segments.set(sequence);
    console.log('🎰 Segmenti generati:', sequence);
  }

  private startSpin() {
    if (this.isSpinning() || this.hasFinishedSpinning) return;

    console.log('🎰 === INIZIO SPIN ===');
    this.isSpinning.set(true);

    const winningColor = this.displayData?.correctAnswer || 'ROSSO';
    const segments = this.segments();
    const winningIndices = segments
      .map((color, idx) => color === winningColor ? idx : -1)
      .filter(idx => idx !== -1);

    const targetIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
    const degreesPerSegment = 360 / segments.length;

    // TUA FORMULA FUNZIONANTE
    const offsetToCenter = degreesPerSegment / 2;
    const rotationToTarget = 360 - (targetIndex * degreesPerSegment) - offsetToCenter;
    const extraSpins = (12 + Math.floor(Math.random() * 4)) * 360;

    // 🔥 MIGLIORIA: Casualità più ampia per finale imprevedibile
    const randomness = (Math.random() - 0.5) * (degreesPerSegment * 0.8);
    const totalRotation = extraSpins + rotationToTarget + randomness;

    console.log('🎯 Target:', targetIndex, '/', segments[targetIndex]);
    console.log('🎯 Rotazione:', totalRotation.toFixed(2) + '°');

    this.wheelRotation.set(totalRotation);

    // 🔥 TICKING MIGLIORATO (ma semplice)
    this.startTickingEffect(segments.length, 12000, totalRotation);

    this.spinTimeout = setTimeout(() => {
      console.log('✅ SPIN COMPLETATO');
      this.isSpinning.set(false);
      this.hasFinishedSpinning = true;
      this.winningColor.set(winningColor);
      this.showWinner.set(true);

      if (this.clickInterval) {
        clearInterval(this.clickInterval);
        this.clickInterval = null;
      }
    }, 12000);
  }

  getSlicePath(index: number, total: number): string {
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = (index + 1) * angle - 90;

    const polarToCartesian = (deg: number, radius: number) => {
      const rad = deg * Math.PI / 180;
      return {
        x: 50 + radius * Math.cos(rad),
        y: 50 + radius * Math.sin(rad)
      };
    };

    const start = polarToCartesian(startAngle, 50);
    const end = polarToCartesian(endAngle, 50);
    const largeArcFlag = angle <= 180 ? "0" : "1";

    return [
      "M", 50, 50,
      "L", start.x, start.y,
      "A", 50, 50, 0, largeArcFlag, 1, end.x, end.y,
      "Z"
    ].join(" ");
  }

  // 🔥 TICKING SEMPLIFICATO MA EFFICACE
  private startTickingEffect(segmentCount: number, duration: number, totalRotation: number): void {
    if (this.clickInterval) clearInterval(this.clickInterval);

    const startTime = Date.now();
    const degreesPerSegment = 360 / segmentCount;
    let lastSegment = -1;

    this.clickInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing semplice ma efficace
      const easedProgress = this.easeOutCubic(progress);
      const currentRotation = totalRotation * easedProgress;
      const currentSegment = Math.floor((currentRotation + (degreesPerSegment / 2)) / degreesPerSegment);

      if (currentSegment !== lastSegment) {
        lastSegment = currentSegment;

        // 🔥 Volume dinamico: forte all'inizio, delicato alla fine
        const velocity = 1 - progress;
        const volume = 0.08 + (velocity * 0.12);

        // Shake
        this.pointerShaking.set(true);
        setTimeout(() => this.pointerShaking.set(false), 60);

        // Click
        if (this.clickSound) {
          this.clickSound.volume = volume;
          this.clickSound.currentTime = 0;
          this.clickSound.play().catch(() => {});
        }
      }

      if (progress >= 1) {
        clearInterval(this.clickInterval);
        this.clickInterval = null;
      }
    }, 16); // 60fps
  }

  // Easing semplice
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}
