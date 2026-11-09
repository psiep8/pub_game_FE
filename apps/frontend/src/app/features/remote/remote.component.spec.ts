import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { vi } from 'vitest';

import { RemoteComponent } from './remote.component';
import { GameService } from '../../core/services/game.service';
import { WebSocketService } from '../../core/websocket/web-socket.service';
import { AudioService } from '../../core/services/audio.service';
import { FakeAudioService, FakeGameService, FakeSwUpdate, FakeWebSocketService } from '../../shared/testing/test-doubles';
import { FakeReliabilityService } from '../../shared/testing/test-doubles';
import { ReliabilityService } from '../../core/services/reliability.service';

describe('RemoteComponent', () => {
  let component: RemoteComponent;
  let fixture: ComponentFixture<RemoteComponent>;
  let ws: FakeWebSocketService;
  let reliability: FakeReliabilityService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RemoteComponent],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: ReliabilityService, useClass: FakeReliabilityService as any },
        { provide: GameService, useClass: FakeGameService },
        { provide: AudioService, useClass: FakeAudioService },
        { provide: SwUpdate, useClass: FakeSwUpdate },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteComponent);
    component = fixture.componentInstance;
    ws = TestBed.inject(WebSocketService) as unknown as FakeWebSocketService;
    reliability = TestBed.inject(ReliabilityService) as unknown as FakeReliabilityService;
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

  it('should store the nickname and announce the player to the TV', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    expect(component.nickname()).toBe('Anna');
    expect(localStorage.getItem('nickname')).toBe('Anna');
    expect(ws.broadcasted.at(-1)?.body).toEqual({ action: 'JOIN_GAME', playerName: 'Anna' });
  });

  it('does not enter when the team name is rejected', async () => {
    vi.spyOn(reliability, 'start').mockResolvedValue(false);
    component.tempNickname = 'Anna';
    await component.setNickname();
    expect(component.nickname()).toBeNull();
    expect(localStorage.getItem('nickname')).toBeNull();
    expect(ws.broadcasted).toHaveLength(0);
  });

  it('should publish the vote and lock the phone', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    component.sendVote(2);

    expect(ws.publishedAnswers).toHaveLength(1);
    expect(ws.publishedAnswers[0]).toMatchObject({
      gameId: 1,
      playerName: 'Anna',
      answerIndex: 2,
    });
    expect(component.gameState()).toBe('LOCKED');
  });

  it('keeps the phone unlocked when a vote or buzz cannot be sent', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.onStartVoting('QUIZ');
    vi.spyOn(ws, 'sendAnswer').mockReturnValue(false);

    component.sendVote(2);
    expect(component.gameState()).toBe('VOTING');
    expect(component.hasAnswered()).toBe(false);
    expect(component.selectedAnswer()).toBeNull();
    expect(reliability.lastError()).toContain('non inviata');

    component.sendBuzz();
    expect(component.gameState()).toBe('VOTING');
    expect(reliability.lastError()).toContain('non inviata');
  });

  it('should block only the player named in the error', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    ws.status$.next({ action: 'BLOCKED_ERROR', blockedPlayer: 'Anna' });
    await fixture.whenStable();

    expect(component.isBlocked()).toBe(true);
    expect(component.gameState()).toBe('BLOCKED_ERROR');
  });

  it('should reopen a new round from the snapshot after an answer', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    ws.status$.next({
      action: 'START_VOTING',
      type: 'TIMELINE',
      payload: JSON.stringify({ items: [{ id: 0, label: 'Prima carta' }] }),
    });
    await fixture.whenStable();

    // Telefono rimasto bloccato con la risposta del round precedente: senza il
    // reset della chiave il nuovo snapshot veniva scartato e restava in attesa.
    component.hasAnswered.set(true);
    component.gameState.set('LOCKED' as any);

    reliability.syncState$.next({
      hasState: true,
      roundIndex: 1,
      roundType: 'TIMELINE',
      roundKey: 'g1-r1',
      roundDeadlineAt: Date.now() + 60_000,
      currentRound: {
        type: 'TIMELINE',
        roundKey: 'g1-r1',
        payload: JSON.stringify({
          items: [{ id: 0, label: 'Prima carta' }, { id: 1, label: 'Seconda carta' }],
        }),
      },
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('VOTING');
    expect(component.hasAnswered()).toBe(false);
    expect(component.timelineCards().length).toBe(2);
  });

  it('should go back to waiting when the snapshot has no open round', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });
    await fixture.whenStable();

    reliability.syncState$.next({
      hasState: true,
      status: 'WAITING',
      roundType: null,
      roundDeadlineAt: Date.now() - 1_000,
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.hasAnswered()).toBe(false);
  });

  it('should not let a player with zero points bet in Azzardo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    const state = (maxBet: number, points: number) => ({
      phase: 'BET',
      manche: 1,
      total: 4,
      category: 'STORIA',
      unit: 'anno',
      options: [1900, 1910, 1920, 1930],
      ready: [{ playerName: 'Anna', points, maxBet, ready: false }],
    });

    component.azzardoState.set(state(0, 0));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    component.azzardoState.set(state(100, 100));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(true);
  });

  it('sends a pending Timeline answer only while the round is active', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      component.tempNickname = 'Anna';
      await component.setNickname();
      const start = () => ws.status$.next({
        action: 'START_VOTING', type: 'TIMELINE', payload: { items: [{ id: 1, label: 'Carta' }] },
      });

      start();
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);

      start();
      ws.status$.next({ action: 'ROUND_ENDED' });
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);

      start();
      component.ngOnDestroy();
      vi.advanceTimersByTime(350);
      expect(submit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses a round-specific Timeline key and sends button changes', async () => {
    vi.useFakeTimers();
    try {
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      component.tempNickname = 'Anna';
      await component.setNickname();
      const cards = [{ id: 0, label: 'A' }, { id: 1, label: 'B' }];
      component.onStartVoting('TIMELINE', { roundId: 'round-one', items: cards });
      vi.advanceTimersByTime(350);
      const firstKey = submit.mock.calls.at(-1)?.[3];
      component.moveCard(0, 1);
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[2]).toEqual([1, 0]);
      component.onStartVoting('TIMELINE', { roundId: 'round-two', items: cards });
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[3]).not.toBe(firstKey);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reset the answer state when the round ends', async () => {
    ws.status$.next({ action: 'START_VOTING', type: 'QUIZ' });
    ws.status$.next({ action: 'ROUND_ENDED' });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.hasAnswered()).toBe(false);
  });
});
