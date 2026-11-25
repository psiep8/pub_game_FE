import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../core/environment/environment';

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

  /** Il gameId è il seed: la stessa partita riceve sempre le stesse manche. */
  getManches(gameId: number): Observable<KaraokeManche[]> {
    return this.http
      .get<{ manche?: KaraokeManche[] }>(`${environment.apiUrl}/karaoke/manche?gameId=${encodeURIComponent(gameId)}`)
      .pipe(
        map((response) => Array.isArray(response?.manche) ? response.manche : []),
        catchError(() => of([])),
      );
  }
}
