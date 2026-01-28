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
    // ✅ FIX: Previene avvio multiplo
    if (this.isSpinning() || this.hasFinishedSpinning) {
      console.log('⚠️ Spin già in corso o già completato, ignoro');
      return;
    }

    console.log('🎰 === INIZIO SPIN ===');
    this.isSpinning.set(true);
    this.spinStartTime = Date.now();

    const winningColor = this.displayData?.correctAnswer || 'ROSSO';
    console.log('🎯 Colore vincente dal BE:', winningColor);

    // Trova TUTTI i segmenti con il colore vincente
    const segments = this.segments();
    const winningIndices = segments
      .map((color, idx) => color === winningColor ? idx : -1)
      .filter(idx => idx !== -1);

    console.log('🎯 Indici con colore vincente:', winningIndices);
    console.log('🎨 Tutti i segmenti:', segments);

    if (winningIndices.length === 0) {
      console.error('❌ ERRORE: Nessun segmento con colore', winningColor);
      return;
    }

    // Scegline uno casuale
    const targetIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
    const degreesPerSegment = 360 / segments.length;

    // 🔥 FIX CRITICO: Il puntatore è in alto (270°), quindi calcoliamo la rotazione
    // necessaria affinché lo spicchio targetIndex finisca sotto il puntatore
    // La ruota parte da 0° con il primo segmento in alto, poi gira in senso orario
    const targetAngle = targetIndex * degreesPerSegment;

    // Effetto suspense: velocità iniziale alta (8-12 giri)
    const initialSpins = 8 + Math.random() * 4; // 8-12 giri
    const fullSpins = initialSpins * 360;

    // 🔥 FIX: Invertiamo la logica - la ruota deve girare in modo che targetIndex
    // finisca sotto il puntatore (che è fisso in alto a 270°)
    // Aggiungiamo 270° per compensare il fatto che il puntatore è in alto
    // e sottraiamo targetAngle per portare lo spicchio sotto il puntatore
    const finalRotation = fullSpins + (270 - targetAngle);

    // Variazione casuale per realismo (±30% larghezza spicchio per più varietà)
    const randomOffset = (Math.random() - 0.5) * degreesPerSegment * 0.6;
    const finalWithOffset = finalRotation + randomOffset;

    console.log('🎯 Target index:', targetIndex);
    console.log('🎯 Degrees per segment:', degreesPerSegment);
    console.log('🎯 Target angle:', targetAngle);
    console.log('🎯 Full spins rotations:', fullSpins);
    console.log('🎯 Final rotation:', finalWithOffset + '°');
    console.log('⏱️ Durata spin: 9000ms');

    this.wheelRotation.set(finalWithOffset);

    // 🔥 NUOVO: Effetto "tic-tic-tic" mentre gira
    this.startTickingEffect(segments.length);

    // ✅ FIX: Aspetta ESATTAMENTE la durata della transizione CSS (9000ms) prima di mostrare il vincitore
    this.spinTimeout = setTimeout(() => {
      console.log('✅ === FINE SPIN - Rotazione completata ===');
      console.log('🏆 Mostro vincitore:', winningColor);
      this.isSpinning.set(false);
      this.hasFinishedSpinning = true;
      this.winningColor.set(winningColor);
      this.showWinner.set(true);

      // Ferma il ticking
      if (this.clickInterval) {
        clearInterval(this.clickInterval);
        this.clickInterval = null;
      }
    }, 9000);
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

  // 🔥 NUOVO: Effetto tic-tic-tic mentre la ruota gira
  private startTickingEffect(segmentCount: number): void {
    if (this.clickInterval) {
      clearInterval(this.clickInterval);
    }

    const startTime = Date.now();
    const spinDuration = 9000; // 9 secondi
    const degreesPerSegment = 360 / segmentCount;

    // Calcoliamo quanti segmenti attraverserà la ruota
    const totalRotation = this.wheelRotation();
    const segmentsCrossed = Math.floor(totalRotation / degreesPerSegment);

    let lastSegment = -1;

    this.clickInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Calcola la rotazione attuale basata sul tempo trascorso
      // Usiamo easing cubic-bezier(0.17, 0.89, 0.32, 0.99) simulato
      const easedProgress = this.cubicBezierEasing(progress, 0.17, 0.89, 0.32, 0.99);
      const currentRotation = totalRotation * easedProgress;
      const currentSegment = Math.floor(currentRotation / degreesPerSegment);

      // Quando passiamo a un nuovo segmento, facciamo "tic"
      if (currentSegment !== lastSegment) {
        lastSegment = currentSegment;

        // Effetto shake sul pointer
        this.pointerShaking.set(true);
        setTimeout(() => this.pointerShaking.set(false), 80);

        // Suono click (se disponibile)
        if (this.clickSound) {
          try {
            this.clickSound.currentTime = 0;
            this.clickSound.play().catch(() => {});
          } catch (e) {}
        }
      }

      // Stoppa quando finisce lo spin
      if (elapsed >= spinDuration) {
        clearInterval(this.clickInterval);
        this.clickInterval = null;
      }
    }, 16); // ~60fps
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
