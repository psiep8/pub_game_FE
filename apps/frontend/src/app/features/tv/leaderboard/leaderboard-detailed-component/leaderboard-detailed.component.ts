

import {Component, OnInit, signal, inject, Output, EventEmitter, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate, keyframes} from '@angular/animations';
import {LeaderboardService, PlayerScore} from '../../../../core/services/leaderboard.service';
import {AudioService} from '../../../../core/services/audio.service';
import {PlayerAvatarService} from '../../../../core/services/player-avatar.service';

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
  templateUrl: './leaderboard-detailed.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./leaderboard-detailed.component.css', 'restyle.css']
})
export class LeaderboardDetailed implements OnInit {
  private leaderboard = inject(LeaderboardService);
  private audio = inject(AudioService);
  readonly avatars = inject(PlayerAvatarService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  currentPlayer = signal<PlayerScore | null>(null);
  revealedCount = signal(0);
  totalPlayers = signal(0);

  ngOnInit() {
    
    const players = this.leaderboard.getLeaderboard();

    if (players.length === 0) {
      console.warn('⚠️ Nessun giocatore');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    this.allPlayers.set([...players].reverse());
    this.totalPlayers.set(players.length);
    this.animateReveal();
  }

  private async animateReveal() {
    const players = this.allPlayers();

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      this.currentPlayer.set(player);
      this.revealedCount.set(i + 1);

      // Rullo e festeggiamento solo quando il gradino del podio è scoperto:
      // lieve al terzo, medio con botticelle al secondo, pieno al primo.
      if (player.position <= 3) {
        this.audio.playPodiumReveal(player.position);
      } else {
        this.audio.playTick();
      }

      const delay = this.getDelay(player.position);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await new Promise(resolve => setTimeout(resolve, 8000));
    this.onComplete.emit();
  }

  private getDelay(position: number): number {
    if (position > 5) return 1200;
    if (position === 5) return 2000;
    if (position === 4) return 2300;
    if (position === 3) return 2600;
    if (position === 2) return 3000;
    if (position === 1) return 3600;

    return 1500;
  }

}
