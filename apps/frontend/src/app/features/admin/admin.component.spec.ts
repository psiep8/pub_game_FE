import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Admin } from './admin.component';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../shared/testing/test-doubles';
import { FakeReliabilityService } from '../../shared/testing/test-doubles';
import { ReliabilityService } from '../../core/services/reliability.service';
import { GameService } from '../../core/services/game.service';
import { of } from 'rxjs';

/** Doppio minimo: al pannello bastano le categorie, il resto non viene usato. */
const gameServiceDouble = {
  adminCategories: () => of([]),
  createCategory: () => of({}),
  updateCategory: () => of({}),
  setCategoryTimeline: () => of({}),
  deactivateCategory: () => of({}),
  activateCategory: () => of({}),
};

describe('Admin', () => {
  let component: Admin;
  let fixture: ComponentFixture<Admin>;
  let ws: FakeWebSocketService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [{ provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: ReliabilityService, useClass: FakeReliabilityService as any },
        { provide: GameService, useValue: gameServiceDouble }],
    }).compileComponents();

    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the proverb when voting starts on a buzz game', async () => {
    ws.status$.next({
      action: 'START_VOTING',
      type: 'WHEEL_OF_FORTUNE',
      rawPayload: JSON.stringify({ proverb: 'Chi va piano va sano e va lontano' }),
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('ACTIVE');
    expect(component.correctAnswer()).toBe('Chi va piano va sano e va lontano');
    expect(component.showAdminControls()).toBe(true);
  });

  it('should not show the confirm controls for a voting game', async () => {
    ws.status$.next({
      action: 'START_VOTING',
      type: 'QUIZ',
      payload: JSON.stringify({ correctAnswer: 'Roma' }),
    });
    await fixture.whenStable();

    expect(component.correctAnswer()).toBe('Roma');
    expect(component.showAdminControls()).toBe(false);
  });

  it('should track the player who buzzed', async () => {
    ws.status$.next({ action: 'PLAYER_PRENOTATO', name: 'Anna' });
    await fixture.whenStable();

    expect(component.buzzedPlayer()).toBe('Anna');
  });

  it('should broadcast the confirmation for the buzzed player', async () => {
    ws.status$.next({ action: 'PLAYER_PRENOTATO', name: 'Anna' });
    await fixture.whenStable();

    component.confirmCorrect();

    expect(ws.broadcasted.at(-1)?.body).toEqual({
      action: 'ADMIN_CONFIRM_CORRECT',
      playerName: 'Anna',
    });
    expect(component.buzzedPlayer()).toBeNull();
  });

  it('should clear the question state when the round ends', async () => {
    ws.status$.next({ action: 'PLAYER_PRENOTATO', name: 'Anna' });
    ws.status$.next({ action: 'ROUND_ENDED' });
    await fixture.whenStable();

    expect(component.gameState()).toBe('ROUND_ENDED');
    expect(component.buzzedPlayer()).toBeNull();
    expect(component.correctAnswer()).toBeNull();
  });
});
