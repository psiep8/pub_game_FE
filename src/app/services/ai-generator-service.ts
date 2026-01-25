import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiGeneratorService {
  // private baseUrl = 'http://192.168.1.3:8080/games';
  private baseUrl = 'http://192.168.1.20:8080/games';

  constructor(private http: HttpClient) {
  }

  /**
   * Innesca la generazione di un round AI nel Backend
   */
  triggerNewAiRound(gameId: number | null, category: string, type: string, difficulty: string): Observable<any> {
    const params = new HttpParams()
      .set('category', category)
      .set('type', type)
      .set('difficulty', difficulty);

    return this.http.get(`${this.baseUrl}/${gameId}/generate-ai-round`, {params});
  }
}
