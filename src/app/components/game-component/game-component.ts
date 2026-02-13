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
import {RoundManagerService} from '../../services/round-manager.service';
import {LeaderboardService} from '../../services/leaderboard.service';
import {AudioService} from '../../services/audio.service';

import {ImageBlur} from './games/image-blur/image-blur';
import {Quiz} from './games/quiz/quiz';
import {WheelFortune} from './games/wheel-fortune/wheel-fortune';
import {TrueFalse} from './games/true-false/true-false';
import {Chrono} from './games/chrono/chrono';
import {Roulette} from './games/roulette/roulette';
import {Song} from './games/song/song';

import {environment} from '../../environment/environment';
import {GameModeType, IGameMode} from './interfaces/game-mode-type';
import {LeaderboardQuick} from '../leaderboard/leaderboard-quick-component/leaderboard-quick-component';
import {OneVsOne} from './games/one-vs-one/one-vs-one';
import {LeaderboardDetailed} from '../leaderboard/leaderboard-detailed-component/leaderboard-detailed-component';

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
    OneVsOne,
    LeaderboardQuick,
    LeaderboardDetailed
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

  // 🔥 NUOVI SERVICES
  public roundManager = inject(RoundManagerService);
  private leaderboardService = inject(LeaderboardService);
  public audioService = inject(AudioService);

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

  // 🔥 CLASSIFICHE
  showLeaderboardQuick = signal(false);
  showLeaderboardDetailed = signal(false);
  roundInfo = signal<string>('');

  currentGameId = signal<number | null>(null);

  // QR Code
  remoteUrl = `${environment.frontendUrl}/play`;
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`;

  @ViewChild('prestartTimer', {read: ElementRef, static: false}) prestartTimer?: ElementRef<HTMLElement>;

  private prestartAudio?: HTMLAudioElement;
  private audioAllowed = false;
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
    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }

    // 🔥 INFO ROUND
    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);
    console.log(`📊 Round Progress: ${progress.text} (${progress.percentage.toFixed(0)}%)`);

    // Precarica audio
    try {
      this.prestartAudio = new Audio('/sounds/prestart-beep.mp3');
      this.prestartAudio.preload = 'auto';
    } catch (e) {
      this.prestartAudio = undefined;
    }

    // Audio unlock
    const allowAudioOnce = () => {
      this.audioAllowed = true;
      window.removeEventListener('click', allowAudioOnce);
      window.removeEventListener('keydown', allowAudioOnce);
    };
    window.addEventListener('click', allowAudioOnce);
    window.addEventListener('keydown', allowAudioOnce);

    // WebSocket responses
    this.ws.responses$.subscribe(res => {
      const mode = this.currentMode();
      if (!mode) return;

      const isReading = (mode as any).getIsReading?.() ?? false;
      if (isReading) return;

      if (!mode.requiresBuzz) {
        mode.handleAnswer(res.playerName, res.answerIndex, res.responseTimeMs);
      } else if (res.answerIndex === -1) {
        mode.handleBuzz(res.playerName);
      }
    });

    // Pre-start countdown animation
    let lastPreStart = this.preStartCountdown();
    setInterval(() => {
      const cur = this.preStartCountdown();
      if (cur !== lastPreStart) {
        if (cur > 0 && cur <= 5) {
          try {
            const el = this.prestartTimer?.nativeElement;
            if (el) {
              el.classList.remove('bounce');
              void el.offsetWidth;
              el.classList.add('bounce');
            }
          } catch (err) {
          }

          if (this.audioAllowed && this.prestartAudio) {
            try {
              this.prestartAudio.currentTime = 0;
              const p = this.prestartAudio.play();
              if (p && typeof p.then === 'function') {
                p.catch(() => {
                });
              }
            } catch (e) {
            }
          }
        }
        lastPreStart = cur;
      }
    }, 120);

    // Admin controls
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      if (status.action === 'ADMIN_CONFIRM_CORRECT') {
        this.confirmCorrect();
      } else if (status.action === 'ADMIN_CONFIRM_WRONG') {
        this.confirmWrong();
      }
    });

    // Change detection for MUSIC
    this.displayDataInterval = setInterval(() => {
      const mode = this.currentMode();
      if (mode && mode.type === 'MUSIC') {
        this.cdr.detectChanges();
      }
    }, 100);

    // 🔥 AVVIA HEARTBEAT in IDLE
    this.audioService.startHeartbeat();
  }

  ngOnDestroy() {
    this.gameModeService.cleanup();
    if (this.displayDataInterval) {
      clearInterval(this.displayDataInterval);
    }
    // 🔥 FERMA TUTTI I SUONI
    this.audioService.stopAll();
  }

  async startNewRound() {
    if (this.isSpinning()) return;

    // 🔥 Controlla se il gioco è finito
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

    // 🔥 ESTRAI TIPO DAL ROUND MANAGER (non più random)
    const extractedType = this.roundManager.startNewRound();

    // 🔥 Aggiorna info round
    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);

    // 🔥 FERMA HEARTBEAT
    this.audioService.stopHeartbeat();

    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 3000));
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

      console.log('📦 Round ricevuto:', nextRound);

      let parsedPayload = nextRound.payload;
      if (typeof parsedPayload === 'string') {
        parsedPayload = JSON.parse(parsedPayload);
      }

      this.round.set(nextRound);

      const mode = this.gameModeService.createMode({
        type: parsedPayload.type || extractedType,
        payload: parsedPayload,
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

      if (mode.requiresBubbles) {
        const randomIndex = Math.floor(Math.random() * categories.length);
        this.animatedCategoryId.set(categories[randomIndex].id);

        this.phase.set('SPINNING');
        await new Promise(r => setTimeout(r, 5000));

        this.phase.set('SELECTED');
        this.animatedCategoryId.set(this.selectedCategoryId());
        await new Promise(r => setTimeout(r, 5000));
      }

      this.phase.set('QUESTION');
      this.showQuestion.set(true);
      this.timer.set(mode.timerDuration);

      const payloadString = typeof nextRound.payload === 'string'
        ? nextRound.payload
        : JSON.stringify(nextRound.payload);

      this.ws.broadcastStatus(1, {
        action: 'SHOW_QUESTION',
        type: parsedPayload.type || extractedType,
        payload: payloadString
      });

      // 🔥 AVVIA CLOCK
      this.audioService.startClock();

      await mode.start();

      this.ws.broadcastStatus(1, {
        action: 'START_VOTING',
        type: parsedPayload.type || extractedType,
        payload: payloadString
      });

      this.isSpinning.set(false);

    } catch (err) {
      console.error('❌ Errore nuovo round:', err);
      this.isSpinning.set(false);
      this.phase.set('IDLE');
      this.audioService.stopClock();
    }
  }

  private getCategoryForType(type: GameModeType): string {
    switch (type) {
      case 'IMAGE_BLUR':
        return 'CELEBRITÀ';
      case 'WHEEL_OF_FORTUNE':
        return 'PROVERBI E MODI DI DIRE';
      case 'ROULETTE':
        return 'FORTUNA';
      default:
        const categories = this.allCategories();
        const randomIndex = Math.floor(Math.random() * categories.length);
        return categories[randomIndex].name;
    }
  }

  /**
   * 🎮 Ottieni nome italiano del mode
   */
  getModeName(type: string): string {
    switch (type) {
      case 'QUIZ':
        return 'QUIZ';
      case 'TRUE_FALSE':
        return 'VERO O FALSO';
      case 'MUSIC':
        return 'INDOVINA LA CANZONE';
      case 'WHEEL_OF_FORTUNE':
        return 'RUOTA DELLA FORTUNA';
      case 'IMAGE_BLUR':
        return 'INDOVINA CHI';
      case 'CHRONO':
        return 'CHRONO';
      case 'ROULETTE':
        return 'ROULETTE';
      case '1VS1':
        return '1 CONTRO 1';
      default:
        return type;
    }
  }

  /**
   * ⏰ Timeout mode
   */
  private onModeTimeout() {
    const mode = this.currentMode();
    if (!mode) return;

    // 🔥 FERMA CLOCK
    this.audioService.stopClock();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
      this.showTimeoutPopup();
    }

    // 🔥 SUONO REVEAL
    this.audioService.playReveal();

    this.ws.broadcastStatus(1, {action: 'ROUND_ENDED'});

    this.isSpinning.set(false);

    // 🔥 COMPLETA ROUND
    this.roundManager.completeRound(mode.type);

    // 🔥 CONTROLLA CLASSIFICA
    setTimeout(() => {
      this.checkLeaderboardDisplay();
    }, 2000);
  }

  /**
   * 🎤 Buzz giocatore
   */
  private onPlayerBuzz(playerName: string) {
    console.log(`🎤 BUZZ: ${playerName}`);

    const mode = this.currentMode();
    if (!mode) return;

    // 🔥 SUONO CAMPANELLA
    this.audioService.playBell();

    mode.handleBuzz(playerName);

    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });
  }

  /**
   * ✅ Conferma corretto
   */
  confirmCorrect() {
    const mode = this.currentMode();
    if (!mode) return;

    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;

    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);
    const realPoints = (mode as any).calculatePoints(true, elapsedMs);

    // 🔥 AGGIUNGI PUNTI
    this.leaderboardService.addPoints(playerName, realPoints, true);

    mode.confirmCorrect(playerName);

    // 🔥 SUONO CORRETTO
    this.audioService.playCorrect();

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

    setTimeout(() => {
      this.showResultPopup.set(false);

      // 🔥 SUONO REVEAL
      this.audioService.playReveal();
    }, 3000);

    // 🔥 COMPLETA ROUND
    this.roundManager.completeRound(mode.type);

    // 🔥 CONTROLLA CLASSIFICA
    setTimeout(() => {
      this.checkLeaderboardDisplay();
    }, 5500);
  }

  /**
   * ❌ Conferma sbagliato
   */
  confirmWrong() {
    const mode = this.currentMode();
    if (!mode) return;

    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;

    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);
    const realPoints = (mode as any).calculatePoints(false, elapsedMs);

    // 🔥 SOTTRAI PUNTI
    this.leaderboardService.addPoints(playerName, realPoints, false);

    mode.confirmWrong(playerName);

    // 🔥 SUONO SBAGLIATO
    this.audioService.playWrong();

    this.resultType.set('wrong');
    this.resultPoints.set(realPoints);
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(1, {
      action: 'BLOCKED_ERROR',
      blockedPlayer: playerName,
      points: realPoints
    });

    setTimeout(() => this.showResultPopup.set(false), 3000);
  }

  private showTimeoutPopup() {
    this.resultType.set('correct');
    this.resultPoints.set(0);
    this.resultPlayerName.set('Tempo Scaduto!');
    this.showResultPopup.set(true);

    setTimeout(() => this.showResultPopup.set(false), 5000);
  }

  /**
   * 📊 Controlla e mostra classifica
   */
  private checkLeaderboardDisplay() {
    // 🔥 FERMA TUTTI I SUONI
    this.audioService.stopAll();

    const leaderboardType = this.roundManager.shouldShowLeaderboard();
    const round = this.roundManager.getCurrentRound();

    console.log(`📊 Round ${round}: Check classifica → ${leaderboardType}`);

    if (leaderboardType === 'QUICK') {
      console.log('📊 Mostra classifica RAPIDA');
      this.showLeaderboardQuick.set(true);
    } else if (leaderboardType === 'DETAILED') {
      console.log('📊 Mostra classifica DETTAGLIATA');
      this.showLeaderboardDetailed.set(true);
    }
  }

  /**
   * ✅ Classifica completata
   */
  onLeaderboardComplete() {
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);

    console.log('📊 Classifica chiusa');

    // 🔥 RIAVVIA HEARTBEAT se torniamo a IDLE
    if (this.phase() === 'IDLE') {
      this.audioService.startHeartbeat();
    }

    if (this.roundManager.isGameOver()) {
      alert('🏁 PARTITA COMPLETATA!');
    }
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

    // 🔥 RESET ROUND MANAGER
    this.roundManager.resetGame();

    // 🔥 RESET CLASSIFICA
    this.leaderboardService.reset();

    location.reload();
  }

  private generateNonOverlappingPositions(categories: any[]) {
    const placed: Array<{ top: number, left: number }> = [];
    const results = categories.map(cat => ({...cat}));

    const attemptsLimit = 300;
    const minDistance = 18;

    for (let i = 0; i < results.length; i++) {
      let attempts = 0;
      let top = 0;
      let left = 0;
      do {
        top = Math.random() * 70 + 10;
        left = Math.random() * 80 + 5;
        attempts++;
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

    safe.question = safe.question ?? '';
    safe.options = Array.isArray(safe.options) ? safe.options : [];
    return safe;
  }

  getPrestartPreview(): string {
    const mode = this.currentMode();
    if (!mode) return '';

    const seconds = this.preStartCountdown();
    const duration = (mode as any).timerDuration ?? 10;

    if (mode.type === 'QUIZ' || mode.type === 'TRUE_FALSE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score} / -${score}`;
    }

    if (mode.type === 'CHRONO' || mode.type === 'WHEEL_OF_FORTUNE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score}`;
    }

    return '';
  }

  private computePreviewScore(secondsFromNow: number, duration: number): number {
    const t = Math.max(0, Math.min(duration, secondsFromNow));
    const fraction = 1 - (t / Math.max(1, duration));
    return Math.round(fraction * 1000);
  }

  getRecentResponses(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];
    return all.slice(-6).reverse();
  }
}
