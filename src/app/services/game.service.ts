import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface GameRoundPayload {
  category: string;
  question: string;
  type: 'QUIZ' | 'TRUE_FALSE';
  options: string[];
  correctAnswer: string;
}

export interface GameRound {
  id: number;
  status: string;
  payload: GameRoundPayload;
  type: string;
  roundIndex: number;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private http = inject(HttpClient);
  private baseUrl = 'http://192.168.1.20:8080';

  // Recupera tutte le categorie per l'animazione iniziale
  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }

  getNextRound(gameId: number): Observable<GameRound> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/round`, {}).pipe(
      map(res => ({
        ...res,
        payload: JSON.parse(res.payload) as GameRoundPayload
      }))
    );
  }
}
