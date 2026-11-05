
import { Component, inject, OnDestroy, OnInit, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../services/web-socket.service';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { scoringRuleFor, ScoringRule } from '../game-component/interfaces/scoring-rules';

@Component({
  selector: 'app-admin-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);
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

        case 'ROULETTE':
          answer = payload.correctAnswer !== undefined ? String(payload.correctAnswer) : 'Colore in TV';
          break;

        case 'TIMELINE':
          answer = 'Ordine corretto in TV al reveal';
          break;

        case 'TIME_BUZZER':
          answer = 'Tempo bersaglio in TV';
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

    

    this.ws.broadcastStatus(this.activeGameId(), {
      action: 'ADMIN_CONFIRM_CORRECT',
      playerName: player
    });

    this.vibrate([100, 50, 100]);
    this.buzzedPlayer.set(null);
  }

  confirmWrong() {
    const player = this.buzzedPlayer();
    if (!player) {
      console.warn('⚠️ Nessun giocatore buzzato');
      return;
    }

    

    this.ws.broadcastStatus(this.activeGameId(), {
      action: 'ADMIN_CONFIRM_WRONG',
      playerName: player
    });

    this.vibrate([50, 50, 50, 50]);
    this.buzzedPlayer.set(null);
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
  }

  nextRound(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_NEXT_ROUND' });
    this.vibrate(30);
  }

  showLeaderboard(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_SHOW_LEADERBOARD' });
    this.vibrate(30);
  }

  toggleGamePause(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_TOGGLE_PAUSE' });
    this.vibrate(30);
  }

  showDemo(): void {
    this.showDemoOf(this.currentQuestionType());
  }

  showDemoOf(type: string): void {
    this.ws.broadcastStatus(this.activeGameId(), {
      action: 'ADMIN_SHOW_DEMO',
      type,
    });
    this.vibrate(30);
  }

  hideDemo(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_HIDE_DEMO' });
  }

  startBonus(type: 'ROULETTE' | 'BASKET'): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_START_BONUS', type });
    this.vibrate(30);
  }

  stopBonus(): void {
    this.ws.broadcastStatus(this.activeGameId(), { action: 'ADMIN_STOP_BONUS' });
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  ngOnDestroy() {
    
  }
}
