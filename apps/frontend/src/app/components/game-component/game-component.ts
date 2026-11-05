

import {
  Component,
  signal,
  inject,
  OnInit,
  HostListener,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  DestroyRef,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameRound, GameService } from '../../services/game.service';
import { WebSocketService } from '../../services/web-socket.service';
import { AiGeneratorService } from '../../services/ai-generator-service';
import { GameModeService } from '../../services/game-mode-factory.service';
import { RoundManagerService } from '../../services/round-manager.service';
import { LeaderboardService } from '../../services/leaderboard.service';
import { AudioService } from '../../services/audio.service';
import { ThemeService } from '../../services/theme.service';

import { ImageBlur } from './games/image-blur/image-blur';
import { Quiz } from './games/quiz/quiz';
import { WheelFortune } from './games/wheel-fortune/wheel-fortune';
import { Roulette } from './games/roulette/roulette';
import { Song } from './games/song/song';
import { environment } from '../../environment/environment';
import { GameModeType, IGameMode } from './interfaces/game-mode-type';
import { LeaderboardQuick } from '../leaderboard/leaderboard-quick-component/leaderboard-quick-component';
import { LeaderboardDetailed } from '../leaderboard/leaderboard-detailed-component/leaderboard-detailed-component';
import { ArenaComponent } from './games/arena/arena.component';
import { Timeline } from './games/timeline/timeline';
import { TimeBuzzer } from './games/time-buzzer/time-buzzer';
import { SpeedRush } from './games/speed-rush/speed-rush';
import { AirHockeyBattle } from './games/ping-pong/ping-pong';

@Component({
  selector: 'app-game-component',
  standalone: true,
  imports: [
    CommonModule,
    WheelFortune,
    Quiz,
    ImageBlur,
    Roulette,
    Song,
    LeaderboardQuick,
    LeaderboardDetailed,
    ArenaComponent,
    Timeline,
    TimeBuzzer,
    SpeedRush,
    AirHockeyBattle
  ],
  templateUrl: './game-component.html',
  styleUrls: ['./game-component.css', './restyle.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
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


  public roundManager = inject(RoundManagerService);
  private leaderboardService = inject(LeaderboardService);
  public audioService = inject(AudioService);
  public theme = inject(ThemeService);


  allCategories = signal<any[]>([]);
  round = signal<GameRound | null>(null);
  currentMode = signal<IGameMode | null>(null);


  phase = signal<'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION'>('IDLE');
  isSpinning = signal(false);
  selectedCategoryId = signal<number | null>(null);
  showQuestion = signal(false);
  showTypeReveal = signal<string | null>(null);
  timer = signal(0);
  preStartCountdown = signal<number>(0);
  isPaused = signal(false);
  demoType = signal<string | null>(null);
  animatedCategoryId = signal<number | null>(null);


  showResetModal = signal(false);
  showResultPopup = signal(false);
  resultType = signal<'correct' | 'wrong'>('correct');
  resultPoints = signal(0);
  resultPlayerName = signal('');


  showLeaderboardQuick = signal(false);
  showLeaderboardDetailed = signal(false);
  roundInfo = signal<string>('');
  isShowingLeaderboard = signal(false);
  pendingLeaderboardType = signal<'QUICK' | 'DETAILED' | null>(null);

  currentGameId = signal<number>(1);

  categoryName = computed(() => {
    const id = this.selectedCategoryId();
    return this.allCategories().find((cat) => cat.id === id)?.name ?? '';
  });

  private arenaFinished = false;

  remoteUrl = `${environment.frontendUrl}/play`;

  // 🔥 [ROLLBACK] QR Code statico che punta a /play senza parametri
  qrCodeUrl = signal(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`);

  @ViewChild('prestartTimer', { read: ElementRef, static: false }) prestartTimer?: ElementRef<HTMLElement>;

  private prestartAudio?: HTMLAudioElement;
  private audioAllowed = false;
  private displayDataInterval?: ReturnType<typeof setInterval>;
  private prestartMonitorInterval?: ReturnType<typeof setInterval>;
  private destroyRef = inject(DestroyRef);

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


    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }


    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);



    try {
      this.prestartAudio = new Audio('assets/audio/prestart-beep.mp3');
      this.prestartAudio.preload = 'auto';
    } catch (e) {
      this.prestartAudio = undefined;
    }


    const allowAudioOnce = () => {
      this.audioAllowed = true;
      this.audioService.startAmbient();
      window.removeEventListener('click', allowAudioOnce);
      window.removeEventListener('keydown', allowAudioOnce);
    };
    window.addEventListener('click', allowAudioOnce);
    window.addEventListener('keydown', allowAudioOnce);


    // 📨 SOTTOSCRIZIONE RESPONSES (Per azioni veloci come urla)
    this.ws.responses$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resp: any) => {
      console.log('%c 📥 GameComponent: Messaggio fast-track ricevuto: ', 'background: #333; color: #fff', resp);
      if (!resp) return;

      const mode = this.currentMode();
      // Voti e prenotazioni dei telefoni: prima finivano solo nel log, quindi
      // Quiz non assegnava punti e i giochi a prenotazione non si chiudevano.
      const playerName = String(resp.playerName || resp.name || '').trim();
      if (!mode || !playerName) return;

      if (resp.answerIndex === -1) {
        this.onPlayerBuzz(playerName);
        return;
      }

      if (typeof resp.answerIndex === 'number') {
        mode.handleAnswer(playerName, resp.answerIndex, Number(resp.responseTimeMs) || 0);
        this.cdr.detectChanges();
      }
    });

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      if (!status) return;

      const mode = this.currentMode();

      // 🎤 Debug Log per Urla su Status
      if ((status.action === 'SCREAM_UPDATE' || status.action === 'SCREAM')) {
        console.log('🎤 Urlo ricevuto su STATUS:', status);
      }

      // 🤝 Nuovo giocatore si è unito
      if (status.action === 'JOIN_GAME' && status.playerName) {
        const normalizedName = status.playerName.trim();
        console.log(`🤝 Nuovo giocatore unito: ${normalizedName}`);
        this.audioService.playJoin();
        this.leaderboardService.addPoints(normalizedName, 0, false);

      }

      // 🏟️ ARENA ANSWER dal Remote (inviato via broadcastStatus)
      if (mode?.type === 'ARENA' && status.action === 'ARENA_ANSWER') {
        const playerName = (status.playerName || status.name || 'Sconosciuto').trim();
        const isCorrect = !!status.isCorrect;
        // Il server ora assegna +10/-10: usiamo i suoi punti se presenti.
        const points = typeof status.points === 'number' ? status.points : (isCorrect ? 10 : -10);
        console.log(`%c 🏟️ Arena TV -> Risposta rapida: ${playerName} (corretta: ${isCorrect}) `, 'background: #3f51b5; color: #fff;');

        // Add points to leaderboard immediately
        this.leaderboardService.addPoints(playerName, points, isCorrect);

        // Update mode logic (dot movement)
        mode.applyArenaAnswer?.(playerName, isCorrect, points);
        this.cdr.detectChanges();
      }

      // 🆕 Giochi simultanei: risultati dal server e progressi dai telefoni.
      if (mode && ['TIMELINE_RESULT', 'TIME_BUZZER_ANSWER', 'SPEED_RUSH_PROGRESS', 'AIR_HOCKEY_BATTLE_ANSWER'].includes(status.action)) {
        mode.handlePartyEvent?.(status);
        this.cdr.detectChanges();
      }

    });
    let lastPreStart = this.preStartCountdown();
    this.prestartMonitorInterval = setInterval(() => {
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


    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      if (!status) return;

      if (status.action === 'ADMIN_CONFIRM_CORRECT') {
        this.confirmCorrect();
      } else if (status.action === 'ADMIN_CONFIRM_WRONG') {
        this.confirmWrong();
      } else if (status.action === 'ADMIN_NEXT_ROUND') {
        this.adminNextRound();
      } else if (status.action === 'ADMIN_SHOW_LEADERBOARD') {
        this.adminShowLeaderboard();
      } else if (status.action === 'ADMIN_TOGGLE_PAUSE') {
        this.togglePause();
      } else if (status.action === 'ADMIN_SHOW_DEMO') {
        this.demoType.set(status.type || this.currentMode()?.type || 'QUIZ');
      } else if (status.action === 'ADMIN_HIDE_DEMO') {
        this.demoType.set(null);
      }
    });


    this.displayDataInterval = setInterval(() => {
      const mode = this.currentMode();
      if (mode && mode.type === 'MUSIC') {
        this.cdr.detectChanges();
      }
    }, 100);


    this.audioService.startHeartbeat();
  }

  ngOnDestroy() {
    this.gameModeService.cleanup();
    if (this.displayDataInterval) {
      clearInterval(this.displayDataInterval);
    }
    if (this.prestartMonitorInterval) {
      clearInterval(this.prestartMonitorInterval);
    }

    this.audioService.stopAll();
  }

  async openLobby(): Promise<void> {
    if (this.currentGameId()) return;

    const newGame = await firstValueFrom(this.gameService.createGame());
    this.currentGameId.set(newGame.id);
    localStorage.setItem('activeGameId', newGame.id.toString());
    this.ws.subscribeToGame(newGame.id);
  }

  async startNewRound() {
    if (this.isShowingLeaderboard()) {
      console.warn('⚠️ Classifica in corso, attendi...');
      return;
    }

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

      // Sottoscrivi ai topic del nuovo gioco
      this.ws.subscribeToGame(newGame.id);
    }


    const extractedType = this.roundManager.startNewRound();


    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);


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



      let parsedPayload = nextRound.payload;
      if (typeof parsedPayload === 'string') {
        parsedPayload = JSON.parse(parsedPayload);
      }

      this.round.set(nextRound);
      const activePlayers = this.leaderboardService.getLeaderboard().map(p => p.playerName);

      const mode = this.gameModeService.createMode({
        type: parsedPayload.type || extractedType,
        payload: parsedPayload,
        gameId: this.currentGameId()!,
        onTimerTick: (seconds) => this.timer.set(seconds),
        onTimerEnd: () => this.onModeTimeout(),
        onBuzz: (playerName) => this.onPlayerBuzz(playerName),
        activePlayers: activePlayers,
        onPreGameTick: (seconds) => this.preStartCountdown.set(seconds),
        onPlayerEliminated: (playerName) => this.onArenaEliminated(playerName),
        onRoundEnded: () => this.onArenaEnded(),
        onBroadcast: (event: any) => this.ws.broadcastStatus(this.currentGameId()!, event),
        onAnswerReceived: (result: any) => {

          if (result && result.playerName) {


            const points = result.points || 0;
            const isCorrect = !!result.isCorrect;


            this.leaderboardService.addPoints(result.playerName, points, isCorrect);


            this.ws.responses.update(list => {
              return list.map(r => {
                if (r.playerName === result.playerName) {
                  return { ...r, points: points };
                }
                return r;
              });
            });
          }
        }
      });

      this.currentMode.set(mode);

      if (mode.requiresBubbles && categories.length > 0) {
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

      const safeData = this.getSafeDisplayData();
      const payloadString = JSON.stringify(safeData);

      const rawPayloadString = typeof nextRound.payload === 'string'
        ? nextRound.payload
        : JSON.stringify(nextRound.payload);

      this.ws.broadcastStatus(this.currentGameId()!, {
        action: 'SHOW_QUESTION',
        type: parsedPayload.type || extractedType,
        payload: payloadString,
        rawPayload: rawPayloadString
      });


      this.audioService.startClock();

      await mode.start();

      this.ws.broadcastStatus(this.currentGameId()!, {
        action: 'START_VOTING',
        type: parsedPayload.type || extractedType,
        payload: payloadString,
        rawPayload: rawPayloadString
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
      case 'QUIZ':
      // case 'ONE_VS_ONE':
        return 'CULTURA GENERALE';
      case 'MUSIC':
        return 'MUSICA';
      case 'IMAGE_BLUR':
        return 'CELEBRITÀ';
      case 'WHEEL_OF_FORTUNE':
        return 'PROVERBI E MODI DI DIRE';
      case 'ROULETTE':
        return 'FORTUNA';
      case 'ARENA':
        return 'ARENA';
      case 'TIMELINE':
      case 'TIME_BUZZER':
      case 'SPEED_RUSH':
      case 'AIR_HOCKEY_BATTLE':
        return 'CULTURA GENERALE';
      default:
        const categories = this.allCategories();
        if (categories.length === 0) return 'CULTURA GENERALE';
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
      case 'MUSIC':
        return 'INDOVINA LA CANZONE';
      case 'WHEEL_OF_FORTUNE':
        return 'RUOTA DELLA FORTUNA';
      case 'IMAGE_BLUR':
        return 'INDOVINA CHI';
      case 'ROULETTE':
        return 'ROULETTE';
      // case '1VS1':
      //   return '1 CONTRO 1';
      case 'ARENA':
        return 'ARENA BATTLE ROYALE';
      case 'TIMELINE':
        return 'TIMELINE';
      case 'TIME_BUZZER':
        return 'TIME BUZZER';
      case 'SPEED_RUSH':
        return 'SPEED RUSH';
      case 'AIR_HOCKEY_BATTLE':
        return 'AIR HOCKEY';
      default:
        return type;
    }
  }

  /**
   * ⏰ Timeout mode
   */
  /** Una squadra è uscita dal cerchio: la TV avvisa il telefono interessato. */
  private onArenaEliminated(playerName: string): void {
    this.audioService.playElimination();
    this.ws.broadcastStatus(this.currentGameId(), {
      action: 'ARENA_ELIMINATED',
      playerName,
    });
  }

  /**
   * Arena finita: niente pulsante nascosto, il round si chiude da solo e la
   * classifica (se prevista) parte in automatico dopo qualche secondo.
   */
  private onArenaEnded(): void {
    if (this.arenaFinished) return;
    this.arenaFinished = true;

    const winners = this.currentMode()?.getDisplayData?.()?.winners ?? [];
    this.ws.broadcastStatus(this.currentGameId(), { action: 'ARENA_ENDED', winners });

    this.audioService.stopClock();
    this.audioService.playPodium();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: 'REVEAL' });
    }

    this.roundManager.completeRound('ARENA');
    this.checkLeaderboardDisplay();

  }

  private onModeTimeout() {
    const mode = this.currentMode();
    if (!mode) return;

    // L'Arena chiude da sola il round quando resta un solo giocatore:
    // evitiamo di completare il round due volte.
    if (mode.type === 'ARENA') return;


    this.audioService.stopClock();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: 'REVEAL' });
    }

    if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
      this.showTimeoutPopup();
    }


    this.audioService.playReveal();

    this.ws.broadcastStatus(this.currentGameId()!, { action: 'ROUND_ENDED' });

    this.isSpinning.set(false);


    this.roundManager.completeRound(mode.type);


    this.checkLeaderboardDisplay();
  }

  /**
   * 🎤 Buzz giocatore
   */
  private onPlayerBuzz(playerName: string) {


    const mode = this.currentMode();
    if (!mode) return;


    // Prenotazione: vince solo il primo telefono che arriva; i buzz successivi
    // non devono sovrascrivere il nome mostrato su TV e admin.
    if (!mode.canBuzz()) return;

    this.audioService.playBell();

    mode.handleBuzz(playerName);

    this.ws.broadcastStatus(this.currentGameId()!, {
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
    const realPoints = mode.pointsFor(true, elapsedMs);


    this.leaderboardService.addPoints(playerName, realPoints, true);


    this.ws.responses.update(res => res.map(r => r.playerName === playerName ? { ...r, points: realPoints } : r));

    mode.confirmCorrect(playerName);


    this.audioService.playCorrect();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: 'REVEAL' });
    }

    this.isSpinning.set(false);

    this.resultType.set('correct');
    this.resultPoints.set(realPoints);
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(this.currentGameId()!, {
      action: 'ROUND_ENDED',
      winner: playerName,
      points: realPoints
    });

    setTimeout(() => {
      this.showResultPopup.set(false);


      this.audioService.playReveal();
    }, 3000);


    this.roundManager.completeRound(mode.type);


    this.checkLeaderboardDisplay();
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
    const realPoints = mode.pointsFor(false, elapsedMs);


    this.leaderboardService.addPoints(playerName, realPoints, false);


    this.ws.responses.update(res => res.map(r => r.playerName === playerName ? { ...r, points: realPoints } : r));

    mode.confirmWrong(playerName);


    this.audioService.playWrong();

    this.resultType.set('wrong');
    this.resultPoints.set(realPoints);
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(this.currentGameId()!, {
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
    this.audioService.stopAll();

    const leaderboardType = this.roundManager.shouldShowLeaderboard();
    const round = this.roundManager.getCurrentRound();



    if (leaderboardType) {

      this.pendingLeaderboardType.set(leaderboardType);
    }
  }

  showPendingLeaderboard() {
    const type = this.pendingLeaderboardType();
    if (type === 'QUICK') {

      this.isShowingLeaderboard.set(true);
      this.showLeaderboardQuick.set(true);
    } else if (type === 'DETAILED') {

      this.isShowingLeaderboard.set(true);
      this.showLeaderboardDetailed.set(true);
    }
    this.pendingLeaderboardType.set(null);
  }

  onLeaderboardComplete() {
    // Manuale: la classifica resta in TV finché l'admin non avanza.
    if (this.phase() === 'IDLE') {
      this.audioService.startHeartbeat();
    }
  }

  adminNextRound(): void {
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    this.isShowingLeaderboard.set(false);
    this.pendingLeaderboardType.set(null);
    this.demoType.set(null);
    void this.startNewRound();
  }

  adminShowLeaderboard(): void {
    if (this.isSpinning()) return;

    const type = this.pendingLeaderboardType()
      ?? this.roundManager.shouldShowLeaderboard()
      ?? 'QUICK';

    this.pendingLeaderboardType.set(null);
    this.isShowingLeaderboard.set(true);

    if (type === 'DETAILED') {
      this.showLeaderboardQuick.set(false);
      this.showLeaderboardDetailed.set(true);
    } else {
      this.showLeaderboardDetailed.set(false);
      this.showLeaderboardQuick.set(true);
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
    this.arenaFinished = false;
    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCategoryId.set(null);
    this.timer.set(0);
    this.isPaused.set(false);
    this.showResultPopup.set(false);
    this.currentMode.set(null);
    this.demoType.set(null);
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
    const placed: Array<{ top: number, left: number }> = [];
    const results = categories.map(cat => ({ ...cat }));

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

      placed.push({ top, left });
      results[i].top = top + '%';
      results[i].left = left + '%';
    }

    return results;
  }

  getSafeDisplayData(): any {
    const mode = this.currentMode();
    const data = mode ? (mode.getDisplayData() || {}) : {};
    const isReading = mode ? (mode.getIsReading?.() ?? false) : false;
    const safe = { ...data, isReading } as any;

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
    const duration = mode.timerDuration;

    if (mode.type === 'QUIZ') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score} / -${score}`;
    }

    if (mode.type === 'WHEEL_OF_FORTUNE') {
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

  getRecentResponsesWithScores(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];

    return all.slice(-6).reverse().map(r => {
      const playerScore = this.leaderboardService.getLeaderboard()
        .find(p => p.playerName === r.playerName);

      return {
        ...r,
        lastPoints: r.points || 0,
        totalPoints: playerScore?.totalPoints || 0
      };
    });
  }
}
