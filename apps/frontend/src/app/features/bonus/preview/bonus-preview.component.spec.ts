import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BlackjackBonus } from '../blackjack/blackjack-bonus.component';
import { CasinoBonus } from '../casino/casino-bonus.component';
import { CavalloBonus } from '../cavallo/cavallo-bonus.component';
import { BonusPreview } from './bonus-preview.component';

/** I tre bonus veri hanno WebSocket, audio e timer: qui bastano gli input. */
@Component({ standalone: true, selector: 'app-casino-bonus', template: '' })
class CasinoStub {
  @Input() gameId = 1;
  @Input() players: string[] = [];
  @Input() preview = false;
  @Input() variant: 'COLOR' | 'DOZEN' | 'NUMBER' = 'COLOR';
}

@Component({ standalone: true, selector: 'app-blackjack-bonus', template: '' })
class BlackjackStub {
  @Input() gameId = 1;
  @Input() players: string[] = [];
  @Input() preview = false;
}

@Component({ standalone: true, selector: 'app-cavallo-bonus', template: '' })
class CavalloStub {
  @Input() gameId = 1;
  @Input() players: string[] = [];
  @Input() preview = false;
  @Input() categories: unknown[] = [];
}

describe('BonusPreview — il banco di prova dei cinque bonus', () => {
  const originalUrl = window.location.href;

  afterEach(() => {
    window.history.replaceState({}, '', originalUrl);
    TestBed.resetTestingModule();
  });

  function mount(type: string | null, search = '') {
    window.history.replaceState({}, '', `/bonus-preview${type ? `/${type}` : ''}${search}`);
    const paramMap = convertToParamMap(type ? { type } : {});
    TestBed.configureTestingModule({
      imports: [BonusPreview],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    });
    TestBed.overrideComponent(BonusPreview, {
      remove: { imports: [BlackjackBonus, CasinoBonus, CavalloBonus] },
      add: { imports: [BlackjackStub, CasinoStub, CavalloStub] },
    });
    const fixture = TestBed.createComponent(BonusPreview);
    fixture.detectChanges();
    return fixture;
  }

  const casino = (fixture: ReturnType<typeof mount>) =>
    fixture.debugElement.query(By.directive(CasinoStub))?.componentInstance as CasinoStub | undefined;

  it('elenca i cinque bonus nell’ordine degli atti', () => {
    const fixture = mount(null);
    const component = fixture.componentInstance;

    expect(component.cards.map((card) => card.id)).toEqual([
      'casino',
      'blackjack',
      'dozzina',
      'cavallo',
      'numero',
    ]);
    expect(component.cards.map((card) => card.title)).toEqual([
      'CASINO',
      'BLACKJACK',
      'CASINO DOZZINA',
      'CAVALLO',
      'CASINO NUMERO SECCO',
    ]);

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.bp-card') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/bonus-preview/casino',
      '/bonus-preview/blackjack',
      '/bonus-preview/dozzina',
      '/bonus-preview/cavallo',
      '/bonus-preview/numero',
    ]);
  });

  it('una route sconosciuta torna all’indice', () => {
    const fixture = mount('biglie');

    expect(fixture.componentInstance.kind()).toBeNull();
    expect(fixture.nativeElement.querySelector('.bp-index')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bp-live')).toBeFalsy();
  });

  it('apre il casino bianco/rosso', () => {
    const fixture = mount('casino');

    expect(casino(fixture)?.variant).toBe('COLOR');
    expect(casino(fixture)?.preview).toBe(true);
  });

  it('apre la dozzina', () => {
    const fixture = mount('dozzina');

    expect(casino(fixture)?.variant).toBe('DOZEN');
  });

  it('apre il numero secco', () => {
    const fixture = mount('numero');

    expect(casino(fixture)?.variant).toBe('NUMBER');
  });

  it('apre il blackjack con i tavoli demo', () => {
    const fixture = mount('blackjack');
    const blackjack = fixture.debugElement.query(By.directive(BlackjackStub))
      ?.componentInstance as BlackjackStub | undefined;

    expect(blackjack?.preview).toBe(true);
    expect(blackjack?.players.length).toBeGreaterThan(0);
    expect(casino(fixture)).toBeUndefined();
  });

  it('apre il cavallo', () => {
    const fixture = mount('cavallo');
    const cavallo = fixture.debugElement.query(By.directive(CavalloStub))
      ?.componentInstance as CavalloStub | undefined;

    expect(cavallo?.preview).toBe(true);
    expect(cavallo?.categories).toHaveLength(4);
  });

  it('la barra gira le tre varianti del casino', () => {
    const fixture = mount('dozzina');
    const variants = Array.from(
      fixture.nativeElement.querySelectorAll('.bp-variants a') as NodeListOf<HTMLAnchorElement>,
    );

    expect(variants.map((link) => link.textContent?.trim())).toEqual([
      'BIANCO/ROSSO',
      'DOZZINA',
      'NUMERO SECCO',
    ]);
    expect(variants[1].classList.contains('on')).toBe(true);
    expect(variants[0].classList.contains('on')).toBe(false);
  });

  it('il cavallo non mostra il selettore delle varianti', () => {
    const fixture = mount('cavallo');

    expect(fixture.nativeElement.querySelector('.bp-bar-sep')).toBeFalsy();
  });

  it('?giocatori=3 limita i tavoli del banco di prova', () => {
    const fixture = mount('blackjack', '?giocatori=3');

    expect(fixture.componentInstance.players).toEqual(['Anna', 'Luca', 'Marco']);
  });

  it('?capture nasconde la barra di navigazione', () => {
    const fixture = mount('casino', '?capture');

    expect(fixture.componentInstance.capture).toBe(true);
    expect(fixture.nativeElement.querySelector('.bp-bar')).toBeFalsy();
  });
});
