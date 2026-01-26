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
  currentQuestionType = signal<'QUIZ' | 'TRUE_FALSE' | 'CHRONO' | 'IMAGE_BLUR' | 'WHEEL_OF_FORTUNE'>('QUIZ');
  buzzedPlayer = signal<string | null>(null);
  showAdminControls = signal(false);
  gameState = signal<'WAITING' | 'ACTIVE' | 'ROUND_ENDED'>('WAITING');
  payload = signal<any>(null);

  ngOnInit(): void {
    this.lockOrientation();

    // Ascolta gli aggiornamenti dalla TV
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      console.log('📡 Admin riceve:', status);

      switch (status.action) {
        case 'SHOW_QUESTION':
          // La domanda è mostrata: mostra risposta corretta all'admin
          console.log('🔍 ADMIN riceve SHOW_QUESTION:', status);
          console.log('📦 Payload ricevuto:', status.payload);

          this.gameState.set('WAITING');
          this.currentQuestionType.set(status.type);

          // Salva il payload (contiene la risposta corretta)
          if (status.payload) {
            this.payload.set(status.payload);
            this.extractCorrectAnswer(status.payload, status.type);
            console.log('✅ Risposta estratta:', this.correctAnswer());
          } else {
            console.warn('⚠️ Nessun payload ricevuto!');
          }

          this.buzzedPlayer.set(null);
          this.showAdminControls.set(false);
          break;

        case 'START_VOTING':
          this.gameState.set('ACTIVE');
          this.currentQuestionType.set(status.type);

          // Mostra controlli solo per modalità BUZZ
          const isBuzzMode = status.type === 'IMAGE_BLUR' || status.type === 'WHEEL_OF_FORTUNE';
          this.showAdminControls.set(isBuzzMode);
          break;

        case 'PLAYER_PRENOTATO':
          // Un giocatore si è prenotato
          this.buzzedPlayer.set(status.name);
          this.vibrate(100);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.gameState.set('ROUND_ENDED');
          this.buzzedPlayer.set(null);
          this.showAdminControls.set(false);
          this.correctAnswer.set(null);
          this.payload.set(null);
          break;

        case 'BLOCKED_ERROR':
          // Reset dopo errore
          this.buzzedPlayer.set(null);
          break;
      }
    });
  }

  // Estrae la risposta corretta dal payload in base al tipo
  private extractCorrectAnswer(payload: any, type: string) {
    console.log('🔎 Estraendo risposta da:', payload, 'tipo:', type);

    if (!payload) {
      console.warn('⚠️ Payload vuoto!');
      this.correctAnswer.set(null);
      return;
    }

    let answer = 'N/A';

    switch (type) {
      case 'QUIZ':
      case 'TRUE_FALSE':
      case 'CHRONO':
      case 'IMAGE_BLUR':
        answer = payload.correctAnswer || 'N/A';
        break;

      case 'WHEEL_OF_FORTUNE':
        // Per WHEEL_OF_FORTUNE il proverbio può essere in payload.payload o payload.proverb
        answer = payload.payload || payload.proverb || payload.correctAnswer || 'N/A';
        console.log('🎡 WHEEL_OF_FORTUNE risposta:', answer);
        break;

      default:
        answer = 'N/A';
    }

    console.log('✅ Risposta finale estratta:', answer);
    this.correctAnswer.set(answer);
  }

  // ========== CONTROLLI ADMIN ==========

  confirmCorrect() {
    const player = this.buzzedPlayer();
    if (!player) return;

    console.log('✅ Admin conferma CORRETTA per:', player);

    // Simula il click sul bottone ✅ della TV
    this.ws.broadcastStatus(1, {
      action: 'ADMIN_CONFIRM_CORRECT',
      playerName: player
    });

    this.vibrate([100, 50, 100]);
    this.buzzedPlayer.set(null);
  }

  confirmWrong() {
    const player = this.buzzedPlayer();
    if (!player) return;

    console.log('❌ Admin conferma SBAGLIATA per:', player);

    // Simula il click sul bottone ❌ della TV
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
    // Non disconnettiamo il WebSocket perché potrebbe essere usato da altri
  }
}
