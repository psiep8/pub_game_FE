import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoundRecap } from './round-recap.component';
import type { RecapRow } from './round-recap-model';

/** Righe già ordinate dal modello: peggiore per primo, podio in fondo. */
function rows(count: number): RecapRow[] {
  return Array.from({ length: count }, (_, index) => ({
    playerName: `Squadra ${index + 1}`,
    delta: index + 1,
    total: 100 - index,
    position: count - index,
  }));
}

function create(recapRows: RecapRow[]) {
  const fixture = TestBed.createComponent(RoundRecap);
  fixture.componentInstance.rows = recapRows;
  fixture.componentInstance.label = 'ROUND 12 · QUIZ';
  const done = vi.fn();
  fixture.componentInstance.onComplete.subscribe(done);
  fixture.detectChanges();
  return { fixture, done };
}

describe('RoundRecap (N-11)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RoundRecap] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con quattro squadre resta su una pagina e si chiude dopo otto secondi', () => {
    const { fixture, done } = create(rows(4));
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.recap-row')).toHaveLength(4);
    expect(element.querySelector('.recap-title')?.textContent).toContain('ROUND 12 · QUIZ');
    expect(element.querySelectorAll('.recap-row.gold')).toHaveLength(1);

    vi.advanceTimersByTime(7_000);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(done).toHaveBeenCalledTimes(1);

    fixture.destroy();
  });

  it('oltre dieci squadre pagina a sette righe e il podio arriva in fondo', () => {
    const { fixture, done } = create(rows(12));
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.recap-row')).toHaveLength(7);
    expect(element.querySelectorAll('.recap-row.gold')).toHaveLength(0);

    vi.advanceTimersByTime(3_000);
    fixture.detectChanges();

    expect(element.querySelectorAll('.recap-row')).toHaveLength(5);
    expect(element.querySelectorAll('.recap-row.gold')).toHaveLength(1);
    expect(element.querySelectorAll('.recap-row.silver')).toHaveLength(1);
    expect(element.querySelectorAll('.recap-row.bronze')).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(done).toHaveBeenCalledTimes(1);

    fixture.destroy();
  });

  it('chiude una sola volta e non lascia timer dietro di sé', () => {
    const { fixture, done } = create(rows(20));

    vi.advanceTimersByTime(9_000);
    expect(done).toHaveBeenCalledTimes(1);

    fixture.destroy();
    vi.advanceTimersByTime(30_000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('scrive le variazioni con il segno, zero compreso', () => {
    const { fixture } = create(rows(2));
    const component = fixture.componentInstance;

    expect(component.signedDelta(30)).toBe('+30');
    expect(component.signedDelta(-10)).toBe('−10');
    expect(component.signedDelta(0)).toBe('0');

    fixture.destroy();
  });
});