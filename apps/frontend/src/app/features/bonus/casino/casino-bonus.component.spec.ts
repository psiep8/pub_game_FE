import { TestBed } from '@angular/core/testing';
import { CasinoBonus } from './casino-bonus.component';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { AudioService } from '../../../core/services/audio.service';
import { FakeAudioService, FakeWebSocketService } from '../../../shared/testing/test-doubles';

describe('CasinoBonus — ripresa dopo un refresh della TV', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CasinoBonus],
      providers: [
        { provide: WebSocketService, useClass: FakeWebSocketService },
        { provide: AudioService, useClass: FakeAudioService },
      ],
    }).compileComponents();
  });

  function mount(resume: any) {
    const fixture = TestBed.createComponent(CasinoBonus);
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('variant', 'COLOR');
    fixture.componentRef.setInput('resume', resume);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('riapre il voto con i voti già dati e il tempo che resta', () => {
    const { fixture, component } = mount({
      votes: [{ playerName: 'Anna', choice: 'ROSSO' }],
      scores: [{ playerName: 'Anna', score: 100 }],
      secondsLeft: 8,
      savedAt: Date.now() - 3000,
      winner: null,
    });

    expect(component.phase()).toBe(component.Phase.PICK);
    expect(component.secondsLeft()).toBe(5);
    expect(component.options()).toEqual(['NERO', 'ROSSO']);
    expect(component.votesView()).toEqual([{ playerName: 'Anna', choice: 'ROSSO' }]);
    expect(component.totals()).toEqual([{ playerName: 'Anna', score: 100 }]);

    fixture.destroy();
  });

  it('scarta i voti di chi non gioca o su opzioni che non esistono', () => {
    const { fixture, component } = mount({
      votes: [
        { playerName: 'Carla', choice: 'ROSSO' },
        { playerName: 'Bruno', choice: 'VERDE' },
      ],
      scores: [],
      secondsLeft: 10,
      savedAt: Date.now(),
      winner: null,
    });

    expect(component.votesView()).toEqual([]);
    fixture.destroy();
  });

  it('senza tempo rimasto va diretto alla ruota', () => {
    // La ruota vera usa Matter: qui interessa solo che la manche riparta.
    const fixture = TestBed.createComponent(CasinoBonus);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 1);
    fixture.componentRef.setInput('players', ['Anna', 'Bruno']);
    fixture.componentRef.setInput('variant', 'COLOR');
    fixture.componentRef.setInput('resume', {
      votes: [{ playerName: 'Anna', choice: 'NERO' }],
      scores: [],
      secondsLeft: 2,
      savedAt: Date.now() - 60_000,
      winner: null,
    });
    const spin = vi.spyOn(component as any, 'spinManche').mockResolvedValue(undefined);

    fixture.detectChanges();

    // Il voto non si riapre: la manche era già scaduta, la ruota riparte.
    expect(spin).toHaveBeenCalled();
    expect(component.votesView()).toEqual([{ playerName: 'Anna', choice: 'NERO' }]);
    fixture.destroy();
  });
});
