import {Component, inject, OnDestroy, OnInit, signal, HostListener} from '@angular/core';
import {WebSocketService} from '../../services/web-socket.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-remote-component',
  imports: [FormsModule],
  templateUrl: './remote-component.html',
  styleUrl: './remote-component.scss',
})
export class RemoteComponent implements OnInit, OnDestroy {

  private ws = inject(WebSocketService);

  nickname = signal<string | null>(localStorage.getItem('nickname'));
  tempNickname = '';
  startTime: number = 0;

  gameState = signal<'WAITING' | 'VOTING' | 'LOCKED' | 'WAITING_FOR_OTHER' | 'BLOCKED_ERROR'>('WAITING');
  questionType = signal<'QUIZ' | 'TRUE_FALSE' | 'MUSIC' | 'IMAGE_BLUR' | 'CHRONO'>('QUIZ');
  hasAnswered = signal(false);
  selectedYear = signal<number>(2000);
  private roundStartTime: number = 0;
  playerName = signal<string>(localStorage.getItem('playerName') || '');
  gameId = signal<number>(1);

  currentRoundType: string = '';

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('modern-slider')) {
      event.preventDefault(); // Blocca tutto tranne lo slider
    }
  }

  @HostListener('window:gesturestart', ['$event'])
  @HostListener('window:gesturechange', ['$event'])
  @HostListener('window:gestureend', ['$event'])
  onGesture(event: Event) {
    event.preventDefault(); // Blocca zoom con pinch
  }

  ngOnInit(): void {
    // Registra il Service Worker per PWA
    this.registerServiceWorker();

    // Forza orientamento landscape se possibile
    this.lockOrientation();

    // WebSocket listeners
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      switch (status.action) {
        case 'START_VOTING':
          this.onStartVoting(status.type);
          break;

        case 'ROUND_ENDED':
        case 'REVEAL':
          this.gameState.set('WAITING');
          break;

        case 'RESUME_AFTER_ERROR':
          if (status.blockedPlayer !== this.nickname()) {
            this.gameState.set('WAITING');
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

  // Registra Service Worker per PWA
  private registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        registration => console.log('SW registrato:', registration.scope),
        error => console.log('SW fallito:', error)
      );
    }
  }

  // Blocca l'orientamento in landscape (solo su alcuni browser)
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

    // Vibrazione feedback
    this.vibrate(50);
  }

  sendBuzz() {
    const time = Date.now() - this.startTime;
    this.ws.sendAnswer(1, this.nickname()!, -1, time);
    this.gameState.set('LOCKED');

    // Vibrazione forte per buzz
    this.vibrate([100, 50, 100]);
  }

  onStartVoting(type: string) {
    this.gameState.set('VOTING');
    this.questionType.set(type as "QUIZ" | "TRUE_FALSE" | "MUSIC" | "IMAGE_BLUR" | "CHRONO");
    this.roundStartTime = Date.now();
    this.startTime = Date.now();
    this.selectedYear.set(2000);
    this.hasAnswered.set(false);
  }

  onYearChange(event: any) {
    this.selectedYear.set(parseInt(event.target.value));
    // Vibrazione leggera mentre si muove lo slider
    this.vibrate(10);
  }

  private calculateResponseTime(): number {
    if (this.startTime === 0) return 5000;
    return Date.now() - this.startTime;
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
  }
}
