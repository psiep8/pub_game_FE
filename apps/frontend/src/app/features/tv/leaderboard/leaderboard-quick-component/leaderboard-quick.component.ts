

import {Component, OnInit, signal, computed, inject, Output, EventEmitter, ChangeDetectionStrategy, ElementRef, viewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';
import {LeaderboardService, PlayerScore} from '../../../../core/services/leaderboard.service';
import {AudioService} from '../../../../core/services/audio.service';
import {PlayerAvatarService} from '../../../../core/services/player-avatar.service';
import {ThemeService} from '../../../../core/services/theme.service';

@Component({
  selector: 'app-leaderboard-quick',
  standalone: true,
  imports: [CommonModule],
  animations: [
    
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
        style({opacity: 0}),
        animate('400ms', style({opacity: 1}))
      ])
    ])
  ],
  templateUrl: './leaderboard-quick.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./leaderboard-quick.component.css', 'restyle.css']
})
export class LeaderboardQuick implements OnInit {
  private leaderboard = inject(LeaderboardService);
  private audio = inject(AudioService);
  readonly avatars = inject(PlayerAvatarService);
  readonly theme = inject(ThemeService);

  @Output() onComplete = new EventEmitter<void>();

  allPlayers = signal<PlayerScore[]>([]);
  visiblePlayers = signal<PlayerScore[]>([]);
  progress = signal(0);
  totalPlayers = signal(0);
  /** Posizioni dell'ultima classifica: positivo = salita, negativo = discesa. */
  private previousRanks = new Map<string, number>();
  /** Al massimo otto righe in scena: oltre, le nuove entrano e le vecchie escono. */
  readonly windowPlayers = computed(() => this.visiblePlayers().slice(-8));
  /** Reveal finito: il tabellone si compatta e mostra tutte le squadre. */
  revealDone = signal(false);
  /** Sospiro prima del podio: la sala sa che sta per arrivare il top 3. */
  podiumSuspense = signal(false);
  /**
   * Oltre dieci squadre il tabellone passa a due colonne: in una sola le righe
   * scenderebbero sotto i 40px su TV 720p e i nomi diventerebbero illeggibili.
   */
  readonly dense = computed(() => this.revealDone() && this.allPlayers().length > 10);

  /**
   * Oltre sedici squadre due colonne non bastano più: a 720p servono dieci
   * righe da ~55px, che stringono avatar e nomi. Con tre colonne le righe
   * restano sopra i 75px anche a venti squadre.
   */
  readonly triple = computed(() => this.revealDone() && this.allPlayers().length > 16);

  /** Contenitore delle righe: con molte squadre scorre da solo. */
  private readonly playersList = viewChild<ElementRef<HTMLElement>>('playersList');

  ngOnInit() {
    const players = this.leaderboard.getLeaderboard();

    if (players.length === 0) {
      console.warn('⚠️ Nessun giocatore');
      setTimeout(() => this.onComplete.emit(), 1000);
      return;
    }

    this.previousRanks = this.leaderboard.previousRanks();
    this.allPlayers.set([...players].reverse());
    this.totalPlayers.set(players.length);
    this.audio.playWhoosh();
    this.animateReveal();
  }

  /**
   * Variazione rispetto alla classifica precedente. Il numero è positivo se la
   * squadra è salita (la posizione è diminuita), negativo se è scesa.
   */
  movement(player: PlayerScore): number {
    const before = this.previousRanks.get(player.playerName);
    return before == null ? 0 : before - player.position;
  }

  private async animateReveal() {
    const startedAt = Date.now();
    const players = this.allPlayers();
    const total = players.length;

    for (let i = 0; i < total; i++) {
      // N-15: il flash non è una raffica. Le righe normali respirano 450 ms;
      // prima del podio c'è un sospiro di 1,6 s e il podio si prende i suoi
      // tempi. Con dodici squadre si chiude intorno ai 15 s.
      const position = players[i].position;
      if (total > 3 && position === 3 && i > 0 && players[i - 1].position > 3) {
        this.podiumSuspense.set(true);
        await new Promise(resolve => setTimeout(resolve, 1600));
        this.podiumSuspense.set(false);
      }
      const delay = position === 1 ? 2000 : position === 2 ? 1500 : position === 3 ? 1300 : 450;

      this.visiblePlayers.update(list => [...list, players[i]]);
      this.progress.set(((i + 1) / total) * 100);
      this.scrollToNewest();

      if (position <= 3) {
        this.audio.playPodiumReveal(position);
      } else {
        this.audio.playTick();
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.revealDone.set(true);
    // Fermo sul podio: almeno 4 s per leggere il tabellone, con un tetto
    // complessivo di 15 s per la flash.
    const remaining = Math.max(4000, 15_000 - (Date.now() - startedAt));
    await new Promise(resolve => setTimeout(resolve, remaining));
    this.leaderboard.rememberRanks();
    this.onComplete.emit();
  }

  private scrollToNewest(): void {
    const list = this.playersList()?.nativeElement;
    if (!list || typeof list.scrollTo !== 'function') return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }
}
