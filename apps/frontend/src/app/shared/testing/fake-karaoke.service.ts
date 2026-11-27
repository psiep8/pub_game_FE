import { Observable, of } from 'rxjs';
import { KaraokeStatus } from '../../features/bonus/karaoke/karaoke.service';

/**
 * KaraokeService finto per i test della TV: il servizio vero parla HTTP e in
 * `TestBed` senza `HttpClient` farebbe fallire la creazione del componente.
 */
export class FakeKaraokeService {
  status: KaraokeStatus = { canzoni: 64, pronte: 64, minimo: 5, ok: true };

  getStatus(): Observable<KaraokeStatus | null> {
    return of(this.status);
  }
}
