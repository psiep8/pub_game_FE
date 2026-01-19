import {Component, signal, inject, OnInit, HostListener} from '@angular/core';
import {trigger, state, style, transition, animate} from '@angular/animations';
import {GameRound, GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/web-socket.service';

@Component({
  selector: 'app-game-component',
  imports: [],
  templateUrl: './game-component.html',
  styleUrl: './game-component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class GameComponent implements OnInit {
  public ws = inject(WebSocketService);

  // Dati
  allCategories = signal<any[]>([]);
  round = signal<GameRound | null>(null);

  // UI State
  isSpinning = signal(false);
  selectedCatIndex = signal<number | null>(null);
  phase = signal<'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION'>('IDLE');
  timer = signal(10);
  showQuestion = signal(false);
  isPaused = signal(false);
  private timerInterval: any; // Riferimento globale per il timer
  showResetModal = signal(false);
  currentGameId = signal<number | null>(null);
  currentBlur = 40;
  blurInterval: any;
  playerWhoBuzzed: string | null = null;
  roundResults = signal<any[]>([]);

  // ALERT REFRESH: Blocca l'aggiornamento della pagina
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.phase() !== 'IDLE') {
      $event.returnValue = "Hai una partita in corso! Vuoi davvero uscire?";
    }
  }

  togglePause() {
    if (this.phase() === 'QUESTION') {
      this.isPaused.update(v => !v);
    }
  }

  constructor(private gameService: GameService) {
    this.ws.responses$.subscribe(res => {
      const currentRound = this.round();
      if (!currentRound) return;

      // Recuperiamo il testo della risposta data dal giocatore usando l'indice ricevuto
      const playerChoiceText = currentRound.payload.options[res.answerIndex];

      // Confronto tra stringhe
      const isCorrect = playerChoiceText === currentRound.payload.correctAnswer;

      const score = this.calculateScore(isCorrect, res.responseTimeMs);

      console.log(`[RICEVUTO] ${res.playerName}: ${isCorrect ? '✅' : '❌'} (${playerChoiceText}). Punti: ${score}`);

      if (res.answerIndex === -1) {
        this.handleBuzz(res.playerName);
      } else {
        // Gestione normale per Quiz e Chrono
        this.processNormalAnswer(res);
      }
    });
  }

  calculateScore(isCorrect: boolean, timeMs: number): number {
    const maxTime = 10000; // 10 secondi del timer

    // Se il tempo supera il max (per lag o altro), lo cappiamo
    const safeTime = Math.min(timeMs, maxTime);

    // Ratio: 1 se rispondi a 0ms, 0 se rispondi a 10s
    const ratio = (maxTime - safeTime) / maxTime;

    if (isCorrect) {
      // Risposta GIUSTA: da 1000 (0ms) a 0 (10s)
      return Math.round(1000 * ratio);
    } else {
      // Risposta SBAGLIATA: da -1000 (0ms) a 0 (10s)
      // Più sei veloce a sbagliare, più punti perdi
      return Math.round(-1000 * ratio);
    }
  }

  calculateChronoScore(guessedYear: number, realYear: number, timeMs: number): number {
    const distance = Math.abs(guessedYear - realYear);

    // Se la distanza è oltre 100 anni, 0 punti
    if (distance > 100) return 0;

    // 1000 punti base meno 10 punti per ogni anno di differenza
    let baseScore = 1000 - (distance * 10);

    // Moltiplicatore velocità: chi risponde subito prende il 100%, chi risponde alla fine il 50%
    const speedFactor = 1 - (timeMs / 20000); // Assumendo 10s di timer (10000ms)
    const finalScore = Math.round(baseScore * Math.max(0.5, speedFactor));

    return Math.max(0, finalScore);
  }

  handleBuzz(playerName: string) {
    // Se qualcuno ha già prenotato, ignoriamo gli altri
    if (this.playerWhoBuzzed) return;

    this.playerWhoBuzzed = playerName;

    // 1. Ferma il blur se attivo
    if (this.blurInterval) {
      clearInterval(this.blurInterval);
    }

    // 2. Ferma l'eventuale musica (se hai un riferimento all'oggetto Audio)
    // this.currentAudio?.pause();

    // 3. Invia il comando via WebSocket per bloccare i telefoni degli altri
    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });

    console.log(`[BUZZ] Il giocatore ${playerName} si è prenotato!`);
  }

  ngOnInit() {
    this.gameService.getCategories().subscribe((cats: any[]) => {
      const positioned = cats.map((c: any) => ({
        ...c,
        top: Math.random() * 80 + 10 + '%',
        left: Math.random() * 80 + 5 + '%',
        rotate: (Math.random() * 40 - 20) + 'deg',
        delay: (Math.random() * 2) + 's',
        duration: (3 + Math.random() * 2) + 's'
      }));
      this.allCategories.set(positioned);
    });
    const savedId = localStorage.getItem('activeGameId');
    if (savedId) {
      this.currentGameId.set(+savedId);
      console.log("Partita ripristinata ID:", savedId);
    }
  }

  startNewRound() {
    if (this.isSpinning()) return;

    // FIX GRAFICA: Resettiamo tutto prima di chiamare il backend
    this.showQuestion.set(false);
    this.phase.set('IDLE');
    this.selectedCatIndex.set(null);
    this.isPaused.set(false);

    this.gameService.getNextRound(1).subscribe({
      next: (newRound: any) => {
        this.round.set(newRound);
        this.runExtraction();
      }
    });
  }

  private async runExtraction() {
    this.isSpinning.set(true);
    this.phase.set('SPINNING');

    await new Promise(r => setTimeout(r, 1500)); // Un po' di suspense in più

    const targetName = this.round()?.payload.category;
    const targetIdx = this.allCategories().findIndex(c => c.name === targetName);

    this.selectedCatIndex.set(targetIdx);
    this.phase.set('SELECTED'); // Qui scatta l'effetto giallo (is-selected)

    await new Promise(r => setTimeout(r, 2000));

    this.phase.set('QUESTION');
    this.showQuestion.set(true);
    this.isSpinning.set(false);
    this.startTimer();
  }

  private startTimer() {
    this.ws.responses.set([]); // Svuota le risposte del round precedente sulla TV

    this.ws.broadcastStatus(1, {
      action: 'START_VOTING',
      type: this.round()?.payload.type
    });
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timer.set(10);

    this.timerInterval = setInterval(() => {
      // Se è in pausa, non scaliamo il tempo
      if (this.isPaused()) return;

      if (this.timer() > 0) {
        this.timer.update(v => v - 1);
      } else {
        clearInterval(this.timerInterval);
        this.revealAnswer();
      }
    }, 1000);
  }

  private revealAnswer() {
    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});

      // LOGICA FUTURA: Qui potresti chiamare un servizio per salvare
      // il risultato sul DB: this.gameService.saveResult(currentRound.id, 'LOST').subscribe();
    }
  }

// 1. Gestione Risposte Standard (Quiz e Chrono)
  processNormalAnswer(res: any) {
    const currentRound = this.round();
    if (!currentRound) return;

    let isCorrect = false;
    let score = 0;

    if (currentRound.type === 'CHRONO') {
      // Logica Chrono: calcolo distanza dall'anno reale
      const realYear = parseInt(currentRound.payload.correctAnswer);
      const distance = Math.abs(res.answerIndex - realYear); // answerIndex qui è l'anno inviato
      isCorrect = distance <= 2; // Consideriamo "giusta" se scarta di max 2 anni
      score = this.calculateChronoScore(res.answerIndex, realYear, res.responseTimeMs);
    } else {
      // Logica Quiz/True-False
      const playerChoiceText = currentRound.payload.options[res.answerIndex];
      isCorrect = playerChoiceText === currentRound.payload.correctAnswer;
      score = this.calculateScore(isCorrect, res.responseTimeMs);
    }

    console.log(`Risposta da ${res.playerName}: ${isCorrect ? '✅' : '❌'} (${score} pt)`);
  }

// 2. Effetto Blur Progressivo
  startBlurEffect() {
    if (this.blurInterval) clearInterval(this.blurInterval);

    this.currentBlur = 40;
    this.blurInterval = setInterval(() => {
      if (this.currentBlur > 0) {
        this.currentBlur -= 0.5; // Più fluido
      } else {
        clearInterval(this.blurInterval);
      }
    }, 200); // Ogni 200ms diventa più nitida
  }

// 3. Controllo Admin (Tastiera)
  @HostListener('window:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.playerWhoBuzzed) return;

    if (event.key === 'ArrowUp') {
      this.confirmCorrect();
    } else if (event.key === 'ArrowDown') {
      this.confirmWrong();
    }
  }

  confirmCorrect() {
    const winner = this.playerWhoBuzzed;
    this.currentBlur = 0; // Rivela immagine
    if (this.blurInterval) clearInterval(this.blurInterval);

    this.ws.broadcastStatus(1, {
      action: 'ROUND_ENDED',
      winner: winner,
      points: 1000 // Premio fisso per chi indovina al buzz
    });

    this.playerWhoBuzzed = null;
  }

  confirmWrong() {
    const loser = this.playerWhoBuzzed;
    this.playerWhoBuzzed = null;

    this.ws.broadcastStatus(1, {
      action: 'RESUME_AFTER_ERROR',
      blockedPlayer: loser
    });

    // Riprendi il blur se era un gioco di immagini
    if (this.round()?.type === 'IMAGE_BLUR') {
      this.startBlurEffect();
    }
  }

  openResetModal() {
    this.showResetModal.set(true);
  }

  confirmReset() {
    this.showResetModal.set(false);
    location.reload();
    // In futuro: localStorage.removeItem('activeGameId'); location.reload();
  }

}

