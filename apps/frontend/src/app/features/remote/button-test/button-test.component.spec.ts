import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ButtonTestComponent } from './button-test.component';
import { ButtonTestService } from '../../../core/services/button-test.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { FakeWebSocketService } from '../../../shared/testing/test-doubles';

describe('ButtonTestComponent', () => {
  let fixture: ComponentFixture<ButtonTestComponent>;
  let component: ButtonTestComponent;
  let nextStep = 1;
  let completed = false;

  beforeEach(async () => {
    nextStep = 1;
    completed = false;
    const team = () => ({
      playerName: 'Anna',
      completedSteps: nextStep - 1,
      nextStep,
      done: [1, 2, 3, 4, 5].map((step) => step < nextStep),
      latencyMs: -1,
      vibrated: null,
      flagged: false,
      skipped: false,
      completed,
      updatedAt: 0,
      steps: 5,
      targetLabel: 'B',
    });
    const service = {
      me: () => of(team()),
      step: vi.fn((_gameId: number, result: { step: number }) => {
        nextStep = Math.min(5, result.step + 1);
        completed = result.step === 5;
        return of(team());
      }),
      ping: () => of({ serverTime: Date.now(), clientAt: Date.now() }),
    };

    await TestBed.configureTestingModule({
      imports: [ButtonTestComponent],
      providers: [
        { provide: ButtonTestService, useValue: service },
        { provide: WebSocketService, useClass: FakeWebSocketService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonTestComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('riprende dal primo passo non completato', () => {
    expect(component.step()).toBe(1);
    expect(component.doneSteps()).toEqual([false, false, false, false, false]);
  });

  it('avanza al passo successivo e riordina le tre carte', () => {
    component.advance(1);
    fixture.detectChanges();
    expect(component.step()).toBe(2);

    component.choose(1);
    fixture.detectChanges();
    expect(component.step()).toBe(3);
    expect(component.cards()).toEqual([2, 0, 1]);

    component.startDrag(0);
    component.drop(1);
    component.startDrag(1);
    component.drop(2);
    expect(component.cards()).toEqual([0, 1, 2]);
  });
});
