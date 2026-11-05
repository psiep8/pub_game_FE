import { Component, inject, OnDestroy, OnInit, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/web-socket.service';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { GameService } from '../../services/game.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-remote-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remote-component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./remote-component.css', './restyle.css'],
  styles: [`
    .timeline-remote, .price-remote, .speed-remote, .hockey-remote {
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
    .price-product { display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; }
    .price-emoji { font-size: 2rem; }
    .price-display { text-align: center; font-size: 2.4rem; font-weight: 900; letter-spacing: 2px; }
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
  `],
})
export class RemoteComponent implements OnInit, OnDestroy {

  public ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private swUpdate = inject(SwUpdate);
  public theme = inject(ThemeService);
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR' | 'BUZZ_OUT' | 'ELIMINATED'>('WAITING');
  questionType = signal<'ROULETTE' | 'QUIZ' | 'MUSIC' | 'IMAGE_BLUR' | 'WHEEL_OF_FORTUNE' | 'ARENA' | 'TIMELINE' | 'TIME_BUZZER' | 'SPEED_RUSH' | 'AIR_HOCKEY_BATTLE' | 'BONUS_BASKET'>('QUIZ');
  hasAnswered = signal(false);
  isBlocked = signal(false);

  hockeyQuestion = signal<{ text: string; options: string[]; difficulty?: string } | null>(null);
  hockeyMyTurn = signal(false);
  hockeyMyScore = signal(0);
  hockeyOpponentScore = signal(0);
  hockeyOpponent = signal('');
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

  priceItems = signal<Array<{ name: string; emoji: string; category?: string }>>([]);
  priceIndex = signal(0);
  priceEstimates = signal<string[]>([]);
  priceKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  buzzPhase = signal<'idle' | 'running' | 'sent'>('idle');
  buzzEliminated = signal(false);
  buzzManche = signal(0);
  private buzzStartedAt = 0;

  draggingId = signal<number | null>(null);
  private dragId: number | null = null;

  arenaEliminated = signal(false);

  speedKind = signal<'idle' | 'tap' | 'odd' | 'order' | 'math' | 'stroop' | 'memory' | 'flip' | 'count'>('idle');
  speedTapCount = signal(0);
  speedOdd = signal<string[]>([]);
  private speedOddAnswer = '';
  speedSequence = signal<number[]>([]);
  speedPicked = signal<number[]>([]);
  speedMath = signal<{ text: string; options: number[]; answer: number }>({ text: '', options: [], answer: 0 });
  speedStroop = signal<{ word: string; ink: string; answer: string; options: string[] }>({ word: '', ink: '', answer: '', options: [] });
  speedMemory = signal<string[]>([]);
  speedMemoryPhase = signal<'show' | 'input'>('input');
  speedMemoryPicked = signal<string[]>([]);
  readonly speedMemoryOptions = ['🍎', '🍌', '🍇', '🍒', '🍋', '🥝'];
  private memoryTimer?: ReturnType<typeof setTimeout>;

  speedFlip = signal<{ a: number; b: number; rule: 'big' | 'small' }>({ a: 0, b: 0, rule: 'big' });

  speedCount = signal<{ items: string[]; options: number[]; answer: number }>({ items: [], options: [], answer: 0 });
  readonly speedCountEmojis = ['🍒', '🍋', '🍇', '🍎', '⭐', '🍩'];

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
    this.setupPWA();
    this.checkForUpdates();

    // 🔥 [ROLLBACK] ID fisso 1 per stabilità
    this.gameId.set(1);
    console.log('🎮 [ROLLBACK] Remote ID forzato a 1');

    this.gameService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats.filter(c => c.active));
      }
    });

    // Se il giocatore è già loggato, notifico la TV
    if (this.nickname()) {
      setTimeout(() => {
        if (this.ws.connected()) {
          this.ws.broadcastStatus(1, { action: 'JOIN_GAME', playerName: this.nickname() });
        }
      }, 2000);
    }

    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          this.questionType.set(status.type);
          this.isBlocked.set(false);
          if (status.type === 'ROULETTE' || status.type === 'BONUS_BASKET') {
            this.gameState.set('VOTING');
            this.hasAnswered.set(false);
            this.startTime = Date.now();
          } else {
            this.gameState.set('WAITING');
          }
          break;

        case 'START_VOTING':
          this.isBlocked.set(false);
          this.onStartVoting(status.type, status.payload);
          break;

        case 'TIME_BUZZER_STATE':
          if (status.state) {
            const state = status.state;
            const manche = Number(state.manche ?? 0);
            if (manche !== this.buzzManche()) {
              this.buzzManche.set(manche);
              this.buzzPhase.set('idle');
            }
            this.buzzEliminated.set(!!state.eliminated?.includes?.(this.nickname()));
            this.gameState.set(this.buzzEliminated() ? 'BUZZ_OUT' : 'VOTING');
          }
          break;

        case 'AIR_HOCKEY_BATTLE_STATE':
          this.handleAirHockeyBattleState(status);
          break;

        case 'BONUS_ENDED':
          this.questionType.set('QUIZ');
          this.gameState.set('WAITING');
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.speedKind.set('idle');
          this.clearMemoryTimer();
          this.timelineOrder.set([]);
          this.priceEstimates.set([]);
          this.priceItems.set([]);
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
          this.gameState.set('WAITING');
          this.hasAnswered.set(false);
          this.isBlocked.set(false);
          break;

        case 'BLOCKED_ERROR':
          if (status.blockedPlayer === this.nickname()) {
            this.isBlocked.set(true);
            this.gameState.set('BLOCKED_ERROR');
          } else {

            if (!this.isBlocked()) {
              this.gameState.set('VOTING');
            }
          }
          break;

        case 'PLAYER_PRENOTATO':
          if (status.name !== this.nickname()) {

            if (!this.isBlocked()) {
              this.gameState.set('WAITING_FOR_OTHER');
            }
          }
          break;

        case 'ARENA_ELIMINATED':
          if (status.playerName === this.nickname()) {
            this.arenaEliminated.set(true);
            this.arenaQuestion.set(null);
            this.gameState.set('ELIMINATED');
            this.stopMicrophoneListening();
            this.vibrate([80, 60, 80]);
          }
          break;

        case 'ARENA_ENDED':
          this.arenaQuestion.set(null);
          if (this.arenaEliminated()) {
            this.gameState.set('ELIMINATED');
          } else {
            this.gameState.set('WAITING');
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
        action: 'JOIN_GAME',
        playerName: this.tempNickname
      });
    }
  }

  sendVote(index: number) {
    const responseTimeMs = Date.now() - this.startTime;
    this.ws.sendAnswer(this.gameId(), this.nickname()!, index, responseTimeMs);
    this.hasAnswered.set(true);
    this.gameState.set('LOCKED');
    this.vibrate(50);
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(this.gameId(), this.nickname()!, -1, time);
    this.gameState.set('LOCKED');
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string, payload?: any) {
    this.gameState.set('VOTING');
    this.questionType.set(type as any);
    this.roundStartTime = Date.now();
    this.startTime = Date.now();
    this.hasAnswered.set(false);


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
    } else if (type === 'SPEED_RUSH') {
      this.startSpeedRush();
    } else if (type === 'AIR_HOCKEY_BATTLE') {
      this.hockeyHits.set(0);
      this.hockeyGoal.set(null);
      this.hockeyLastGoalId = 0;
    }
  }

  // ------------------------------------------------- Giochi simultanei

  private parsePayload(payload: any): any {
    if (!payload) return {};
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return {};
      }
    }
    return payload;
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
    this.gameService.submitTimeline(this.gameId(), playerName, this.timelineOrder()).subscribe({
      next: () => this.gameState.set('WAITING'),
      error: () => this.gameState.set('WAITING'),
    });
    this.vibrate(40);
  }

  priceSelect(index: number): void {
    this.priceIndex.set(index);
    this.vibrate(8);
  }

  priceValue(index: number): string {
    return this.priceEstimates()[index] ?? '';
  }

  pricePress(key: string): void {
    const estimates = [...this.priceEstimates()];
    const index = this.priceIndex();
    const current = estimates[index] ?? '';
    if (current.length >= 8) return;
    if (key === '.' && current.includes('.')) return;
    estimates[index] = current + key;
    this.priceEstimates.set(estimates);
    this.vibrate(8);
  }

  priceBackspace(): void {
    const estimates = [...this.priceEstimates()];
    const index = this.priceIndex();
    estimates[index] = (estimates[index] ?? '').slice(0, -1);
    this.priceEstimates.set(estimates);
  }

  priceReady(): boolean {
    return this.priceEstimates().length > 0
      && this.priceEstimates().every((value) => isFinite(parseFloat(value)) && parseFloat(value) > 0);
  }

  priceEliminated = signal(false);

  sendPriceAnswer(): void {
    const playerName = this.nickname();
    const value = parseFloat(this.priceEstimates()[0] ?? '');
    if (!playerName || !Number.isFinite(value) || value <= 0) return;

    this.hasAnswered.set(true);
    this.ws.broadcastStatus(this.gameId(), { action: 'PRICE_ANSWER', playerName, value });
    this.gameState.set('WAITING');
    this.vibrate(40);
  }

  toggleBuzz(): void {
    if (this.buzzEliminated() || this.buzzPhase() === 'sent') return;

    if (this.buzzPhase() === 'idle') {
      this.buzzStartedAt = performance.now();
      this.buzzPhase.set('running');
      this.vibrate(20);
      return;
    }

    const ms = Math.round(performance.now() - this.buzzStartedAt);
    this.buzzPhase.set('sent');
    this.vibrate([20, 30, 20]);
    this.ws.broadcastStatus(this.gameId(), {
      action: 'TIME_BUZZER_ANSWER',
      playerName: this.nickname(),
      ms,
    });
  }

  startSpeedRush(): void {
    this.speedPicked.set([]);
    this.nextSpeedTask();
  }

  private nextSpeedTask(): void {
    this.clearMemoryTimer();
    const kinds = ['tap', 'odd', 'order', 'math', 'stroop', 'memory', 'flip', 'count'] as const;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    this.speedKind.set(kind);

    if (kind === 'tap') {
      this.speedTapCount.set(0);
      return;
    }

    if (kind === 'odd') {
      const base = ['🍎', '🍌', '🍇', '🍒'];
      const odd = '🍋';
      const set = [...base];
      set[Math.floor(Math.random() * set.length)] = odd;
      this.speedOdd.set(set);
      this.speedOddAnswer = odd;
      return;
    }

    if (kind === 'math') {
      const a = 3 + Math.floor(Math.random() * 9);
      const b = 2 + Math.floor(Math.random() * 9);
      const answer = a + b;
      const options = new Set<number>([answer]);
      while (options.size < 3) {
        const delta = [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
        const candidate = answer + delta;
        if (candidate > 0) options.add(candidate);
      }
      this.speedMath.set({
        text: `${a} + ${b}`,
        answer,
        options: [...options].sort(() => Math.random() - 0.5),
      });
      return;
    }

    if (kind === 'stroop') {
      const colors = [
        { name: 'ROSSO', ink: '#e63946' },
        { name: 'BLU', ink: '#2563eb' },
        { name: 'VERDE', ink: '#15803d' },
      ];
      const word = colors[Math.floor(Math.random() * colors.length)];
      let ink = colors[Math.floor(Math.random() * colors.length)];
      if (ink.name === word.name) {
        ink = colors[(colors.indexOf(ink) + 1) % colors.length];
      }
      this.speedStroop.set({
        word: word.name,
        ink: ink.ink,
        answer: ink.name,
        options: colors.map((color) => color.name).sort(() => Math.random() - 0.5),
      });
      return;
    }

    if (kind === 'memory') {
      const sequence = Array.from({ length: 3 }, () =>
        this.speedMemoryOptions[Math.floor(Math.random() * this.speedMemoryOptions.length)]
      );
      this.speedMemory.set(sequence);
      this.speedMemoryPicked.set([]);
      this.speedMemoryPhase.set('show');
      this.clearMemoryTimer();
      this.memoryTimer = setTimeout(() => this.speedMemoryPhase.set('input'), 1500);
      return;
    }

    if (kind === 'flip') {
      const a = 2 + Math.floor(Math.random() * 97);
      let b = 2 + Math.floor(Math.random() * 97);
      while (b === a) b = 2 + Math.floor(Math.random() * 97);
      this.speedFlip.set({ a, b, rule: Math.random() < 0.5 ? 'big' : 'small' });
      return;
    }

    if (kind === 'count') {
      const emoji = this.speedCountEmojis[Math.floor(Math.random() * this.speedCountEmojis.length)];
      const answer = 6 + Math.floor(Math.random() * 6);
      const items = Array.from({ length: answer }, () => emoji);
      const options = new Set<number>([answer]);
      while (options.size < 3) {
        const delta = [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
        const candidate = answer + delta;
        if (candidate > 0) options.add(candidate);
      }
      this.speedCount.set({
        items,
        answer,
        options: [...options].sort(() => Math.random() - 0.5),
      });
      return;
    }

    const numbers = [1, 2, 3].sort(() => Math.random() - 0.5);
    this.speedSequence.set(numbers);
    this.speedPicked.set([]);
  }

  speedPickCount(value: number): void {
    this.completeSpeedTask(value === this.speedCount().answer);
  }

  speedPickFlip(value: number): void {
    const { a, b, rule } = this.speedFlip();
    const target = rule === 'big' ? Math.max(a, b) : Math.min(a, b);
    this.completeSpeedTask(value === target);
  }

  speedTap(): void {
    const next = this.speedTapCount() + 1;
    this.vibrate(8);
    if (next >= 8) {
      this.completeSpeedTask(true);
      return;
    }
    this.speedTapCount.set(next);
  }

  speedPickOdd(emoji: string): void {
    this.completeSpeedTask(emoji === this.speedOddAnswer);
  }

  speedPickNumber(value: number): void {
    const expected = [...this.speedPicked(), value];
    const sorted = [...this.speedSequence()].sort((a, b) => a - b);
    const stillRight = expected.every((picked, index) => picked === sorted[index]);

    if (!stillRight) {
      this.completeSpeedTask(false);
      return;
    }

    this.vibrate(10);
    this.speedPicked.set(expected);

    if (expected.length === sorted.length) {
      this.completeSpeedTask(true);
    }
  }

  private completeSpeedTask(correct: boolean): void {
    this.clearMemoryTimer();
    this.ws.broadcastStatus(this.gameId(), {
      action: 'SPEED_RUSH_PROGRESS',
      playerName: this.nickname(),
      correct,
    });
    this.vibrate(correct ? 30 : [40, 40, 40]);
    this.speedKind.set('idle');
    setTimeout(() => this.nextSpeedTask(), 300);
  }

  speedPickMath(value: number): void {
    this.completeSpeedTask(value === this.speedMath().answer);
  }

  speedPickStroop(name: string): void {
    this.completeSpeedTask(name === this.speedStroop().answer);
  }

  speedMemoryTap(emoji: string): void {
    const expected = [...this.speedMemoryPicked(), emoji];
    const sequence = this.speedMemory();

    if (!expected.every((value, index) => value === sequence[index])) {
      this.completeSpeedTask(false);
      return;
    }

    this.vibrate(10);
    this.speedMemoryPicked.set(expected);

    if (expected.length === sequence.length) {
      this.completeSpeedTask(true);
    }
  }

  private clearMemoryTimer(): void {
    if (this.memoryTimer) {
      clearTimeout(this.memoryTimer);
      this.memoryTimer = undefined;
    }
  }

  sendHockeyAnswer(index: number): void {
    if (this.hasAnswered() || !this.hockeyMyTurn() || !this.nickname()) return;

    this.ws.broadcastStatus(this.gameId(), {
      action: 'AIR_HOCKEY_BATTLE_ANSWER',
      playerName: this.nickname(),
      answerIndex: index,
    });
    this.hasAnswered.set(true);
    this.vibrate(40);
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
    this.hockeyServeLeft.set(court.serveLeft ?? 0);
    this.hockeyQuestion.set(court.question ?? null);
    this.hockeyMyTurn.set(!court.winner && court.turn === mine);
    this.hasAnswered.set(false);

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
      this.gameState.set('WAITING');
      return;
    }

    this.gameState.set('VOTING');

    if (event?.kind === 'return') {
      this.hockeyLastResult.set(event.side === mine ? 'PALLA RIMANDATA!' : 'PALLA IN ARRIVO');
    } else if (event?.kind === 'goal') {
      this.hockeyLastResult.set(event.side === mine ? 'GOL PER TE!' : 'GOL SUBITO');
    } else {
      this.hockeyLastResult.set(null);
    }
  }

  generateNextArenaQuestion() {
    if (this.arenaEliminated() || this.gameState() === 'ELIMINATED') return;
    this.isFetchingQuestion.set(true);
    this.arenaQuestion.set(null); // Show loading state if template supports it

    const cats = this.categories();
    let selectedCategory = "Scienza"; // fallback
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
    this.gameService
      .answerArenaQuestion(this.gameId(), playerName, q.questionId, q.options[index])
      .subscribe({
        next: (res: any) => {
          const isCorrect = !!res.correct;
          const points = typeof res.points === 'number' ? res.points : (isCorrect ? 10 : -10);
          this.ws.broadcastStatus(this.gameId(), {
            action: 'ARENA_ANSWER',
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
          this.generateNextArenaQuestion();
        }
      });
  }

  onRoundEnd() {
    this.gameState.set('WAITING');
    this.hasAnswered.set(false);
  }

  setupNewRound(type: string) {
    this.currentRoundType = type;
    this.hasAnswered.set(false);
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
    this.clearMemoryTimer();
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
