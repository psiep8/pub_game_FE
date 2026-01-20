import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {WebSocketService} from '../../services/web-socket.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-remote-component',
  imports: [
    FormsModule
  ],
  templateUrl: './remote-component.html',
  styleUrl: './remote-component.scss',
})
export class RemoteComponent implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO'>('QUIZ');
  hasAnswered = signal(false);
  selectedYear = signal<number>(2000);
  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1); // Inizializzalo con un valore o caricalo dal server

  // Timing
  currentRoundType: string = '';

  ngOnInit(): void {
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'START_VOTING':
          // Questo attiva il telecomando quando la TV parte!
          this.onStartVoting(status.type);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          // Questo chiude il telecomando se il tempo scade o finisce il round
          this.gameState.set('WAITING');
          break;

        case 'RESUME_AFTER_ERROR':
          // Se il giocatore era bloccato, lo sblocchiamo per il prossimo round
          if (status.blockedPlayer !== this.nickname()) {
            this.gameState.set('WAITING');
          }
          break;
      }
    });
  }

  setNickname() {
    if (this.tempNickname.trim()) {
      this.nickname.set(this.tempNickname);
      localStorage.setItem('nickname', this.tempNickname);
    }
  }

  sendVote(index: number) {
    const responseTimeMs = Date.now() - this.startTime;

    this.ws.sendAnswer(1, this.nickname()!, index, responseTimeMs);

    this.hasAnswered.set(true);
    this.gameState.set('LOCKED');
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, -1, time); // -1 indica che non c'è ancora una scelta A,B,C,D
    this.gameState.set('LOCKED');
  }

  onStartVoting(type: string) {
    this.gameState.set('VOTING');
    this.questionType.set(type as "QUIZ" | "TRUE_FALSE" | "MUSIC" | "IMAGE_BLUR" | "CHRONO");
    this.roundStartTime = Date.now();
    this.selectedYear.set(2000);
  }

// Gestione Chrono
  onYearChange(event: any) {
    this.selectedYear.set(parseInt(event.target.value));
  }

  // 2. Calcolo del tempo di risposta
  private calculateResponseTime(): number {
    if (this.startTime === 0) return 5000; // Default se qualcosa fallisce
    return Date.now() - this.startTime;
  }

  sendChronoAnswer() {
    const elapsed = Date.now() - this.roundStartTime;

    // TS2345 e TS2339 risolti:
    // Usiamo "!" per dire a TS che il nickname non è null
    // e usiamo il signal gameId()
    this.ws.sendAnswer(
      this.gameId(),
      this.nickname()!,
      this.selectedYear(),
      elapsed
    );
    this.gameState.set('WAITING');
  }

  onRoundEnd() {
    this.gameState.set('WAITING'); // Forza il ritorno alla schermata di attesa
    this.selectedYear.set(2000);   // Pulisce l'input per il prossimo
  }

  setupNewRound(type: string) {
    this.currentRoundType = type;
    this.hasAnswered.set(false);
    this.startTime = Date.now(); // Facciamo partire il cronometro
    if (type === 'CHRONO') {
      this.selectedYear.set(2000);
    }
  }

  ngOnDestroy() {
    this.ws.disconnect();
  }

  // Se vuoi un tasto "Esci" nel telecomando
  logout() {
    this.ws.disconnect();
    localStorage.removeItem('nickname');
    location.reload(); // Torna alla schermata di login
  }
}
