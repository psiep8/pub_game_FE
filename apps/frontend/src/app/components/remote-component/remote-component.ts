import { Component, inject, OnDestroy, OnInit, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../services/web-socket.service';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-remote-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remote-component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './remote-component.css',
  styles: [`
    .timeline-remote, .price-remote, .speed-remote, .ping-remote {
      display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; justify-content: center;
    }
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
    .ping-hit { width: 100%; min-height: 200px; font-size: 2.4rem; font-weight: 900; border-radius: 24px; border: none; background: linear-gradient(135deg,#22d3ee,#a78bfa); color: #0f172a; }
  `],
})
export class RemoteComponent implements OnInit, OnDestroy {

  public ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private swUpdate = inject(SwUpdate);
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'ROULETTE' | 'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO' | 'WHEEL_OF_FORTUNE' | 'SCREAM_RACE' | 'ARENA' | 'TIMELINE' | 'PRICE' | 'SPEED_RUSH' | 'PING_PONG'>('QUIZ');
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
  arenaQuestion = signal<{ text: string, options?: string[], isTrueFalse: boolean, questionId: string } | null>(null);
  isFetchingQuestion = signal(false);
  categories = signal<any[]>([]);

  currentRoundType: string = '';

  // ---- Giochi simultanei: stato locale del telefono ----
  timelineCards = signal<Array<{ id: number; label: string }>>([]);
  timelineOrder = signal<number[]>([]);

  priceEstimate = signal<string>('');
  priceName = signal<string>('');
  priceEmoji = signal<string>('🛒');
  priceKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  speedKind = signal<'idle' | 'tap' | 'odd' | 'order'>('idle');
  speedTapCount = signal(0);
  speedOdd = signal<string[]>([]);
  private speedOddAnswer = '';
  speedSequence = signal<number[]>([]);
  speedPicked = signal<number[]>([]);

  pingHits = signal(0);
  private lastPingAt = 0;

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
  private volumeTimer?: ReturnType<typeof setInterval>;

  isListening = signal(false);
  currentVolume = signal(0);
  isScreaming = signal(false);
  microphoneError = signal<string | null>(null);

  ngOnInit(): void {
    this.setupPWA();
    this.checkForUpdates();
    this.lockOrientation();

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
            this.gameState.set('WAITING'); // Mostra UI attivazione

            setTimeout(() => {
              this.startMicrophoneListening();
            }, 500); // Piccolo delay per evitare race condition
          }
          break;

        case 'START_VOTING':
          this.isBlocked.set(false);
          this.onStartVoting(status.type, status.payload);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.speedKind.set('idle');
          this.timelineOrder.set([]);
          this.priceEstimate.set('');
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

    if (intensity > 5 && nickname && this.questionType() === 'SCREAM_RACE' && this.gameState() === 'VOTING') {
      this.ws.sendScream(this.gameId(), nickname, intensity);
      
    }

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
    } else if (type === 'TIMELINE') {
      const data = this.parsePayload(payload);
      this.timelineCards.set(data?.items ?? []);
      this.timelineOrder.set([]);
    } else if (type === 'PRICE') {
      const data = this.parsePayload(payload);
      this.priceName.set(data?.name ?? '');
      this.priceEmoji.set(data?.emoji ?? '🛒');
      this.priceEstimate.set('');
    } else if (type === 'SPEED_RUSH') {
      this.startSpeedRush();
    } else if (type === 'PING_PONG') {
      this.pingHits.set(0);
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

  toggleTimelineCard(id: number): void {
    const order = this.timelineOrder();
    this.timelineOrder.set(order.includes(id) ? order.filter((value) => value !== id) : [...order, id]);
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

  pricePress(key: string): void {
    const current = this.priceEstimate();
    if (current.length >= 8) return;
    if (key === '.' && current.includes('.')) return;
    this.priceEstimate.set(current + key);
    this.vibrate(8);
  }

  priceBackspace(): void {
    this.priceEstimate.set(this.priceEstimate().slice(0, -1));
  }

  sendPriceAnswer(): void {
    const playerName = this.nickname();
    const value = parseFloat(this.priceEstimate().replace(',', '.'));
    if (!playerName || !isFinite(value) || value <= 0) return;

    this.hasAnswered.set(true);
    this.gameService.submitPrice(this.gameId(), playerName, value).subscribe({
      next: () => this.gameState.set('WAITING'),
      error: () => this.gameState.set('WAITING'),
    });
    this.vibrate(40);
  }

  startSpeedRush(): void {
    this.speedPicked.set([]);
    this.nextSpeedTask();
  }

  private nextSpeedTask(): void {
    const kinds = ['tap', 'odd', 'order'] as const;
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

    const numbers = [1, 2, 3].sort(() => Math.random() - 0.5);
    this.speedSequence.set(numbers);
    this.speedPicked.set([]);
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
    this.ws.broadcastStatus(this.gameId(), {
      action: 'SPEED_RUSH_PROGRESS',
      playerName: this.nickname(),
      correct,
    });
    this.vibrate(correct ? 30 : [40, 40, 40]);
    this.speedKind.set('idle');
    setTimeout(() => this.nextSpeedTask(), 300);
  }

  sendPingPongHit(): void {
    const now = Date.now();
    if (now - this.lastPingAt < 180 || !this.nickname()) return;
    this.lastPingAt = now;

    this.pingHits.update((value) => value + 1);
    this.ws.broadcastStatus(this.gameId(), {
      action: 'PING_PONG_HIT',
      playerName: this.nickname(),
    });
    this.vibrate(20);
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
    if (!q || !q.options || !playerName) return;

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
