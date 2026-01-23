import {Component, signal, inject, OnInit, HostListener} from '@angular/core';
import {trigger, transition, style, animate} from '@angular/animations';
import {GameRound, GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/web-socket.service';
import {AiGeneratorService} from '../../services/ai-generator-service';
import {firstValueFrom} from 'rxjs';
import {DomSanitizer} from '@angular/platform-browser';

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
  timer = signal(30); // 30 secondi per IMAGE_BLUR
  showQuestion = signal(false);
  isPaused = signal(false);
  private timerInterval: any;
  showResetModal = signal(false);
  currentGameId = signal<number | null>(null);

  // IMAGE_BLUR specifico
  currentBlur = 40;
  blurInterval: any;
  playerWhoBuzzed: string | null = null;

  showTypeReveal = signal<string | null>(null);

  // Popup risultato
  showResultPopup = signal(false);
  resultType = signal<'correct' | 'wrong'>('correct');
  resultPoints = signal(0);
  resultPlayerName = signal('');

  // QR Code
  remoteUrl = 'http://192.168.1.3:4200/play';
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`;

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.phase() !== 'IDLE') {
      $event.returnValue = "Hai una partita in corso! Vuoi davvero uscire?";
    }
  }

  togglePause() {
    if (this.phase() !== 'IDLE' && this.showQuestion()) {
      this.isPaused.update(v => !v);
    }
  }

  constructor(private gameService: GameService, private aiService: AiGeneratorService, private sanitizer: DomSanitizer,) {
    this.ws.responses$.subscribe(res => {
      const currentRound = this.round();
      if (!currentRound) return;

      if (res.answerIndex === -1) {
        // È un BUZZ
        this.handleBuzz(res.playerName);
      } else {
        this.processNormalAnswer(res);
      }
    });
  }
  getSafeUrl(url: string | undefined | null) {
    // Se l'url non esiste, restituiamo un'immagine trasparente o vuota
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  calculateScore(isCorrect: boolean, timeMs: number): number {
    const maxTime = 10000;
    const safeTime = Math.min(timeMs, maxTime);
    const ratio = (maxTime - safeTime) / maxTime;

    if (isCorrect) {
      return Math.round(1000 * ratio);
    } else {
      return Math.round(-500 * ratio); // Penalità
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
    if (this.playerWhoBuzzed) return; // Già qualcuno prenotato

    this.playerWhoBuzzed = playerName;

    // PAUSA il timer e il blur
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.blurInterval) {
      clearInterval(this.blurInterval);
    }

    // Notifica gli altri telefoni
    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });

    console.log(`[BUZZ] ${playerName} si è prenotato!`);
  }

  async ngOnInit() {
    try {
      const cats = await firstValueFrom(this.gameService.getCategories());
      const positioned = this.generateNonOverlappingPositions(cats);
      this.allCategories.set(positioned);

      const savedId = localStorage.getItem('activeGameId');
      if (savedId) {
        this.currentGameId.set(+savedId);
      }
    } catch (err) {
      console.error("Errore durante l'inizializzazione:", err);
    }
  }

  private generateNonOverlappingPositions(categories: any[]) {
    const positioned: any[] = [];
    const minDistance = 180;
    const maxAttempts = 100;

    categories.forEach((cat: any) => {
      let validPosition = false;
      let attempts = 0;
      let newPos = {top: 0, left: 0};

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
      });
    });

    return positioned;
  }

  async startNewRound() {
    if (this.isSpinning()) return;

    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCatIndex.set(null);
    this.playerWhoBuzzed = null;
    this.timer.set(30);
    this.isPaused.set(false);
    this.showResultPopup.set(false);

    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.blurInterval) clearInterval(this.blurInterval);

    if (!this.currentGameId()) {
      const newGame = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(newGame.id);
      localStorage.setItem('activeGameId', newGame.id.toString());
    }

    const types = ['IMAGE_BLUR'] as const;
    // const types = ['QUIZ', 'CHRONO', 'TRUE_FALSE', 'IMAGE_BLUR'] as const;
    const extractedType = types[Math.floor(Math.random() * types.length)];

    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 3000));
    this.showTypeReveal.set(null);

    this.isSpinning.set(true);

    try {
      let categoryName = "Celebrità e Personaggi Famosi";

      if (extractedType !== 'IMAGE_BLUR') {
        const categories = this.allCategories();
        const randomIndex = Math.floor(Math.random() * categories.length);
        categoryName = categories[randomIndex].name;
        this.selectedCatIndex.set(randomIndex);
      }

      const nextRound = await firstValueFrom(
        this.aiService.triggerNewAiRound(
          this.currentGameId()!,
          categoryName,
          extractedType,
          'medio'
        )
      );

      if (typeof nextRound.payload === 'string') {
        nextRound.payload = JSON.parse(nextRound.payload);
      }

      this.round.set(nextRound);

      if (extractedType !== 'IMAGE_BLUR') {
        await new Promise(r => setTimeout(r, 2000));
        this.phase.set('SELECTED');
        await new Promise(r => setTimeout(r, 2000));
      }

      this.phase.set('QUESTION');
      this.showQuestion.set(true);
      this.isSpinning.set(false);

      if (extractedType === 'IMAGE_BLUR') {
        this.startBlurEffect();
      }

      this.startTimer();

    } catch (err) {
      console.error('Errore nel nuovo round:', err);
      this.isSpinning.set(false);
      this.phase.set('IDLE');
    }
  }

  private startTimer() {
    this.ws.broadcastStatus(1, {
      action: 'START_VOTING',
      type: this.round()?.type
    });

    if (this.timerInterval) clearInterval(this.timerInterval);

    const isBlur = this.round()?.type === 'IMAGE_BLUR';
    this.timer.set(isBlur ? 30 : 10);

    this.timerInterval = setInterval(() => {
      if (this.isPaused() || this.playerWhoBuzzed) return;

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
    if (!currentRound) return;

    this.round.set({...currentRound, status: 'REVEAL'});
    this.currentBlur = 0;

    if (this.blurInterval) {
      clearInterval(this.blurInterval);
    }

    setTimeout(() => {
      this.ws.broadcastStatus(this.currentGameId()!, {action: 'ROUND_ENDED'});
    }, 5000);
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

  getYearDistance(guessedYear: number): number {
    const correct = this.round()?.payload.correctAnswer;
    if (!correct) return 0;
    return Math.abs(guessedYear - parseInt(correct));
  }

  startBlurEffect() {
    if (this.blurInterval) clearInterval(this.blurInterval);

    this.currentBlur = 40;
    this.blurInterval = setInterval(() => {
      if (this.currentBlur > 0 && !this.playerWhoBuzzed) {
        this.currentBlur -= (40 / 30); // 40px blur in 30 secondi
      } else if (this.currentBlur <= 0) {
        clearInterval(this.blurInterval);
      }
    }, 1000);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.playerWhoBuzzed) return;

    if (event.key === 'Enter' || event.key === 'ArrowUp') {
      this.confirmCorrect();
    } else if (event.key === 'Escape' || event.key === 'ArrowDown') {
      this.confirmWrong();
    }
  }

  confirmCorrect() {
    const winner = this.playerWhoBuzzed!;
    const points = 1000;

    // Mostra popup verde
    this.resultType.set('correct');
    this.resultPoints.set(points);
    this.resultPlayerName.set(winner);
    this.showResultPopup.set(true);

    // Rivela immagine
    this.currentBlur = 0;
    if (this.blurInterval) clearInterval(this.blurInterval);
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Notifica telefoni
    this.ws.broadcastStatus(1, {
      action: 'ROUND_ENDED',
      winner: winner,
      points: points
    });

    this.playerWhoBuzzed = null;

    // Chiudi popup dopo 5 secondi
    setTimeout(() => {
      this.showResultPopup.set(false);
    }, 5000);
  }

  confirmWrong() {
    const loser = this.playerWhoBuzzed!;
    const penalty = -500;

    // Mostra popup rosso
    this.resultType.set('wrong');
    this.resultPoints.set(penalty);
    this.resultPlayerName.set(loser);
    this.showResultPopup.set(true);

    // Notifica telefoni: sblocca gli altri
    this.ws.broadcastStatus(1, {
      action: 'RESUME_AFTER_ERROR',
      blockedPlayer: loser
    });

    this.playerWhoBuzzed = null;

    // Riprendi blur e timer
    if (this.round()?.type === 'IMAGE_BLUR') {
      this.startBlurEffect();

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.timer() > 0 && !this.playerWhoBuzzed) {
          this.timer.update(v => v - 1);
        } else if (this.timer() <= 0) {
          clearInterval(this.timerInterval);
          this.revealAnswer();
        }
      }, 1000);
    }

    // Chiudi popup dopo 3 secondi
    setTimeout(() => {
      this.showResultPopup.set(false);
    }, 3000);
  }

  openResetModal() {
    this.showResetModal.set(true);
  }

  confirmReset() {
    this.showResetModal.set(false);
    location.reload();
  }
}
