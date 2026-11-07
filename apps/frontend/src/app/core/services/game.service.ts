import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface GameRoundPayload {
  category: string;
  question: string;
  type:
    | 'QUIZ'
    | 'IMAGE_BLUR'
    | 'TIMELINE'
    | 'TIME_BUZZER'
    | 'BOMBA'
    | 'SPEED_RUSH'
    | 'AIR_HOCKEY_BATTLE';
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

/** Categoria come la vede l'admin: nome, emoji e flag Timeline. */
export interface CategoryRow {
  id: number;
  name: string;
  emoji: string;
  description?: string | null;
  timeline: boolean;
  sortOrder: number;
  color: string;
  active: boolean;
}

export type CategoryPayload = Partial<
  Pick<CategoryRow, 'name' | 'emoji' | 'description' | 'timeline' | 'sortOrder' | 'color' | 'active'>
>;

@Injectable({ providedIn: 'root' })
export class GameService {
  private http = inject(HttpClient);

  private baseUrl = environment.apiUrl;

  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }

  // -------------------------------------------------------------- Categorie

  /** Tutte le categorie, comprese quelle spente: vista del pannello admin. */
  adminCategories(): Observable<CategoryRow[]> {
    return this.http.get<CategoryRow[]>(`${this.baseUrl}/categories/admin`);
  }

  createCategory(body: CategoryPayload): Observable<CategoryRow> {
    return this.http.post<CategoryRow>(`${this.baseUrl}/categories`, body);
  }

  updateCategory(id: number, body: CategoryPayload): Observable<CategoryRow> {
    return this.http.put<CategoryRow>(`${this.baseUrl}/categories/${id}`, body);
  }

  setCategoryTimeline(id: number, timeline: boolean): Observable<CategoryRow> {
    return this.http.patch<CategoryRow>(`${this.baseUrl}/categories/${id}/timeline`, { timeline });
  }

  /** Spegne la categoria: resta nello storico, sparisce dalla TV. */
  deactivateCategory(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/categories/${id}`);
  }

  activateCategory(id: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/categories/${id}/activate`, {});
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
    answer: string,
    idempotencyKey?: string,
    deviceId?: string
  ): Observable<{ correct: boolean; points?: number; totalScore?: number; correctAnswer?: string }> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/arena-answer`, {
      playerId,
      questionId,
      answer,
      idempotencyKey,
      deviceId,
    });
  }

  /** Timeline: ordine scelto dalla squadra, punteggio calcolato dal server. */
  submitTimeline(
    gameId: number,
    playerName: string,
    order: number[],
    idempotencyKey?: string
  ): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/timeline-answer`, {
      playerName,
      order,
      idempotencyKey,
    });
  }

  /** Time Buzzer: il server dà il via alla manche e segna l'istante di partenza. */
  startTimeBuzzer(gameId: number, manche: number): Observable<{ startedAt: number; manche: number }> {
    return this.http.post<{ startedAt: number; manche: number }>(
      `${this.baseUrl}/games/${gameId}/time-buzzer/start`,
      { manche },
    );
  }

  /** Time Buzzer: tempo misurato dal telefono, validato dal server. */
  submitTimeBuzzer(
    gameId: number,
    playerName: string,
    ms: number,
  ): Observable<{ accepted: boolean; ms: number; serverElapsedMs: number; manche: number }> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/time-buzzer/stop`, { playerName, ms });
  }

  /** Air Hockey: domande quiz dalla banca, con la difficoltà richiesta. */
  getAirHockeyQuestions(
    gameId: number,
    difficulty: string,
    count: number
  ): Observable<Array<{ question: string; options: string[]; correctAnswer: string; difficulty: string }>> {
    return this.http.get<any[]>(
      `${this.baseUrl}/games/${gameId}/air-hockey/questions?difficulty=${encodeURIComponent(difficulty)}&count=${count}`
    );
  }

  /** Cavallo di Battaglia: otto domande difficili della categoria scelta. */
  getCavalloQuestions(
    gameId: number,
    category: string,
    count: number
  ): Observable<Array<{ question: string; options: string[]; correctIndex: number; category: string; difficulty: string }>> {
    return this.http.get<any[]>(
      `${this.baseUrl}/games/${gameId}/cavallo/questions?category=${encodeURIComponent(category)}&count=${count}`
    );
  }

  // ---------------------------------------------------------------- Bomba

  startBomba(gameId: number, players: string[], act: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/start`, { players, act });
  }

  getBombaState(gameId: number, player?: string): Observable<any> {
    const query = player ? `?player=${encodeURIComponent(player)}` : '';
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/bomba/state${query}`);
  }

  answerBomba(
    gameId: number,
    playerName: string,
    bombId: number,
    answerIndex: number
  ): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/answer`, {
      playerName,
      bombId,
      answerIndex,
    });
  }

  passBomba(gameId: number, playerName: string, bombId: number, target: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/pass`, {
      playerName,
      bombId,
      target,
    });
  }

  pauseBomba(gameId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/pause`, {});
  }

  resumeBomba(gameId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/resume`, {});
  }

  resetBomba(gameId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/games/${gameId}/bomba/reset`, {});
  }

  getTimelineReveal(gameId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/games/${gameId}/timeline/reveal`);
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
