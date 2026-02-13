// src/app/components/game/game.component.ts

import {
  Component,
  signal,
  inject,
  OnInit,
  HostListener,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';
import {firstValueFrom} from 'rxjs';

import {GameRound, GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/web-socket.service';
import {AiGeneratorService} from '../../services/ai-generator-service';
import {GameModeService} from '../../services/game-mode-factory.service';
import {ImageBlur} from './games/image-blur/image-blur';
import {Quiz} from './games/quiz/quiz';
import {WheelFortune} from './games/wheel-fortune/wheel-fortune';
import {TrueFalse} from './games/true-false/true-false';
import {Chrono} from './games/chrono/chrono';
import {environment} from '../../environment/environment';
import {GameModeType, IGameMode} from './interfaces/game-mode-type';
import {Roulette} from './games/roulette/roulette';
import {Song} from './games/song/song';
import {LeaderboardDetailed} from '../leaderboard/leaderboard-detailed-component/leaderboard-detailed-component';
import {LeaderboardQuick} from '../leaderboard/leaderboard-quick-component/leaderboard-quick-component';
import {OneVsOne} from './games/one-vs-one/one-vs-one';
import {LeaderboardService} from '../../services/leaderboard.service';
import {RoundManagerService} from '../../services/round-manager.service';

@Component({
  selector: 'app-game-component',
  standalone: true,
  imports: [
    CommonModule,
    WheelFortune,
    Chrono,
    TrueFalse,
    Quiz,
    ImageBlur,
    Roulette,
    Song,
    LeaderboardQuick,
    OneVsOne,
    LeaderboardDetailed,
  ],
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
export class GameComponent implements OnInit, OnDestroy {
  public ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private aiService = inject(AiGeneratorService);
  private gameModeService = inject(GameModeService);
  private cdr = inject(ChangeDetectorRef);
  roundManager = inject(RoundManagerService);
  private leaderboardService = inject(LeaderboardService);

  // State
  allCategories = signal<any[]>([]);
  round = signal<GameRound | null>(null);
  currentMode = signal<IGameMode | null>(null);

  // UI State
  phase = signal<'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION'>('IDLE');
  isSpinning = signal(false);
  selectedCategoryId = signal<number | null>(null);
  showQuestion = signal(false);
  showTypeReveal = signal<string | null>(null);
  timer = signal(0);
  preStartCountdown = signal<number>(0);
  isPaused = signal(false);
  animatedCategoryId = signal<number | null>(null);

  // Modals
  showResetModal = signal(false);
  showResultPopup = signal(false);
  resultType = signal<'correct' | 'wrong'>('correct');
  resultPoints = signal(0);
  resultPlayerName = signal('');
  showLeaderboardQuick = signal(false);
  showLeaderboardDetailed = signal(false);
  roundInfo = signal<string>('');

  currentGameId = signal<number | null>(null);

  // QR Code
  remoteUrl = `${environment.frontendUrl}/play`;
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`;

  @ViewChild('prestartTimer', {read: ElementRef, static: false}) prestartTimer?: ElementRef<HTMLElement>;

  // Audio per pre-start (opzionale)
  private prestartAudio?: HTMLAudioElement;
  private audioAllowed = false; // diventa true dopo la prima interazione
  private displayDataInterval?: any;

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.phase() !== 'IDLE') {
      $event.returnValue = "Hai una partita in corso!";
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    const mode = this.currentMode();
    if (!mode || !mode.requiresBuzz) return;

    if (event.key === 'Enter' || event.key === 'ArrowUp') {
      this.confirmCorrect();
    } else if (event.key === 'Escape' || event.key === 'ArrowDown') {
      this.confirmWrong();
    }
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
      const progress = this.roundManager.getProgress();
      this.roundInfo.set(progress.text);
      console.log(`📊 Round Progress: ${progress.text} (${progress.percentage.toFixed(0)}%)`);
    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }

    // Precarica audio se presente
    try {
      this.prestartAudio = new Audio('/sounds/prestart-beep.mp3');
      this.prestartAudio.preload = 'auto';
    } catch (e) {
      this.prestartAudio = undefined;
    }

    // Intercettiamo la prima interazione dell'utente per abilitare l'audio (policy autoplay)
    const allowAudioOnce = () => {
      this.audioAllowed = true;
      window.removeEventListener('click', allowAudioOnce);
      window.removeEventListener('keydown', allowAudioOnce);
    };
    window.addEventListener('click', allowAudioOnce);
    window.addEventListener('keydown', allowAudioOnce);

    // WebSocket responses: ignoriamo le risposte mentre la mode è in fase di lettura
    this.ws.responses$.subscribe(res => {
      const mode = this.currentMode();
      if (!mode) return;

      // Se la modalità espone getIsReading e la fase di lettura è attiva, ignoriamo le risposte
      const isReading = (mode as any).getIsReading?.() ?? false;
      if (isReading) return;
      console.log(res)
      if (!mode.requiresBuzz) {
        mode.handleAnswer(res.playerName, res.answerIndex, res.responseTimeMs);
      } else if (res.answerIndex === -1) {
        mode.handleBuzz(res.playerName);
      }
    });

    // Effetto: osserva i cambi al preStartCountdown e riavvia l'animazione + suono
    // Poiché usiamo segnali, usiamo un piccolo polling via setInterval per reattare ai cambi
    let lastPreStart = this.preStartCountdown();
    setInterval(() => {
      const cur = this.preStartCountdown();
      if (cur !== lastPreStart) {
        // cambia valore
        // se siamo nella finestra 1..5, proviamo a riprodurre l'audio e riavviare l'animazione
        if (cur > 0 && cur <= 5) {
          // Riavvia effetto bounce (rimuovi e riaggiungi classe) per forzare replay animation
          try {
            const el = this.prestartTimer?.nativeElement;
            if (el) {
              el.classList.remove('bounce');
              // trigger reflow
              void el.offsetWidth;
              el.classList.add('bounce');
            }
          } catch (err) {
            // ignore
          }

          if (this.audioAllowed && this.prestartAudio) {
            try {
              // play non in modo await per non bloccare
              this.prestartAudio.currentTime = 0;
              const p = this.prestartAudio.play();
              if (p && typeof p.then === 'function') {
                p.catch(() => {/* autoplay bloccato */
                });
              }
            } catch (e) {
              // ignore
            }
          }
        }
        lastPreStart = cur;
      }
    }, 120); // polling leggero: 8 volte al secondo
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      if (status.action === 'ADMIN_CONFIRM_CORRECT') {
        this.confirmCorrect();
      } else if (status.action === 'ADMIN_CONFIRM_WRONG') {
        this.confirmWrong();
      }
    });
    this.ws.responses$.subscribe(res => {
      const mode = this.currentMode();
      if (!mode) return;

      // 🔥 BUZZ = answerIndex === -1
      if (res.answerIndex === -1) {
        mode.handleBuzz(res.playerName);
      }
    });
    this.displayDataInterval = setInterval(() => {
      const mode = this.currentMode();
      if (mode && mode.type === 'MUSIC') {
        // Force change detection
        this.cdr.detectChanges();
      }
    }, 100);
  }

  ngOnDestroy() {
    this.gameModeService.cleanup();
    if (this.displayDataInterval) {
      clearInterval(this.displayDataInterval);
    }
  }

  async startNewRound() {
    if (this.isSpinning()) return;
    if (this.roundManager.isGameOver()) {
      alert('🏁 Partita completata! Resetta per ricominciare.');
      return;
    }
    this.reset();

    if (!this.currentGameId()) {
      const newGame = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(newGame.id);
      localStorage.setItem('activeGameId', newGame.id.toString());
    }

    const extractedType = this.roundManager.startNewRound();
    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);
    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 5000));
    this.showTypeReveal.set(null);
    this.isSpinning.set(true);
    try {
      const categoryName = this.getCategoryForType(extractedType);
      const categories = this.allCategories();
      const selectedCategory = categories.find(c => c.name === categoryName);
      if (selectedCategory) this.selectedCategoryId.set(selectedCategory.id);
      const nextRound = await firstValueFrom(
        this.aiService.triggerNewAiRound(
          this.currentGameId()!,
          categoryName,
          extractedType,
          'medio'
        )
      );

      console.log('📦 Round ricevuto dal BE:', nextRound);
      console.log('📦 Payload RAW:', nextRound.payload);
      let parsedPayload = nextRound.payload;
      if (typeof parsedPayload === 'string') {
        parsedPayload = JSON.parse(parsedPayload);
      }
      this.round.set(nextRound);
      const mode = this.gameModeService.createMode({
        type: parsedPayload.type || extractedType,
        payload: parsedPayload,  // 🔥 Passa tutto il payload direttamente
        gameId: this.currentGameId()!,
        onTimerTick: (seconds) => this.timer.set(seconds),
        onTimerEnd: () => this.onModeTimeout(),
        onBuzz: (playerName) => this.onPlayerBuzz(playerName)
      });
      (mode as any).setConfig?.({
        ...((mode as any).config ?? {}),
        onPreGameTick: (sec: number) => this.preStartCountdown.set(sec)
      });

      this.currentMode.set(mode);
      this.phase.set('QUESTION');
      this.showQuestion.set(true);
      this.timer.set(mode.timerDuration);

      // 🔥 SHOW_QUESTION
      this.ws.broadcastStatus(1, {
        action: 'SHOW_QUESTION',
        type: parsedPayload.type || extractedType,
        payload: JSON.stringify(parsedPayload)
      });

      // 🔥 AWAIT mode.start() (aspetta countdown)
      await mode.start();

      // 🔥 START_VOTING dopo countdown
      this.ws.broadcastStatus(1, {
        action: 'START_VOTING',
        type: parsedPayload.type || extractedType,
        payload: JSON.stringify(parsedPayload)
      });
      this.roundManager.completeRound(extractedType);
      this.isSpinning.set(false);
    } catch (err) {
      console.error('❌ Errore nuovo round:', err);
      this.isSpinning.set(false);
      this.phase.set('IDLE');
    }
  }

  private getCategoryForType(type: GameModeType): string {
    switch (type) {
      case 'IMAGE_BLUR':
        return 'CELEBRITÀ';
      case 'WHEEL_OF_FORTUNE':
        return 'PROVERBI E MODI DI DIRE';
      case 'ROULETTE':
        return 'FORTUNA'; // <-- AGGIUNGI QUESTO
      default:
        const categories = this.allCategories();
        const randomIndex = Math.floor(Math.random() * categories.length);
        return categories[randomIndex].name;
    }
  }


  private onModeTimeout() {
    const mode = this.currentMode();
    if (!mode) return;

    // Imposta round come REVEAL
    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
      this.showTimeoutPopup();
    }

    // Notifica telefoni
    this.ws.broadcastStatus(1, {action: 'ROUND_ENDED'});
    this.isSpinning.set(false);
    this.roundManager.completeRound(mode.type);

    // 🔥 CONTROLLA CLASSIFICA
    setTimeout(() => {
      this.checkLeaderboardDisplay();
    }, 2000);
  }

  private onPlayerBuzz(playerName: string) {
    console.log(`🎤 BUZZ ricevuto nel GameComponent: ${playerName}`);

    const mode = this.currentMode();
    if (!mode) {
      console.warn('⚠️ Nessun mode attivo');
      return;
    }

    mode.handleBuzz(playerName);

    // 🔥 Broadcast a tutti
    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });

    console.log(`✅ Broadcast PLAYER_PRENOTATO: ${playerName}`);
  }

  confirmCorrect() {
    const mode = this.currentMode();
    if (!mode) return;
    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;
    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);
    const realPoints = (mode as any).calculatePoints(true, elapsedMs);

    this.leaderboardService.addPoints(playerName, realPoints, true);

    mode.confirmCorrect(playerName);
    const currentRound = this.round();

    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    this.isSpinning.set(false);

    this.resultType.set('correct');
    this.resultPoints.set(realPoints);
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(1, {
      action: 'ROUND_ENDED',
      winner: playerName,
      points: realPoints
    });

    setTimeout(() => this.showResultPopup.set(false), 5000);
    this.roundManager.completeRound(mode.type);
    setTimeout(() => {
      this.checkLeaderboardDisplay();
    }, 5500);
  }

  confirmWrong() {
    const mode = this.currentMode();
    if (!mode) return;
    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;
    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);
    const realPoints = (mode as any).calculatePoints(false, elapsedMs);

    this.leaderboardService.addPoints(playerName, realPoints, false);
    mode.confirmWrong(playerName);

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    this.isSpinning.set(false);

    this.resultType.set('wrong');
    this.resultPoints.set(realPoints); // <--- DINAMICO (-1000 a scalare)
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(1, {
      action: 'BLOCKED_ERROR',
      blockedPlayer: playerName,
      points: realPoints // Passiamo i punti anche qui se serve al database/classifica
    });
    setTimeout(() => this.showResultPopup.set(false), 3000);
  }

  private checkLeaderboardDisplay() {
    const round = this.roundManager.getCurrentRound();
    const type = this.roundManager.shouldShowLeaderboard();
    console.log(`📊 Round ${round}: Check → ${type}`);
    if (type === 'QUICK') {
      this.showLeaderboardQuick.set(true);
    } else if (type === 'DETAILED') {
      this.showLeaderboardDetailed.set(true);
    }
  }

  onLeaderboardComplete() {
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    console.log('📊 Classifica chiusa, prossimo round');
    if (this.roundManager.isGameOver()) {
      alert('🏁 PARTITA COMPLETATA!');
      // TODO: Mostra classifica finale elaborata
    }
  }

  private showTimeoutPopup() {
    const mode = this.currentMode();
    if (!mode) return;

    this.resultType.set('correct');
    this.resultPoints.set(0);
    this.resultPlayerName.set('Tempo Scaduto!');
    this.showResultPopup.set(true);

    setTimeout(() => this.showResultPopup.set(false), 5000);
  }

  togglePause() {
    const mode = this.currentMode();
    if (!mode) return;

    if (this.isPaused()) {
      mode.resume();
      this.isPaused.set(false);
    } else {
      mode.pause();
      this.isPaused.set(true);
    }
  }

  private reset() {
    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCategoryId.set(null);
    this.timer.set(0);
    this.isPaused.set(false);
    this.showResultPopup.set(false);
    this.currentMode.set(null);
  }

  openResetModal() {
    this.showResetModal.set(true);
  }

  confirmReset() {
    this.showResetModal.set(false);
    this.roundManager.resetGame();
    this.leaderboardService.reset();

    location.reload();
  }

  private generateNonOverlappingPositions(categories: any[]) {
    // Genera posizioni con semplice avoidance: tenta posizionare ogni bubble lontano dalle altre
    const placed: Array<{ top: number, left: number }> = [];
    const results = categories.map(cat => ({...cat}));

    const attemptsLimit = 300;
    const minDistance = 18; // percentuale minima tra centri (più distanza per bolle più sparse)

    for (let i = 0; i < results.length; i++) {
      let attempts = 0;
      let top = 0;
      let left = 0;
      do {
        top = Math.random() * 70 + 10; // 10%..80%
        left = Math.random() * 80 + 5; // 5%..85%
        attempts++;
        // verifica distanza da tutte quelle già piazzate
        let ok = true;
        for (const p of placed) {
          const dy = Math.abs(p.top - top);
          const dx = Math.abs(p.left - left);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            ok = false;
            break;
          }
        }
        if (ok) break;
      } while (attempts < attemptsLimit);

      // registra
      placed.push({top, left});
      results[i].top = top + '%';
      results[i].left = left + '%';
    }

    return results;
  }

  getSafeDisplayData(): any {
    const mode = this.currentMode();
    const data = mode ? (mode.getDisplayData() || {}) : {};
    const isReading = mode ? ((mode as any).getIsReading?.() ?? false) : false;
    const safe = {...data, isReading} as any;

    if (mode?.type !== 'ROULETTE') {
      if (!mode || !mode.isRevealed()) {
        safe.correctAnswer = null;
      }
    }
    // defaults
    safe.question = safe.question ?? '';
    safe.options = Array.isArray(safe.options) ? safe.options : [];
    return safe;
  }

  // Preview del punteggio per mostrare accanto al countdown pre-start
  getPrestartPreview(): string {
    const mode = this.currentMode();
    if (!mode) return '';
    // user may want to see potential positive/negative score based on speed
    const seconds = this.preStartCountdown();
    const duration = (mode as any).timerDuration ?? 10;

    // Per quiz/true_false -> mostra +X / -X (velocità-based)
    if (mode.type === 'QUIZ' || mode.type === 'TRUE_FALSE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score} / -${score}`;
    }

    // Per chrono/wheel -> vittoria singola: mostra +X
    if (mode.type === 'CHRONO' || mode.type === 'WHEEL_OF_FORTUNE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score}`;
    }

    return '';
  }

  // Calcola il punteggio di preview basato sul tempo relativo (0..duration) -> 0..1000
  private computePreviewScore(secondsFromNow: number, duration: number): number {
    // Interpretazione: più veloce = valore più alto; normalizziamo usando (1 - t/d)
    const t = Math.max(0, Math.min(duration, secondsFromNow));
    const fraction = 1 - (t / Math.max(1, duration));
    return Math.round(fraction * 1000);
  }

  // Ritorna le ultime risposte ricevute (max 6) per il box risposte
  getRecentResponses(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];
    return all.slice(-6).reverse();
  }

}
