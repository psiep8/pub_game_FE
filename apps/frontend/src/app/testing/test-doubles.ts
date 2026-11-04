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

  sendAnswer(gameId: number, playerName: string, answerIndex: number, responseTimeMs: number): void {
    this.publishedAnswers.push({ gameId, playerName, answerIndex, responseTimeMs });
  }

  sendScream(gameId: number, playerName: string, intensity: number): void {
    this.publishedScreams.push({ gameId, playerName, intensity });
  }

  broadcastStatus(gameId: number, payload: any): void {
    this.broadcasted.push({ destination: `/app/game/${gameId}/status`, body: payload });
  }

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

  createGame(): Observable<any> {
    return of({ id: 1 });
  }

  getNextRound(_gameId: number): Observable<any> {
    return of({ id: 1, status: 'ACTIVE', roundIndex: 0, type: 'QUIZ', payload: {} });
  }

  getCurrentRound(_gameId: number): Observable<any> {
    return of({ id: 1, status: 'ACTIVE', roundIndex: 0, type: 'QUIZ', payload: {} });
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

  readonly startHeartbeat = () => this.played.push('heartbeat');
  readonly stopHeartbeat = () => this.played.push('stop-heartbeat');
  readonly startClock = () => this.played.push('clock');
  readonly stopClock = () => this.played.push('stop-clock');
  readonly playBell = () => this.played.push('bell');
  readonly playCorrect = () => this.played.push('correct');
  readonly playWrong = () => this.played.push('wrong');
  readonly playReveal = () => this.played.push('reveal');
  readonly stopAll = () => this.played.push('stop-all');

  isEnabled(): boolean {
    return true;
  }

  toggleAudio(): void {}
}

export class FakeSwUpdate {
  readonly isEnabled = false;
  readonly versionUpdates = EMPTY;
  readonly activateUpdate = () => Promise.resolve(false);
  readonly checkForUpdate = () => Promise.resolve(false);
}
