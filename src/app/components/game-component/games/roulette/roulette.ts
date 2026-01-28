import {Component, Input, signal, OnInit, OnDestroy, SimpleChanges, OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';

interface RouletteSegment {
  color: string;
  colorHex: string;
  rotation: number;
}

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

  // 🔥 Effetto pointer che urta le stecchette
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
  private spinStartTime = 0;
  private hasFinishedSpinning = false; // 🔥 NUOVO: previene spin multipli

  // Audio per il click
  private clickSound?: HTMLAudioElement;

  ngOnInit() {
    this.generateSegments();

    // 🔥 MIGLIORATO: Audio più realistico per il "tic"
    try {
      this.clickSound = new Audio();
      // Suono di click più pronunciato - puoi sostituire con un file audio reale
      // Per ora usiamo un beep sintetico
      this.clickSound.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA==';
      this.clickSound.volume = 0.2; // Volume ridotto per non essere invasivo
    } catch (e) {
      console.log('Audio non disponibile');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // ✅ FIX: Reset SOLO quando è veramente un nuovo round (non durante lo stesso round)
    if (changes['displayData'] && !changes['displayData'].firstChange) {
      const oldData = changes['displayData'].previousValue;
      const newData = changes['displayData'].currentValue;

      // Reset solo se cambia il correctAnswer (nuovo round)
      if (oldData?.correctAnswer !== newData?.correctAnswer) {
        console.log('🔄 Nuovo round REALE - Reset roulette');
        this.resetRoulette();
        this.generateSegments();
      }
    }

    // 🔥 Rileva quando appare il VIA (showGo passa da false a true)
    if (this.displayData) {
      const currentShowGo = this.displayData.showGo || false;

      // ✅ Controlla anche che non abbia già finito di girare
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
    this.hasFinishedSpinning = false; // 🔥 Reset flag

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
    const segmentCount = 24; // 4 ripetizioni per colore
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

    this.isSpinning.set(true);
    const winningColor = this.displayData?.correctAnswer || 'ROSSO';
    const segments = this.segments();

    // 1. Trova gli indici del colore vincente
    const winningIndices = segments
      .map((color, idx) => color === winningColor ? idx : -1)
      .filter(idx => idx !== -1);

    // 2. Scegli uno spicchio target casuale tra quelli del colore vincente
    const targetIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
    const degreesPerSegment = 360 / segments.length;

    // 3. CALCOLO ROTAZIONE (Puntatore a 0°/Top)
    // Per portare l'indice N in cima, la ruota deve ruotare di: 360 - (N * degreesPerSegment)
    // Aggiungiamo degreesPerSegment / 2 per fermarci al CENTRO dello spicchio
    const offsetToCenter = degreesPerSegment / 2;
    const rotationToTarget = 360 - (targetIndex * degreesPerSegment) - offsetToCenter;

    // 4. SUSPENSE: Molti giri (es. 12-15) + la rotazione verso il target
    const extraSpins = (12 + Math.floor(Math.random() * 4)) * 360;

    // 5. CASUALITÀ FINALE: un piccolo offset casuale dentro lo spicchio
    // (per non fermarsi sempre esattamente al centro perfetto)
    const randomness = (Math.random() - 0.5) * (degreesPerSegment * 0.4);

    const totalRotation = extraSpins + rotationToTarget + randomness;

    this.wheelRotation.set(totalRotation);

    // Avvia il ticking (tic-tic) sincronizzato con i 12 secondi
    this.startTickingEffect(segments.length, 12000, totalRotation);

    this.spinTimeout = setTimeout(() => {
      this.isSpinning.set(false);
      this.hasFinishedSpinning = true;
      this.winningColor.set(winningColor);
      this.showWinner.set(true);
    }, 12000); // Deve coincidere con il CSS
  }

// All'interno della classe Roulette
  getSlicePath(index: number, total: number): string {
    const angle = 360 / total;
    // Sottraiamo 90 per far partire il primo spicchio dall'alto (ore 12)
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

  // 🔥 NUOVO: Effetto tic-tic-tic mentre la ruota gira
  private startTickingEffect(segmentCount: number, duration: number, totalRotation: number): void {
    if (this.clickInterval) clearInterval(this.clickInterval);

    const startTime = Date.now();
    const degreesPerSegment = 360 / segmentCount;
    let lastSegment = -1;

    this.clickInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Simuliamo l'easing cubic-bezier(0.15, 0, 0.2, 1.05)
      const easedProgress = this.cubicBezierEasing(progress, 0.15, 0, 0.2, 1.05);
      const currentRotation = totalRotation * easedProgress;

      // Calcoliamo quale piolo sta passando sotto il puntatore (in alto a 0°)
      const currentSegment = Math.floor((currentRotation + (degreesPerSegment / 2)) / degreesPerSegment);

      if (currentSegment !== lastSegment) {
        lastSegment = currentSegment;
        this.pointerShaking.set(true);
        setTimeout(() => this.pointerShaking.set(false), 60);

        if (this.clickSound) {
          this.clickSound.currentTime = 0;
          this.clickSound.play().catch(() => {
          });
        }
      }

      if (progress === 1) clearInterval(this.clickInterval);
    }, 16);
  }

  // Funzione di easing per simulare il cubic-bezier CSS
  private cubicBezierEasing(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
    // Semplificazione: approssimazione cubica
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    return ((ay * t + by) * t + cy) * t;
  }
}
