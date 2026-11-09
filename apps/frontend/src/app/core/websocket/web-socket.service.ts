import { Injectable, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { environment } from '../environment/environment';
import { backoffDelay } from './reconnect';

/** La TV crea una sola partita per sessione: il backend la espone con id 1. */
const DEFAULT_GAME_ID = 1;

export type ConnectionState = 'online' | 'reconnecting' | 'offline';

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
 *
 * La riconnessione non è più un retry a intervallo fisso: `backoffDelay`
 * allarga l'attesa a ogni tentativo e la spalma con jitter, così venti telefoni
 * che perdono il Wi-Fi insieme non tornano tutti nello stesso istante.
 * Ogni riaggancio emette su `connectedAt$`: chi ascolta riprende la sessione e
 * richiede lo stato autorevole al server.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  readonly responses = signal<any[]>([]);
  readonly connected = signal(false);
  readonly connectionState = signal<ConnectionState>('offline');
  readonly reconnectAttempts = signal(0);
  readonly lastConnectedAt = signal<number | null>(null);

  readonly status$ = new Subject<any>();
  readonly responses$ = new Subject<any>();
  /** Emesso a ogni connessione riuscita (anche la prima). */
  readonly connectedAt$ = new Subject<number>();

  private readonly client: Client;
  private activeGameId = DEFAULT_GAME_ID;
  private role = '';
  private allowReconnect = false;
  private subscriptions: StompSubscription[] = [];
  private retryTimer?: ReturnType<typeof setTimeout>;
  private attempts = 0;

  constructor() {
    this.client = new Client({
      brokerURL: environment.wsUrl,
      // Riconnessione gestita qui: serve il backoff, non un intervallo fisso.
      reconnectDelay: 0,
      connectionTimeout: 8000,
      // Heartbeat allineati al server (10s): meno frame con molti telefoni.
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.attempts = 0;
        this.reconnectAttempts.set(0);
        this.connected.set(true);
        this.connectionState.set('online');
        this.lastConnectedAt.set(Date.now());
        this.subscribeToActiveGame();
        this.connectedAt$.next(Date.now());
      },
      onDisconnect: () => this.markOffline(),
      onWebSocketClose: () => this.markOffline(),
      onWebSocketError: () => this.markOffline(),
      onStompError: (frame) => {
        console.error('❌ STOMP error:', frame.headers['message']);
        this.markOffline();
      },
    });

  }

  setSessionToken(token: string, role = ''): void {
    const changed = this.client.connectHeaders['X-Session-Token'] !== token || this.role !== role;
    this.role = role;
    this.allowReconnect = true;
    this.client.connectHeaders = { 'X-Session-Token': token };
    if (changed && this.client.active) {
      this.clearRetryTimer();
      void this.client.deactivate().then(() => this.scheduleReconnect(0));
    } else if (!this.client.active && environment.wsUrl) {
      this.scheduleReconnect(0);
    }
  }

  /** Cambia la partita a cui sono sottoscritti i topic (idempotente). */
  subscribeToGame(gameId: number): void {
    if (this.activeGameId === gameId) return;

    this.activeGameId = gameId;
    if (this.connected()) this.subscribeToActiveGame();
  }

  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number): boolean {
    return this.publish(`/app/game/${gameId}/answer`, {
      playerName,
      answerIndex: index,
      responseTimeMs,
    });
  }

  sendScream(gameId: number, playerName: string, intensity: number): boolean {
    return this.publish(`/app/game/${gameId}/status`, {
      action: 'SCREAM',
      playerName,
      intensity: Math.min(100, Math.max(0, intensity)),
      timestamp: Date.now(),
    });
  }

  broadcastStatus(gameId: number, payload: any): boolean {
    return this.publish(`/app/game/${gameId}/status`, payload);
  }

  connect(): void {
    // Anche se il client è ancora ACTIVE può avere la socket già chiusa:
    // in quel caso scheduleReconnect() riavvia il client da zero.
    if (this.client.connectHeaders['X-Session-Token'] && !this.client.connected) {
      this.allowReconnect = true;
      this.scheduleReconnect(0);
    }
  }

  disconnect(): void {
    this.allowReconnect = false;
    this.clearRetryTimer();
    this.unsubscribeAll();
    this.connected.set(false);
    this.connectionState.set('offline');
    this.client.deactivate();
  }

  clearResponses(): void {
    this.responses.set([]);
  }

  /** true se il messaggio è partito: chi chiama sa se serve un fallback REST. */
  private publish(destination: string, payload: any): boolean {
    if (!this.client.connected) return false;

    try {
      this.client.publish({ destination, body: JSON.stringify(payload) });
      return true;
    } catch (error) {
      console.error('❌ Invio STOMP fallito:', error);
      this.markOffline();
      return false;
    }
  }

  private markOffline(): void {
    const wasOnline = this.connected();
    this.connected.set(false);
    if (wasOnline) {
      // Un dispositivo che si scollega non deve restare "online" nella UI né
      // nella diagnostica dell'admin.
      this.connectionState.set('reconnecting');
    }
    if (this.allowReconnect && this.client.active) this.scheduleReconnect(this.attempts);
  }

  private scheduleReconnect(attempt: number): void {
    if (!this.allowReconnect || this.retryTimer) return;
    const delay = backoffDelay(attempt);
    this.attempts = attempt + 1;
    this.reconnectAttempts.set(this.attempts);
    if (!this.connected()) {
      this.connectionState.set(this.attempts > 8 ? 'offline' : 'reconnecting');
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.connected()) return;

      // `activate()` è un no-op se il client è rimasto ACTIVE dopo la chiusura
      // della socket. In quel caso va prima disattivato, altrimenti il
      // dispositivo non riapre mai la connessione.
      if (this.client.active) {
        void this.client
          .deactivate()
          .then(() => {
            if (!this.connected()) this.client.activate();
          })
          .catch((error) => {
            console.error('❌ Riconnessione STOMP fallita:', error);
          });
        return;
      }

      this.client.activate();
    }, delay);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
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
        if (data && !(this.role === 'ADMIN' && ['SHOW_QUESTION', 'START_VOTING', 'PLAYER_PRENOTATO'].includes(data.action))) {
          this.status$.next(data);
        }
      }),
    ];
    if (this.role === 'ADMIN') {
      this.subscriptions.push(this.client.subscribe(`${topic}/admin`, (message) => {
        const data = this.parse(message.body);
        if (data) this.status$.next(data);
      }));
    }
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
