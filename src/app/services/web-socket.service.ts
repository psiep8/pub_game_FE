import { Injectable, signal } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client;

  // STATO DELLA CONNESSIONE
  public isConnected = signal<boolean>(false);

  // BUFFER PER MESSAGGI PENDENTI (per evitare l'errore "no underlying connection")
  private messageQueue: { destination: string, body: any }[] = [];

  // DATI PER LA TV
  responses = signal<any[]>([]);

  // STREAM PER I TELEFONI
  status$ = new Subject<any>();
  responses$ = new Subject<any>();

  constructor() {
    this.client = new Client({
      // Assicurati che l'IP sia corretto per la tua rete locale
      webSocketFactory: () => new SockJS('http://192.168.1.3:8080/ws-pubgame'),
      // webSocketFactory: () => new SockJS('http://192.168.1.20:8080/ws-pubgame'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log('✅ WebSocket Connesso con Successo');
        this.isConnected.set(true);

        // 1. Iscrizione alle RISPOSTE (TV)
        this.client.subscribe('/topic/game/1/responses', (msg) => {
          const data = JSON.parse(msg.body);
          this.responses.update(prev => [...prev, data]);
          this.responses$.next(data);
        });

        // 2. Iscrizione allo STATO (TELEFONI)
        this.client.subscribe('/topic/game/1/status', (msg) => {
          this.status$.next(JSON.parse(msg.body));
        });

        // SVUOTA LA CODA DEI MESSAGGI PENDENTI
        this.flushQueue();
      },

      onDisconnect: () => {
        console.warn('❌ WebSocket Disconnesso');
        this.isConnected.set(false);
      },

      onStompError: (frame) => {
        console.error('🚫 Errore STOMP:', frame.headers['message']);
      }
    });

    this.client.activate();
  }

  /**
   * Metodo core per inviare messaggi con controllo connessione
   */
  private publish(destination: string, body: any) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: destination,
        body: JSON.stringify(body)
      });
    } else {
      console.warn(`⏳ Connessione non pronta. Messaggio per ${destination} messo in coda.`);
      this.messageQueue.push({ destination, body });
    }
  }

  /**
   * Metodo per la TV: invia lo stato ai telefoni
   */
  broadcastStatus(gameId: number, payload: any) {
    this.publish(`/app/game/${gameId}/status`, payload);
  }

  /**
   * Metodo per i TELEFONI: invia la risposta alla TV
   */
  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number) {
    this.publish(`/app/game/${gameId}/answer`, {
      playerName,
      answerIndex: index,
      responseTimeMs
    });
  }

  /**
   * Svuota i messaggi accumulati durante la disconnessione
   */
  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) this.publish(msg.destination, msg.body);
    }
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.isConnected.set(false);
      console.log('WebSocket spento.');
    }
  }

  clearResponses() {
    this.responses.set([]);
  }
}
