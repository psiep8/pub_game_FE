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

    // Reset stati iniziali
    this.ws.clearResponses();
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCatIndex.set(null);
    this.playerWhoBuzzed = null;
    this.timer.set(15); // Più tempo per il blur
    this.isPaused.set(false);

    // Determiniamo il tipo
    // const types = ['IMAGE_BLUR'] as const; // Per ora forzato come volevi
    const types = ['QUIZ', 'CHRONO', 'TRUE_FALSE','IMAGE_BLUR'] as const;
    const extractedType = types[Math.floor(Math.random() * types.length)];
    if (extractedType === 'IMAGE_BLUR') {
      this.selectedCatIndex.set(null); // Nessuna bolla selezionata
    }
    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 3000));
    this.showTypeReveal.set(null);

    this.isSpinning.set(true);

    try {
      // SE È IMAGE_BLUR, NON SCEGLIAMO UNA BOLLA, MA USIAMO "Celebrità"
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

      // Se non è blur, mostriamo la bolla selezionata, altrimenti saltiamo
      if (extractedType !== 'IMAGE_BLUR') {
        await new Promise(r => setTimeout(r, 2000));
        this.phase.set('SELECTED');
        await new Promise(r => setTimeout(r, 2000));
      }

      this.phase.set('QUESTION');
      this.showQuestion.set(true);
      this.isSpinning.set(false);

      // LOGICA SPECIFICA BLUR
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
    if (!currentRound) return;

    this.round.set({...currentRound, status: 'REVEAL'});
    this.currentBlur = 0; // Rivela l'immagine completamente

    if (currentRound.type === 'IMAGE_BLUR' && !this.playerWhoBuzzed) {
      console.log("[ABSTAINED] Tempo scaduto, nessuno ha indovinato l'immagine.");
    }

    // Notifica i telefoni di tornare in attesa
    setTimeout(() => {
      this.ws.broadcastStatus(this.currentGameId()!, { action: 'ROUND_ENDED' });
      this.phase.set('IDLE');
    }, 5000);
  }

  processNormalAnswer(res: any) {
    const currentRound = this.round();
    if (!currentRound) return;

    let isCorrect = false;
    let score = 0;
    let detailMsg = '';

    if (currentRound.type === 'CHRONO') {
      const realYear = parseInt(currentRound.payload.correctAnswer);
      const guessedYear = res.answerIndex;
      const distance = Math.abs(guessedYear - realYear);

      isCorrect = distance <= 2;
      score = this.calculateChronoScore(guessedYear, realYear, res.responseTimeMs);
      detailMsg = `Scelta: ${guessedYear} (Distanza: ${distance} anni)`;
    } else {
      const playerChoiceText = currentRound.payload.options[res.answerIndex];
      isCorrect = playerChoiceText === currentRound.payload.correctAnswer;
      score = this.calculateScore(isCorrect, res.responseTimeMs);
      detailMsg = `Scelta: ${playerChoiceText}`;
    }

    // Se per qualche motivo il tempo è scaduto o l'indice è nullo (caso ipotetico)
    if (res.answerIndex === null || res.answerIndex === undefined) {
      score = 0;
      console.log(`[ABSTAINED] ${res.playerName}: 0 punti.`);
    } else {
      console.log(`[RICEVUTO] ${res.playerName}: ${isCorrect ? '✅' : '❌'} | ${detailMsg} | Punti: ${score}`);
    }
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

    if (event.key === 'Enter' || event.key === 'ArrowUp') {
      this.confirmCorrect(); // Forza il reveal e assegna punti
    } else if (event.key === 'Escape' || event.key === 'ArrowDown') {
      this.confirmWrong(); // Toglie il blocco e fa ripartire il blur
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
