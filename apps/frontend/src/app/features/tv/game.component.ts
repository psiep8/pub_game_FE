import { GamePhase } from '../../shared/enums/game-phase';
import { WsAction } from '../../shared/enums/ws-action';
import * as QRCode from 'qrcode';


import {
  Component,
  signal,
  inject,
  OnInit,
  HostListener,
  OnDestroy,
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
import { LeaderboardService, PlayerScore } from '../../core/services/leaderboard.service';
import { AudioService } from '../../core/services/audio.service';
import { PlayerAvatarService } from '../../core/services/player-avatar.service';
import { ButtonTestService, ButtonTestSnapshot } from '../../core/services/button-test.service';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { ConnectionBadge } from '../../shared/components/connection-badge/connection-badge.component';

import { ImageBlur } from '../games/image-blur/image-blur.component';
import { Quiz } from '../games/quiz/quiz.component';
import { WheelFortune } from '../games/wheel-fortune/wheel-fortune.component';
import { Song } from '../games/song/song.component';
import { environment } from '../../core/environment/environment';
import { GameModeConfig, GameModeType, IGameMode } from '../../shared/models/game-mode-type';
import { LeaderboardQuick } from './leaderboard/leaderboard-quick-component/leaderboard-quick.component';
import { LeaderboardDetailed } from './leaderboard/leaderboard-detailed-component/leaderboard-detailed.component';
import { ArenaComponent } from '../games/arena/arena.component';
import { Timeline } from '../games/timeline/timeline.component';
import { TimeBuzzer } from '../games/time-buzzer/time-buzzer.component';
import { Bomba } from '../games/bomba/bomba.component';
import { SpeedRush } from '../games/speed-rush/speed-rush.component';
import { TennisBattle } from '../games/tennis-battle/tennis-battle.component';
import { UltimaSpiaggia } from '../games/ultima-spiaggia/ultima-spiaggia.component';
import { Azzardo } from '../games/azzardo/azzardo.component';
import { levelForOccurrence } from '../games/azzardo/azzardo-rules';
import { Blackjack } from '../games/blackjack/blackjack.component';
import { DemoScript, demoScriptFor } from './demo-scripts';
import { REVEAL_DELAY_MS, scoringRuleFor } from '../../shared/models/scoring-rules';
import { ROUNDS_PER_ACT } from '../../shared/schedule';
import { BonusVoucher, voucherCode } from '../../shared/models/voucher';

/**
 * Quante fotografie delle presenze devono mancare prima di togliere una squadra
 * a zero punti. Una sola può essere in ritardo: chi è appena entrato sparirebbe.
 */
const PRESENCE_MISSES_BEFORE_FORGET = 2;
import { BonusType, BONUS_LABELS, BONUS_TYPES } from '../../shared/models/bonus-type';

/** Stato che il telefono sa applicare, per ogni round con eventi in diretta. */
const ROUND_STATE_ACTIONS: Partial<Record<GameModeType, WsAction>> = {
  QUIZ: WsAction.QUIZ_STATE,
  TIME_BUZZER: WsAction.TIME_BUZZER_STATE,
  TENNIS_BATTLE: WsAction.TENNIS_BATTLE_STATE,
  ULTIMA_SPIAGGIA: WsAction.ULTIMA_SPIAGGIA_STATE,
  AZZARDO: WsAction.AZZARDO_STATE,
  BLACKJACK: WsAction.BLACKJACK_STATE,
  BIGLIE: WsAction.BIGLIE_STATE,
};

/** Stato del bonus: le tre varianti Casino condividono la stessa ruota. */
const BONUS_STATE_ACTIONS: Record<BonusType, WsAction> = {
  CASINO_COLOR: WsAction.CASINO_STATE,
  CASINO_DOZEN: WsAction.CASINO_STATE,
  CASINO_NUMBER: WsAction.CASINO_STATE,
  BLACKJACK: WsAction.BLACKJACK_STATE,
  CAVALLO: WsAction.CAVALLO_STATE,
};
import { CasinoBonus } from '../bonus/casino/casino-bonus.component';
import { CavalloBonus } from '../bonus/cavallo/cavallo-bonus.component';
import { Biglie } from '../games/biglie/biglie.component';
import { BlackjackBonus } from '../bonus/blackjack/blackjack-bonus.component';
import { BonusEntrance } from '../bonus/bonus-entrance/bonus-entrance.component';
import { CASINO_BONUS_TYPES } from '../../shared/models/bonus-type';

type TvPhase = 'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION' | typeof GamePhase.INTRO;

/** Punti del round aperto: il verdetto del vincitore deve sopravvivere al refresh. */
const ROUND_POINTS_KEY = 'roundPoints';
/** Scrittura di classifica in coda (debounce 250 ms) non ancora confermata. */
const PENDING_LEADERBOARD_KEY = 'leaderboardPending';

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
    TennisBattle,
    UltimaSpiaggia,
    Azzardo,
    Blackjack,
    CasinoBonus,
    CavalloBonus,
    Biglie,
    BlackjackBonus,
    BonusEntrance
  ],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css', './restyle.css', './demo.css'],
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
  private buttonTests = inject(ButtonTestService);
  public audioService = inject(AudioService);
  public theme = inject(ThemeService);
  // La TV tiene vivo il canale avatar per tutta la serata, non solo in classifica.
  readonly playerAvatars = inject(PlayerAvatarService);


  allCategories = signal<any[]>([]);
  round = signal<GameRound | null>(null);
  currentMode = signal<IGameMode | null>(null);


  /** L'intro è una fase della TV, non una modale separata: così il resto
   *  della schermata sa sempre cosa sta mostrando. */
  private readonly introSeenKey = 'pubgame.intro.seen';
  private readonly introSeen = localStorage.getItem(this.introSeenKey) === '1';
  phase = signal<TvPhase>(this.introSeen ? 'IDLE' : GamePhase.INTRO);
  readonly introVisible = computed(() => this.phase() === GamePhase.INTRO);
  readonly introReducedMotion = signal(
    typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );
  readonly introDurationMs = signal(7800);
  /** Icone statiche: raccontano i giochi della serata, non sono decorazione. */
  readonly introIcons = [
    { glyph: '?', label: 'QUIZ' },
    { glyph: '♫', label: 'MUSICA' },
    { glyph: '◉', label: 'IMMAGINI' },
    { glyph: '⌛', label: 'TEMPO' },
    { glyph: '♠', label: 'CARTE' },
    { glyph: '⚄', label: 'AZZARDO' },
    { glyph: '◎', label: 'ARENA' },
    { glyph: '★', label: 'CLASSIFICA' },
  ];
  private introTimer?: ReturnType<typeof setTimeout>;
  private phaseBeforeIntro: Exclude<TvPhase, typeof GamePhase.INTRO> = 'IDLE';
  isSpinning = signal(false);
  selectedCategoryId = signal<number | null>(null);
  showQuestion = signal(false);
  showTypeReveal = signal<string | null>(null);
  timer = signal(0);
  isPaused = signal(false);
  /** Pausa di suspense fra la scadenza e il reveal. */
  revealPending = signal(false);
  demoType = signal<string | null>(null);
  demoScene = signal(0);
  bonusActive = signal(false);
  bonusType = signal<BonusType | null>(null);
  /** Stato del bonus da riaprire dopo un refresh (per ora solo Casino). */
  bonusResume = signal<any | null>(null);
  /** Ingresso scenografico in corso: il bonus vero parte alla fine. */
  bonusEntrance = signal<BonusType | null>(null);
  bonusShowResult = signal(false);
  bonusResult = signal<Array<{ playerName: string; score: number }>>([]);
  /** Buoni bevande/cibo: premi fisici consegnati dalla regia, non punti. */
  bonusVouchers = signal<BonusVoucher[]>([]);
  /** Codice sempre a quattro cifre, anche quando inizia per zero. */
  readonly voucherCode = voucherCode;
  autoAdvanceSeconds = signal(0);
  animatedCategoryId = signal<number | null>(null);
  /** Roll da slot machine: nomi che scorrono prima di svelare la categoria. */
  readonly slotRolling = signal(false);
  readonly slotRollName = signal('');
  /** Bolle già chiuse: dal rullo in poi non devono più tornare a schermo. */
  readonly bubblesDismissed = signal(false);


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

  /**
   * Round rimasto aperto sul server quando la TV si collega (refresh o altro
   * dispositivo). Non si riapre da soli: le fasi interne dei giochi vivono in
   * TV, quindi il presentatore sceglie se riprendere o chiudere.
   */
  readonly recoveredRound = signal<{
    type: GameModeType;
    label: string;
    secondsLeft: number;
    resumable: boolean;
    paused: boolean;
  } | null>(null);
  private recoveredPayload: any = null;
  private recoveredBlackjackState: any = null;
    /** Checkpoint TV del round precedente: uno solo, con la modalità che lo ha scritto. */
  private recoveredTvCheckpoint: { type: GameModeType; value: any } | null = null;
  /** Stato del round Biglie da riprendere, letto dal checkpoint del server. */
  readonly biglieResume = signal<any | null>(null);
  /** Indice del round aperto secondo il server: può restare dietro alla scaletta. */
  private serverRoundIndex: number | null = null;
  private leaderboardFlush?: ReturnType<typeof setTimeout>;
  /** Ultima variazione locale e ultima confermata dal server. */
  private leaderboardPendingSeq = 0;
  private leaderboardSavedSeq = 0;
  /** Punti assegnati mentre il round era aperto: solo questi fanno vincere. */
  private roundPoints = new Map<string, number>();
  private roundScoring = false;
  /** Tema del vincitore del round chiuso; null = acido. */
  private roundWinnerTheme: AppTheme | null = null;

  categoryName = computed(() => {
    const id = this.selectedCategoryId();
    return this.allCategories().find((cat) => cat.id === id)?.name ?? '';
  });

  /**
   * Il timer si vede solo mentre si può ancora rispondere. A soluzione svelata
   * (o a tempo scaduto) la cifra sparisce: resta la soluzione, non il conto
   * alla rovescia. Vale per la barra della TV e per i cerchi dei giochi.
   */
  readonly timerVisible = computed(() => {
    if (this.revealPending()) return false;
    const mode = this.currentMode();
    if (mode && typeof mode.isRevealed === 'function' && mode.isRevealed()) return false;
    return this.round()?.status !== GamePhase.REVEAL;
  });

  /** Nomi del rullo che si ferma sulla categoria estratta. */
  slotNames = computed(() => {
    const categories = this.allCategories();
    if (!categories.length) return [];
    const selectedId = this.selectedCategoryId();
    const index = Math.max(0, categories.findIndex((category) => category.id === selectedId));
    const names: string[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      names.push(categories[(index + offset + categories.length) % categories.length].name);
    }
    return names;
  });

  /**
   * Bolle mostrate prima della domanda: la Timeline pesca solo nelle categorie
   * abilitate al gioco, le altre modalità usano tutto il tabellone.
   */
  bubbleCategories = computed(() => {
    const categories = this.allCategories();
    if (this.currentMode()?.type !== 'TIMELINE') return categories;
    const allowed = categories.filter((category) => category.timeline);
    return allowed.length > 0 ? allowed : categories;
  });

  private arenaFinished = false;
  /** Telefoni presenti sul backend: i bonus li usano anche senza classifica
   *  (dopo un reset la leaderboard è vuota e i tavoli sparirebbero). */
  readonly presencePlayers = signal<string[]>([]);
  /** Telefono (deviceId) → nome attuale: serve a riconoscere un rientro rinominato. */
  private readonly deviceNames = new Map<string, string>();
  /** Nomi già visti in una fotografia delle presenze, e assenze consecutive. */
  private readonly seenInPresence = new Set<string>();
  private readonly presenceMisses = new Map<string, number>();
  /** Codice di abbinamento regia, con l'ora di scadenza già formattata. */
  readonly pairingCode = signal<string | null>(null);
  readonly pairingExpiresAt = signal('');
  readonly buttonTestSnapshot = signal<ButtonTestSnapshot | null>(null);
  readonly pageVisible = signal(!document.hidden);

  /** Pausa aperta dalla scheda nascosta: al ritorno si chiude da sola. */
  private hiddenPause = false;

  /**
   * Scheda nascosta: si ferma anche il round normale, non solo bonus e Biglie.
   * La pausa passa dal server, così la deadline non scade mentre nessuno
   * guarda; al ritorno si riprende solo ciò che ha fermato la scheda, mai una
   * pausa voluta dal presentatore.
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.pageVisible.set(!document.hidden);

    if (document.hidden) {
      const gameId = this.currentGameId();
      if (gameId && !this.isPaused() && (this.currentMode() || this.bonusActive())) {
        this.hiddenPause = true;
        this.togglePause();
      }
      return;
    }

    if (!this.hiddenPause) return;
    this.hiddenPause = false;
    if (this.isPaused()) this.togglePause();
  }
  private presenceTimer?: ReturnType<typeof setInterval>;
  private buttonTestTimer?: ReturnType<typeof setInterval>;
  private lastButtonTestPing = 0;
  /** Bonus dell'atto salvato sul server: avviato o già chiuso. */
  private serverBonus: { act: number; type: string; status: string } | null = null;
  private bonusScoresMap = new Map<string, number>();
  private bonusAwarded = false;
  private bonusTimer?: ReturnType<typeof setInterval>;
  private bonusEntranceTimer?: ReturnType<typeof setTimeout>;
  private autoAdvanceTimer?: ReturnType<typeof setInterval>;
  private demoTimer?: ReturnType<typeof setInterval>;
  private lastTimerTick = -1;
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
    'TENNIS_BATTLE',
    'ARENA',
    'ULTIMA_SPIAGGIA',
    'AZZARDO',
  ]);

  /**
   * Link ai telefoni: contiene l'ID della partita aperta, così un QR vecchio
   * o una seconda TV non portano i giocatori nella serata sbagliata.
   */
  readonly remoteUrl = computed(() => {
    const gameId = this.currentGameId();
    return `${environment.frontendUrl}/play${gameId > 0 ? `?game=${gameId}` : ''}`;
  });

  /**
   * QR generato in locale: nessun servizio esterno, quindi la serata funziona
   * anche senza internet. Il template mostra l'URL in chiaro come ripiego.
   */
  qrCodeUrl = signal<string>('');
  private lastQrUrl = '';

  private displayDataInterval?: ReturnType<typeof setInterval>;
  private destroyRef = inject(DestroyRef);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.phase() !== 'IDLE' && this.phase() !== GamePhase.INTRO) {
      $event.returnValue = "Hai una partita in corso!";
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (this.phase() === GamePhase.INTRO) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault();
        this.dismissIntro();
      }
      return;
    }

    const mode = this.currentMode();
    if (!mode || !mode.requiresBuzz) return;

    if (event.key === 'Enter' || event.key === 'ArrowUp') {
      this.confirmCorrect();
    } else if (event.key === 'Escape' || event.key === 'ArrowDown') {
      this.confirmWrong();
    }
  }

  constructor() {
    // Rigenera il QR quando cambia la partita (prima apertura o recupero).
    effect(() => {
      this.currentGameId();
      void this.refreshQrCode();
    });

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

      const auto = this.autoAdvanceSeconds();
      if (auto > 5 || auto === 0) {
        this.lastAutoTick = -1;
      } else if (auto !== this.lastAutoTick) {
        this.lastAutoTick = auto;
        this.audioService.playCountdownTick();
      }
    });
  }

  /** Genera un codice di abbinamento per la regia e lo mostra con la scadenza. */
  async createPairingCode(): Promise<void> {
    const result = await this.reliability.requestPairingCode();
    if (!result) return;
    const expires = new Date(Date.now() + result.ttlSeconds * 1000);
    this.pairingExpiresAt.set(
      expires.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    this.pairingCode.set(result.code);
  }

  async ngOnInit() {
    this.armIntro();

    // La simulazione usa una scaletta dedicata: non tocca la serata vera.
    const params = new URLSearchParams(window.location.search);
    if (params.get('sim') === '1') {
      this.roundManager.enableSimulation();
    }
    // Anteprima rapida (`?sim=1&demo=QUIZ`): la scheda del gioco parte da sola,
    // senza aprire un round e senza chiedere il codice TV, per la pagina sim-duo.
    const demoPreview = params.get('demo');
    if (demoPreview) {
      this.dismissIntro();
      setTimeout(() => this.startDemo(demoPreview), 800);
      return;
    }

    // La partita non è più solo quella dell'ultimo browser: si riparte
    // dall'ID salvato e si chiede al server quale serata è in corso.
    const storedGameId = Number(localStorage.getItem('activeGameId')) || this.currentGameId() || 1;
    this.currentGameId.set(storedGameId);
    this.ws.subscribeToGame(storedGameId);

    // Iscrizione prima di start(): il primo sync può concludersi mentre la
    // sessione si apre e la classifica non deve andare persa.
    this.reliability.syncState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((snapshot: any) => this.applyAuthoritativeState(snapshot));

    if (!await this.reliability.start(storedGameId, 'TV')) return;
    await this.adoptActiveGame();
    this.bindLeaderboardPersistence();

    // Il vincitore del round si conta sui punti guadagnati a round aperto:
    // chi entra a metà o i bonus fra due round restano fuori dal conteggio.
    this.leaderboardService.setPointListener((playerName, points) => {
      if (!this.roundScoring) return;
      this.roundPoints.set(playerName, (this.roundPoints.get(playerName) ?? 0) + points);
      this.persistRoundPoints();
    });
    this.playerAvatars.connect(this.ws);
    void this.refreshLobbyPresence();
    this.presenceTimer = setInterval(() => void this.refreshLobbyPresence(), 5000);
    void this.refreshButtonTests();
    this.buttonTestTimer = setInterval(() => void this.refreshButtonTests(), 2000);
    try {
      const cats = await firstValueFrom(this.gameService.getCategories());
      const positioned = this.generateNonOverlappingPositions(cats);
      this.allCategories.set(positioned);


    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }

    const progress = this.roundManager.getProgress();
    this.roundInfo.set(progress.text);



    const allowAudioOnce = () => {
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

      if (status.action === WsAction.CHRISTMAS_TOGGLE) {
        this.theme.setXmas(!!status.enabled);
        return;
      }

      // Il colore scelto dal telefono prima del tutorial diventa la palette
      // della serata: la TV la adotta e la tiene anche dopo il refresh.
      if (status.action === WsAction.SELECT_THEME && status.theme) {
        // La palette della squadra non colora subito la TV: entra in scena al
        // round dopo, e solo se quella squadra ha vinto il round appena chiuso.
        this.theme.setTeamTheme(status.playerName ?? status.nickname ?? '', status.theme);
        return;
      }

      // 🎤 Debug Log per Urla su Status
      if ((status.action === 'SCREAM_UPDATE' || status.action === 'SCREAM')) {
        console.log('🎤 Urlo ricevuto su STATUS:', status);
      }

      // 🤝 Nuovo giocatore si è unito
      if (status.action === WsAction.JOIN_GAME && status.playerName) {
        const normalizedName = status.playerName.trim();
        // Il telefono si presenta con un identificativo stabile: se rientra
        // cambiando nome è la stessa squadra, con la sua palette e i suoi punti.
        const deviceId = String(status.deviceId ?? '').trim();
        const previousName = deviceId ? this.deviceNames.get(deviceId) : undefined;
        if (previousName && previousName !== normalizedName) {
          this.renameTeam(previousName, normalizedName);
        }
        if (deviceId) this.deviceNames.set(deviceId, normalizedName);
        this.presencePlayers.update((names) => names.includes(normalizedName) ? names : [...names, normalizedName]);
        console.log(`🤝 Nuovo giocatore unito: ${normalizedName}`);
        this.audioService.playJoin();
        // Palette assegnata all'ingresso: chi non sceglie il colore non resta
        // nell'acido uguale a tutti e il tema del round vinto si vede.
        this.theme.ensureTeamTheme(normalizedName);
        this.leaderboardService.addPoints(normalizedName, 0, false);
        // Chi rientra (reload o riconnessione) deve ritrovare la pausa attiva:
        // il telefono la conosce solo dagli annunci della TV.
        const joinedGameId = this.currentGameId();
        if (joinedGameId && this.isPaused()) {
          this.ws.broadcastStatus(joinedGameId, {
            action: WsAction.GAME_PAUSED,
            secondsLeft: this.timer(),
          });
        }
        // Chi rientra deve ritrovare il round o il bonus già disegnato, non
        // solo il cartello di pausa: si ripete l'ultimo stato pubblicato.
        this.republishLiveState();

      }

      // Squadra espulsa dalla regia: sparisce dalla TV, ma i punti già presi
      // restano in classifica perché non si cancellano senza una decisione.
      if (status.action === WsAction.PLAYER_REMOVED && status.playerName) {
        const expelled = String(status.playerName).trim();
        this.presencePlayers.update((names) => names.filter((name) => name !== expelled));
        // La palette torna libera solo se la squadra sparisce anche dalla
        // classifica: chi ha già punti resta in tabella e non può cedere il
        // colore a una squadra nuova.
        if (this.leaderboardService.forgetIfNoPoints(expelled)) {
          this.theme.releaseTeamTheme(expelled);
          this.playerAvatars.forget(expelled);
        }
        // La squadra espulsa esce dal gioco: se lo stesso telefono rientra con
        // un altro nome non deve portarsi dietro i punti che sono rimasti qui.
        for (const [deviceId, playerName] of this.deviceNames) {
          if (playerName === expelled) this.deviceNames.delete(deviceId);
        }
      }

      // 🏟️ Esito Arena calcolato e trasmesso dal backend.
      if (mode?.type === 'ARENA' && status.action === 'ARENA_ANSWER') {
        // Un esito arrivato dopo la chiusura del round non assegna più punti:
        // altrimenti una risposta in ritardo falsava la classifica.
        if (mode.acceptsArenaAnswers && !mode.acceptsArenaAnswers()) return;
        const playerName = (status.playerName || status.name || 'Sconosciuto').trim();
        const isCorrect = !!status.isCorrect;
        // Il server ora assegna +10/-10: usiamo i suoi punti se presenti.
        const points = typeof status.points === 'number' ? status.points : (isCorrect ? 10 : -10);
        console.log(`%c 🏟️ Arena TV -> Risposta rapida: ${playerName} (corretta: ${isCorrect}) `, 'background: #3f51b5; color: #fff;');

        // Un evento già applicato non deve assegnare due volte né movimento né punti.
        const rawSeq = Number(status.eventSeq);
        const eventSeq = Number.isSafeInteger(rawSeq) && rawSeq > 0 ? rawSeq : undefined;
        if (eventSeq && mode.hasArenaAnswer?.(eventSeq)) return;
        // Il piazzamento può chiudere il round durante il movimento: i punti
        // della risposta devono entrare in classifica prima della chiusura.
        this.leaderboardService.addPoints(playerName, points, isCorrect);
        mode.applyArenaAnswer?.(playerName, isCorrect, points, eventSeq);
        this.cdr.detectChanges();
      }

      // 🎯 Quiz: l'esito lo calcola il server, la TV lo applica una volta sola.
      if (mode?.type === 'QUIZ' && status.action === 'QUIZ_ANSWER') {
        if (!mode.applyServerAnswer?.(status)) return;
        const playerName = String(status.playerName ?? '').trim();
        if (!playerName) return;
        this.leaderboardService.addPoints(playerName, Number(status.points) || 0, !!status.isCorrect);
        this.cdr.detectChanges();
      }

      // 🆕 Giochi simultanei: risultati dal server e progressi dai telefoni.
      if (mode && ['TIMELINE_RESULT', 'TIME_BUZZER_ANSWER', 'SPEED_RUSH_PROGRESS', 'SPEED_RUSH_RESULT', 'TENNIS_BATTLE_ANSWER', 'ULTIMA_SPIAGGIA_ACTION', 'AZZARDO_ACTION', 'BLACKJACK_ACTION'].includes(status.action)) {
        mode.handlePartyEvent?.(status);
        this.cdr.detectChanges();
      }

    });

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => {
      if (!status) return;

      if (status.action === 'ADMIN_CONFIRM_CORRECT') {
        this.confirmCorrect();
      } else if (status.action === 'ADMIN_CONFIRM_WRONG') {
        this.confirmWrong();
      } else if (status.action === 'ADMIN_NEXT_ROUND') {
        this.adminNextRound();
      } else if (status.action === WsAction.ADMIN_NEXT_MANCHE) {
        // Canzone: il via alla manche successiva lo decide il presentatore.
        this.currentMode()?.nextManche?.();
      } else if (status.action === WsAction.ADMIN_START_ROUND) {
        // Pulsante unico "Parti": apre il round se la TV è in lobby, altrimenti
        // chiude quello in corso e passa al successivo.
        if (this.currentMode()) this.adminNextRound();
        else void this.startNewRound();
      } else if (status.action === 'ADMIN_REQUEST_STATE') {
        this.sendAdminState();
      } else if (status.action === 'ADMIN_SHOW_LEADERBOARD') {
        this.adminShowLeaderboard();
      } else if (status.action === 'ADMIN_TOGGLE_PAUSE') {
        this.togglePause();
      } else if (status.action === WsAction.ADMIN_SHOW_DEMO) {
        this.startDemo(status.type || this.currentMode()?.type || 'QUIZ');
      } else if (status.action === WsAction.ADMIN_SHOW_INTRO) {
        this.replayIntro();
      } else if (status.action === WsAction.ADMIN_HIDE_DEMO) {
        this.stopDemo();
      } else if (status.action === 'ADMIN_START_BONUS') {
        if (status.type) void this.startBonus(status.type);
      } else if (status.action === 'ADMIN_STOP_BONUS') {
        this.finishBonus();
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
    if (this.introTimer) clearTimeout(this.introTimer);
    if (this.bonusEntranceTimer) clearTimeout(this.bonusEntranceTimer);
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    if (this.buttonTestTimer) clearInterval(this.buttonTestTimer);
    this.leaderboardService.setPointListener(null);
    this.gameModeService.cleanup();
    if (this.displayDataInterval) {
      clearInterval(this.displayDataInterval);
    }
    this.stopDemoTimer();

    this.audioService.stopAll();
    this.audioService.stopAmbient();
  }

  /** Presenze effettive: la classifica può contenere squadre non più collegate. */
  private async refreshLobbyPresence(): Promise<void> {
    if (this.phase() !== 'IDLE' || !this.currentGameId()) return;
    const diagnostics = await this.reliability.diagnostics(this.currentGameId());
    if (!Array.isArray(diagnostics?.presence)) return;
    const names = diagnostics.presence
      .filter((device: any) => device?.connected && device?.role === 'REMOTE' && device?.playerName)
      .map((device: any) => String(device.playerName).trim())
      .filter((name: string) => name.length > 0);
    this.presencePlayers.set(Array.from(new Set<string>(names)));
    this.assignTeamThemes(this.presencePlayers());
    this.forgetAbsentTeams();
  }

  /** Ogni squadra presente ha una palette sua, anche dopo un refresh della TV. */
  private assignTeamThemes(names: string[]): void {
    for (const name of names) this.theme.ensureTeamTheme(name);
  }

  /**
   * Sposta una squadra dal vecchio nome a quello nuovo: presenze, palette,
   * punti in classifica e punti del round restano gli stessi.
   */
  private renameTeam(previousName: string, nextName: string): void {
    this.presencePlayers.update((names) => Array.from(new Set(
      names.map((name) => (name === previousName ? nextName : name)),
    )));
    this.theme.renameTeam(previousName, nextName);
    this.playerAvatars.rename(previousName, nextName);
    this.leaderboardService.renamePlayer(previousName, nextName);

    const roundPoints = this.roundPoints.get(previousName);
    if (roundPoints !== undefined) {
      this.roundPoints.delete(previousName);
      this.roundPoints.set(nextName, (this.roundPoints.get(nextName) ?? 0) + roundPoints);
    }
  }

  /**
   * Toglie dalla classifica le squadre a zero punti non più collegate, ma solo
   * dopo due fotografie consecutive senza: una singola fotografia può essere in
   * ritardo e non vede ancora chi è appena entrato.
   */
  private forgetAbsentTeams(): void {
    const present = new Set(this.presencePlayers().map((name) => name.trim()).filter(Boolean));
    const absent: string[] = [];

    for (const { playerName } of this.leaderboardService.getLeaderboard()) {
      if (present.has(playerName)) {
        this.seenInPresence.add(playerName);
        this.presenceMisses.delete(playerName);
        continue;
      }
      // Mai vista in una fotografia: è appena entrata, non si tocca.
      if (!this.seenInPresence.has(playerName)) continue;

      const misses = (this.presenceMisses.get(playerName) ?? 0) + 1;
      if (misses < PRESENCE_MISSES_BEFORE_FORGET) {
        this.presenceMisses.set(playerName, misses);
        continue;
      }
      this.presenceMisses.delete(playerName);
      this.seenInPresence.delete(playerName);
      absent.push(playerName);
    }

    const removed = this.leaderboardService.forgetAbsent(absent);
    for (const name of removed) {
      this.theme.releaseTeamTheme(name);
      this.playerAvatars.forget(name);
      for (const [deviceId, playerName] of this.deviceNames) {
        if (playerName === name) this.deviceNames.delete(deviceId);
      }
    }
  }

  /** Avanzamento della prova pulsanti, mostrato nella home. */
  private async refreshButtonTests(): Promise<void> {
    if (this.phase() !== 'IDLE' || this.roundManager.getCurrentRound() > 1) return;
    const gameId = this.currentGameId();
    if (!gameId) return;
    try {
      const snapshot = await firstValueFrom(this.buttonTests.snapshot(gameId));
      this.buttonTestSnapshot.set(snapshot);
      const waiting = snapshot.active && snapshot.teams.some((team) => !team.completed);
      if (waiting && Date.now() - this.lastButtonTestPing > 3000) {
        this.lastButtonTestPing = Date.now();
        this.ws.broadcastStatus(gameId, { action: WsAction.BUTTON_TEST_PING, at: this.lastButtonTestPing });
      }
    } catch {
      // Il backend può essere momentaneamente occupato: il prossimo poll riprova.
    }
  }

  /** Rigenera il QR in locale: nessuna chiamata a servizi esterni. */
  private async refreshQrCode(): Promise<void> {
    const url = this.remoteUrl();
    if (url === this.lastQrUrl) return;
    this.lastQrUrl = url;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 800,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#15150f', light: '#ffffff' },
      });
      this.qrCodeUrl.set(dataUrl);
    } catch (error) {
      // Canvas non disponibile: il template mostra l'URL in chiaro.
      console.warn('QR non generato', error);
      this.qrCodeUrl.set('');
    }
  }

  /** Avvia il conto alla rovescia dell'intro, senza ripeterla al refresh. */
  private armIntro(): void {
    if (this.phase() !== GamePhase.INTRO) return;
    this.introReducedMotion.set(
      typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
    this.introDurationMs.set(this.introReducedMotion() ? 1500 : 7800);
    localStorage.setItem(this.introSeenKey, '1');
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => this.dismissIntro(), this.introDurationMs());
  }

  /** Tocco, Invio o fine del conto alla rovescia: si entra nella home. */
  dismissIntro(): void {
    if (this.phase() !== GamePhase.INTRO) return;
    if (this.introTimer) {
      clearTimeout(this.introTimer);
      this.introTimer = undefined;
    }
    localStorage.setItem(this.introSeenKey, '1');
    this.phase.set(this.phaseBeforeIntro);
    this.cdr.detectChanges();
  }

  /** Comando admin: rivede l'intro anche se il browser l'ha già salvata. */
  replayIntro(): void {
    if (this.phase() !== GamePhase.INTRO) {
      this.phaseBeforeIntro = this.phase() as Exclude<TvPhase, typeof GamePhase.INTRO>;
    }
    this.phase.set(GamePhase.INTRO);
    this.armIntro();
    this.cdr.detectChanges();
  }

  async openLobby(): Promise<void> {
    if (this.currentGameId()) return;

    // Partita nuova, palette nuove: le assegnazioni della precedente non valgono più.
    this.theme.resetTeamThemes();
    const newGame = await firstValueFrom(this.gameService.createGame());
    this.currentGameId.set(newGame.id);
    localStorage.setItem('activeGameId', newGame.id.toString());
    this.ws.subscribeToGame(newGame.id);
  }

  /**
   * Apre il conteggio del round: da qui in poi i punti valgono per il vincitore.
   * Fuori da questa finestra (bonus, attese, ingressi a metà) non contano.
   */
  private beginRoundScoring(): void {
    this.roundPoints.clear();
    this.roundScoring = true;
    this.persistRoundPoints();
  }

  /**
   * Il verdetto del round vive in memoria: dopo un refresh va ritrovato, o il
   * tema della TV passerebbe a chi ha fatto punti solo nella seconda parte.
   * Sta in storage con l'indice del round, così un conteggio di un altro round
   * non viene applicato.
   */
  private persistRoundPoints(): void {
    const gameId = this.currentGameId();
    const roundIndex = this.openRoundIndex();
    if (!gameId || roundIndex == null) return;
    try {
      localStorage.setItem(ROUND_POINTS_KEY, JSON.stringify({
        gameId,
        roundIndex,
        points: [...this.roundPoints],
      }));
    } catch {
      // Quota piena: resta la memoria della sessione, che copre il caso comune.
    }
  }

  private restoreRoundPoints(roundIndex: number | null): void {
    const gameId = this.currentGameId();
    if (!gameId || roundIndex == null) return;
    let stored: any = null;
    try {
      stored = JSON.parse(localStorage.getItem(ROUND_POINTS_KEY) ?? 'null');
    } catch {
      return;
    }
    if (!stored || !Array.isArray(stored.points)) return;
    if (Number(stored.gameId) !== gameId || Number(stored.roundIndex) !== roundIndex) return;

    this.roundPoints.clear();
    for (const row of stored.points) {
      if (!Array.isArray(row)) continue;
      const playerName = String(row[0] ?? '').trim();
      const points = Number(row[1]);
      if (!playerName || !Number.isFinite(points) || points <= 0) continue;
      this.roundPoints.set(playerName, points);
    }
    // Il round è di nuovo aperto: i punti che arrivano ora si sommano.
    this.roundScoring = true;
  }

  /**
   * Indice 0-based del round aperto, preso dalla scaletta.
   *
   * `startNewRound` incrementa `currentRound` all'apertura e `completeRound`
   * non lo tocca: il round in corso è quindi `currentRound - 1`. Non si usa
   * `round().roundIndex`, che dopo un refresh può essere ancora quello della
   * fotografia precedente (o mancare del tutto) e sposterebbe il conteggio su
   * un altro round.
   */
  private openRoundIndex(): number | null {
    const index = this.roundManager.getCurrentRound() - 1;
    return index >= 0 ? index : null;
  }

  /**
   * Atto della serata (1–5) del round aperto: decide la base d'atto e i file
   * da caricare. Prima del primo round si resta sull'atto 1, come la lobby.
   */
  private currentActNumber(): number {
    return Math.floor((this.openRoundIndex() ?? 0) / ROUNDS_PER_ACT) + 1;
  }

  private clearPersistedRoundPoints(): void {
    try {
      localStorage.removeItem(ROUND_POINTS_KEY);
    } catch {
      // Storage non disponibile: niente da pulire.
    }
  }

  /**
   * Chiude il conteggio e memorizza il tema del vincitore. Vince chi ha fatto
   * più punti DENTRO il round: il totale in classifica non c'entra, così chi
   * entra a metà o incassa un bonus fra due round non falsa il colore della TV.
   */
  private settleRoundWinner(): void {
    if (!this.roundScoring) return;
    this.roundScoring = false;

    let best = 0;
    let winner: string | null = null;
    let tie = false;

    for (const [name, points] of this.roundPoints) {
      if (points <= 0) continue;
      if (points > best) {
        best = points;
        winner = name;
        tie = false;
      } else if (points === best) {
        tie = true;
      }
    }

    this.roundWinnerTheme = winner && !tie ? this.theme.themeForTeam(winner) : null;
    this.roundPoints.clear();
    // Verdetto assegnato: un refresh non deve riassegnarlo a un altro round.
    this.clearPersistedRoundPoints();
  }

  /** La TV parte in acido e adotta il tema del round precedente, se c'è stato un vincitore. */
  private applyRoundWinnerTheme(): void {
    this.theme.applyFromRemote(this.roundWinnerTheme ?? 'editorial-acid');
    this.roundWinnerTheme = null;
  }

  /**
   * Rullo da slot machine: i nomi delle categorie scorrono per `durationMs`,
   * poi il nastro si ferma sulla scelta. Serve a dare suspense all'estrazione,
   * non è decorazione: senza si passa dal buio alla domanda.
   */
  private async rollSlot(
    pool: ReadonlyArray<{ id: number; name?: string }>,
    durationMs = 5000,
  ): Promise<void> {
    const names = pool
      .map((category) => String(category.name ?? '').trim())
      .filter((name) => name.length > 0);
    if (names.length === 0) return;

    this.slotRolling.set(true);
    const startedAt = Date.now();
    let index = 0;
    while (Date.now() - startedAt < durationMs) {
      this.slotRollName.set(names[index % names.length]);
      index += 1;
      await new Promise((resolve) => setTimeout(resolve, 90));
    }

    const chosen = pool.find((category) => category.id === this.selectedCategoryId())?.name;
    this.slotRollName.set(String(chosen ?? names[0]));
    this.slotRolling.set(false);
  }

  async startNewRound() {
    if (this.phase() === GamePhase.INTRO) this.dismissIntro();

    // Un round nuovo deve poter partire anche con la classifica a schermo:
    // altrimenti la TV resta bloccata sulla classifica e la regia non riesce
    // più ad andare avanti.
    if (this.isShowingLeaderboard()) this.closeLeaderboard();

    if (this.isSpinning()) return;
    this.cancelAutoAdvance();

    if (this.roundManager.isGameOver()) {
      alert('🏁 Partita completata! Resetta per ricominciare.');
      return;
    }

    this.reset();
    this.revealPending.set(false);
    this.settleRoundWinner();
    this.applyRoundWinnerTheme();

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
      const categories = this.allCategories();
      const categoryName = this.getCategoryForType(extractedType);
      const selectedCategory = categories.find(c => c.name === categoryName);
      if (selectedCategory) this.selectedCategoryId.set(selectedCategory.id);

      // Anche il Black Jack passa dal backend: così il round entra nello stato
      // autorevole (roundIndex, evento ROUND_STARTED, snapshot) come tutti gli
      // altri giochi. Mazzo e banco restano nel mode della TV, il payload è
      // solo la configurazione del round.
      const nextRound: any = await firstValueFrom(
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
      this.rememberServerRoundIndex(nextRound?.roundIndex);

      // La categoria dell'animazione a bolle deve essere quella reale del payload:
      // per Ultima spiaggia il backend sceglie la categoria dell'occorrenza.
      const payloadCategory = String(parsedPayload?.category ?? '').trim();
      if (payloadCategory) {
        const selected = categories.find((category) =>
          String(category.name).trim().toLowerCase() === payloadCategory.toLowerCase()
        );
        if (selected) this.selectedCategoryId.set(selected.id);
      }

      let activePlayers = this.leaderboardService.getLeaderboard().map(p => p.playerName);
      // Anche chi ha 0 punti (o è appena entrato) deve giocare: unisco la
      // classifica con i telefoni presenti sul backend. Altrimenti Bomba e
      // gli altri mode a squadre partono con un solo nome dopo un reset e il
      // server li rifiuta ("servono almeno 2 squadre").
      try {
        const diagnostics = await this.reliability.diagnostics(this.currentGameId()!);
        const deviceRows = Array.isArray(diagnostics?.presence)
          ? diagnostics.presence
          : Array.isArray(diagnostics?.devices)
            ? diagnostics.devices
            : Array.isArray(diagnostics?.devices?.devices)
              ? diagnostics.devices.devices
              : [];
        const presentPlayers = deviceRows
          .filter((device: any) => device?.playerName
            && (device.role === 'REMOTE' || device.role === 'TV'))
          .map((device: any) => String(device.playerName).trim())
          .filter((playerName: string) => playerName.length > 0);
        this.presencePlayers.set(presentPlayers);
        this.assignTeamThemes(presentPlayers);
        activePlayers = Array.from(new Set([...activePlayers, ...presentPlayers]));
      } catch {
        // Senza diagnostica si gioca con la classifica: meglio che niente.
      }

      const mode = this.gameModeService.createMode(
        this.buildModeConfig(parsedPayload.type || extractedType, parsedPayload, activePlayers),
      );

      this.currentMode.set(mode);
      // L'atto decide la base e i file da tenere in memoria; il gioco, se ha
      // un loop suo, prende il posto della base.
      this.audioService.setActBed(this.currentActNumber());
      this.audioService.setGameBed(mode.type);

      if (mode.requiresBubbles && categories.length > 0) {
        const bubblePool = this.bubbleCategories();
        const randomIndex = Math.floor(Math.random() * bubblePool.length);
        this.animatedCategoryId.set(bubblePool[randomIndex].id);

        this.bubblesDismissed.set(false);
        this.phase.set('SPINNING');
        // Prima le bolle girano sul tabellone, poi parte il rullo da slot.
        await new Promise(r => setTimeout(r, 2600));
        // Da qui le bolle non tornano più: il rullo le sostituisce e resta
        // a schermo fino alla categoria estratta, senza pause intermedie.
        this.bubblesDismissed.set(true);
        await this.rollSlot(bubblePool);

        // Il rullo si ferma sulla categoria scelta, poi resta a schermo
        // come titolo sopra la domanda.
        this.phase.set('SELECTED');
        this.animatedCategoryId.set(this.selectedCategoryId());
        await new Promise(r => setTimeout(r, 1600));
      }

      this.phase.set('QUESTION');
      this.showQuestion.set(true);
      // Il pannello RISPOSTE mostra il round in corso: senza azzerarlo
      // accumulava le risposte di tutta la serata e ne tagliava sei.
      this.ws.clearResponses();
      this.timer.set(mode.timerDuration);
      this.beginRoundScoring();

      const safeData = this.getSafeDisplayData();
      const payloadString = JSON.stringify(safeData);
      const rawPayloadString = typeof nextRound.payload === 'string'
        ? nextRound.payload
        : JSON.stringify(nextRound.payload);

      this.ws.broadcastStatus(this.currentGameId()!, {
        action: WsAction.SHOW_QUESTION,
        type: parsedPayload.type || extractedType,
        payload: payloadString,
        rawPayload: rawPayloadString,
        round: this.roundManager.getCurrentRound(),
        roundTotal: this.roundManager.getTotalRounds(),
      });


      if (mode.timerDuration > 0) this.audioService.startClock();
      this.startRoundSuspense(mode.type);
      if (mode.type === 'BOMBA') {
        this.audioService.playBombSiren();
        // Miccia sotto la sirena: la TV fa sentire che la bomba è accesa.
        this.audioService.playFuse();
      }

      await mode.start();

      this.ws.broadcastStatus(this.currentGameId()!, {
        action: WsAction.START_VOTING,
        type: parsedPayload.type || extractedType,
        payload: payloadString,
        rawPayload: rawPayloadString,
        round: this.roundManager.getCurrentRound(),
        roundTotal: this.roundManager.getTotalRounds(),
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


  /**
   * Configurazione comune a un round: la usano sia l'apertura normale sia la
   * ripresa dopo un refresh, così i due percorsi non possono divergere.
   */
  private buildModeConfig(type: GameModeType, payload: any, activePlayers: string[]): GameModeConfig {
    return {
      type,
      payload,
      gameId: this.currentGameId() ?? 1,
      onTimerTick: (seconds) => this.timer.set(seconds),
      onTimerEnd: () => this.onModeTimeout(),
      onBuzz: (playerName) => this.onPlayerBuzz(playerName),
      // La domanda di Quiz e Indovina chi tiene la base d'atto 6 dB sotto.
      onQuestionOpenChange: (open) => this.audioService.setQuestionActive(open),
      activePlayers: activePlayers,
      onCountdownTick: (seconds) => this.onCountdownTick(seconds),
      onPlayerEliminated: (playerName) => this.onArenaEliminated(playerName),
      onRoundEnded: () => this.onArenaEnded(),
      onTvCheckpoint: (checkpoint) => {
        const roundIndex = this.tvRoundIndex();
        if (roundIndex == null) return;
        this.reliability.saveTvCheckpoint({
          mode: checkpoint.type,
          revision: checkpoint.revision,
          state: checkpoint.state,
          roundIndex,
        });
      },
      onArenaInactivityCheck: async (players: string[]) => {
        const response = await firstValueFrom(
          this.gameService.tickArenaInactivity(this.currentGameId()!, players),
        );
        return Array.isArray(response?.penalties) ? response.penalties : [];
      },
      onBroadcast: (event: any) => this.ws.broadcastStatus(this.currentGameId()!, event),
      onBlackjackState: (state: unknown | null) => this.reliability.saveBlackjackState(state),
      onUltimaSpiaggiaLevel: (playerName: string, level: number) => {
        // Il livello è consumato per tutta la partita, non solo per la manche:
        // la prossima occorrenza lo legge dal backend e non lo ripropone.
        this.gameService.recordUltimaSpiaggiaLevel(this.currentGameId()!, playerName, level)
          .subscribe({
            error: (err) => console.error('❌ Registrazione livello Ultima spiaggia:', err),
          });
      },
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
      loadTennisQuestions: async (difficulty: string) => {
        const rows = await firstValueFrom(
          this.gameService.getTennisQuestions(this.currentGameId()!, difficulty, 12),
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
      startSpeedRush: async (players: string[]) => firstValueFrom(
        this.gameService.startSpeedRush(this.currentGameId()!, players),
      ),
      finishSpeedRush: async () => {
        const response = await firstValueFrom(this.gameService.finishSpeedRush(this.currentGameId()!));
        return Array.isArray(response?.results) ? response.results : [];
      },
      startQuizManche: async (manche: number, secondsLeft?: number) => firstValueFrom(
        this.gameService.startQuizManche(this.currentGameId()!, manche, secondsLeft),
      ),
      loadQuizAnswers: async () => firstValueFrom(this.gameService.quizAnswers(this.currentGameId()!)),
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
    };
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
        // Ultima spiaggia estrae una categoria per occorrenza: servono cinque
        // domande della stessa categoria, una per livello.
        return this.pickCategoryName();
      case 'TIME_BUZZER':
      case 'AZZARDO':
      case 'BLACKJACK':
      case 'BOMBA':
      case 'SPEED_RUSH':
      case 'TENNIS_BATTLE':
        return 'CULTURA GENERALE';
      default:
        return this.pickCategoryName();
    }
  }

  /**
   * Categorie già uscite nella serata. Il caso puro faceva uscire Storia molto
   * più spesso delle altre: si sceglie tra quelle uscite meno, poi a caso.
   */
  private categoryUses = new Map<string, number>();

  private pickCategoryName(): string {
    return this.pickFairCategory(this.allCategories());
  }

  private pickTimelineCategoryName(): string {
    const categories = this.allCategories().filter((category) => category.timeline);
    if (categories.length === 0) return this.pickFairCategory(this.allCategories());
    return this.pickFairCategory(categories);
  }

  private pickFairCategory(pool: ReadonlyArray<{ name: string }>): string {
    if (pool.length === 0) return 'CULTURA GENERALE';
    const uses = (name: string): number => this.categoryUses.get(name) ?? 0;
    const minimum = Math.min(...pool.map((category) => uses(category.name)));
    const leastUsed = pool.filter((category) => uses(category.name) === minimum);
    const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)];
    this.categoryUses.set(chosen.name, uses(chosen.name) + 1);
    return chosen.name;
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
      case 'BIGLIE':
        return 'BIGLIE';
      case 'BOMBA':
        return 'BOMBA';
      case 'SPEED_RUSH':
        return 'SPEED RUSH';
      case 'TENNIS_BATTLE':
        return 'TENNIS BATTLE';
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

  /**
   * Biglie: ogni gara versa i punti appena taglia il traguardo. Il round si
   * chiude solo alla fine della finale, quando il componente emette `finished`.
   */
  private onBiglieRoundResult(event: { playerName: string; score: number }): void {
    const playerName = String(event?.playerName ?? '').trim();
    const points = Number(event?.score) || 0;
    if (!playerName || points === 0) return;
    this.leaderboardService.addPoints(playerName, points, points > 0);
  }

  private finishBiglieRound(): void {
    const mode = this.currentMode();
    if (!mode || mode.type !== 'BIGLIE') return;

    mode.stop();
    this.audioService.stopClock();
    this.audioService.stopSuspense();
    this.audioService.playPodium();
    this.isSpinning.set(false);

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({ ...currentRound, status: GamePhase.REVEAL });
    }

    this.ws.broadcastStatus(this.currentGameId()!, { action: WsAction.ROUND_ENDED });
    this.roundManager.completeRound('BIGLIE');
    // Round chiuso: lo stato salvato non deve riaprire una gara già pagata.
    this.biglieResume.set(null);
    this.checkLeaderboardDisplay();
  }

  /** Round di serata (0-based) del Biglie aperto: decide le due piste del round. */
  biglieRoundIndex(): number {
    return this.tvRoundIndex() ?? 0;
  }

  /** Le Biglie salvano gare chiuse e classifica: un refresh non rigioca i punti. */
  onBiglieCheckpoint(state: any): void {
    const roundIndex = this.tvRoundIndex();
    if (!state || roundIndex == null) return;
    this.reliability.saveTvCheckpoint({
      mode: 'BIGLIE',
      revision: Date.now(),
      state,
      roundIndex,
    });
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
    this.audioService.playTimeUp();
    this.isSpinning.set(false);

    // Il reveal non è mai simultaneo alla scadenza: la TV mostra il battito
    // di suspense, poi arriva la soluzione.
    this.revealPending.set(true);
    setTimeout(() => {
      this.revealPending.set(false);

      const currentRound = this.round();
      if (currentRound) {
        this.round.set({ ...currentRound, status: GamePhase.REVEAL });
      }

      if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
        this.showTimeoutPopup();
      }

      this.audioService.playReveal();
      this.ws.broadcastStatus(this.currentGameId()!, { action: WsAction.ROUND_ENDED });
      this.roundManager.completeRound(mode.type);
      this.checkLeaderboardDisplay();
    }, REVEAL_DELAY_MS);
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
    // Il brano pulito parte subito: la conferma non deve più aspettare una
    // intro filtrata di quattro secondi.
    this.audioService.playCorrect();

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
      // Musica: sotto la canzone pulita non parte il rullo del reveal, che
      // coprirebbe proprio i primi secondi del brano.
      if (mode.type !== 'MUSIC') this.audioService.playReveal();
    }, 3000);


    this.roundManager.completeRound(mode.type);


    this.checkLeaderboardDisplay();
  }

  /**
   * La canzone del reveal è finita: si può passare al round successivo. Se è
   * in corso una classifica, resta il presentatore a chiuderla.
   */
  musicPlaybackEnded(): void {
    if (this.currentMode()?.type !== 'MUSIC') return;
    if (this.isShowingLeaderboard()) return;
    this.adminNextRound();
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
    // Il round è chiuso: il verdetto si calcola adesso, prima che parta il bonus.
    this.settleRoundWinner();
    this.audioService.stopAll();

    // Bonus sparso: se questo round è uno dei cinque slot della serata, il
    // bonus parte subito, senza aspettare la classifica di fine atto.
    if (this.startScheduledBonus()) return;

    const leaderboardType = this.roundManager.shouldShowLeaderboard();

    if (leaderboardType) {
      this.pendingLeaderboardType.set(leaderboardType);
      this.showPendingLeaderboard();
      return;
    }

    // Fra un round e l'altro si avanza a mano: il conto alla rovescia esiste
    // solo per ripartire dopo il riepilogo di un bonus.
  }

  /** Chiude subito la classifica a schermo: la X in TV o un avanzamento admin. */
  closeLeaderboard(): void {
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    this.isShowingLeaderboard.set(false);
    this.pendingLeaderboardType.set(null);
    // Serata finita: il sottofondo torna al pub, non alla musica dell'ultimo gioco.
    this.audioService.setGameBed(
      this.roundManager.isGameOver() ? null : this.currentMode()?.type ?? null,
    );
  }

  showPendingLeaderboard() {
    const type = this.pendingLeaderboardType();
    this.pendingLeaderboardType.set(null);
    if (!type) return;

    this.isShowingLeaderboard.set(true);
    this.theme.applyFromRemote('editorial-acid');
    // Classifica e podio cambiano disco: l'ultima della serata ha il suo loop,
    // le altre la fanfara della classifica.
    this.audioService.setBedLoop(this.roundManager.isGameOver() ? 'gioco-casino-finale' : 'classifica');
    this.showLeaderboardQuick.set(type === 'QUICK');
    this.showLeaderboardDetailed.set(type === 'DETAILED');
  }

  onLeaderboardComplete() {
    // Manuale: la classifica resta in TV finché l'admin non avanza.
    if (this.phase() === 'IDLE') {
      this.audioService.startHeartbeat();
    }
  }

  /**
   * Bonus del round appena chiuso: parte una volta sola per atto, anche dopo un
   * refresh. Il server sa se quel bonus è già stato chiuso e pagato.
   */
  private startScheduledBonus(): boolean {
    const bonus = this.roundManager.bonusAfterRound();
    if (!bonus || !this.canStartBonus()) return false;

    const act = this.roundManager.bonusActIndex();
    if (act < 0) return false;
    if (this.closedBonusActsOf(this.currentGameId()).has(act)) return false;
    // Un bonus già segnato sul server (avviato in questa schermata o prima di
    // un refresh) non riparte da capo: la ripresa la gestisce `offerBonusRecovery`.
    if (this.serverBonus?.act === act) return false;

    void this.startBonus(bonus);
    return true;
  }

  private closingRound = false;

  adminNextRound(): void {
    if (this.closingRound) return;
    this.cancelAutoAdvance();

    const advance = () => {
      // Anche quando il round si salta senza classifica il verdetto si chiude
      // qui: altrimenti i punti del bonus successivo entrerebbero nel conteggio.
      this.settleRoundWinner();
      this.showLeaderboardQuick.set(false);
      this.showLeaderboardDetailed.set(false);
      this.isShowingLeaderboard.set(false);
      this.pendingLeaderboardType.set(null);
      this.stopDemo();
      void this.startNewRound();
    };
    const gameId = this.currentGameId();
    const mode = this.currentMode();
    // AVANTI durante un round ancora aperto: prima si chiude il round sul
    // server, poi si apre il successivo. Senza questa chiusura il backend
    // restava sul gioco saltato e il round dopo partiva con un indice sfasato.
    const roundStillOpen = !!gameId && !!mode && !mode.isRevealed() && !this.closingRound;
    if (!roundStillOpen) {
      advance();
      return;
    }

    this.closingRound = true;
    this.gameService.closeRound(gameId, 'skipped').subscribe({
      next: () => {
        this.closingRound = false;
        advance();
      },
      error: () => {
        this.closingRound = false;
        alert('Chiusura del round non confermata: verifica lo stato del server prima di riprovare AVANTI.');
      },
    });
  }

  /**
   * L'admin può perdere la socket mentre il round è già aperto. Quando torna
   * online chiede lo stato alla TV: questo evento è per lui solo, così i
   * telefoni non vengono rimessi in attesa e non perdono la prenotazione.
   */
  private sendAdminState(): void {
    const mode = this.currentMode();
    const gameId = this.currentGameId();
    if (!mode || !gameId || !this.showQuestion()) return;

    const payload = JSON.stringify(this.getSafeDisplayData());
    const raw = this.currentRoundPayload();
    const rawPayload = typeof raw === 'string' ? raw : JSON.stringify(raw ?? this.getSafeDisplayData());
    const display = mode.getDisplayData();
    const player = display?.buzzedPlayer ?? null;
    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);

    this.ws.broadcastStatus(gameId, {
      action: WsAction.ADMIN_STATE,
      type: mode.type,
      payload,
      rawPayload,
      buzzedPlayer: player,
      correctPoints: player ? mode.pointsFor(true, elapsedMs) : null,
      wrongPoints: player ? mode.pointsFor(false, elapsedMs) : null,
      solution: this.solutionFor(mode.type, raw),
      scoring: scoringRuleFor(mode.type),
      paused: this.isPaused(),
    });
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
    // Anche la classifica forzata dalla regia ha il suo loop; a serata finita
    // è quello del finale.
    this.audioService.setBedLoop(this.roundManager.isGameOver() ? 'gioco-casino-finale' : 'classifica');

    if (type === 'DETAILED') {
      this.showLeaderboardQuick.set(false);
      this.theme.applyFromRemote('editorial-acid');
      this.showLeaderboardDetailed.set(true);
    } else {
      this.showLeaderboardDetailed.set(false);
      this.theme.applyFromRemote('editorial-acid');
      this.showLeaderboardQuick.set(true);
    }
  }

  togglePause() {
    this.cancelAutoAdvance();
    const mode = this.currentMode();

    if (this.isPaused()) {
      // La ripresa vale anche senza round né bonus: se il bonus si chiude
      // mentre la sala è ferma, l'overlay non deve restare appeso.
      if (mode) {
        this.syncPauseToServer(false);
        mode.resume();
      }
      this.isPaused.set(false);
      // Il clock era stato fermato alla pausa: si riapre solo se il round ha
      // ancora un conto alla rovescia da suonare, e il sottofondo riparte.
      if (mode) {
        this.audioService.startClock();
        this.resumeRoundSuspense();
      }
      this.audioService.resumeBeds();
      this.ws.broadcastStatus(this.currentGameId()!, { action: WsAction.GAME_RESUMED });
      // A sala ferma i telefoni non ricevono tick: lo stato va ripetuto subito
      // dopo il via, così chi si era ricollegato ritrova il gioco.
      this.republishLiveState();
    } else {
      // Anche un bonus è un momento della serata: la pausa vale pure lì, dove
      // non esiste una modalità di round da fermare sul server.
      if (!mode && !this.bonusActive()) return;
      // Pausa vera anche per l'audio: niente tick, battito né sottofondo
      // mentre la sala aspetta, altrimenti la musica va avanti a gioco fermo.
      this.audioService.stopClock();
      this.audioService.stopSuspense();
      this.audioService.pauseBeds();
      if (mode) {
        this.syncPauseToServer(true);
        mode.pause();
      }
      this.isPaused.set(true);
      // La fotografia si salva qui, non a ogni tick: se la TV si riavvia in
      // pausa, il telefono che rientra deve ritrovare il gioco da questo stato.
      this.ws.persistLastStates();
      this.ws.broadcastStatus(this.currentGameId()!, {
        action: WsAction.GAME_PAUSED,
        secondsLeft: this.timer(),
      });
    }
  }

  /** Bonus: parte dalla TV dopo il round dello slot (o su comando admin) e non consuma un round. */
  /** Un bonus può partire solo se non ce n'è già uno in scena. */
  private canStartBonus(): boolean {
    return !this.bonusEntrance() && !this.bonusActive() && !this.isSpinning();
  }

  async startBonus(type: BonusType, resume: any = null): Promise<void> {
    if (!BONUS_TYPES.includes(type) || !this.canStartBonus()) return;
    this.bonusResume.set(resume);
    // Il bonus dell'atto resta sul server: un refresh non lo salta.
    this.markBonusAct(type, 'STARTED');

    // Un bonus è fuori dal round: chiude il conteggio se era ancora aperto.
    this.settleRoundWinner();
    this.bonusEntrance.set(type);
    this.audioService.setGameBed(type);
    this.audioService.playBonusEntrance(type);
    this.bonusEntranceTimer = setTimeout(() => {
      this.bonusEntrance.set(null);
      this.bonusEntranceTimer = undefined;
      void this.beginBonus(type);
    }, resume ? 600 : 2600);
  }

  private async beginBonus(type: BonusType): Promise<void> {
    if (this.isSpinning() || this.bonusActive()) return;
    // Un bonus può partire subito dopo un reset, quando la classifica è
    // vuota: allinea i tavoli ai telefoni presenti prima di disegnare il bonus.
    const bonusGameId = this.currentGameId();
    if (bonusGameId) {
      try {
        const diagnostics = await this.reliability.diagnostics(bonusGameId);
        const rows = Array.isArray(diagnostics?.presence) ? diagnostics.presence : [];
        this.presencePlayers.set(rows
          .filter((device: any) => device?.playerName
            && (device.role === 'REMOTE' || device.role === 'TV'))
          .map((device: any) => String(device.playerName).trim())
          .filter((playerName: string) => playerName.length > 0));
        this.assignTeamThemes(this.presencePlayers());
      } catch {
        // Senza diagnostica restano i nomi della classifica.
      }
    }

    this.cancelAutoAdvance();
    this.showLeaderboardQuick.set(false);
    this.showLeaderboardDetailed.set(false);
    this.isShowingLeaderboard.set(false);
    this.pendingLeaderboardType.set(null);
    // La pausa letta dal checkpoint deve sopravvivere al reset del bonus.
    const paused = this.isPaused();
    this.reset();
    if (paused) {
      this.isPaused.set(true);
      this.audioService.pauseBeds();
    }

    this.bonusActive.set(true);
    this.bonusType.set(type);
    this.bonusAwarded = false;
    this.bonusScoresMap.clear();
    this.bonusResult.set([]);
    this.bonusVouchers.set([]);
    this.bonusShowResult.set(false);

    if (!this.currentGameId()) {
      const game = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(game.id);
      this.ws.subscribeToGame(game.id);
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

    // Il Blackjack bonus riusa il tavolo della TV e lo stato BLACKJACK_STATE:
    // un solo turno per tavolo, dal fondo della classifica.
    if (type === 'BLACKJACK') {
      const publicPayload = JSON.stringify({ type: 'BLACKJACK', question: BONUS_LABELS[type] });
      this.ws.broadcastStatus(this.currentGameId(), {
        action: WsAction.SHOW_QUESTION,
        type: 'BLACKJACK',
        payload: publicPayload,
        rawPayload: publicPayload,
      });
      return;
    }

    // Le tre varianti Casino usano la stessa ruota e una sola manche: il
    // telefono riceve sempre BONUS_CASINO e sceglie dalla griglia giusta.
    if (CASINO_BONUS_TYPES.includes(type)) {
      const publicPayload = JSON.stringify({ type: 'BONUS_CASINO', question: BONUS_LABELS[type] });
      this.ws.broadcastStatus(this.currentGameId(), {
        action: WsAction.SHOW_QUESTION,
        type: 'BONUS_CASINO',
        payload: publicPayload,
        rawPayload: publicPayload,
      });
    }
  }

  /** I bonus sommano i punti delle manche: la classifica li incassa alla chiusura. */
  private recordBonusResult(playerName: string, score: number): void {
    const name = String(playerName || '').trim();
    if (!name) return;

    const value = Number.isFinite(score) ? score : 0;
    const previous = this.bonusScoresMap.get(name) ?? 0;
    this.bonusScoresMap.set(name, previous + value);
  }

  private finishBonus(): void {
    if (this.bonusEntrance()) {
      if (this.bonusEntranceTimer) clearTimeout(this.bonusEntranceTimer);
      this.bonusEntranceTimer = undefined;
      this.bonusEntrance.set(null);
      return;
    }
    if (!this.bonusActive() || this.bonusAwarded) return;
    this.bonusAwarded = true;
    this.clearBonusTimer();
    // Il bonus è chiuso: il checkpoint non deve riaprirlo al prossimo refresh.
    const closed = this.bonusType();
    if (closed) {
      this.reliability.saveTvCheckpoint({
        mode: `BONUS_${closed}`,
        roundIndex: -1,
        revision: Date.now(),
        state: null,
      });
      this.markBonusAct(closed, 'CLOSED');
      // Pagato: nemmeno uno snapshot vecchio deve riaprirlo.
      this.rememberClosedBonus(this.currentGameId(), this.roundManager.bonusActIndex());
      // La mano del Blackjack bonus non deve tornare sul tavolo chiuso.
      if (closed === 'BLACKJACK') this.reliability.saveBlackjackState(null);
    }
    this.bonusResume.set(null);

    const ranking = [...this.bonusScoresMap.entries()]
      .map(([playerName, score]) => ({ playerName, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // I punti del bonus entrano in classifica una sola volta, alla chiusura:
    // così un risultato arrivato in ritardo non può pagare due volte.
    for (const [playerName, score] of this.bonusScoresMap) {
      if (score > 0) this.leaderboardService.addPoints(playerName, score, true);
    }

    this.bonusResult.set(ranking);
    this.bonusShowResult.set(true);

    this.ws.broadcastStatus(this.currentGameId(), {
      action: WsAction.BONUS_ENDED,
      ranking,
    });

    this.bonusActive.set(false);
    this.currentMode.set(null);
    this.audioService.setGameBed(null);
    this.showQuestion.set(false);
    this.phase.set('QUESTION');

    // Il tipo resta per il riepilogo; non azzerarlo se nel frattempo parte un altro bonus.
    const closedAtRound = this.roundManager.getCurrentRound();
    setTimeout(() => {
      if (this.bonusActive()) return;
      this.bonusShowResult.set(false);
      this.bonusType.set(null);
      // La regia ha già avanzato: il round è cambiato, niente secondo salto.
      if (this.roundManager.getCurrentRound() !== closedAtRound) return;
      // Il bonus vive dentro l'atto: chiuso il riepilogo si riprende la
      // scaletta dal round successivo, senza una seconda classifica.
      if (!this.currentMode() && !this.isShowingLeaderboard() && !this.roundManager.isGameOver()) {
        this.startAutoAdvance();
      }
    }, 8000);
  }

  /** La mano del Blackjack bonus vive sul server: un refresh non la perde. */
  onBlackjackBonusCheckpoint(state: any): void {
    if (!state) return;
    this.reliability.saveBlackjackState(state);
  }

  /** Il Casino salva voti e numero uscito: un refresh non li perde. */
  onBonusCheckpoint(type: BonusType, state: any): void {
    if (!state) return;
    this.reliability.saveTvCheckpoint({
      mode: `BONUS_${type}`,
      roundIndex: -1,
      revision: Date.now(),
      state,
    });
  }

  /**
   * Bonus interrotto da un refresh: si riapre quello che il server sa ancora
   * avviato per l'atto corrente. Il Casino riparte dal checkpoint (voti,
   * numero uscito, punti); gli altri ripartono dall'inizio, invece di essere
   * saltati in silenzio.
   */
  private offerBonusRecovery(snapshot: any): void {
    if (this.currentMode() || this.bonusActive() || this.bonusEntrance() || this.isSpinning()) return;
    // Un round ancora aperto ha la precedenza: il bonus viene dopo.
    if (this.recoveredRound()) return;
    // Un bonus già chiuso e pagato non torna, anche se il server dice STARTED.
    if (this.closedBonusActsOf(this.currentGameId()).has(this.roundManager.bonusActIndex())) return;

    const checkpoint = snapshot?.tvCheckpoint;
    const mode = String(checkpoint?.mode ?? '');
    const resume = checkpoint?.state && mode.startsWith('BONUS_') ? checkpoint.state : null;
    // Il Blackjack bonus non usa il checkpoint TV: riprende la mano del server.
    const blackjackHand = snapshot?.blackjackState ?? null;

    let type: BonusType | null = null;
    if (this.serverBonus?.status === 'STARTED'
      && this.serverBonus.act === this.roundManager.bonusActIndex()
      && (BONUS_TYPES as readonly string[]).includes(this.serverBonus.type)) {
      type = this.serverBonus.type as BonusType;
    } else if (resume) {
      // Senza il segno sul server, vale ancora il checkpoint del Casino.
      const fromCheckpoint = mode.slice('BONUS_'.length) as BonusType;
      if (CASINO_BONUS_TYPES.includes(fromCheckpoint)) type = fromCheckpoint;
    }
    if (!type) return;
    const state = resume && mode === `BONUS_${type}`
      ? resume
      : (type === 'BLACKJACK' ? blackjackHand : null);
    // La pausa era nella sala al momento del refresh: si torna con la sala ferma.
    if (snapshot?.paused === true || state?.paused === true) this.isPaused.set(true);
    void this.startBonus(type, state);
  }

  /**
   * Bonus dell'atto già chiusi e pagati in questa partita. Sta in storage perché
   * la scrittura sul server può arrivare dopo uno snapshot stantio: il denaro
   * dei bonus non si rigioca per una risposta fuori ordine.
   */
  private closedBonusActsOf(gameId: number | null): Set<number> {
    const acts = new Set<number>();
    if (!gameId) return acts;
    try {
      const raw = JSON.parse(localStorage.getItem(`bonusClosed:${gameId}`) ?? '[]');
      if (Array.isArray(raw)) {
        for (const value of raw) {
          const act = Number(value);
          if (Number.isInteger(act) && act >= 0) acts.add(act);
        }
      }
    } catch {
      // Storage illeggibile: si riparte senza memoria, come prima.
    }
    return acts;
  }

  private rememberClosedBonus(gameId: number | null, act: number): void {
    if (!gameId || act < 0) return;
    const acts = this.closedBonusActsOf(gameId);
    acts.add(act);
    try {
      localStorage.setItem(`bonusClosed:${gameId}`, JSON.stringify([...acts]));
    } catch {
      // Quota piena: resta la memoria della sessione, che copre il caso comune.
    }
  }

  /** Segna sul server il bonus dell'atto del round appena chiuso. */
  private markBonusAct(type: BonusType, status: 'STARTED' | 'CLOSED'): void {
    const act = this.roundManager.bonusActIndex();
    if (act < 0) return;
    this.serverBonus = { act, type, status };
    this.reliability.saveBonusAct({ act, type, status });
  }

  /** Giocatori in classifica + telefoni presenti, usati dai bonus. */
  bonusPlayers(): string[] {
    const ranked = this.leaderboardService.getLeaderboard().map((player) => player.playerName);
    return Array.from(new Set([...ranked, ...this.presencePlayers()]));
  }

  bonusLabel(): string {
    const type = this.bonusType();
    return type ? BONUS_LABELS[type] : 'BONUS';
  }

  onBonusResult(event: { playerName: string; score: number }): void {
    this.recordBonusResult(event?.playerName, Number(event?.score) || 0);
  }

  /**
   * Un buono si consegna in sala: il codice lo genera il server, che lo salva.
   * La TV lo mostra e la regia lo ritrova nella sua lista; la classifica non
   * cambia. Un doppio evento sullo stesso tavolo non crea un secondo buono.
   */
  onBonusVoucher(event: { playerName: string; label: string }): void {
    const playerName = String(event?.playerName ?? '').trim();
    const label = String(event?.label ?? '').trim();
    if (!playerName || !label) return;
    this.reliability.issueVoucher(playerName, label).subscribe({
      next: (voucher) => {
        this.bonusVouchers.update((list) => list.some((row) => row.id === voucher.id)
          ? list
          : [...list, voucher]);
        this.cdr.detectChanges();
      },
      error: () => {
        // Senza server il codice non esiste: meglio non mostrare un buono
        // impossibile da riscattare. La regia vede l'errore in console.
        console.error(`Buono non emesso per ${playerName}: server non disponibile`);
      },
    });
  }

  /** Chiuso il riepilogo di un bonus, la scaletta riparte da sola dal round dopo. */
  private startAutoAdvance(): void {
    // Un altro bonus può essere entrato in scena durante il riepilogo.
    if (this.bonusActive()) return;

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
    // Round o bonus nuovo: lo stato del precedente non si ripete più.
    this.ws.clearLastStates();
    this.arenaFinished = false;
    if (this.bonusEntranceTimer) clearTimeout(this.bonusEntranceTimer);
    this.bonusEntranceTimer = undefined;
    this.bonusEntrance.set(null);
    this.audioService.stopSuspense();
    this.cancelAutoAdvance();
    this.clearBonusTimer();
    this.bonusActive.set(false);
    this.bonusType.set(null);
    this.bonusResult.set([]);
    this.bonusVouchers.set([]);
    this.bonusShowResult.set(false);
    this.bonusScoresMap.clear();
    this.bonusAwarded = false;
    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCategoryId.set(null);
    this.timer.set(0);
    // Se si parte con un bonus mentre la TV è in pausa, l'audio non deve
    // restare muto: la pausa finisce insieme al round che l'aveva aperta.
    if (this.isPaused()) this.audioService.resumeBeds();
    this.isPaused.set(false);
    this.showResultPopup.set(false);
    this.currentMode.set(null);
    this.stopDemo();
    this.demoScene.set(0);
  }

  openResetModal() {
    this.showResetModal.set(true);
  }

  /** Unico punto che ricarica la TV: nelle prove si sostituisce senza navigare. */
  private reloadPage(): void {
    location.reload();
  }

  confirmReset() {
    this.showResetModal.set(false);

    // Il reset locale deve seguire quello del server: se la rete cade, la
    // classifica e la scaletta restano disponibili per un nuovo tentativo.
    const clearLocal = () => {
      this.theme.resetTeamThemes();
      this.roundManager.resetGame();
      this.leaderboardService.reset();
      this.reloadPage();
    };
    const gameId = this.currentGameId();
    if (!gameId) {
      clearLocal();
      return;
    }
    this.gameService.resetGame(gameId).subscribe({
      next: clearLocal,
      error: () => alert('Reset non confermato: la classifica locale è conservata, ma il server potrebbe aver già eseguito il reset. Verifica lo stato prima di continuare.'),
    });
  }

  // ── Demo animate (TV, remote, punti) ────────────────────────────────
  startDemo(type: string): void {
    const script = demoScriptFor(type);
    if (!script) return;
    this.stopDemoTimer();
    this.demoType.set(type);
    this.demoScene.set(0);
    this.demoTimer = setInterval(() => {
      if (!this.demoType()) return;
      this.demoScene.update((scene) => (scene + 1) % script.scenes.length);
    }, 5000);
  }

  stopDemo(): void {
    this.stopDemoTimer();
    this.demoType.set(null);
  }

  goDemoScene(scene: number): void {
    const count = this.getDemoScript(this.demoType() ?? '')?.scenes.length ?? 1;
    this.demoScene.set(((scene % count) + count) % count);
  }

  nextDemoScene(): void {
    this.goDemoScene(this.demoScene() + 1);
  }

  prevDemoScene(): void {
    this.goDemoScene(this.demoScene() - 1);
  }

  getDemoScript(type: string): DemoScript | null {
    return demoScriptFor(type);
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
        return 'La TV mostra solo livello scelto ed esito, non le risposte';
      case 'AZZARDO':
        return "La TV svela il valore e l'opzione che paga";
      case 'BLACKJACK':
        return 'Mani e banco svelati in TV a ogni tavolo';
      case 'BOMBA':
        return 'Tabellone e bombe in TV; ogni telefono sceglie una casella';
      case 'TENNIS_BATTLE':
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

  /**
   * Nel riepilogo Quiz la carta occupa tutto lo schermo: il pannello RISPOSTE
   * incollato in basso a sinistra coprirebbe la risposta della terza manche.
   */
  quizSummaryVisible(): boolean {
    const mode = this.currentMode();
    return mode?.type === 'QUIZ' && !!this.getSafeDisplayData().revealed;
  }

  getRecentResponses(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];
    return all.slice(-6).reverse();
  }

  getRecentResponsesWithScores(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];

    // Una riga per giocatore: le revisioni (per esempio l'ordine Timeline
    // cambiato) aggiornano la stessa riga invece di aggiungerne una seconda.
    // Nessun taglio a sei: con otto telefoni la TV deve mostrarli tutti.
    const byPlayer = new Map<string, any>();
    for (const row of all) {
      const playerName = String(row?.playerName ?? '').trim();
      if (!playerName) continue;
      byPlayer.set(playerName, row);
    }

    return [...byPlayer.values()].reverse().map(r => {
      const playerScore = this.leaderboardService.getLeaderboard()
        .find(p => p.playerName === r.playerName);

      return {
        ...r,
        lastPoints: r.points || 0,
        totalPoints: playerScore?.totalPoints || 0
      };
    });
  }

  private async adoptActiveGame(): Promise<void> {
    try {
      const active = await firstValueFrom(this.gameService.getActiveGame());
      const serverGameId = Number(active?.gameId) || 0;
      if (serverGameId <= 0 || serverGameId === this.currentGameId()) return;

      const previous = this.currentGameId();
      this.currentGameId.set(serverGameId);
      localStorage.setItem('activeGameId', String(serverGameId));
      this.ws.subscribeToGame(serverGameId);
      if (await this.reliability.start(serverGameId, 'TV')) return;

      // Senza sessione sulla partita trovata si torna a quella di partenza,
      // invece di restare su un tavolo che non si ha il diritto di comandare.
      this.currentGameId.set(previous);
      this.ws.subscribeToGame(previous);
      localStorage.setItem('activeGameId', String(previous));
      await this.reliability.start(previous, 'TV');
    } catch {
      // Senza rete resta la partita salvata sul dispositivo.
    }
  }

  /** La TV è l'unico motore dei punti: dopo ogni variazione salva il tabellone. */
  private bindLeaderboardPersistence(): void {
    this.leaderboardService.setPersistence((entries) => this.queueLeaderboardSave(entries));
  }

  private queueLeaderboardSave(entries: PlayerScore[]): void {
    this.leaderboardPendingSeq++;
    const seq = this.leaderboardPendingSeq;
    // La coda sta in storage: un refresh prima dei 250 ms non perde i punti.
    this.persistPendingLeaderboard(entries, seq);
    if (this.leaderboardFlush) clearTimeout(this.leaderboardFlush);
    this.leaderboardFlush = setTimeout(() => {
      this.leaderboardFlush = undefined;
      void this.flushLeaderboard(entries, seq);
    }, 250);
  }

  private async flushLeaderboard(entries: PlayerScore[], seq: number, attempt = 0): Promise<void> {
    const gameId = this.currentGameId();
    if (!gameId) return;
    try {
      await firstValueFrom(this.gameService.saveLeaderboard(gameId, entries.map(e => ({ playerName: e.playerName, totalPoints: e.totalPoints }))));
      this.leaderboardSavedSeq = Math.max(this.leaderboardSavedSeq, seq);
      this.clearPendingLeaderboard(seq);
    } catch {
      if (attempt < 2) {
        this.leaderboardFlush = setTimeout(() => {
          this.leaderboardFlush = undefined;
          void this.flushLeaderboard(this.leaderboardService.entries(), this.leaderboardPendingSeq, attempt + 1);
        }, 1500);
      }
    }
  }

  private persistPendingLeaderboard(entries: PlayerScore[], seq: number): void {
    try {
      localStorage.setItem(PENDING_LEADERBOARD_KEY, JSON.stringify({
        gameId: this.currentGameId(),
        seq,
        entries: entries.map((entry) => ({
          playerName: entry.playerName,
          totalPoints: entry.totalPoints,
          correctAnswers: entry.correctAnswers,
          wrongAnswers: entry.wrongAnswers,
          position: entry.position,
        })),
      }));
    } catch {
      // Storage pieno: resta il percorso normale con il timer.
    }
  }

  /** La coda è partita: si cancella solo la scrittura che ha appena salvato. */
  private clearPendingLeaderboard(seq: number): void {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_LEADERBOARD_KEY) ?? 'null');
      if (raw && Number(raw.seq) > seq) return;
      localStorage.removeItem(PENDING_LEADERBOARD_KEY);
    } catch {
      // Storage illeggibile: si toglie comunque la coda.
      try { localStorage.removeItem(PENDING_LEADERBOARD_KEY); } catch { /* niente */ }
    }
  }

  /**
   * Scrittura di classifica rimasta in coda da prima del refresh: si rimanda
   * subito al server, invece di lasciare il tabellone indietro di un round.
   */
  private restorePendingLeaderboard(): void {
    let pending: any = null;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_LEADERBOARD_KEY) ?? 'null');
    } catch {
      return;
    }
    if (!pending || !Array.isArray(pending.entries) || !pending.entries.length) return;
    const currentGameId = this.currentGameId();
    const storedGameId = pending.gameId == null ? null : Number(pending.gameId);
    // La coda può essere nata prima di sapere la partita (gameId assente): in
    // quel caso vale per la partita corrente. Se invece è di un'altra partita
    // resta lì: non si spostano punti da un tavolo all'altro.
    if (storedGameId != null
      && Number.isFinite(storedGameId) && storedGameId > 0
      && currentGameId && storedGameId !== currentGameId) {
      return;
    }
    // Senza partita non c'è dove salvarla: la coda resta per il prossimo stato.
    if (!currentGameId) return;

    const seq = Number(pending.seq) || 1;
    const entries = pending.entries as PlayerScore[];
    // Questi punti sono più recenti dello snapshot che sta per arrivare.
    this.leaderboardPendingSeq = Math.max(this.leaderboardPendingSeq, seq);
    this.leaderboardService.replaceAll(entries);
    void this.flushLeaderboard(entries, seq);
  }

  /**
   * Stato autorevole del server: classifica, avanzamento e round ancora
   * aperto. Arriva al primo collegamento e a ogni riconnessione.
   */
  private applyAuthoritativeState(snapshot: any): void {
    if (!snapshot) return;

    // Prima di applicare lo snapshot si recupera la coda rimasta dal refresh.
    this.restorePendingLeaderboard();

    // Una scrittura locale non ancora confermata è più recente dello snapshot:
    // applicarlo cancellerebbe i punti appena assegnati.
    if (this.leaderboardSavedSeq >= this.leaderboardPendingSeq && Array.isArray(snapshot.leaderboard)) {
      this.leaderboardService.replaceAll(snapshot.leaderboard);
    }

    if (snapshot.hasState !== false) {
      const status = String(snapshot.status ?? 'CREATED');
      const roundIndex = Number(snapshot.roundIndex);
      if (Number.isFinite(roundIndex) && roundIndex >= 0) {
        const rounds = status === 'CREATED' || !snapshot.roundType ? 0 : roundIndex + 1;
        // Un round saltato con AVANTI non crea una riga sul server: il suo
        // conteggio può essere più basso della scaletta già giocata. Ripartire
        // da lì rigiocherebbe un gioco (per esempio una sesta Ultima spiaggia).
        const safeRounds = Math.max(this.roundManager.getCurrentRound(), rounds);
        this.roundManager.restoreRound(safeRounds);
        this.roundInfo.set(this.roundManager.getProgress().text);
      }
    }

    const bonusAct = snapshot?.bonusAct;
    const savedAct = Number(bonusAct?.act);
    const savedType = String(bonusAct?.type ?? '');
    this.serverBonus = Number.isInteger(savedAct) && savedAct >= 0 && savedType
      ? { act: savedAct, type: savedType, status: String(bonusAct?.status ?? '') }
      : null;

    this.offerRoundRecovery(snapshot);
    this.offerBonusRecovery(snapshot);
  }

  /**
   * Indice del round corrente per i checkpoint TV (0-based).
   *
   * La fonte è la scaletta, come per il conteggio del vincitore: `round()` può
   * essere la fotografia di prima del refresh e spostare il checkpoint su un
   * altro round. L'unica eccezione è quando la scaletta è avanti rispetto al
   * server (round saltati senza riga sul server): lì il server scarta un
   * checkpoint con un indice diverso dal suo, quindi si usa il suo.
   */
  private tvRoundIndex(): number | null {
    const scheduleIndex = this.openRoundIndex();
    const serverIndex = this.serverRoundIndex;
    if (scheduleIndex == null) return serverIndex;
    if (serverIndex != null && serverIndex !== scheduleIndex) return serverIndex;
    return scheduleIndex;
  }

  private rememberServerRoundIndex(value: unknown): void {
    const index = Number(value);
    this.serverRoundIndex = Number.isInteger(index) && index >= 0 ? index : null;
  }

  /** Un round è ancora aperto sul server: la TV non lo dà per perso. */
  private offerRoundRecovery(snapshot: any): void {
    const status = String(snapshot?.status ?? '');
    const type = String(snapshot?.roundType ?? '');
    const deadline = Number(snapshot?.roundDeadlineAt ?? 0);
    const paused = snapshot?.paused === true;
    const pausedAt = Number(snapshot?.pausedAt ?? 0);
    // In pausa la deadline resta ferma e può essere già passata: il round è
    // comunque aperto finché la TV non lo riprende o lo chiude.
    const open = status === 'RUNNING' && !!type
      && (paused || (Number.isFinite(deadline) && deadline > this.reliability.serverNow()));

    this.rememberServerRoundIndex(Number(snapshot?.roundIndex));

    if (!open) {
      this.recoveredRound.set(null);
      this.recoveredPayload = null;
      this.recoveredTvCheckpoint = null;
      this.biglieResume.set(null);
      return;
    }
    if (this.currentMode() || this.bonusActive() || this.isSpinning() || this.showTypeReveal()) return;

    this.recoveredPayload = snapshot.currentRound?.payload ?? snapshot.payload ?? null;
    this.recoveredBlackjackState = snapshot.blackjackState ?? null;
    // Solo un checkpoint del round corrente e della sua modalità: il server
    // scarta gli altri, ma uno stato estraneo non deve essere interpretato.
    const checkpoint = snapshot.tvCheckpoint?.state ? snapshot.tvCheckpoint : null;
    this.recoveredTvCheckpoint = checkpoint && String(checkpoint.mode ?? '') === type
      ? { type: type as GameModeType, value: checkpoint }
      : null;
    // Le Biglie non usano `mode.restore`: il componente legge lo stato da qui.
    this.biglieResume.set(type === 'BIGLIE' && this.recoveredTvCheckpoint
      ? this.recoveredTvCheckpoint.value.state ?? null
      : null);
    this.recoveredRound.set({
      type: type as GameModeType,
      label: this.getModeName(type),
      // Il tempo residuo è quello che c'era al momento della pausa, non quello
      // che scorre da allora.
      secondsLeft: paused && pausedAt > 0
        ? Math.max(0, Math.ceil((deadline - pausedAt) / 1000))
        : Math.max(0, Math.ceil((deadline - this.reliability.serverNow()) / 1000)),
      // Timeline ha le carte nel payload, Blackjack la mano sul server e gli
      // altri giochi un checkpoint TV della stessa modalità del round.
      resumable: (type === 'TIMELINE' && !!this.recoveredPayload)
        || (type === 'BLACKJACK' && !!snapshot?.blackjackState)
        // Speed Rush tiene le corsie sul server: non serve un checkpoint in TV.
        || type === 'SPEED_RUSH'
        || this.recoveredTvCheckpoint?.type === type,
      paused,
    });
  }

  /**
   * La pausa TV vale anche per il server: senza questa chiamata la deadline
   * continuava a scorrere e il round poteva scadere durante la pausa.
   */
  private syncPauseToServer(paused: boolean): void {
    const gameId = this.currentGameId();
    if (!gameId) return;
    const call = paused
      ? this.gameService.pauseRound(gameId)
      : this.gameService.resumeRound(gameId);
    call.subscribe({ error: () => { /* Senza rete la pausa locale resta. */ } });
  }

  /**
   * Ripete l'ultimo stato del round o del bonus in scena. Lo usano la ripresa e
   * il rientro di un telefono: chi non ha visto gli annunci ritrova subito
   * gioco e fase, senza aspettare il prossimo tick.
   */
  private republishLiveState(): void {
    const gameId = this.currentGameId();
    if (!gameId) return;

    if (this.bonusActive()) {
      const bonus = this.bonusType();
      const action = bonus ? BONUS_STATE_ACTIONS[bonus] : null;
      const state = action ? this.ws.lastStateFor(gameId, action) : null;
      if (state) this.ws.broadcastStatus(gameId, state);
      return;
    }

    // Dopo un refresh in pausa il round non è ancora a schermo, ma lo stato
    // salvato basta a far ritrovare il gioco a chi rientra.
    const pending = this.recoveredRound();
    const mode = this.currentMode();
    const type = mode
      ? (this.showQuestion() ? mode.type : null)
      : (this.isPaused() && pending?.paused ? pending.type : null);
    if (!type) return;
    const action = ROUND_STATE_ACTIONS[type];
    const state = action ? this.ws.lastStateFor(gameId, action) : null;
    if (state) this.ws.broadcastStatus(gameId, state);
  }

  async resumeRecoveredRound(): Promise<void> {
    const pending = this.recoveredRound();
    const payload = this.recoveredPayload;
    const stored = this.recoveredTvCheckpoint;
    const tvCheckpoint = stored && stored.type === pending?.type ? stored.value : null;
    if (!pending?.resumable) return;

    if (pending.paused) {
      try {
        // Prima si toglie la pausa sul server, poi la TV riparte: così il
        // timer locale non corre contro una deadline ancora ferma.
        await firstValueFrom(this.gameService.resumeRound(this.currentGameId()));
      } catch {
        alert('Ripresa del round non confermata: verifica lo stato del server.');
        return;
      }
    }

    this.recoveredRound.set(null);
    this.showQuestion.set(true);
    this.phase.set('QUESTION');
    // Il verdetto del round riparte da dove era: i punti giocati prima del
    // refresh contano ancora per il tema della TV.
    this.roundScoring = true;
    // Stessa fonte del salvataggio: la scaletta. L'indice dello snapshot può
    // essere indietro (round saltati con AVANTI), e cercherebbe i punti sotto
    // un altro round.
    this.restoreRoundPoints(this.openRoundIndex());
    // Il round riprende: Arena torna capace di chiudersi e di contare i punti.
    this.arenaFinished = false;
    if (pending.type === 'ARENA') this.beginRoundScoring();

    const category = String(payload?.category ?? '').trim();
    const found = this.allCategories().find(
      (row) => String(row.name).trim().toLowerCase() === category.toLowerCase(),
    );
    if (found) this.selectedCategoryId.set(found.id);

    const mode = this.gameModeService.createMode(
      this.buildModeConfig(pending.type, payload, this.bonusPlayers()),
    );
    this.currentMode.set(mode);
    this.audioService.setActBed(this.currentActNumber());
    this.audioService.setGameBed(mode.type);
    this.timer.set(pending.secondsLeft);
    this.audioService.startClock();
    this.startRoundSuspense(mode.type);
    if (mode.restore) {
      try {
        await mode.restore(pending.secondsLeft, tvCheckpoint ?? this.recoveredBlackjackState);
      } catch {
        // Checkpoint non valido: si torna al pannello, senza lasciare la TV
        // su un round vuoto che nessuno potrebbe più chiudere.
        this.gameModeService.cleanup();
        this.currentMode.set(null);
        this.phase.set('IDLE');
        this.showQuestion.set(false);
        this.audioService.stopClock();
        this.audioService.stopSuspense();
        this.recoveredRound.set(pending);
        alert('Round non ripristinabile: chiudi il round o riprova dalla regia.');
        return;
      }
    } else await mode.start();
    if (pending.paused) {
      this.ws.broadcastStatus(this.currentGameId(), { action: WsAction.GAME_RESUMED });
    }
    // Il round è appena stato ricostruito: lo stato torna ai telefoni.
    this.republishLiveState();
    this.cdr.detectChanges();
  }

  /**
   * Chiude sul server il round che questa TV non ha ripreso, così il
   * successivo non parte con un indice sfasato.
   */
  closeRecoveredRound(advance = false): void {
    if (!this.recoveredRound()) return;
    // Il round non ripreso si chiude qui: il conteggio del vincitore muore con lui.
    this.settleRoundWinner();
    this.recoveredRound.set(null);
    this.recoveredPayload = null;
    this.recoveredBlackjackState = null;
    this.recoveredTvCheckpoint = null;
    this.biglieResume.set(null);
    this.reliability.saveBlackjackState(null);
    this.gameService.closeRound(this.currentGameId(), 'recovered').subscribe({
      next: () => {
        if (advance) void this.startNewRound();
      },
      error: () => alert('Chiusura del round non confermata: verifica lo stato del server prima di continuare.'),
    });
  }
}
