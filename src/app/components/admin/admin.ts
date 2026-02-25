
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { WebSocketService } from '../../services/web-socket.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);

  
  correctAnswer = signal<string | null>(null);
  currentQuestionType = signal<string>('QUIZ');
  buzzedPlayer = signal<string | null>(null);
  showAdminControls = signal(false);
  gameState = signal<'WAITING' | 'ACTIVE' | 'ROUND_ENDED'>('WAITING');
  payload = signal<any>(null);

  
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
    this.lockOrientation();

    

    
    this.ws.status$.subscribe((status: any) => {
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
            this.payload.set(null);
            break;

          case 'PLAYER_PRENOTATO':
            
            this.buzzedPlayer.set(status.name);
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
  }

  private handleStartVoting(status: any) {
    
    

    this.gameState.set('ACTIVE');
    this.currentQuestionType.set(status.type || 'QUIZ');

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
        case 'TRUE_FALSE':
        case 'CHRONO':
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

    

    this.ws.broadcastStatus(1, {
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

    

    this.ws.broadcastStatus(1, {
      action: 'ADMIN_CONFIRM_WRONG',
      playerName: player
    });

    this.vibrate([50, 50, 50, 50]);
    this.buzzedPlayer.set(null);
  }

  

  private async lockOrientation() {
    try {
      const screen = window.screen as any;
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      
    }
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  ngOnDestroy() {
    
  }
}
