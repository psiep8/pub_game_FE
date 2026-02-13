// src/app/components/leaderboard-quick/leaderboard-quick.component.ts

import {Component, OnInit, signal, inject, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';
import {LeaderboardService, PlayerScore} from '../../../services/leaderboard.service';

@Component({
  selector: 'app-leaderboard-quick',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(-100px)'
        }),
        animate('500ms ease-out', style({
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({opacity: 0}),
        animate('500ms', style({opacity: 1}))
      ])
    ])
  ],
  template: `
    <div class="quick-leaderboard-overlay" @fadeIn>
      <div class="quick-container">
        <h1 class="quick-title">📊 CLASSIFICA</h1>

        <div class="quick-list">
          @for (player of visiblePlayers(); track player.playerName) {
            <div class="quick-item"
                 [class.gold]="player.position === 1"
                 [class.silver]="player.position === 2"
                 [class.bronze]="player.position === 3"
                 @slideIn>
              <div class="position">{{ player.position }}°</div>
              <div class="name">{{ player.playerName }}</div>
              <div class="points">{{ player.totalPoints }} pts</div>
            </div>
          }
        </div>

        <div class="quick-progress">
          <div class="progress-bar" [style.width.%]="progress()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .quick-leaderboard-overlay {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .quick-container {
      width: 90%;
      max-width: 800px;
    }

    .quick-title {
      text-align: center;
      font-size: 64px;
      font-weight: 900;
      color: white;
      margin-bottom: 40px;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .quick-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .quick-item {
      display: grid;
      grid-template-columns: 80px 1fr 150px;
      align-items: center;
      padding: 20px 30px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 15px;
      backdrop-filter: blur(10px);
      color: white;
    }

    .quick-item.gold {
      background: linear-gradient(135deg, #ffd700, #ffed4e);
      color: #1a1a2e;
    }

    .quick-item.silver {
      background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
      color: #1a1a2e;
    }

    .quick-item.bronze {
      background: linear-gradient(135deg, #cd7f32, #e8a76f);
      color: #1a1a2e;
    }

    .position {
      font-size: 36px;
      font-weight: 900;
    }

    .name {
      font-size: 32px;
      font-weight: 700;
    }

    .points {
      text-align: right;
      font-size: 28px;
      font-weight: 600;
    }

    .quick-progress {
      margin-top: 30px;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }
  `]
})
export class LeaderboardQuick implements OnInit {
  private leaderboard = inject(LeaderboardService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  visiblePlayers = signal<PlayerScore[]>([]);
  progress = signal(0);

  ngOnInit() {
    const players = this.leaderboard.getLeaderboard();

    if (players.length === 0) {
      console.warn('⚠️ Nessun giocatore in classifica');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    this.allPlayers.set(players.reverse()); // Ultimo → Primo
    this.animateReveal();
  }

  /**
   * 🎬 Animazione rivelazione dal basso
   */
  private async animateReveal() {
    const players = this.allPlayers();
    const totalPlayers = players.length;

    for (let i = 0; i < totalPlayers; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));

      this.visiblePlayers.update(list => [...list, players[i]]);
      this.progress.set(((i + 1) / totalPlayers) * 100);
    }

    // Attesa finale
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.onComplete.emit();
  }
}
