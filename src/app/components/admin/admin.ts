// src/app/components/admin-component/admin-component.ts
import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {WebSocketService} from '../../services/web-socket.service';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-admin-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);

  // Admin state
  correctAnswer = signal<string | null>(null);
  currentQuestionType = signal<string>('QUIZ');
  buzzedPlayer = signal<string | null>(null);
  showAdminControls = signal(false);
  gameState = signal<'WAITING' | 'ACTIVE' | 'ROUND_ENDED'>('WAITING');
  payload = signal<any>(null);

  // Color map per visualizzare bene i colori
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

    console.log('🔌 Admin WebSocket connesso');

    // Ascolta gli aggiornamenti dalla TV
    this.ws.status$.subscribe((status: any) => {
      if (!status) {
        console.warn('⚠️ Status ricevuto è null');
        return;
      }

      console.log('📡 Admin riceve:', status);

      try {
        switch (status.action) {
          case 'SHOW_QUESTION':
            console.log('🔍 SHOW_QUESTION ricevuto');
            this.handleShowQuestion(status);
            break;

          case 'START_VOTING':
            console.log('🎮 START_VOTING ricevuto');
            this.handleStartVoting(status);
            break;

          case 'ROUND_ENDED':
          case 'REVEAL':
            console.log('🏁 ROUND_ENDED ricevuto');
            this.gameState.set('ROUND_ENDED');
            this.buzzedPlayer.set(null);
            this.showAdminControls.set(false);
            this.correctAnswer.set(null);
            this.payload.set(null);
            break;

          case 'PLAYER_PRENOTATO':
            console.log('🎤 PLAYER_PRENOTATO:', status.name);
            this.buzzedPlayer.set(status.name);
            this.vibrate(100);
            break;

          case 'BLOCKED_ERROR':
            console.log('❌ BLOCKED_ERROR');
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

    console.log('📦 Payload RAW:', status.payload);

    if (status.payload) {
      const parsed = this.parsePayload(status.payload);
      if (parsed) {
        this.payload.set(parsed);
        this.extractCorrectAnswer(parsed, status.type);
        console.log('✅ Risposta estratta:', this.correctAnswer());
      }
    } else {
      console.warn('⚠️ Nessun payload in SHOW_QUESTION');
    }

    this.buzzedPlayer.set(null);
    this.showAdminControls.set(false);
  }

  private handleStartVoting(status: any) {
    console.log('🎮 Gestendo START_VOTING');
    console.log('📦 Payload in START_VOTING:', status.payload);

    this.gameState.set('ACTIVE');
    this.currentQuestionType.set(status.type || 'QUIZ');

    // Se c'è il payload, estraiamo la risposta
    if (status.payload) {
      const parsed = this.parsePayload(status.payload);
      if (parsed) {
        this.payload.set(parsed);
        this.extractCorrectAnswer(parsed, status.type);
        console.log('✅ Risposta estratta da START_VOTING:', this.correctAnswer());
      }
    } else {
      console.warn('⚠️ Nessun payload in START_VOTING');
    }

    // Mostra controlli solo per modalità BUZZ
    const isBuzzMode = status.type === 'IMAGE_BLUR' || status.type === 'WHEEL_OF_FORTUNE' || status.type === 'MUSIC';
    this.showAdminControls.set(isBuzzMode);

    console.log('🎮 GameState settato ad ACTIVE:', this.gameState());
    console.log('🎮 ShowAdminControls:', this.showAdminControls());
  }

  private parsePayload(payload: any): any {
    if (!payload) return null;

    // Se è già un oggetto, ritorna così com'è
    if (typeof payload === 'object') {
      console.log('📦 Payload è già oggetto');
      return payload;
    }

    // Se è una stringa, prova a fare il parse
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        console.log('📦 Payload parsato da stringa:', parsed);
        return parsed;
      } catch (e) {
        console.error('❌ Errore parse JSON:', e);
        return null;
      }
    }

    return null;
  }

  private extractCorrectAnswer(payload: any, type: string) {
    console.log('🔎 Estraendo risposta da:', payload, 'tipo:', type);

    if (!payload) {
      console.warn('⚠️ Payload vuoto!');
      this.correctAnswer.set(null);
      return;
    }

    let answer = 'N/A';

    try {
      switch (type) {
        case 'QUIZ':
        case 'TRUE_FALSE':
        case 'CHRONO':
        case 'IMAGE_BLUR':
          answer = payload.correctAnswer || 'N/A';
          console.log(`📝 ${type} risposta:`, answer);
          break;

        case 'WHEEL_OF_FORTUNE':
          // Cerca in questo ordine: proverb -> payload -> correctAnswer
          answer = payload.proverb || payload.payload || payload.correctAnswer || 'N/A';
          console.log('🎡 WHEEL_OF_FORTUNE risposta:', answer);
          break;

        default:
          console.warn('⚠️ Tipo sconosciuto:', type);
          answer = payload.correctAnswer || 'N/A';
      }
    } catch (error) {
      console.error('❌ Errore estrazione risposta:', error);
      answer = 'ERRORE';
    }

    console.log('✅ Risposta finale:', answer);
    this.correctAnswer.set(answer);
  }

  // ========== CONTROLLI ADMIN ==========

  confirmCorrect() {
    const player = this.buzzedPlayer();
    if (!player) {
      console.warn('⚠️ Nessun giocatore buzzato');
      return;
    }

    console.log('✅ Admin conferma CORRETTA per:', player);

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

    console.log('❌ Admin conferma SBAGLIATA per:', player);

    this.ws.broadcastStatus(1, {
      action: 'ADMIN_CONFIRM_WRONG',
      playerName: player
    });

    this.vibrate([50, 50, 50, 50]);
    this.buzzedPlayer.set(null);
  }

  // ========== UTILITY ==========

  private async lockOrientation() {
    try {
      const screen = window.screen as any;
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      console.log('Orientamento non bloccabile');
    }
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  ngOnDestroy() {
    console.log('🔌 Admin disconnesso');
  }
}
