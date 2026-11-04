import { Injectable, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { environment } from '../environment/environment';

/** La TV crea una sola partita per sessione: il backend la espone con id 1. */
const DEFAULT_GAME_ID = 1;

/**
 * Canale STOMP/SockJS verso il backend.
 *
 * Espone due flussi:
 * - `responses$` per le azioni rapide dei telefoni (risposte e urla);
 * - `status$` per gli eventi di gioco (domanda, voting, fine round).
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  readonly responses = signal<any[]>([]);
  readonly connected = signal(false);

  readonly status$ = new Subject<any>();
  readonly responses$ = new Subject<any>();

  private readonly client: Client;
  private activeGameId = DEFAULT_GAME_ID;
  private subscriptions: StompSubscription[] = [];

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.connected.set(true);
        this.subscribeToActiveGame();
      },
      onDisconnect: () => this.connected.set(false),
      onWebSocketClose: () => this.connected.set(false),
    });

    this.client.activate();
  }

  /** Cambia la partita a cui sono sottoscritti i topic (idempotente). */
  subscribeToGame(gameId: number): void {
    if (this.activeGameId === gameId) return;

    this.activeGameId = gameId;
    if (this.connected()) this.subscribeToActiveGame();
  }

  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number): void {
    this.client.publish({
      destination: `/app/game/${gameId}/answer`,
      body: JSON.stringify({ playerName, answerIndex: index, responseTimeMs }),
    });
  }

  sendScream(gameId: number, playerName: string, intensity: number): void {
    if (!this.client.active) return;

    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify({
        action: 'SCREAM',
        playerName,
        intensity: Math.min(100, Math.max(0, intensity)),
        timestamp: Date.now(),
      }),
    });
  }

  broadcastStatus(gameId: number, payload: any): void {
    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify(payload),
    });
  }

  connect(): void {
    if (!this.client.active) this.client.activate();
  }

  disconnect(): void {
    this.unsubscribeAll();
    this.connected.set(false);
    this.client.deactivate();
  }

  clearResponses(): void {
    this.responses.set([]);
  }

  private subscribeToActiveGame(): void {
    this.unsubscribeAll();

    const topic = `/topic/game/${this.activeGameId}`;

    this.subscriptions = [
      this.client.subscribe(`${topic}/responses`, (message) => {
        const data = this.parse(message.body);
        if (!data) return;

        this.responses.update((prev) => [...prev, data]);
        this.responses$.next(data);
      }),
      this.client.subscribe(`${topic}/status`, (message) => {
        const data = this.parse(message.body);
        if (data) this.status$.next(data);
      }),
    ];
  }

  private unsubscribeAll(): void {
    for (const subscription of this.subscriptions) {
      try {
        subscription.unsubscribe();
      } catch {
        // La connessione potrebbe essere già chiusa: niente da fare.
      }
    }
    this.subscriptions = [];
  }

  private parse(body: string): any | null {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
}
