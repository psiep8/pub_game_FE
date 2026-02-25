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
      
      webSocketFactory: () => new SockJS('http://192.168.1.3:8080/ws-pubgame'),
      
      reconnectDelay: 5000, 
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        

        
        this.client.subscribe('/topic/game/1/responses', (msg) => {
          const data = JSON.parse(msg.body);
          this.responses.update(prev => [...prev, data]);
          this.responses$.next(data); 
        });

        
        this.client.subscribe('/topic/game/1/status', (msg) => {
          this.status$.next(JSON.parse(msg.body));
        });
      }
    });
    this.client.activate();
  }

  
  sendAnswer(gameId: number, playerName: string, index: number, responseTimeMs: number) {
    this.client.publish({
      destination: `/app/game/${gameId}/answer`,
      body: JSON.stringify({playerName, answerIndex: index, responseTimeMs})
    });
  }

  
  broadcastStatus(gameId: number, payload: any) {
    this.client.publish({
      destination: `/app/game/${gameId}/status`,
      body: JSON.stringify(payload)
    });
  }

  disconnect() {
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
