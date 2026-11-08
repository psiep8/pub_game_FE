import { GamePhase } from '../../shared/enums/game-phase';
import { PlayerStatus } from '../../shared/enums/player-status';
import { WsAction } from '../../shared/enums/ws-action';
import { Component, DestroyRef, inject, OnDestroy, OnInit, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';

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
import { filter } from 'rxjs/operators';
import { GameService } from '../../core/services/game.service';
import { ThemeService } from '../../core/services/theme.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { PlayerAvatarService } from '../../core/services/player-avatar.service';
import {
  buildSpeedDeck,
  createSpeedTask,
  type SpeedTask,
  type SpeedTaskKind,
} from '../games/speed-rush/speed-rush-deck';
import { ConnectionBadge } from '../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-remote-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ConnectionBadge],
  templateUrl: './remote.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./remote.component.css', './restyle.css'],
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
      padding: 24px; background: #15803d; color: #fff; animation: hockeyGoalIn .22s ease-out;
    }
    .hockey-goal-overlay.conceded { background: #b91c1c; }
    .hockey-goal-kicker { font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .18em; opacity: .85; }
    .hockey-goal-word { font-family: var(--font-display); font-size: clamp(2.6rem, 12vw, 4.6rem); line-height: .95; text-transform: uppercase; }
    .hockey-goal-score { font-family: var(--font-display); font-size: clamp(3.4rem, 18vw, 6rem); line-height: 1; }
    .hockey-goal-note { font-family: var(--font-mono); font-size: .8rem; letter-spacing: .12em; opacity: .9; }
    @keyframes hockeyGoalIn { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .party-instruction { text-align: center; font-size: .95rem; opacity: .85; margin: 0; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .party-card { position: relative; padding: 14px 10px; border-radius: 14px; border: 2px solid rgba(255,255,255,.15); background: rgba(255,255,255,.06); color: #fff; font-size: .9rem; text-align: left; }
    .party-card.selected { border-color: #a78bfa; background: rgba(167,139,250,.25); }
    .party-badge { display: inline-block; width: 20px; height: 20px; line-height: 20px; border-radius: 50%; background: #a78bfa; color: #1e1b4b; font-weight: 800; font-size: .75rem; text-align: center; margin-right: 6px; }
    .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .key { padding: 16px; font-size: 1.3rem; border-radius: 12px; border: none; background: rgba(255,255,255,.12); color: #fff; }
    .key:active { background: rgba(255,255,255,.3); }
    .speed-big { width: 100%; min-height: 150px; font-size: 2rem; font-weight: 900; border-radius: 20px; border: none; background: linear-gradient(135deg,#f97316,#fbbf24); color: #1f2937; }
    .emoji-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .emoji-btn { padding: 22px; font-size: 2rem; border-radius: 16px; border: none; background: rgba(255,255,255,.12); color: #fff; }
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
    .hockey-wait p { margin: 0; font-size: .95rem; color: rgba(30, 25, 20, .72); }
    .hockey-wait-score { font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: var(--tomato); }
    .hockey-result { text-align: center; font-family: var(--font-mono); font-size: .8rem; font-weight: 700; letter-spacing: .16em; color: var(--tomato); }
    @keyframes hockeyBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    .bonus-remote { display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; justify-content: center; }
    .casino-colors { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .casino-color { padding: 18px 10px; border-radius: 14px; border: 2px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff; font-weight: 800; letter-spacing: .06em; }
    .casino-color.picked { border-color: #fbbf24; background: rgba(251,191,36,.25); }
    .casino-numbers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; max-height: 52vh; overflow: auto; }
    .casino-number { padding: 12px 0; border-radius: 10px; border: 2px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: #fff; font-weight: 700; font-family: var(--font-mono, monospace); }
    .casino-number.picked { border-color: #fbbf24; background: rgba(251,191,36,.25); color: #fbbf24; }
    .casino-hand { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px; border-radius: 14px; border: 2px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); }
    .casino-hand-label { font-size: .66rem; letter-spacing: .18em; color: #fbbf24; font-weight: 800; }
    .casino-cards { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
    .casino-card { display: inline-grid; place-items: center; min-width: 38px; height: 50px; padding: 0 4px; border-radius: 8px; background: #f8fafc; color: #0f172a; font-family: var(--font-mono, monospace); font-weight: 800; }
    .casino-card.red { color: #dc2626; }
    .casino-hand-total { font-size: 1.8rem; font-weight: 900; }
    .casino-hand-total.bust { color: #f87171; }
    .casino-bj-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .casino-hit, .casino-stand { padding: 20px 10px; border: 0; border-radius: 14px; font-size: 1rem; font-weight: 900; letter-spacing: .06em; }
    .casino-hit { background: #fbbf24; color: #111827; }
    .casino-stand { background: rgba(255,255,255,.16); color: #fff; }
    .cavallo-categories { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 56vh; overflow: auto; }
    .biglie-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); }
    .biglie-card.picked { background: var(--acid); }
    .biglie-card:disabled { opacity: .5; }
    .biglie-dot { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--coal); font-size: 1rem; }
    .biglie-prof { font-size: .58rem; letter-spacing: .06em; opacity: .6; }
    .biglie-mine { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--paper-hi); border: 2px solid var(--coal); }
    .biglie-head { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 1rem; }
    .biglie-bar { height: 16px; background: rgba(30, 25, 20, .12); border: 2px solid var(--coal); overflow: hidden; }
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
    .azzardo-stake.used { background: var(--paper-2); color: rgba(21,21,15,.55); box-shadow: 2px 2px 0 var(--coal); text-decoration: line-through; opacity: 1; }
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
  private gameService = inject(GameService);
  private swUpdate = inject(SwUpdate);
  public theme = inject(ThemeService);
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;

  /**
   * La regia quad assegna il nome via query string, così Anna e Bruno
   * possono vivere su due origini diverse senza passare dal setup manuale.
   */
  nickname = signal<string | null>(initialNicknameFromQuery() ?? localStorage.getItem('nickname'));
  tempNickname = '';
  avatarPreview = signal<string | null>(null);
  private pendingAvatar: string | null = null;
  startTime: number = 0;

  gameState = signal<PlayerStatus>(PlayerStatus.WAITING);
  questionType = signal<'QUIZ' | 'MUSIC' | 'IMAGE_BLUR' | 'WHEEL_OF_FORTUNE' | 'ARENA' | 'TIMELINE' | 'TIME_BUZZER' | 'BOMBA' | 'SPEED_RUSH' | 'AIR_HOCKEY_BATTLE' | 'CAVALLO' | 'ULTIMA_SPIAGGIA' | 'AZZARDO' | 'BLACKJACK' | 'BONUS_BASKET' | 'BONUS_CASINO' | 'BONUS_CAVALLO' | 'BONUS_BIGLIE'>('QUIZ');
  hasAnswered = signal(false);
  /** Ultima risposta toccata: solo promemoria visivo, l'esito lo decide il server. */
  selectedAnswer = signal<number | null>(null);
  isBlocked = signal(false);

  hockeyQuestion = signal<{ text: string; options: string[]; difficulty?: string } | null>(null);
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

  buzzPhase = signal<'idle' | 'running' | 'sent'>('idle');
  buzzEliminated = signal(false);
  buzzManche = signal(0);
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
  azzardoStake = signal(100);
  azzardoChoice = signal<number | null>(null);
  azzardoSent = signal(false);
  readonly azzardoStakes = [100, 200, 300];
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
  private bombaEventSeq = 0;
  private bombaFlashTimer?: ReturnType<typeof setTimeout>;

  draggingId = signal<number | null>(null);
  private dragId: number | null = null;

  arenaEliminated = signal(false);

  /** Prova corrente del mazzo (null tra una prova e l'altra). */
  speedTask = signal<SpeedTask | null>(null);
  /** Colori già scelti nella prova "mischia colori". */
  speedColorPicked = signal<string[]>([]);
  private speedDeck: SpeedTaskKind[] = [];
  private speedDeckIndex = 0;

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

  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private microphone?: MediaStreamAudioSourceNode;
  private mediaStream?: MediaStream;
  private volumeTimer?: ReturnType<typeof setInterval>;

  isListening = signal(false);
  currentVolume = signal(0);
  isScreaming = signal(false);
  microphoneError = signal<string | null>(null);

  getBasketUrl(): string {
    return '/basket?player=' + encodeURIComponent(this.nickname() ?? '');
  }

  ngOnInit(): void {
    this.playerAvatars.connect(this.ws);
    this.setupPWA();
    this.checkForUpdates();

    // 🔥 [ROLLBACK] ID fisso 1 per stabilità
    this.gameId.set(1);
    console.log('🎮 [ROLLBACK] Remote ID forzato a 1');

    // Sessione + heartbeat: al riaggancio il telefono riprende la stessa
    // squadra e richiede lo stato autorevole, senza ricaricare la pagina.
    // Prima l'ascolto, poi l'avvio: il sync iniziale può rispondere subito e
    // senza sottoscrizione lo snapshot andrebbe perso.
    this.reliability.syncState$.subscribe((snapshot: any) => this.applyServerSnapshot(snapshot));
    this.reliability.start(1, 'REMOTE', this.nickname() ?? '');

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
          this.ws.broadcastStatus(1, { action: WsAction.JOIN_GAME, playerName: this.nickname() });
          this.playerAvatars.publish(this.nickname()!, this.gameId());
        }
      }, 2000);
    }

    this.ws.connectedAt$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const name = this.nickname();
      if (name) this.playerAvatars.publish(name, this.gameId());
    });

    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          this.questionType.set(status.type);
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
          this.isBlocked.set(false);
          this.onStartVoting(status.type, status.payload);
          break;

        case 'QUIZ_STATE':
          // Una manche nuova riapre i voti; il reveal invece blocca i telefoni.
          if (status.state?.mancheReveal || status.state?.revealed) {
            this.gameState.set(PlayerStatus.WAITING);
          } else {
            this.hasAnswered.set(false);
            this.selectedAnswer.set(null);
            this.startTime = Date.now();
            this.gameState.set(PlayerStatus.VOTING);
          }
          break;

        case 'BOMBA_STATE':
          this.applyBombaState(status.state);
          break;

        case 'TIME_BUZZER_START':
          // Il via arriva dal server: da qui parte il cronometro del telefono.
          if (!this.buzzEliminated()) {
            this.buzzStartedAt = performance.now();
            this.buzzError.set('');
            this.buzzPhase.set('running');
            this.gameState.set(PlayerStatus.VOTING);
            this.vibrate(20);
          }
          break;

        case 'TIME_BUZZER_STATE':
          if (status.state) {
            const state = status.state;
            const manche = Number(state.manche ?? 0);
            this.buzzTotal.set(Number(state.total) || 3);
            if (manche !== this.buzzManche()) {
              this.buzzManche.set(manche);
              this.buzzPhase.set('idle');
              this.buzzError.set('');
            }
            this.buzzEliminated.set(!!state.eliminated?.includes?.(this.nickname()));
            this.gameState.set(this.buzzEliminated() ? PlayerStatus.BUZZ_OUT : PlayerStatus.VOTING);
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
          this.speedTask.set(null);
          this.speedColorPicked.set([]);
          this.blackjackState.set(null);
          this.blackjackStand.set(false);
          this.timelineOrder.set([]);
          this.arenaEliminated.set(false);
          this.arenaQuestion.set(null);
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
          if (status.name !== this.nickname()) {

            if (!this.isBlocked()) {
              this.gameState.set(PlayerStatus.WAITING_FOR_OTHER);
            }
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

  setNickname() {
    if (this.tempNickname.trim()) {
      this.nickname.set(this.tempNickname);
      localStorage.setItem('nickname', this.tempNickname);

      // Notify the TV that a new player joined
      this.ws.broadcastStatus(this.gameId(), {
        action: WsAction.JOIN_GAME,
        playerName: this.tempNickname
      });

      this.applyAvatar(this.tempNickname, this.pendingAvatar);
      this.pendingAvatar = null;
    }
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

  sendVote(index: number) {
    this.selectedAnswer.set(index);
    const responseTimeMs = Date.now() - this.startTime;
    this.ws.sendAnswer(this.gameId(), this.nickname()!, index, responseTimeMs);
    this.hasAnswered.set(true);
    this.gameState.set(PlayerStatus.LOCKED);
    this.vibrate(50);
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(this.gameId(), this.nickname()!, -1, time);
    this.gameState.set(PlayerStatus.LOCKED);
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string, payload?: any) {
    this.gameState.set(PlayerStatus.VOTING);
    this.questionType.set(type as any);
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
      this.timelineCards.set(cards);
      // Si parte dall'ordine mostrato: si trascina per correggerlo.
      this.timelineOrder.set(cards.map((card: any) => card.id));
    } else if (type === 'TIME_BUZZER') {
      this.buzzPhase.set('idle');
      this.buzzEliminated.set(false);
      this.buzzManche.set(0);
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
        this.azzardoStake.set(100);
        this.azzardoChoice.set(null);
        this.azzardoSent.set(false);
      }
    }
    this.gameState.set(state.phase === 'BET' ? 'VOTING' : 'WAITING');
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

  /** Punti che la propria squadra può ancora puntare in questa manche. */
  azzardoMaxBet(): number {
    const player = this.nickname();
    const row = (this.azzardoState()?.ready ?? []).find((entry: any) => entry.playerName === player);
    return Number(row?.maxBet ?? 0);
  }

  azzardoPickStake(stake: number): void {
    if (this.azzardoSent() || stake > this.azzardoMaxBet()) return;
    this.azzardoStake.set(stake);
    this.vibrate(10);
  }

  /** Un tocco sulla risposta invia puntata e scelta insieme. */
  azzardoPick(index: number): void {
    const player = this.nickname();
    const state = this.azzardoState();
    if (!player || this.azzardoSent() || state?.phase !== 'BET') return;
    if (index < 0 || index >= (state.options?.length ?? 0)) return;

    this.azzardoChoice.set(index);
    this.azzardoSent.set(true);
    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.AZZARDO_ACTION,
      playerName: player,
      kind: 'BET',
      value: { stake: this.azzardoStake(), choice: index },
    });
    this.vibrate(30);
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
        this.flashBomba(mine ? '💥 BOOM! Sei fuori dal round' : `💥 ${event.player}: bomba`);
        this.vibrate([160, 60, 160]);
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

    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest('.tl-drag-card') as HTMLElement | null;
    const over = target ? Number(target.dataset['index']) : NaN;
    if (!Number.isFinite(over)) return;

    const order = [...this.timelineOrder()];
    const from = order.indexOf(this.dragId);
    if (from < 0 || from === over) return;

    order.splice(from, 1);
    order.splice(over, 0, this.dragId);
    this.timelineOrder.set(order);
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
    this.vibrate(10);
  }

  sendTimelineAnswer(): void {
    const playerName = this.nickname();
    if (!playerName || this.timelineOrder().length !== this.timelineCards().length) return;

    this.hasAnswered.set(true);
    const key = this.reliability.idempotencyKey('timeline', `${playerName}:${this.timelineOrder().join(',')}`);
    this.gameService.submitTimeline(this.gameId(), playerName, this.timelineOrder(), key).subscribe({
      next: () => this.gameState.set(PlayerStatus.WAITING),
      error: () => this.gameState.set(PlayerStatus.WAITING),
    });
    this.vibrate(40);
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
    // Un mazzo per round: ogni tipo esce con regolarità e mai due volte di fila.
    this.speedDeck = buildSpeedDeck(40);
    this.speedDeckIndex = 0;
    this.nextSpeedTask();
  }

  private nextSpeedTask(): void {
    if (this.speedDeck.length === 0 || this.speedDeckIndex >= this.speedDeck.length) {
      this.speedDeck = buildSpeedDeck(40);
      this.speedDeckIndex = 0;
    }

    const kind = this.speedDeck[this.speedDeckIndex++];
    this.speedColorPicked.set([]);
    this.speedTask.set(createSpeedTask(kind));
  }

  speedPickMath(value: number): void {
    const task = this.speedTask();
    if (task?.kind !== 'math') return;
    this.completeSpeedTask(value === task.answer);
  }

  /** Mischia colori: si scelgono i due primari che danno il colore in cima. */
  speedPickColor(name: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'colors' || this.speedColorPicked().includes(name)) return;

    if (!task.answer.includes(name)) {
      this.completeSpeedTask(false);
      return;
    }

    const picked = [...this.speedColorPicked(), name];
    this.vibrate(10);
    if (picked.length >= task.answer.length) {
      this.completeSpeedTask(true);
      return;
    }
    this.speedColorPicked.set(picked);
  }

  speedPickFlag(name: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'flag') return;
    this.completeSpeedTask(name === task.answer);
  }

  speedPickWord(value: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'words') return;
    this.completeSpeedTask(value === task.answer);
  }

  speedPickTranslate(value: string): void {
    const task = this.speedTask();
    if (task?.kind !== 'translate') return;
    this.completeSpeedTask(value === task.answer);
  }

  private completeSpeedTask(correct: boolean): void {
    // Una prova risolta manda un solo aggiornamento, anche con un doppio tocco.
    if (!this.speedTask()) return;
    this.speedTask.set(null);
    this.speedColorPicked.set([]);

    this.ws.broadcastStatus(this.gameId(), {
      action: WsAction.SPEED_RUSH_PROGRESS,
      playerName: this.nickname(),
      correct,
    });
    this.vibrate(correct ? 30 : [40, 40, 40]);
    setTimeout(() => this.nextSpeedTask(), 300);
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
          const points = typeof res.points === 'number' ? res.points : (isCorrect ? 10 : -10);
          this.ws.broadcastStatus(this.gameId(), {
            action: WsAction.ARENA_ANSWER,
            playerName,
            isCorrect,
            points
          });
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
    if (!snapshot || !snapshot.hasState) return;

    const deadline = Number(snapshot.roundDeadlineAt ?? 0);
    const open = !deadline || deadline > this.reliability.serverNow();
    const round = snapshot.currentRound;
    const type = round?.type ?? snapshot.roundType;
    if (!open || !type) return;

    this.questionType.set(type);
    if (type === 'ARENA') {
      if (!this.arenaQuestion() && !this.isFetchingQuestion()) this.generateNextArenaQuestion();
      return;
    }
    if (this.hasAnswered()) return;

    // Round già mostrato: un sync non deve riaprire voti o resettare il tabellone.
    if (this.questionType() === type && this.gameState() === PlayerStatus.VOTING) return;

    // Anche i round guidati dalla TV (Bomba, Timeline, Ultima spiaggia, ...)
    // vanno riaperti dal snapshot: dopo un refresh il telefono deve ritrovare
    // il round in corso, non restare su "In attesa" fino al prossimo START_VOTING.
    const payload = round?.payload ?? snapshot.payload;
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
