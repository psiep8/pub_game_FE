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
    // 🔥 Nome animazione: 'slideUp' (senza @)
    trigger('slideUp', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(50px)'
        }),
        animate('600ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({
          opacity: 1,
          transform: 'translateY(0)'
        }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('400ms', style({ opacity: 1 }))
      ])
    ])
  ],
  templateUrl: 'leaderboard-quick-component.html',
  styleUrl: 'leaderboard-quick-component.css'
})
export class LeaderboardQuick implements OnInit {
  private leaderboard = inject(LeaderboardService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  visiblePlayers = signal<PlayerScore[]>([]);
  progress = signal(0);
  totalPlayers = signal(0);

  ngOnInit() {
    const players = this.leaderboard.getLeaderboard();

    if (players.length === 0) {
      console.warn('⚠️ Nessun giocatore in classifica');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    // Ultimo → Primo (come Kahoot)
    this.allPlayers.set(players.reverse());
    this.totalPlayers.set(players.length);
    this.animateReveal();
  }

  /**
   * 🎬 Animazione stile Kahoot - scroll dall'ultimo al primo
   */
  private async animateReveal() {
    const players = this.allPlayers();
    const total = players.length;

    for (let i = 0; i < total; i++) {
      // Timing progressivamente più lento per top 3
      let delay = 1200; // Default: 1.2s per player

      if (players[i].position === 3) delay = 2000; // 2s per bronzo
      if (players[i].position === 2) delay = 2500; // 2.5s per argento
      if (players[i].position === 1) delay = 3500; // 3.5s per ORO

      // Aggiungi player
      this.visiblePlayers.update(list => [...list, players[i]]);
      this.progress.set(((i + 1) / total) * 100);

      // Attendi
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Pausa finale sul vincitore
    await new Promise(resolve => setTimeout(resolve, 3000));
    this.onComplete.emit();
  }
}
