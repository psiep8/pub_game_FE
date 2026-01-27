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

  // 🔥 NUOVO: Riceviamo anche lo stato showGo dalla mode
  private lastShowGo = false;

  isSpinning = signal(false);
  wheelRotation = signal(0);
  showWinner = signal(false);
  winningColor = signal<string | null>(null);

  colorMap: Record<string, string> = {
    'ROSSO': '#e74c3c',
    'NERO': '#2c3e50',
    'VERDE': '#27ae60',
    'BLU': '#2980b9',
    'GIALLO': '#f39c12',
    'BIANCO': '#ecf0f1'
  };

  segments = signal<string[]>([]);
  Math = Math; // Esponi Math al template

  private spinTimeout: any;
  private hasStartedSpin = false;

  ngOnInit() {
    this.generateSegments();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset quando arriva un nuovo displayData
    if (changes['displayData'] && !changes['displayData'].firstChange) {
      console.log('🔄 Nuovo round - Reset roulette');
      this.resetRoulette();
      this.generateSegments();
    }

    // 🔥 NUOVO: Rileva quando appare il VIA (showGo passa da false a true)
    if (this.displayData) {
      const currentShowGo = this.displayData.showGo || false;

      // Se showGo passa da false a true, il VIA è apparso
      if (!this.lastShowGo && currentShowGo && !this.hasStartedSpin) {
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
  }

  private resetRoulette() {
    this.isSpinning.set(false);
    this.wheelRotation.set(0);
    this.showWinner.set(false);
    this.winningColor.set(null);
    this.hasStartedSpin = false;
    this.lastShowGo = false; // 🔥 Reset anche questo
    if (this.spinTimeout) {
      clearTimeout(this.spinTimeout);
      this.spinTimeout = null;
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
    this.isSpinning.set(true);

    const winningColor = this.displayData?.correctAnswer || 'ROSSO';
    console.log('🎯 Colore vincente dal BE:', winningColor);

    // Trova TUTTI i segmenti con il colore vincente
    const segments = this.segments();
    const winningIndices = segments
      .map((color, idx) => color === winningColor ? idx : -1)
      .filter(idx => idx !== -1);

    console.log('🎯 Indici con colore vincente:', winningIndices);

    if (winningIndices.length === 0) {
      console.error('❌ ERRORE: Nessun segmento con colore', winningColor);
      return;
    }

    // Scegline uno casuale
    const targetIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
    const degreesPerSegment = 360 / segments.length;
    const targetRotation = targetIndex * degreesPerSegment;

    // Effetto suspense: velocità iniziale alta (8-12 giri), poi rallenta piano piano
    const initialSpins = 8 + Math.random() * 4; // 8-12 giri
    const fullSpins = initialSpins * 360;

    // Offset per centrare la pallina sullo spicchio
    const centerOffset = degreesPerSegment / 2;

    // Variazione casuale per realismo (±20% larghezza spicchio)
    const randomOffset = (Math.random() - 0.5) * degreesPerSegment * 0.4;

    // Rotazione finale: giri completi + rotazione target + offset
    const finalRotation = fullSpins + (360 - targetRotation) + centerOffset + randomOffset;

    console.log('🎯 Target index:', targetIndex);
    console.log('🎯 Target rotation:', targetRotation);
    console.log('🎯 Final rotation:', finalRotation);

    this.wheelRotation.set(finalRotation);

    // Mostra vincitore dopo 8 secondi (tempo di spin lungo per suspense)
    this.spinTimeout = setTimeout(() => {
      this.isSpinning.set(false);
      this.winningColor.set(winningColor);
      this.showWinner.set(true);
    }, 8000);
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
}
