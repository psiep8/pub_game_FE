import {Component, OnInit, signal, inject, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {LeaderboardService, PlayerScore} from '../../../services/leaderboard.service';

@Component({
  selector: 'app-leaderboard-quick',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'leaderboard-quick-component.html',
  styleUrl: 'leaderboard-quick-component.css'
})
export class LeaderboardQuick implements OnInit {
  private leaderboard = inject(LeaderboardService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  visiblePlayers = signal<PlayerScore[]>([]);
  progress = signal(0);

  ngOnInit() {
    this.allPlayers.set(this.leaderboard.getLeaderboard().reverse()); // Ultimo → Primo
    this.animateReveal();
  }

  /**
   * 🎬 Animazione rivelazione dal basso
   */
  private async animateReveal() {
    const players = this.allPlayers();
    const totalPlayers = players.length;

    for (let i = 0; i < totalPlayers; i++) {
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms tra ogni player

      this.visiblePlayers.update(list => [...list, players[i]]);
      this.progress.set(((i + 1) / totalPlayers) * 100);
    }

    // Attesa finale prima di chiudere
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.onComplete.emit();
  }
}
