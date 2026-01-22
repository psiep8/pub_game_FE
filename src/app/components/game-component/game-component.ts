import {Component, signal, inject, OnInit, HostListener} from '@angular/core';
import {trigger, state, style, transition, animate} from '@angular/animations';
import {GameRound, GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/web-socket.service';
import {AiGeneratorService} from '../../services/ai-generator-service';
import {firstValueFrom} from 'rxjs';

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
  phase = signal<'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION' | 'CHRONO'>('IDLE');
  timer = signal(10);
  showQuestion = signal(false);
  isPaused = signal(false);
  private timerInterval: any;
  showResetModal = signal(false);
  currentGameId = signal<number | null>(null);
  currentBlur = 40;
  blurInterval: any;
  playerWhoBuzzed: string | null = null;
  showTypeReveal = signal<string | null>(null);

  // QR Code URL per i giocatori
  remoteUrl = 'http://192.168.1.3:4200' + '/play';
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`;

  // ALERT REFRESH: Blocca l'aggiornamento della pagina
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.phase() !== 'IDLE') {
      $event.returnValue = "Hai una partita in corso! Vuoi davvero uscire?";
    }
  }

  togglePause() {
    // Permetti la pausa in qualsiasi fase del gioco tranne IDLE
    if (this.phase() !== 'IDLE' && this.showQuestion()) {
      this.isPaused.update(v => !v);
    }
  }

  constructor(private gameService: GameService, private aiService: AiGeneratorService) {
    this.ws.responses$.subscribe(res => {
      const currentRound = this.round();
      if (!currentRound) return;

      const playerChoiceText = currentRound.payload.options[res.answerIndex];
      const isCorrect = playerChoiceText === currentRound.payload.correctAnswer;
      const score = this.calculateScore(isCorrect, res.responseTimeMs);

      console.log(`[RICEVUTO] ${res.playerName}: ${isCorrect ? '✅' : '❌'} (${playerChoiceText}). Punti: ${score}`);

      if (res.answerIndex === -1) {
        this.handleBuzz(res.playerName);
      } else {
        this.processNormalAnswer(res);
      }
    });
  }

  calculateScore(isCorrect: boolean, timeMs: number): number {
    const maxTime = 10000;
    const safeTime = Math.min(timeMs, maxTime);
    const ratio = (maxTime - safeTime) / maxTime;

    if (isCorrect) {
      return Math.round(1000 * ratio);
    } else {
      return Math.round(-1000 * ratio);
    }
  }

  calculateChronoScore(guessedYear: number, realYear: number, timeMs: number): number {
    const distance = Math.abs(guessedYear - realYear);
    if (distance > 100) return 0;

    let baseScore = 1000 - (distance * 10);
    const speedFactor = 1 - (timeMs / 20000);
    const finalScore = Math.round(baseScore * Math.max(0.5, speedFactor));

    return Math.max(0, finalScore);
  }

  handleBuzz(playerName: string) {
    if (this.playerWhoBuzzed) return;
    this.playerWhoBuzzed = playerName;

    if (this.blurInterval) {
      clearInterval(this.blurInterval);
    }

    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });

    console.log(`[BUZZ] Il giocatore ${playerName} si è prenotato!`);
  }

  async ngOnInit() {
    try {
      // 1. Carichiamo le categorie con await
      const cats = await firstValueFrom(this.gameService.getCategories());

      // 2. Genera posizioni non sovrapposte
      const positioned = this.generateNonOverlappingPositions(cats);

      this.allCategories.set(positioned);

      // 3. Ripristino ID Partita
      const savedId = localStorage.getItem('activeGameId');
      if (savedId) {
        this.currentGameId.set(+savedId);
        console.log("Partita ripristinata ID:", savedId);
      }
    } catch (err) {
      console.error("Errore durante l'inizializzazione:", err);
    }
  }

  // Funzione per generare posizioni casuali senza sovrapposizioni
  private generateNonOverlappingPositions(categories: any[]) {
    const positioned: any[] = [];
    const minDistance = 180;
    const maxAttempts = 100;

    categories.forEach((cat: any) => {
      let validPosition = false;
      let attempts = 0;
      let newPos = { top: 0, left: 0 };

      while (!validPosition && attempts < maxAttempts) {
        newPos = {
          top: Math.random() * 70 + 10,
          left: Math.random() * 80 + 5
        };

        validPosition = positioned.every(existing => {
          const distance = Math.sqrt(
            Math.pow(newPos.top - existing.topNum, 2) +
            Math.pow(newPos.left - existing.leftNum, 2)
          );
          return distance >= minDistance / 10;
        });

        attempts++;
      }

      const duration = 15 + Math.random() * 10;
      const delay = Math.random() * 3;

      positioned.push({
        ...cat,
        top: newPos.top + '%',
        left: newPos.left + '%',
        topNum: newPos.top,
        leftNum: newPos.left,
        rotate: (Math.random() * 6 - 3) + 'deg',
        delay: delay + 's',
        duration: duration + 's',
        style: `--float-duration: ${duration}s; --float-delay: ${delay}s;`
      });
    });

    return positioned;
  }

  async startNewRound() {
    if (this.isSpinning()) return;

    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCatIndex.set(null);
    this.playerWhoBuzzed = null;
    this.timer.set(10);
    this.isPaused.set(false);

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Rigenera posizioni casuali
    const currentCats = this.allCategories();
    const repositioned = this.generateNonOverlappingPositions(currentCats);
    this.allCategories.set(repositioned);

    if (!this.currentGameId()) {
      const newGame = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(newGame.id);
      localStorage.setItem('activeGameId', newGame.id.toString());
    }

    const categories = this.allCategories();
    const randomIndex = Math.floor(Math.random() * categories.length);
    const selectedCat = categories[randomIndex];

    const types = ['QUIZ', 'CHRONO', 'TRUE_FALSE'] as const;
    const extractedType = types[Math.floor(Math.random() * types.length)];
    const difficulty = ['facile', 'medio', 'difficile'][
      Math.floor(Math.random() * 3)
      ];

    // Nascondi subito la schermata IDLE e mostra il reveal
    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 7000)); // Mostra per 3.5 secondi
    this.showTypeReveal.set(null);

    this.isSpinning.set(true);

    try {
      const nextRound = await firstValueFrom(
        this.aiService.triggerNewAiRound(
          this.currentGameId()!,
          selectedCat.name,
          extractedType,
          difficulty
        )
      );

      if (typeof nextRound.payload === 'string') {
        nextRound.payload = JSON.parse(nextRound.payload);
      }

      this.round.set(nextRound);

      await new Promise(r => setTimeout(r, 4000));
      this.selectedCatIndex.set(randomIndex);
      this.phase.set('SELECTED');

      await new Promise(r => setTimeout(r, 6000));
      if (nextRound.type === 'CHRONO') {
        this.phase.set('CHRONO');
      } else {
        this.phase.set('QUESTION');
      }
      this.showQuestion.set(true);
      this.isSpinning.set(false);

      this.startTimer();

    } catch (err) {
      console.error('Errore nel nuovo round:', err);
      this.isSpinning.set(false);
      this.phase.set('IDLE');
    }
  }

  private startTimer() {
    this.ws.responses.set([]);

    this.ws.broadcastStatus(1, {
      action: 'START_VOTING',
      type: this.round()?.type
    });

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timer.set(10);

    this.timerInterval = setInterval(() => {
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
    }
  }

  processNormalAnswer(res: any) {
    const currentRound = this.round();
    if (!currentRound) return;

    let isCorrect = false;
    let score = 0;

    if (currentRound.type === 'CHRONO') {
      const realYear = parseInt(currentRound.payload.correctAnswer);
      const distance = Math.abs(res.answerIndex - realYear);
      isCorrect = distance <= 2;
      score = this.calculateChronoScore(res.answerIndex, realYear, res.responseTimeMs);
    } else {
      const playerChoiceText = currentRound.payload.options[res.answerIndex];
      isCorrect = playerChoiceText === currentRound.payload.correctAnswer;
      score = this.calculateScore(isCorrect, res.responseTimeMs);
    }

    console.log(`Risposta da ${res.playerName}: ${isCorrect ? '✅' : '❌'} (${score} pt)`);
  }

  startBlurEffect() {
    if (this.blurInterval) clearInterval(this.blurInterval);

    this.currentBlur = 40;
    this.blurInterval = setInterval(() => {
      if (this.currentBlur > 0) {
        this.currentBlur -= 0.5;
      } else {
        clearInterval(this.blurInterval);
      }
    }, 200);
  }

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
    this.currentBlur = 0;
    if (this.blurInterval) clearInterval(this.blurInterval);

    this.ws.broadcastStatus(1, {
      action: 'ROUND_ENDED',
      winner: winner,
      points: 1000
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
  }
}
