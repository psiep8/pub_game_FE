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

/** Quante canzoni sono cantabili: lo dice la lobby, lo usa la scaletta. */
export interface KaraokeStatus {
  canzoni: number;
  pronte: number;
  minimo: number;
  ok: boolean;
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

  /** Stato del bonus: senza testi completi il Karaoke non va in scaletta. */
  getStatus(): Observable<KaraokeStatus | null> {
    const token = this.reliability.token();
    return this.http
      .get<KaraokeStatus>(`${environment.apiUrl}/karaoke/pronostico`, {
        headers: token ? { 'X-Session-Token': token } : {},
      })
      .pipe(
        map((response) => (response && typeof response.ok === 'boolean' ? response : null)),
        catchError(() => of(null)),
      );
  }

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
