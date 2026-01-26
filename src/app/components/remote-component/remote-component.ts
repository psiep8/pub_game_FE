import {Component, inject, OnDestroy, OnInit, signal, HostListener} from '@angular/core';
import {WebSocketService} from '../../services/web-socket.service';
import {FormsModule} from '@angular/forms';
import {SwUpdate, VersionReadyEvent} from '@angular/service-worker';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'app-remote-component',
  imports: [FormsModule],
  templateUrl: './remote-component.html',
  styleUrl: './remote-component.scss',
})
export class RemoteComponent implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);
  private swUpdate = inject(SwUpdate);
  private updateCheckInterval?: any;
  private versionUpdatesSub?: any;

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO' | 'WHEEL_OF_FORTUNE'>('QUIZ');
  hasAnswered = signal(false);
  selectedYear = signal<number>(2000);
  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1);

  currentRoundType: string = '';

  // PWA States
  showInstallBanner = signal(false);
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

  ngOnInit(): void {
    // Setup PWA
    this.setupPWA();
    this.checkForUpdates();
    this.lockOrientation();

    // WebSocket listeners
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          // La TV mostra la domanda ma il voting non è ancora aperto: nascondi i bottoni
          this.gameState.set('WAITING');
          this.questionType.set(status.type);
          break;

        case 'START_VOTING':
          this.onStartVoting(status.type);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.gameState.set('WAITING');
          break;

        case 'BLOCKED_ERROR':
          // Se sono io quello bloccato, resto bloccato fino alla fine
          if (status.blockedPlayer === this.nickname()) {
            this.gameState.set('BLOCKED_ERROR');
          } else {
            // Gli altri possono giocare di nuovo
            this.gameState.set('VOTING');
          }
          break;

        case 'PLAYER_PRENOTATO':
          if (status.name !== this.nickname()) {
            this.gameState.set('WAITING_FOR_OTHER');
          }
          break;
      }
    });
  }

  // ========== PWA SETUP ==========

  private setupPWA() {
    // Intercetta evento di installazione
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      // Mostra banner solo se non è già installata
      if (!this.isAppInstalled()) {
        this.showInstallBanner.set(true);
      }
    });

    // Rileva quando l'app è stata installata
    window.addEventListener('appinstalled', () => {
      console.log('🎉 PWA installata con successo!');
      this.showInstallBanner.set(false);
      this.deferredPrompt = null;
    });
  }

  private checkForUpdates() {
    if (!this.swUpdate.isEnabled) {
      console.log('⚠️ Service Worker disabilitato (probabilmente in dev mode)');
      return;
    }

    // Controlla aggiornamenti ogni 30 minuti
    this.updateCheckInterval = setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 30 * 60 * 1000);

    // Quando c'è un aggiornamento pronto
    this.versionUpdatesSub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.showUpdateBanner.set(true);
      });
  }

  private isAppInstalled(): boolean {
    // Rileva se l'app è in modalità standalone (installata)
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  }

  // Azioni PWA per l'utente
  async installPWA() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ Utente ha accettato l\'installazione');
    } else {
      console.log('❌ Utente ha rifiutato l\'installazione');
    }

    this.deferredPrompt = null;
    this.showInstallBanner.set(false);
  }

  dismissInstallBanner() {
    this.showInstallBanner.set(false);
  }

  updateApp() {
    this.swUpdate.activateUpdate().then(() => {
      window.location.reload();
    });
  }

  dismissUpdateBanner() {
    this.showUpdateBanner.set(false);
  }

  // ========== BLOCCA ORIENTAMENTO ==========

  private async lockOrientation() {
    try {
      const screen = window.screen as any;
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      console.log('Orientamento non bloccabile su questo dispositivo');
    }
  }

  // ========== GAME LOGIC (invariato) ==========

  setNickname() {
    if (this.tempNickname.trim()) {
      this.nickname.set(this.tempNickname);
      localStorage.setItem('nickname', this.tempNickname);
    }
  }

  sendVote(index: number) {
    const responseTimeMs = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, index, responseTimeMs);
    this.hasAnswered.set(true);
    this.gameState.set('LOCKED');
    this.vibrate(50);
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, -1, time);
    this.gameState.set('LOCKED');
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string) {
    this.gameState.set('VOTING');
    this.questionType.set(type as "QUIZ" | "TRUE_FALSE" | "MUSIC" | "IMAGE_BLUR" | "CHRONO" | "WHEEL_OF_FORTUNE");
    this.roundStartTime = Date.now();
    this.startTime = Date.now();
    this.selectedYear.set(2000);
    this.hasAnswered.set(false);
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
  }

  setupNewRound(type: string) {
    this.currentRoundType = type;
    this.hasAnswered.set(false);
    this.startTime = Date.now();
    if (type === 'CHRONO') {
      this.selectedYear.set(2000);
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
