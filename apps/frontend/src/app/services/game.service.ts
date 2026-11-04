import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface GameRoundPayload {
  category: string;
  question: string;
  type:
    | 'QUIZ'
    | 'TRUE_FALSE'
    | 'CHRONO'
    | 'IMAGE_BLUR'
    | 'TIMELINE'
    | 'PRICE'
    | 'SPEED_RUSH'
    | 'PING_PONG';
  options: string[];
  correctAnswer: string;
  imageUrl: string;
  /** Campi specifici dei giochi nuovi (carte, prodotto, durata). */
  items?: Array<{ id: number; label: string }>;
  name?: string;
  emoji?: string;
  unit?: string;
  duration?: number;
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

  private baseUrl = environment.apiUrl;

  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }

  createGame(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games`, {});
  }


  getNextRound(gameId: number): Observable<GameRound> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/round`, {}).pipe(
      map(res => this.parseRoundPayload(res))
    );
  }


  getCurrentRound(gameId: number): Observable<GameRound> {
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/current-round`).pipe(
      map(res => this.parseRoundPayload(res))
    );
  }

  getArenaQuestion(gameId: number, category: string, playerId: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/games/${gameId}/arena-question?category=${encodeURIComponent(category)}&playerId=${encodeURIComponent(playerId)}`
    );
  }

  /** L'esito della risposta arena lo calcola il backend, non il telefono. */
  answerArenaQuestion(
    gameId: number,
    playerId: string,
    questionId: string,
    answer: string
  ): Observable<{ correct: boolean; points?: number; totalScore?: number; correctAnswer?: string }> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/arena-answer`, {
      playerId,
      questionId,
      answer,
    });
  }

  /** Timeline: ordine scelto dalla squadra, punteggio calcolato dal server. */
  submitTimeline(gameId: number, playerName: string, order: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/timeline-answer`, {
      playerName,
      order,
    });
  }

  /** Quanto costa: stima in euro, punteggio calcolato dal server. */
  submitPrice(gameId: number, playerName: string, estimate: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/price-answer`, {
      playerName,
      estimate,
    });
  }

  getTimelineReveal(gameId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/timeline/reveal`);
  }

  getPriceReveal(gameId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/price/reveal`);
  }

  resetPartyGames(gameId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/party/reset`, {});
  }

  private parseRoundPayload(res: any): GameRound {
    return {
      ...res,
      payload: typeof res.payload === 'string' ? JSON.parse(res.payload) : res.payload
    };
  }
}
