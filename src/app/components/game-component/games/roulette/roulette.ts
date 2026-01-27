import { Component, Input, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

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
export class Roulette implements OnInit, OnDestroy {
  @Input() displayData: any;
  @Input() timer: number = 0;

  isSpinning = signal(false);
  wheelRotation = signal(0); // Rotazione della ruota (lenta o ferma)
  ballRotation = signal(0);  // Rotazione della pallina (veloce)
  showWinner = signal(false);
  winningColor = signal<string | null>(null);

  colorMap: Record<string, string> = {
    ROSSO: '#e74c3c',
    NERO: '#2c3e50',
    VERDE: '#27ae60',
    BLU: '#2980b9',
    ORO: '#f1c40f',
    VIOLA: '#8e44ad'
  };

  segments = signal<RouletteSegment[]>([]);
  private spinTimeout: any;

  ngOnInit() {
    this.generateSegments();
    // Avvio automatico dopo la fase di scelta
    setTimeout(() => this.startSpin(), 10000);
  }

  ngOnDestroy() {
    if (this.spinTimeout) clearTimeout(this.spinTimeout);
  }

  private generateSegments() {
    const colors = Object.keys(this.colorMap);
    const segmentCount = 24;
    const sequence: string[] = [];

    for (let i = 0; i < segmentCount; i++) {
      let lastColor = sequence[i - 1];
      let availableColors = colors.filter(c => c !== lastColor);
      // Evita che l'ultimo sia uguale al primo
      if (i === segmentCount - 1) {
        availableColors = availableColors.filter(c => c !== sequence[0]);
      }
      const nextColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      sequence.push(nextColor);
    }

    this.segments.set(sequence.map((color, i) => ({
      color,
      colorHex: this.colorMap[color],
      rotation: i * (360 / segmentCount)
    })));
  }

  private startSpin() {
    this.isSpinning.set(true);
    const winningColor = this.displayData?.correctAnswer || 'ROSSO';

    // Trova i segmenti vincenti e scegline uno
    const winners = this.segments().filter(s => s.color === winningColor);
    const targetSegment = winners[Math.floor(Math.random() * winners.length)];

    // FISICA: La ruota gira piano in un senso, la pallina fortissimo nell'altro
    const wheelTarget = -360 * 2; // 2 giri lenti orari
    const ballTarget = (360 * 8) + (360 - targetSegment.rotation); // 8 giri antiorari + target

    this.wheelRotation.set(wheelTarget);
    this.ballRotation.set(ballTarget);

    this.spinTimeout = setTimeout(() => {
      this.isSpinning.set(false);
      this.winningColor.set(winningColor);
      this.showWinner.set(true);
    }, 6000);
  }

  // Aggiungi questi metodi nella classe Roulette
  getSlicePath(index: number, total: number): string {
    const angle = 360 / total;
    const startAngle = index * angle;
    const endAngle = (index + 1) * angle;

    // Funzione helper per coordinate polari -> cartesiane
    const polarToCartesian = (deg: number, radius: number) => {
      const rad = (deg - 90) * Math.PI / 180.0;
      return {
        x: 50 + (radius * Math.cos(rad)),
        y: 50 + (radius * Math.sin(rad))
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

  getLineX2(index: number, total: number): number {
    return 50 + 50 * Math.cos(((index * (360 / total)) - 90) * Math.PI / 180);
  }

  getLineY2(index: number, total: number): number {
    return 50 + 50 * Math.sin(((index * (360 / total)) - 90) * Math.PI / 180);
  }
}
