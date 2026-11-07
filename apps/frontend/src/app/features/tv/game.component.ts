import { GamePhase } from '../../shared/enums/game-phase';
import { WsAction } from '../../shared/enums/ws-action';


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
  ChangeDetectionStrategy,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameRound, GameService } from '../../core/services/game.service';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { AiGeneratorService } from '../../core/services/ai-generator-service';
import { GameModeService } from '../../core/services/game-mode-factory.service';
import { RoundManagerService } from '../../core/services/round-manager.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { AudioService } from '../../core/services/audio.service';
import { PlayerAvatarService } from '../../core/services/player-avatar.service';
import { ThemeService } from '../../core/services/theme.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { ConnectionBadge } from '../../shared/components/connection-badge/connection-badge.component';

import { ImageBlur } from '../games/image-blur/image-blur.component';
import { Quiz } from '../games/quiz/quiz.component';
import { WheelFortune } from '../games/wheel-fortune/wheel-fortune.component';
import { Song } from '../games/song/song.component';
import { environment } from '../../core/environment/environment';
import { GameModeType, IGameMode } from '../../shared/models/game-mode-type';
import { LeaderboardQuick } from './leaderboard/leaderboard-quick-component/leaderboard-quick.component';
import { LeaderboardDetailed } from './leaderboard/leaderboard-detailed-component/leaderboard-detailed.component';
import { ArenaComponent } from '../games/arena/arena.component';
import { Timeline } from '../games/timeline/timeline.component';
import { TimeBuzzer } from '../games/time-buzzer/time-buzzer.component';
import { Bomba } from '../games/bomba/bomba.component';
import { SpeedRush } from '../games/speed-rush/speed-rush.component';
import { AirHockeyBattle } from '../games/air-hockey-battle/air-hockey-battle.component';
import { UltimaSpiaggia } from '../games/ultima-spiaggia/ultima-spiaggia.component';
import { Azzardo } from '../games/azzardo/azzardo.component';
import { levelForOccurrence } from '../games/azzardo/azzardo-rules';
import { Blackjack } from '../games/blackjack/blackjack.component';
import { DEMO_SCRIPTS, DEMO_SCENE_COUNT, DemoScript } from './demo-scripts';
import { scoringRuleFor } from '../../shared/models/scoring-rules';
import { BonusType, BONUS_LABELS } from '../../shared/models/bonus-type';
import { CasinoBonus } from '../bonus/casino/casino-bonus.component';
import { CavalloBonus } from '../bonus/cavallo/cavallo-bonus.component';
import { BasketBonusStage } from '../bonus/basket/basket-bonus-stage.component';
import { BiglieBonus } from '../bonus/biglie/biglie-bonus.component';

@Component({
  selector: 'app-game-component',
  standalone: true,
  imports: [
    CommonModule,
    ConnectionBadge,
    WheelFortune,
    Quiz,
    ImageBlur,
    Song,
    LeaderboardQuick,
    LeaderboardDetailed,
    ArenaComponent,
    Timeline,
    TimeBuzzer,
    Bomba,
    SpeedRush,
    AirHockeyBattle,
    UltimaSpiaggia,
    Azzardo,
    Blackjack,
    CasinoBonus,
    CavalloBonus,
    BasketBonusStage,
    BiglieBonus
  ],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css', './restyle.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  // La TV tiene vivo il canale avatar per tutta la serata, non solo in classifica.
  readonly playerAvatars = inject(PlayerAvatarService);


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
  demoScene = signal(0);
  bonusActive = signal(false);
  bonusType = signal<BonusType | null>(null);
  bonusScores = signal<Array<{ playerName: string; score: number; baskets: number }>>([]);
  bonusSecondsLeft = signal(0);
  bonusShowResult = signal(false);
  bonusResult = signal<Array<{ playerName: string; score: number }>>([]);
  autoAdvanceSeconds = signal(0);
  autoAdvanceEnabled = signal(true);
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

  readonly reliability = inject(ReliabilityService);
  currentGameId = signal<number>(1);

  categoryName = computed(() => {
    const id = this.selectedCategoryId();
    return this.allCategories().find((cat) => cat.id === id)?.name ?? '';
  });

  private arenaFinished = false;
  private readonly bonusActsStarted = new Set<number>();
  private bonusScoresMap = new Map<string, number>();
  private bonusBasketsMap = new Map<string, number>();
  private bonusAwarded = false;
  private bonusTimer?: ReturnType<typeof setInterval>;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;
  private demoTimer?: ReturnType<typeof setInterval>;
  private lastTimerTick = -1;
  private lastBonusTick = -1;
  private lastAutoTick = -1;
  private lastMusicTick = -1;

  /** Giochi con un conto alla rovescia: qui parte il heartbeat di suspense. */
  private readonly countdownModes = new Set<GameModeType>([
    'QUIZ',
    'IMAGE_BLUR',
    'MUSIC',
    'WHEEL_OF_FORTUNE',
    'TIMELINE',
    'BOMBA',
    'SPEED_RUSH',
    'AIR_HOCKEY_BATTLE',
    'ARENA',
    'ULTIMA_SPIAGGIA',
    'AZZARDO',
  ]);

  remoteUrl = `${environment.frontendUrl}/play`;

  // 🔥 [ROLLBACK] QR Code statico che punta a /play senza parametri
  qrCodeUrl = signal(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`);

  @ViewChild('prestartTimer', { read: ElementRef, static: false }) prestartTimer?: ElementRef<HTMLElement>;

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

  constructor() {
    // Tick e bong dei countdown: toni brevi, così non coprono musica e voce.
    effect(() => {
      const t = this.timer();
      if (this.showQuestion() && !this.bonusActive() && !this.isPaused()) {
        if (t > 5) {
          this.lastTimerTick = -1;
        } else if (t > 0 && t !== this.lastTimerTick) {
          this.lastTimerTick = t;
          this.audioService.playCountdownTick();
        } else if (t === 0 && this.lastTimerTick > 0) {
          this.lastTimerTick = 0;
          this.audioService.playCountdownBong();
        }
      }

      const basket = this.bonusSecondsLeft();
      if (this.bonusActive() && this.bonusType() === 'BASKET') {
        if (basket > 5) {
          this.lastBonusTick = -1;
        } else if (basket > 0 && basket !== this.lastBonusTick) {
          this.lastBonusTick = basket;
          this.audioService.playCountdownTick();
        } else if (basket === 0 && this.lastBonusTick > 0) {
          this.lastBonusTick = 0;
          this.audioService.playCountdownBong();
        }
      }

      const auto = this.autoAdvanceSeconds();
      if (auto > 5 || auto === 0) {
        this.lastAutoTick = -1;
      } else if (auto !== this.lastAutoTick) {
        this.lastAutoTick = auto;
        this.audioService.playCountdownTick();
      }
    });
  }

  async ngOnInit() {
    this.playerAvatars.connect(this.ws);
    try {
      const cats = await firstValueFrom(this.gameService.getCategories());
      const positioned = this.generateNonOverlappingPositions(cats);
      this.allCategories.set(positioned);


    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }


    // La TV mantiene viva la propria sessione: se il Wi-Fi cade torna
    // online da sola e riallinea versione ed eventi al server.
    this.reliability.start(this.currentGameId() ?? 1, 'TV');

    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);



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
      if (mode && ['TIMELINE_RESULT', 'TIME_BUZZER_ANSWER', 'SPEED_RUSH_PROGRESS', 'AIR_HOCKEY_BATTLE_ANSWER', 'ULTIMA_SPIAGGIA_ACTION', 'AZZARDO_ACTION', 'BLACKJACK_ACTION'].includes(status.action)) {
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

          this.audioService.playCountdownTick();
        } else if (cur === 0 && lastPreStart > 0) {
          this.audioService.playCountdownBong();
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
        this.startDemo(status.type || this.currentMode()?.type || 'QUIZ');
      } else if (status.action === 'ADMIN_HIDE_DEMO') {
        this.stopDemo();
      } else if (status.action === 'ADMIN_START_BONUS') {
        void this.startBonus(status.type || 'BASKET');
      } else if (status.action === 'ADMIN_STOP_BONUS') {
        this.finishBonus();
      } else if (status.action === 'BONUS_RESULT') {
        this.recordBonusResult(
          status.playerName,
          Number(status.score) || 0,
          Number(status.baskets) || 0,
        );
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
    this.stopDemoTimer();

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

    this.cancelAutoAdvance();

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


    // La TV mantiene viva la propria sessione: se il Wi-Fi cade torna
    // online da sola e riallinea versione ed eventi al server.
    this.reliability.start(this.currentGameId() ?? 1, 'TV');

    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);


    this.audioService.stopSuspense();

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
          this.azzardoDifficulty(extractedType)
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
        onCountdownTick: (seconds) => this.onCountdownTick(seconds),
        onPlayerEliminated: (playerName) => this.onArenaEliminated(playerName),
        onRoundEnded: () => this.onArenaEnded(),
        onBroadcast: (event: any) => this.ws.broadcastStatus(this.currentGameId()!, event),
        playerPoints: (playerName: string) =>
          this.leaderboardService.getPlayerStats(playerName)?.totalPoints ?? 0,
        startTimeBuzzer: (manche: number) => new Promise<number | null>((resolve) => {
          // Il via ai telefoni lo manda il backend, non la TV: così è lui a
          // sapere da quando parte il cronometro e può validare i tempi.
          this.gameService.startTimeBuzzer(this.currentGameId()!, manche).subscribe({
            next: (res) => resolve(Number(res?.startedAt) || null),
            error: () => resolve(null),
          });
        }),
        loadAirHockeyQuestions: async (difficulty: string) => {
          const rows = await firstValueFrom(
            this.gameService.getAirHockeyQuestions(this.currentGameId()!, difficulty, 12),
          );
          return rows.map((row) => ({
            text: row.question,
            options: row.options,
            correctIndex: Math.max(0, row.options.indexOf(row.correctAnswer)),
            difficulty: (row.difficulty === 'MEDIUM' || row.difficulty === 'HARD'
              ? row.difficulty
              : 'EASY') as 'EASY' | 'MEDIUM' | 'HARD',
          }));
        },
        bomba: {
          start: (players: string[], act: number) => firstValueFrom(
            this.gameService.startBomba(this.currentGameId()!, players, act),
          ),
          state: (player?: string) => firstValueFrom(
            this.gameService.getBombaState(this.currentGameId()!, player),
          ),
          pick: (playerName: string, cellId: number) => firstValueFrom(
            this.gameService.pickBomba(this.currentGameId()!, playerName, cellId),
          ),
          pause: () => firstValueFrom(this.gameService.pauseBomba(this.currentGameId()!)),
          resume: () => firstValueFrom(this.gameService.resumeBomba(this.currentGameId()!)),
          reset: () => firstValueFrom(this.gameService.resetBomba(this.currentGameId()!)),
        },
        onAnswerReceived: (result: any) => {

          if (result && result.playerName) {


            const points = result.points || 0;
            const isCorrect = !!result.isCorrect;

            // Durante un bonus i punti del round non contano: si classifica
            // il risultato del bonus e si premiano solo i primi tre.
            if (this.bonusActive()) {
              this.recordBonusResult(result.playerName, isCorrect ? 1 : 0);
              return;
            }


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
        action: WsAction.SHOW_QUESTION,
        type: parsedPayload.type || extractedType,
        payload: payloadString,
        rawPayload: rawPayloadString
      });


      this.audioService.startClock();
      this.startRoundSuspense(mode.type);

      await mode.start();

      this.ws.broadcastStatus(this.currentGameId()!, {
        action: WsAction.START_VOTING,
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
      this.audioService.stopSuspense();
    }
  }

  private getCategoryForType(type: GameModeType): string {
    switch (type) {
      case 'QUIZ':
        // Il Quiz usa davvero la categoria estratta: la banca ha 10 domande
        // per ognuna delle 16 categorie ufficiali.
        return this.pickCategoryName();
      case 'MUSIC':
        return 'Musica';
      case 'IMAGE_BLUR':
        // Le foto sono trasversali (cinema, musica, sport): la categoria
        // serve solo al filtro della banca, che cade sulle altre se vuota.
        return 'CELEBRITÀ';
      case 'WHEEL_OF_FORTUNE':
        return 'PROVERBI E MODI DI DIRE';
      case 'ARENA':
        return 'ARENA';
      case 'TIMELINE':
        // Timeline pesca solo categorie con eventi catalogabili in ordine
        // temporale; il backend filtra gli eventi su questa categoria.
        return this.pickTimelineCategoryName();
      case 'ULTIMA_SPIAGGIA':
        // Ultima spiaggia estrae una categoria per round: servono cinque
        // domande della stessa categoria, una per livello.
        return this.pickCategoryName();
      case 'TIME_BUZZER':
      case 'AZZARDO':
      case 'BLACKJACK':
      case 'BOMBA':
      case 'SPEED_RUSH':
      case 'AIR_HOCKEY_BATTLE':
        return 'CULTURA GENERALE';
      default:
        return this.pickCategoryName();
    }
  }

  private pickCategoryName(): string {
    const categories = this.allCategories();
    if (categories.length === 0) return 'CULTURA GENERALE';
    const randomIndex = Math.floor(Math.random() * categories.length);
    return categories[randomIndex].name;
  }

  private pickTimelineCategoryName(): string {
    const categories = this.allCategories().filter((category) => category.timeline);
    if (categories.length === 0) return this.pickCategoryName();
    const randomIndex = Math.floor(Math.random() * categories.length);
    return categories[randomIndex].name;
  }

  /**
   * 🎮 Ottieni nome italiano del mode
   */
  /** Livello di Azzardo: la serata lo incontra tre volte, sempre più difficile. */
  private azzardoDifficulty(type: GameModeType): string {
    if (type !== 'AZZARDO') return 'medio';
    const played = this.roundManager.getRoundStats().distribution['AZZARDO'] ?? 0;
    const level = levelForOccurrence(played + 1);
    return level === 1 ? 'facile' : level === 3 ? 'difficile' : 'medio';
  }

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
      // case '1VS1':
      //   return '1 CONTRO 1';
      case 'ARENA':
        return 'ARENA BATTLE ROYALE';
      case 'TIMELINE':
        return 'TIMELINE';
      case 'TIME_BUZZER':
        return 'TIME BUZZER';
      case 'ULTIMA_SPIAGGIA':
        return 'ULTIMA SPIAGGIA';
      case 'AZZARDO':
        return 'AZZARDO';
      case 'BLACKJACK':
        return 'BLACK JACK';
      case 'BOMBA':
        return 'BOMBA';
      case 'SPEED_RUSH':
        return 'SPEED RUSH';
      case 'AIR_HOCKEY_BATTLE':
        return 'AIR HOCKEY BATTLE';
      case 'BONUS_BASKET':
        return 'BONUS BASKET';
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
      action: WsAction.ARENA_ELIMINATED,
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

    const data = this.currentMode()?.getDisplayData?.();
    const winners = data?.winners ?? [];

    // I punti di piazzamento dell'Arena (1000/500/−300) non venivano mai
    // versati in classifica: entrano qui una sola volta, prima della classifica.
    for (const team of data?.teams ?? []) {
      if (team?.score) {
        this.leaderboardService.addPoints(team.playerName, team.score, team.score > 0);
      }
    }

    this.ws.broadcastStatus(this.currentGameId(), { action: WsAction.ARENA_ENDED, winners });

    this.audioService.stopClock();
    this.audioService.stopSuspense();
    this.audioService.playPodium();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: GamePhase.REVEAL });
    }

    this.roundManager.completeRound('ARENA');
    this.checkLeaderboardDisplay();

  }

  private onModeTimeout() {
    if (this.bonusActive()) {
      this.finishBonus();
      return;
    }

    const mode = this.currentMode();
    if (!mode) return;

    // L'Arena chiude da sola il round quando resta un solo giocatore:
    // evitiamo di completare il round due volte, ma il timer scaduto deve
    // comunque spegnere la suspense.
    if (mode.type === 'ARENA') {
      this.audioService.stopSuspense();
      return;
    }


    this.audioService.stopClock();
    this.audioService.stopSuspense();

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: GamePhase.REVEAL });
    }

    if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
      this.showTimeoutPopup();
    }


    this.audioService.playReveal();

    this.ws.broadcastStatus(this.currentGameId()!, { action: WsAction.ROUND_ENDED });

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

    // Anteprima per il presentatore: i punti dipendono dal tempo congelato
    // dal buzz, quindi il valore mostrato è quello che verrà applicato.
    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);
    const payload = this.currentRoundPayload();
    this.ws.broadcastStatus(this.currentGameId()!, {
      action: WsAction.PLAYER_PRENOTATO,
      name: playerName,
      type: mode.type,
      correctPoints: mode.pointsFor(true, elapsedMs),
      wrongPoints: mode.pointsFor(false, elapsedMs),
      solution: this.solutionFor(mode.type, payload),
      scoring: scoringRuleFor(mode.type),
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

    this.audioService.stopSuspense();
    // Music: il suono "corretto" arriva dopo i 4 secondi di intro a basso
    // volume, insieme alla ripartenza a tutto volume. Negli altri giochi resta
    // immediato.
    if (mode.type === 'MUSIC') {
      setTimeout(() => this.audioService.playCorrect(), 4000);
    } else {
      this.audioService.playCorrect();
    }

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: GamePhase.REVEAL });
    }

    this.isSpinning.set(false);

    this.resultType.set('correct');
    this.resultPoints.set(realPoints);
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(this.currentGameId()!, {
      action: WsAction.ROUND_ENDED,
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
      action: WsAction.BLOCKED_ERROR,
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
      this.showPendingLeaderboard();
      return;
    }

    this.startAutoAdvance();
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
    // Fine atto: la classifica dettagliata lancia il bonus unico dell'atto.
    const bonus = this.showLeaderboardDetailed() ? this.roundManager.bonusAfterAct() : null;
    if (bonus) {
      const act = this.roundManager.getCurrentAct();
      if (!this.bonusActsStarted.has(act)) {
        this.bonusActsStarted.add(act);
        void this.startBonus(bonus);
        return;
      }
    }

    // Manuale: la classifica resta in TV finché l'admin non avanza.
    if (this.phase() === 'IDLE') {
      this.audioService.startHeartbeat();
    }
  }

  adminNextRound(): void {
    this.cancelAutoAdvance();
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    this.isShowingLeaderboard.set(false);
    this.pendingLeaderboardType.set(null);
    this.stopDemo();
    void this.startNewRound();
  }

  adminShowLeaderboard(): void {
    this.cancelAutoAdvance();
    this.stopDemo();
    this.audioService.stopSuspense();
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
    this.cancelAutoAdvance();
    const mode = this.currentMode();
    if (!mode) return;

    if (this.isPaused()) {
      mode.resume();
      this.isPaused.set(false);
      this.resumeRoundSuspense();
    } else {
      this.audioService.stopSuspense();
      mode.pause();
      this.isPaused.set(true);
    }
  }

  /** Bonus: parte dalla TV a fine atto (o su comando admin) e non consuma un round. */
  async startBonus(type: BonusType): Promise<void> {
    if (this.isSpinning() || this.bonusActive()) return;

    this.cancelAutoAdvance();
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    this.isShowingLeaderboard.set(false);
    this.pendingLeaderboardType.set(null);
    this.reset();

    this.bonusActive.set(true);
    this.bonusType.set(type);
    this.bonusAwarded = false;
    this.bonusScoresMap.clear();
    this.bonusBasketsMap.clear();
    this.bonusScores.set([]);
    this.bonusResult.set([]);
    this.bonusShowResult.set(false);

    if (!this.currentGameId()) {
      const game = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(game.id);
      this.ws.subscribeToGame(game.id);
    }

    if (type === 'BASKET') {
      this.ws.broadcastStatus(this.currentGameId(), {
        action: WsAction.SHOW_QUESTION,
        type: 'BONUS_BASKET',
        payload: JSON.stringify({ type: 'BONUS_BASKET', question: 'BONUS BASKET' }),
      });
      this.startBasketCountdown();
      return;
    }

    // Il Cavallo ha una schermata TV dedicata che parla direttamente con i
    // telefoni tramite CAVALLO_STATE, come il Casino.
    if (type === 'CAVALLO') {
      const publicPayload = JSON.stringify({ type: 'BONUS_CAVALLO', question: BONUS_LABELS[type] });
      this.ws.broadcastStatus(this.currentGameId(), {
        action: WsAction.SHOW_QUESTION,
        type: 'BONUS_CAVALLO',
        payload: publicPayload,
        rawPayload: publicPayload,
      });
      return;
    }

    // Le Biglie hanno una schermata TV dedicata che parla con i telefoni
    // tramite BIGLIE_STATE: la scelta della biglia è unica e in ordine
    // sorteggiato, quindi non può passare dal flusso delle domande.
    if (type === 'BIGLIE') {
      const publicPayload = JSON.stringify({ type: 'BONUS_BIGLIE', question: BONUS_LABELS[type] });
      this.ws.broadcastStatus(this.currentGameId(), {
        action: WsAction.SHOW_QUESTION,
        type: 'BONUS_BIGLIE',
        payload: publicPayload,
        rawPayload: publicPayload,
      });
      return;
    }

    // Il Casino ha una schermata TV dedicata che parla direttamente con i
    // telefoni tramite CASINO_STATE: quattro manche a difficoltà crescente su
    // una sola griglia di scelta.
    const publicPayload = JSON.stringify({ type: 'BONUS_CASINO', question: BONUS_LABELS[type] });
    this.ws.broadcastStatus(this.currentGameId(), {
      action: WsAction.SHOW_QUESTION,
      type: 'BONUS_CASINO',
      payload: publicPayload,
      rawPayload: publicPayload,
    });
  }

  private startBasketCountdown(): void {
    this.clearBonusTimer();
    this.bonusSecondsLeft.set(90);
    this.bonusTimer = setInterval(() => {
      const next = this.bonusSecondsLeft() - 1;
      this.bonusSecondsLeft.set(Math.max(0, next));
      if (next <= 0) this.finishBonus();
    }, 1000);
  }

  /** I bonus sommano i punti delle manche; nessun punto va ancora in classifica. */
  private recordBonusResult(playerName: string, score: number, baskets = 0): void {
    const name = String(playerName || '').trim();
    if (!name) return;

    const value = Number.isFinite(score) ? score : 0;
    const previous = this.bonusScoresMap.get(name) ?? 0;
    this.bonusScoresMap.set(name, previous + value);
    const previousBaskets = this.bonusBasketsMap.get(name) ?? 0;
    this.bonusBasketsMap.set(name, previousBaskets + (Number.isFinite(baskets) ? baskets : 0));
    this.bonusScores.set(
      [...this.bonusScoresMap.entries()]
        .map(([player, points]) => ({
          playerName: player,
          score: points,
          baskets: this.bonusBasketsMap.get(player) ?? 0,
        }))
        .sort((a, b) => b.score - a.score),
    );
  }

  private finishBonus(): void {
    if (!this.bonusActive() || this.bonusAwarded) return;
    this.bonusAwarded = true;
    this.clearBonusTimer();
    if (this.bonusType() === 'BASKET' && this.bonusSecondsLeft() <= 1) {
      this.audioService.playCountdownBong();
    }

    const ranking = [...this.bonusScoresMap.entries()]
      .map(([playerName, score]) => ({ playerName, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // Nessun premio automatico: la politica premio/punti dei bonus sarà
    // decisa a parte, quindi qui si registra solo la classifica del bonus.
    this.bonusResult.set(ranking);
    this.bonusShowResult.set(true);

    this.ws.broadcastStatus(this.currentGameId(), {
      action: WsAction.BONUS_ENDED,
      ranking,
    });

    this.bonusActive.set(false);
    this.currentMode.set(null);
    this.showQuestion.set(false);
    this.phase.set('QUESTION');
    this.bonusSecondsLeft.set(0);

    // Il tipo resta per il riepilogo; non azzerarlo se nel frattempo parte un altro bonus.
    setTimeout(() => {
      if (this.bonusActive()) return;
      this.bonusShowResult.set(false);
      this.bonusType.set(null);
    }, 8000);
  }

  /** Giocatori in classifica, usati dai bonus per raccogliere i tocchi. */
  bonusPlayers(): string[] {
    return this.leaderboardService.getLeaderboard().map((player) => player.playerName);
  }

  bonusLabel(): string {
    const type = this.bonusType();
    return type ? BONUS_LABELS[type] : 'BONUS';
  }

  onBonusResult(event: { playerName: string; score: number; baskets?: number }): void {
    this.recordBonusResult(event?.playerName, Number(event?.score) || 0, Number(event?.baskets) || 0);
  }

  private startAutoAdvance(): void {
    if (!this.autoAdvanceEnabled() || this.bonusActive()) return;

    this.cancelAutoAdvance();
    this.autoAdvanceSeconds.set(10);
    this.autoAdvanceTimer = setInterval(() => {
      if (this.isPaused() || this.isShowingLeaderboard() || this.demoType()) {
        this.cancelAutoAdvance();
        return;
      }

      const next = this.autoAdvanceSeconds() - 1;
      this.autoAdvanceSeconds.set(Math.max(0, next));
      if (next <= 0) {
        this.audioService.playCountdownBong();
        this.cancelAutoAdvance();
        this.adminNextRound();
      }
    }, 1000);
  }

  private cancelAutoAdvance(): void {
    if (this.autoAdvanceTimer) {
      clearInterval(this.autoAdvanceTimer);
      this.autoAdvanceTimer = undefined;
    }
    this.autoAdvanceSeconds.set(0);
  }

  private clearBonusTimer(): void {
    if (this.bonusTimer) {
      clearInterval(this.bonusTimer);
      this.bonusTimer = undefined;
    }
  }

  private reset() {
    this.arenaFinished = false;
    this.audioService.stopSuspense();
    this.cancelAutoAdvance();
    this.clearBonusTimer();
    this.bonusActive.set(false);
    this.bonusType.set(null);
    this.bonusScores.set([]);
    this.bonusResult.set([]);
    this.bonusShowResult.set(false);
    this.bonusSecondsLeft.set(0);
    this.bonusScoresMap.clear();
    this.bonusAwarded = false;
    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCategoryId.set(null);
    this.timer.set(0);
    this.isPaused.set(false);
    this.showResultPopup.set(false);
    this.currentMode.set(null);
    this.stopDemo();
    this.demoScene.set(0);
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

  // ── Demo animate (TV, remote, punti) ────────────────────────────────
  startDemo(type: string): void {
    this.stopDemoTimer();
    this.demoType.set(type);
    this.demoScene.set(0);
    this.demoTimer = setInterval(() => {
      if (!this.demoType()) return;
      this.demoScene.update((scene) => (scene + 1) % DEMO_SCENE_COUNT);
    }, 5000);
  }

  stopDemo(): void {
    this.stopDemoTimer();
    this.demoType.set(null);
  }

  goDemoScene(scene: number): void {
    this.demoScene.set(((scene % DEMO_SCENE_COUNT) + DEMO_SCENE_COUNT) % DEMO_SCENE_COUNT);
  }

  nextDemoScene(): void {
    this.goDemoScene(this.demoScene() + 1);
  }

  prevDemoScene(): void {
    this.goDemoScene(this.demoScene() - 1);
  }

  getDemoScript(type: string): DemoScript {
    return DEMO_SCRIPTS[type] ?? {
      title: this.getModeName(type),
      icon: '🎮',
      tv: ['La TV mostra il gioco', 'Il presentatore spiega dal vivo'],
      remote: ['Il telefono mostra i comandi', 'Segui le istruzioni in TV'],
      scoring: [],
      note: 'Demo non ancora disponibile per questo gioco.',
    };
  }

  /** Countdown interno di una modalità (pausa tra le manche di Music). */
  private onCountdownTick(seconds: number): void {
    if (seconds > 5) {
      this.lastMusicTick = -1;
    } else if (seconds > 0) {
      this.lastMusicTick = seconds;
      this.audioService.playCountdownTick();
    } else if (seconds === 0 && this.lastMusicTick > 0) {
      this.lastMusicTick = 0;
      this.audioService.playCountdownBong();
    }
  }

  /** Avvia il heartbeat di suspense solo nei countdown e dal round 20. */
  private startRoundSuspense(type: GameModeType): void {
    if (!this.countdownModes.has(type)) return;
    const round = this.roundManager.getCurrentRound();
    if (round < 20) return;
    this.audioService.startSuspense(round);
  }

  private resumeRoundSuspense(): void {
    const mode = this.currentMode();
    if (!mode || this.bonusActive() || this.isShowingLeaderboard()) return;
    this.startRoundSuspense(mode.type);
  }

  private stopDemoTimer(): void {
    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = undefined;
    }
  }

  private currentRoundPayload(): any {
    const payload = this.round()?.payload;
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return {};
      }
    }
    return payload ?? {};
  }

  /** Soluzione leggibile per il presentatore, senza svelarla ai telefoni. */
  private solutionFor(type: GameModeType, payload: any): string {
    switch (type) {
      case 'QUIZ':
      case 'IMAGE_BLUR':
        return String(payload?.correctAnswer ?? 'Soluzione in TV');
      case 'WHEEL_OF_FORTUNE':
        return String(payload?.proverb ?? 'Soluzione in TV');
      case 'MUSIC':
        return [payload?.songTitle, payload?.artist].filter(Boolean).join(' — ') || 'Soluzione in TV';
      case 'TIMELINE':
        return 'Ordine corretto mostrato in TV al reveal';
      case 'TIME_BUZZER':
        return 'Tempo bersaglio mostrato in TV';
      case 'ULTIMA_SPIAGGIA':
        return 'La TV svela la risposta di ogni livello';
      case 'AZZARDO':
        return "La TV svela il valore e l'opzione che paga";
      case 'BLACKJACK':
        return 'Mani e banco svelati in TV a ogni tavolo';
      case 'BOMBA':
        return 'Tabellone e bombe in TV; ogni telefono sceglie una casella';
      case 'AIR_HOCKEY_BATTLE':
        return 'Domande e set in TV; risposte sul telefono';
      case 'SPEED_RUSH':
        return 'Classifica finale in TV';
      case 'ARENA':
        return 'Podio finale in TV';
      default:
        return 'Soluzione in TV';
    }
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

    if (!mode || !mode.isRevealed()) {
      safe.correctAnswer = null;
    }

    // La banca della UltimaSpiaggia viaggia con le risposte: ai telefoni non servono.
    if (Array.isArray(safe.questions)) {
      safe.questions = safe.questions.map((question: any) => ({ ...question, correctAnswer: null }));
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
      // Tre manches, 1000 punti in tutto: il preview del singolo timer non
      // rappresenta piu il valore della domanda.
      return '3 MANCHES · 1000 PT';
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
