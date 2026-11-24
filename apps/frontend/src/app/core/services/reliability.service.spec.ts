import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReliabilityService } from './reliability.service';
import { WebSocketService } from '../websocket/web-socket.service';

describe('ReliabilityService — checkpoint TV', () => {
  let service: ReliabilityService;
  let http: HttpTestingController;

  const isTvState = (url: string): boolean => url.endsWith('/tv-state');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WebSocketService, useValue: {} },
      ],
    });
    service = TestBed.inject(ReliabilityService);
    http = TestBed.inject(HttpTestingController);

    // Solo la TV scrive checkpoint: ruolo, partita e token sono quelli di una
    // sessione già avviata.
    const tv = service as unknown as { role: string; gameId: number };
    tv.role = 'TV';
    tv.gameId = 1;
    service.sessionToken.set('token-tv');
  });

  afterEach(() => http.verify());

  it('dopo un 409 non ritenta lo stesso round e riprende col successivo', () => {
    service.saveTvCheckpoint({ mode: 'QUIZ', roundIndex: 3, revision: 1, state: {} });
    http.expectOne((req) => isTvState(req.url))
      .flush({ error: 'stale-checkpoint' }, { status: 409, statusText: 'Conflict' });

    // Il server ha già chiuso quel round: ogni altro invio sarebbe un altro 409.
    service.saveTvCheckpoint({ mode: 'QUIZ', roundIndex: 3, revision: 2, state: {} });
    http.expectNone((req) => isTvState(req.url));

    // Il round nuovo torna a salvarsi normalmente.
    service.saveTvCheckpoint({ mode: 'MUSIC', roundIndex: 4, revision: 3, state: {} });
    http.expectOne((req) => isTvState(req.url)).flush({ saved: true });
  });

  it('un errore diverso dal 409 non blocca i salvataggi dello stesso round', () => {
    service.saveTvCheckpoint({ mode: 'ARENA', roundIndex: 2, revision: 1, state: {} });
    http.expectOne((req) => isTvState(req.url))
      .flush({ error: 'offline' }, { status: 500, statusText: 'Server Error' });

    service.saveTvCheckpoint({ mode: 'ARENA', roundIndex: 2, revision: 2, state: {} });
    http.expectOne((req) => isTvState(req.url)).flush({ saved: true });
  });
});
