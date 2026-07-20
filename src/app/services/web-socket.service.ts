import { Injectable, signal } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { environment } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly client: Client;


  responses = signal<any[]>([]);
  connected = signal(false);
  private wasConnected = false;


  status$ = new Subject<any>();
  responses$ = new Subject<any>();
  reconnected$ = new Subject<void>();

  subscribeToGame(gameId: number) {
    console.log('📡 [REVERT] Sottoscrizione dinamica ignorata, uso ID 1');
  }

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        const isReconnect = this.wasConnected;
        this.connected.set(true);
        this.wasConnected = true;
        console.log(isReconnect ? '🔄 WebSocket Riconnesso!' : '✅ WebSocket Connesso (ID Fisso: 1)');

        if (isReconnect) {
          this.reconnected$.next();
        }

        this.client.subscribe('/topic/game/1/responses', (msg) => {
          console.log('%c 📥 WS RESPONSES: ', 'background: #0277bd; color: #fff', msg.body);
          try {
            const data = JSON.parse(msg.body);
            this.responses.update(prev => [...prev, data]);
            this.responses$.next(data);
          } catch (e) { }
        });

        this.client.subscribe('/topic/game/1/status', (msg) => {
          console.log('%c 📥 WS STATUS: ', 'background: #2e7d32; color: #fff', msg.body);
          try {
            this.status$.next(JSON.parse(msg.body));
          } catch (e) { }
        });
      },
      onDisconnect: () => {
        this.connected.set(false);
        console.log('❌ WebSocket Disconnesso!');
      }
    });
    this.client.activate();
  }


  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number) {
    this.client.publish({
      destination: `/app/game/${gameId}/answer`,
      body: JSON.stringify({ playerName, answerIndex: index, responseTimeMs })
    });
  }

  sendScream(gameId: number, playerName: string, intensity: number) {
    if (!this.client.active) { // ✅ Usa client.active per check connessione
      console.warn('⚠️ WebSocket non connesso');
      return;
    }

    const payload = {
      action: 'SCREAM',
      playerName,
      intensity: Math.min(100, Math.max(0, intensity)),
      timestamp: Date.now()
    };

    try {
      // 🔥 [FIX] Uso lo stesso canale di JOIN_GAME che sappiamo funzionare!
      this.client.publish({
        destination: `/app/game/${gameId}/status`,
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('❌ Errore invio scream:', error);
    }
  }


  broadcastStatus(gameId: number, payload: any) {
    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify(payload)
    });
  }

  disconnect() {
    this.connected.set(false); // ✅ Traccia connessione

    if (this.client) {
      this.client.deactivate();

    }
  }


  connect() {
    if (!this.client.active) {
      this.client.activate();

    }
  }

  clearResponses() {
    this.responses.set([]);
  }


}
