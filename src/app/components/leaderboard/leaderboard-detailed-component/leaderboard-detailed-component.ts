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
    trigger('spotlight', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'scale(0.5)'
        }),
        animate('800ms cubic-bezier(0.68, -0.55, 0.265, 1.55)', style({
          opacity: 1,
          transform: 'scale(1)'
        }))
      ])
    ]),
    trigger('podiumEnter', [
      transition(':enter', [
        animate('1500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)', keyframes([
          style({ opacity: 0, transform: 'scale(0.3) rotate(-10deg)', offset: 0 }),
          style({ transform: 'scale(1.1) rotate(5deg)', offset: 0.5 }),
          style({ opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 1 })
        ]))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms', style({ opacity: 1 }))
      ])
    ])
  ],
  template: `
    <div class="detailed-leaderboard-overlay" @fadeIn>

      @if (currentPlayer(); as player) {
        <div class="player-spotlight"
             [class.podium]="player.position <= 3"
             [@spotlight]>

          <!-- Posizione -->
          <div class="position-display"
               [class.gold]="player.position === 1"
               [class.silver]="player.position === 2"
               [class.bronze]="player.position === 3">
            <div class="position-number">{{ player.position }}°</div>
            @if (player.position === 1) {
              <div class="crown">👑</div>
            }
          </div>

          <!-- Nome giocatore -->
          <div class="player-name">{{ player.playerName }}</div>

          <!-- Punti -->
          <div class="player-points">
            <span class="points-value">{{ player.totalPoints }}</span>
            <span class="points-label">PUNTI</span>
          </div>

          <!-- Statistiche -->
          <div class="player-stats">
            <div class="stat">
              <div class="stat-value">{{ player.correctAnswers }}</div>
              <div class="stat-label">Corrette</div>
            </div>
            <div class="stat">
              <div class="stat-value">{{ player.wrongAnswers }}</div>
              <div class="stat-label">Sbagliate</div>
            </div>
          </div>
        </div>
      }

      <!-- Progress -->
      <div class="reveal-progress">
        <div class="progress-text">{{ revealedCount() }} / {{ totalPlayers() }}</div>
        <div class="progress-bar-container">
          <div class="progress-bar"
               [style.width.%]="(revealedCount() / totalPlayers()) * 100"></div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .detailed-leaderboard-overlay {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 40px;
    }

    .player-spotlight {
      text-align: center;
    }

    .position-display {
      position: relative;
      display: inline-block;
      margin-bottom: 30px;
    }

    .position-number {
      font-size: 120px;
      font-weight: 900;
      color: white;
      text-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }

    .position-display.gold .position-number {
      background: linear-gradient(135deg, #ffd700, #ffed4e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .position-display.silver .position-number {
      background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .position-display.bronze .position-number {
      background: linear-gradient(135deg, #cd7f32, #e8a76f);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .crown {
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 80px;
      animation: crownBounce 1s infinite;
    }

    .player-name {
      font-size: 72px;
      font-weight: 900;
      color: white;
      margin: 30px 0;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      letter-spacing: 4px;
    }

    .player-points {
      margin: 40px 0;
    }

    .points-value {
      font-size: 96px;
      font-weight: 900;
      color: #667eea;
      display: block;
      text-shadow: 0 4px 30px rgba(102, 126, 234, 0.5);
    }

    .points-label {
      font-size: 32px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
    }

    .player-stats {
      display: flex;
      gap: 60px;
      justify-content: center;
      margin-top: 40px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 48px;
      font-weight: 900;
      color: white;
    }

    .stat-label {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 10px;
    }

    .reveal-progress {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      max-width: 600px;
    }

    .progress-text {
      text-align: center;
      font-size: 24px;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 15px;
      font-weight: 600;
    }

    .progress-bar-container {
      height: 12px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.5s ease;
    }

    @keyframes crownBounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-15px); }
    }
  `]
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
      console.warn('⚠️ Nessun giocatore in classifica');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    this.allPlayers.set(players.reverse()); // Ultimo → Primo
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
