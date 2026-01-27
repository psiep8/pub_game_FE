import {Injectable, signal} from '@angular/core';
import {Client} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {Subject} from 'rxjs';

@Injectable({providedIn: 'root'})
export class WebSocketService {
  private client: Client;

  responses = signal<any[]>([]);
  status$ = new Subject<any>();
  responses$ = new Subject<any>();

  constructor() {
    this.client = new Client({
      // webSocketFactory: () => new SockJS('http://192.168.1.20:8080/ws-pubgame'),
      webSocketFactory: () => new SockJS('http://192.168.1.3:8080/ws-pubgame'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log('✅ WebSocket CONNESSO');

        // Iscrizione RISPOSTE
        this.client.subscribe('/topic/game/1/responses', (msg) => {
          console.log('📨 [RESPONSES] Ricevuto:', msg.body);
          const data = JSON.parse(msg.body);
          this.responses.update(prev => [...prev, data]);
          this.responses$.next(data);
        });

        // Iscrizione STATUS
        this.client.subscribe('/topic/game/1/status', (msg) => {
          console.log('📨 [STATUS] Ricevuto RAW:', msg.body);
          try {
            const parsed = JSON.parse(msg.body);
            console.log('📨 [STATUS] Parsed:', parsed);
            this.status$.next(parsed);
          } catch (e) {
            console.error('❌ Errore parse STATUS:', e);
          }
        });

        console.log('✅ Iscrizioni WebSocket completate');
      },

      onStompError: (frame) => {
        console.error('❌ STOMP Error:', frame);
      },

      onWebSocketError: (event) => {
        console.error('❌ WebSocket Error:', event);
      },

      onDisconnect: () => {
        console.warn('⚠️ WebSocket DISCONNESSO');
      }
    });

    console.log('🔌 Attivazione WebSocket...');
    this.client.activate();
  }

  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number) {
    console.log('📤 Invio risposta:', {gameId, playerName, index, responseTimeMs});
    this.client.publish({
      destination: `/app/game/${gameId}/answer`,
      body: JSON.stringify({playerName, answerIndex: index, responseTimeMs})
    });
  }

  broadcastStatus(gameId: number, payload: any) {
    console.log('📤📤📤 BROADCAST STATUS:', payload);
    console.log('📤 Destination:', `/app/game/${gameId}/status`);
    console.log('📤 Body:', JSON.stringify(payload));

    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify(payload)
    });

    console.log('✅ Messaggio inviato al server!');
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
      console.log('🔌 WebSocket disconnesso');
    }
  }

  connect() {
    if (!this.client.active) {
      this.client.activate();
      console.log('🔌 Tentativo riconnessione...');
    }
  }

  clearResponses() {
    this.responses.set([]);
  }
}
