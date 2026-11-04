import { Injectable, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { environment } from '../environment/environment';

/** La TV crea una sola partita per sessione: il backend la espone con id 1. */
const DEFAULT_GAME_ID = 1;

/**
 * Canale STOMP su WebSocket nativo (niente SockJS).
 *
 * Con molti telefoni collegati il fallback XHR di SockJS raddoppiava le
 * connessioni e aggiungeva l'handshake `/info`; il WebSocket nativo tiene una
 * sola socket per dispositivo e passa anche dai tunnel Cloudflare.
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
      brokerURL: environment.wsUrl,
      reconnectDelay: 3000,
      connectionTimeout: 8000,
      // Heartbeat allineati al server (10s): meno frame con molti telefoni.
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.connected.set(true);
        this.subscribeToActiveGame();
      },
      onDisconnect: () => this.connected.set(false),
      onWebSocketClose: () => this.connected.set(false),
      onWebSocketError: () => this.connected.set(false),
      onStompError: (frame) => {
        console.error('❌ STOMP error:', frame.headers['message']);
      },
    });

    if (environment.wsUrl) this.client.activate();
  }

  /** Cambia la partita a cui sono sottoscritti i topic (idempotente). */
  subscribeToGame(gameId: number): void {
    if (this.activeGameId === gameId) return;

    this.activeGameId = gameId;
    if (this.connected()) this.subscribeToActiveGame();
  }

  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number): void {
    this.publish(`/app/game/${gameId}/answer`, { playerName, answerIndex: index, responseTimeMs });
  }

  sendScream(gameId: number, playerName: string, intensity: number): void {
    this.publish(`/app/game/${gameId}/status`, {
      action: 'SCREAM',
      playerName,
      intensity: Math.min(100, Math.max(0, intensity)),
      timestamp: Date.now(),
    });
  }

  broadcastStatus(gameId: number, payload: any): void {
    this.publish(`/app/game/${gameId}/status`, payload);
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

  /**
   * Unico punto di invio: se la socket non è ancora connessa il messaggio
   * viene scartato invece di far esplodere StompJS a metà round.
   */
  private publish(destination: string, payload: any): void {
    if (!this.client.connected) return;

    this.client.publish({ destination, body: JSON.stringify(payload) });
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
