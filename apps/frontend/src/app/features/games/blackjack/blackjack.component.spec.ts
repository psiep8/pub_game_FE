import { TestBed } from '@angular/core/testing';
import { Blackjack } from './blackjack.component';

describe('Blackjack — esiti del bonus senza punti', () => {
  function mount(displayData: any) {
    const fixture = TestBed.createComponent(Blackjack);
    fixture.componentRef.setInput('displayData', displayData);
    fixture.detectChanges();
    return fixture;
  }

  it('evidenzia il vincitore nella tabella finale e non stampa lo zero', () => {
    const fixture = mount({
      phase: 'FINALE',
      index: 2,
      total: 2,
      rows: [
        { playerName: 'Anna', status: 'WIN', points: 0 },
        { playerName: 'Bruno', status: 'LOSE', points: 0 },
      ],
    });

    const rows = fixture.nativeElement.querySelectorAll('.bj-final-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].classList).toContain('won');
    expect(rows[0].textContent).toContain('VINCE');
    expect(rows[0].textContent).toContain('PREMIO AL BAR');
    expect(rows[1].classList).not.toContain('won');
    expect(rows[0].textContent).not.toContain('0');

    fixture.destroy();
  });

  it('evidenzia il tavolo e l’esito vincente nella mano a zero punti', () => {
    const fixture = mount({
      phase: 'REVEAL',
      index: 1,
      total: 2,
      currentTable: 'Anna',
      stake: 0,
      cards: ['J♥', '8♥'],
      handTotal: 18,
      bank: { cards: ['10♠', '9♠'], total: 19, hidden: false },
      choice: 'STAND',
      result: { outcome: 'WIN', points: 0, round: 1, handTotal: 18, bankTotal: 19 },
      rows: [
        { playerName: 'Anna', status: 'WIN', points: 0 },
        { playerName: 'Bruno', status: 'LOSE', points: 0 },
      ],
    });

    const table = fixture.nativeElement.querySelector('.bj-side.table');
    const outcome = fixture.nativeElement.querySelector('.bj-outcome');
    const winnerChip = fixture.nativeElement.querySelector('.bj-chip');

    expect(table.classList).toContain('won');
    expect(outcome.classList).toContain('good');
    expect(winnerChip.classList).toContain('won');
    expect(fixture.nativeElement.querySelector('.bj-points')).toBeNull();
    expect(fixture.nativeElement.querySelector('.bj-token')).toBeNull();

    fixture.destroy();
  });
});
