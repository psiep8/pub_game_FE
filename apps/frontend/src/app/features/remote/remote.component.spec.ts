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
import { ButtonTestService } from '../../core/services/button-test.service';
import { FakeButtonTestService } from '../../shared/testing/fake-button-test.service';

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
        { provide: ButtonTestService, useClass: FakeButtonTestService },
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

  it('chiede nome e foto prima del tutorial', async () => {
    // Prima del nome la prova dei pulsanti non esiste: si entra con nome e
    // foto, poi si prova il telefono, poi si aspetta la TV.
    expect(component.showButtonTest()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-button-test')).toBeNull();
    const enableTutorial = vi.spyOn(component.showButtonTest, 'set');

    component.tempNickname = 'Bianca';
    await component.setNickname();

    // Il tutorial si apre dallo stesso gesto che registra nome e foto, non
    // prima: nessun ingresso senza squadra.
    expect(component.nickname()).toBe('Bianca');
    expect(enableTutorial).toHaveBeenCalledWith(true);
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

  it('requires a team name between 2 and 16 characters before registering', async () => {
    const start = vi.spyOn(reliability, 'start');
    for (const name of [' ', 'A', '12345678901234567']) {
      component.tempNickname = name;
      await component.setNickname();
      expect(component.nickname()).toBeNull();
      expect(reliability.lastError()).toContain('da 2 a 16');
    }
    expect(start).not.toHaveBeenCalled();
    component.tempNickname = '  AB  ';
    await component.setNickname();
    expect(component.nickname()).toBe('AB');
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

  it('non riabilita gli input finché il server non ha detto in che round siamo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    let finishSync: () => void = () => {};
    vi.spyOn(reliability, 'sync').mockReturnValue(
      new Promise<void>((resolve) => { finishSync = resolve; }),
    );

    const realign = (component as any).realignWithServer();
    expect(component.resyncing()).toBe(true);
    expect(component.inputReady()).toBe(false);

    // Un tap mentre si riallinea non deve produrre una risposta.
    component.onStartVoting('QUIZ');
    component.sendVote(1);
    expect(ws.publishedAnswers).toHaveLength(0);

    finishSync();
    await realign;
    expect(component.resyncing()).toBe(false);
    expect(component.inputReady()).toBe(true);
  });

  it('dopo il riallineamento a round chiuso torna in attesa, senza pulsanti attivi', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();
    component.gameState.set('VOTING' as any);

    reliability.syncState$.next({
      hasState: true,
      roundType: 'QUIZ',
      roundKey: 'g1-r9',
      roundDeadlineAt: Date.now() - 1_000,
      currentRound: { type: 'QUIZ', roundKey: 'g1-r9' },
    });
    await fixture.whenStable();

    expect(component.gameState()).toBe('WAITING');
    expect(component.roundActive()).toBe(false);
    expect(component.hasAnswered()).toBe(false);
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

  it('reopens a different Timeline round but preserves the order on a same-round sync', async () => {
    vi.useFakeTimers();
    try {
      component.tempNickname = 'Anna';
      await component.setNickname();
      const firstCards = [{ id: 0, label: 'Vecchia A' }, { id: 1, label: 'Vecchia B' }];
      component.onStartVoting('TIMELINE', { roundId: 'old', items: firstCards });
      const nextCards = [{ id: 0, label: 'Nuova A' }, { id: 1, label: 'Nuova B' }];
      const snapshot = {
        hasState: true, roundKey: 'g1-r2', roundType: 'TIMELINE',
        roundDeadlineAt: Date.now() + 60_000,
        currentRound: { type: 'TIMELINE', roundKey: 'g1-r2', payload: { roundId: 'new', items: nextCards } },
      };
      reliability.syncState$.next(snapshot);
      expect(component.timelineCards()).toEqual(nextCards);
      component.moveCard(0, 1);
      reliability.syncState$.next(snapshot);
      expect(component.timelineOrder()).toEqual([1, 0]);
      const game = TestBed.inject(GameService) as unknown as FakeGameService;
      const submit = vi.spyOn(game, 'submitTimeline');
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[4]).toBe('new');
    } finally {
      vi.useRealTimers();
    }
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

    // Chi ha punti può preparare la puntata, ma non parte da sola: serve la
    // conferma e almeno una fiche sul tavolo.
    component.azzardoState.set(state(100, 100));
    component.azzardoPick(0);
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);

    component.azzardoAddChip(0, -1);
    component.azzardoConfirmBet();
    expect(ws.broadcasted.some((entry) => entry.body.action === 'AZZARDO_ACTION')).toBe(false);
    expect(reliability.lastError()).toContain('almeno una fiche');

    component.azzardoPick(0);
    component.azzardoConfirmBet();
    const bets = ws.broadcasted.filter((entry) => entry.body.action === 'AZZARDO_ACTION');
    expect(bets).toHaveLength(1);
    expect(bets[0].body.value.chips).toEqual([1, 0, 0, 0]);
  });

  it('rispetta il tetto di fiches della squadra e cita i 1000 punti di massimo', async () => {
    component.tempNickname = 'Anna';
    await component.setNickname();

    const azzardoState = (row: Record<string, number>) => ({
      phase: 'BET',
      manche: 2,
      total: 4,
      category: 'CANZONI',
      unit: 'anno',
      options: [1969, 1971, 1973, 1975],
      chips: 10,
      chipValue: 20,
      chipCap: 15,
      winCap: 1000,
      odds: 2,
      lossMultiplier: 0.8,
      ready: [{
        playerName: 'Anna',
        points: 1120,
        maxBet: 300,
        chipsBank: 17,
        chipsCap: 13,
        chips: [],
        ...row,
      }],
    });

    component.azzardoState.set(azzardoState({}));
    component.azzardoChips.set([7, 0, 0, 0]);

    // Salvadanaio 17, tetto della squadra 13, credito 300 / 20 = 15 → 13.
    expect(component.azzardoMyChipCap()).toBe(13);
    expect(component.azzardoMaxChips()).toBe(13);
    expect(component.azzardoChipsLeft()).toBe(10);

    // Il tetto della squadra comanda sul massimo dichiarato.
    component.azzardoState.set(azzardoState({ chipsCap: 11 }));
    expect(component.azzardoMaxChips()).toBe(11);

    // Il credito in punti taglia sotto il tetto.
    component.azzardoState.set(azzardoState({ maxBet: 100 }));
    expect(component.azzardoMaxChips()).toBe(5);

    // La riga di conversione dichiara il tetto di vincita della manche.
    expect(component.azzardoConvertHint()).toContain('1000');
    expect(component.azzardoConvertHint()).toContain('manche');

    // Se il server non manda il tetto, resta quello del regolamento.
    const withoutCap: any = azzardoState({});
    delete withoutCap.winCap;
    component.azzardoState.set(withoutCap);
    expect(component.azzardoConvertHint()).toContain('1000');
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
      expect(submit.mock.calls.at(-1)?.[4]).toBe('round-one');
      component.moveCard(0, 1);
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[2]).toEqual([1, 0]);
      component.onStartVoting('TIMELINE', { roundId: 'round-two', items: cards });
      vi.advanceTimersByTime(350);
      expect(submit.mock.calls.at(-1)?.[3]).not.toBe(firstKey);
      expect(submit.mock.calls.at(-1)?.[4]).toBe('round-two');
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
