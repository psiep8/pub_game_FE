import {Injectable, signal} from '@angular/core';
import {Client} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {Subject} from 'rxjs';

@Injectable({providedIn: 'root'})
export class WebSocketService {
  private client: Client;

  // Per la TV: segnale per vedere le risposte in tempo reale
  responses = signal<any[]>([]);

  // Per i Telefoni: stream per reagire ai cambi di stato della TV
  status$ = new Subject<any>();
  responses$ = new Subject<any>();

  constructor() {
    this.client = new Client({
      // Usa l'IP del tuo PC che abbiamo configurato prima!
      webSocketFactory: () => new SockJS('http://192.168.1.20:8080/ws-pubgame'),
      reconnectDelay: 5000, // Prova a riconnettersi ogni 5 secondi se cade la linea
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('Connesso al WebSocket');

        // 1. Iscrizione alle RISPOSTE (usata dalla TV)
        this.client.subscribe('/topic/game/1/responses', (msg) => {
          const data = JSON.parse(msg.body);
          this.responses.update(prev => [...prev, data]);
          this.responses$.next(data); // Notifica il Subject
        });

        // 2. Iscrizione allo STATO (usata dai TELEFONI)
        this.client.subscribe('/topic/game/1/status', (msg) => {
          this.status$.next(JSON.parse(msg.body));
        });
      }
    });
    this.client.activate();
  }

  // Metodo per i TELEFONI: invia la risposta
  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number) {
    this.client.publish({
      destination: `/app/game/${gameId}/answer`,
      body: JSON.stringify({ playerName, answerIndex: index, responseTimeMs })
    });
  }

  // Metodo per la TV: invia lo stato (quello che ti mancava)
  broadcastStatus(gameId: number, payload: any) {
    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify(payload)
    });
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
      console.log('WebSocket disconnesso manualmente.');
    }
  }

  // Metodo per ricollegarsi (puoi chiamarlo se vuoi forzare un reconnect)
  connect() {
    if (!this.client.active) {
      this.client.activate();
      console.log('Tentativo di riconnessione...');
    }
  }


}
