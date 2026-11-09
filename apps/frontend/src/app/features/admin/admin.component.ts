import { WsAction } from '../../shared/enums/ws-action';

import { Component, inject, OnDestroy, OnInit, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CategoryRow, GameService } from '../../core/services/game.service';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { scoringRuleFor, ScoringRule } from '../../shared/models/scoring-rules';
import { BonusType } from '../../shared/models/bonus-type';
import { ReliabilityService } from '../../core/services/reliability.service';
import { ConnectionBadge } from '../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-admin-component',
  standalone: true,
  imports: [CommonModule, ConnectionBadge],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin.component.css',
})
export class Admin implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);
  private games = inject(GameService);
  readonly reliability = inject(ReliabilityService);
  diagnostics = signal<any | null>(null);

  /** Categorie ufficiali: qui l'admin accende/spegne e gestisce il flag Timeline. */
  readonly categories = signal<CategoryRow[]>([]);
  readonly categoriesError = signal<string | null>(null);
  readonly newCategoryName = signal('');
  readonly newCategoryEmoji = signal('');
  private diagTimer?: ReturnType<typeof setInterval>;
  private stateRetry?: ReturnType<typeof setTimeout>;
  private destroyRef = inject(DestroyRef);
  public theme = inject(ThemeService);

  
  correctAnswer = signal<string | null>(null);
  correctPoints = signal<number | null>(null);
  wrongPoints = signal<number | null>(null);
  solution = signal<string | null>(null);
  scoringRules = signal<ScoringRule | null>(null);
  currentQuestionType = signal<string>('QUIZ');
  buzzedPlayer = signal<string | null>(null);
  showAdminControls = signal(false);
  gameState = signal<'WAITING' | 'ACTIVE' | 'ROUND_ENDED'>('WAITING');
  payload = signal<any>(null);
  gameIdInput = signal<number>(Number(localStorage.getItem('activeGameId')) || 1);

  
  colorMap: { [key: string]: string } = {
    'ROSSO': '#e74c3c',
    'BLU': '#3498db',
    'VERDE': '#2ecc71',
    'GIALLO': '#f1c40f',
    'VIOLA': '#9b59b6',
    'ARANCIONE': '#e67e22',
    'ROSA': '#ff69b4',
    'AZZURRO': '#00bcd4'
  };

  ngOnInit(): void {
    this.reliability.start(this.activeGameId(), 'ADMIN');
    this.requestCurrentState();
    this.ws.connectedAt$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.requestCurrentState());
    // Se la socket era già connessa prima della sottoscrizione, connectedAt$
    // non emette: senza questo secondo tentativo un reload del pannello poteva
    // restare senza stato (nessun pulsante per il giocatore prenotato).
    this.stateRetry = setTimeout(() => {
      if (this.ws.connected()) this.requestCurrentState();
    }, 1200);
    void this.refreshDiagnostics();
    void this.loadCategories();
    this.diagTimer = setInterval(() => void this.refreshDiagnostics(), 5000);

    

    
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      if (!status) {
        console.warn('⚠️ Status ricevuto è null');
        return;
      }

      

      try {
        switch (status.action) {
          case 'SHOW_QUESTION':
            
            this.handleShowQuestion(status);
            break;

          case 'ADMIN_STATE':
            this.applyAdminState(status);
            break;

          case 'START_VOTING':
            
            this.handleStartVoting(status);
            break;

          case 'ROUND_ENDED':
          case 'REVEAL':
            
            this.gameState.set('ROUND_ENDED');
            this.buzzedPlayer.set(null);
            this.showAdminControls.set(false);
            this.correctAnswer.set(null);
            this.correctPoints.set(null);
            this.wrongPoints.set(null);
            this.solution.set(null);
            this.scoringRules.set(null);
            this.payload.set(null);
            break;

          case 'PLAYER_PRENOTATO':
            this.buzzedPlayer.set(status.name);
            this.correctPoints.set(typeof status.correctPoints === 'number' ? status.correctPoints : null);
            this.wrongPoints.set(typeof status.wrongPoints === 'number' ? status.wrongPoints : null);
            this.solution.set(status.solution ?? this.correctAnswer());
            this.scoringRules.set(status.scoring ?? scoringRuleFor(this.currentQuestionType()));
            this.vibrate(100);
            break;

          case 'BLOCKED_ERROR':
            
            this.buzzedPlayer.set(null);
            break;

          default:
            console.warn('⚠️ Azione sconosciuta:', status.action);
        }
      } catch (error) {
        console.error('❌ Errore nel gestire status:', error);
      }
    });
  }

  private handleShowQuestion(status: any) {
    this.gameState.set('WAITING');
    this.currentQuestionType.set(status.type || 'QUIZ');
    this.scoringRules.set(scoringRuleFor(status.type));

    

    const sourcePayload = status.rawPayload || status.payload;

    if (sourcePayload) {
      const parsed = this.parsePayload(sourcePayload);
      if (parsed) {
        this.payload.set(parsed);
        this.extractCorrectAnswer(parsed, status.type);
        
      }
    } else {
      console.warn('⚠️ Nessun payload in SHOW_QUESTION');
    }

    this.buzzedPlayer.set(null);
    this.showAdminControls.set(false);
    this.correctPoints.set(null);
    this.wrongPoints.set(null);
  }

  private handleStartVoting(status: any) {
    
    

    this.gameState.set('ACTIVE');
    this.currentQuestionType.set(status.type || 'QUIZ');
    this.scoringRules.set(scoringRuleFor(status.type));

    const sourcePayload = status.rawPayload || status.payload;

    if (sourcePayload) {
      const parsed = this.parsePayload(sourcePayload);
      if (parsed) {
        this.payload.set(parsed);
        this.extractCorrectAnswer(parsed, status.type);
        
      }
    } else {
      console.warn('⚠️ Nessun payload in START_VOTING');
    }

    
    const isBuzzMode = status.type === 'IMAGE_BLUR' || status.type === 'WHEEL_OF_FORTUNE' || status.type === 'MUSIC';
    this.showAdminControls.set(isBuzzMode);
    
    
  }

  private parsePayload(payload: any): any {
    if (!payload) return null;

    
    if (typeof payload === 'object') {
      
      return payload;
    }

    
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        
        return parsed;
      } catch (e) {
        console.error('❌ Errore parse JSON:', e);
        return null;
      }
    }

    return null;
  }

  private extractCorrectAnswer(rawPayload: any, type: string) {
    

    if (!rawPayload) {
      console.warn('⚠️ Payload vuoto!');
      this.correctAnswer.set(null);
      return;
    }

    
    
    
    let payload = rawPayload;

    
    if (rawPayload.payload !== undefined && rawPayload.payload !== null) {
      if (typeof rawPayload.payload === 'string') {
        try {
          payload = JSON.parse(rawPayload.payload);
        } catch (e) {
          console.error('Errore parsing inner payload', e);
        }
      } else {
        payload = rawPayload.payload;
      }
    } else {
      
      if (typeof rawPayload === 'string') {
        try {
          payload = JSON.parse(rawPayload);
        } catch (e) {
          console.error('Errore parsing rawPayload', e);
        }
      }
    }

    
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        
      }
    }

    let answer = 'N/A';
    try {
      switch (type) {
        case 'QUIZ':
        case 'IMAGE_BLUR':
          answer = payload.correctAnswer !== undefined ? String(payload.correctAnswer) : 'N/A';
          
          break;

        case 'WHEEL_OF_FORTUNE':
          answer = payload.proverb || payload.correctAnswer || 'N/A';
          
          break;

        case 'MUSIC':
          const title = payload.songTitle || payload.correctAnswer || 'N/A';
          const artist = payload.artist ? ` - ${payload.artist}` : '';
          answer = title + artist;
          
          break;

        case 'TIMELINE':
          answer = 'Ordine corretto in TV al reveal';
          break;

        case 'TIME_BUZZER':
          answer = 'Tempo bersaglio in TV';
          break;

        case 'BOMBA':
          answer = 'Tabellone e bombe in TV; ogni telefono sceglie una casella';
          break;

        case 'SPEED_RUSH':
          answer = 'Classifica finale in TV';
          break;

        case 'AIR_HOCKEY_BATTLE':
          answer = payload.question || 'Domande e set in TV';
          break;

        case 'ARENA':
          answer = 'Podio finale in TV';
          break;

        case 'BONUS_BASKET':
          answer = 'Tiri dal telefono, premi ai primi tre';
          break;

        default:
          console.warn('⚠️ Tipo sconosciuto:', type);
          answer = payload.correctAnswer !== undefined ? String(payload.correctAnswer) : 'N/A';
      }
    } catch (error) {
      console.error('❌ Errore estrazione risposta:', error);
      answer = 'ERRORE';
    }

    
    this.correctAnswer.set(answer);
  }

  

  confirmCorrect() {
    const player = this.buzzedPlayer();
    if (!player) {
      console.warn('⚠️ Nessun giocatore buzzato');
      return;
    }

    const sent = this.ws.broadcastStatus(this.activeGameId(), {
      action: WsAction.ADMIN_CONFIRM_CORRECT,
      playerName: player
    });

    if (!sent) {
      // Non perdere la prenotazione: se la socket è chiusa il presentatore
      // deve poter riprovare appena l'admin torna online.
      console.warn('⚠️ Conferma non inviata: socket admin non connessa');
      this.ws.connect();
      return;
    }

    this.vibrate([100, 50, 100]);
    this.buzzedPlayer.set(null);
  }

  confirmWrong() {
    const player = this.buzzedPlayer();
    if (!player) {
      console.warn('⚠️ Nessun giocatore buzzato');
      return;
    }

    const sent = this.ws.broadcastStatus(this.activeGameId(), {
      action: WsAction.ADMIN_CONFIRM_WRONG,
      playerName: player
    });

    if (!sent) {
      console.warn('⚠️ Conferma non inviata: socket admin non connessa');
      this.ws.connect();
      return;
    }

    this.vibrate([50, 50, 50, 50]);
    this.buzzedPlayer.set(null);
  }

  /** Chiede alla TV lo stato del round corrente dopo una riconnessione. */
  private requestCurrentState(): void {
    if (!this.ws.connected()) return;
    this.ws.broadcastStatus(this.activeGameId(), {
      action: WsAction.ADMIN_REQUEST_STATE,
    });
  }

  /** Ricostruisce i controlli admin senza rimandare i telefoni in attesa. */
  private applyAdminState(status: any): void {
    const type = status.type || 'QUIZ';
    this.gameState.set('ACTIVE');
    this.currentQuestionType.set(type);
    this.scoringRules.set(status.scoring ?? scoringRuleFor(type));
    this.showAdminControls.set(
      type === 'IMAGE_BLUR' || type === 'WHEEL_OF_FORTUNE' || type === 'MUSIC'
    );

    const sourcePayload = status.rawPayload || status.payload;
    if (sourcePayload) {
      const parsed = this.parsePayload(sourcePayload);
      if (parsed) {
        this.payload.set(parsed);
        this.extractCorrectAnswer(parsed, type);
      }
    }

    const player = status.buzzedPlayer ?? null;
    this.buzzedPlayer.set(player);
    this.correctPoints.set(player ? (status.correctPoints ?? null) : null);
    this.wrongPoints.set(player ? (status.wrongPoints ?? null) : null);
    this.solution.set(status.solution ?? this.correctAnswer());
  }

  

  /** Foto delle connessioni e dell'ultimo salvataggio: serve al presentatore. */
  async refreshDiagnostics(): Promise<void> {
    const data = await this.reliability.diagnostics(this.activeGameId());
    this.diagnostics.set(data);
  }

  // -------------------------------------------------------------- Categorie

  /** Elenco completo, comprese le categorie spente. */
  async loadCategories(): Promise<void> {
    try {
      this.categories.set((await firstValueFrom(this.games.adminCategories())) ?? []);
      this.categoriesError.set(null);
    } catch {
      this.categoriesError.set('Categorie non disponibili: backend non raggiungibile.');
    }
  }

  setNewCategoryName(event: Event): void {
    this.newCategoryName.set((event.target as HTMLInputElement).value);
  }

  setNewCategoryEmoji(event: Event): void {
    this.newCategoryEmoji.set((event.target as HTMLInputElement).value);
  }

  async addCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return;
    try {
      const emoji = this.newCategoryEmoji().trim();
      const created = await firstValueFrom(this.games.createCategory({ name, emoji: emoji || undefined }));
      this.categories.update((list) => [...list, created]);
      this.newCategoryName.set('');
      this.newCategoryEmoji.set('');
      this.categoriesError.set(null);
    } catch {
      this.categoriesError.set('Creazione non riuscita: nome già usato o backend offline.');
    }
  }

  /** Timeline sì/no: decide se la categoria può ospitare un round Timeline. */
  async toggleTimeline(category: CategoryRow): Promise<void> {
    try {
      const updated = await firstValueFrom(this.games.setCategoryTimeline(category.id, !category.timeline));
      this.categories.update((list) => list.map((row) => (row.id === category.id ? { ...row, ...updated } : row)));
      this.categoriesError.set(null);
    } catch {
      this.categoriesError.set('Modifica del flag Timeline non riuscita.');
    }
  }

  /** Spegnere una categoria la toglie dalla TV senza cancellare lo storico. */
  async toggleActive(category: CategoryRow): Promise<void> {
    try {
      if (category.active) {
        await firstValueFrom(this.games.deactivateCategory(category.id));
      } else {
        await firstValueFrom(this.games.activateCategory(category.id));
      }
      this.categories.update((list) =>
        list.map((row) => (row.id === category.id ? { ...row, active: !category.active } : row))
      );
      this.categoriesError.set(null);
    } catch {
      this.categoriesError.set('Attivazione della categoria non riuscita.');
    }
  }

  /**
   * Round 1-based per il presentatore: il backend conta da 0 e la TV mostra
   * 1/40. Con lo stato appena azzerato non c'è un round da etichettare.
   */
  roundLabel(diag: any): string | number {
    if (!diag?.roundType) return '—';
    const value = Number(diag?.roundIndex);
    return Number.isFinite(value) ? value + 1 : '—';
  }

  /**
   * Ruolo leggibile nella diagnostica. Le sessioni legacy create prima della
   * separazione dei token possono essere salvate come TV pur avendo un
   * giocatore: sul pannello sono concorrenti, non televisori.
   */
  displayRole(dev: any): string {
    if (dev?.role === 'TV' && dev?.playerName) return 'REMOTE';
    return dev?.role || '—';
  }

  private activeGameId(): number {
    const value = Number(this.gameIdInput());
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  setGameId(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.gameIdInput.set(value);
    localStorage.setItem('activeGameId', String(value));
    this.reliability.start(value, 'ADMIN');
    void this.refreshDiagnostics();
  }

  /** Pulsante unico "Parti": fa partire il round su TV e telefoni. */
  nextRound(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_START_ROUND });
    this.vibrate(30);
  }

  /** Canzone: apre la manche successiva senza chiudere il round. */
  nextManche(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_NEXT_MANCHE });
    this.vibrate(30);
  }

  showLeaderboard(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_SHOW_LEADERBOARD });
    this.vibrate(30);
  }

  toggleGamePause(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_TOGGLE_PAUSE });
    this.vibrate(30);
  }

  /** Accende il tema di Natale su TV e telefoni e lo ricorda al refresh. */
  toggleChristmas(): void {
    const enabled = !this.theme.xmas();
    this.theme.setXmas(enabled);
    this.ws.broadcastStatus(this.activeGameId(), {
      action: WsAction.CHRISTMAS_TOGGLE,
      enabled,
    });
    this.vibrate(30);
  }

  showDemo(): void {
    this.showDemoOf(this.currentQuestionType());
  }

  showDemoOf(type: string): void {
    this.ws.broadcastStatus(this.activeGameId(), {
      action: WsAction.ADMIN_SHOW_DEMO,
      type,
    });
    this.vibrate(30);
  }

  hideDemo(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_HIDE_DEMO });
  }

  startBonus(type: BonusType): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_START_BONUS, type });
    this.vibrate(30);
  }

  stopBonus(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: WsAction.ADMIN_STOP_BONUS });
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  ngOnDestroy() {
    if (this.diagTimer) clearInterval(this.diagTimer);
    if (this.stateRetry) clearTimeout(this.stateRetry);
    
  }
}
