import { signal, WritableSignal } from '@angular/core';
import { EMPTY, Observable, of, Subject } from 'rxjs';

/**
 * Doppi di test condivisi.
 *
 * Le spec dei componenti non devono aprire WebSocket, chiamare HTTP o creare
 * elementi `Audio`: qui trovano dei sostituti minimi e osservabili.
 * La cartella è esclusa da `tsconfig.app.json`, quindi non finisce nel bundle.
 */

export interface BroadcastedStatus {
  destination: string;
  body: any;
}

export class FakeWebSocketService {
  readonly responses: WritableSignal<any[]> = signal<any[]>([]);
  readonly connected = signal(false);
  readonly connectionState = signal<'online' | 'reconnecting' | 'offline'>('online');
  readonly reconnectAttempts = signal(0);
  readonly lastConnectedAt = signal<number | null>(null);
  readonly connectedAt$ = new Subject<number>();

  readonly status$ = new Subject<any>();
  readonly responses$ = new Subject<any>();

  readonly broadcasted: BroadcastedStatus[] = [];
  readonly publishedAnswers: Array<{
    gameId: number;
    playerName: string;
    answerIndex: number;
    responseTimeMs: number;
  }> = [];
  readonly publishedScreams: Array<{ gameId: number; playerName: string; intensity: number }> = [];
  readonly subscribedGames: number[] = [];

  subscribeToGame(gameId: number): void {
    this.subscribedGames.push(gameId);
  }

  sendAnswer(gameId: number, playerName: string, answerIndex: number, responseTimeMs: number): boolean {
    this.publishedAnswers.push({ gameId, playerName, answerIndex, responseTimeMs });
    return true;
  }

  sendScream(gameId: number, playerName: string, intensity: number): void {
    this.publishedScreams.push({ gameId, playerName, intensity });
  }

  broadcastStatus(gameId: number, payload: any): boolean {
    this.broadcasted.push({ destination: `/app/game/${gameId}/status`, body: payload });
    return true;
  }

  setSessionToken(_token: string): void {}

  connect(): void {
    this.connected.set(true);
  }

  disconnect(): void {
    this.connected.set(false);
  }

  clearResponses(): void {
    this.responses.set([]);
  }
}

export class FakeGameService {
  readonly categories = [
    { id: 1, name: 'CULTURA GENERALE', active: true },
    { id: 2, name: 'MUSICA', active: true },
    { id: 3, name: 'FORTUNA', active: true },
  ];

  getCategories(): Observable<any[]> {
    return of(this.categories);
  }

  getActiveGame(): Observable<{ gameId: number | null }> {
    return of({ gameId: 1 });
  }

  createGame(): Observable<any> {
    return of({ id: 1 });
  }

  getNextRound(_gameId: number): Observable<any> {
    return of({ id: 1, status: 'ACTIVE', roundIndex: 0, type: 'QUIZ', payload: {} });
  }

  getCurrentRound(_gameId: number): Observable<any> {
    return of({ id: 1, status: 'ACTIVE', roundIndex: 0, type: 'QUIZ', payload: {} });
  }

  closeRound(_gameId: number, _reason?: string): Observable<any> {
    return of({ closed: true });
  }

  resetGame(_gameId: number): Observable<any> {
    return of({ reset: true });
  }

  submitTimeline(_gameId: number, _playerName: string, _order: number[], _key?: string, _roundId?: string): Observable<any> {
    return of({});
  }

  getArenaQuestion(_gameId: number, _category: string, playerId: string): Observable<any> {
    return of({
      question: 'Domanda di prova?',
      options: ['A', 'B'],
      correctAnswer: 'A',
      questionId: 'q-test',
      playerId,
    });
  }

  answerArenaQuestion(
    _gameId: number,
    _playerId: string,
    _questionId: string,
    answer: string,
  ): Observable<any> {
    return of({ correct: answer === 'A', totalScore: 10, correctAnswer: 'A' });
  }
}

export class FakeAiGeneratorService {
  readonly calls: Array<{ gameId: number | null; category: string; type: string; difficulty: string }> =
    [];

  triggerNewAiRound(
    gameId: number | null,
    category: string,
    type: string,
    difficulty: string,
  ): Observable<any> {
    this.calls.push({ gameId, category, type, difficulty });
    return of({
      id: 1,
      status: 'ACTIVE',
      roundIndex: 0,
      type,
      payload: { question: 'Domanda AI?', options: ['A', 'B'], correctAnswer: 'A', type },
    });
  }
}

export class FakeAudioService {
  readonly played: string[] = [];

  readonly startAmbient = () => this.played.push('ambient');
  readonly stopAmbient = () => this.played.push('stop-ambient');
  readonly playJoin = () => this.played.push('join');
  readonly playCountdownTick = () => this.played.push('countdown-tick');
  readonly playCountdownBong = () => this.played.push('countdown-bong');
  readonly playElimination = () => this.played.push('elimination');
  readonly playPodium = () => this.played.push('podium');
  readonly playPodiumReveal = (position: number) => this.played.push(`podium-reveal-${position}`);
  readonly playDrumroll = (_seconds = 2, _strength = 0.6) => this.played.push('drumroll');
  readonly playTick = () => this.played.push('tick');
  readonly playWhoosh = () => this.played.push('whoosh');
  readonly startHeartbeat = (_intensity = 0) => this.played.push('heartbeat');
  readonly stopHeartbeat = () => this.played.push('stop-heartbeat');
  readonly startSuspense = (round: number) => this.played.push(`suspense-${round}`);
  readonly stopSuspense = () => this.played.push('stop-suspense');
  readonly startClock = () => this.played.push('clock');
  readonly stopClock = () => this.played.push('stop-clock');
  readonly playBell = () => this.played.push('bell');
  readonly playCorrect = () => this.played.push('correct');
  readonly playWrong = () => this.played.push('wrong');
  readonly playCoins = () => this.played.push('coins');
  readonly playApplause = () => this.played.push('applause');
  readonly playUuuh = () => this.played.push('uuuh');
  readonly playBombSiren = () => this.played.push('bomb-siren');
  readonly playConfirm = () => this.played.push('confirm');
  readonly playError = () => this.played.push('error');
  readonly playReveal = () => this.played.push('reveal');
  readonly stopAll = () => this.played.push('stop-all');

  isEnabled(): boolean {
    return true;
  }

  toggleAudio(): void {}

  context(): AudioContext | undefined {
    return undefined;
  }

  output(): AudioNode | undefined {
    return undefined;
  }

  unlock(): Promise<void> {
    return Promise.resolve();
  }
}

export class FakeSwUpdate {
  readonly isEnabled = false;
  readonly versionUpdates = EMPTY;
  readonly activateUpdate = () => Promise.resolve(false);
  readonly checkForUpdate = () => Promise.resolve(false);
}

/**
 * Doppio del livello di affidabilità: nessuna HTTP, nessun localStorage.
 * La spec verifica il comportamento del componente, non la rete.
 */
export class FakeReliabilityService {
  readonly online = signal(true);
  readonly syncing = signal(false);
  readonly stateVersion = signal(0);
  readonly seq = signal(0);
  readonly lastSyncAt = signal<number | null>(null);
  readonly sessionToken = signal<string | null>(null);
  readonly resumedSession = signal(false);
  readonly duplicateDisplay = signal(false);
  readonly serverSkewMs = signal(0);
  readonly lastError = signal<string | null>(null);
  readonly reconnectCount = signal(0);
  readonly syncState$ = new Subject<any>();
  readonly syncEvent$ = new Subject<any>();
  readonly started: Array<{ gameId: number; role: string; playerName?: string }> = [];

  async start(gameId: number, role: string, playerName = ""): Promise<boolean> {
    this.started.push({ gameId, role, playerName });
    return true;
  }

  stop(): void {}

  serverNow(): number {
    return Date.now();
  }

  deviceId(): string {
    return 'device-test';
  }

  idempotencyKey(kind: string, discriminator: string): string {
    return `${kind}:${discriminator}`;
  }

  async ensureSession(): Promise<boolean> {
    return true;
  }

  async sync(): Promise<void> {}

  async heartbeat(): Promise<void> {}

  async diagnostics(): Promise<any | null> {
    return null;
  }
}
