import { describe, expect, it } from 'vitest';
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
