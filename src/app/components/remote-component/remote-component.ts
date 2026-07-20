import { Component, inject, OnDestroy, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/web-socket.service';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { GameService } from '../../services/game.service';

const REMOTE_STATE_KEY = 'remote_player_state';

@Component({
  selector: 'app-remote-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remote-component.html',
  styleUrl: './remote-component.css',
})
export class RemoteComponent implements OnInit, OnDestroy {

  public ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private swUpdate = inject(SwUpdate);
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;
  private reconnectedSub?: any;
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityHandler?: () => void;

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'ROULETTE' | 'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO' | 'WHEEL_OF_FORTUNE' | 'SCREAM_RACE' | 'ARENA'>('QUIZ');
  hasAnswered = signal(false);
  isBlocked = signal(false);
  selectedYear = signal<number>(2000);

  minYear = signal<number>(1000);
  maxYear = signal<number>(2026);
  yearStep = signal<number>(1);

  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1);

  // ARENA STATE
  arenaQuestion = signal<{ text: string, options?: string[], isTrueFalse: boolean, correctIndex: number } | null>(null);
  isFetchingQuestion = signal(false);
  categories = signal<any[]>([]);

  currentRoundType: string = '';

  showInstallBanner = signal(false);
  showIosInstallBanner = signal(false);
  showUpdateBanner = signal(false);
  private deferredPrompt: any;

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('modern-slider')) {
      event.preventDefault();
    }
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
  private animationFrameId?: number;

  isListening = signal(false);
  currentVolume = signal(0);
  isScreaming = signal(false);
  microphoneError = signal<string | null>(null);

  ngOnInit(): void {
    this.setupPWA();
    this.checkForUpdates();
    this.lockOrientation();
    this.setupWakeLock();
    this.setupVisibilityHandler();

    this.gameId.set(1);
    console.log('🎮 Remote ID forzato a 1');

    this.gameService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats.filter(c => c.active));
      }
    });

    this.restoreState();

    if (this.nickname()) {
      this.joinGameWithDelay(2000);
    }

    this.reconnectedSub = this.ws.reconnected$.subscribe(() => {
      if (this.nickname()) {
        console.log('🔄 Riconnessione rilevata, ri-join del giocatore...');
        this.restoreState();
        this.joinGameWithDelay(500);
      }
    });

    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          this.questionType.set(status.type);
          this.isBlocked.set(false);
          if (status.type === 'CHRONO' && status.payload) {
            try {
              const payload = typeof status.payload === 'string'
                ? JSON.parse(status.payload)
                : status.payload;
              this.minYear.set(payload.minYear ?? 1000);
              this.maxYear.set(payload.maxYear ?? 2026);
              this.yearStep.set(payload.step ?? 1);
              const center = Math.floor((this.minYear() + this.maxYear()) / 2);
              this.selectedYear.set(center);
            } catch (e) {
              console.error('❌ Errore parsing CHRONO payload:', e);
            }
          }

          if (status.type === 'ROULETTE') {
            this.gameState.set('VOTING');
            this.hasAnswered.set(false);
            this.startTime = Date.now();
          } else {
            this.gameState.set('WAITING');
          }
          if (status.type === 'SCREAM_RACE') {
            console.log('🎤 SCREAM_RACE rilevato - Attivo microfono...');
            this.gameState.set('WAITING');
            setTimeout(() => {
              this.startMicrophoneListening();
            }, 500);
          }
          this.saveState();
          break;

        case 'START_VOTING':
          this.isBlocked.set(false);
          this.onStartVoting(status.type, status.payload);
          this.saveState();
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.gameState.set('WAITING');
          this.hasAnswered.set(false);
          this.isBlocked.set(false);
          this.saveState();
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
          this.saveState();
          break;

        case 'PLAYER_PRENOTATO':
          if (status.name !== this.nickname()) {
            if (!this.isBlocked()) {
              this.gameState.set('WAITING_FOR_OTHER');
            }
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
      this.detectVolume();

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
  private detectVolume() {
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

    // 📡 Invia al backend (con micro-throttling di 100ms per non saturare il WS)
    const now = Date.now();
    const nickname = (this.nickname() || '').trim();

    if (intensity > 5 && nickname && (!this.lastScreamTime || now - this.lastScreamTime > 100)) {
      this.ws.sendScream(this.gameId(), nickname, intensity);
      this.lastScreamTime = now;
    }

    // Continua il loop
    this.animationFrameId = requestAnimationFrame(() => this.detectVolume());
  }

  private lastScreamTime: number = 0;

  stopMicrophoneListening() {
    // Ferma animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
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

  private async lockOrientation() {
    try {
      const screen = window.screen as any;
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {

    }
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


    if (type === 'CHRONO' && payload) {
      try {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

        if (data.minYear !== undefined) this.minYear.set(data.minYear);
        if (data.maxYear !== undefined) this.maxYear.set(data.maxYear);
        if (data.step !== undefined) this.yearStep.set(data.step);

        const center = Math.floor((this.minYear() + this.maxYear()) / 2);
        this.selectedYear.set(center);
      } catch (e) {
        console.error('❌ Errore payload CHRONO:', e);
      }
    } else if (type === 'ARENA') {
      this.generateNextArenaQuestion();
    }
  }

  generateNextArenaQuestion() {
    this.isFetchingQuestion.set(true);
    this.arenaQuestion.set(null); // Show loading state if template supports it

    const cats = this.categories();
    let selectedCategory = "Scienza"; // fallback
    if (cats && cats.length > 0) {
      const idx = Math.floor(Math.random() * cats.length);
      selectedCategory = cats[idx].name;
    }

    this.gameService.getArenaQuestion(this.gameId(), selectedCategory).subscribe({
      next: (q: any) => {
        this.arenaQuestion.set({
          text: q.question,
          options: q.options,
          isTrueFalse: q.options && q.options.length === 2 && (q.options.includes('VERO') || q.options.includes('FALSO')),
          correctIndex: q.options ? q.options.indexOf(q.correctAnswer) : -1
        });
        this.isFetchingQuestion.set(false);
      },
      error: (err: any) => {
        console.error('❌ Fallito recupero domanda arena:', err);
        // Fallback locale in caso di errore di rete
        this.arenaQuestion.set({
          text: "Domanda di riserva: 5 + 5?",
          options: ["8", "10", "12", "15"],
          isTrueFalse: false,
          correctIndex: 1
        });
        this.isFetchingQuestion.set(false);
      }
    });
  }

  sendArenaAnswer(index: number) {
    const q = this.arenaQuestion();
    if (!q) return;

    const isCorrect = index === q.correctIndex;

    this.ws.broadcastStatus(this.gameId(), {
      action: 'ARENA_ANSWER',
      playerName: this.nickname(),
      isCorrect: isCorrect
    });

    this.vibrate(isCorrect ? 50 : [50, 50, 50]);

    // Slight dealy to show correct/wrong feedback maybe? 
    // Just immediately next question for rapid fire!
    this.generateNextArenaQuestion();
  }

  onYearChange(event: any) {
    this.selectedYear.set(parseInt(event.target.value));
    this.vibrate(10);
  }

  sendChronoAnswer() {
    const elapsed = Date.now() - this.roundStartTime;
    this.ws.sendAnswer(
      this.gameId(),
      this.nickname()!,
      this.selectedYear(),
      elapsed
    );
    this.gameState.set('WAITING');
    this.vibrate(50);
  }

  onRoundEnd() {
    this.gameState.set('WAITING');
    this.selectedYear.set(2000);
    this.hasAnswered.set(false);
  }

  setupNewRound(type: string) {
    this.currentRoundType = type;
    this.hasAnswered.set(false);
    this.startTime = Date.now();
    if (type === 'CHRONO') {
      const center = Math.floor((this.minYear() + this.maxYear()) / 2);
      this.selectedYear.set(center);
    }
  }

  private joinGameWithDelay(delayMs: number) {
    setTimeout(() => {
      if (this.ws.connected()) {
        this.ws.broadcastStatus(1, { action: 'JOIN_GAME', playerName: this.nickname() });
        console.log('🤝 JOIN_GAME inviato');
      } else {
        console.warn('⚠️ WS non connesso, riprovo...');
        setTimeout(() => {
          if (this.ws.connected()) {
            this.ws.broadcastStatus(1, { action: 'JOIN_GAME', playerName: this.nickname() });
          }
        }, 3000);
      }
    }, delayMs);
  }

  private saveState() {
    try {
      const state = {
        gameState: this.gameState(),
        questionType: this.questionType(),
        hasAnswered: this.hasAnswered(),
        isBlocked: this.isBlocked(),
        selectedYear: this.selectedYear(),
        minYear: this.minYear(),
        maxYear: this.maxYear(),
        yearStep: this.yearStep(),
        timestamp: Date.now()
      };
      localStorage.setItem(REMOTE_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('⚠️ Errore salvataggio stato player:', e);
    }
  }

  private restoreState() {
    try {
      const raw = localStorage.getItem(REMOTE_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (Date.now() - state.timestamp > 120000) {
        localStorage.removeItem(REMOTE_STATE_KEY);
        return;
      }
      this.questionType.set(state.questionType || 'QUIZ');
      this.selectedYear.set(state.selectedYear || 2000);
      this.minYear.set(state.minYear || 1000);
      this.maxYear.set(state.maxYear || 2026);
      this.yearStep.set(state.yearStep || 1);
      console.log('♻️ Stato player ripristinato da localStorage');
    } catch (e) {
      console.warn('⚠️ Errore ripristino stato player:', e);
    }
  }

  private setupVisibilityHandler() {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ App tornata visibile, controllo connessione...');
        if (!this.ws.connected()) {
          console.log('🔄 WS non connesso, riconnessione...');
          this.ws.connect();
        }
        if (this.nickname() && this.ws.connected()) {
          this.joinGameWithDelay(1000);
        }
        this.requestWakeLock();
      } else {
        this.saveState();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private async setupWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.log('⚠️ Wake Lock API non supportata');
      return;
    }
    await this.requestWakeLock();
  }

  private async requestWakeLock() {
    try {
      if (document.visibilityState !== 'visible') return;
      if (this.wakeLock) return;
      this.wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔋 Wake Lock attivato');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        console.log('🔋 Wake Lock rilasciato');
      });
    } catch (e) {
      console.warn('⚠️ Wake Lock non attivabile:', e);
    }
  }

  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  logout() {
    this.ws.disconnect();
    localStorage.removeItem('nickname');
    localStorage.removeItem(REMOTE_STATE_KEY);
    location.reload();
  }

  ngOnDestroy() {
    this.saveState();
    this.ws.disconnect();
    this.stopMicrophoneListening();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
    if (this.reconnectedSub) {
      this.reconnectedSub.unsubscribe();
    }
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
