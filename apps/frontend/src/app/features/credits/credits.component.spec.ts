import { TestBed } from '@angular/core/testing';

import { Credits } from './credits.component';

/**
 * La pagina deve dire cosa dipende dal locale, senza promettere licenze che
 * non abbiamo. È il contratto minimo con chi la apre in sala.
 */
describe('Crediti e licenze', () => {
  it('elenca le famiglie e rimanda al documento operativo', () => {
    const fixture = TestBed.createComponent(Credits);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;

    expect(text).toContain('CREDITI E LICENZE');
    expect(text).toContain('AUDIO DEL GIOCO');
    expect(text).toContain('MUSICA E KARAOKE');
    expect(text).toContain('SIAE');
    expect(text).toContain('SCF');
    expect(text).toContain('non sono inclusi nella licenza del gioco');
    expect(text).toContain('docs/LICENZE.md');
  });
});
