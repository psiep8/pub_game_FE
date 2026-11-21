import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReliabilityService } from '../services/reliability.service';
import { FakeWebSocketService } from '../../shared/testing/test-doubles';
import { WebSocketService } from './web-socket.service';
import { backoffDelay } from './reconnect';

describe('backoffDelay', () => {
  it('cresce in modo esponenziale', () => {
    const first = backoffDelay(0, 500, 15000, () => 0.5);
    const second = backoffDelay(1, 500, 15000, () => 0.5);
    const third = backoffDelay(2, 500, 15000, () => 0.5);

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('non supera mai il tetto massimo', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(backoffDelay(attempt, 500, 2000, () => 1)).toBeLessThanOrEqual(2000);
    }
  });

  it('usa il jitter per non far riprovare tutti i telefoni insieme', () => {
    const low = backoffDelay(3, 500, 15000, () => 0);
    const high = backoffDelay(3, 500, 15000, () => 1);

    expect(high).toBeGreaterThan(low);
    // Il jitter resta dentro una finestra ragionevole, non raddoppia l'attesa.
    expect(high).toBeLessThanOrEqual(low * 2);
  });

  it('tratta tentativi negativi e non numerici come primo tentativo', () => {
    expect(backoffDelay(-3, 500, 15000, () => 0.5)).toBe(backoffDelay(0, 500, 15000, () => 0.5));
    expect(backoffDelay(Number.NaN, 500, 15000, () => 0.5)).toBe(
      backoffDelay(0, 500, 15000, () => 0.5)
    );
  });
});

describe('sessione autenticata', () => {
  it('apre STOMP solo dopo aver ricevuto il token', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    const socket = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    const setToken = vi.spyOn(socket, 'setSessionToken');
    const started = service.start(1, 'REMOTE', 'Anna');
    expect(setToken).not.toHaveBeenCalled();
    const registration = http.expectOne('/games/1/session');
    expect(registration.request.body.playerName).toBe('Anna');
    registration.flush({ sessionToken: 'token-anna' });
    expect(await started).toBe(true);
    expect(setToken).toHaveBeenCalledWith('token-anna', 'REMOTE');
    http.expectOne('/games/1/sync?sinceSeq=0').flush({ snapshot: {}, events: [], toSeq: 0, complete: true });
    await Promise.resolve();
    service.stop();
    http.verify();
  });
});

describe('apertura della sessione di regia', () => {
  it('manda il segreto nell header, non come codice TV', async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    const secret = 'a'.repeat(64);
    vi.spyOn(window, 'prompt').mockReturnValue(secret);
    const started = service.start(1, 'TV');
    const registration = http.expectOne('/games/1/session');
    expect(registration.request.headers.get('X-Control-Secret')).toBe(secret);
    expect(registration.request.body.pairingCode).toBeNull();
    registration.flush({ sessionToken: 'token-tv' });
    expect(await started).toBe(true);
    http.expectOne('/games/1/sync?sinceSeq=0').flush({ snapshot: {}, events: [], toSeq: 0, complete: true });
    await Promise.resolve();
    service.stop();
    vi.restoreAllMocks();
    http.verify();
  });

  it('redime il codice a sei cifre nel corpo, senza segreto', async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    const started = service.pairAdmin(1, '314159');
    const registration = http.expectOne('/games/1/session');
    expect(registration.request.body.pairingCode).toBe('314159');
    expect(registration.request.headers.get('X-Control-Secret')).toBeNull();
    registration.flush({ sessionToken: 'token-admin' });
    expect(await started).toBe(true);
    http.expectOne('/games/1/sync?sinceSeq=0').flush({ snapshot: {}, events: [], toSeq: 0, complete: true });
    await Promise.resolve();
    service.stop();
    http.verify();
  });
});

describe('sync paginato', () => {
  it('applica tutte le pagine prima di dichiarare il riallineamento', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    const events: string[] = [];
    service.sessionToken.set('private-token');
    service.syncEvent$.subscribe((event) => events.push(event.eventId));
    const sync = service.sync();
    const first = http.expectOne((req) => req.urlWithParams.endsWith('/games/1/sync?sinceSeq=0'));
    expect(first.request.headers.get('X-Session-Token')).toBe('private-token');
    first.flush({ snapshot: { version: 3 }, events: [{ eventId: 'a' }, { eventId: 'b' }], toSeq: 2, complete: false });
    await Promise.resolve();
    expect(service.syncing()).toBe(true);
    const second = http.expectOne((req) => req.urlWithParams.endsWith('/games/1/sync?sinceSeq=2'));
    expect(second.request.headers.get('X-Session-Token')).toBe('private-token');
    second.flush({ snapshot: { version: 3 }, events: [{ eventId: 'c' }], toSeq: 3, complete: true });
    await sync;
    expect(events).toEqual(['a', 'b', 'c']);
    expect(service.seq()).toBe(3);
    expect(service.syncing()).toBe(false);
    http.verify();
  });
});

describe('errori di rete', () => {
  it('non mostra la sync fallita come errore tecnico sul telefono', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.sessionToken.set('private-token');

    const sync = service.sync();
    http.expectOne((req) => req.urlWithParams.endsWith('/games/1/sync?sinceSeq=0'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    await sync;

    expect(service.lastError()).toBeNull();
    expect(service.online()).toBe(false);
    vi.restoreAllMocks();
    http.verify();
  });

  it('riprova dopo un riallineamento fallito anche se esisteva uno snapshot precedente', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.sessionToken.set('private-token');
    service.lastSyncAt.set(123);

    const sync = service.sync();
    http.expectOne('/games/1/sync?sinceSeq=0')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await sync;
    expect(service.lastSyncAt()).toBeNull();

    const heartbeat = service.heartbeat();
    http.expectOne('/games/1/session/heartbeat').flush({ stateVersion: 1, seq: 0, needsSync: false });
    await Promise.resolve();
    http.expectOne('/games/1/sync?sinceSeq=0')
      .flush({ snapshot: { version: 1 }, events: [], toSeq: 0, complete: true });
    await heartbeat;
    expect(service.lastSyncAt()).not.toBeNull();
    vi.restoreAllMocks();
    http.verify();
  });

  it('riprova lo snapshot al primo heartbeat riuscito', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
        { provide: WebSocketService, useClass: FakeWebSocketService }],
    });
    const service = TestBed.inject(ReliabilityService);
    const http = TestBed.inject(HttpTestingController);
    service.sessionToken.set('private-token');

    const heartbeat = service.heartbeat();
    http.expectOne('/games/1/session/heartbeat').flush({ stateVersion: 1, seq: 0 });
    await Promise.resolve();
    const sync = http.expectOne((req) => req.urlWithParams.endsWith('/games/1/sync?sinceSeq=0'));
    sync.flush({ snapshot: { version: 1 }, events: [], toSeq: 0, complete: true });
    await heartbeat;

    expect(service.lastSyncAt()).not.toBeNull();
    http.verify();
  });
});
