// src/app/components/remote/remote-component.ts

import { Component, inject, OnDestroy, OnInit, signal, HostListener } from '@angular/core';
import { WebSocketService } from '../../services/web-socket.service';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

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
  questionType = signal<'ROULETTE' | 'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO' | 'WHEEL_OF_FORTUNE'>('QUIZ');
  hasAnswered = signal(false);
  selectedYear = signal<number>(2000);

  // 🔥 Range dinamico da backend
  minYear = signal<number>(1000);
  maxYear = signal<number>(2026);
  yearStep = signal<number>(1);

  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1);

  currentRoundType: string = '';

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
    this.setupPWA();
    this.checkForUpdates();
    this.lockOrientation();

    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'SHOW_QUESTION':
          this.questionType.set(status.type);
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
              console.log(`📅 CHRONO Range: ${this.minYear()}-${this.maxYear()}, step: ${this.yearStep()}`);
            } catch (e) {
              console.error('❌ Errore parsing CHRONO payload:', e);
            }
          }

          if (status.type === 'ROULETTE') {
            console.log('📱 ROULETTE - Bottoni attivi SUBITO');
            this.gameState.set('VOTING');
            this.hasAnswered.set(false);
            this.startTime = Date.now();
          } else {
            this.gameState.set('WAITING');
          }
          break;

        case 'START_VOTING':
          this.onStartVoting(status.type, status.payload);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.gameState.set('WAITING');
          this.hasAnswered.set(false);
          break;

        case 'BLOCKED_ERROR':
          if (status.blockedPlayer === this.nickname()) {
            this.gameState.set('BLOCKED_ERROR');
          } else {
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

  private setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      if (!this.isAppInstalled()) {
        this.showInstallBanner.set(true);
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 PWA installata');
      this.showInstallBanner.set(false);
      this.deferredPrompt = null;
    });
  }

  private checkForUpdates() {
    if (!this.swUpdate.isEnabled) {
      console.log('⚠️ Service Worker disabilitato');
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
      console.log('✅ Installazione accettata');
    } else {
      console.log('❌ Installazione rifiutata');
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

  private async lockOrientation() {
    try {
      const screen = window.screen as any;
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      console.log('Orientamento non bloccabile');
    }
  }

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
    console.log(`📱 Voto: ${index}, tempo: ${responseTimeMs}ms`);
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, -1, time);
    this.gameState.set('LOCKED');
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string, payload?: any) {
    console.log(`📱 START_VOTING: ${type}`);

    this.gameState.set('VOTING');
    this.questionType.set(type as any);
    this.roundStartTime = Date.now();
    this.startTime = Date.now();
    this.hasAnswered.set(false);

    // 🔥 Per CHRONO, aggiorna range se presente nel payload
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
    }
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
