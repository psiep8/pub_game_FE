import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../core/environment/environment';
import { ReliabilityService } from '../../../core/services/reliability.service';

export interface KaraokeLine {
  indice: number;
  inizioMs: number;
  testo: string;
}

export interface KaraokeManche {
  manche: number;
  punti: number;
  titolo: string;
  artista: string;
  anno: number;
  file: string;
  offsetMs: number;
  testiPronti: boolean;
  righe: KaraokeLine[];
  risposte: KaraokeLine[];
}

@Injectable({ providedIn: 'root' })
export class KaraokeService {
  private readonly http = inject(HttpClient);
  private readonly reliability = inject(ReliabilityService);

  /** Il gameId è il seed: la stessa partita riceve sempre le stesse manche. */
  getManches(gameId: number): Observable<KaraokeManche[]> {
    const token = this.reliability.token();
    return this.http
      .get<{ manche?: KaraokeManche[] }>(`${environment.apiUrl}/karaoke/manche?gameId=${encodeURIComponent(gameId)}`, {
        headers: token ? { 'X-Session-Token': token } : {},
      })
      .pipe(
        map((response) => Array.isArray(response?.manche) ? response.manche : []),
        catchError(() => of([])),
      );
  }
}
