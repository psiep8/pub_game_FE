import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';

export interface GameRoundPayload {
  category: string;
  question: string;
  type: 'QUIZ' | 'TRUE_FALSE' | 'CHRONO' | 'IMAGE_BLUR'; // Aggiunto CHRONO
  options: string[];
  correctAnswer: string;
  imageUrl: string;
}

export interface GameRound {
  id: number;
  status: string;
  payload: GameRoundPayload;
  type: string;
  roundIndex: number;
}

@Injectable({providedIn: 'root'})
export class GameService {
  private http = inject(HttpClient);
  // private baseUrl = 'http://192.168.1.20:8080';
  private baseUrl = 'http://192.168.1.3:8080';

  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }

  createGame(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games`, {}); // Assicurati che l'URL sia /games
  }

  // Crea e restituisce il prossimo round
  getNextRound(gameId: number): Observable<GameRound> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/round`, {}).pipe(
      map(res => this.parseRoundPayload(res))
    );
  }

  // Recupera il round corrente (senza crearne uno nuovo)
  getCurrentRound(gameId: number): Observable<GameRound> {
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/current-round`).pipe(
      map(res => this.parseRoundPayload(res))
    );
  }

  // Helper per non ripetere il JSON.parse
  private parseRoundPayload(res: any): GameRound {
    return {
      ...res,
      payload: typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload
    };
  }
}
