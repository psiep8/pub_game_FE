import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';

import { RemoteComponent } from './remote-component';
import { GameService } from '../../services/game.service';
import { WebSocketService } from '../../services/web-socket.service';
import { FakeGameService, FakeSwUpdate, FakeWebSocketService } from '../../testing/test-doubles';

describe('RemoteComponent', () => {
  let component: RemoteComponent;
  let fixture: ComponentFixture<RemoteComponent>;
  let ws: FakeWebSocketService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RemoteComponent],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: GameService, useClass: FakeGameService },
        { provide: SwUpdate, useClass: FakeSwUpdate },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should only keep the active categories for the arena', () => {
    expect(component.categories().map((category) => category.name)).toEqual([
      'CULTURA GENERALE',
      'MUSICA',
      'FORTUNA',
    ]);
  });

  it('should store the nickname and announce the player to the TV', () => {
    component.tempNickname = 'Anna';
    component.setNickname();

    expect(component.nickname()).toBe('Anna');
    expect(localStorage.getItem('nickname')).toBe('Anna');
    expect(ws.broadcasted.at(-1)?.body).toEqual({ action: 'JOIN_GAME', playerName: 'Anna' });
  });

  it('should publish the vote and lock the phone', () => {
    component.tempNickname = 'Anna';
    component.setNickname();

    component.sendVote(2);

    expect(ws.publishedAnswers).toHaveLength(1);
    expect(ws.publishedAnswers[0]).toMatchObject({
      gameId: 1,
      playerName: 'Anna',
      answerIndex: 2,
    });
    expect(component.gameState()).toBe('LOCKED');
  });

  it('should block only the player named in the error', async () => {
    component.tempNickname = 'Anna';
    component.setNickname();

    ws.status$.next({ action: 'BLOCKED_ERROR', blockedPlayer: 'Anna' });
    await fixture.whenStable();

    expect(component.isBlocked()).toBe(true);
    expect(component.gameState()).toBe('BLOCKED_ERROR');
  });

  it('should reset the answer state when the round ends', async () => {
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });
    ws.status$.next({ action: 'ROUND_ENDED' });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.hasAnswered()).toBe(false);
  });
});
