import {Component, OnInit, signal, inject, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {LeaderboardService, PlayerScore} from '../../../services/leaderboard.service';

@Component({
  selector: 'app-leaderboard-detailed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard-detailed-component.html',
  styleUrls: ['./leaderboard-detailed-component.css']
})
export class LeaderboardDetailed implements OnInit {
  private leaderboard = inject(LeaderboardService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  currentPlayer = signal<PlayerScore | null>(null);
  revealedCount = signal(0);
  totalPlayers = signal(0);

  ngOnInit() {
    const players = this.leaderboard.getLeaderboard().reverse(); // Ultimo → Primo
    this.allPlayers.set(players);
    this.totalPlayers.set(players.length);
    this.animateReveal();
  }

  /**
   * 🎬 Animazione rivelazione progressiva
   */
  private async animateReveal() {
    const players = this.allPlayers();

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      this.currentPlayer.set(player);
      this.revealedCount.set(i + 1);

      // Velocità variabile
      const delay = this.getDelay(player.position, players.length);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Pausa finale sul vincitore
    await new Promise(resolve => setTimeout(resolve, 3000));
    this.onComplete.emit();
  }

  /**
   * ⏱️ Calcola delay in base alla posizione
   */
  private getDelay(position: number, totalPlayers: number): number {
    // 5° posto in giù → 500ms (veloce)
    if (position > 5) return 500;

    // 5°-4° posto → 1000ms (medio)
    if (position >= 4) return 1000;

    // Podio (3-2-1) → 2500ms (lento, suspense)
    return 2500;
  }
}
