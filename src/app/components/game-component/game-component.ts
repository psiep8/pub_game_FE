// src/app/components/game/game.component.ts

import {Component, signal, inject, OnInit, HostListener, OnDestroy, ElementRef, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';
import {firstValueFrom} from 'rxjs';

import {GameRound, GameService} from '../../services/game.service';
import {WebSocketService} from '../../services/web-socket.service';
import {AiGeneratorService} from '../../services/ai-generator-service';
import {GameModeService} from '../../services/game-mode-factory.service';
import {ImageBlur} from './games/image-blur/image-blur';
import {Quiz} from './games/quiz/quiz';
import {WheelFortune} from './games/wheel-fortune/wheel-fortune';
import {TrueFalse} from './games/true-false/true-false';
import {Chrono} from './games/chrono/chrono';
import {environment} from '../../environment/environment';
import {GameModeType, IGameMode} from './interfaces/game-mode-type';

@Component({
  selector: 'app-game-component',
  standalone: true,
  imports: [
    CommonModule,
    WheelFortune,
    Chrono,
    TrueFalse,
    Quiz,
    ImageBlur,
  ],
  templateUrl: './game-component.html',
  styleUrl: './game-component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class GameComponent implements OnInit, OnDestroy {
  public ws = inject(WebSocketService);
  private gameService = inject(GameService);
  private aiService = inject(AiGeneratorService);
  private gameModeService = inject(GameModeService);

  // State
  allCategories = signal<any[]>([]);
  round = signal<GameRound | null>(null);
  currentMode = signal<IGameMode | null>(null);

  // UI State
  phase = signal<'IDLE' | 'SPINNING' | 'SELECTED' | 'QUESTION'>('IDLE');
  isSpinning = signal(false);
  selectedCategoryId = signal<number | null>(null);
  showQuestion = signal(false);
  showTypeReveal = signal<string | null>(null);
  timer = signal(0);
  preStartCountdown = signal<number>(0);
  isPaused = signal(false);
  animatedCategoryId = signal<number | null>(null);

  // Modals
  showResetModal = signal(false);
  showResultPopup = signal(false);
  resultType = signal<'correct' | 'wrong'>('correct');
  resultPoints = signal(0);
  resultPlayerName = signal('');

  currentGameId = signal<number | null>(null);

  // QR Code
  remoteUrl = `${environment.frontendUrl}/play`;
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.remoteUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10&qzone=1`;

  @ViewChild('prestartTimer', {read: ElementRef, static: false}) prestartTimer?: ElementRef<HTMLElement>;

  // Audio per pre-start (opzionale)
  private prestartAudio?: HTMLAudioElement;
  private audioAllowed = false; // diventa true dopo la prima interazione

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

  async ngOnInit() {
    try {
      const cats = await firstValueFrom(this.gameService.getCategories());
      const positioned = this.generateNonOverlappingPositions(cats);
      this.allCategories.set(positioned);

      const savedId = localStorage.getItem('activeGameId');
      if (savedId) {
        this.currentGameId.set(+savedId);
      }
    } catch (err) {
      console.error("Errore inizializzazione:", err);
    }

    // Precarica audio se presente
    try {
      this.prestartAudio = new Audio('/sounds/prestart-beep.mp3');
      this.prestartAudio.preload = 'auto';
    } catch (e) {
      this.prestartAudio = undefined;
    }

    // Intercettiamo la prima interazione dell'utente per abilitare l'audio (policy autoplay)
    const allowAudioOnce = () => {
      this.audioAllowed = true;
      window.removeEventListener('click', allowAudioOnce);
      window.removeEventListener('keydown', allowAudioOnce);
    };
    window.addEventListener('click', allowAudioOnce);
    window.addEventListener('keydown', allowAudioOnce);

    // WebSocket responses: ignoriamo le risposte mentre la mode è in fase di lettura
    this.ws.responses$.subscribe(res => {
      const mode = this.currentMode();
      if (!mode) return;

      // Se la modalità espone getIsReading e la fase di lettura è attiva, ignoriamo le risposte
      const isReading = (mode as any).getIsReading?.() ?? false;
      if (isReading) return;

      if (!mode.requiresBuzz) {
        mode.handleAnswer(res.playerName, res.answerIndex, res.responseTimeMs);
      } else if (res.answerIndex === -1) {
        mode.handleBuzz(res.playerName);
      }
    });

    // Effetto: osserva i cambi al preStartCountdown e riavvia l'animazione + suono
    // Poiché usiamo segnali, usiamo un piccolo polling via setInterval per reattare ai cambi
    let lastPreStart = this.preStartCountdown();
    setInterval(() => {
      const cur = this.preStartCountdown();
      if (cur !== lastPreStart) {
        // cambia valore
        // se siamo nella finestra 1..5, proviamo a riprodurre l'audio e riavviare l'animazione
        if (cur > 0 && cur <= 5) {
          // Riavvia effetto bounce (rimuovi e riaggiungi classe) per forzare replay animation
          try {
            const el = this.prestartTimer?.nativeElement;
            if (el) {
              el.classList.remove('bounce');
              // trigger reflow
              void el.offsetWidth;
              el.classList.add('bounce');
            }
          } catch (err) {
            // ignore
          }

          if (this.audioAllowed && this.prestartAudio) {
            try {
              // play non in modo await per non bloccare
              this.prestartAudio.currentTime = 0;
              const p = this.prestartAudio.play();
              if (p && typeof p.then === 'function') {
                p.catch(() => {/* autoplay bloccato */
                });
              }
            } catch (e) {
              // ignore
            }
          }
        }
        lastPreStart = cur;
      }
    }, 120); // polling leggero: 8 volte al secondo
    this.ws.status$.subscribe((status: any) => {
      if (!status) return;

      if (status.action === 'ADMIN_CONFIRM_CORRECT') {
        this.confirmCorrect();
      } else if (status.action === 'ADMIN_CONFIRM_WRONG') {
        this.confirmWrong();
      }
    });
  }

  ngOnDestroy() {
    this.gameModeService.cleanup();
  }

  async startNewRound() {
    if (this.isSpinning()) return;

    // Reset UI e segnali
    this.reset();

    // Crea gioco se non esiste
    if (!this.currentGameId()) {
      const newGame = await firstValueFrom(this.gameService.createGame());
      this.currentGameId.set(newGame.id);
      localStorage.setItem('activeGameId', newGame.id.toString());
    }

    const types: GameModeType[] = ['WHEEL_OF_FORTUNE'];
    const extractedType = types[Math.floor(Math.random() * types.length)];

    // Animazione estrazione tipo
    this.phase.set('SPINNING');
    this.showTypeReveal.set(extractedType);
    await new Promise(r => setTimeout(r, 5000));
    this.showTypeReveal.set(null);

    this.isSpinning.set(true);

    try {
      const categoryName = this.getCategoryForType(extractedType);

      // Selezione categoria reale
      const categories = this.allCategories();
      const selectedCategory = categories.find(c => c.name === categoryName);
      if (selectedCategory) this.selectedCategoryId.set(selectedCategory.id);

      // Crea round AI
      const nextRound = await firstValueFrom(
        this.aiService.triggerNewAiRound(
          this.currentGameId()!,
          categoryName,
          extractedType,
          'medio'
        )
      );

      if (typeof nextRound.payload === 'string') {
        nextRound.payload = JSON.parse(nextRound.payload);
      }

      this.round.set(nextRound);

      // Crea modalità tramite factory
      const mode = this.gameModeService.createMode({
        type: extractedType,
        payload: nextRound.payload,
        gameId: this.currentGameId()!,
        onTimerTick: (seconds) => this.timer.set(seconds),
        onTimerEnd: () => this.onModeTimeout(),
        onBuzz: (playerName) => this.onPlayerBuzz(playerName)
      });

      (mode as any).setConfig?.({
        ...((mode as any).config ?? {}),
        onPreGameTick: (sec: number) => this.preStartCountdown.set(sec)
      });

      this.currentMode.set(mode);

      // Mostra bolla fake per animazione
      if (mode.requiresBubbles) {
        const randomIndex = Math.floor(Math.random() * categories.length);
        this.animatedCategoryId.set(categories[randomIndex].id);

        this.phase.set('SPINNING');
        await new Promise(r => setTimeout(r, 5000));

        // Mostra categoria reale
        this.phase.set('SELECTED');
        this.animatedCategoryId.set(this.selectedCategoryId());
        await new Promise(r => setTimeout(r, 5000));
      }

      this.phase.set('QUESTION');
      this.showQuestion.set(true);

      // Imposta timer UI fermo durante fase lettura
      this.timer.set(mode.timerDuration);

      // 🔥 INVIO PAYLOAD ALL'ADMIN - PRIMA DI START_VOTING
      this.ws.broadcastStatus(1, {
        action: 'SHOW_QUESTION',
        type: extractedType,
        payload: nextRound.payload  // ✅ Invia la risposta corretta all'admin!
      });

      console.log('📤 Payload inviato all\'admin:', nextRound.payload);

      // Avvia la modalità con pausa interna
      await mode.start();

      this.ws.broadcastStatus(1, {
        action: 'START_VOTING',
        type: extractedType
      });

      this.isSpinning.set(false);

    } catch (err) {
      console.error('Errore nuovo round:', err);
      this.isSpinning.set(false);
      this.phase.set('IDLE');
    }
  }

  private getCategoryForType(type: GameModeType): string {
    switch (type) {
      case 'IMAGE_BLUR':
        return 'CELEBRITÀ';
      case 'WHEEL_OF_FORTUNE':
        return 'PROVERBI E MODI DI DIRE';
      default:
        const categories = this.allCategories();
        const randomIndex = Math.floor(Math.random() * categories.length);
        return categories[randomIndex].name;
    }
  }


  private onModeTimeout() {
    const mode = this.currentMode();
    if (!mode) return;

    // Imposta round come REVEAL
    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    if (mode.type === 'IMAGE_BLUR' || mode.type === 'WHEEL_OF_FORTUNE') {
      this.showTimeoutPopup();
    }

    // Notifica telefoni
    this.ws.broadcastStatus(1, {action: 'ROUND_ENDED'});
    // Assicuriamoci che la fase di spinning sia disattivata quando il round finisce
    this.isSpinning.set(false);
  }

  private onPlayerBuzz(playerName: string) {
    this.ws.broadcastStatus(1, {
      action: 'PLAYER_PRENOTATO',
      name: playerName
    });
  }

  confirmCorrect() {
    const mode = this.currentMode();
    if (!mode) return;

    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;

    // 1. Recuperiamo il tempo trascorso (il mode tiene traccia di quando è iniziato il timer)
    // Se il mode non ha un metodo per il tempo, usiamo la differenza dal timer attuale
    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);

    // 2. Usiamo la logica del mode per calcolare i punti REALI
    const realPoints = (mode as any).calculatePoints(true, elapsedMs);

    mode.confirmCorrect(playerName);

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    this.isSpinning.set(false);

    // 3. Settiamo i punti reali per il popup e per il broadcast
    this.resultType.set('correct');
    this.resultPoints.set(realPoints); // <--- DINAMICO
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(1, {
      action: 'ROUND_ENDED',
      winner: playerName,
      points: realPoints // <--- DINAMICO
    });

    setTimeout(() => this.showResultPopup.set(false), 5000);
  }

  confirmWrong() {
    const mode = this.currentMode();
    if (!mode) return;

    const playerName = mode.getDisplayData().buzzedPlayer;
    if (!playerName) return;

    const elapsedMs = (mode.timerDuration * 1000) - (this.timer() * 1000);

    // Calcolo punti dinamico anche per l'errore
    const realPoints = (mode as any).calculatePoints(false, elapsedMs);

    mode.confirmWrong(playerName);

    const currentRound = this.round();
    if (currentRound) {
      this.round.set({...currentRound, status: 'REVEAL'});
    }

    this.isSpinning.set(false);

    this.resultType.set('wrong');
    this.resultPoints.set(realPoints); // <--- DINAMICO (-1000 a scalare)
    this.resultPlayerName.set(playerName);
    this.showResultPopup.set(true);

    this.ws.broadcastStatus(1, {
      action: 'BLOCKED_ERROR',
      blockedPlayer: playerName,
      points: realPoints // Passiamo i punti anche qui se serve al database/classifica
    });

    setTimeout(() => this.showResultPopup.set(false), 3000);
  }

  private showTimeoutPopup() {
    const mode = this.currentMode();
    if (!mode) return;

    this.resultType.set('correct');
    this.resultPoints.set(0);
    this.resultPlayerName.set('Tempo Scaduto!');
    this.showResultPopup.set(true);

    setTimeout(() => this.showResultPopup.set(false), 5000);
  }

  togglePause() {
    const mode = this.currentMode();
    if (!mode) return;

    if (this.isPaused()) {
      mode.resume();
      this.isPaused.set(false);
    } else {
      mode.pause();
      this.isPaused.set(true);
    }
  }

  private reset() {
    this.ws.responses.set([]);
    this.showQuestion.set(false);
    this.round.set(null);
    this.selectedCategoryId.set(null);
    this.timer.set(0);
    this.isPaused.set(false);
    this.showResultPopup.set(false);
    this.currentMode.set(null);
  }

  openResetModal() {
    this.showResetModal.set(true);
  }

  confirmReset() {
    this.showResetModal.set(false);
    location.reload();
  }

  private generateNonOverlappingPositions(categories: any[]) {
    // Genera posizioni con semplice avoidance: tenta posizionare ogni bubble lontano dalle altre
    const placed: Array<{ top: number, left: number }> = [];
    const results = categories.map(cat => ({...cat}));

    const attemptsLimit = 300;
    const minDistance = 18; // percentuale minima tra centri (più distanza per bolle più sparse)

    for (let i = 0; i < results.length; i++) {
      let attempts = 0;
      let top = 0;
      let left = 0;
      do {
        top = Math.random() * 70 + 10; // 10%..80%
        left = Math.random() * 80 + 5; // 5%..85%
        attempts++;
        // verifica distanza da tutte quelle già piazzate
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

      // registra
      placed.push({top, left});
      results[i].top = top + '%';
      results[i].left = left + '%';
    }

    return results;
  }

  // Restituisce una versione "sicura" dei displayData per i componenti figlio:
  // evita che la `correctAnswer` venga esposta finché la mode non è rivelata
  getSafeDisplayData(): any {
    const mode = this.currentMode();
    const data = mode ? (mode.getDisplayData() || {}) : {};
    // Se la mode non è rivelata, assicuriamoci che correctAnswer non sia presente
    const isReading = mode ? ((mode as any).getIsReading?.() ?? false) : false;
    const safe = {...data, isReading} as any;
    if (!mode || !mode.isRevealed()) {
      safe.correctAnswer = null;
    }
    // defaults
    safe.question = safe.question ?? '';
    safe.options = Array.isArray(safe.options) ? safe.options : [];
    safe.correctAnswer = safe.correctAnswer ?? null;
    return safe;
  }

  // Preview del punteggio per mostrare accanto al countdown pre-start
  getPrestartPreview(): string {
    const mode = this.currentMode();
    if (!mode) return '';
    // user may want to see potential positive/negative score based on speed
    const seconds = this.preStartCountdown();
    const duration = (mode as any).timerDuration ?? 10;

    // Per quiz/true_false -> mostra +X / -X (velocità-based)
    if (mode.type === 'QUIZ' || mode.type === 'TRUE_FALSE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score} / -${score}`;
    }

    // Per chrono/wheel -> vittoria singola: mostra +X
    if (mode.type === 'CHRONO' || mode.type === 'WHEEL_OF_FORTUNE') {
      const score = this.computePreviewScore(seconds, duration);
      return `+${score}`;
    }

    return '';
  }

  // Calcola il punteggio di preview basato sul tempo relativo (0..duration) -> 0..1000
  private computePreviewScore(secondsFromNow: number, duration: number): number {
    // Interpretazione: più veloce = valore più alto; normalizziamo usando (1 - t/d)
    const t = Math.max(0, Math.min(duration, secondsFromNow));
    const fraction = 1 - (t / Math.max(1, duration));
    return Math.round(fraction * 1000);
  }

  // Ritorna le ultime risposte ricevute (max 6) per il box risposte
  getRecentResponses(): any[] {
    const all = this.ws.responses();
    if (!Array.isArray(all)) return [];
    return all.slice(-6).reverse();
  }
}
