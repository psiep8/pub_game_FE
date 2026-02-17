// src/app/components/leaderboard-detailed/leaderboard-detailed.component.ts

import {Component, OnInit, signal, inject, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate, keyframes} from '@angular/animations';
import {LeaderboardService, PlayerScore} from '../../../services/leaderboard.service';

@Component({
  selector: 'app-leaderboard-detailed',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('spotlightEnter', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.3) rotateY(90deg)'}),
        animate('1200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          style({opacity: 1, transform: 'scale(1) rotateY(0)'}))
      ])
    ]),
    trigger('explosionEnter', [
      transition(':enter', [
        animate('2000ms cubic-bezier(0.68, -0.55, 0.265, 1.55)', keyframes([
          style({opacity: 0, transform: 'scale(0) rotate(-180deg)', offset: 0}),
          style({transform: 'scale(1.3) rotate(15deg)', offset: 0.6}),
          style({opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 1})
        ]))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({opacity: 0}),
        animate('600ms', style({opacity: 1}))
      ])
    ])
  ],
  templateUrl: 'leaderboard-detailed-component.html',
  styleUrl: 'leaderboard-detailed-component.css'
})
export class LeaderboardDetailed implements OnInit {
  private leaderboard = inject(LeaderboardService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  currentPlayer = signal<PlayerScore | null>(null);
  revealedCount = signal(0);
  totalPlayers = signal(0);

  ngOnInit() {
    const players = this.leaderboard.getLeaderboard();

    if (players.length === 0) {
      console.warn('⚠️ Nessun giocatore con punti >= 0');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    this.allPlayers.set(players.reverse());
    this.totalPlayers.set(players.length);
    this.animateReveal();
  }

  private async animateReveal() {
    const players = this.allPlayers();

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      this.currentPlayer.set(player);
      this.revealedCount.set(i + 1);

      const delay = this.getDelay(player.position);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await new Promise(resolve => setTimeout(resolve, 8000));
    this.onComplete.emit();
  }

  private getDelay(position: number): number {
    if (position > 5) return 1500;  // 1.5s (veloce)
    if (position === 5) return 6000; // 6s
    if (position === 4) return 7000; // 7s
    if (position === 3) return 9000; // 9s BRONZO
    if (position === 2) return 10000; // 10s ARGENTO
    if (position === 1) return 12000; // 12s ORO!!!

    return 2000;
  }
}
