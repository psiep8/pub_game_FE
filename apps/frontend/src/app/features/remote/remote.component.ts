import { GamePhase } from '../../shared/enums/game-phase';
import { PlayerStatus } from '../../shared/enums/player-status';
import { WsAction } from '../../shared/enums/ws-action';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnDestroy, OnInit, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';

/** Nickname imposto dalla vista di prova `quad.html` (es. ?nickname=Anna). */
function initialNicknameFromQuery(): string | null {
  if (typeof window === 'undefined') return null;
  const name = new URLSearchParams(window.location.search).get('nickname')?.trim();
  if (!name) return null;
  localStorage.setItem('nickname', name);
  localStorage.setItem('playerName', name);
  return name;
}
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { GameService } from '../../core/services/game.service';
import { ThemeService, THEME_OPTIONS, type AppTheme } from '../../core/services/theme.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { PlayerAvatarService } from '../../core/services/player-avatar.service';
import {
  type SpeedTask,
} from '../games/speed-rush/speed-rush-deck';
import { AZZARDO_MAX_WIN_PER_MANCHE } from '../games/azzardo/azzardo-rules';
import { ConnectionBadge } from '../../shared/components/connection-badge/connection-badge.component';
import { SentStateComponent } from '../../shared/components/sent-state/sent-state.component';
import { ButtonTestComponent } from './button-test/button-test.component';
import {
  MANUAL_BONUSES,
  MANUAL_ENTRIES,
  MANUAL_GAMES,
  MANUAL_SECTIONS,
  ManualBonus,
  ManualEntry,
  ManualGame,
} from '../../shared/manual/manual-content';

@Component({
  selector: 'app-remote-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ConnectionBadge, SentStateComponent, ButtonTestComponent],
  templateUrl: './remote.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./remote.component.css', './restyle.css', './manual.css'],
  styles: [`
    .timeline-remote, .speed-remote, .hockey-remote {
      display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; justify-content: center;
    }
    .hockey-remote { position: relative; }
    .hockey-diff {
      padding: 2px 7px; border: 1px solid var(--tomato); color: var(--tomato);
      font-family: var(--font-mono); font-size: .6rem; font-weight: 700; letter-spacing: .1em;
    }
    .hockey-goal-overlay {
      position: fixed; inset: 0; z-index: 80; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 6px; text-align: center;
      padding: 24px; background: var(--mint); color: var(--coal);
      border: 6px solid var(--coal); animation: hockeyGoalIn .22s ease-out;
    }
    .hockey-goal-overlay.conceded { background: var(--tomato); color: var(--paper-hi); }
    .hockey-goal-kicker { font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .18em; opacity: .85; }
    .hockey-goal-word { font-family: var(--font-display); font-size: clamp(2.6rem, 12vw, 4.6rem); line-height: .95; text-transform: uppercase; }
    .hockey-goal-score { font-family: var(--font-display); font-size: clamp(3.4rem, 18vw, 6rem); line-height: 1; }
    .hockey-goal-note { font-family: var(--font-mono); font-size: .8rem; letter-spacing: .12em; opacity: .9; }
    @keyframes hockeyGoalIn { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .party-instruction { text-align: center; margin: 0; color: color-mix(in srgb, var(--coal) 70%, transparent); font-family: var(--font-mono); font-size: .8rem; }
    .emoji-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .emoji-btn {
      padding: 22px; background: var(--paper-hi); color: var(--coal);
      border: 3px solid var(--coal); border-radius: 0; box-shadow: 4px 4px 0 var(--coal);
      font-family: var(--font-mono); font-size: 2rem;
    }
    .emoji-btn:active { background: var(--acid); transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--coal); }
    .hockey-score {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal);
      box-shadow: 5px 5px 0 var(--coal); padding: 10px 12px;
    }
    .hockey-side { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .hockey-side.right { align-items: flex-end; text-align: right; }
    .hockey-where { margin: 0; font-family: var(--font-mono); font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; color: var(--coal); background: var(--mustard); border: 2px solid var(--coal); padding: 4px 8px; box-shadow: 3px 3px 0 var(--coal); }
    .hockey-side-name { font-family: var(--font-mono); font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hockey-side.active .hockey-side-name { color: var(--tomato); font-weight: 700; }
    .hockey-side-score { font-family: var(--font-display); font-size: 2rem; line-height: 1; }
    .hockey-vs { font-family: var(--font-mono); font-size: .7rem; color: var(--tomato); }
    .hockey-card {
      background: var(--paper); color: var(--coal); border: 3px solid var(--coal);
      box-shadow: 8px 8px 0 var(--tomato); padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .hockey-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .hockey-tag { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .2em; color: var(--tomato); font-weight: 700; }
    .hockey-clock { font-family: var(--font-mono); font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .hockey-clock.hot { color: var(--tomato); }
    .hockey-question { margin: 0; font-size: 1.08rem; font-weight: 800; line-height: 1.25; }
    .hockey-options { display: flex; flex-direction: column; gap: 8px; }
    .hockey-option {
      display: flex; align-items: center; gap: 10px; padding: 13px 12px;
      background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal);
      box-shadow: 3px 3px 0 var(--coal); font-family: var(--font); font-size: 1rem;
      font-weight: 700; text-align: left;
    }
    .hockey-option:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--coal); }
    .hockey-option:disabled { opacity: .5; }
    .hockey-letter { font-family: var(--font-mono); font-weight: 700; color: var(--tomato); }
    .hockey-wait {
      display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
      padding: 16px 14px; background: var(--paper-hi); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 6px 6px 0 var(--tomato);
    }
    .hockey-wait-icon { font-size: 3rem; animation: hockeyBounce 1.2s infinite; }
    .hockey-wait h2 { margin: 0; font-family: var(--font-display); font-size: 1.5rem; color: var(--coal); }
    .hockey-wait p { margin: 0; font-size: .95rem; color: color-mix(in srgb, var(--coal) 72%, transparent); }
    .hockey-wait-score { font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: var(--tomato); }
    .hockey-result { text-align: center; font-family: var(--font-mono); font-size: .8rem; font-weight: 700; letter-spacing: .16em; color: var(--tomato); }
    @keyframes hockeyBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    .bonus-remote { display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; justify-content: center; }
    .casino-hand {
      display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px;
      background: var(--paper-hi); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--tomato);
    }
    .casino-hand-label { font-family: var(--font-mono); font-size: .66rem; letter-spacing: .18em; color: var(--tomato); font-weight: 700; }
    .casino-cards { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
    .casino-card {
      display: inline-grid; place-items: center; min-width: 38px; height: 50px; padding: 0 4px;
      background: var(--paper); color: var(--coal); border: 2px solid var(--coal);
      font-family: var(--font-mono); font-weight: 800;
    }
    .casino-card.red { color: var(--tomato); }
    .casino-hand-total { font-family: var(--font-display); font-size: 2rem; line-height: 1; }
    .casino-hand-total.bust { color: var(--tomato); }
    .casino-bj-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .casino-hit, .casino-stand { padding: 20px 10px; border: 3px solid var(--coal); border-radius: 0; box-shadow: 4px 4px 0 var(--coal); font-size: 1rem; font-weight: 900; letter-spacing: .06em; }
    .casino-hit { background: var(--tomato); color: var(--paper-hi); }
    .casino-stand { background: var(--paper-hi); color: var(--coal); }
    .casino-hit:disabled, .casino-stand:disabled { opacity: .55; }
    .cavallo-categories { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 56vh; overflow: auto; }
    .biglie-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); }
    .biglie-card.picked { background: var(--acid); }
    .biglie-card:disabled { opacity: .5; }
    .biglie-dot { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--coal); font-size: 1rem; }
    .biglie-prof { font-size: .58rem; letter-spacing: .06em; opacity: .6; }
    .biglie-mine { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--paper-hi); border: 2px solid var(--coal); }
    .biglie-head { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 1rem; }
    .biglie-bar { height: 16px; background: color-mix(in srgb, var(--coal) 12%, transparent); border: 2px solid var(--coal); overflow: hidden; }
    .biglie-fill { height: 100%; transition: width .2s linear; }
    .casino-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 6px; max-height: 62vh; overflow: auto; }
    .casino-cell { padding: 11px 6px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: .9rem; font-weight: 800; letter-spacing: .04em; }
    .casino-cell.picked { background: var(--acid); }
    .casino-cell:disabled { opacity: .5; }
    .cavallo-category { padding: 12px 10px; border-radius: 0; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); box-shadow: 3px 3px 0 var(--coal); font-size: .8rem; font-weight: 700; text-align: left; }
    .cavallo-category.picked { border-color: var(--coal); background: var(--acid); box-shadow: 4px 4px 0 var(--tomato); }
    .cavallo-category:disabled { opacity: .5; }
    .cavallo-question { margin: 0; font-size: 1.02rem; font-weight: 800; line-height: 1.3; color: var(--coal); }
    .cavallo-options { display: flex; flex-direction: column; gap: 8px; }
    .cavallo-option { display: flex; align-items: center; gap: 10px; padding: 14px 12px; border-radius: 0; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); box-shadow: 3px 3px 0 var(--coal); text-align: left; font-size: .92rem; font-weight: 700; }
    .cavallo-option:disabled { opacity: .55; }
    .cavallo-letter { display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 auto; border-radius: 0; background: var(--acid); color: var(--coal); font-size: .72rem; font-weight: 900; }
    .azzardo-stakes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .azzardo-stake { padding: 12px 4px; border-radius: 0; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); box-shadow: 3px 3px 0 var(--coal); font-family: var(--font-mono); font-size: 1rem; font-weight: 800; }
    .azzardo-stake.selected { border-color: var(--coal); background: var(--acid); box-shadow: 4px 4px 0 var(--tomato); }
    .azzardo-stake:disabled { opacity: .45; }
    .azzardo-stake.used { background: var(--paper-2); color: color-mix(in srgb, var(--coal) 55%, transparent); box-shadow: 2px 2px 0 var(--coal); text-decoration: line-through; opacity: 1; }
    .azzardo-options { display: flex; flex-direction: column; gap: 6px; }
    .azzardo-option { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 0; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); box-shadow: 3px 3px 0 var(--coal); text-align: left; font-size: .92rem; font-weight: 700; }
    .azzardo-option.selected { border-color: var(--coal); background: var(--acid); box-shadow: 4px 4px 0 var(--tomato); }
    .azzardo-option:disabled { opacity: .5; }
    .azzardo-letter { display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 auto; background: var(--acid); color: var(--coal); font-size: .72rem; font-weight: 900; }
  `],
})
export class RemoteComponent implements OnInit, OnDestroy {

  public ws = inject(WebSocketService);
  readonly reliability = inject(ReliabilityService);
  readonly playerAvatars = inject(PlayerAvatarService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private gameService = inject(GameService);
  private swUpdate = inject(SwUpdate);
  public theme = inject(ThemeService);
  /** Le sette palette da provare prima del tutorial. */
  readonly themeOptions = THEME_OPTIONS;
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;

  /**
   * La regia quad assegna il nome via query string, così Anna e Bruno
   * possono vivere su due origini diverse senza passare dal setup manuale.
   */
  nickname = signal<string | null>(initialNicknameFromQuery() ?? localStorage.getItem('nickname'));
  /** La prova sta fra l'ingresso e la sala d'attesa del round. */
  showButtonTest = signal(false);
  /** Passo 2 del setup: il colore si sceglie dopo foto e nome. */
  readonly themeStep = signal(false);
  tempNickname = '';
  avatarPreview = signal<string | null>(null);
  private pendingAvatar: string | null = null;
  startTime: number = 0;

  gameState = signal<PlayerStatus>(PlayerStatus.WAITING);
  questionType = signal<'QUIZ' | 'MUSIC' | 'IMAGE_BLUR' | 'WHEEL_OF_FORTUNE' | 'ARENA' | 'TIMELINE' | 'TIME_BUZZER' | 'BOMBA' | 'SPEED_RUSH' | 'AIR_HOCKEY_BATTLE' | 'CAVALLO' | 'ULTIMA_SPIAGGIA' | 'AZZARDO' | 'BLACKJACK' | 'BONUS_BASKET' | 'BONUS_CASINO' | 'BONUS_CAVALLO' | 'BONUS_BIGLIE'>('QUIZ');
  hasAnswered = signal(false);
  /** Manche Quiz in corso e ultima manche già votata. */
  quizManche = signal(0);
  answeredManche = signal(0);
  /** Ultima risposta toccata: solo promemoria visivo, l'esito lo decide il server. */
  selectedAnswer = signal<number | null>(null);
  isBlocked = signal(false);
  /** Pausa globale decisa dall'admin: blocca input e cronometri locali. */
  paused = signal(false);
  /** Un round è aperto: il manuale non si può aprire e si chiude se era aperto. */
  roundActive = signal(false);
  /**
   * Riallineamento dopo il ritorno in primo piano: finché il server non ha
   * detto in che round siamo, il telefono non riabilita nessun input. Un round
   * chiuso mentre lo schermo era spento non si può più rispondere.
   */
  readonly resyncing = signal(false);
  /** Input utilizzabili adesso: serve lo stato del server e nessuna pausa. */
  readonly inputReady = computed(() => !this.resyncing() && !this.paused());
  manualOpen = signal(false);
  manualEntry = signal<ManualEntry | null>(null);
  readonly manualGames = MANUAL_GAMES;
  readonly manualBonuses = MANUAL_BONUSES;
  readonly manualSections = MANUAL_SECTIONS;
  readonly canOpenManual = computed(() =>
    !!this.nickname()
    && this.gameState() === PlayerStatus.WAITING
    && !this.roundActive()
    && !this.paused()
    && !this.showButtonTest()
  );
  roundNumber = signal(0);
  roundTotal = signal(40);
  private pauseStartedAt = 0;

  hockeyQuestion = signal<{ text: string; options: string[]; difficulty?: string } | null>(null);
  /** Vero dopo il primo AIR_HOCKEY_BATTLE_STATE: senza stato non si disegna il campo. */
  hockeyStateReady = signal(false);
  hockeyMyTurn = signal(false);
  hockeyMyScore = signal(0);
  hockeyOpponentScore = signal(0);
  hockeyOpponent = signal('');
  hockeyCourtIndex = signal(0);
  hockeyCourtTotal = signal(0);
  hockeyServeLeft = signal(0);
  hockeyLastResult = signal<string | null>(null);
  hockeyGoal = signal<{ id: number; scored: boolean; mine: number; opponent: number } | null>(null);
  private hockeyLastGoalId = 0;
  private hockeyGoalTimer?: ReturnType<typeof setTimeout>;


  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1);

  // ARENA STATE
  arenaQuestion = signal<{ text: string, options?: string[], isTrueFalse: boolean, questionId: string } | null>(null);
  isFetchingQuestion = signal(false);
  categories = signal<any[]>([]);

  currentRoundType: string = '';

  // ---- Giochi simultanei: stato locale del telefono ----
  timelineCards = signal<Array<{ id: number; label: string }>>([]);
  timelineOrder = signal<number[]>([]);
  private timelineSendHandle?: ReturnType<typeof setTimeout>;
  private timelineRoundId = '';
  private timelineSendSequence = 0;
  private readonly timelineInstanceId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  buzzPhase = signal<'idle' | 'running' | 'sent'>('idle');
  buzzEliminated = signal(false);
  buzzManche = signal(0);
  /** Manche per cui il via ha già armato il tasto: lo stato del tabellone non lo disarma. */
  private buzzArmedManche = 0;
  buzzTotal = signal(3);
  buzzError = signal('');
  private buzzStartedAt = 0;

  // BOMBA: lo stato pubblico e la vista privata del possessore arrivano dal
  // backend. Il telefono non calcola mai micce né punteggi.
  bombaState = signal<any>(null);
  bombaFlash = signal<string | null>(null);
  casinoState = signal<any>(null);
  casinoChoice = signal<string | null>(null);
  blackjackState = signal<any>(null);
  blackjackStand = signal(false);
  azzardoState = signal<any>(null);
  azzardoChips = signal<number[]>([]);
  azzardoSent = signal(false);
  private azzardoKey = '';
  cavalloState = signal<any>(null);
  cavalloChoice = signal<string | null>(null);
  cavalloCategory = signal<string | null>(null);
  biglieState = signal<any>(null);
  biglieChoice = signal<string | null>(null);
  private casinoKey = '';
  private blackjackKey = '';
  private cavalloKey = '';
  private biglieKey = '';
  private bombaPoll?: ReturnType<typeof setInterval>;
  private bombaPollBusy = false;
  private bombaStarted = false;
  /** Identità dell'ultimo round applicato da uno snapshot (per non riaprire
   *  voti già dati e per riconoscere un round nuovo dopo un round chiuso). */
  private lastSnapshotRoundKey = '';
  private bombaEventSeq = 0;
  private bombaFlashTimer?: ReturnType<typeof setTimeout>;

  draggingId = signal<number | null>(null);
  private dragId: number | null = null;

  arenaEliminated = signal(false);

  /** Prova corrente del mazzo (null tra una prova e l'altra). */
  speedTask = signal<SpeedTask | null>(null);
  /** Colori già scelti nella prova "mischia colori". */
  speedColorPicked = signal<string[]>([]);
  /** Ignora le risposte di una corsa già chiusa o sostituita. */
  private speedLoadSeq = 0;

  hockeyHits = signal(0);
  private lastHockeyAt = 0;

  showInstallBanner = signal(false);
  showIosInstallBanner = signal(false);
  showUpdateBanner = signal(false);
  private deferredPrompt: any;

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modern-slider')) return;
    if (this.draggingId()) {
      event.preventDefault();
      return;
    }
    // In verticale il contenuto del gioco deve poter scorrere.
    if (target.closest('.game-content')) return;
    event.preventDefault();
  }

  @HostListener('window:gesturestart', ['$event'])
  @HostListener('window:gesturechange', ['$event'])
  @HostListener('window:gestureend', ['$event'])
  onGesture(event: Event) {
    event.preventDefault();
  }

  /**
   * Telefono tornato in primo piano (o rete ritrovata): prima si chiede lo
   * stato al server, poi si riabilita. Mai fidarsi del round rimasto in
   * memoria: mentre lo schermo era spento il round è potuto finire.
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden) void this.realignWithServer();
  }

  @HostListener('window:pageshow')
  @HostListener('window:online')
  onPageReturned(): void {
    void this.realignWithServer();
  }

  private async realignWithServer(): Promise<void> {
    if (!this.nickname()) return;
    this.resyncing.set(true);
    try {
      await this.reliability.sync();
      // Sync riuscito: lo stato attuale c'è, anche se è "nessun round".
      this.resyncing.set(false);
    } catch {
      // Server irraggiungibile: si resta su "Riallineamento…" e non si
      // risponde alla cieca. Il prossimo ritorno in primo piano riprova.
    }
  }

  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private microphone?: MediaStreamAudioSourceNode;
  private mediaStream?: MediaStream;
  private volumeTimer?: ReturnType<typeof setInterval>;

  isListening = signal(false);
  currentVolume = signal(0);
  isScreaming = signal(false);
  microphoneError = signal<string | null>(null);

  /** Partita indicata dal QR o già aperta su questo telefono. */
  private initialGameId(): number {
    const fromQuery = Number(new URLSearchParams(window.location.search).get('game'));
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    const stored = Number(localStorage.getItem('activeGameId'));
    if (Number.isFinite(stored) && stored > 0) return stored;
    return 1;
  }

  /**
   * Senza `?game=` il telefono chiede al server quale serata è aperta, così
   * non resta agganciato alla partita di una sera precedente.
   */
  private async adoptActiveGame(): Promise<void> {
    if (new URLSearchParams(window.location.search).get('game')) return;
    try {
      const active = await firstValueFrom(this.gameService.getActiveGame());
      const gameId = Number(active?.gameId);
      if (!Number.isFinite(gameId) || gameId <= 0 || gameId === this.gameId()) return;
      this.gameId.set(gameId);
      localStorage.setItem('activeGameId', String(gameId));
      const name = this.nickname();
      if (!name) return;
      if (await this.reliability.start(gameId, 'REMOTE', name)) {
        this.ws.broadcastStatus(gameId, { action: WsAction.JOIN_GAME, playerName: name });
      }
    } catch {
      // Server non raggiungibile: resta l'ID del QR o dello storage.
    }
  }

  closeButtonTest(): void {
    this.showButtonTest.set(false);
    this.cdr.detectChanges();
  }

  getBasketUrl(): string {
    return '/basket?player=' + encodeURIComponent(this.nickname() ?? '');
  }

  ngOnInit(): void {
    this.playerAvatars.connect(this.ws);
    this.setupPWA();
    this.checkForUpdates();

    // L'ID arriva dal QR (`/play?game=12`), poi dallo storage del telefono;
    // senza nessuno dei due si chiede al server quale serata è aperta.
    this.gameId.set(this.initialGameId());
    localStorage.setItem('activeGameId', String(this.gameId()));
    console.log('🎮 Remote collegato alla partita', this.gameId());

    // Anteprima del manuale per la pagina sim-duo (`?quad=1&manuale=QUIZ`):
    // mostra la scheda "come si vota" senza dover entrare in squadra.
    const manualPreview = new URLSearchParams(window.location.search).get('manuale');
    if (manualPreview) setTimeout(() => this.openManualAt(manualPreview), 300);

    // Sessione + heartbeat: al riaggancio il telefono riprende la stessa
    // squadra e richiede lo stato autorevole, senza ricaricare la pagina.
    // Prima l'ascolto, poi l'avvio: il sync iniziale può rispondere subito e
    // senza sottoscrizione lo snapshot andrebbe perso.
    this.reliability.syncState$.subscribe((snapshot: any) => this.applyServerSnapshot(snapshot));
    const storedName = this.nickname();
    if (storedName) {
      this.tempNickname = storedName;
      this.nickname.set(null);
      void this.reliability.start(this.gameId(), 'REMOTE', storedName).then((ok) => {
        if (ok) {
          this.nickname.set(storedName);
          this.showButtonTest.set(true);
        }
      });
    }
    void this.adoptActiveGame();

    this.gameService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats.filter(c => c.active));
      }
    });

    // Se il giocatore è già loggato, notifico la TV e rimando l'avatar.
    if (this.nickname()) {
      this.avatarPreview.set(this.playerAvatars.avatarFor(this.nickname()!));
      setTimeout(() => {
        if (this.ws.connected()) {
          this.ws.broadcastStatus(this.gameId(), { action: WsAction.JOIN_GAME, playerName: this.nickname() });
          this.playerAvatars.publish(this.nickname()!, this.gameId());
        }
      }, 2000);
    }

    this.ws.connectedAt$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const name = this.nickname();
      if (name) {
        this.ws.broadcastStatus(this.gameId(), { action: WsAction.JOIN_GAME, playerName: name });
        this.playerAvatars.publish(name, this.gameId());
      }
    });

    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          this.roundActive.set(true);
          this.closeManual();
          this.questionType.set(status.type);
          if (status.round) this.roundNumber.set(Number(status.round));
          if (status.roundTotal) this.roundTotal.set(Number(status.roundTotal));
          this.isBlocked.set(false);
          if (status.type === 'BLACKJACK') {
            this.blackjackState.set(null);
            this.blackjackStand.set(false);
            this.blackjackKey = '';
          }
          if (status.type === 'BONUS_BASKET'
              || status.type === 'BONUS_CASINO' || status.type === 'BONUS_CAVALLO'
              || status.type === 'BONUS_BIGLIE'
              || status.type === 'ULTIMA_SPIAGGIA' || status.type === 'AZZARDO' || status.type === 'CAVALLO'
              || status.type === 'BLACKJACK') {
            this.gameState.set(PlayerStatus.VOTING);
            this.hasAnswered.set(false);
            this.selectedAnswer.set(null);
            this.startTime = Date.now();
          } else {
            this.gameState.set(PlayerStatus.WAITING);
          }
          break;

        case 'START_VOTING':
          this.roundActive.set(true);
          this.closeManual();
          this.isBlocked.set(false);
          this.onStartVoting(status.type, status.payload);
          break;

        case 'CHRISTMAS_TOGGLE':
          this.theme.setXmas(!!status.enabled);
          break;

        case 'QUIZ_STATE': {
          // Una manche nuova riapre i voti; il reveal invece blocca i telefoni.
          const manche = Number(status.state?.manche) || 0;
          this.quizManche.set(manche);
          if (status.state?.mancheReveal || status.state?.revealed) {
            this.gameState.set(PlayerStatus.WAITING);
          } else if (manche > 0 && this.hasAnswered() && this.answeredManche() === manche) {
            // La TV ha solo ripubblicato la stessa manche (sblocco del telefono,
            // riconnessione): chi ha già votato resta bloccato, non rivota.
            this.gameState.set(PlayerStatus.LOCKED);
          } else {
            this.hasAnswered.set(false);
            this.selectedAnswer.set(null);
            this.startTime = Date.now();
            this.gameState.set(PlayerStatus.VOTING);
          }
          break;
        }

        case 'BOMBA_STATE':
          this.applyBombaState(status.state);
          break;

        case 'TIME_BUZZER_START': {
          // Il via arma il tasto una volta per manche: da qui parte il
          // cronometro e STOP resta premibile fino alla manche successiva.
          // Nient'altro (né lo stato che arriva dopo ogni voto, né un via
          // ripetuto) riporta il tasto su ATTENDI.
          const startManche = Number((status as any).manche ?? 0) || this.buzzManche() || 1;
          if (this.buzzArmedManche !== startManche) {
            this.buzzArmedManche = startManche;
            this.buzzManche.set(startManche);
            this.buzzStartedAt = performance.now();
            this.buzzEliminated.set(false);
            this.buzzError.set('');
            this.buzzPhase.set('running');
            this.gameState.set(PlayerStatus.VOTING);
            this.vibrate(20);
          }
          break;
        }

        case 'TIME_BUZZER_STATE':
          if (status.state) {
            const state = status.state;
            const manche = Number(state.manche ?? 0);
            this.buzzTotal.set(Number(state.total) || 3);
            if (manche !== this.buzzManche()) {
              // La manche cambia l'etichetta, non il tasto: l'armo lo fa il via.
              this.buzzManche.set(manche);
              this.buzzError.set('');
            }
            // Durante la manche aperta il telefono resta giocabile: se la TV lo
            // segna tra gli eliminati il voto vale comunque, ma il tasto non
            // deve sparire o diventare ATTENDI a metà partita.
            this.buzzEliminated.set(false);
            if (this.buzzPhase() !== 'running' && this.buzzPhase() !== 'sent') {
              this.gameState.set(PlayerStatus.VOTING);
            }
          }
          break;

        case 'CASINO_STATE':
          this.applyCasinoState(status.state);
          break;

        case 'CAVALLO_STATE':
          this.applyCavalloState(status.state);
          break;

        case 'ULTIMA_SPIAGGIA_STATE':
          this.applyUltimaSpiaggiaState(status.state);
          break;

        case 'AZZARDO_STATE':
          this.applyAzzardoState(status.state);
          break;

        case 'BLACKJACK_STATE':
          this.applyBlackjackState(status.state);
          break;

        case 'BIGLIE_STATE':
          this.applyBiglieState(status.state);
          break;

        case 'AIR_HOCKEY_BATTLE_STATE':
          this.handleAirHockeyBattleState(status);
          break;

        case 'BONUS_ENDED':
          this.roundActive.set(false);
          this.questionType.set('QUIZ');
          this.gameState.set(PlayerStatus.WAITING);
          this.casinoState.set(null);
          this.cavalloState.set(null);
          this.biglieState.set(null);
          this.biglieChoice.set(null);
          this.azzardoState.set(null);
          this.casinoChoice.set(null);
          this.cavalloChoice.set(null);
          this.cavalloCategory.set(null);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.roundActive.set(false);
          this.cancelTimelineSend();
          this.speedLoadSeq++;
          this.speedTask.set(null);
          this.speedColorPicked.set([]);
          this.blackjackState.set(null);
          this.blackjackStand.set(false);
          this.timelineOrder.set([]);
          this.arenaEliminated.set(false);
          this.arenaQuestion.set(null);
          this.hockeyStateReady.set(false);
          this.hockeyGoal.set(null);
          this.hockeyLastGoalId = 0;
          if (this.hockeyGoalTimer) {
            clearTimeout(this.hockeyGoalTimer);
            this.hockeyGoalTimer = undefined;
          }
          // Round chiuso: spegni il microfono, altrimenti il telefono continua
          // a inviare urli (10 messaggi/s) anche nei round successivi.
          this.stopMicrophoneListening();
          this.stopBombaPolling();
          this.bombaStarted = false;
          this.bombaState.set(null);
          this.bombaFlash.set(null);
          this.bombaEventSeq = 0;
          this.casinoState.set(null);
          this.cavalloState.set(null);
          this.biglieState.set(null);
          this.biglieChoice.set(null);
          this.azzardoState.set(null);
          this.casinoChoice.set(null);
          this.cavalloChoice.set(null);
          this.cavalloCategory.set(null);
          this.gameState.set(PlayerStatus.WAITING);
          this.hasAnswered.set(false);
          this.selectedAnswer.set(null);
          this.isBlocked.set(false);
          break;

        case 'BLOCKED_ERROR':
          if (status.blockedPlayer === this.nickname()) {
            this.isBlocked.set(true);
            this.gameState.set(PlayerStatus.BLOCKED_ERROR);
          } else {

            if (!this.isBlocked()) {
              this.gameState.set(PlayerStatus.VOTING);
            }
          }
          break;

        case 'PLAYER_PRENOTATO':
          if (status.name === this.nickname()) {
            // Chi si è prenotato vede subito lo stato definitivo, non il
            // pulsante ancora attivo.
            this.hasAnswered.set(true);
            this.gameState.set(PlayerStatus.LOCKED);
          } else if (!this.isBlocked()) {
            this.gameState.set(PlayerStatus.WAITING_FOR_OTHER);
          }
          break;

        case 'GAME_PAUSED':
          this.closeManual();
          this.paused.set(true);
          this.pauseStartedAt = performance.now();
          break;

        case 'GAME_RESUMED':
          this.paused.set(false);
          if (this.pauseStartedAt) {
            // Il cronometro del Time Buzzer riprende da dove era, non dal
            // tempo trascorso in pausa.
            this.buzzStartedAt += performance.now() - this.pauseStartedAt;
            this.pauseStartedAt = 0;
          }
          break;

        case 'ARENA_ELIMINATED':
          if (status.playerName === this.nickname()) {
            this.arenaEliminated.set(true);
            this.arenaQuestion.set(null);
            this.gameState.set(PlayerStatus.ELIMINATED);
            this.stopMicrophoneListening();
            this.vibrate([80, 60, 80]);
          }
          break;

        case 'ARENA_ENDED':
          this.arenaQuestion.set(null);
          if (this.arenaEliminated()) {
            this.gameState.set(PlayerStatus.ELIMINATED);
          } else {
            this.gameState.set(PlayerStatus.WAITING);
          }
          break;
      }
    });
  }

  private setupPWA() {
    // Detect Standard PWA (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      if (!this.isAppInstalled()) {
        this.showInstallBanner.set(true);
      }
    });

    // Detect iOS (Manual instructions needed)
    if (this.isIos() && !this.isAppInstalled()) {
      this.showIosInstallBanner.set(true);
    }

    window.addEventListener('appinstalled', () => {
      this.showInstallBanner.set(false);
      this.showIosInstallBanner.set(false);
      this.deferredPrompt = null;
    });
  }

  private checkForUpdates() {
    if (!this.swUpdate.isEnabled) {

      return;
    }

    this.updateCheckInterval = setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 30 * 60 * 1000);

    this.versionUpdatesSub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.showUpdateBanner.set(true);
      });
  }

  private isAppInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  }

  async installPWA() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {

    } else {

    }

    this.deferredPrompt = null;
    this.showInstallBanner.set(false);
  }

  dismissInstallBanner() {
    this.showInstallBanner.set(false);
  }

  dismissIosInstallBanner() {
    this.showIosInstallBanner.set(false);
  }

  private isIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  updateApp() {
    this.swUpdate.activateUpdate().then(() => {
      window.location.reload();
    });
  }

  async startMicrophoneListening() {
    try {
      this.microphoneError.set(null);

      // 🔥 Il microfono RICHIEDE HTTPS su Chrome/Mobile (tranne localhost)
      if (!window.isSecureContext) {
        this.microphoneError.set('❌ Errore Sicurezza: Il microfono richiede una connessione protetta (HTTPS). Se stai testando in locale, usa localhost o attiva HTTPS.');
        console.error('🎤 getUserMedia non disponibile in contesti non sicuri (HTTP)');
        return;
      }

      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

      if (!hasGetUserMedia) {
        this.microphoneError.set('❌ Il tuo browser non supporta l\'accesso al microfono o la versione di Chrome è troppo vecchia.');
        return;
      }

      console.log('🎤 Richiedo permesso microfono...');

      // 🔥 Richiedi permesso microfono con constraints ottimizzati
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Vogliamo sentire il VOLUME!
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      console.log('✅ Permesso microfono concesso!');

      // 🔥 Setup Web Audio API con controlli compatibilità
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) {
        this.microphoneError.set('Web Audio API non supportato. Aggiorna il browser.');
        this.stopMicrophoneListening();
        return;
      }

      // Se esiste già un context disattivato, proviamo a riattivarlo
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      } else {
        this.audioContext = new AudioContextClass();
      }

      // IMPORTANTE: Su molti browser l'AudioContext parte 'suspended' finché non c'è un click
      if (this.audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext sospeso. Richiedo attivazione manuale...');
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.microphone.connect(this.analyser);

      this.isListening.set(true);

      console.log('🎤 Microfono attivo! Inizio rilevazione volume...');

      // Avvia rilevazione volume
      if (this.volumeTimer) clearInterval(this.volumeTimer);
      this.volumeTimer = setInterval(() => this.sampleVolume(), 100);

      // Vibrazione feedback
      this.vibrate(50);

    } catch (error: any) {
      console.error('❌ Errore microfono:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.microphoneError.set('❌ Permesso microfono negato. Clicca sulla barra degli indirizzi per abilitarlo.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.microphoneError.set('❌ Nessun microfono trovato. Collega un microfono o usa un altro dispositivo.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        this.microphoneError.set('❌ Microfono in uso da un\'altra app. Chiudi altre app che usano il microfono.');
      } else if (error.name === 'SecurityError') {
        this.microphoneError.set('❌ Accesso negato per motivi di sicurezza. Usa HTTPS.');
      } else {
        this.microphoneError.set(`❌ Errore microfono: ${error.message || 'Sconosciuto'}`);
      }

      this.stopMicrophoneListening();
    }
  }
  /**
   * 🔊 Rileva volume in tempo reale
   */
  private sampleVolume() {
    if (!this.analyser || !this.isListening()) {
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calcola volume medio (0-255)
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    // Converti in intensità 0-100 con boost per microfoni meno sensibili
    const intensity = Math.min(100, (average / 100) * 100); // Boost da /128 a /100

    this.currentVolume.set(intensity);
    this.isScreaming.set(intensity > 25); // Abbassata soglia da 30 a 25

    // 📡 Invia al backend solo durante la gara di urla (10 campioni/s).
    
    const nickname = (this.nickname() || '').trim();


    // Campionamento a 10 Hz: stabile anche quando la pagina non ridisegna.
  }

  

  stopMicrophoneListening() {
    // Ferma il campionamento del volume
    if (this.volumeTimer) {
      clearInterval(this.volumeTimer);
      this.volumeTimer = undefined;
    }

    // Chiudi stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track microfono fermato:', track.label);
      });
      this.mediaStream = undefined;
    }

    // Chiudi audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log('🛑 AudioContext chiuso');
      }).catch(err => {
        console.error('❌ Errore chiusura AudioContext:', err);
      });
      this.audioContext = undefined;
    }

    this.analyser = undefined;
    this.microphone = undefined;
    this.isListening.set(false);
    this.currentVolume.set(0);
    this.isScreaming.set(false);

    console.log('🛑 Microfono disattivato');
  }

  dismissUpdateBanner() {
    this.showUpdateBanner.set(false);
  }

  /** Anteprima dal vivo: tocca una palette e il setup cambia colore. */
  pickTheme(id: AppTheme): void {
    this.theme.set(id);
  }

  /** Passo 1 → 2: il nome deve essere valido prima di aprire la scelta del tema. */
  goToThemeStep(): void {
    const name = this.tempNickname.trim();
    if (name.length < 2 || name.length > 16) {
      this.reliability.lastError.set('Il nome deve contenere da 2 a 16 caratteri');
      return;
    }
    this.reliability.lastError.set(null);
    this.themeStep.set(true);
  }

  backToSetup(): void {
    this.themeStep.set(false);
  }

  async setNickname() {
    const name = this.tempNickname.trim();
    if (name.length < 2 || name.length > 16) {
      this.reliability.lastError.set('Il nome deve contenere da 2 a 16 caratteri');
      return;
    }
    if (!await this.reliability.start(this.gameId(), 'REMOTE', name)) return;
    this.nickname.set(name);
    this.showButtonTest.set(true);
    localStorage.setItem('nickname', name);
    this.ws.broadcastStatus(this.gameId(), { action: WsAction.JOIN_GAME, playerName: name });
    // Il colore si sceglie una volta sola: da qui in poi è la palette della
    // partita, la TV la adotta e il telefono non la cambia più.
    this.theme.lock();
    this.announceTheme(name);
    this.applyAvatar(name, this.pendingAvatar);
    this.pendingAvatar = null;
  }

  /**
   * La socket può essere ancora in apertura subito dopo l'ingresso: la palette
   * parte appena la connessione è viva, una volta sola.
   */
  private announceTheme(name: string): void {
    const send = () =>
      this.ws.broadcastStatus(this.gameId(), {
        action: WsAction.SELECT_THEME,
        theme: this.theme.theme(),
        playerName: name,
      });

    if (this.ws.connected()) {
      send();
      return;
    }
    this.ws.connectedAt$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => send());
  }

  private applyAvatar(
    name: string,
    avatar: string | null = this.playerAvatars.avatarFor(name),
  ): void {
    if (!avatar) return;
    this.playerAvatars.setAvatar(name, avatar);
    this.avatarPreview.set(avatar);
    this.playerAvatars.publish(name, this.gameId());
  }

  onAvatarFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.resizeAvatar(file)
      .then((avatar) => {
        this.avatarPreview.set(avatar);
        const name = this.nickname()?.trim();
        if (name) this.applyAvatar(name, avatar);
        else this.pendingAvatar = avatar;
      })
      .catch(() => {
        // File illeggibile o canvas bloccato: si resta senza avatar.
      });
  }

  /** Ritaglia al centro e comprime: la foto viaggia nel WebSocket, deve restare leggera. */
  private resizeAvatar(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('image'));
        image.onload = () => {
          const size = 192;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas'));
            return;
          }
          const side = Math.min(image.width, image.height);
          const sx = (image.width - side) / 2;
          const sy = (image.height - side) / 2;
          ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Apre il manuale direttamente su una scheda (anteprima sim-duo). Salta il
   * controllo "in squadra": nella preview non c'è nessun round aperto.
   */
  openManualAt(key: string): void {
    const entry = MANUAL_ENTRIES.find((item) => item.key === key);
    if (!entry) return;
    this.manualEntry.set(entry);
    this.manualOpen.set(true);
    this.cdr.markForCheck();
  }

  /** Nome leggibile del gioco per l'intestazione (B1). */
  openManual(): void {
    if (!this.canOpenManual() || this.manualOpen()) return;
    this.manualEntry.set(null);
    this.manualOpen.set(true);
    history.pushState({ manual: true }, '');
    this.cdr.markForCheck();
  }

  /** Chiude il manuale e, se richiesto, rimuove la voce di cronologia. */
  closeManual(back = true): void {
    if (!this.manualOpen()) return;
    this.manualOpen.set(false);
    this.manualEntry.set(null);
    if (back && history.state?.manual) history.back();
    this.cdr.markForCheck();
  }

  /** Il tasto indietro o il gesto del browser chiudono il manuale, non la partita. */
  @HostListener('window:popstate')
  onManualBack(): void {
    if (!this.manualOpen()) return;
    this.manualOpen.set(false);
    this.manualEntry.set(null);
    this.cdr.markForCheck();
  }

  manualMeta(entry: ManualEntry): string {
    if (entry.kind === 'BONUS') {
      const afterAct = (entry as ManualBonus).afterAct;
      return afterAct ? `BONUS · DOPO L'ATTO ${afterAct}` : 'BONUS';
    }
    const occurrences = (entry as ManualGame).occurrences;
    return `${occurrences} ${occurrences === 1 ? 'ROUND' : 'ROUND'} IN SCALETTA`;
  }

  /** Nome leggibile del gioco per l'intestazione (B1). */
  remoteModeName(): string {
    const names: Record<string, string> = {
      QUIZ: '🎯 Quiz',
      MUSIC: '🎵 Canzone',
      IMAGE_BLUR: '🕵️ Indovina chi',
      WHEEL_OF_FORTUNE: '🎡 Ruota',
      TIMELINE: '🕰️ Timeline',
      TIME_BUZZER: '⏱️ Time Buzzer',
      BOMBA: '💣 Bomba',
      SPEED_RUSH: '⚡ Speed Rush',
      AIR_HOCKEY_BATTLE: '🏒 Air Hockey',
      ARENA: '🏟️ Arena',
      AZZARDO: '🎲 Azzardo',
      BLACKJACK: '🃏 Blackjack',
      ULTIMA_SPIAGGIA: '🏝️ Ultima spiaggia',
      CAVALLO: '🐎 Cavallo',
      BONUS_CASINO: '🎰 Roulette',
      BONUS_BASKET: '🏀 Basket',
      BONUS_CAVALLO: '🐎 Cavallo',
      BONUS_BIGLIE: '🎱 Biglie',
    };
    return names[this.questionType()] ?? '🎮 PubGame';
  }

  /** Variante di attesa stabile per telefono: due telefoni diversi non coincidono. */
  waitVariant(): number {
    const name = this.nickname() ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash % 6;
  }

  waitIcon(): string {
    return ['🎲', '✒️', '🃏', '🪙', '⚽', '🫧'][this.waitVariant()];
  }

  sendVote(index: number) {
    if (!this.inputReady()) return;
    const responseTimeMs = Date.now() - this.startTime;
    if (!this.ws.sendAnswer(this.gameId(), this.nickname()!, index, responseTimeMs)) {
      this.reliability.lastError.set('Risposta non inviata: attendi la riconnessione e riprova.');
      return;
    }
    this.reliability.lastError.set(null);
    this.selectedAnswer.set(index);
    this.hasAnswered.set(true);
    if (this.questionType() === 'QUIZ') this.answeredManche.set(this.quizManche());
    this.gameState.set(PlayerStatus.LOCKED);
    this.vibrate(50);
  }

  sendBuzz() {
    if (!this.inputReady()) return;
    const time = Date.now() - this.startTime;
    if (!this.ws.sendAnswer(this.gameId(), this.nickname()!, -1, time)) {
      this.reliability.lastError.set('Prenotazione non inviata: attendi la riconnessione e riprova.');
      return;
    }
    this.reliability.lastError.set(null);
    this.gameState.set(PlayerStatus.LOCKED);
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string, payload?: any) {
    this.gameState.set(PlayerStatus.VOTING);
    this.questionType.set(type as any);
    if (payload?.round) this.roundNumber.set(Number(payload.round));
    if (payload?.roundTotal) this.roundTotal.set(Number(payload.roundTotal));
    this.roundStartTime = Date.now();
    this.startTime = Date.now();
    this.hasAnswered.set(false);
    this.selectedAnswer.set(null);


    if (type === 'ARENA') {
      this.arenaEliminated.set(false);
      this.generateNextArenaQuestion();
    } else if (type === 'TIMELINE') {
      const data = this.parsePayload(payload);
      const cards = data?.items ?? [];
      this.timelineRoundId = String(data?.roundId ?? this.lastSnapshotRoundKey);
      this.timelineCards.set(cards);
      // Si parte dall'ordine mostrato: si trascina per correggerlo.
      this.timelineOrder.set(cards.map((card: any) => card.id));
      // Anche chi non tocca nulla ha già una risposta valida: l'ordine iniziale.
      this.scheduleTimelineSend();
    } else if (type === 'TIME_BUZZER') {
      // START_VOTING esce dopo il 3-2-1, a volte dopo il via stesso: qui non si
      // tocca il tasto, se no lo riportava su ATTENDI appena armato. Ad armarlo
      // pensa solo il via, a scaricarlo solo il via della manche successiva.
      this.buzzEliminated.set(false);
      this.buzzError.set('');
    } else if (type === 'BOMBA') {
      this.bombaState.set(null);
      this.bombaFlash.set(null);
      this.bombaEventSeq = 0;
      this.bombaStarted = true;
      this.startBombaPolling();
    } else if (type === 'BONUS_CASINO') {
      this.casinoState.set(null);
      this.casinoChoice.set(null);
    } else if (type === 'BONUS_BIGLIE') {
      this.biglieState.set(null);
      this.biglieChoice.set(null);
      this.biglieKey = '';
    } else if (type === 'BONUS_CAVALLO' || type === 'CAVALLO') {
      // Il Cavallo gioca la stessa schermata in round e in bonus: la TV manda
      // CAVALLO_STATE, quindi qui basta azzerare lo stato della sfida.
      this.cavalloState.set(null);
      this.cavalloChoice.set(null);
      this.cavalloCategory.set(null);
      this.questionType.set('BONUS_CAVALLO');
    } else if (type === 'ULTIMA_SPIAGGIA') {
      this.ultimaSpiaggiaState.set(null);
      this.ultimaSpiaggiaLevel.set(null);
      this.ultimaSpiaggiaChoice.set(null);
      this.ultimaSpiaggiaKey = '';
    } else if (type === 'BLACKJACK') {
      // Lo stato non si azzera qui: il primo BLACKJACK_STATE arriva prima di
      // START_VOTING e cancellarlo lascerebbe il tavolo 1 senza carte per un
      // secondo, proprio mentre deve decidere.
      this.blackjackStand.set(false);
    } else if (type === 'SPEED_RUSH') {
      this.startSpeedRush();
    } else if (type === 'AIR_HOCKEY_BATTLE') {
      this.hockeyStateReady.set(false);
      this.hockeyHits.set(0);
      this.hockeyGoal.set(null);
      this.hockeyLastGoalId = 0;
    }
  }

  // ---------------------------------------------------------------- BOMBA

  private applyCasinoState(state: any): void {
    if (!state) return;

    this.casinoState.set(state);
    this.questionType.set('BONUS_CASINO');
    const key = `${state.manche}:${state.phase}`;
    if (key !== this.casinoKey) {
      this.casinoKey = key;
      this.casinoChoice.set(null);
    }
    this.gameState.set(state.phase === GamePhase.FINALE ? PlayerStatus.WAITING : PlayerStatus.VOTING);
  }

  private applyCavalloState(state: any): void {
    if (!state) return;

    this.cavalloState.set(state);
    this.questionType.set('BONUS_CAVALLO');
    const key = `${state.phase}:${state.question?.index ?? 0}`;
    if (key !== this.cavalloKey) {
      this.cavalloKey = key;
      this.cavalloChoice.set(null);
      if (state.phase === 'CATEGORY') this.cavalloCategory.set(null);
    }
    this.gameState.set(state.phase === GamePhase.FINALE ? PlayerStatus.WAITING : PlayerStatus.VOTING);
  }

  private applyBiglieState(state: any): void {
    if (!state) return;

    this.biglieState.set(state);
    this.questionType.set('BONUS_BIGLIE');
    // Ogni turno di scelta è un momento nuovo: la vecchia scelta va scartata.
    const key = `${state.phase}:${state.raceIndex ?? 0}:${state.currentPlayer ?? ''}`;
    if (key !== this.biglieKey) {
      this.biglieKey = key;
      this.biglieChoice.set(null);
    }
    this.gameState.set(state.phase === GamePhase.FINALE ? PlayerStatus.WAITING : PlayerStatus.VOTING);
  }

  bigliePick(marbleId: string): void {
    const player = this.nickname();
    const state = this.biglieState();
    if (!player || !state || this.biglieChoice() !== null) return;
    if (state.phase !== GamePhase.PICK || state.currentPlayer !== player) return;

    const marble = (state.marbles ?? []).find((entry: any) => entry.id === marbleId && !entry.owner);
    if (!marble) return;

    this.biglieChoice.set(marbleId);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.BIGLIE_ACTION,
      playerName: player,
      kind: 'PICK',
      value: marbleId,
    });
    this.vibrate(30);
  }

  biglieMyRow(): any {
    const player = this.nickname();
    return (this.biglieState()?.standings ?? []).find((row: any) => row.playerName === player) ?? null;
  }

  private applyUltimaSpiaggiaState(state: any): void {
    if (!state) return;

    this.ultimaSpiaggiaState.set(state);
    this.questionType.set('ULTIMA_SPIAGGIA');
    // L'id dell'occorrenza cambia anche quando la categoria estratta è la stessa:
    // senza questo, la scelta della manche precedente lascerebbe i livelli bloccati.
    const key = `${state.occurrenceId ?? state.category ?? state.round ?? 0}:${state.phase}`;
    if (key !== this.ultimaSpiaggiaKey) {
      this.ultimaSpiaggiaKey = key;
      if (state.phase === 'LEVEL') this.ultimaSpiaggiaLevel.set(null);
      if (state.phase === 'QUESTION') this.ultimaSpiaggiaChoice.set(null);
    }
    this.gameState.set(
      state.phase === 'LEVEL' || state.phase === 'QUESTION' ? PlayerStatus.VOTING : PlayerStatus.WAITING,
    );
  }

  private applyAzzardoState(state: any): void {
    if (!state) return;

    this.azzardoState.set(state);
    this.questionType.set('AZZARDO');
    const key = `${state.phase}:${state.manche ?? 0}`;
    if (key !== this.azzardoKey) {
      this.azzardoKey = key;
      if (state.phase === 'BET') {
        const counts = Array.isArray(this.azzardoMe()?.chips) ? this.azzardoMe().chips : [];
        const options = state.options?.length ?? 0;
        this.azzardoChips.set(Array.from({ length: options }, (_, index) => Number(counts[index]) || 0));
        this.azzardoSent.set(false);
      }
    }
    // Anche il reveal resta dentro il pannello Azzardo: chiudere la manche non
    // deve far sparire il telefono dietro la schermata d'attesa.
    this.gameState.set(state.phase === 'BET' || state.phase === 'REVEAL' ? 'VOTING' : 'WAITING');
  }

  ultimaSpiaggiaPickLevel(level: number): void {
    const player = this.nickname();
    const state = this.ultimaSpiaggiaState();
    if (!player || state?.phase !== 'LEVEL' || this.ultimaSpiaggiaLevel() !== null) return;
    if (this.ultimaSpiaggiaUsed(level)) return;

    this.ultimaSpiaggiaLevel.set(level);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.ULTIMA_SPIAGGIA_ACTION,
      playerName: player,
      kind: 'LEVEL',
      value: level,
    });
    this.vibrate(20);
  }

  ultimaSpiaggiaAnswer(index: number): void {
    const player = this.nickname();
    if (!player || this.ultimaSpiaggiaChoice() !== null) return;

    this.ultimaSpiaggiaChoice.set(index);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.ULTIMA_SPIAGGIA_ACTION,
      playerName: player,
      kind: 'ANSWER',
      value: index,
    });
    this.vibrate(30);
  }

  /** Riga della propria squadra: livello scelto, livelli usati ed esito. */
  ultimaSpiaggiaRow(): any {
    const player = this.nickname();
    return (this.ultimaSpiaggiaState()?.rows ?? []).find((row: any) => row.playerName === player) ?? null;
  }

  ultimaSpiaggiaMyLevel(): number | null {
    const level = this.ultimaSpiaggiaRow()?.level;
    return typeof level === 'number' ? level : null;
  }

  /** La domanda è quella del livello scelto: stessa per chi ha scelto lo stesso. */
  ultimaSpiaggiaMyQuestion(): any {
    const level = this.ultimaSpiaggiaMyLevel();
    if (level === null) return null;
    return (this.ultimaSpiaggiaState()?.questions ?? []).find((question: any) => question.level === level) ?? null;
  }

  ultimaSpiaggiaUsed(level: number): boolean {
    const used: number[] = this.ultimaSpiaggiaRow()?.used ?? [];
    return used.includes(level);
  }

  halfLevel(): number {
    return Math.round((this.ultimaSpiaggiaMyLevel() ?? 0) / 2);
  }

  /** Riga dello stato che riguarda questa squadra. */
  private azzardoMe(): any {
    return (this.azzardoState()?.ready ?? [])
      .find((entry: any) => entry.playerName === this.nickname()) ?? null;
  }

  /** Punti che la propria squadra può ancora puntare in questa manche. */
  azzardoMaxBet(): number {
    return Number(this.azzardoMe()?.maxBet ?? 0);
  }

  /** Punti reali in classifica (distinti dalla puntata massima). */
  azzardoMyPoints(): number {
    return Number(this.azzardoMe()?.points ?? 0);
  }

  /** Chi ha 0 punti non può puntare: niente invio a vuoto. */
  azzardoCanBet(): boolean {
    return this.azzardoMaxBet() > 0;
  }

  azzardoChipTotal(): number {
    return this.azzardoChips().reduce((sum, value) => sum + value, 0);
  }

  /** Fiches nel salvadanaio: le avanzate si sommano alle dieci nuove. */
  azzardoMyBank(): number {
    const bank = Number(this.azzardoMe()?.chipsBank);
    return Number.isFinite(bank) ? bank : (this.azzardoState()?.chips ?? 10);
  }

  azzardoChipsLeft(): number {
    return Math.max(0, this.azzardoMyBank() - this.azzardoChipTotal());
  }

  /** Tetto di questa squadra: cresce con le fiches avanzate, fino al massimo. */
  azzardoMyChipCap(): number {
    const cap = Number(this.azzardoMe()?.chipsCap);
    return Number.isFinite(cap) ? cap : (Number(this.azzardoState()?.chipCap) || 10);
  }

  /** Fiches giocabili: salvadanaio, tetto crescente e credito in punti. */
  azzardoMaxChips(): number {
    const state = this.azzardoState();
    const value = Number(state?.chipValue ?? 20) || 20;
    return Math.max(0, Math.min(
      this.azzardoMyBank(),
      this.azzardoMyChipCap(),
      Math.floor(this.azzardoMaxBet() / value),
    ));
  }

  /** Gettone disegnati nell'impiastro dell'opzione: massimo cinque. */
  azzardoChipFiches(index: number): number[] {
    const count = Math.min(5, this.azzardoChips()[index] ?? 0);
    return Array.from({ length: count }, (_, i) => i);
  }

  /** Come le fiches diventano punti in questa manche: quota e perdita reali. */
  azzardoConvertHint(): string {
    const state = this.azzardoState();
    const value = Number(state?.chipValue ?? 20) || 20;
    if (!this.azzardoCanBet()) return `Pochi punti: nessuna fiche da ${value} punti.`;
    const odds = Number(state?.odds ?? 2) || 2;
    const loss = Math.round((Number(state?.lossMultiplier) || 1) * 100);
    const winCap = Number(state?.winCap) || AZZARDO_MAX_WIN_PER_MANCHE;
    return `Fiche da ${value} pt · giuste ×${odds} · sbagliate −${loss}% · max ${winCap} a manche`;
  }

  /**
   * Le fiches si spostano in locale: al server arriva solo la puntata
   * confermata. Toccarle non è una puntata (niente invii automatici).
   */
  azzardoAddChip(index: number, delta: number): void {
    const player = this.nickname();
    const state = this.azzardoState();
    if (!player || state?.phase !== 'BET' || !this.azzardoCanBet() || this.azzardoSent()) return;
    if (index < 0 || index >= (state.options?.length ?? 0)) return;

    const chips = Array.from({ length: state.options?.length ?? 0 }, (_, i) => this.azzardoChips()[i] ?? 0);
    if (delta > 0 && this.azzardoChipTotal() >= this.azzardoMaxChips()) return;
    if (delta < 0 && (chips[index] ?? 0) <= 0) return;

    chips[index] = Math.max(0, (chips[index] ?? 0) + delta);
    this.azzardoChips.set(chips);
    this.vibrate(10);
  }

  /**
   * Conferma esplicita: senza almeno una fiche non si puntata, e la manche
   * non parte mai con una puntata inventata dal telefono.
   */
  azzardoConfirmBet(): void {
    const player = this.nickname();
    const state = this.azzardoState();
    if (!player || state?.phase !== 'BET' || !this.azzardoCanBet() || this.azzardoSent()) return;

    const chips = Array.from(
      { length: state.options?.length ?? 0 },
      (_, i) => this.azzardoChips()[i] ?? 0
    );
    if (chips.reduce((sum, value) => sum + value, 0) <= 0) {
      this.reliability.lastError.set('Metti almeno una fiche prima di confermare.');
      return;
    }

    this.azzardoSent.set(true);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.AZZARDO_ACTION,
      playerName: player,
      kind: 'BET',
      value: { chips },
    });
    this.vibrate([40, 30, 40]);
  }

  /** Un tocco sulla risposta aggiunge una fiche all'opzione. */
  azzardoPick(index: number): void {
    this.azzardoAddChip(index, 1);
  }

  azzardoRow(): any {
    const player = this.nickname();
    return (this.azzardoState()?.rows ?? []).find((row: any) => row.playerName === player) ?? null;
  }


  casinoAct(choice: string): void {
    const state = this.casinoState();
    const player = this.nickname();
    if (!state || !player || this.casinoChoice() !== null) return;

    const options: string[] = state.options ?? [];
    if (!options.includes(choice)) return;

    this.casinoChoice.set(choice);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.CASINO_ACTION,
      playerName: player,
      manche: state.manche,
      choice,
    });
    this.vibrate(30);
  }

  // ------------------------------------------------------------- BLACK JACK

  /**
   * Il tavolo gioca solo quando la TV gli passa la mano. Dopo «stai» la mano
   * è chiusa: la TV ignora comunque qualsiasi altra azione.
   */
  blackjackAct(kind: 'HIT' | 'STAND'): void {
    const state = this.blackjackState();
    const player = this.nickname();
    if (!state || !player) return;
    if (state.phase !== 'DECIDE' || state.currentTable !== player) return;
    if (this.blackjackStand()) return;
    if (kind === 'HIT' && Number(state.handTotal) >= 21) return;

    if (kind === 'STAND') this.blackjackStand.set(true);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.BLACKJACK_ACTION,
      playerName: player,
      kind,
    });
    this.vibrate(kind === 'STAND' ? 30 : 20);
  }

  /** Punti leggibili sul telefono, uguali per vincite e perdite. */
  signedPoints(value: number | null | undefined): string {
    const points = Number(value) || 0;
    if (points === 0) return 'nessun punto';
    return `${points > 0 ? '+' : ''}${points} punti`;
  }

  isRedCard(card: string): boolean {
    const value = String(card ?? '');
    return value.includes('♥') || value.includes('♦');
  }

  private applyBlackjackState(state: any): void {
    if (!state) return;

    const key = `${state.phase}:${state.index}:${state.currentTable}`;
    if (key !== this.blackjackKey) {
      this.blackjackKey = key;
      this.blackjackStand.set(false);
    }

    this.blackjackState.set(state);
    this.questionType.set('BLACKJACK');
    this.gameState.set(state.phase === GamePhase.FINALE ? PlayerStatus.WAITING : PlayerStatus.VOTING);
  }

  cavalloPickCategory(category: string): void {
    const state = this.cavalloState();
    const player = this.nickname();
    if (!state || state.phase !== 'CATEGORY' || !player || this.cavalloCategory() !== null) return;
    if (!(state.categories ?? []).includes(category)) return;

    this.cavalloCategory.set(category);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.CAVALLO_ACTION,
      playerName: player,
      kind: 'CATEGORY',
      value: category,
    });
    this.vibrate(30);
  }

  cavalloMyRow(): any {
    const player = this.nickname();
    return (this.cavalloState()?.reveal?.rows ?? []).find((row: any) => row.playerName === player) ?? null;
  }

  cavalloAnswer(index: number): void {
    const state = this.cavalloState();
    const player = this.nickname();
    if (!state || state.phase !== 'QUESTION' || !player || this.cavalloChoice() !== null) return;

    const options: string[] = state.question?.options ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return;

    this.cavalloChoice.set(String(index));
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.CAVALLO_ACTION,
      playerName: player,
      kind: 'ANSWER',
      value: index,
    });
    this.vibrate(30);
  }

  private startBombaPolling(): void {
    this.stopBombaPolling();
    this.bombaPoll = setInterval(() => this.pollBombaState(), 600);
    this.pollBombaState();
  }

  private stopBombaPolling(): void {
    if (this.bombaPoll) {
      clearInterval(this.bombaPoll);
      this.bombaPoll = undefined;
    }
  }

  private pollBombaState(): void {
    const player = this.nickname();
    if (!this.bombaStarted || this.bombaPollBusy || !player) return;

    this.bombaPollBusy = true;
    this.gameService.getBombaState(this.gameId(), player).subscribe({
      next: (state) => {
        this.applyBombaState(state);
        this.bombaPollBusy = false;
      },
      error: () => {
        this.bombaPollBusy = false;
      },
    });
  }

  private applyBombaState(state: any): void {
    if (!state) return;

    this.bombaState.set(state);
    if (state.active === false) {
      this.stopBombaPolling();
      this.gameState.set(PlayerStatus.WAITING);
      return;
    }

    if (state.paused) {
      this.gameState.set(PlayerStatus.WAITING);
      return;
    }

    const you = state.you ?? null;
    this.gameState.set(PlayerStatus.VOTING);

    // Ogni scelta è già risolta dal server: qui serve solo il feedback.
    const event = state.lastEvent;
    const seq = Number(event?.seq) || 0;
    if (seq > this.bombaEventSeq) {
      this.bombaEventSeq = seq;
      const mine = event?.player && event.player === this.nickname();
      if (event?.kind === 'bomb') {
        this.flashBomba(mine ? '💥 BOOM!' : `💥 ${event.player}: bomba`);
        this.vibrate(mine ? [320, 120, 320, 120, 320] : [120, 60, 120]);
      } else if (event?.kind === 'safe' && mine) {
        this.vibrate(25);
      }
    }

    if (you?.yourTurn) {
      this.vibrate(20);
    }
  }

  /** Bomba: si sceglie solo quando il server dà il turno alla propria squadra. */
  pickBombaCell(cellId: number): void {
    const player = this.nickname();
    const state = this.bombaState();
    if (!player || !state || state.active === false) return;
    if (!state.you?.yourTurn || state.you?.out) return;

    this.gameService.pickBomba(this.gameId(), player, cellId).subscribe({
      next: (next: any) => {
        this.applyBombaState(next);
      },
      error: (error: any) => {
        this.flashBomba(error?.error?.error ?? 'Scelta non riuscita');
        this.pollBombaState();
      },
    });
  }

  private flashBomba(text: string): void {
    this.bombaFlash.set(text);
    if (this.bombaFlashTimer) clearTimeout(this.bombaFlashTimer);
    this.bombaFlashTimer = setTimeout(() => {
      this.bombaFlash.set(null);
      this.bombaFlashTimer = undefined;
    }, 2400);
  }


  // ------------------------------------------------- Giochi simultanei

  private parsePayload(payload: any): any {
    if (!payload) return {};
    let value = payload;
    // Alcuni snapshot salvano il payload come stringa JSON dentro un'altra
    // stringa JSON: si scarta l'involucro finché non resta un oggetto.
    for (let i = 0; i < 2 && typeof value === 'string'; i++) {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    return typeof value === 'object' && value !== null ? value : {};
  }

  orderedCards(): Array<{ id: number; label: string }> {
    const cards = this.timelineCards();
    const order = this.timelineOrder();
    return order
      .map((id) => cards.find((card) => card.id === id))
      .filter((card): card is { id: number; label: string } => !!card);
  }

  startDrag(event: PointerEvent, id: number): void {
    event.preventDefault();
    this.dragId = id;
    this.draggingId.set(id);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.vibrate(10);
  }

  onDragMove(event: PointerEvent): void {
    if (this.dragId === null) return;

    // La carta trascinata segue il dito e resta sotto di lui: se la si conta
    // come bersaglio, l'ordine non cambia mai e la carta non si deposita.
    const from = this.timelineOrder().indexOf(this.dragId);
    const under = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(event.clientX, event.clientY)
      : [document.elementFromPoint?.(event.clientX, event.clientY)];
    const over = under
      .map((element) => (element instanceof HTMLElement ? element.closest<HTMLElement>('.tl-drag-card') : null))
      .map((card) => (card ? Number(card.dataset['index']) : NaN))
      .find((index) => Number.isInteger(index) && index !== from);
    if (over === undefined || from < 0 || from === over) return;

    const order = [...this.timelineOrder()];

    order.splice(from, 1);
    order.splice(over, 0, this.dragId);
    this.timelineOrder.set(order);
    this.scheduleTimelineSend();
    this.vibrate(6);
  }

  endDrag(): void {
    this.dragId = null;
    this.draggingId.set(null);
  }

  moveCard(id: number, delta: number): void {
    const order = [...this.timelineOrder()];
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    this.timelineOrder.set(order);
    this.scheduleTimelineSend();
    this.vibrate(10);
  }

  /** L'ordine è la risposta: si invia da solo, con un piccolo antirimbalzo. */
  private scheduleTimelineSend(): void {
    this.cancelTimelineSend();
    this.timelineSendHandle = setTimeout(() => {
      this.timelineSendHandle = undefined;
      this.sendTimelineAnswer();
    }, 350);
  }

  private cancelTimelineSend(): void {
    if (this.timelineSendHandle) clearTimeout(this.timelineSendHandle);
    this.timelineSendHandle = undefined;
  }

  sendTimelineAnswer(): void {
    const playerName = this.nickname();
    if (!playerName || this.questionType() !== 'TIMELINE' || this.gameState() !== PlayerStatus.VOTING
      || !this.timelineCards().length || this.timelineOrder().length !== this.timelineCards().length) return;

    const key = this.reliability.idempotencyKey('timeline',
      `${this.timelineRoundId}:${this.timelineInstanceId}:${++this.timelineSendSequence}`);
    this.gameService.submitTimeline(this.gameId(), playerName, this.timelineOrder(), key, this.timelineRoundId).subscribe({
      error: () => this.reliability.lastError.set('Ordine Timeline non registrato: riprova.'),
      next: () => this.reliability.lastError.set(null),
    });
  }

  ultimaSpiaggiaState = signal<any>(null);
  ultimaSpiaggiaLevel = signal<number | null>(null);
  ultimaSpiaggiaChoice = signal<number | null>(null);
  private ultimaSpiaggiaKey = '';

  /**
   * Time Buzzer: l'unico tocco è STOP. Il tempo si misura con
   * `performance.now()` dalla ricezione del via, poi lo valida il server.
   */
  toggleBuzz(): void {
    if (this.buzzEliminated() || this.buzzPhase() !== 'running') return;

    const ms = Math.round(performance.now() - this.buzzStartedAt);
    this.buzzPhase.set('sent');
    this.vibrate([20, 30, 20]);

    const playerName = this.nickname() ?? '';
    if (!playerName) return;

    void firstValueFrom(
      this.gameService.submitTimeBuzzer(this.gameId(), playerName, ms)
    )
      .then(() => undefined)
      .catch((error: any) => {
        this.buzzPhase.set('idle');
        this.buzzError.set(
          error?.status === 409
            ? 'Manche chiusa: tempo non registrato.'
            : 'Tempo non plausibile: non registrato.'
        );
      });
  }

  startSpeedRush(): void {
    this.speedLoadSeq++;
    this.speedColorPicked.set([]);
    this.speedTask.set(null);
    this.loadSpeedTask(0);
  }

  /** La prova arriva dal server, senza la soluzione. */
  private loadSpeedTask(attempt = 0): void {
    const gameId = this.gameId();
    if (!gameId) return;

    const seq = ++this.speedLoadSeq;
    this.gameService.getSpeedRushTask(gameId).subscribe({
      next: (task) => {
        if (seq !== this.speedLoadSeq) return;
        this.speedColorPicked.set([]);
        this.speedTask.set(task);
      },
      error: () => {
        if (seq !== this.speedLoadSeq || attempt >= 12) return;
        setTimeout(() => this.loadSpeedTask(attempt + 1), 450);
      },
    });
  }

  speedPickMath(value: number): void {
    const task = this.speedTask();
    if (task?.kind !== 'math') return;
    this.submitSpeedAnswer(value);
  }

  /** Mischia colori: si scelgono i due primari che danno il colore in cima. */
  speedPickColor(name: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'colors' || this.speedColorPicked().includes(name)) return;

    const picked = [...this.speedColorPicked(), name];
    this.vibrate(10);
    if (picked.length >= 2) {
      this.submitSpeedAnswer(picked);
      return;
    }
    this.speedColorPicked.set(picked);
  }

  speedPickFlag(name: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'flag') return;
    this.submitSpeedAnswer(name);
  }

  speedPickWord(value: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'words') return;
    this.submitSpeedAnswer(value);
  }

  speedPickTranslate(value: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'translate') return;
    this.submitSpeedAnswer(value);
  }

  /** Un solo invio per prova: la correttezza e la corsia le aggiorna il server. */
  private submitSpeedAnswer(answer: unknown): void {
    const task = this.speedTask();
    if (!task) return;

    const seq = this.speedLoadSeq;
    this.speedTask.set(null);
    this.speedColorPicked.set([]);

    const taskId = (task as any).taskId as string;
    this.gameService.answerSpeedRush(this.gameId(), taskId, answer).subscribe({
      next: (response: any) => {
        if (seq !== this.speedLoadSeq) return;
        this.vibrate(response?.correct ? 30 : [40, 40, 40]);
        this.speedColorPicked.set([]);
        if (response?.nextTask) {
          this.speedTask.set(response.nextTask);
          return;
        }
        if (!response?.finished && this.roundActive()) {
          setTimeout(() => this.loadSpeedTask(), 300);
        }
      },
      error: () => {
        if (seq !== this.speedLoadSeq) return;
        this.reliability.lastError.set('Risposta Speed Rush non registrata: riprova.');
        this.speedTask.set(task);
      },
    });
  }

  /** Dove guardare la TV: la mia partita e il suo angolo nel multiview. */
  hockeyCorner(): string {
    const index = this.hockeyCourtIndex();
    const total = this.hockeyCourtTotal();
    if (!index || !total) return 'CAMPO IN TV';
    if (total === 1) return 'SCHERMO INTERO';
    if (total === 2) return index === 1 ? 'ALTO' : 'BASSO';
    if (total <= 4) {
      return ['ALTO SINISTRA', 'ALTO DESTRA', 'BASSO SINISTRA', 'BASSO DESTRA'][index - 1]
        ?? `CAMPO ${index}`;
    }
    return `CAMPO ${index} DI ${total}`;
  }

  sendHockeyAnswer(index: number): void {
    if (this.hasAnswered() || !this.hockeyMyTurn() || !this.nickname()) return;

    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.AIR_HOCKEY_BATTLE_ANSWER,
      playerName: this.nickname(),
      answerIndex: index,
    });
    this.hasAnswered.set(true);
    this.vibrate(40);
  }

  /** Lettera della risposta scelta, vuota se il giocatore non ha ancora toccato nulla. */
  chosenLetter(): string {
    const index = this.selectedAnswer();
    return index === null ? '' : this.letter(index);
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  difficultyLabel(difficulty?: string): string {
    if (difficulty === 'EASY') return 'FACILE';
    if (difficulty === 'HARD') return 'DIFFICILE';
    return 'MEDIA';
  }

  private handleAirHockeyBattleState(status: any): void {
    const me = (this.nickname() ?? '').trim().toLowerCase();
    const court = (status.courts ?? []).find((c: any) =>
      c.a.playerName.trim().toLowerCase() === me || c.b.playerName.trim().toLowerCase() === me
    );
    if (!court) return;

    this.hockeyStateReady.set(true);
    const mine: 'a' | 'b' = court.a.playerName.trim().toLowerCase() === me ? 'a' : 'b';
    const other: 'a' | 'b' = mine === 'a' ? 'b' : 'a';

    this.questionType.set('AIR_HOCKEY_BATTLE');
    this.hockeyMyScore.set(court[mine].score);
    this.hockeyOpponentScore.set(court[other].score);
    this.hockeyOpponent.set(court[other].playerName);
    this.hockeyCourtIndex.set(Number(court.index ?? court.id + 1));
    this.hockeyCourtTotal.set(Number(status.courts?.length ?? 0));
    this.hockeyServeLeft.set(court.serveLeft ?? 0);
    this.hockeyQuestion.set(court.question ?? null);
    this.hockeyMyTurn.set(!court.winner && court.turn === mine);
    this.hasAnswered.set(false);
    this.selectedAnswer.set(null);

    const event = court.lastEvent;
    if (event?.kind === 'goal' && event.id !== this.hockeyLastGoalId) {
      this.hockeyLastGoalId = event.id;
      const scored = event.side === mine;
      this.hockeyGoal.set({
        id: event.id,
        scored,
        mine: court[mine].score,
        opponent: court[other].score,
      });
      this.vibrate(scored ? [60, 40, 60] : [140, 60, 140]);
      if (this.hockeyGoalTimer) clearTimeout(this.hockeyGoalTimer);
      this.hockeyGoalTimer = setTimeout(() => this.hockeyGoal.set(null), 2400);
    }

    if (court.winner) {
      this.hockeyLastResult.set(court.winner === court[mine].playerName ? 'HAI VINTO IL SET!' : 'SET PERSO');
      this.gameState.set(PlayerStatus.WAITING);
      return;
    }

    this.gameState.set(PlayerStatus.VOTING);

    if (event?.kind === 'return') {
      this.hockeyLastResult.set(event.side === mine ? 'PALLA RIMANDATA!' : 'PALLA IN ARRIVO');
    } else if (event?.kind === 'goal') {
      this.hockeyLastResult.set(event.side === mine ? 'GOL PER TE!' : 'GOL SUBITO');
    } else {
      this.hockeyLastResult.set(null);
    }
  }

  generateNextArenaQuestion() {
    if (this.arenaEliminated() || this.gameState() === PlayerStatus.ELIMINATED) return;
    this.isFetchingQuestion.set(true);
    this.arenaQuestion.set(null); // Show loading state if template supports it

    const cats = this.categories();
    let selectedCategory = "Scienza e Spazio"; // fallback
    if (cats && cats.length > 0) {
      const idx = Math.floor(Math.random() * cats.length);
      selectedCategory = cats[idx].name;
    }

    const playerId = this.nickname() || 'anonimo';

    this.gameService.getArenaQuestion(this.gameId(), selectedCategory, playerId).subscribe({
      next: (q: any) => {
        this.arenaQuestion.set({
          text: q.question,
          options: q.options,
          isTrueFalse: q.options && q.options.length === 2 && (q.options.includes('VERO') || q.options.includes('FALSO')),
          // Serve al server per sapere a quale domanda stiamo rispondendo.
          questionId: q.questionId
        });
        this.isFetchingQuestion.set(false);
      },
      error: (err: any) => {
        console.error('❌ Fallito recupero domanda arena:', err);
        // Senza questionId il server non può validare la risposta: meglio
        // restare in attesa che mandare in giro un esito calcolato qui.
        this.arenaQuestion.set(null);
        this.isFetchingQuestion.set(false);

        // Un telefono che si ricollega o perde un pacchetto non deve restare
        // senza domanda per tutto il turno: si ritenta finché il round è vivo,
        // aspettando il tempo che il server indica quando il round non è
        // ancora aperto (409 + retryAfterMs).
        if (this.questionType() === 'ARENA' && this.gameState() === PlayerStatus.VOTING) {
          const retryAfterMs = Math.min(5000, Math.max(250, Number(err?.error?.retryAfterMs) || 2000));
          setTimeout(() => {
            if (this.questionType() === 'ARENA'
              && this.gameState() === PlayerStatus.VOTING
              && !this.arenaQuestion()
              && !this.arenaEliminated()) {
              this.generateNextArenaQuestion();
            }
          }, retryAfterMs);
        }
      }
    });
  }

  sendArenaAnswer(index: number) {
    const q = this.arenaQuestion();
    const playerName = this.nickname();
    if (!q || !q.options || !playerName || this.arenaEliminated()) return;

    // Il telefono manda solo la risposta scelta: giusto/sbagliato lo decide il backend.
    // La chiave di idempotenza è stabile: se il Wi-Fi cade e il telefono
    // ritenta, il server risponde con l'esito già registrato.
    const key = this.reliability.idempotencyKey('arena', `${playerName}:${q.questionId}`);
    this.gameService
      .answerArenaQuestion(this.gameId(), playerName, q.questionId, q.options[index], key, this.reliability.deviceId())
      .subscribe({
        next: (res: any) => {
          const isCorrect = !!res.correct;
          // Il backend comunica l'esito alla TV dopo averlo registrato.
          this.vibrate(isCorrect ? 50 : [50, 50, 50]);
          this.arenaQuestion.set(null);
          // Dopo un errore 1,5 s di blocco: rispondere a caso non conviene più.
          setTimeout(() => this.generateNextArenaQuestion(), isCorrect ? 0 : 1500);
        },
        error: (err: any) => {
          console.error('❌ Risposta arena rifiutata dal server:', err);
          // Round chiuso o scaduto: non si insiste, si aspetta la TV.
          if (err?.status === 409) {
            this.arenaQuestion.set(null);
            this.gameState.set(PlayerStatus.WAITING);
            return;
          }
          this.generateNextArenaQuestion();
        }
      });
  }

  /**
   * Stato autorevole tornato dal server dopo una riconnessione: ripristina la
   * schermata giusta senza inventare nulla. Le risposte già date restano date.
   */
  private applyServerSnapshot(snapshot: any): void {
    // Lo stato del server è arrivato: il riallineamento è finito anche quando
    // dice che non c'è nessun round aperto.
    this.resyncing.set(false);
    if (!snapshot || !snapshot.hasState) return;

    // Anche chi si ricollega durante la pausa deve ritrovarla attiva.
    this.paused.set(!!(snapshot.paused ?? snapshot.currentRound?.paused));
    if (this.paused() && !this.pauseStartedAt) this.pauseStartedAt = performance.now();

    const deadline = Number(snapshot.roundDeadlineAt ?? 0);
    const open = !deadline || deadline > this.reliability.serverNow();
    const round = snapshot.currentRound;
    const type = round?.type ?? snapshot.roundType;

    // Round nuovo (chiave diversa): le risposte del round precedente non
    // valgono più. Senza questo, un telefono che aveva già risposto restava
    // in attesa anche con il round successivo aperto, perché `hasAnswered`
    // bloccava l'applicazione dello snapshot. Va calcolato prima della
    // guardia dei bonus: un nuovo round deve comunque chiudere il bonus.
    const roundKey = String(round?.roundKey ?? snapshot.roundKey
      ?? `${type}:${snapshot.roundIndex ?? ''}`);
    const newRound = roundKey !== this.lastSnapshotRoundKey;
    if (newRound) {
      this.lastSnapshotRoundKey = roundKey;
      this.hasAnswered.set(false);
      this.selectedAnswer.set(null);
      this.isBlocked.set(false);
      this.answeredManche.set(0);
    }

    // I bonus non sono round backend: uno snapshot del round precedente già
    // chiuso non deve spegnere la loro schermata mentre sono in corso.
    const bonusVisible = this.questionType().startsWith('BONUS_')
      || !!this.casinoState() || !!this.cavalloState()
      || !!this.biglieState() || !!this.azzardoState();
    if (bonusVisible && !newRound) return;

    // Un round aperto sul server blocca il manuale anche dopo un refresh o
    // una riconnessione, non solo quando arriva SHOW_QUESTION.
    if (!bonusVisible) {
      this.roundActive.set(!!type && open);
      if (this.roundActive()) this.closeManual();
    }

    // Un round chiuso o azzerato deve riportare il telefono in attesa: prima
    // restava sulla schermata del gioco precedente (o su "In attesa" con lo
    // stato di risposta ancora bloccato) finché non arrivava un START_VOTING.
    if (!open || !type) {
      this.cancelTimelineSend();
      this.gameState.set(PlayerStatus.WAITING);
      this.hasAnswered.set(false);
      this.selectedAnswer.set(null);
      this.isBlocked.set(false);
      this.timelineOrder.set([]);
      this.stopMicrophoneListening();
      this.stopBombaPolling();
      this.bombaStarted = false;
      return;
    }

    // Black Jack e Air Hockey hanno lo stato (tavolo o campo) solo nella TV.
    // Senza averlo ricevuto non c'è nulla da mostrare: meglio restare in
    // attesa che disegnare un tavolo/campo vuoto con "0/0" dopo un refresh.
    // Durante il gioco la TV ripubblica lo stato, quindi il telefono che si
    // ricollega a partita in corso lo riceve subito dopo.
    if ((type === 'BLACKJACK' && !this.blackjackState())
      || (type === 'AIR_HOCKEY_BATTLE' && !this.hockeyStateReady())) return;

    const previousType = this.questionType();
    this.questionType.set(type);
    if (type === 'ARENA') {
      if (!this.arenaQuestion() && !this.isFetchingQuestion()) this.generateNextArenaQuestion();
      return;
    }
    if (this.hasAnswered()) return;

    // Round già mostrato: un sync non deve riaprire voti o resettare il
    // tabellone (per esempio l'ordine Timeline appena trascinato).
    const payload = round?.payload ?? snapshot.payload;
    const timelineId = type === 'TIMELINE' ? String(this.parsePayload(payload)?.roundId ?? '') : '';
    if (previousType === type && this.gameState() === PlayerStatus.VOTING
      && (type === 'TIMELINE' ? !!timelineId && timelineId === this.timelineRoundId : !newRound)) return;

    // Anche i round guidati dalla TV (Bomba, Timeline, Ultima spiaggia, ...)
    // vanno riaperti dal snapshot: dopo un refresh il telefono deve ritrovare
    // il round in corso, non restare su "In attesa" fino al prossimo START_VOTING.
    this.onStartVoting(type, payload);
  }

  onRoundEnd() {
    this.gameState.set(PlayerStatus.WAITING);
    this.hasAnswered.set(false);
    this.selectedAnswer.set(null);
  }

  setupNewRound(type: string) {
    this.currentRoundType = type;
    this.hasAnswered.set(false);
    this.selectedAnswer.set(null);
    this.startTime = Date.now();
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  logout() {
    this.ws.disconnect();
    localStorage.removeItem('nickname');
    location.reload();
  }

  ngOnDestroy() {
    this.cancelTimelineSend();
    this.ws.disconnect();
    this.stopMicrophoneListening();
    this.stopBombaPolling();
    if (this.bombaFlashTimer) clearTimeout(this.bombaFlashTimer);
    if (this.hockeyGoalTimer) clearTimeout(this.hockeyGoalTimer);
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = undefined;
    }
    if (this.versionUpdatesSub) {
      this.versionUpdatesSub.unsubscribe();
      this.versionUpdatesSub = undefined;
    }
  }
}
